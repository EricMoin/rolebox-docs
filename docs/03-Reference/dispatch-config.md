---
title: 调度配置
description: 调度（dispatch）配置参考——role.yaml 的 dispatch 块只接受两个字段，其余参数属于编程式 DispatchManagerConfig 与三个环境变量
---

# 调度配置（Dispatch Configuration）

调度（dispatch）是把一个角色的任务交给子代理会话执行的机制。它的配置面比看上去窄：`role.yaml` 的 `dispatch:` 块只接受 2 个字段，环境变量只解析 3 个，其余参数（包括全部预算上限）都属于编程式的 `DispatchManagerConfig`。

> 相关：[role.yaml 参考](/03-Reference/role-yaml)｜[子代理](/02-Guide/subagents)｜[图工作流](/02-Guide/graph-workflows)｜[错误处理](/03-Reference/error-handling)

## 配置面一览

| 配置面 | 载体 | 覆盖内容 | 谁来设置 |
|---|---|---|---|
| 角色级 | `role.yaml` 的 `dispatch:` 块 | 2 个超时 | 角色作者 |
| 全局覆盖 | `ROLEBOX_DISPATCH_*` 环境变量 | 3 个超时 / 保留时间 | 运行环境 |
| 编程式 | `DispatchManagerConfig`（`configOverrides`） | 全部字段，含预算上限 | 调用 rolebox 的宿主代码 |

三者的合并优先级（低 → 高）是：内置默认值 → 角色 `dispatch:` 块 → 环境变量 → `configOverrides`。

## role.yaml 的 dispatch 块

```yaml
dispatch:
  backgroundStaleTimeoutMs: 900000   # 后台任务默认过期超时（毫秒）
  syncPromptTimeoutMs: 600000        # 同步调度中子代理提示词完成的超时（毫秒）
```

| 字段 | 类型 | 必需 | 默认值 | 说明 |
|---|---|---|---|---|
| `backgroundStaleTimeoutMs` | `number`（正数） | 否 | `900000`（15 分钟） | 后台任务的默认过期超时；任务自带的 `timeoutMs` 优先于它 |
| `syncPromptTimeoutMs` | `number`（正数） | 否 | `600000`（10 分钟） | 同步调度中子代理提示词完成的超时 |

它是**白名单解析**，边界有三条：

- **只读上面这两个键。** 块里写其它键既不会生效、也不会有报错提示；预算字段的归属见下文。
- **值必须是正数。** 非数字、0 与负数会被跳过，并在日志里留一条警告。
- **每个角色各算一份。** 同一进程里每个角色都有独立的合并结果；管理器级别的合并取主角色（`mode: primary`）的那一份。

块内字符串同样支持 `{env:变量名}` 插值，见下文「环境变量插值」。

## 环境变量

只有下面 3 个 `ROLEBOX_DISPATCH_*` 变量会被解析，其余名字不产生任何效果：

| 变量 | 映射字段 | 说明 |
|---|---|---|
| `ROLEBOX_DISPATCH_BG_STALE_MS` | `backgroundStaleTimeoutMs` | 后台任务默认过期超时（毫秒） |
| `ROLEBOX_DISPATCH_MATERIALIZE_TIMEOUT_MS` | `materializeTimeoutMs` | 结果物化抓取的超时（毫秒） |
| `ROLEBOX_DISPATCH_RESULT_RETENTION_MS` | `resultRetentionMs` | 结果文件保留时间（毫秒） |

解析规则与 `dispatch:` 块一致：值必须是正数，NaN、≤0 与空字符串都会被忽略。预算字段**没有**环境变量入口。

另有三个与调度可观测性有关、但不改变调度行为的变量：`ROLEBOX_METRICS` 开启指标采集与持久化（默认关闭），`ROLEBOX_METRICS_EXPORT` 作为指标快照导出文件的默认路径，`ROLEBOX_NOTIFICATIONS_CONFIG` 指向全局通知配置文件。

