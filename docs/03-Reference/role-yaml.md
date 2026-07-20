---
title: role.yaml 参考
description: role.yaml 完整字段参考 — 必需字段、可选字段、技能/函数/引用/子代理/协作图/调度配置/Hook/权限
---

# role.yaml 参考

> **相关文档：** [创建角色](/02-Guide/create-a-role) — 角色创建指南 | [调度配置](/03-Reference/dispatch-config) — dispatch 块配置 | [函数系统](/02-Guide/functions) — 函数声明与状态机

本文档是角色 `role.yaml` 文件的完整字段参考。

::: info
`functions:` 字段的行为与直觉相反：它不会替换默认函数，而是**合并**内置的 `[plan, execute, loop]`。如果你只想添加自定义函数而不保留某些内置函数，必须同时使用 `disable_functions` 字段显式移除。
:::

## 完整 Schema

```yaml
# 必需字段
name: string
description: string
prompt: |                     # 或使用 prompt_file（二选一）
  你的系统提示词...

# 可选字段
version: string               # 语义化版本号（如 "1.0.0"）
model: string                 # 如 "gpt-4"、"claude-3-sonnet"
mode: primary | subagent | all  # 默认："primary"
color: string                 # UI 颜色
variant: string               # 模型变体
temperature: number           # 0.0 - 2.0
top_p: number                 # 0.0 - 1.0
prompt_file: string           # 外部提示词文件路径

# 技能
skills:                       # 来自 rolebox/{role}/skills/
  - my-skill
opencode_skills:              # 来自 ~/.config/opencode/skills/
  - humanizer

# 函数
functions:                    # 额外函数（合并，不会替换默认函数）
  - plan                       # 内置默认函数（plan、execute、loop）始终存在
  - execute                    # 除非通过 disable_functions 显式移除
  - my-custom-fn
disable_functions:            # 移除特定的内置函数
  - execute

# 引用文档（显式声明 — 自动发现无需配置）
references:
  api-spec: references/api-spec.md
  design-guide:
    path: docs/design-guide.md
    description: 自定义描述

# 子代理
subagents:                    # 内联子代理（详见子代理）
  - name: string
    description: string
    prompt: string
    # ... 与 role.yaml 相同的字段

# 协作图（详见协作图）
collaboration:
  topology: pipeline | review-loop | star  # 内置拓扑
  agents: [agent-a, agent-b]               # 代理标识符（小写名称）
  flow:                                     # 自定义边（字符串或对象）
    - "from -> to: label"
    - { from: a, to: b, label: x, exit: true }
  max_iterations: number                   # 循环限制（默认：循环时为 3）
  termination:                             # 循环终止条件
    any_of:                                # 任意条件触发时停止
      - { max_iterations: 5 }
      - { timeout_ms: 120000 }
      - { converged: "description" }
      - { result_matches: { agent: name, contains: "text" } }
      - { stuck: { repeats: 2 } }
    all_of:                                # 全部条件满足时停止
      - { max_iterations: 2 }
      - { result_matches: { agent: name, contains: "APPROVED" } }

# 调度配置（覆盖子代理调度的默认值）
dispatch:
  maxConcurrent: number             # 最大并发后台任务数（默认：5）
  maxQueueDepth: number             # 最大排队任务数（默认：10）
  syncReservedSlots: number         # 预留给同步调度的槽位数（默认：1）
  maxActivePerParent: number        # 每个父会话最大活跃任务数（默认：3）
  maxTotalSessionsPerRequest: number # 每次用户请求最大累积会话数（默认：无限制 / 按需启用）
  maxInputTokensPerRequest: number  # 每次请求最大累积输入 token 数（默认：无限制 / 按需启用）
  maxOutputTokensPerRequest: number # 每次请求最大累积输出 token 数（默认：无限制 / 按需启用）
  maxCostPerRequest: number         # 每次请求最大累积费用（USD）（默认：无限制 / 按需启用）
  maxInputTokensPerSession: number  # 每个调度会话最大输入 token 数（默认：无限制 / 按需启用）
  maxCostPerSession: number         # 每个调度会话最大费用（USD）（默认：无限制 / 按需启用）
  budgetSampleIntervalMs: number    # 预算采样间隔（毫秒）（默认：30000）
  backgroundStaleTimeoutMs: number  # 后台任务过期超时（毫秒）（默认：900000）
  syncAcquireTimeoutMs: number      # 同步槽位获取超时（毫秒）（默认：120000）
  syncPromptTimeoutMs: number       # 同步提示词超时（毫秒）（默认：600000）
  retryAfterMs: number              # 失败后重试延迟（毫秒）（默认：30000）
  backpressureMaxRetries: number    # 最大背压重试次数（默认：5）
  backpressureMaxDelayMs: number    # 最大背压延迟（毫秒）（默认：60000）

# 自定义 Hook（详见 Hook 机制）
hooks:
  builtin:                          # 启用/禁用内置 Hook
    auto_activate: true
  custom:
    - name: string                  # Hook 标识符
      description: string           # 可读描述
      events: [string]              # 事件：chat.message、tool.execute.before、tool.execute.after、system.transform、event
      module: string                # Hook 模块文件路径
      config: {}                    # 传递给 Hook 的任意配置
      filter:                       # 限制 Hook 触发条件
        tools: [string]             # 仅对指定工具名称触发
        eventTypes: [string]        # 仅对指定事件子类型触发
      priority: number              # 执行顺序（越小越早，默认 50）
      phase: before | after         # 相对于内置 Hook 的阶段（默认：after）

# 权限
permission:
  allow:
    - Read
    - Grep
  deny:
    - Bash
tools:
  Bash: false
```

