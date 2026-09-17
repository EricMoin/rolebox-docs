---
title: 05 用图引擎编排团队
description: 教程第 05 章：让角色用 graph_create、graph_add_node、graph_add_edge、graph_run 把三名子代理编成一条流水线，并正确地读回结果。
---

# 05 用图引擎编排团队（Graph）

上一章声明了团队，但派活的过程还是黑盒。这一章把它打开：你会看着角色依次调用 `graph_create` → `graph_add_node` ×3 → `graph_add_edge` ×2 → `graph_run`，把「实现 → 评审 → 定稿」搭成一张**图（graph，由 `graph_create` 创建、用 `graph_id` 寻址的编排容器）**。最后一环最关键：`graph_run` 是**非阻塞**的，角色调用后必须结束回合，结果要等引擎的下一条提醒。

> 前置：[教程 04 把角色变成团队](/02-Guide/tutorial/04-team)（三名子代理已注册）｜下一章：[06 加上审批门与有界循环](/02-Guide/tutorial/06-approval-and-loop)｜工具用法：[图工作流](/02-Guide/graph-workflows)、[编排工具](/03-Reference/tools/orchestration-tools)

## 本章造什么

一条三节点的流水线：`implement`（`code-reviewer--coder`）→ `review`（`code-reviewer--reviewer`）→ `document`（`code-reviewer--doc-writer`）。每个节点是一次**派发（dispatch，把一段提示词交给某个代理执行）**，上游的产出会作为上下文交给下游。

## 第 1 步：在会话里提出要求

回到 `code-reviewer` 会话，说一句话就行——你不需要自己调工具，父角色的系统提示词里已经写明怎么用这组工具派活：

```text
在 ~/rolebox-lab 下写一个 scripts/hello.sh，打印一行问候。
跑成一条流水线：coder 先实现，reviewer 接着审，
doc-writer 最后写一段面向使用者的说明。
每一步都保留产出，全部跑完再给我汇总。
```

## 第 2 步：角色建图

父角色先开一张图。`graph_create` 只需要人类可读的 `name`（它同时就是 `graph_id`）与可选的图级 `budget`，再用 `graph_add_node` 加三个节点，`agent` 填第 04 章注册的子代理 id：

```text
graph_create   { "name": "hello-pipeline", "budget": { "max_total_cost_usd": 5 } }
               → { "graph_id": "hello-pipeline", "name": "hello-pipeline",
                   "created_at": "2026-09-17T06:10:41.512Z" }

graph_add_node { "graph_id": "hello-pipeline", "id": "implement",
                 "agent": "code-reviewer--coder", "prompt": "写 scripts/hello.sh……" }
               → { "node_id": "implement", "graph_id": "hello-pipeline", "created": true }

graph_add_node { "graph_id": "hello-pipeline", "id": "review",
                 "agent": "code-reviewer--reviewer", "prompt": "审查上游实现……" }
               → { "node_id": "review", "graph_id": "hello-pipeline", "created": true }

graph_add_node { "graph_id": "hello-pipeline", "id": "document",
                 "agent": "code-reviewer--doc-writer", "prompt": "写两行使用说明……" }
               → { "node_id": "document", "graph_id": "hello-pipeline", "created": true }
```

节点本身不定义顺序。顺序由边决定：`graph_add_edge` 给 `from` / `to`，`type` 省略即 `always`（上游一有结果就激活下游）：

```text
graph_add_edge { "graph_id": "hello-pipeline", "from": "implement", "to": "review" }
               → { "edge_id": "implement->review", "from": "implement", "to": "review", "type": "always" }

graph_add_edge { "graph_id": "hello-pipeline", "from": "review", "to": "document" }
               → { "edge_id": "review->document", "from": "review", "to": "document", "type": "always" }
```

到这里还没有任何子代理开始干活：建图只是往图的注册表里写结构，加节点与加边失败会整条拒绝（图保持不变）。想先确认结构能不能跑，可以让角色用 `graph_run` 的 `dry_run: true` 做一次执行级校验——它返回 `validation`，不派发任何节点。

## 第 3 步：graph_run 是非阻塞的

真正的执行只有一句 `graph_run`：

```text
graph_run { "graph_id": "hello-pipeline" }
          → { "graph_id": "hello-pipeline", "phase": "executing",
              "active_nodes": ["implement"], "pending_nodes": ["review", "document"] }
```

返回值立刻就到：`phase` 是 `executing`，`active_nodes` 是刚被派发的根节点 `implement`，`pending_nodes` 是还没轮到的两个。**它不等它们跑完**——派发完所有就绪的根节点就返回。

所以工具契约要求角色在 `graph_run` 之后**结束当前回合**，把后续交给引擎：

