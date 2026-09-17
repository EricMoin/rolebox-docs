---
title: 终止条件（已移除）
description: 声明式终止子系统的移除范围，以及 v1.9.0 仍生效的五类终止语义 — 硬上限、收敛退出、停滞升级、重试超时与级联取消
---

# 终止条件（Termination Conditions，已移除）

终止条件曾是 `role.yaml` 的 `collaboration:` 块里的一节：用 `any_of` / `all_of` 组合循环退出规则。**v1.8.0 起声明式终止子系统被整体移除**，本页记录移除范围，以及 v1.9.0 仍然生效的终止语义。

> 前置：[迁移对照](/06-Appendix/migration)｜相关：[协作图（已移除）](/02-Guide/collaboration-graph)、[图执行引擎](/04-Advanced/graph-engine)

## 移除了什么

v1.8.0 删除了下列终止相关对象，此后不再有任何声明式终止配置——终止只发生在命令式 `graph_*` 引擎内部：

| 类别 | 被删除的对象 |
|---|---|
| 配置字段 | `collaboration:` 的 `termination`（`any_of` / `all_of` 组合条件） |
| 类型词汇表 | `TerminationDecl` / `TerminationCondition` / `LoopCondition` / `TerminationConfig` |
| 扩展点 | `termination_conditions` |
| 工具参数 | `graph_add_loop` 的 `termination` 参数 |
| 代码 | v1 残留的 `termination*` 模块、异步收敛评估与终止配置解析器 |

## 现在仍存在的终止语义

五类机制取代了原来的声明式终止规则：

| 机制 | 触发 | 结果 |
|---|---|---|
| 循环组硬上限 | `graph_add_loop` 的 `max_traversals`（唯一必需上限，整数 ≥ 1）耗尽后仍收到 `revise_needed` | 节点升级为 escalate，携带 `{ reason: "max_traversals exhausted", unresolved, traversals }` |
| 收敛退出 | 循环成员发出 `answer` | 循环自然结束，只走前向边，不消耗遍历次数，陈旧追踪器重置 |
| 停滞升级 | 连续 2 次（`CONSECUTIVE_STALE_THRESHOLD`）收敛输出完全相同 | 节点升级为 escalate，理由 `"stuck"`，不再消耗遍历次数 |
| 节点重试与超时 | `timeout_ms`（非负；`0` 表示关闭陈旧看门狗）到期，或节点 escalate 后重试预算未耗尽 | 超时按超时终态处理；有预算时节点重新标记为 `ready`，由引擎再次执行 |
| 级联取消 | `graph_cancel` 取消整图 / 单节点 / 整个循环组，`cascade: true` 时沿边传给全部下游 | 返回引擎实际取消的节点 id；循环组目标默认 `cascade: true`，裸 `node_id` 默认 `false` |

生效的重试预算是 `budget.max_retries` 与任一入边／出边 `retry.max` 的较大值；节点顶级字段与 `budget` 内的同名字段等价，运行时只有一份。

引擎的静止裁决是第六类语义，表现为 `graph_status` 上的阶段变化而不是可配项：无 running / ready 且无 blocked、无 pending 时阶段推进 `complete`；仍有 blocked 时发出 blocked 终止事件，等待人工批准；仍有 pending 且永不可满足（死锁）时，pending 节点全部升级为 escalate（理由 `graph deadlock: no active upstream can satisfy pending node(s)`），随后进入 `complete`。

`graph_add_loop` 的 `mode` 还有一个真实边界：`inherit` 是实际语义（轮次在同一份 engine state 内重新派发），`fresh` 不支持——传入即返回显式错误，需要会话隔离时改用每轮一张独立的图。级联取消是人工监控与干预控制，不用于 agent 自我取消；循环组内部另有一条取消路径——收敛节点的 join 失败时，仍在 pending 的上游节点被退役为 `cancelled → done`。

引擎内部如何裁决这些路径（静态判定、信号传播、重试入口）见[图执行引擎](/04-Advanced/graph-engine)。

## 下一步

- [迁移对照](/06-Appendix/migration) — v0.x → v1.9.0 的破坏性变更清单与升级指南
- [图工作流](/02-Guide/graph-workflows) — 用 `graph_*` 工具编写现行多代理工作流
- [图执行引擎](/04-Advanced/graph-engine) — 节点生命周期、信号传播与级联取消
