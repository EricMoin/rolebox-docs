---
title: 处理管道
description: rolebox 端到端消息处理流水线——从插件加载到函数解析、dispatch、恢复与响应注入
---

# 处理管道

> **相关文档：** [架构概览](/01-Overview/architecture-overview) — 模块职责与入口点总览 | [服务架构](/01-Overview/service-architecture) — 服务依赖关系与拓扑排序 | [Hook 参考](/03-Reference/hooks) — 内置 Hook 完整类型与配置

## 数据流总览

一条用户消息从输入到响应的完整流转：

```mermaid
flowchart LR
    subgraph Plugin[插件加载]
        A[opencode 启动] --> B[index.ts<br/>bootstrapRoles]
        B --> C[composition.ts<br/>createPluginHooks]
        C --> D[返回 handlers]
    end

    subgraph Processing[消息处理]
        E[用户消息] --> F[chat.message hook<br/>chat-message.ts]
        F --> G[函数解析器<br/>parser.ts]
        G --> H{检测到\n函数调用?}
        H -->|是| I[函数会话状态\nsession-state.ts]
        H -->|否| J[透传]
        I --> K[system.transform hook<br/>system-transform.ts]
        K --> L[提示构建<br/>builder.ts]
    end

    subgraph Execution[执行与调度]
        L --> M{tool.execute\nbefore/after}
        M --> N[tool.before<br/>参数验证]
        N --> O[tool 执行<br/>(dispatch/task 等)]
        O --> P[tool.after<br/>结果捕获]
        P --> Q[dispatch 引擎<br/>dispatch/core/]
    end

    subgraph Recovery[恢复层]
        Q --> R{执行失败?}
        R -->|是| S[recovery/engine.ts<br/>策略链]
        S --> T[重试/回退/截断]
        T --> Q
        R -->|否| U[响应注入<br/>pendingCorrections]
    end

    U --> V[返回响应给用户]
```

下方序列图展示了端到端消息处理的时间序列，突出各组件之间的调用关系与校正回环：

> 说明：参与者名称对应 `src/hooks/`、`src/function/`、`src/dispatch/` 中的实现文件。

```mermaid
sequenceDiagram
    participant User as 用户
    participant OP as opencode 核心
    participant CM as chat.message hook<br/>src/hooks/chat-message.ts
    participant FP as 函数解析器<br/>src/function/parser.ts
    participant ST as system.transform<br/>src/hooks/system-transform.ts
    participant MDL as LLM 模型
    participant TB as tool.before<br/>参数验证
    participant TK as 工具执行<br/>dispatch/task
    participant TA as tool.after<br/>结果捕获
    participant DM as DispatchManager<br/>src/dispatch/core/
    participant SA as 子代理
    participant REC as RecoveryEngine<br/>src/recovery/

    User->>OP: 发送消息
    OP->>CM: handleChatMessage()
    CM->>FP: parseFunctionActivation()
    FP-->>CM: 函数调用列表
    CM->>CM: 初始化运行时状态
    CM-->>OP: 返回 cleanedText
    OP->>ST: 构建系统提示
    ST-->>OP: 注入校正 / 记忆 / 图状态
    OP->>MDL: 模型调用
    MDL->>TB: 工具调用
    TB->>TB: 参数验证 (zod)
>>TK: 执行工具
    TK->>DM: 子代理派发
    DM->>SA: dispatch / task
    SA-->>DM: 返回结果
    DM-->>TK: 结果收集
    TK->>TA: tool.after
    TA->>TA: 图推进 + 观测器
    TA-->>OP: 注入校正

    alt 执行失败
        TK->>REC: 错误模式匹配
        REC->>REC: 策略链执行
        REC-->>TK: 重试 / 回退 / 截断
    end

    OP-->>User: 最终响应
```


### 一分钟速览

