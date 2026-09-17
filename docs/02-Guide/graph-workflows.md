---
title: 图工作流
description: 用八个 graph_* 工具在运行时编排多代理工作流：建图、加节点、连边、运行、观测、审批门、有界循环与取消
---

# 图工作流（Graph Workflows）

这一页回答「我要编排一件事，具体该按什么顺序调用哪些工具」。rolebox 的多代理编排是**命令式（imperative）**的：没有声明式的拓扑配置，你在运行时用八个 `graph_*` 工具把图搭出来，再交给图引擎执行。

> 前置：[教程 05 用图引擎编排团队](/02-Guide/tutorial/05-graph)｜相关：[工作流模式](/04-Advanced/workflow-patterns)｜[图执行引擎](/04-Advanced/graph-engine)｜[图声明参考](/04-Advanced/graph-declaration)

三个术语就地定义：**图（graph，由 `graph_create` 创建并返回 `graph_id` 的编排容器）**、**节点（node，一次派发单元，形状是角色无关的 `{agent, prompt}` 元组）**、**边（edge，有向的 `from → to` 关系，既定义数据流也定义信号路由）**。

## 最小示例

对角色说「把 coder 和 reviewer 串起来跑一遍」，它会依次调用五个工具：

```text
graph_create   { "name": "mini-pipeline" }
               → { "graph_id": "g-7f3a", "name": "mini-pipeline", "created_at": "..." }

graph_add_node { "graph_id": "g-7f3a", "id": "coder",    "agent": "team--coder",    "prompt": "实现功能" }
               → { "node_id": "coder", "graph_id": "g-7f3a", "created": true }
graph_add_node { "graph_id": "g-7f3a", "id": "reviewer", "agent": "team--reviewer", "prompt": "审查实现" }
               → { "node_id": "reviewer", "graph_id": "g-7f3a", "created": true }

graph_add_edge { "graph_id": "g-7f3a", "from": "coder", "to": "reviewer" }
               → { "edge_id": "coder->reviewer", "from": "coder", "to": "reviewer", "type": "always" }

graph_run      { "graph_id": "g-7f3a" }
               → { "graph_id": "g-7f3a", "phase": "executing",
                   "active_nodes": ["coder"], "pending_nodes": ["reviewer"] }
```

`graph_run` 只派发入度为零的**根节点**（这里是 `coder`）就立即返回，**不阻塞**。约定是**调用后结束当前回合**：引擎在全部节点结束时注入 `[GRAPH COMPLETE]`，在节点等待审批时注入 `[GRAPH BLOCKED]`。下一回合只回读一次结果，不要轮询：

```text
graph_status   { "graph_id": "g-7f3a", "include_output": true, "format": "tree" }
               → 节点依赖树 + 每个节点的状态与产出
```

八个工具按用途分四组：建图 `graph_create`；装配 `graph_add_node` / `graph_add_edge` / `graph_add_loop`；执行 `graph_run`；干预 `graph_status` / `graph_approve` / `graph_cancel`。每个工具的参数、返回格式与完整调用示例见[编排工具](/03-Reference/tools/orchestration-tools)，全部工具的索引见[工具目录](/03-Reference/tool-catalog)。

## 建图：graph_create

一次编排对应一张图。`graph_create` 接受人类可读的 `name`（日志里用它标识这张图）与可选的图级 `budget`（跨全部节点累计的 token 与成本上限），返回的 `graph_id` 是后续所有调用的寻址键：

```text
graph_create { "name": "code-review", "budget": { "max_total_cost_usd": 5 } }
             → { "graph_id": "g-7f3a", "name": "code-review", "created_at": "..." }
```

- `graph_status` 是唯一可以省略 `graph_id` 的工具：给它 `node_id` 或 `loop_id` 时它会自行推断归属图。
- 图级预算与节点级预算的分工，以及预算触顶后的行为，见[图执行引擎](/04-Advanced/graph-engine)。
- 图只存在于内存注册表中；要跨会话查看它，用 `graph_status` 的 `scope` 参数（见下文「观测」）。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 加节点：graph_add_node