## 编程式：DispatchManagerConfig

`dispatch:` 块能表达的只有两个超时；其余参数定义在 `DispatchManagerConfig`，由调用 rolebox 的代码通过 `configOverrides` 注入，这是配置预算上限的**唯一**途径。

```typescript
// 调用 createDispatchManager() 时注入
const configOverrides = {
  maxInputTokensPerRequest: 100_000,   // 一次请求累计输入 token
  maxOutputTokensPerRequest: 50_000,   // 一次请求累计输出 token
  maxCostPerRequest: 0.5,              // 一次请求累计费用（USD）
  maxInputTokensPerSession: 50_000,    // 单个子代理会话输入 token
  maxCostPerSession: 0.25,             // 单个子代理会话费用（USD）
  budgetSampleIntervalMs: 15_000,      // 采样间隔
};

await createDispatchManager({
  // sessionClient / resolvedRoles / storeDirectory 等其余选项
  configOverrides,
});
```

| 字段 | 默认值 | 能否在 `role.yaml` 写 | 说明 |
|---|---|---|---|
| `maxInputTokensPerRequest` | 不限制 | 否 | 一次请求内所有子代理会话累计输入 token 上限 |
| `maxOutputTokensPerRequest` | 不限制 | 否 | 一次请求内累计输出 token 上限 |
| `maxCostPerRequest` | 不限制 | 否 | 一次请求内累计费用（USD）上限 |
| `maxInputTokensPerSession` | 不限制 | 否 | 单个子代理会话输入 token 上限 |
| `maxCostPerSession` | 不限制 | 否 | 单个子代理会话费用（USD）上限 |
| `budgetSampleIntervalMs` | `30000` | 否 | 预算采样间隔 |
| `taskTtlMs` | `1800000`（30 分钟） | 否 | 终态任务记录的存活时间；**必填** |
| `minRuntimeMs` | `5000` | 否 | 任务被回收前的最小存活时间；**必填** |
| `backgroundStaleTimeoutMs` | `900000` | 是 | 后台任务默认过期超时 |
| `watchdogIntervalMs` | `15000` | 否 | 每任务 reconcile 看门狗间隔 |
| `globalSweepIntervalMs` | `30000` | 否 | 全局 sweep 间隔 |
| `idleDebounceMs` | `1500` | 否 | 完成确认前的空闲 debounce |
| `syncTimeoutMs` | `600000` | 否 | **已废弃**，改用 `syncPromptTimeoutMs` |
| `syncPromptTimeoutMs` | `600000` | 是 | 同步调度提示词超时 |
| `createRetryAttempts` | `3` | 否 | 子代理会话创建失败的总尝试次数（设为 1 关闭重试） |
| `createRetryBackoffMs` | `250` | 否 | 上述重试的退避间隔 |
| `materializeTimeoutMs` | `10000` | 否 | 结果物化抓取的超时 |
| `resultRetentionMs` | `3600000` | 否 | 任务清理后结果文件的保留时间 |
| `outboxFirstRetryMs` | `3000` | 否 | 结果投递 outbox 的初始重试延迟 |
| `outboxMaxRetryMs` | `60000` | 否 | outbox 最大重试延迟 |
| `outboxSweepIntervalMs` | `5000` | 否 | outbox 轮询间隔 |

## 预算

预算上限有五个（请求级三项、会话级两项），全部只能编程式注入。它们的行为边界：

- 只有至少配置了一项上限时，采样器才会启动；一项都不配时不会产生任何采样开销。
- 超限判定分请求级与会话级两种口径，调用方据此取消对应任务。
- 预算用量延迟落盘，进程重启后可以接着累计。

## 看门狗与清理

调度内置三级定时器，间隔都可以在 `DispatchManagerConfig` 中覆盖：

