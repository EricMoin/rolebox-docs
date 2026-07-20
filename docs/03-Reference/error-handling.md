---
title: 错误处理
description: 错误处理策略 — rolebox 的错误容忍机制、降级行为与安全边界
---

# 错误处理

> **相关文档：** [恢复系统](/03-Reference/recovery-system) — 恢复系统详细架构 | [调度配置](/03-Reference/dispatch-config) — 并发与预算配置 | [已知限制](/03-Reference/limitations) — 当前版本限制

rolebox 采用**错误容忍（fault-tolerant）**设计原则：单个组件的故障不会导致整个系统崩溃。以下是各场景下的降级行为汇总。

## 降级行为一览

| 场景 | 行为 |
|---|---|
| YAML 格式无效或文件缺失 | 跳过该角色，opencode 不会崩溃 |
| 技能文件缺失 | 输出警告，不阻塞角色加载 |
| 函数文件缺失 | 静默跳过 |
| 无效的函数激活语法（大写、句中管道符） | 保持消息原样，不做修改 |
| Hook 模块加载失败（缺失、语法错误） | 记录警告，Hook 被跳过，继续运行 |
| Hook 处理器异常 | try/catch 包裹，记录警告，继续运行 |
| 扩展模块加载失败 | 按模块捕获，记录警告，跳过该扩展 |
| 子代理调度失败 | 支持重试机制和背压控制 |
| 无效的环境变量插值 | 保留原始 `{env:...}` 文本 |

## 快速参考：我应该配置哪个恢复策略

根据你遇到的错误类型，以下表格推荐默认策略链。所有策略名称均来自内置注册表（`src/recovery/config.ts:88-96`），可直接用于 `role.yaml` 的 `hooks.recovery` 配置块。

| 症状 | 建议策略链 | 说明 |
|------|-----------|------|
| **API 500 / 网络超时 / 服务端错误** | `retry(2次, 指数退避)` → `compact` → `abort` | 使用 `session_error` 默认链。前两次重试指数退避，然后压缩会话上下文，最后中止 |
| **Token 超限（context_length_exceeded）** | `truncate(最多8次, 50%压缩)` → `summarize` → `abort` | 使用 `context_window` 默认链。先截断输出，再尝试总结压缩，均失败则中止 |
| **Edit 错误（oldString not found / multiple matches / same content）** | `remind_and_retry(2次)` | 使用 `edit_error` 默认链。注入提示让模型重新读取文件再重试 |
| **JSON 解析错误（unexpected token / invalid json）** | `remind_and_retry(2次)` | 使用 `json_error` 默认链。注入修复提示后重试 |
| **空响应（工具返回空或过短）** | `remind_and_retry(1次)` | 使用 `empty_response` 默认链。重试一次后推进到下一策略或中止 |
| **模型能力不足需要回退** | `retry` → `fallback_model` → `abort` | 在 `session_error` 链中插入 `fallback_model`，使用备选模型重新提示。需要额外配置备选模型参数 |

::: tip 策略链是可按角色定制
每个角色可以在 `role.yaml` 中独立配置策略链。详细配置语法参见下方「按角色配置恢复策略」章节。
:::

## 设计原则

- **隔离故障**：每个角色、Hook、扩展都是独立的故障域。一个角色的 YAML 错误不会影响其他角色。
- **优雅降级**：缺失的技能或函数不会阻塞启动——系统以警告的方式继续运行，尽最大努力提供可用功能。
- **用户可见性**：所有降级行为都会通过日志/警告的方式通知用户，便于诊断和修复。
- **不做猜测**：遇到无法解析的内容时，保持原样传递，不尝试自动修正。

## 恢复系统 (Recovery System)

恢复系统是一个可插拔的错误恢复框架，用于捕获常见故障模式并自动执行补偿策略。它由 `RecoveryEngine` 统一管理（`src/recovery/engine.ts:21-56`），通过可配置的策略链（chain-of-strategies）将错误恢复与业务逻辑解耦。

### 架构概览

恢复系统由四个核心组件构成：

| 组件 | 文件 | 职责 |
|---|---|---|
| `RecoveryEngine` | `src/recovery/engine.ts` | 恢复系统的入口，管理配置、状态、指标和策略链的执行入口 |
| `PatternRegistry` | `src/recovery/error-detection.ts` | 注册和匹配错误模式，从原始错误中提取结构化 `RecoveryError` |
| `StrategyRegistry` | `src/recovery/strategies/registry.ts` | 注册和查找恢复策略，运行时按名称获取策略实例 |
| `RecoveryChainExecutor` | `src/recovery/chain-executor.ts` | 执行策略链，按顺序尝试策略，直到恢复成功或链耗尽 |

