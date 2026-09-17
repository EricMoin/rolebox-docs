---
title: 图执行引擎
description: 图引擎的模型层——图由哪些声明构成、引擎由哪些对象承载、各子系统分别负责什么。
---

# 图执行引擎（Graph Engine）

rolebox 把「谁把工作交给谁」这个问题建模成一张有向图来执行：**节点（node，一次派发给某个代理的工作，内容是一个 `{agent, prompt}` 元组）**是工作单元，**边（edge，声明 `from → to` 流转关系的连接）**是工作之间的流向。本页讲这套模型的静态结构——图由哪些声明组成、引擎由哪些对象承载、每个子系统负责什么。

同一次执行按时间展开的时序（节点状态机、推进临界区、崩溃恢复的每一步）在[运行时行为](/04-Advanced/runtime-behavior)；把图搭起来并跑起来的操作步骤在[图工作流](/02-Guide/graph-workflows)；`graph_*` 每个工具的参数表在[编排工具](/03-Reference/tools/orchestration-tools)。这三处的内容本页都不重复。

> 前置：[图声明](/04-Advanced/graph-declaration)｜相关：[运行时行为](/04-Advanced/runtime-behavior)、[信号系统](/04-Advanced/signal-system)

## 1. 图的模型

引擎执行的对象是一份**图声明（graph declaration，schema 版本固定为 `2`）**。它由四类结构组成；先看一个最小形状，再看每类结构各自承载什么（完整字段规范见[图声明](/04-Advanced/graph-declaration)）：

```json
{
  "version": 2,
  "name": "review-pipeline",
  "nodes": [
    { "id": "coder", "agent": "coder", "prompt": "实现需求" },
    { "id": "reviewer", "agent": "reviewer", "prompt": "评审实现",
      "needs_approval": true, "join": { "strategy": "all" },
      "budget": { "max_retries": 1 } },
    { "id": "writer", "agent": "doc-writer", "prompt": "定稿" }
  ],
  "edges": [
    { "from": "coder", "to": "reviewer", "type": "always" },
    { "from": "reviewer", "to": "writer", "type": "on_signal",
      "signal_filter": ["answer"] },
    { "from": "writer", "to": "reviewer", "type": "on_signal",
      "signal_filter": ["revise_needed"], "retry": { "max": 2, "backoff_ms": 1000 } }
  ],
  "loop_groups": [
    { "id": "revise", "nodes": ["reviewer", "writer"], "max_traversals": 3 }
  ],
  "budget": { "max_total_cost_usd": 5 }
}
```

| 结构 | 必需字段 | 可选字段 | 在模型里的角色 |
|------|----------|----------|----------------|
| 节点 node | `id` / `agent` / `prompt` | `completion_condition` / `needs_approval` / `join` / `budget` | 工作单元，角色无关 |
| 边 edge | `from` / `to` / `type` | `signal_filter` / `condition` / `data_passthrough` / `retry` | 数据流与信号路由 |
| 循环组 loop group | `id` / `nodes` / `max_traversals` | `mode` | 有界循环的边界 |
| 预算 budget | ——（整块可选） | 图级 `max_total_*`、节点级 `max_*` | 资源上限 |

### 1.1 节点：角色无关的 `{agent, prompt}` 元组

节点类型 `NodeConfig` 只有三个必需字段：`id`（图内唯一标识）、`agent`（承接该节点的代理名）、`prompt`（交给它的任务指令）。节点**没有**类型字段，也没有角色分类——语义完全来自编排者给它分配的 `agent` 与 `prompt`，因此同一个节点可以换成任何可派发的角色。

`needs_approval` 是一个**暂停标志**而不是节点类别：置 `true` 时引擎在该节点执行完成后停下来等人工批准，而不是把它当成另一种节点。

### 1.2 边：数据流与信号路由

边类型 `EdgeDeclaration` 声明 `from` 与 `to`，以及激活语义 `type`：

