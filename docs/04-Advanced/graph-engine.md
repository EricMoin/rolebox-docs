---
title: 图执行引擎
description: rolebox v2 图执行引擎详解 — 节点生命周期、join 评估、信号传播、级联取消、循环组、审批门、预算、持久化与恢复
---
# 图执行引擎（Graph Engine）

> **相关文档：** [协作图](/02-Guide/collaboration-graph) — 声明式 `collaboration:` 路径 | [运行时行为](/04-Advanced/runtime-behavior) — 协作图运行时状态 | [终止条件](/04-Advanced/termination-conditions) — 循环终止与超时 | [工具目录：Graph 工具](/03-Reference/tool-catalog) — `graph_*` 工具参数详解

rolebox 把「谁把工作传给谁」这个问题抽象成一张有向图来执行：图中的每个**节点**代表一次派发给子代理的工作，**边**代表工作之间的流转关系。一个统一的**图执行引擎**负责把这张图跑起来——它决定节点何时开始、何时结束、中途要不要人工确认、以及万一崩溃怎么接着跑。理解这张图，你就理解了 rolebox v2 的多代理协作机制。

::: tip 先读：核心术语速览
- **Graph 执行引擎** — rolebox 统一的多代理编排引擎：把「谁把工作传给谁」建模成一张有向图来执行。
- **节点（node）与边（edge）** — 图的基本单元：节点 = 一次派发给子代理的工作；边 = 工作之间的流转关系（`from → to`）。
- **`{agent, prompt}` 元组** — 图节点的内容：`agent` 是承接该节点的角色，`prompt` 是交给它的任务指令。节点与角色无关，任何角色都可承接。
- **节点生命周期（NodeStatus）** — 一个节点从注册到结束所经历的状态序列（pending → ready → running → … → done）。
- **EngineRuntime / EngineState / EnginePhase** — 每次图执行由一个运行时（EngineRuntime）承载；它持有该图的运行状态（EngineState）与生命周期阶段（EnginePhase）。
- **生命周期方法** — `provision()` 初始化状态；`run()` 开始执行并派发；`recover()` 从持久化恢复中断的运行；`adoptPrior(prior)` 采纳先前运行的逐节点进度，避免重复派发已完成节点。
- **join 评估** — 图引擎判断某节点的所有上游输入是否齐备、从而是否满足执行条件的评估（`all` / `any` / `quorum` 三种汇聚策略）。
- **信号传播** — 节点完成时发出带外信号（不嵌入文本、独立传递的控制信令），引擎沿边把信号传播给下游，解锁满足条件的下游节点并派发——整个过程无轮询。
- **级联取消 / cascade** — 取消一个节点时，连带取消其所有下游依赖节点。
- **循环组 / loop group** — 一组构成有界循环的节点，受最大遍历次数（max_iterations）等上限保护，防止死循环。
- **审批门 / HITL（人工在环，Human-in-the-loop）** — 图执行到需要人工确认的节点（`needs_approval`）时暂停，等待人工批准。
- **预算 / budget** — 一次任务允许消耗的总 token/费用上限；耗尽后禁止新的派发。
- **持久化与恢复** — 引擎把运行状态写入磁盘，崩溃后可从检查点恢复并继续，避免重复已完成的工作。
- **拓扑 / topology** — 协作图的预设结构模式：pipeline（串行）、review-loop（循环）、star（并行）。
- **parent** — 协作图保留名，指编排器（父角色）的固定节点。
- **边触发方式** — `on_signal`：收到指定信号时激活这条边；`on_condition`：指定条件为真时激活这条边。
:::

rolebox `1.0.0` 将多代理协作统一到 **v2 图执行引擎（graph engine）** 上（CHANGELOG.md:12 引入；当前版本为 `1.0.0`）。图节点是角色无关的 `{agent, prompt}` 元组，引擎负责节点生命周期、join 评估、信号传播、级联取消、循环组、审批门、预算、持久化与恢复。

引擎有**两条**构建路径，最终都落到同一套 v2 执行引擎：

