---
title: 编排工具
description: 编排工具分册：8 个 graph_* 图工具、函数图、调度查询与预算、循环、信号与上下文工具的参数与示例
---

# 编排工具（Orchestration）

这一册覆盖"让多个代理接力干活"所需的全部工具：建图、加节点、连边、跑图、查状态、审批、取消，以及配套的调度查询、有界循环、信号与上下文组装工具。

> 返回[工具目录](/03-Reference/tool-catalog)｜任务视角的用法见[图工作流](/02-Guide/graph-workflows)｜引擎模型见[图执行引擎](/04-Advanced/graph-engine)；自 v1.0.0 起使用命令式图引擎（声明式协作图已在 v1.8.0 移除，见[迁移对照](/06-Appendix/migration)）。

## Graph 工具

8 个 `graph_*` 工具是 rolebox 的命令式编排接口。图由引擎持有并持久化，节点是 `{agent, prompt}` 元组，与角色声明解耦：同一张图可以调度不同角色、不同子代理。

一次最小的两节点流水线（建图 → 加节点 → 连边 → 跑）：

```json
{ "name": "review-pipeline", "budget": { "max_total_cost_usd": 5 } }
```

```json
{ "graph_id": "graph_8f2c", "id": "implement", "agent": "coder", "prompt": "实现 feature-x" }
```

```json
{ "graph_id": "graph_8f2c", "from": "implement", "to": "review" }
```

```json
{ "graph_id": "graph_8f2c" }
```

```text
应看到：
{ "graph_id": "graph_8f2c", "phase": "executing", "active_nodes": ["implement"], "pending_nodes": ["review"] }
```

`graph_run` 是**非阻塞**的：分发就绪的根节点后立即返回 `phase` / `active_nodes` / `pending_nodes`。调用后应当结束当前回合——全部节点完成时引擎注入 `[GRAPH COMPLETE]`，有节点等待审批时注入 `[GRAPH BLOCKED]`。下一回合用 `graph_status(graph_id, include_output=true)` 读一次结果即可，只在提醒没有到达时才轮询。

### graph_create

创建一张图并返回 `graph_id`，后续所有图操作都以它为第一参数。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 人类可读的图名称，用于日志 |
| `budget` | `object` | 否 | 图级资源上限：`max_total_input_tokens` / `max_total_output_tokens` / `max_total_cost_usd`，三者均可省略 |

```json
{ "name": "review-pipeline", "budget": { "max_total_output_tokens": 200000 } }
```

### graph_add_node

向图中添加一个节点。节点是 `{agent, prompt}` 元组；结构校验是原子的——节点非法时整次调用被拒绝，图不会被改坏。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` `id` | `string` | 是 | 目标图；节点在图内的唯一标识 |
| `agent` | `string` | 是 | 要分派的代理标识（例如子代理的完整 ID） |
| `prompt` | `string` | 是 | 该代理执行的提示词 |
| `completion_condition` | `string` | 否 | 命名条件，满足时自动完成该节点 |
| `needs_approval` | `boolean` | 否 | 为 true 时引擎在此节点暂停，等待人工审批 |
| `join` | `object` | 否 | 扇入汇聚策略：`strategy` 取 `all` / `any` / `quorum`；`quorum` 策略需再给正整数 `quorum`（必达的应答数） |
| `budget` | `object` | 否 | 节点级资源上限：`max_input_tokens` / `max_output_tokens` / `max_cost_usd` / `timeout_ms` / `max_retries`。其中 `timeout_ms: 0` 是**合法**的哨兵值，表示关闭该节点的停滞看门狗 |
| `timeout_ms` `max_retries` | `number` | 否 | 节点墙钟超时（毫秒，等价于 `budget.timeout_ms`）；节点升级（escalate）时的自动重试次数 |

```json
{
  "graph_id": "graph_8f2c",
  "id": "review",
  "agent": "reviewer",
  "prompt": "评审 implement 节点的产出",
  "join": { "strategy": "all" },
  "budget": { "max_cost_usd": 1, "timeout_ms": 0 },
  "max_retries": 2,
  "needs_approval": true
}
```

### graph_add_edge

在节点之间加一条有向边。边同时表达数据流与信号路由：`type=on_signal` 必须给 `signal_filter`，`type=on_condition` 必须给 `condition`。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` `from` `to` | `string` | 是 | 目标图；源节点 ID；目标节点 ID |
| `type` | `"always" \| "on_signal" \| "on_condition"` | 否 | 边激活规则，默认 `always` |
| `signal_filter` | `string[]` | 否 | 激活该边的信号类型，`type=on_signal` 时必需 |
| `condition` | `string` | 否 | 必须为真的命名条件，`type=on_condition` 时必需 |
| `data_passthrough_include` | `string[]` | 否 | 向下游传递的载荷字段白名单 |
| `data_passthrough_exclude` | `string[]` | 否 | 传递时省略的字段黑名单 |
| `data_passthrough_max_chars` | `number` | 否 | 传递上下文的截断上限（字符） |
| `retry` | `number \| object` | 否 | 任一关联节点发出 escalate 时的自动重试：裸数字表示次数，或 `{ "max": 3, "backoff_ms": 1000 }` |

