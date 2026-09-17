---
title: 06 加上审批门与有界循环
description: 教程第 06 章：给流水线加人工审批门，并用 max_traversals 给评审循环设硬上限。
---

# 06 加上审批门与有界循环（Approval Gate and Bounded Loop）

本章给 05 章的流水线补上两件让它「敢用」的东西：关键节点停下来等人点头，以及评审打回重做的循环有硬性次数上限。

> 前置：[教程 05 用图引擎编排团队](/02-Guide/tutorial/05-graph)｜相关：[图工作流](/02-Guide/graph-workflows)、[工作流模式](/04-Advanced/workflow-patterns)｜引擎内部：[图执行引擎](/04-Advanced/graph-engine)

## 起点：05 章那条流水线

05 章建了一条三节点流水线：`coder` 实现 → `reviewer` 评审 → `finalize` 定稿，两条 `always` 边把它们串起来，`graph_run` 之后引擎自动推进，直到注入 `[GRAPH COMPLETE]`。

这条流水线跑得太顺了：定稿直接落地，没有人过目；评审不通过时也没有回头路。本章分两步补齐——先加**审批门（approval gate，节点声明 `needs_approval: true` 后，代理发出 `need_approval` 信号时引擎把该节点置为 `blocked`、暂停其下游分支的机制）**，再给回头路加**循环组（loop group，用 `graph_add_loop` 声明的、由 `revise_needed` 回边驱动重跑的节点集合）**。

## 第 1 步：建一张带审批门的图

节点一旦声明就不能再改，所以本章新建一张同形状的图，只在 `finalize` 上加门。在会话里对角色说：

```text
用图工具再建一张流水线，叫 review-pipeline-gated：
coder 实现 → reviewer 评审 → finalize 定稿。
finalize 要人工审批：它的提示词里写明——产出定稿后先调用 signal 工具，
type 用 need_approval，把定稿摘要放进 payload，等我批准再输出最终稿。
三个节点的 agent 分别用 code-reviewer--coder、code-reviewer--reviewer、
code-reviewer--doc-writer，两条边都用 always。
```

角色会在同一回合里依次调用这些工具（这里省略了各节点的 prompt 正文）：

```text
graph_create({ name: "review-pipeline-gated" })
graph_add_node({ graph_id: "review-pipeline-gated", id: "coder",
                 agent: "code-reviewer--coder", prompt: "实现改动并输出补丁" })
graph_add_node({ graph_id: "review-pipeline-gated", id: "reviewer",
                 agent: "code-reviewer--reviewer", prompt: "评审上游产物" })
graph_add_node({ graph_id: "review-pipeline-gated", id: "finalize",
                 agent: "code-reviewer--doc-writer", needs_approval: true,
                 prompt: "产出定稿说明后调用 signal 工具发 need_approval，等待批准" })
graph_add_edge({ graph_id: "review-pipeline-gated", from: "coder", to: "reviewer" })
graph_add_edge({ graph_id: "review-pipeline-gated", from: "reviewer", to: "finalize" })
graph_run({ graph_id: "review-pipeline-gated" })
```

`graph_run` 是非阻塞的，派发就绪节点后立刻返回：

```text
应看到（示例输出，active / pending 的具体成员取决于调用时刻）：
{
  "graph_id": "review-pipeline-gated",
  "phase": "executing",
  "active_nodes": ["coder"],
  "pending_nodes": ["reviewer", "finalize"]
}
```

**`needs_approval: true` 只是「允许暂停」，不是「自动暂停」。** 引擎是在节点发出 `need_approval` 信号时才把它置为 `blocked` 的；反过来，没声明 `needs_approval` 的节点即使发了这个信号也不会挡住图。所以门上那个节点的提示词必须指示代理去发信号——上面 `finalize` 的 prompt 里那句话，就是本章最关键的一行配置。

## 第 2 步：结束回合，等 [GRAPH BLOCKED]

调用完 `graph_run` 就结束当前回合：`coder`、`reviewer` 依次完成，`finalize` 发出 `need_approval`，引擎把它置为 `blocked` 并冻结它的下游分支。当图不再有可推进的节点、却又有人在等审批时，引擎注入一条系统提醒：

