---
title: 01 安装并跑通第一个角色
description: 教程第 01 章：安装 rolebox、用 rolebox init 创建 code-reviewer，并让 harness 加载它。
---

# 01 安装并跑通第一个角色（Install and Run）

本章把 rolebox 装进你的 harness，并让第一个角色 `code-reviewer` 跑起来。走完你会得到一条可以重复执行的最小链路：装插件 → 建角色 → 在 harness 里对话。

> 前置：无，本教程从零开始｜下一章：[02 让角色懂你的项目](/02-Guide/tutorial/02-first-role)｜安装矩阵：[平台与 Harness](/01-Overview/platform-harnesses)

## 本章造什么

整条教程结束时，你会有一个能评审代码的团队：父角色 `code-reviewer` 带一个技能、一份引用文档和一个自定义函数，另有 `coder`、`reviewer`、`doc-writer` 三个子代理，最后由图引擎串成流水线。这一章只造第一块：一个能对话的角色。

**角色（role，用 `role.yaml` 声明、由 harness 在启动时加载的代理定义）** 是 rolebox 的基本单位。本教程用 opencode 作主线，pi 与 dsh 的差别只在安装命令与目录，见[平台与 Harness](/01-Overview/platform-harnesses)。

## 第 1 步：安装 rolebox

rolebox 是一个 **agent harness 插件（plugin，装进 harness 配置目录、由 harness 启动时加载的扩展包）**。opencode 的安装命令是在它的配置目录里 `npm install rolebox`：

```bash
cd ~/.config/opencode && npm install rolebox
```
```text
应看到（示例输出，包数量与耗时随 npm 版本、网络环境略有差异）：
added 83 packages in 22s
```

另外两个 harness 各一行：

- pi：`pi install npm:rolebox`（想在项目里安装用 `pi install -l npm:rolebox`）
- dsh：`dsh plugin --profile <name> add rolebox`

opencode 还必须在配置里声明插件，否则它不会被加载：

```jsonc
// ~/.config/opencode/opencode.jsonc
{ "plugin": ["rolebox"] }
```

## 第 2 步：创建 code-reviewer

角色目录决定 harness 去哪里找角色：`<会话工作目录>/rolebox/` 存在时优先，否则用 harness 的全局角色目录（opencode 是 `~/.config/opencode/rolebox`）。本教程把角色放进练习项目 `~/rolebox-lab`，随项目走，也不污染全局配置：

```bash
mkdir -p ~/rolebox-lab/rolebox && cd ~/rolebox-lab/rolebox
rolebox init code-reviewer -y
```
```text
应看到：
✓ Created standard role at /Users/<你>/rolebox-lab/rolebox/code-reviewer
Run `rolebox sync opencode` to deploy
```

`-y` 跳过交互向导、使用默认的 `standard` 模板，角色目录建在当前目录下的 `code-reviewer/`。

确认生成了什么：

```bash
ls code-reviewer
```
```text
应看到（顺序随 ls 的区域设置略有差异）：
functions  PROMPT.md  role.yaml  skills
```

- `role.yaml` —— 角色配置：名称、描述、提示词文件，以及技能与函数清单。
- `PROMPT.md` —— 系统提示词，角色的「人格」与工作约定；后面每一章都会改它。
- `skills/` —— 技能（skill，按需加载、命中场景才注入上下文的知识模块）目录，模板只放了一个 `README.md` 占位。
- `functions/` —— 函数（function，改变角色行为方式的指令单元）目录，同样是 `README.md` 占位。

`standard` 模板只生成这四样，**没有** `references/` 目录；[02 让角色懂你的项目](/02-Guide/tutorial/02-first-role)会按需创建它。

## 第 3 步：让 harness 加载它

角色已经在会话工作目录下的 `rolebox/` 里，所以从练习项目根目录启动 harness 即可：

```bash
cd ~/rolebox-lab && opencode
```
```text
应看到（示例输出，随 harness 与版本不同略有差异）：
代理列表里出现 code-reviewer
```

选中 `code-reviewer` 开始会话。如果你更希望角色对所有项目生效，把同样的 `rolebox init` 放进全局角色目录（opencode 是 `~/.config/opencode/rolebox`，pi 与 dsh 见[平台与 Harness](/01-Overview/platform-harnesses)）即可；两处同名时，会话工作目录下的优先。

## 第 4 步：问它一个问题

在会话里问它：

```text
这个仓库的编码规范是什么？
```

它会用 `PROMPT.md` 的语气回答，但答不出你的规范——因为 `PROMPT.md` 现在还是模板里的 `TODO`：

```text
示例输出（随模型与 harness 不同会有差异）：
code-reviewer：我还没有拿到这个仓库的编码规范，role.yaml 里也没有相关约定……
```

记住这一刻——这正是下一章要修的东西。

## rolebox sync 与 rolebox list 管什么

这两个子命令面向**从注册中心安装的角色**，而不是你 `init` 出来的本地角色：`rolebox install <角色名>` 下载角色并登记到安装锁文件，`rolebox sync <harness>` 把锁文件里的条目部署到该 harness 的角色目录，`rolebox list` 列出锁文件内容。本地角色不经过锁文件，放进角色目录就已经生效，所以这两条命令现在给出的是空结果——这是正常的，不是出错：

```bash
rolebox list
rolebox sync opencode
```
```text
应看到（还没有安装过注册中心角色时）：
No roles installed. Run `rolebox install <role>` to get started.
Synced 0 roles to opencode
```

想让锁文件里有内容，用 `rolebox install <角色名>` 装一个注册中心角色，见[注册中心](/03-Reference/registry)与[CLI 参考](/03-Reference/cli)。

## 你现在拥有什么

- 一个装好 rolebox 插件的 harness；
- `~/rolebox-lab/rolebox/code-reviewer/`，里面有 `role.yaml`、`PROMPT.md`、`skills/`、`functions/`；
- harness 里可以选择 `code-reviewer` 并对话；
- `rolebox install` / `sync` / `list` 各自负责什么。

下一章 [02 让角色懂你的项目](/02-Guide/tutorial/02-first-role)：把项目约定写进 `PROMPT.md`，再加一个按需加载的技能。