- `always` —— 源节点一有结果就激活。
- `on_signal` —— 只有源节点发出 `signal_filter` 列出的信号时才激活。
- `on_condition` —— 命名条件 `condition` 求值为真时激活（条件词表与解析器见[图声明](/04-Advanced/graph-declaration)）。

边还承载两项行为：`data_passthrough`（规定上游结果的哪些字段传给下游）与 `retry`。`retry` 是**边属性**而非节点属性：它同时覆盖该边两端的节点，节点升级时的有效重试额度取「节点自身 `budget.max_retries`」与「关联边上 `retry.max`」的**最大值**，`backoff_ms` 则决定两次尝试之间的退避窗口（重试闸门的运行时细节见[运行时行为](/04-Advanced/runtime-behavior)）。

### 1.3 循环组：有界循环

循环组 `LoopGroupDecl` 用 `id`、`nodes`（成员节点）、`max_traversals`（遍历次数**硬上限**）把一组节点圈成一个有界循环。`mode` 记录轮次之间的会话隔离方式：`inherit`（默认且唯一真正支持的取值）表示各轮在同一个引擎状态内重新派发；`fresh` 明确不支持，请求它会返回错误并指向替代做法（每轮开一张新图）。

### 1.4 预算：图级与节点级上限

- 图级 `GraphBudgetSpec`：`max_total_input_tokens` / `max_total_output_tokens` / `max_total_cost_usd`，对全图所有节点**累计**生效。
- 节点级 `NodeBudgetSpec`：`max_input_tokens` / `max_output_tokens` / `max_cost_usd` / `timeout_ms` / `max_retries`，映射到调度层对单个会话的限制。

编排者可以把节点预算**超订**（各节点之和大于图预算），但实际消耗始终以图预算为上限。检查时机与越界后的行为属于运行时，见[运行时行为](/04-Advanced/runtime-behavior)。

### 1.5 拓扑模板：声明元数据，不是运行时结构

图声明可以带一个 `template` 字段（`pipeline` / `review-loop` / `star`），它是**声明元数据**：`src/graph/templates.ts` 负责把模板展开成一组边，也可以注册自定义拓扑；引擎本身只认边集，不读这个字段。展开时代表编排者（父角色）的节点使用保留名 `parent`（`PARENT_NODE`，定义在 `src/constants.ts`）。三种内建拓扑各自适合什么场景，见[工作流模式](/04-Advanced/workflow-patterns)。

## 2. 引擎的对象模型

一次图执行由「一个运行时对象 + 一个状态对象」承载：运行时是执行者，状态是它持有的全部数据。`src/graph/engine/index.ts` 定义运行时接口与构造入口，`src/types.engine-v2.ts` 定义状态的形状，`src/graph/engine/engine-state.ts` 提供读写状态的原子原语。

### 2.1 EngineRuntime：一次执行的载体

每个图实例对应一个 `EngineRuntime`，由 `createEngine(graphDeclaration, options)` 构造；它拥有一个 `EngineState` 和一个信号驱动的推进器。构造本身不派发任何东西，典型调用顺序是：

```text
const engine = createEngine(declaration, { manager });  // 构造：持有声明与状态
engine.provision();                                     // 注册节点、引导拓扑，根节点就绪
await engine.run();                                     // idle → executing，派发根节点
engine.status();                                        // 只读快照（集合为克隆副本）
engine.dispose();                                       // 释放；幂等
```

构造选项里最关键的是**派发缝**：`options.dispatch`（直接注入派发端口）或 `options.manager`（由调度管理器生成默认的派发与预算缝）。没有派发缝时引擎仍可构造、`status()` 与 `provision()` 仍可用，但 `run()` 会以明确的错误拒绝。

公开方法：