1. 引擎在后台推进图；
2. 全部节点结束时，它往这个会话注入一条 `[GRAPH COMPLETE]` 系统提醒（有节点在等人工审批时是 `[GRAPH BLOCKED]`，见第 06 章）；
3. 提醒到达后，角色在**下一回合**读结果。

如果角色在 `graph_run` 之后不结束回合，而是改用 `graph_status` 反复轮询，它就把非阻塞引擎当成阻塞调用了——这是本章最值得记住的一条。

## 第 4 步：等 [GRAPH COMPLETE]，只读一次结果

流水线跑完后，会话里会多出一条系统提醒，形状是固定的：

```text
<system-reminder>
[GRAPH COMPLETE]
graph: hello-pipeline
phase: complete
nodes: completed=3

→ Read all results: graph_status(graph_id="hello-pipeline", include_output=true)
</system-reminder>
```

下一回合，角色按提醒的指示回读一次。默认的 `graph_status` 给一张状态表；要连产出一起取回来，用 `format: "json"` 配 `include_output: true`（也可以只给 `node_id` 看单个节点）：

```text
graph_status { "graph_id": "hello-pipeline" }
             → Graph "hello-pipeline"  [phase: complete]
                 NODE                  STATUS      AGENT
                 implement             completed   code-reviewer--coder
                 review                completed   code-reviewer--reviewer
                 document              completed   code-reviewer--doc-writer

graph_status { "graph_id": "hello-pipeline", "format": "json", "include_output": true }
             → { "graph_id": "hello-pipeline", "phase": "complete",
                 "nodes": [ { "node_id": "implement", "status": "completed",
                              "agent": "code-reviewer--coder",
                              "output": "已创建 scripts/hello.sh……" }, … ] }
```

**只在提醒没到时才轮询**：如果很久既没有 `[GRAPH COMPLETE]` 也没有 `[GRAPH BLOCKED]`，用一次 `graph_status` 看看是不是有节点卡在 `running`，再决定继续等、重试还是取消；不要在同一个回合里反复查。

## 第 5 步：观测与人工叫停

`graph_status` 不只在结束时有用：图在跑的时候也可以查（`phase` 是 `executing`、哪个节点 `running`），它是只读的，不会打断推进。`graph_cancel` 则是给**人**的控制面——在会话里直接说「取消那张图」，或让角色调用：

```text
graph_cancel { "graph_id": "hello-pipeline", "node_id": "document", "cascade": true }
             → { "cancelled": ["document"], "graph_id": "hello-pipeline" }
```

返回的 `cancelled` 是引擎实际取消的节点 id；`cascade: true` 会把该节点传递下游的节点一并取消。工具契约把 `graph_cancel` 定义为人工监控与干预手段，不要用它让角色自我取消正在跑的工作流。

## 常见错误

- **`graph_run` 之后继续等**：调用已经返回，结果要靠提醒；在同一个回合里等是等不到的。
- **反复轮询 `graph_status`**：提醒会到，轮询只在提醒缺席时兜底。
- **回读时忘了 `include_output`**：默认渲染的是状态表，产出要显式索取。
- **`agent` 写成显示名**：这里要的是子代理 id（`code-reviewer--coder`），不是 `Coder`。
- **节点 `id` 重复**：同一张图内必须唯一，重复的 `graph_add_node` 会被直接拒绝。
- **边连到不存在的节点**：`from` / `to` 必须已经用 `graph_add_node` 声明过，否则这条边会被结构校验拒绝。
- **加回边却不声明循环组**：本章只搭直线链路；一条纯 `always` 的环永远无法激活，`graph_run` 前的执行级校验会直接报错——回环要用 `graph_add_loop`（第 06 章）。

## 你现在拥有什么

- 一张跑通的图：`implement → review → document`，三个节点分别由三名子代理承接；
- 「非阻塞 → 结束回合 → `[GRAPH COMPLETE]` → 回读一次」这条固定节奏；
- 两个随时可用的入口：`graph_status`（观测）与 `graph_cancel`（人工叫停）。

下一章 [06 加上审批门与有界循环](/02-Guide/tutorial/06-approval-and-loop)：在定稿前插入人工审批门，并给评审返工加上硬性遍历上限。

## 备注

- 图生存在内存注册表里；要跨会话查看，用 `graph_status` 的 `scope` 参数（`persisted` 读磁盘上的引擎状态）。
- 三条边类型（`always` / `on_signal` / `on_condition`）、多上游的 `join` 汇聚与数据透传字段，见[图工作流](/02-Guide/graph-workflows)；节点状态机与信号传播的内部语义见[图执行引擎](/04-Advanced/graph-engine)。