节点是一次派发：`id` 在图内唯一，`agent` 是承接它的角色标识（例如父角色 `team` 下的子代理 `team--coder`），`prompt` 是交给它的指令。

```text
graph_add_node { "graph_id": "g-7f3a", "id": "tester", "agent": "team--tester",
                 "prompt": "运行测试并报告失败用例" }
               → { "node_id": "tester", "graph_id": "g-7f3a", "created": true }
```

- **汇聚**：一个节点有多个上游时，用 `join` 决定何时开始——`{ "strategy": "all" }`（缺省）、`"any"`，或 `{ "strategy": "quorum", "quorum": 2 }`。`quorum` 是**必需的应答数**，不得超过该节点的入度。
- **人工放行**：`needs_approval: true` 让节点派发后停在 `blocked`，等待人工决策（见下文「审批门」）。
- **韧性**：节点级 `timeout_ms`（`0` 是有效值，表示关闭该节点的停滞看门狗）与 `max_retries`（节点升级后由引擎自动重试）。
- **校验是原子的**：非法节点会被整条拒绝，图保持不变。校验只看结构——`agent` 与 `prompt` 的语义不被解读，`agent` 是否真的可派发属于运行环境问题。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 连边：graph_add_edge

边决定工作怎么流转。`graph_add_edge` 给出 `from` / `to`，`type` 省略时默认 `always`：

```text
graph_add_edge { "graph_id": "g-7f3a", "from": "reviewer", "to": "tester" }
               → { "edge_id": "reviewer->tester", "from": "reviewer", "to": "tester", "type": "always" }

graph_add_edge { "graph_id": "g-7f3a", "from": "reviewer", "to": "coder",
                 "type": "on_signal", "signal_filter": ["revise_needed"] }
               → { "edge_id": "reviewer->coder", "from": "reviewer", "to": "coder", "type": "on_signal" }
```

三种类型：

- `always`——上游一有结果就激活，用于串行主干。
- `on_signal`——收到 `signal_filter` 列出的信号时激活；**必须给 `signal_filter`**。上面的 `revise_needed` 回边是典型用法：它把已经完成的上游节点重新拉回就绪，形成评审返工。
- `on_condition`——`condition` 命名的条件评估为真时激活；**必须给 `condition`**，且名字必须来自已注册的条件词汇表，否则结构校验直接拒绝。

边的其他字段是数据透传（`data_passthrough_include` / `data_passthrough_exclude` / `data_passthrough_max_chars`）与升级重试（`retry`）。参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

一条硬约束：`needs_approval: true` 的节点**只能**有 `on_signal` 或 `on_condition` 出边。给它一条 `always` 出边会让图在人工决策之前就继续前进，因此会被校验拒绝。

## 运行：graph_run 是非阻塞的

`graph_run` 派发所有就绪根节点后立即返回 `phase` / `active_nodes` / `pending_nodes`，不等待结果。正确用法只有三步：

1. **调用 `graph_run`，然后结束当前回合。**
2. 等待引擎注入的系统提醒：所有节点结束是 `[GRAPH COMPLETE]`，有节点等待审批是 `[GRAPH BLOCKED]`。
3. **下一回合回读一次** `graph_status(graph_id, include_output: true)`；只有在提醒始终没有到达时才把 `graph_status` 当作兜底轮询。

```text
graph_run    { "graph_id": "g-7f3a", "dry_run": true }
             → { "graph_id": "g-7f3a", "phase": "validating", "active_nodes": [], "pending_nodes": [],
                 "dry_run": true, "validation": { ... } }
```

- `dry_run: true` 只做 `execution` 级别的结构校验并返回 `validation`，不派发任何节点——适合在真正跑之前验证一张图。
- 给 `node_id` 可以只重跑某个节点；再加 `retry: true` 表示重试，`modify_prompt` 可以在重试时替换该节点的指令。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 观测：graph_status