| 阶段 | 描述 |
|------|------|
| **1. 插件加载** | opencode 启动时，`index.ts` 发现 rolebox 目录 → `bootstrapRoles()` → `createPluginHooks()` → 返回 handler 对象 |
| **2. 消息处理** | `chat.message` hook 拦截用户消息，`parseFunctionActivation()` 提取 `\|fn:args\|` 语法，初始化函数运行时和协作图状态 |
| **3. 系统提示构建** | `system.transform` hook 在每次模型调用前注入校正、记忆、函数状态、协作图状态和依赖守卫 |
| **4. 工具执行** | `tool.before` 验证参数，`tool.after` 捕获 dispatch 结果、推进协作图、运行观测器和自定义处理器 |
| **5. 函数解析** | `parser.ts` 解析简单/位置/键值/链式四种语法；`phase-machine.ts` 评估门控条件和函数转换 |
| **6. Dispatch 引擎** | `DispatchManager` 管理子代理任务的生命周期：创建 → 并发控制 → 执行 → 结果收集 → 持久化 |
| **7. 恢复层** | `RecoveryEngine` 检测错误模式、执行 7 种内置策略（重试/回退/截断/压缩等）→ 可恢复时重试，否则中止 |

## 阶段详解

### 阶段 1：插件加载 (Plugin Loading)

opencode 启动时调用 `src/index.ts` 导出的 `RoleboxPlugin` 函数：

- **`src/index.ts:21-66`** — 插件入口，发现 rolebox 目录 → `bootstrapRoles()` → `createPluginHooks()` → 返回 handler 对象
- **`src/index.ts:32-39`** — `bootstrapRoles` 调用：发现所有角色 → 解析技能/引用/函数/子代理/协作图
- **`src/pi-extension.ts:72-371`** — Pi IDE 的独立入口点，完成了同样的角色引导 + Pi 平台适配器 + 事件桥接

关键数据类型：`Plugin`（`@opencode-ai/plugin` 接口）→ `PluginInput`（client, directory）→ 返回 hook handler 对象。

### 阶段 2：消息处理 (Message Processing)

用户发送消息后，opencode 调用 `chat.message` hook：

**`src/hooks/chat-message.ts:16-257`** — `handleChatMessage`：
1. **合成注入检测**（第 26-29 行）：识别 auto-continue、循环进度、dispatch 通知，跳过不必要的处理
2. **Hook 系统**：先运行内置 Hook（built-in），再运行自定义 Hook（custom），均分为 `before` 和 `after` 阶段
3. **函数激活解析**（第 108-131 行）：`parseFunctionActivation()` 从消息文本中提取 `|fn:args|` 模式
4. **自动激活函数**（第 82-106 行）：根据 `auto_activate` 配置自动激活函数
5. **循环调度**（第 134-168 行）：检测 `|loop|` 函数调用，解析参数，委托 `LoopCoordinator`
6. **运行时状态初始化**（第 170-180 行）：为每个激活函数创建运行时状态
7. **观测器执行**（第 206-225 行）：运行 `on:message` 观测器，生成校正注入

```typescript
// src/hooks/chat-message.ts 核心调用链
parseFunctionActivation(part.text)  // → { functions, calls, cleanedText }
functionSessionState.activate()      // → 更新激活状态
graphSessionState.initGraph()        // → 初始化协作图状态
functionRuntime.init()               // → 创建运行时状态
```

### 阶段 3：系统提示构建 (System Transform)

每次模型调用前，opencode 调用 `experimental.chat.system.transform` hook：

**`src/hooks/system-transform.ts:17-323`** — `handleSystemTransform`：
1. **校正注入**（第 57-62 行）：将 `pendingCorrections` 中的内容注入到系统提示中
2. **可用函数块**（第 76-84 行）：为当前代理列出所有已解析函数
3. **记忆注入**（第 87-109 行）：根据 `memory` 配置从 `MemoryStore` 检索并注入关联记忆
4. **协作图状态**（第 114-119 行）：注入图的当前状态（节点、边、位置）
5. **函数块构建**（第 156-271 行）：对每个激活函数执行 `evaluateGateAndTransitions()`：
   - 检查门控条件 → 更新阶段（active/gated）
   - 评估转换条件 → 激活/停用相关函数
   - 按优先级排序函数
   - 注入消耗的工件（consumed artifacts）