| 层级 | 机制 | 默认间隔 | 职责 |
|---|---|---|---|
| Tier 1 | 每任务 reconcile | `watchdogIntervalMs`（15000） | 事件静默超过阈值后触发一次对账 |
| Tier 2 | 全局 sweep | `globalSweepIntervalMs`（30000） | 兜底扫描所有运行中任务，覆盖漏事件与崩溃恢复 |
| Tier 3 | 空闲 debounce | `idleDebounceMs`（1500） | 确认空闲前等待一段时间，吸收分步之间的假空闲 |

回调逐个隔离：单个任务的回调抛错不会影响其它任务的定时器。

清理相关的三个时间：

| 参数 | 默认值 | 含义 |
|---|---|---|
| `taskTtlMs` | 30 分钟 | 终态任务记录在被清出任务表前的存活时间 |
| `minRuntimeMs` | 5 秒 | 任务至少要存活这么久才允许被回收 |
| `resultRetentionMs` | 1 小时 | 任务清理后结果文件的保留时间；关联任务已不存在的结果文件按 24 小时阈值清理 |

## 任务状态与结果

后台任务在任一时刻处于 7 个状态之一：

| 状态 | 含义 |
|---|---|
| `pending` | 已创建、尚未启动 |
| `running` | 子代理会话正在执行 |
| `awaiting_approval` | 等待人工审批 |
| `completed` | 结果已物化并通知父会话 |
| `error` | 启动或执行失败，或被父会话拒绝 |
| `cancelled` | 被取消 |
| `timeout` | 超过过期超时，或被判定卡死 |

超过内联上限（默认 16000 字符）的结果会溢出到工作区下的 `.rolebox/state/results/{taskId}.txt`（先写临时文件再原子替换），读取时支持偏移量与尾部两种分页方式。任务失败的原因保留在任务记录上，便于事后排查；状态与结果的具体读取方式见[编排工具](/03-Reference/tools/orchestration-tools)与[错误处理](/03-Reference/error-handling)。

模型侧的编排入口是图工具集与 `task_*` 兼容层；裸 `dispatch_*` 工具在 v1.9.0 不再注册给模型（原因与替代关系见[迁移对照](/06-Appendix/migration)）。

## 环境变量插值

`role.yaml`（含 `dispatch:` 块）中任意字符串位置都可以写 `{env:变量名}`，在加载时解析；对象与数组会深度遍历。

```yaml
dispatch:
  syncPromptTimeoutMs: "{env:ROLEBOX_SYNC_PROMPT_MS}"
```

变量未设置时，占位符**原样保留**并记录一条日志，不会被替换成空字符串。

## 常见错误

### 把预算字段写进 `dispatch:` 块

❌ 解析器只遍历 `backgroundStaleTimeoutMs` 与 `syncPromptTimeoutMs` 两个键，下面的字段不会被读取（也不会有报错提示）：

```yaml
dispatch:
  maxInputTokensPerRequest: 100000
  maxCostPerSession: 0.25
```

正确做法是通过 `configOverrides` 注入，见上文「编程式：DispatchManagerConfig」。

### 期望环境变量能配预算

三个 `ROLEBOX_DISPATCH_*` 变量里没有预算相关项：预算只能编程式配置。

### 依赖 `syncTimeoutMs`

它是 `syncPromptTimeoutMs` 的已废弃别名，新配置一律用后者。

## 备注

> 自 v1.5.0 起，旧的并发槽位子系统、每请求的会话预算跟踪与相关扩展点已删除；图节点的并发度改由图引擎自管（就绪前沿、循环组遍历上限、节点级预算），因此这里不再有任何并发 / 队列 / 背压参数。

## 下一步

- [role.yaml 参考](/03-Reference/role-yaml) — 完整的角色字段参考
- [子代理](/02-Guide/subagents) — 子代理的声明与调度方式
- [编排工具](/03-Reference/tools/orchestration-tools) — 图工具与任务工具的参数
- [错误处理](/03-Reference/error-handling) — 调度失败时的错误面与恢复策略
