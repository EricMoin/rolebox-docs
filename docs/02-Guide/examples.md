---
title: 示例目录
description: rolebox 仓库 examples/ 的 7 个示例 — 名称、教什么、对应教程章节与仓库路径
---

# 示例目录（Examples）

rolebox 仓库的 `examples/` 下有 7 个示例：5 个角色目录与 2 个支撑示例（自定义 Hook 模块、dsh 平台补丁）。本页是它们的索引，逐步走查见对应的教程章节与指南页。早期版本里的四个协作示例角色已随声明式多代理子系统一起移除，示例总数因此为 7；移除范围见[迁移对照](/06-Appendix/migration)。

> 相关：[教程总览与学习路径](/02-Guide/getting-started) — 七章教程的入口｜[创建角色](/02-Guide/create-a-role) — 自己写一个角色目录｜[自定义 Hook](/02-Guide/custom-hooks) — Hook 模块的完整 API

## 示例一览

所有示例位于 [rolebox/examples](https://github.com/EricMoin/rolebox/tree/main/examples)。

| 示例 | 教什么 | 对应教程章节 | 仓库路径 |
|---|---|---|---|
| code-reviewer | 完整角色目录：`role.yaml` + 角色级技能 + 自定义函数 + 权限白名单 | [教程 02](/02-Guide/tutorial/02-first-role)、[教程 03](/02-Guide/tutorial/03-functions) | `examples/code-reviewer/` |
| tech-writer | 最小可用角色：7 行 `role.yaml`，只有 name / description / prompt 加一个全局技能 | [教程 02](/02-Guide/tutorial/02-first-role) | `examples/tech-writer/` |
| team-lead | 两种子代理声明：内联 `subagents:` 与文件式 `subagents/{name}/role.yaml`，以及字段继承 | [教程 04](/02-Guide/tutorial/04-team) | `examples/team-lead/` |
| hooks | 自定义 Hook：`onToolAfter` 拦截工具调用后用 `ctx.inject()` 注入提示 | —（见[自定义 Hook](/02-Guide/custom-hooks)） | `examples/hooks/` |
| review-team | 评审回环的两名参与者（Coder / Reviewer），流程由 `graph_*` 工具在运行时表达 | [教程 04](/02-Guide/tutorial/04-team)、[教程 05](/02-Guide/tutorial/05-graph) | `examples/review-team/` |
| review-team-custom | 三人线性流水线（Researcher → Writer → Editor）的参与者声明 | [教程 05](/02-Guide/tutorial/05-graph) | `examples/review-team-custom/` |
| dsh | dsh 平台集成：向 profile 的 `cordis.patch.yml` 插入一行 rolebox 插件 | —（见[平台与 Harness](/01-Overview/platform-harnesses)） | `examples/dsh/` |

## 怎么用

- **角色示例可整目录复制**：表中前三个与两个 review-team 示例都含 `role.yaml`，拷进你的角色目录再按需改写即可。
- **`code-reviewer/` 是文件布局的样板**：`skills/review-checklist/SKILL.md` 演示角色级技能，`functions/plan.md` 演示自定义函数。
- **`team-lead/` 同时演示两种子代理写法**：`role.yaml` 里的内联 Implementer，以及 `subagents/researcher/` 下自带技能的文件式子代理。
- **两个支撑示例不是角色目录**：`hooks/no-console-log.js` 要在 `role.yaml` 的 `hooks.custom` 中注册；`dsh/cordis.patch.yml` 要复制进 dsh profile。
- **参与者不等于流程**：两个 review-team 示例只声明有哪些子代理，评审回环或线性流水线由运行时建图表达。

## 与教程的分工

逐示例的代码走查不在本页重复：`code-reviewer` 的完整构建是[教程 02](/02-Guide/tutorial/02-first-role)与[教程 03](/02-Guide/tutorial/03-functions)的主线，`review-team` 的团队与图编排是[教程 04](/02-Guide/tutorial/04-team)与[教程 05](/02-Guide/tutorial/05-graph)的主线；其余示例按上表的链接跳转。
