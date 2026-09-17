---
title: 协作图（已移除）
description: 声明式 collaboration 块的移除范围与迁移要点 — v1.8.0 起多代理工作流只跑命令式 graph_* 引擎
---

# 协作图（Collaboration Graph，已移除）

协作图是 rolebox v0.x–v1.7 的声明式多代理工作流写法：在 `role.yaml` 中用 `collaboration:` 块描述拓扑、参与者与迭代上限，启动时由解析器转成图并自动推进。**v1.8.0 起该子系统被整体移除**，本页只记录它曾是什么、删掉了什么，以及旧配置如何改写。

> 前置：[迁移对照](/06-Appendix/migration)｜相关：[图工作流](/02-Guide/graph-workflows)、[图执行引擎](/04-Advanced/graph-engine)

## 被移除的是什么

`collaboration:` 是 `role.yaml` 顶层的一个声明式（declarative）块——用少量字段描述整张工作流，而不是逐条发命令。它的字段有：

| 字段 | 作用 |
|---|---|
| `topology` | 预设拓扑：`pipeline`（串行）、`review-loop`（循环）、`star`（并行） |
| `flow` | 自定义数据流：谁把结果传给谁 |
| `agents` | 参与该工作流的子代理列表 |
| `max_iterations` | 工作流循环轮数上限 |
| `termination` | 终止条件，用 `any_of`（任一满足即止）/ `all_of`（全部满足才止）组合 |

## 移除了什么范围

v1.8.0 把声明式协作词汇表整体删除，范围可归为四类：

| 类别 | 被删除的对象 |
|---|---|
| `role.yaml` schema | `collaboration:` 块本身（`topology` / `flow` / `agents` / `max_iterations` / `termination`） |
| 类型词汇表 | `TerminationDecl` / `TerminationCondition` / `LoopCondition` / `TerminationConfig` |
| 扩展点与工具参数 | `termination_conditions` 扩展点、`graph_add_loop` 的 `termination` 参数 |
| 代码模块 | 移植过来的 `collaboration-*` 图模块（advance / state / store / bridge / validator）与 v1 残留模块 |

v1 graph-session 运行时状态读取器及其 compaction 与 `monitor` 界面、四个示例协作角色也一并删除。v1.9.0 的 `role.yaml` 里不再有任何声明式协作字段，也没有自动转换器。

## 现在用什么

多代理编排只跑命令式（imperative）`graph_*` 引擎：`graph_create` 建图 → `graph_add_node` 加节点 → `graph_add_edge` 连边 → `graph_add_loop` 声明有界循环组 → `graph_run` 启动；`graph_status` 观测、`graph_approve` 审批、`graph_cancel` 取消。节点是角色无关的 `{agent, prompt}` 元组，完整用法见[图工作流](/02-Guide/graph-workflows)。

## 迁移对照要点

旧配置到新写法的四条要点（v0.x → v1.9.0 的完整变更清单见[迁移对照](/06-Appendix/migration)）：

- `topology` → `graph_create` + `graph_add_node` + `graph_add_edge` 手工搭出同一拓扑。
- `agents` → 每个 `graph_add_node` 的 `agent` 字段。
- `flow` → `graph_add_edge`，按需指定 `type`（`always` / `on_signal` / `on_condition`）。
- `max_iterations` 与 `termination` → `graph_add_loop` 的 `max_traversals` 硬上限，配合 `graph_status` 观测与 `graph_cancel` 终止。

迁移是配置改写，不是自动转换：rolebox 没有自动迁移子命令，删掉 `collaboration:` 块后按图文档手写。

## 下一步

- [迁移对照](/06-Appendix/migration) — v0.x → v1.9.0 的破坏性变更清单与升级指南
- [终止条件（已移除）](/04-Advanced/termination-conditions) — 终止子系统的移除范围与仍生效的终止语义
- [图工作流](/02-Guide/graph-workflows) — 用 `graph_*` 工具编写现行多代理工作流