`graph_status` 是统一的可观测端点。不给目标时它列出全部图；`format` 取 `summary`（表格）、`tree`（节点依赖树）或 `json`（机器可读快照）：

```text
graph_status { "graph_id": "g-7f3a", "format": "tree" }
             → code-review (executing)
               ├─ coder      completed
               └─ reviewer   running
```

按用途挑参数：

- **范围**：`scope: "session"`（默认，只读内存注册表）、`"persisted"`（读磁盘上的引擎状态，跨会话视图）、`"all"`（合并两者，冲突时注册表优先）。
- **定位**：`node_id` / `loop_id` 查询单个节点或循环组；`status` / `agent` / `query` / `from_date` / `to_date` 过滤；`limit` / `offset` / `tail` / `max_chars` 分页与截断；`depth` 裁剪树深度；`group_by` 按小时 / 天 / 角色聚合已完成节点。
- **展开内容**：`include_output`（节点产出）、`include_progress`、`include_budget`、`include_metrics`、`include_loops` 与 `include_history` / `round`（循环组与逐回合历史）、`include_checkpoint`、`include_artifacts`、`include_evidence`、`include_liveness`、`stream` / `since`（信号事件历史）。
- **落盘**：`export_path` 原子写出——有 `node_id` 时写该节点的结果文本，`include_metrics` 时写指标 JSON，否则写图声明的 YAML。

空结果一律渲染为诚实的空提示（例如 `no pending approvals`），不会编造行。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 审批门：needs_approval 与 graph_approve

给节点设 `needs_approval: true`，它派发后进入 `blocked`，下游派发暂停，引擎注入 `[GRAPH BLOCKED]` 把编排者唤醒。**人工在环（HITL，human-in-the-loop）**的完整流程是「发现 → 决策」：

```text
# 1) 发现：列出所有正在等待人工的节点
graph_status  { "pending_approvals": true }
              → graph g-7f3a · node final-gate · blocked since 2026-09-17T06:12:03Z
                approval_payload: { "summary": "评审通过，请求放行" }
                → graph_approve { "graph_id": "g-7f3a", "node_id": "final-gate", "action": "approve" }

# 2) 决策：批准（或带反馈拒绝）
graph_approve { "graph_id": "g-7f3a", "node_id": "final-gate",
                "action": "approve", "payload": { "released": true } }
              → { "graph_id": "g-7f3a", "node_id": "final-gate", "action": "approve",
                  "node_status": "completed", "phase": "executing", "applied": true }
```

- `graph_status` 的 `pending_approvals: true` 是专门的「等待人工」视图：它跨当前 `scope` 列出每一个阻塞中的 `needs_approval` 节点，每行带归属图、阻塞起始时间、截断后的 `approval_payload` 摘要，以及一条**可直接粘贴**的 `graph_approve` 调用。
- `approve` 解除门禁（`blocked → completed`）并沿 `answer` 边把 `payload` 传给下游；`reject` 在该节点属于循环组时带 `reason` 重新进入，否则把它升级。
- 两个动作都**幂等**：对已经解决的节点再次决策是空操作，返回值里的 `applied: false` 会如实说明这一点。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 有界循环：graph_add_loop

图里的每个有向环都必须被一个显式声明的**循环组（loop group）**覆盖：`graph_add_loop` 用 `nodes` 列出构成该环的节点，用 `max_traversals` 给出**硬性遍历上限**。

```text
graph_add_loop { "graph_id": "g-7f3a", "id": "revise-loop",
                 "nodes": ["coder", "reviewer"], "max_traversals": 3 }
               → { "loop_id": "revise-loop", "graph_id": "g-7f3a",
                   "nodes": ["coder", "reviewer"], "max_traversals": 3 }
```