6. **依赖守卫**（第 214-223 行）：确保函数的 `requires` 依赖都已激活

### 阶段 4：工具执行 (Tool Execution)

模型调用工具时触发 `tool.execute.before` 和 `tool.execute.after`：

**`src/hooks/tool-before.ts:30-164`** — `handleToolBefore`：
- **参数验证**（第 70-118 行）：用 zod `.strict()` 模式验证工具参数，拒绝未知参数
- **dispatch_output 守卫**（第 121-132 行）：阻止对仍在运行的任务调用 `dispatch_output`

**`src/hooks/tool-after.ts:36-201`** — `handleToolAfter`：
- **结果捕获**（第 99-111 行）：为协作图的终止条件捕获 dispatch 结果
- **图推进**（第 113-117 行）：`advanceGraphForDispatch()` — 根据结果推进协作图
- **函数观测器**（第 131-152 行）：`runToolObserve()` — 运行 `on:tool_after` 观测器
- **处理器执行**（第 155-169 行）：`loadHandlers()` + `onToolAfter()` — 运行自定义处理器

### 阶段 5：函数解析 (Function Parsing)

**`src/function/parser.ts:20-59`** — `parseFunctionActivation` 解析三种语法：

```
|fn|                        → 简单激活
|fn:arg1,arg2|             → 位置参数
|fn key1=val1 key2=val2|  → 键值参数
|fn1|fn2:arg|fn3 k=v|     → 链式激活
```

**`src/function/phase-machine.ts:9-30`** — `evaluateGateAndTransitions`：
- 评估门控条件 → 设定 `gateSatisfied` 和 `phase`（active/gated）
- 评估转换条件 → 生成 `activate` 和 `deactivate` 列表

### 阶段 6：Dispatch 引擎 (Dispatch Engine)

**`src/dispatch/tools.ts:13-50`** — `createDispatchTool` 创建 dispatch 工具：
- 参数：`subagent`, `prompt`, `run_in_background`, `session_id`, `timeout_ms`
- 验证子代理存在性，返回可用列表或执行 dispatch

`DispatchManager`（`src/dispatch/core/manager.ts`）管理完整生命周期：任务创建 → 并发槽 → 子代理执行 → 结果收集 → 超时处理 → 持久化存储。

### 阶段 7：恢复层 (Recovery)

**`src/recovery/engine.ts:21-56`** — `RecoveryEngine`：
- **错误检测**：`PatternRegistry`（`src/recovery/error-detection.ts`）匹配错误模式（session_error, edit_error, json_error 等）
- **策略链**：`RecoveryChainExecutor`（`src/recovery/chain-executor.ts`）顺序执行策略重试→回退模型→截断→压缩→提醒→汇总
- **状态持久化**：`RecoveryStateStore`（`src/recovery/state.ts`）记录恢复尝试

7 种内置策略（`src/recovery/strategies/`）：
| 策略 | 行为 |
|------|------|
| abort-strategy | 立即中止，标记不可恢复 |
| retry-strategy | 重试原始操作 |
| fallback-model-strategy | 切换到回退模型 |
| truncate-strategy | 截断上下文 |
| compact-strategy | 压缩会话 |
| remind-and-retry-strategy | 注入提醒后重试 |
| summarize-strategy | 汇总后重试 |

---

## 在哪里拦截 (Where to Hook In)

rolebox 通过 opencode 的 **7 个 hook 回调** 拦截管道各阶段。以下是 hook → 管道阶段的完整映射，对应 `src/hooks/` 目录下经过验证的实现文件：