### 错误检测

`PatternRegistry`（`src/recovery/error-detection.ts:6-57`）维护一组 `ErrorPattern`（`src/recovery/types.ts:192-203`），每个模式通过 `match(error)` 方法判断是否匹配。系统内置 7 个默认错误模式（`src/recovery/error-detection.ts:90-297`）：

| 模式名称 | 所属类别 | 匹配条件 |
|---|---|---|
| `api-error` | `session_error` | 错误对象包含 `error.type`、`code` 或 `status` 字段 |
| `timeout` | `session_error` | 消息包含 timeout / timed out / deadline exceeded / ETIMEDOUT 关键字 |
| `tool-unavailable` | `session_error` | 消息匹配 tool not found / unknown tool / unavailable tool |
| `token-limit` | `context_window` | 消息包含 context_length_exceeded / maximum context length / token limit 等 |
| `edit-not-found` / `edit-multiple-matches` / `edit-same-content` | `edit_error` | Edit 工具返回 oldString not found / multiple matches / same content 错误 |
| `json-parse-error` | `json_error` | 消息匹配 JSON 语法错误正则（unexpected token / invalid json 等） |
| `empty-response` | `empty_response` | 工具输出或模型响应为空或过短（< 5 字符） |

### 7 种内置恢复策略

所有策略实现 `RecoveryStrategy` 接口（`src/recovery/types.ts:259-264`），通过 `registerBuiltinStrategies()` 注册（`src/recovery/strategies/index.ts:20-28`）：

| 策略 | 文件 | 行为 |
|---|---|---|
| `retry` | `src/recovery/strategies/retry-strategy.ts` | 指数退避重试（`backoff_ms * backoff_factor^attempt`），直到达到 `max_retries` |
| `compact` | `src/recovery/strategies/compact-strategy.ts` | 调用 client 的 session.compact() 压缩会话上下文 |
| `fallback_model` | `src/recovery/strategies/fallback-model-strategy.ts` | 使用备选模型重新提示（通过 `promptAsync` 注入恢复指令） |
| `remind_and_retry` | `src/recovery/strategies/remind-and-retry-strategy.ts` | 注入提示文本到系统 prompt，然后重试——适用于编辑错误和 JSON 解析错误 |
| `truncate` | `src/recovery/strategies/truncate-strategy.ts` | 注入截断指令，要求模型将输出减少到指定的 `target_ratio` |
| `summarize` | `src/recovery/strategies/summarize-strategy.ts` | 注入总结指令或调用 API 进行上下文压缩 |
| `abort` | `src/recovery/strategies/abort-strategy.ts` | 最终策略：注入中止消息并终止恢复链 |

### 策略链 (Strategy Chain)

策略链是恢复系统的核心设计模式（`src/recovery/chain-executor.ts:26-123`）。每个错误类别可以配置一个有序的策略序列。当错误被捕获时，`RecoveryChainExecutor` 按顺序执行链中的策略，根据策略返回的状态决定流程：

- **`success`** → 恢复成功，清除状态
- **`retry`** → 再次执行当前策略（支持延迟等待）
- **`next_strategy`** → 前进到链中的下一个策略
- **`abort`** → 中止整个恢复链，向模型注入终止消息

默认配置（`src/recovery/config.ts:48-78`）定义了以下策略链：

| 错误类别 | 默认链 |
|---|---|
| `session_error` | retry(2次, 指数退避) → compact → abort |
| `context_window` | truncate(最多8次, 50%压缩比) → summarize → abort |
| `edit_error` | remind_and_retry(2次) |
| `json_error` | remind_and_retry(2次) |
| `empty_response` | remind_and_retry(1次) |

### 恢复策略组合最佳实践

合理编排策略链可以显著提升恢复成功率。以下三条原则来自实际部署经验（策略名称均源于 `src/recovery/config.ts:88-96` 的内置注册表）。

#### 1. 始终以 `abort` 结尾

每个策略链的最后一个策略应为 `abort`，确保恢复失败时能向模型注入明确的中止消息，而非静默失败。默认链已遵循此原则（`session_error` 和 `context_window` 均以 `abort` 结尾），自定义链中也应保持。

```yaml
# ✅ 推荐：以 abort 结尾
session_error:
  chain:
    - strategy: retry
    - strategy: compact
    - strategy: abort   # ← 最终报告失败

# ❌ 不推荐：链耗尽后无任何反馈
session_error:
  chain:
    - strategy: retry
    - strategy: compact  # 如果失败，模型得不到任何提示
```

#### 2. 策略链不超过 4 个环节