```json
{
  "graph_id": "graph_8f2c",
  "from": "review",
  "to": "finalize",
  "type": "on_signal",
  "signal_filter": ["answer"],
  "data_passthrough_include": ["summary", "findings"],
  "retry": { "max": 2, "backoff_ms": 500 }
}
```

### graph_add_loop

声明一个有界循环组：一组节点构成环，最多往返 `max_traversals` 次后退出。这是当前唯一的循环终止语义（旧版 `termination` 参数已随终止子系统移除）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` `id` | `string` | 是 | 目标图；循环组的唯一标识 |
| `nodes` | `string[]` | 是 | 构成循环的节点 ID，至少 1 个 |
| `max_traversals` | `number`（≥1 的整数） | 是 | **硬上限**——往返达到该次数后循环退出 |
| `mode` | `"inherit" \| "fresh"` | 否 | 轮次会话隔离模式。`inherit` 在同一个引擎状态里重新分发；`fresh` **不支持**，会返回显式错误，需要每轮独立会话时请改用"每轮一张图" |

```json
{ "graph_id": "graph_8f2c", "id": "review-loop", "nodes": ["implement", "review"], "max_traversals": 3 }
```

### graph_run

执行图。**非阻塞**：分发就绪根节点后立即返回 `phase` / `active_nodes` / `pending_nodes`。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` | `string` | 是 | 要执行的图 |
| `node_id` `retry` | `string` / `boolean` | 否 | 只重跑某个节点；`retry: true` 配合 `node_id` 表示重试该节点 |
| `modify_prompt` `dry_run` | `string` / `boolean` | 否 | 重试时替换该节点的提示词；只校验图结构而不执行 |

```json
{ "graph_id": "graph_8f2c", "dry_run": true }
```

### graph_status

统一的观测入口：查询图、节点或循环组的状态。这也是审批门被阻塞时唯一需要调用的工具。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` | `string` | 否 | 要查询的图；省略时从 `node_id` / `loop_id` 推断，都没有则列出全部图 |
| `node_id` `loop_id` | `string` | 否 | 查询单个节点的运行时状态 / 查询循环组状态 |
| `scope` | `"session" \| "persisted" \| "all"` | 否 | `session`（默认）只读内存注册表；`persisted` 读磁盘上跨会话的引擎状态；`all` 合并，同 ID 时注册表优先 |
| `format` | `"summary" \| "tree" \| "json"` | 否 | 输出格式 |
| `query` | `string` | 否 | 按 nodeId / prompt / agent 做不区分大小写的子串过滤 |
| `status` | `string` | 否 | 按生命周期状态精确过滤：`pending` / `ready` / `running` / `completed` / `blocked` / `timeout` / `escalate` / `cancelled` / `done` |
| `agent` | `string` | 否 | 按代理精确匹配过滤 |
| `from_date` `to_date` | `string` | 否 | ISO 8601 时间窗，按 `startedAt` / `completedAt` 过滤 |
| `group_by` | `"hour" \| "day" \| "agent"` | 否 | 把**已完成**节点按完成时间分桶聚合（未完成的不计入） |
| `limit` `depth` `round` | `number` | 否 | 限制输出的节点行数 / 裁剪树渲染层级（`depth: 0` 只显示根）/ 把循环历史过滤到某个 1-based 轮次 |
| `include_output` `include_progress` `include_budget` `include_metrics` `include_loops` `include_checkpoint` `include_artifacts` `include_evidence` `include_liveness` `include_history` | `boolean` | 否 | 逐项附加视图：最近一次进度信号 / 预算消耗明细 / 引擎运行时指标 / 全部循环组 / 生命周期检查点 / 制品路径 / 证据引用 / 存活状态 / 逐轮历史。没有记录时输出显式的"未记录"说明，绝不编造行 |
| `pending_approvals` | `boolean` | 否 | 只列出等待人工审批的 `needs_approval` 节点；每行带所属图、阻塞起始时间、审批载荷摘要和一条可直接粘贴的 `graph_approve` 调用 |
| `stream` `since` | `boolean` / `string` | 否 | 输出带时间戳的逐节点信号事件历史；`since` 是 ISO 8601 下界 |
| `max_chars` `offset` `tail` `export_path` | `number` / `boolean` / `string` | 否 | 输出分页（截断长度、起始偏移、取末尾窗口）；`export_path` 原子写出导出文件并返回确认，替代状态渲染——带 `node_id` 导出该节点结果，带 `include_metrics` 导出指标快照，否则导出图声明 |

```json
{ "graph_id": "graph_8f2c", "include_output": true, "include_budget": true }
```

传 `pending_approvals: true` 时输出形如：

```text
应看到（节选）：
Pending approvals (1)  [scope: session]
  review  (graph: graph_8f2c)
    agent: reviewer
    blocked-since: 2026-07-15T09:12:03.000Z
    approve: graph_approve(graph_id="graph_8f2c", node_id="review", action="approve")