```text
<system-reminder>
[GRAPH BLOCKED]
graph: review-pipeline-gated
phase: executing
nodes: completed=2 blocked=1

→ Graph quiescent-blocked — nodes await approval.
→ Inspect blocked nodes: graph_status(graph_id="review-pipeline-gated", status="blocked", include_output=true)
→ Approve: graph_approve(graph_id="review-pipeline-gated", node_id="<blocked_node_id>", action="approve")
→ Reject: graph_approve(graph_id="review-pipeline-gated", node_id="<blocked_node_id>", action="reject") with reason
→ Read all results: graph_status(graph_id="review-pipeline-gated", include_output=true)
</system-reminder>
```

注意 `phase` 仍然是 `executing`：图的生命周期阶段只有 `idle` / `executing` / `complete` 三个值，审批门不改变阶段，图只是停在原地等人。停住的也不是整张图——`finalize` 的下游分支被冻结，已经完成的节点照常收尾。

## 第 3 步：列出待批节点

下一回合，用 `pending_approvals: true` 专门查「等人类点头」的节点：

```text
graph_status({ graph_id: "review-pipeline-gated", pending_approvals: true })
```

```text
应看到（示例输出，时间随实际运行变化）：
Pending approvals (1)  [scope: session]
  finalize  (graph: review-pipeline-gated)
    agent: code-reviewer--doc-writer
    blocked-since: 2026-09-17T08:21:04.512Z
    approve: graph_approve(graph_id="review-pipeline-gated", node_id="finalize", action="approve")
```

这是一个跨图视图：不传 `graph_id` 时会扫描当前会话里所有图，每一行都自带一条可直接复制的 `graph_approve` 调用。`graph_status(..., status: "blocked")` 是另一种看法——按节点状态过滤；`pending_approvals` 回答的则是「现在有什么在等我决策」。两者都只列真实记录的节点，没有待批项时会明确说 `no pending approvals`。

## 第 4 步：放行或打回

批准：

```text
graph_approve({ graph_id: "review-pipeline-gated", node_id: "finalize", action: "approve" })
```

```text
应看到（示例输出）：
{
  "graph_id": "review-pipeline-gated",
  "node_id": "finalize",
  "action": "approve",
  "node_status": "completed",
  "phase": "complete",
  "applied": true
}
```

`approve` 把节点从 `blocked` 推到 `completed`，再沿它的 `answer` 数据流放行下游。本例的 `finalize` 是最后一个节点，所以图随即进入 `complete`，引擎注入 `[GRAPH COMPLETE]`；若被批准的不是末节点，`phase` 会是 `executing`，下游节点立刻被派发。

`applied` 回答的是「这次决策真的起作用了吗」：对已经解决的节点重复批准不会报错，但 `applied` 会是 `false`——它标记的是一次空操作。

若定稿不合格，改用拒绝，并把理由说清楚：

```text
graph_approve({ graph_id: "review-pipeline-gated", node_id: "finalize", action: "reject",
                reason: "结论缺少风险评估，补上再交" })
```

拒绝走哪条路由，取决于这个节点有没有循环组：属于循环组的节点回到 `ready` 重跑，`reason` 会被拼进它的重跑提示词；不属于任何循环组的节点没有回头路，直接升级为 `escalate`。本例的 `finalize` 没有循环组，所以「打回重做」需要下一节的循环组支撑。

## 第 5 步：给「打回重做」加硬上限

现在让 `reviewer` 能打回 `coder` 重做，同时保证它不能无限打回。循环组要在 `graph_run` 之前声明好，所以这里新建第二张图：

```text
再建一张图 review-loop-lab，只放两个节点：coder 与 reviewer。
coder → reviewer 是 always 边；reviewer 发现问题时调用 signal 工具发 revise_needed，
把问题清单放进 payload。再声明一个循环组 review-loop，成员是这两个节点，
max_traversals 设 3。reviewer 的提示词里写明：有问题发 revise_needed，通过则发 answer。
```