1. **声明式路径（`collaboration:`）**——在 `role.yaml` 中声明拓扑（`pipeline` / `review-loop` / `star`）或自定义边。启动时由 `convertCollaborationToGraphDeclaration`（`src/graph/collaboration-bridge.ts:89`）转换为 v2 图声明，并注入 `<collaboration_graph>` / `<collaboration_state>` 提示块驱动自动推进。
2. **命令式路径（`graph_*` 工具）**——通过 8 个图工具在运行时显式构建与执行图：`graph_create` / `graph_add_node` / `graph_add_edge` / `graph_add_loop` / `graph_run` / `graph_status` / `graph_cancel` / `graph_approve`。工具参数详解见[工具目录](/03-Reference/tool-catalog#graph-工具v2-引擎)。

---

## 1. 引擎模型

### 1.1 EngineRuntime

每次图执行由一个 `EngineRuntime` 实例承载（`EngineRuntime` 即该图实例的**运行时对象**，负责持有状态并驱动推进；`src/graph/engine/index.ts:107`），通过 `createEngine(graphDeclaration, options)` 构造（`src/graph/engine/index.ts:820`）。每个 `EngineRuntime` 拥有一个 `EngineState`（保存该图全部运行状态的**状态对象**）与一个信号驱动的推进器。

公开方法（`src/graph/engine/index.ts:107-257`）：

| 方法 | 说明 | 源码位置 |
|------|------|----------|
| `provision()` | 初始化状态：注册所有声明节点、引导拓扑（根节点进入 `ready` 并加入前沿）。幂等 | `index.ts:116` |
| `run()` | 从 `idle` 过渡到 `executing` 并派发就绪根节点。需提供 dispatch 缝（`dispatch` 或 `manager`） | `index.ts:126` |
| `recover()` | 从持久化状态恢复中断的图实例（崩溃恢复）：协调 `running` 节点、重建前沿、排空积压完成 | `index.ts:138` |
| `status()` | 返回当前 `EngineState` 的只读快照（集合为克隆副本） | `index.ts:160` |
| `adoptPrior(prior, opts)` | 采纳先前引擎运行的逐节点进度到本次重建的运行时，避免重复派发已完成节点 | `index.ts:158` |
| `cancel()` | 取消进行中的图执行：所有活跃节点 → `cancelled`，生命周期 → `complete`。`blocked` 节点保留等待人工 | `index.ts:170` |
| `approveNode(nodeId, payload?)` | 批准阻塞的 `needs_approval` 节点：`blocked → completed`，记录 `answer` 信号并激活 `answer` 边（`answer` 边 = 批准后把结果传给下游的边） | `index.ts:181` |
| `rejectNode(nodeId, reason?)` | 拒绝阻塞节点：`blocked → ready`（携带反馈重新进入）或 `blocked → escalate`（无循环组时） | `index.ts:191` |
| `partialApprove(nodeId, approved, rejected, reason?)` | 部分批准：接受 `approved` 分支、取消 `rejected` 分支的传递依赖，被拒上游重新进入 `ready` | `index.ts:206` |
| `retryNode(nodeId, opts?)` | 重试终态节点：将目标及其下游子图重置为干净的 `pending`，可选前置 `modifyPrompt`，再重新派发 | `index.ts:230` |
| `cancelNodes(nodeIds, options?)` | 取消一个或多个节点（`cascade` 时级联到传递下游），不触碰整图阶段 | `index.ts:253` |

### 1.2 EnginePhase（引擎生命周期）

引擎生命周期有 3 个阶段（`src/constants.ts:156-160`）：

| 阶段 | 值 | 说明 |
|------|-----|------|
| `Idle` | `idle` | 已构造未运行 |
| `Executing` | `executing` | 派发中就绪节点，推进中 |
| `Complete` | `complete` | 图执行完成（或取消后） |

阶段转换的合法性由 `canTransitionPhase` 校验、`transitionPhase` 执行（`src/graph/engine/engine-state.ts:116-147`）。

### 1.3 NodeStatus（节点生命周期）

节点的 9 种状态（`src/constants.ts:183-193`）：

```
正常路径：  pending → ready → running → completed → done
暂停路径：  running → blocked (needs_approval) → completed / ready
错误路径：  running → escalate → done
            running → timeout → done（或 retry → ready）
取消路径：  pending / ready → cancelled → done
```

| 状态 | 值 | 说明 |
|------|-----|------|
| `Pending` | `pending` | 已注册未就绪 |
| `Ready` | `ready` | 可派发（在前沿中） |
| `Running` | `running` | 已派发，等待信号 |
| `Completed` | `completed` | 已正常完成 |
| `Blocked` | `blocked` | 等待人工审批（`needs_approval`） |
| `Timeout` | `timeout` | 超时（可 retry） |
| `Escalate` | `escalate` | 出错升级（节点执行出错，进入终态） |
| `Cancelled` | `cancelled` | 已取消 |
| `Done` | `done` | 终态 |

---

## 2. 信号驱动的推进（无轮询）

引擎的推进由**派发节点发出的信号**驱动，没有轮询循环。信号经 `SignalBridge` 进入引擎（`src/graph/engine/signal-bridge.ts`），在推进锁内执行：解锁满足的下游节点 → 派发就绪节点。整个推进在 `_advancing` 可重入守卫内运行，保证同一时刻每个图实例只有一个推进临界区（`src/graph/engine/engine-advance.ts:8-23`）。

推进相关模块：

- `engine-advance.ts` — 核心推进逻辑、`NodeDispatchPort` 派发缝、`NodeCompletionEvent` 完成事件
- `signal-bridge.ts` — 信号进入引擎的桥接
- `signal-propagation.ts` — 信号沿边传播
- `dispatch-bridge.ts` — 引擎与调度系统的派发/完成/用量桥（`graphParentContext`）
- `join-evaluator.ts` — join 评估（`扇入`，即多个上游汇合到一个节点）的汇聚策略解析（`all` / `any` / `quorum`）
- `condition-resolver.ts` — 边条件解析（`on_condition` 边 = 指定条件为真时激活的边，其命名条件在此解析）

---

## 3. 循环组与终止

- `loop-group-executor.ts` — 有界循环编排原语：`executeLoopStep`（循环组成员终止信号的汇聚收敛决策，协调遍历计数、revise 重新派发、升级级联、上游取消）、`recordConvergenceOutput` / `resetConvergenceTracker` / `fingerprintPayload` / `extractUnresolved`
- `engine-termination.ts` — 引擎级终止评估
- `node-retry.ts` — `retryNode` / `resetNodeForRetry`（终态节点重开与重派发）

循环组的运行时计数在 `EngineState.loopCounters` 中维护（`src/graph/engine/engine-state.ts:459-487`：`incrementLoopTraversal` / `isLoopExhausted`）。

---

## 4. 审批门（Approval Gate）

- `approval-handler.ts` — `approveBlockedNode` / `rejectBlockedNode` / `pruneDownstreamSubgraph` / `reenterRejectedUpstreams` / `resetRejectedUpstreams` / `mergeRejectionFeedback`
- `approval-payload.ts` — `buildApprovalPayload`，构造传给下游的批准载荷
- 对应工具 `graph_approve`（`src/graph/tools/approve-tools.ts:7-14`）

`needs_approval: true`（`needs_approval` 即「需要人工批准」的信号/状态）的节点派发后进入 `blocked`，等待人工审批——此即 **审批门 / HITL（人工在环，Human-in-the-loop）**。引擎在此暂停并发出 `[GRAPH BLOCKED]` 提示。

---

## 5. 预算

`budget-bridge.ts` 与 `budget/` 子系统对接，按节点/图消耗累计 token、成本等预算（预算即一次任务允许消耗的总 token/费用上限，耗尽后禁止新的派发）。`EngineState` 保存预算用量（`src/graph/engine/engine-state.ts:55-113`：`emptyGraphBudget` / `applyBudgetDelta`）。

---

## 6. 级联取消

`cancellation.ts` 与 `cascade-canceller.ts` 实现取消原语：

- `cancelNodes(nodeIds, { cascade })` — 取消指定节点，`cascade` 时级联到传递下游
- `CancelDispatchPort` — 取消已派发后台任务的端口

---

## 7. 持久化与事件日志

| 文件 | 路径 | 说明 |
|------|------|------|
| `engine-{slug}.json` | `.rolebox/state/engine-{slug}.json` | 每个图的持久化状态（阶段、节点生命周期、预算、前沿、循环组、检查点）。路径由 `engineStatePath()` 计算（`src/graph/engine/engine-persistence.ts:388-393`） |
| `graph-events-{hash}.ndjson` | `.rolebox/state/graph-events-{hash}.ndjson` | 引擎写侧事件的追加式 NDJSON 事件日志（节点派发、终止转换、阶段变化、预算更新）。路径由 `graphEventsPath()` 计算（`src/graph/engine/graph-events.ts:106-112`） |

持久化模块：`engine-persistence.ts`（`serializeEngineState` / `deserializeEngineState` / `loadEngineStateFromJson` / `markDirty` / `shouldPersist`）。

恢复模块：`engine-recovery.ts`、`engine-startup.ts`（启动时检测旧位置并搬移）。

---

## 8. 协作图桥接（声明式 → 引擎）

`collaboration-bridge.ts` 将声明式 `collaboration:` 配置转换为 v2 图声明：

| 函数 | 源码位置 | 说明 |
|------|----------|------|
| `convertCollaborationToGraphDeclaration(collab, opts)` | `collaboration-bridge.ts:89` | 把协作图转换为无损的 v2 图声明 |
| `autoConvertCollaboration(collab, opts)` | `collaboration-bridge.ts:168` | 自动转换并返回 v2 图声明 |
| `graphDeclarationToResolvedGraph(...)` | `collaboration-bridge.ts:197` | 将图声明反转为 `ResolvedGraph`（用于协作图运行时） |

---

## 9. 工具层

`graph/tools/` 目录承载命令式 `graph_*` 工具：

- `index.ts` — `createGraphTools()`（`src/graph/tools/index.ts:151-160`）注册 8 个工具
- `graph-tools.ts` — `createGraphToolSet()`（`src/graph/tools/graph-tools.ts:2384`）核心工具集
- `approve-tools.ts` — `graph_approve`
- `status-queries.ts` — `graph_status` 查询
- `persisted-state.ts` — 持久化状态工具

每个工具的完整参数与语义见[工具目录：Graph 工具](/03-Reference/tool-catalog#graph-工具v2-引擎)。

---

## 引用索引

| 主题 | 文件 | 行号 |
|------|------|------|
| `EngineRuntime` 接口 | `src/graph/engine/index.ts` | 107-257 |
| `createEngine()` | `src/graph/engine/index.ts` | 820-827 |
| `EnginePhase` | `src/constants.ts` | 156-165 |
| `NodeStatus` | `src/constants.ts` | 183-198 |
| 阶段转换 | `src/graph/engine/engine-state.ts` | 116-147 |
| 预算工具 | `src/graph/engine/engine-state.ts` | 55-113 |
| 循环计数 | `src/graph/engine/engine-state.ts` | 459-487 |
| 引擎推进 | `src/graph/engine/engine-advance.ts` | 1-23 |
| `convertCollaborationToGraphDeclaration` | `src/graph/collaboration-bridge.ts` | 89 |
| `createGraphTools()` | `src/graph/tools/index.ts` | 151-160 |
| 引擎状态路径 | `src/graph/engine/engine-persistence.ts` | 388-393 |
| 事件日志路径 | `src/graph/engine/graph-events.ts` | 106-112 |

---

## 下一步

- [协作图](/02-Guide/collaboration-graph) — 声明式 `collaboration:` 拓扑与自定义流
- [工具目录](/03-Reference/tool-catalog) — `graph_*` 工具完整参数
- [运行时行为](/04-Advanced/runtime-behavior) — 协作图运行时状态与推进
- [终止条件](/04-Advanced/termination-conditions) — 循环终止、收敛与超时