```

### graph_cancel

取消整张图、单个节点或一个循环组。`cascade` 为 true 时，取消会沿边传播到目标的下游闭包。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` `node_id` `loop_id` | `string` | 见说明 | `graph_id` 必填（含目标的图）；`node_id` 与 `loop_id` 二选一——取消指定节点 / 取消循环组（自动解析为其成员节点集合），都不给则取消整张图 |
| `cascade` | `boolean` | 否 | 同时取消目标下游的全部节点。默认：循环目标为 true，裸 `node_id` 为 false |

```json
{ "graph_id": "graph_8f2c", "loop_id": "review-loop" }
```

### graph_approve

批准或拒绝一个阻塞中的 `needs_approval` 节点。批准把节点从 `blocked` 推进到 `completed` 并执行其 forward `answer` 数据流；拒绝会让节点在循环组内重入，无循环可回时升级为 escalate。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `graph_id` `node_id` `action` | `string` | 是 | 含阻塞节点的图；当前等待人工的节点；批准（`approve`）或拒绝（`reject`） |
| `reason` `payload` | `string` / `unknown` | 否 | 拒绝理由（`action=reject`）；批准时附带的输出，经 `answer` 边传给下游 |

```json
{ "graph_id": "graph_8f2c", "node_id": "review", "action": "approve", "payload": { "reviewed": true } }
```

## 函数图工具

### function_graph

把函数之间的 requires / produces / consumes 关系画成依赖 DAG，或把条件驱动的激活与停用画成状态机图。OpenCode 与 Pi 提供，dsh 不提供。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `role_id` `focus` | `string` | 否 | 只看某个角色（含其子代理）的函数，省略时覆盖全部角色；图类型默认 `dependencies`（依赖 DAG），`state_machine` 画条件驱动的激活流 |

```json
{ "focus": "state_machine" }
```

## 调度查询与预算工具

`task_*` 是调度历史的只读查询面，OpenCode 与 Pi 注册、dsh 不注册。工厂里还留着 `task_retry`，但两个平台在注册时都显式剔除了它——它会绕过图的预算与审批约束，因此只可读、不可调。

### task_search

按查询文本、状态或日期范围搜索调度任务历史，返回匹配任务的表格；`include_result` 会附带结果前 200 字符的预览。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 匹配任务 prompt / description / agent 名（不区分大小写的子串） |
| `status` | `"pending" \| "running" \| "completed" \| "awaiting_approval" \| "error" \| "cancelled" \| "timeout"` | 否 | 按任务状态过滤 |
| `from_date` `to_date` `limit` | `string` / `number`（1–100） | 否 | ISO 8601 起止时间；最大结果数（默认 20） |
| `include_result` | `boolean` | 否 | 附带结果预览，默认 false |

```json
{ "query": "评审", "status": "completed", "limit": 10 }
```

### task_budget

查询某个会话的预算消耗：Token / 成本用量、剩余额度与触发上限。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 否 | 要检查的会话 ID，默认当前工具上下文的会话 |

```json
{ "session_id": "ses_abc123" }
```

### task_graph

把调度任务的父子关系渲染成依赖树。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `root_session` | `string` | 否 | 作为树根的会话；省略时渲染全部顶层（无父）任务森林 |
| `depth` `include_status` | `number`（1–20） / `boolean` | 否 | 最大展开深度（默认 5）；节点标签是否带状态与代理名（默认 true） |

```json
{ "root_session": "ses_abc123", "depth": 3 }
```

### task_chronology

按时间桶展示任务活动，返回每个状态一列的 Markdown 表格。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `group_by` | `"hour" \| "day" \| "agent"` | 否 | 分桶方式，默认 `hour` |
| `from_date` `to_date` | `string` | 否 | ISO 8601 起止时间 |

```json
{ "group_by": "day", "from_date": "2026-07-01" }
```

### task_export

