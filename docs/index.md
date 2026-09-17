---
layout: home
title: Rolebox 文档
description: rolebox v1.9.0 文档首页：教程、指南、参考、内部实现、贡献与附录的导航地图。

hero:
  name: "Rolebox"
  text: "AI Agent 编排框架"
  tagline: YAML 角色 · 图执行引擎 · 持久记忆
  image:
    src: /logo.svg
    alt: Rolebox
  actions:
    - theme: brand
      text: 开始教程
      link: /02-Guide/getting-started
    - theme: alt
      text: 参考
      link: /03-Reference/role-yaml
---

## rolebox 是什么

rolebox 是一个 harness 无关的 AI agent 编排框架：用 `role.yaml` 定义角色、技能、函数与子代理，用命令式图引擎把多个角色编排成一条工作流，并给代理装上跨会话的持久记忆。它接入 opencode / pi / dsh 三个 harness，不需要编写代码。

## 给谁看

- **第一次用 rolebox 的人**：从[教程总览与学习路径](/02-Guide/getting-started)开始，七章走完「安装 → 角色 → 团队 → 编排」。
- **已经跑通、要独立做事的人**：按「我要做 X」直接查[指南](/02-Guide/create-a-role)。
- **要精确语义的人**：查[参考](/03-Reference/role-yaml)里的字段、参数与退出码。
- **改 rolebox 源码的人**：先读[内部实现](/01-Overview/architecture-overview)，再看[贡献](/05-Contributing/development-setup)。

## 文档地图

| 分组 | 读者 | 任务 |
|---|---|---|
| [01 教程](/02-Guide/getting-started) | 第一次用 rolebox 的人 | 从零到一个能干活的多代理团队 |
| [02 指南](/02-Guide/create-a-role) | 已跑通教程、要独立做事的用户 | 按「我要做 X」查配方 |
| [03 参考](/03-Reference/role-yaml) | 需要精确语义的人 | 查字段、查参数、查退出码 |
| [04 内部实现](/01-Overview/architecture-overview) | 贡献者 / 需要理解引擎行为的进阶用户 | 理解「为什么这样工作」 |
| [05 贡献](/05-Contributing/development-setup) | 改 rolebox 源码的人 | 搭建环境、提交变更 |
| [06 附录](/06-Appendix/glossary) | 所有人 | 术语表、源码索引、迁移对照 |

## 三步跑通

```bash
npm install rolebox          # 在 opencode 配置目录内安装；pi / dsh 见教程 01
rolebox init code-reviewer -y
rolebox sync opencode
```

```text
应看到（rolebox init 的输出）：
✓ Created standard role at <你的目录>/code-reviewer
```

完整走查见[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)；只要速查表见[三步速查](/01-Overview/quick-start)。