| 方法 | 职责 |
|------|------|
| `provision()` | 注册全部声明节点、引导拓扑（无入边的根节点进入 `ready` 并加入前沿）；幂等 |
| `run()` | 从 `idle` 过渡到 `executing` 并派发就绪根节点；未 `provision()` 时先自动补齐 |
| `recover()` | 崩溃恢复：加载持久化状态、把 `running` 节点与调度系统对账、重建前沿、排空积压的完成事件 |
| `adoptPrior(prior, opts)` | 把先前一次运行的逐节点进度采纳进本次新建的运行时，绝不重复派发已推进的节点 |
| `status()` | 返回 `EngineState` 的只读快照（集合为克隆副本） |
| `cancel()` | 整图取消：活跃节点 → `cancelled`，阶段推进到 `complete`；`blocked` 节点留给人工 |
| `approveNode(nodeId, payload?)` | 批准阻塞节点：`blocked → completed`，记录 `answer` 信号并激活前向 `answer` 边 |
| `rejectNode(nodeId, reason?)` | 拒绝阻塞节点：`blocked → ready`（携带反馈重入），或在无循环组可重开时 `blocked → escalate` |
| `partialApprove(nodeId, approved, rejected, reason?)` | 部分批准：接受 `approved` 分支、取消 `rejected` 分支中无法存活的传递依赖，被拒上游重入 `ready` |
| `retryNode(nodeId, opts?)` | 重试终态节点：把目标及其下游子图重置为干净的 `pending`，可前置 `modifyPrompt`，再重新派发 |
| `cancelNodes(nodeIds, options?)` | 局部取消（`cascade` 时级联到传递下游），循环组目标展开为其全部成员；不触碰整图阶段 |
| `dispose()` | 释放运行时：取消防抖写盘，使陈旧状态永不覆盖后继运行时；幂等 |

这些方法的**调用时机**与副作用顺序是运行时行为，见[运行时行为](/04-Advanced/runtime-behavior)。

### 2.2 EngineState：一次执行的全部数据

状态对象 `EngineState` 是引擎唯一的真相来源：

| 字段 | 类型 | 说明 |
|------|------|------|
| `phase` | `EnginePhase` | 引擎生命周期阶段 |
| `graphId` | `string` | 该图实例的唯一标识 |
| `graphDeclaration` | `GraphDeclaration` | 执行所依据的图声明 |
| `nodes` | `Map<string, NodeRuntimeState>` | 逐节点运行状态，按节点 ID 索引 |
| `loopGroups` | `Map<string, LoopGroupRuntimeState>` | 逐循环组运行状态（遍历计数等） |
| `frontier` | `string[]` | 当前可派发的就绪节点队列（**前沿**） |
| `budget` | `GraphBudgetState` | 图级累计预算消耗 |
| `signalLedger` | `Map<string, SignalLedgerEntry>` | 逐节点信号历史 |
| `advancingLock` | `boolean` | 重入守卫：同一时刻只允许一个推进临界区 |
| `isDirty` / `isNonCriticalDirty` | `boolean` | 仅运行时的脏标记（关键 / 非关键），决定写盘策略 |
| `pendingCompletions` | `string[]` | 临界区内被推迟、解锁后排空的完成事件 |
| `checkpoints` / `checkpointHistory` | 可选 | 逐节点生命周期检查点（最新一份 / 追加式全部历史） |
| `terminalNotified` | 可选 | 跨重启的终止通知去重标记 |
| `startedAt` / `updatedAt` | `number` | 图开始时间与最后一次状态更新的时间戳 |

`isDirty` 与 `isNonCriticalDirty` 是**纯运行时**字段：它们不会被序列化，新建或恢复得到的状态一律从干净值开始。（`advancingLock` 与 `pendingCompletions` 会随状态一起持久化；崩溃恢复时由陈旧临界区清理负责释放卡住的锁、丢弃孤儿的完成队列。）

### 2.3 EnginePhase：三个生命周期阶段

| 阶段 | 值 | 说明 |
|------|-----|------|
| `Idle` | `idle` | 已构造、尚未运行 |
| `Executing` | `executing` | 已开始推进：就绪节点已派发，等待信号 |
| `Complete` | `complete` | 图执行结束（正常完成或整体取消） |