- `max_traversals` 是整数且最小为 1。触顶后 `revise_needed` 不再回环，成员节点升级为 `escalate`，并带上结构化载荷（退出原因、未解决项、已消耗的遍历次数）。
- 循环的三种退出方式：收敛（收敛节点发出 `answer`，自然结束且不消耗遍历次数）、触顶升级、停滞升级（连续两次遍历的收敛输出完全相同）。完整结果集合见[图执行引擎](/04-Advanced/graph-engine)。
- `mode` 只有 `inherit` 一种有效取值（省略即默认）：各回合在同一份引擎状态内重新派发。`mode: "fresh"` **未实现**，传入会返回显式错误；需要逐回合会话隔离时，改为**每个回合用一张独立的图**。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 取消：graph_cancel

`graph_cancel` 是人工监控与干预用的控制面——**不要**用它让代理自我取消正在运行的工作流。

```text
graph_cancel { "graph_id": "g-7f3a", "loop_id": "revise-loop" }
             → { "cancelled": ["coder", "reviewer"], "graph_id": "g-7f3a" }

graph_cancel { "graph_id": "g-7f3a", "node_id": "tester", "cascade": true }
             → { "cancelled": ["tester", "doc-writer"], "graph_id": "g-7f3a" }
```

- 不给 `node_id` / `loop_id` 时取消整张图；给 `node_id` 只取消该节点，给 `loop_id` 则解析为它的完整成员集。
- `cascade: true` 让取消沿边向前闭包，把传递下游的节点一并取消。默认值：循环目标为 `true`，裸 `node_id` 为 `false`，整图取消时忽略。
- 返回值是引擎**实际**取消的节点 id 集合，而不是猜测。

参数明细：[编排工具](/03-Reference/tools/orchestration-tools)。

## 常见错误

- **`on_signal` 边漏了 `signal_filter`**：工具直接拒绝该边（`type "on_signal" but no "signal_filter" was provided`）。
- **`on_condition` 用了未注册的条件名**：结构校验在写入时拒绝；空 `condition` 同样被拒绝。
- **给 `needs_approval` 节点连了 `always` 出边**：校验拒绝——那样图会在人工决策前继续前进。
- **加了回边却没声明循环组**：增量建图阶段（`construct`）只是警告，但 `graph_run` 前的 `execution` 校验会把没有 `revise_needed` 回边的未覆盖环升级为致命错误，因为这种环永远无法激活。
- **循环组的节点集合本身不成环**：声明一个无环的「循环」是结构错误。
- **`quorum` 大于该节点入度**：拒绝——那是一个永远无法满足的 join。节点还没有入边时，这个上界检查会延后，以支持增量建图。
- **`mode: "fresh"`**：返回显式错误，改用每回合一张图。
- **`graph_run` 之后不结束回合，改用轮询**：与工具契约相反。引擎会注入 `[GRAPH COMPLETE]` / `[GRAPH BLOCKED]`，回读一次即可，轮询只是提醒未到时的兜底。
- **节点或循环组 `id` 重复**：在同一张图内 `id` 必须唯一，重复会被拒绝。

## 备注

> 自 v1.0.0 起，多代理编排由命令式 `graph_*` 工具与 v2 图引擎承载。

- `role.yaml` 的角色级 `graph:` 键目前只是向前兼容的语法占位：解析器识别 `graph.orchestration` 并记录一条「已识别但未接线」的警告，它**没有**任何编排效果。字段说明见 [role.yaml 参考](/03-Reference/role-yaml)，声明文档格式见[图声明参考](/04-Advanced/graph-declaration)。
- 若你的角色仍带着已移除的声明式协作配置块，迁移写法见[迁移对照](/06-Appendix/migration)与[协作图](/02-Guide/collaboration-graph)。
- 本页只讲「怎么调用工具」。节点状态机、join 评估、信号传播与级联取消的实现语义见[图执行引擎](/04-Advanced/graph-engine)与[运行时行为](/04-Advanced/runtime-behavior)；选型（该用哪种拓扑）见[工作流模式](/04-Advanced/workflow-patterns)。