每增加一个策略，恢复链的延迟和复杂性随之增长。超过 4 个环节的链往往因累积延迟而抵消恢复收益。建议将非核心策略放在并行链中，或提高前置策略的 `max_retries` 以减少不必要的链跳转。

| 推荐配置 | 说明 |
|---------|------|
| `retry(2-3次)` → `compact` → `fallback_model` → `abort` | 4 环节以内，覆盖最常见的恢复路径 |
| `truncate(多次)` → `summarize` → `abort` | 3 环节，足以应对上下文窗口溢出 |
| `remind_and_retry(2次)` → `abort` | 2 环节，适用于编辑和 JSON 类错误 |

#### 3. `remind_and_retry` 单独用于编辑/JSON 错误

`remind_and_retry` 的行为是注入提示文本后请求模型原地重试，与 `retry`（指数退避重试）的机制不同。对于 `edit_error` 和 `json_error` 类别，`remind_and_retry` 比重试更有效，因为这两类错误的根因是模型输出格式问题而非服务端暂时故障——重试一段时间后再次调用并不会自行修复。

```yaml
edit_error:
  chain:
    - strategy: remind_and_retry
      config:
        max_retries: 2
        reminder_text: "[EDIT ERROR] 请重新读取文件后重试"

json_error:
  chain:
    - strategy: remind_and_retry
      config:
        max_retries: 2
        reminder_text: "[JSON 错误] 修正 JSON 语法后重试"
```

::: tip 调试新策略链
部署新策略链前，建议先在开发环境中使用 `rolebox info --check` 验证配置是否生效。然后通过观察日志前缀 `recovery:chain` 确认策略按预期顺序执行。详见下方「调试恢复系统」章节。
:::

### 配置

恢复系统通过 `RecoveryConfig` 类型配置（`src/recovery/config.ts:31-37`）。关键配置项：

- **`enabled`**：全局开关（默认 `true`），设为 `false` 可完全禁用恢复
- **`maxTotalAttempts`**：单次会话的总尝试次数硬限制（默认 10）
- **`persistState`**：是否将恢复状态持久化到磁盘
- **`collectMetrics`**：是否收集恢复指标（计数、成功率等）
- **`chains`**：按错误类别配置的策略链

自定义策略可通过 `RecoveryEngine.registerStrategy()` 注册（`src/recovery/engine.ts:163-166`），同时使用 `addKnownStrategy()` 登记到已知策略列表（`src/recovery/config.ts:101-103`），确保 YAML 配置验证通过。

> 完整的恢复系统详细架构说明见 [恢复系统参考](./recovery-system)。

## 用户可见的错误消息

以下错误是用户在使用过程中可能直接遇到的，以 `QueueFullError` 和 `WaiterTimeoutError` 两个核心类为代表（均在 `src/dispatch/concurrency/concurrency.ts` 中定义）。

### `QueueFullError`

当并发等待队列满时抛出。用户会看到类似以下消息：

```
Queue is full: 12 queued tasks (limit: 10)
```

包含的字段（`src/dispatch/concurrency/concurrency.ts:49-61`）：
- `depth`：当前排队任务数
- `limit`：队列最大深度
- `retryAfter`：建议重试延迟（默认 30000ms）

此错误通常在 `maxQueueDepth` 和 `maxConcurrent` 配置过小时出现。建议增加 `maxConcurrent` 或 `maxQueueDepth` 的值，或在 `role.yaml` 的 `dispatch:` 块中调整。

### `WaiterTimeoutError`

当任务在队列中等待超过 TTL 后超时抛出。用户会看到：

```
Waiter timed out after 300000ms for key "anthropic/claude-sonnet"
```

默认 TTL 为 300 秒（5 分钟）（`src/dispatch/concurrency/concurrency.ts:46`）。如果任务在排队阶段持续等待超过此时间，该任务被自动取消。建议检查模型响应速度或增加模型的并发槽位数。

### 预算超限

预算限制由 `BudgetTracker` 管理（`src/dispatch/budget/budget-tracker.ts:148-203`），超限时用户会看到类似以下消息：

```
Request cost budget exhausted: 0.52 >= 0.5
Session input token budget exhausted: 52410 >= 50000
```

预算超限的任务会被自动取消，并在下次轮询时记录到指标中。这些限制通过 `role.yaml` 的 `dispatch:` 块中以下字段配置：
- `maxInputTokensPerRequest` / `maxOutputTokensPerRequest` / `maxCostPerRequest`
- `maxInputTokensPerSession` / `maxCostPerSession`

## 按角色配置恢复策略

恢复策略可以在每个角色的 `role.yaml` 的 `hooks.recovery` 块中按类别配置。配置结构遵循 `RecoveryConfig` 类型（`src/recovery/config.ts:31-37`）：

