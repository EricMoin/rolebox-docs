---
title: 教程总览与学习路径
description: rolebox 教程入口：四条学习路径、七章教程地图，以及动手前的准备。
---

# 教程总览与学习路径（Getting Started）

rolebox 把一个通用的 AI 编码助手变成你用 YAML 定义的团队：每个角色带自己的提示词、技能与函数，多代理流程由**图执行引擎（graph execution engine，运行时按节点与边推进工作流的调度器）**编排。这一页帮你决定从哪条路径进入，并给出七章教程的地图。

## 四条学习路径

| 你的目标 | 从这里开始 | 读完你会 |
|---|---|---|
| 只想用现成角色 | [三步速查](/01-Overview/quick-start) → [注册中心](/03-Reference/registry) | 装好插件，把一个角色跑起来 |
| 想写自己的角色 | [教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install) → [创建角色](/02-Guide/create-a-role) | 会写 PROMPT、技能、引用文档与函数 |
| 想编排多代理 | [教程 04 把角色变成团队](/02-Guide/tutorial/04-team) → [图工作流](/02-Guide/graph-workflows) | 用图工具搭出一条带审批门的流水线 |
| 想贡献源码 | [开发环境搭建](/05-Contributing/development-setup) → [贡献指南](/05-Contributing/contributing) | 本地构建、跑测试、提交改动 |

## 教程地图

七章走完，你会得到一个能真正干活的代码评审团队：父角色 `code-reviewer`，加上 `coder`、`reviewer`、`doc-writer` 三个子代理，最后由图引擎串成「实现 → 评审 → 定稿」的流水线。每一章都以「读者输入什么 / 应该看到什么」组织，命令都可以直接复制。

| 章 | 你会做什么 | 完成后你拥有 |
|---|---|---|
| [01 安装并跑通第一个角色](/02-Guide/tutorial/01-install) | 安装 rolebox，创建 `code-reviewer`，在 harness 里对话 | 一个能跑起来的角色 |
| [02 让角色懂你的项目](/02-Guide/tutorial/02-first-role) | 写 `PROMPT.md`，加一个技能与一份引用文档 | 懂你项目约定的角色 |
| [03 用函数改变行为](/02-Guide/tutorial/03-functions) | 激活内置函数，再写一个自定义函数 | 能切换工作模式的角色 |
| [04 把角色变成团队](/02-Guide/tutorial/04-team) | 在 `role.yaml` 里声明三个子代理 | 一个父子代理团队 |
| [05 用图引擎编排团队](/02-Guide/tutorial/05-graph) | 用 `graph_*` 工具建图并运行 | 一条自动流水线 |
| [06 加上审批门与有界循环](/02-Guide/tutorial/06-approval-and-loop) | 加 `needs_approval` 与 `max_traversals` | 有人工闸门、不会失控的流水线 |
| [07 让代理记住你](/02-Guide/tutorial/07-memory) | 用 `rolebox memory` 观察记忆库 | 跨会话记得你决策的代理 |

## 前置条件

- **一个 harness**：opencode、pi 或 dsh。教程主线走 opencode，另外两个的差异只在安装命令与目录，见[平台与 Harness](/01-Overview/platform-harnesses)。
- **Node.js 与 npm**：rolebox 以 npm 包发布，opencode 与 dsh 的安装都走 npm。
- **一个可以随意改动的练习目录**：教程在 `~/rolebox-lab` 下建角色，不必碰你现有的项目。
- **不需要**预先了解图引擎或函数系统：术语在首次出现处就地解释，全站定义表见[术语表](/06-Appendix/glossary)。

## 贡献 rolebox 源码

本页原先附带的贡献者指南（前提条件、克隆、构建、测试、调试）已整体移交[开发环境搭建](/05-Contributing/development-setup)；贡献流程、提交信息规范与发布流程见[贡献指南](/05-Contributing/contributing)。

## 下一步

从[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)开始。只有五分钟？先走[三步速查](/01-Overview/quick-start)。