阶段的合法转换由 `canTransitionPhase()` 校验、`transitionPhase()` 执行（`src/graph/engine/engine-state.ts`）：顺序是硬约束 `idle → executing → complete`，其余转换一律被拒绝。转换发生在什么时刻，见[运行时行为](/04-Advanced/runtime-behavior)。

### 2.4 NodeStatus：九个状态词汇

| 状态 | 值 | 说明 |
|------|-----|------|
| `Pending` | `pending` | 已注册、等待上游 |
| `Ready` | `ready` | 可派发（在前沿中） |
| `Running` | `running` | 已派发，等待终止信号 |
| `Completed` | `completed` | 已产出结果 |
| `Blocked` | `blocked` | 审批暂停（`needs_approval`），等待人工 |
| `Timeout` | `timeout` | 超时（可由重试回到 `ready`） |
| `Escalate` | `escalate` | 出错升级（最坏信号） |
| `Cancelled` | `cancelled` | 已取消 |
| `Done` | `done` | 终态，无后继转换 |

所有节点共用同一张转换表，合法性是 `(from, to)` 的纯函数，不读 `agent` / `prompt` / `needs_approval`；表本身与状态机图在[运行时行为](/04-Advanced/runtime-behavior)，实现在 `src/graph/engine/node-lifecycle.ts`。

## 3. join：扇入的模型

**扇入（fan-in，多个上游汇合到一个节点）**由节点上的 `join` 声明决定何时放行。`JoinConfig` 只有两个字段：`strategy`（`all` / `any` / `quorum`）与 `quorum`（`quorum` 策略下需要的应答数 N）；`resolveJoinStrategy()`（`src/graph/engine/join-evaluator.ts`）把它归一化为 `all` / `any` / `{ quorum: N }` 三种形态。

三种策略的模型含义：

- `all` —— 等所有上游给出应答。
- `any` —— 第一个上游应答即可放行。
- `quorum:N` —— 累计 N 个上游应答即可放行。

一次评估的结论是**三态** `JoinVerdict`：`satisfied`（已满足）、`failed`（已不可能满足）、`waiting`（仍未决，继续累积上游结果）。评估算法、各策略的满足 / 失败判据与循环组首轮的例外规则都在运行时页，见[运行时行为](/04-Advanced/runtime-behavior)。

## 4. 驱动引擎的信号词汇

**信号（signal，节点发出的带外控制信令：不嵌入文本、独立传递）**共 8 种，由单一来源 `src/signal/signal-constants.ts` 定义，分四类：

| 类别 | 信号 | 语义 |
|------|------|------|
| 终止信号 | `answer` / `revise_needed` / `escalate` | 结束本节点本次运行 |
| 暂停信号 | `need_approval` / `blocked` / `need_clarification` | 触发暂停转换（审批门 / 阻塞 / 澄清） |
| 移交信号 | `handoff` | 把工作转交他处，不终止 |
| 信息信号 | `progress` | 仅记录，不产生状态转换 |

同一次运行记录了多个终止信号时，按严重度取最坏：`escalate` > `revise_needed` > `answer`。信号经 `src/graph/engine/signal-bridge.ts` 进入引擎并写入 `EngineState.signalLedger`；信号的产生方、台账 API 与 `signal` 工具见[信号系统](/04-Advanced/signal-system)。

## 5. 子系统职责地图

引擎不是一个单体：每个关注点都有独立模块，运行时页只讲它们**按什么顺序**工作，这里讲它们**各自拥有什么**。

**推进。** `src/graph/engine/engine-advance.ts` 是推进核心：它在临界区内转换节点生命周期、评估出边、检查下游 join 并派发就绪节点；`src/graph/engine/signal-bridge.ts` 负责把节点发出的信号接入引擎；`src/graph/engine/condition-resolver.ts` 解析 `on_condition` 边的命名条件；`src/graph/engine/dispatch-bridge.ts` 是引擎与调度系统之间的派发 / 完成 / 用量桥。