## 字段详解

以下按字段逐一说明用途、类型、默认值和适用场景。所有字段定义基于 `RoleConfig` 类型（`src/types.core.ts:88-143`）。

### `name`
- **类型**: `string`（必需）
- **用途**: 角色的人类可读名称。用于 UI 展示、日志输出和代理标识。
- **示例**: `name: "Senior Frontend Developer"`
- **注意**: 名称不需要是唯一的，但在 `subagents` 内部，名称用于路由调度。

### `description`
- **类型**: `string`（必需）
- **用途**: 角色的简短描述，用于在选择角色时显示给用户。
- **示例**: `description: "精通 React/Next.js 的前端工程师，负责组件开发和性能优化"`

### `model`
- **类型**: `string`（可选）
- **默认值**: 使用全局默认模型
- **用途**: 指定该角色使用的 LLM 模型标识符，如 `"gpt-4"`、`"claude-3-sonnet"`。
- **何时使用**: 当角色需要特定模型能力（如长上下文、高推理能力）时设置。子代理可以通过 `model` 覆盖父角色的模型。

### `mode`
- **类型**: `"primary" | "subagent" | "all"`（可选）
- **默认值**: `"primary"`
- **用途**: 控制角色的使用模式：
  - `"primary"` — 角色可作为主角色使用（默认）。
  - `"subagent"` — 角色仅可作为子代理使用，不能被选为主角色。
  - `"all"` — 角色既可作为主角色，也可作为子代理。
- **何时使用**: 如果你创建的角色仅供其他角色调度（如工具角色），设置为 `"subagent"` 可以防止用户直接选择它。

### `version`
- **类型**: `string`（可选）
- **格式**: 语义化版本号（如 `"1.0.0"`）
- **用途**: 角色的版本标识，用于注册中心的版本管理和发布。
- **示例**: `version: "2.1.0"`

### `color`
- **类型**: `string`（可选）
- **用途**: 角色在 UI 中显示的标记颜色。常用于快速区分不同角色。
- **示例**: `color: "#4A90D9"`

### `variant`
- **类型**: `string`（可选）
- **用途**: 模型变体标识，用于指定同一模型的不同配置项（如 `"claude-3-sonnet-20240229"`）。
- **何时使用**: 当你需要锁定到特定的模型版本或配置时。

### `temperature`
- **类型**: `number`（可选，范围 `0.0 - 2.0`）
- **用途**: 控制模型输出的随机性。较低值（如 `0.1`）使输出更确定和聚焦，较高值（如 `0.8`）使输出更多样化。
- **示例**: `temperature: 0.3`（适合代码生成）

### `top_p`
- **类型**: `number`（可选，范围 `0.0 - 1.0`）
- **用途**: 核采样参数，控制模型考虑的词概率累积阈值。与 `temperature` 一起调整模型输出风格。
- **示例**: `top_p: 0.9`

### `prompt` / `prompt_file`
- **类型**: `string`（必需）
- **用途**: 角色的系统提示词 —— 定义角色的行为、能力和限制。
  - `prompt`：直接在 YAML 中内联提示词文本。
  - `prompt_file`：指向外部文件的路径，提示词从该文件读取。

::: warning prompt 与 prompt_file 互斥
`prompt` 和 `prompt_file` 是**互斥**的。如果同时设置两者，`prompt_file` 会优先生效并覆盖 `prompt` 的内容。建议将较长的提示词放在单独的文件中，以保持 `role.yaml` 简洁。
:::

```yaml
# 内联提示词
prompt: |
  你是一个资深前端工程师，精通 React 和 TypeScript。

# 或使用外部文件
prompt_file: prompts/frontend-dev.md
```

### `skills` / `opencode_skills`
- **类型**: `string[]`（可选）
- **用途**: 加载技能（Skill）文件，技能为角色提供领域专用知识和指令：
  - `skills`：从 `rolebox/{role}/skills/` 目录加载（角色本地技能）。
  - `opencode_skills`：从 `~/.config/opencode/skills/` 目录加载（全局技能）。
- **示例**:
  ```yaml
  skills:
    - react-patterns
    - tailwindcss
  opencode_skills:
    - humanizer
  ```