```text
graph_create({ name: "review-loop-lab" })
graph_add_node({ graph_id: "review-loop-lab", id: "coder",
                 agent: "code-reviewer--coder", prompt: "实现改动并输出补丁" })
graph_add_node({ graph_id: "review-loop-lab", id: "reviewer",
                 agent: "code-reviewer--reviewer",
                 prompt: "有问题发 revise_needed（清单放 payload），通过则发 answer" })
graph_add_edge({ graph_id: "review-loop-lab", from: "coder", to: "reviewer" })
graph_add_edge({ graph_id: "review-loop-lab", from: "reviewer", to: "coder",
                 type: "on_signal", signal_filter: ["revise_needed"] })
graph_add_loop({ graph_id: "review-loop-lab", id: "review-loop",
                 nodes: ["coder", "reviewer"], max_traversals: 3 })
graph_run({ graph_id: "review-loop-lab" })
```

回边必须是 `on_signal` 且 `signal_filter` 里含 `revise_needed`——只有这种边被引擎认作「修订回边」，`always` 边是前进数据流，不参与回环。还要注意顺序：`graph_add_loop` 要求成员节点真的构成一个有向环，回边还没加时它会直接报错，所以先加回边、再声明循环组。

```text
应看到（示例输出）：
{ "loop_id": "review-loop", "graph_id": "review-loop-lab",
  "nodes": ["coder", "reviewer"], "max_traversals": 3 }
```

**`max_traversals` 是硬性遍历上限**，含义只有一个：这个循环组最多接受几次打回，`max_traversals: 3` 就是最多三轮重做，取值必须是 ≥ 1 的整数。它不是一个条件表达式，也没有配套的条件配置块——它就是上限本身。

运行时它这样记账：`reviewer` 每发出一次 `revise_needed`，引擎就把该循环组的遍历计数 +1，并把 `coder` 重新置为 `ready` 再跑一遍（重跑提示词里会带上这一轮的修订意见）；当计数已达上限、又收到一次 `revise_needed` 时，节点不再重跑，直接以 `max_traversals exhausted` 收尾，并带上 `{ reason, unresolved, traversals }` 的结构化说明。无论评审多挑剔，这条流水线最多重跑三轮就会停下来交给人处理。

另有一条与次数无关的早退：如果连续两次打回的 payload 完全相同，说明重跑没有带来任何变化，引擎判定为 `stuck` 并在消耗次数之前收尾。

跑起来之后，可以在状态里看到循环进度：

```text
graph_status({ graph_id: "review-loop-lab", include_loops: true })
```

```text
应看到（示例输出）：
Graph "review-loop-lab"  [phase: executing]
  NODE                  STATUS      AGENT
  coder                 completed   code-reviewer--coder
  reviewer              running     code-reviewer--reviewer

  Loops:
    review-loop  [1/3]  nodes: coder, reviewer
```

`[1/3]` 就是「已重入 1 次 / 上限 3 次」。

## 常见错误

1. **只写了 `needs_approval: true`，却没让节点发 `need_approval` 信号。** 门不会自己关上：图会一路跑到 `complete`，你永远等不到 `[GRAPH BLOCKED]`。
2. **给审批门节点的出边写了 `type: "always"`。** 结构校验会拒绝这种图：审批节点的出边只能是 `on_signal` 或 `on_condition`，因为审批结果本身就是一次信号，`always` 会绕过它。
3. **先声明循环组、后加回边。** `graph_add_loop` 要求成员节点真的构成有向环，顺序反了会报错。
4. **`max_traversals: 0`。** 取值必须 ≥ 1；想「不循环」就不要声明循环组。
5. **在 `graph_approve` 之前取消了节点或整张图。** 决策会退化成空操作（`applied: false`），节点不会因为批准而复活。

## 你现在拥有什么

- 一张带人工审批门的流水线：`[GRAPH BLOCKED]` → `pending_approvals` → `graph_approve`（批准或带理由打回）；
- 一条有硬上限的评审回环：`reviewer` 发 `revise_needed` 打回 `coder`，最多 `max_traversals` 轮；
- 三种「图停下来了」的判据：有人等着批（`blocked`）、次数用完（`max_traversals exhausted`）、原地打转（`stuck`）。

下一章 [07 让代理记住你](/02-Guide/tutorial/07-memory)：把这一路上定下来的决策写进记忆库，让下一个会话的代理自动记得。