**收敛与循环。** `src/graph/engine/loop-group-executor.ts` 是循环组成员终止信号的合并收敛决策，协调遍历计数、revise 重派发、升级级联与上游取消；`src/graph/engine/engine-termination.ts` 做引擎级终止评估；`src/graph/engine/node-retry.ts` 负责终态节点的重开与重派发。

**审批门。** `src/graph/engine/approval-handler.ts` 提供批准、拒绝、下游裁剪与上游重入原语；`src/graph/engine/approval-payload.ts` 构造传给下游的批准载荷。

**预算。** `src/graph/engine/budget-bridge.ts` 是 `BudgetTracker`（`src/dispatch/budget/budget-tracker.ts`）之上的只读包装，对外只暴露图级与节点级两个检查；引擎从不通过它写预算状态。

**取消。** `src/graph/engine/cancellation.ts` 提供取消原语（整图与局部）；`src/graph/engine/cascade-canceller.ts` 提供扇入的自动回收半边——join 判定完成后回收不再可能影响结果的上游。

**持久化与事件日志。** `src/graph/engine/engine-persistence.ts` 负责状态的序列化、两级写盘与容错加载；`src/graph/engine/graph-events.ts` 写追加式 NDJSON 事件日志；`src/graph/engine/engine-recovery.ts` 负责崩溃恢复与调度对账；`src/graph/engine/engine-startup.ts` 在插件启动时扫掠未完成的图。

**状态渲染与通知。** `src/graph/engine/graph-state-block.ts` 渲染每轮注入系统提示的 `<graph_state>` 定向块；`src/graph/engine/graph-notify.ts` 构造终止通知文本，`[GRAPH COMPLETE]` / `[GRAPH BLOCKED]` 标记常量在 `src/dispatch/notification.ts`。

## 6. 工具层边界

`src/graph/tools/index.ts` 的 `createGraphTools()` 注册全部 8 个图工具：`graph_create` / `graph_add_node` / `graph_add_edge` / `graph_add_loop` / `graph_run` / `graph_status` / `graph_cancel` / `graph_approve`。实现分布在同目录的 `graph-tools.ts`（核心工具集）、`approve-tools.ts`（`graph_approve`）、`status-queries.ts`（`graph_status` 查询）、`persisted-state.ts`（持久化状态查询）与 `live-state.ts`（进程内注册表，供内存态监视器读取）。

工具层与引擎的边界只有一条：**工具是引擎的唯一构建入口**。每次构建步骤之后以及每次 `graph_run` 时，工具层都依据当前声明**重建一个全新的引擎**，再通过 `adoptPrior()` 把先前一次运行的逐节点进度采纳进来——否则重建会把已完成的节点重置回 `ready` / `pending` 并重复派发。每个工具的参数与返回格式见[编排工具](/03-Reference/tools/orchestration-tools)与[工具目录](/03-Reference/tool-catalog)，本页不复制。

## 备注

> 自 v1.0.0 起图引擎可用；v1.8.0 移除声明式多代理块后，`graph_*` 成为唯一的编排入口，且没有迁移命令——迁移是配置改写，对照表见[迁移](/06-Appendix/migration)。

## 相关页面

- [运行时行为](/04-Advanced/runtime-behavior) —— 状态机、推进时序与崩溃恢复
- [图声明](/04-Advanced/graph-declaration) —— 图文档的字段、校验与序列化
- [图工作流](/02-Guide/graph-workflows) —— 用 `graph_*` 编排团队的任务视角
- [信号系统](/04-Advanced/signal-system) —— 信号台账、FSM 与 `signal` 工具
- [工作流模式](/04-Advanced/workflow-patterns) —— 内建拓扑与选型
- [源码索引](/06-Appendix/source-index) —— 概念到模块的总索引