把已完成任务的结果导出为 markdown 或 JSON 文件，返回写出确认。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `task_id` | `string` | 是 | 要导出的任务 ID |
| `format` | `"markdown" \| "json"` | 否 | 输出格式，默认 markdown |
| `export_path` `output_path` | `string` | 否 | 相对项目根的导出路径；`output_path` 是旧名别名，仅在缺省 `export_path` 时生效 |
| `include_prompt` | `boolean` | 否 | 输出中是否包含任务 prompt，默认 true |

```json
{ "task_id": "task_9d1e", "format": "json", "export_path": "out/report.json" }
```

## 循环工具

6 个 `loop_*` 工具把同一个任务跨多轮、每轮一个全新会话地反复执行。目前**只有 dsh 注册**；OpenCode 与 Pi 上工厂保留但工具不可调用。

### loop_start

启动顺序多会话循环，返回循环的 origin 会话 ID。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt` | `string` | 是 | 每一轮 worker 执行的任务 |
| `iterations` `mode` `objective` | `number`（1–50） / `"inherit" \| "fresh"` / `string` | 否 | 轮数（默认 5）；轮次之间是否共享上下文（默认 `inherit`，`fresh` 每轮从干净会话开始）；收敛判据——摘要宣告该目标完成时提前终止 |

```json
{ "prompt": "跑一遍 lint 并修复所有错误", "iterations": 3, "mode": "fresh" }
```

### loop_status

查询单个循环的运行时状态，或省略参数取全部循环的聚合指标。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 否 | 循环的 origin 会话 ID；省略时返回聚合指标 |

```json
{ "session_id": "ses_loop01" }
```

### loop_cancel

取消运行中的循环；当前轮结束后停止，已经结束的循环不受影响。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 循环的 origin 或 worker 会话 ID |

```json
{ "session_id": "ses_loop01" }
```

### loop_output

读取某一轮的 worker 输出，支持按字符分页。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 循环的 origin 或 worker 会话 ID |
| `round` | `number` | 否 | 指定轮次（1-based）；省略时取最近完成的轮或活跃 worker |
| `max_chars` `offset` `limit` `tail` | `number` / `boolean` | 否 | 内联正文最大字符数、起始偏移、从偏移起最大字符数、是否取末尾窗口 |

```json
{ "session_id": "ses_loop01", "round": 2, "tail": true, "max_chars": 2000 }
```

### loop_history

获取逐轮执行历史：每轮的 worker 会话 ID、时序与状态。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` `round` | `string` / `number` | 见说明 | `session_id` 必填（循环的 origin 会话 ID）；`round` 可选，过滤到指定 1-based 轮次，省略返回全部 |

```json
{ "session_id": "ses_loop01" }
```

### loop_list

列出协调器跟踪的全部循环，可按阶段或 agent 过滤。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `phase` `agent` | `"running" \| "terminal"` / `string` | 否 | 按阶段过滤；按 agent 名做不区分大小写的子串过滤 |
| `format` | `"summary" \| "json"` | 否 | 输出格式，默认 `summary` |

```json
{ "phase": "running", "format": "json" }
```

## 信号与上下文工具

### signal

发出一个带外控制信号，用来显式告诉编排器"任务完成 / 需要审批 / 遇到阻塞"，而不是把状态塞进正文。信号分四类：终止（`answer` / `revise_needed` / `escalate`）、暂停（`need_approval` / `blocked` / `need_clarification`）、交接（`handoff`）、信息（`progress`，只记录不改变状态）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` `payload` | 上面 8 个取值之一 / `Record<string, unknown>` | 见说明 | `type` 必填；`payload` 可选，附带结构化数据 |

```json
{ "type": "escalate", "payload": { "reason": "依赖服务不可用" } }
```

### context_assemble

跨记忆、资产、任务与会话四个域检索，压缩成一段预算受限的上下文块。OpenCode 与 Pi 提供，dsh 不提供。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `topic` `max_tokens` `sources` | `string` / `number`（100–20000） / `("task" \| "memory" \| "asset" \| "session")[]` | 见说明 | `topic` 必填（检索主题）；近似 Token 预算默认 4000；参与检索的域默认四者全选 |

```json
{ "topic": "缓存策略", "max_tokens": 2000, "sources": ["memory", "task"] }
```

## 常见错误

- **`graph_run` 之后一直等结果**：它是非阻塞的，正确做法是结束当前回合，等 `[GRAPH COMPLETE]` / `[GRAPH BLOCKED]` 提醒，下一回合再用 `graph_status(include_output: true)` 读一次。
- **审批门没有反应**：先用 `graph_status(pending_approvals: true)` 确认节点确实处于 blocked，再用 `graph_approve` 传**同一个** `graph_id` 与 `node_id`。