| Hook 回调 | 管道阶段 | 实现文件 | 拦截时机 |
|-----------|----------|----------|----------|
| `event` | 会话生命周期 | `src/hooks/event-handler.ts` | 会话创建、切换、结束等生命周期事件 |
| `config` | 插件加载 (阶段 1) | `src/core/services/hook-service.ts:167-206` | 代理配置注入到系统提示 |
| `chat.message` | 消息处理 (阶段 2) | `src/hooks/chat-message.ts` | 用户消息到达时，解析函数激活、调度循环 |
| `experimental.chat.system.transform` | 系统提示构建 (阶段 3) | `src/hooks/system-transform.ts` | 每次模型调用前注入记忆、函数状态、校正 |
| `tool.execute.before` | 工具执行 (阶段 4 — 前) | `src/hooks/tool-before.ts` | 工具执行前参数验证与守卫检查 |
| `tool.execute.after` | 工具执行 (阶段 4 — 后) | `src/hooks/tool-after.ts` | 工具执行后结果捕获、图推进、观测器运行 |
| `session.compacting` | 会话压缩 | `src/hooks/compaction.ts` | 会话压缩前保存检查点 |

### 自定义 Hook (Custom Hooks)

除上述内置 Hook 外，`src/hooks/custom/` 目录支持自定义 Hook 注入，可通过 `before` 和 `after` 阶段在 `chat.message` 处理流程中注册自定义逻辑。详见 [自定义 Hook](/02-Guide/custom-hooks)。

### 拦截优先级

1. **内置 Hook** — rolebox 核心逻辑（如上表所示）
2. **自定义 Hook** — 通过 `custom/` 目录注册的用户扩展
3. **观测器** — 通过 `on:message` 和 `on:tool_after` 配置的按需逻辑

所有 Hook 均遵循 `先 before 后 after` 的执行顺序，内置 Hook 优先于自定义 Hook 执行。

::: tip 调试技巧
如果要确认某个管道阶段是否被正确拦截，可以在 `role.yaml` 中临时添加一个自定义 Hook，在对应事件的 `before` 或 `after` 阶段用 `ctx.inject()` 注入一条标记消息。这是验证拦截时机的快捷方式，无需修改 rolebox 源码。
:::

---

## 流水线回环 (Pipeline Loop)

整个处理过程构成一个回环：

```
用户消息 → chat.message hook → 函数激活 → system.transform → 模型调用
  → tool.execute.before → 工具执行 → tool.execute.after → 校正注入
  → 如果还有 pending corrections → 再次触发模型调用
  → 否则 → 返回最终响应
```

### 管道回环示意图

以下是一个更细致的回环视图，突出校正注入如何形成反馈路径：

```
用户消息
  ↓
chat.message hook  ←── 合成注入检测（跳过 auto-continue、通知等）
  ↓
函数激活解析（parser.ts）→ 运行时状态初始化
  ↓
system.transform hook（注入校正、记忆、函数状态）
  ↓
模型调用
  ↓
tool.execute.before（参数验证 + dispatch_output 守卫）
  ↓
工具执行（dispatch / task 等）
  ↓
tool.execute.after（结果捕获 + 图推进 + 观测器 + 处理器）
  ↓
── 有 pending corrections? ──→ 是 → 校正注入 → 再次触发模型调用
  ↓
  否
  ↓
返回最终响应
```

这个回环的核心机制在 `src/hooks/system-transform.ts:57-62` 中的校正注入步骤：`pendingCorrections` 数组中的每条校正消息都会被注入到下一次系统提示中，并由模型在下一次调用时处理。

循环终止条件由 `max_iterations`（`src/graph/state.ts:127`）、收敛检测（`src/graph/termination.ts`）和校正计数器共同控制。

> **行引用**: `src/hooks/chat-message.ts:16-257` — 消息处理入口  
> `src/hooks/system-transform.ts:17-323` — 系统提示构建  
> `src/hooks/tool-before.ts:30-164` — 工具执行前参数验证  
> `src/hooks/tool-after.ts:36-201` — 工具执行后结果捕获与图推进  
> `src/function/parser.ts:20-59` — 函数激活语法解析  
> `src/function/phase-machine.ts:9-30` — 函数门控与转换评估  
> `src/recovery/engine.ts:65-161` — 恢复引擎核心 recover() 方法

## 下一步

- [架构概览](/01-Overview/architecture-overview) — 模块职责与入口点总览
- [服务架构](/01-Overview/service-architecture) — 服务依赖关系与拓扑排序
- [Hook 参考](/03-Reference/hooks) — 内置 Hook 完整类型与配置