```yaml
hooks:
  recovery:
    enabled: true                   # 全局开关
    max_total_attempts: 10          # 单次会话总尝试次数硬限制
    persist_state: true             # 持久化恢复状态到磁盘
    collect_metrics: true           # 收集恢复指标

    # 按错误类别配置策略链
    session_error:
      enabled: true
      chain:
        - strategy: retry
          config:
            max_retries: 3
            backoff_ms: 1000
            backoff_factor: 2
        - strategy: compact
        - strategy: fallback_model
        - strategy: abort
          config:
            message: "会话失败，已尝试所有恢复手段"

    edit_error:
      enabled: false                 # 禁用编辑错误的自动恢复

    json_error:
      chain:
        - strategy: remind_and_retry
          config:
            max_retries: 3
            reminder_text: "请检查 JSON 语法后重试"
```

### 完全禁用恢复

将 `enabled: false` 可以完全禁用整个恢复系统（`src/recovery/engine.ts:70-72`）：

```yaml
hooks:
  recovery:
    enabled: false
```

禁用后，所有错误检测和策略链都不会执行，错误直接抛出到上层调用方。

::: tip 自定义恢复策略注册
除了内置的 7 种策略外，你可以通过两种方式添加自定义策略：
1. **扩展机制**：在 `extensions.recovery_strategies` 中声明模块（见[扩展机制](./extensions)）。
2. **API 注册**：通过 `RecoveryEngine.registerStrategy()`（`src/recovery/engine.ts:163-166`）注册策略实例，并调用 `addKnownStrategy()`（`src/recovery/config.ts:101-103`）登记到已知策略列表，确保 YAML 配置验证通过。

两种方式都需要在自定义策略模块中实现 `RecoveryStrategy` 接口（`src/recovery/types.ts:259-264`）。
:::

## 调试恢复系统

### 检查恢复配置是否生效

使用 `rolebox info <role> --check` 可验证角色的恢复配置：

```bash
rolebox info my-role --check
```

命令输出包含恢复系统状态信息：
- 恢复系统是否启用（`hooks.recovery.enabled`）
- 已注册的策略列表（通过 `RecoveryEngine.getStrategyRegistry().names()`）
- 各错误类别的策略链配置

### 恢复指标快照

通过 `RecoveryEngine.getMetrics()`（`src/recovery/engine.ts:172-174`）获取运行时指标快照，可用于诊断恢复行为的健康状况：

```
totalAttempts: 15          # 总恢复尝试次数
successfulRecoveries: 12   # 成功恢复次数
abortedChains: 2           # 被中止的链数
exhaustedChains: 1         # 耗尽的链数
byCategory:
  session_error:
    attempts: 8
    successes: 6
  edit_error:
    attempts: 7
    successes: 6
```

### 日志前缀

恢复系统各组件使用独立的结构化日志器（`src/recovery/engine.ts:12`）：

| 日志前缀 | 来源 | 典型消息 |
|----------|------|---------|
| `recovery:engine` | `src/recovery/engine.ts` | `RecoveryEngine initialized` / `Starting recovery chain` / `Recovery successful` |
| `recovery:state` | `src/recovery/state.ts` | 状态持久化相关 |
| `recovery:metrics` | `src/recovery/metrics.ts` | 指标收集相关 |
| `recovery:chain` | `src/recovery/chain-executor.ts` | 策略链执行过程 |
| `ext:loader` | `src/extensions/loader.ts` | 自定义恢复策略模块加载 |

### 常见问题排查

| 症状 | 可能原因 | 检查点 |
|------|---------|--------|
| 错误未被恢复 | 类别无对应策略链 | 检查 `hooks.recovery.{category}.enabled` 是否为 `false` |
| 自定义策略未生效 | 未调用 `addKnownStrategy()` | 验证 `src/recovery/config.ts:101-103` 是否已调用 |
| 恢复状态持续增长 | `persistState: true` 但未清除 | 检查恢复成功后 `stateStore.delete()` 是否调用（`src/recovery/engine.ts:149-150`） |
| 恢复链始终失败 | `maxTotalAttempts` 过小 | 默认 10 次，可在 `role.yaml` 中增加 |
| 重试后任务状态丢失 | 未使用 `dispatch_checkpoint` 持久化中间状态 | 在任务执行过程中调用 `dispatch_checkpoint()` 保存阶段状态，失败重试时可自动注入上下文避免重复工作。详见[工具目录](./tool-catalog#dispatch_checkpoint) |

> 恢复系统详细架构说明见[恢复系统参考](./recovery-system)。

## 下一步

- [已知限制](./limitations) — 当前版本的已知功能限制