### `functions` / `disable_functions`
- **类型**: `string[]`（可选）
- **用途**: 控制角色可用的函数集合：
  - `functions`：添加额外函数。与内置默认函数（`plan`、`execute`、`loop`）**合并**，不会替换。
  - `disable_functions`：从角色中移除特定的内置函数。

- **合并语义**: 默认函数始终可用。`functions` 列表中的函数会添加到默认函数之上。要移除默认函数，必须使用 `disable_functions`。

```yaml
functions:
  - plan
  - execute
  - my-custom-fn
disable_functions:
  - loop          # 禁用 loop 函数
```

### `auto_activate` / `locked`
- **类型**: `string[]` / `boolean`（可选）
- **用途**:
  - `auto_activate`：在会话启动时自动激活指定的函数，无需用户使用 `|name|` 语法。
  - `locked`：当设置为 `true` 时，`auto_activate` 列出的函数无法通过转换或用户请求停用。
- **何时使用**: 适用于需要始终处于活跃状态的关键函数（如观察守卫、安全检查）。
- **示例**:
  ```yaml
  auto_activate:
    - security-guard
    - logging-watch
  locked: true
  ```

### `references`
- **类型**: `Record<string, string | { path: string; description?: string }>`（可选）
- **用途**: 显式声明引用文档。引用是深度知识文档，代理可按需读取。自动发现的引用无需配置。
- **示例**:
  ```yaml
  references:
    api-spec: references/api-spec.md
    design-guide:
      path: docs/design-guide.md
      description: 自定义描述
  ```

### `subagents`
- **类型**: `SubAgentConfig[]`（可选）
- **用途**: 定义子代理。子代理是父角色可以调度任务的子角色。子代理配置与 `role.yaml` 结构相同，支持递归嵌套（最多 3 层）。
- **示例**: 见上方完整 Schema 中的 `subagents` 块。

### `collaboration`
- **类型**: `CollaborationConfig`（可选）
- **用途**: 配置多代理协作图。支持内置拓扑（`pipeline`、`review-loop`、`star`）和自定义边。
- **何时使用**: 需要多个代理协作完成复杂工作流时使用。

### `dispatch`
- **类型**: `DispatchRoleConfig`（可选）
- **用途**: 覆盖子代理调度的默认参数（并发、队列、预算等）。其所有字段定义见[调度配置](./dispatch-config)。
- **示例**: 见上方完整 Schema 中的 `dispatch` 块。

### `hooks`
- **类型**: `HooksBlock`（可选）
- **用途**: 声明自定义 Hook 和内置 Hook 开关。Hook 在特定生命周期事件（如 `chat.message`、`tool.execute.before`）触发。
- **子字段**:
  - `hooks.builtin`：启用/禁用内置 Hook（如 `auto_activate`）。
  - `hooks.custom`：声明自定义 Hook 模块。
- **示例**: 见上方完整 Schema 中的 `hooks` 块。详见 [Hook 机制](./hooks)。

### `permission`
- **类型**: `PermissionConfig`（可选）
- **用途**: 控制角色的工具访问权限：
  - `allow`：允许角色使用的工具列表。
  - `deny`：拒绝角色使用的工具列表。
- **示例**:
  ```yaml
  permission:
    allow:
      - Read
      - Grep
    deny:
      - Bash
  ```

### `tools`
- **类型**: `Record<string, boolean>`（可选）
- **用途**: 工具级别的启用/禁用开关。等价于 `permission` 的另一种写法。
- **示例**:
  ```yaml
  tools:
    Bash: false
    Write: true
  ```

### `notifications`
- **类型**: `NotificationConfig`（可选）
- **用途**: 配置会话生命周期事件的通知。支持多种通道（SystemToast、Sound、File、Log、Webhook、CustomCommand）。
- **示例**:
  ```yaml
  notifications:
    on_start:
      - channel: system_toast
        title: 角色已启动
        message: 角色 {role} 已就绪
    on_error:
      - channel: sound
        title: 出错
  ```

### `memory`
- **类型**: `MemoryConfig`（可选）
- **用途**: 配置角色的记忆持久化和注入行为，包括存储后端、全文检索、分类维度等。

### `extensions`
- **类型**: `ExtensionConfig`（可选）
- **用途**: 注册自定义扩展模块（条件、拓扑、终止条件、恢复策略、通知通道、观察事件、并发策略等）。详见[扩展机制](./extensions)。

## 环境变量插值

可以在 `role.yaml` 的任何位置使用 `{env:VARIABLE_NAME}` 语法，在启动时解析。

```yaml
model: "{env:PREFERRED_MODEL}"
prompt: |
  你正在为 {env:COMPANY_NAME} 工作...
```

## 下一步

- [创建角色](/02-Guide/create-a-role) — 角色创建实战指南
- [调度配置](./dispatch-config) — 深入了解子代理调度配置和环境变量覆盖
