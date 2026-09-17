---
title: 04 把角色变成团队
description: 教程第 04 章：在 role.yaml 里用 subagents 声明 coder、reviewer、doc-writer 三个子代理，让父角色把评审任务派出去。
---

# 04 把角色变成团队（Subagents）

这一章把单个 `code-reviewer` 扩成一个能分工的团队：父角色留在原位，另外声明 `coder`、`reviewer`、`doc-writer` 三个**子代理（subagent，父角色可以委托任务的子级代理，拥有自己的系统提示词与独立会话）**。走完这一章，父角色能把一件事拆给三个人并汇总。

> 前置：[教程 03 用函数改变行为](/02-Guide/tutorial/03-functions)（`~/rolebox-lab/rolebox/code-reviewer`，已有技能、引用文档与自定义函数）｜下一章：[05 用图引擎编排团队](/02-Guide/tutorial/05-graph)｜字段全表：[子代理](/02-Guide/subagents)

## 本章造什么

三名子代理各管一段：`Coder` 实现、`Reviewer` 审查、`Doc-Writer` 定稿。声明它们只是往 `role.yaml` 里加一段 YAML；父角色怎么把活派出去、怎么收回结果，是第 05 章的主题。这一章先让团队被注册，再让你看到父角色眼里的它。

## 第 1 步：把 subagents: 写进 role.yaml

打开 `~/rolebox-lab/rolebox/code-reviewer/role.yaml`，在顶层（与 `name:`、`skills:`、`functions:` 同级）加入这段：

```yaml
subagents:
  - name: Coder
    description: 按需求实现代码改动
    prompt: |
      You are a senior developer. Write clean, testable code.
      改动尽量小、可回滚；回复里列出改动的文件与验证方式。
  - name: Reviewer
    description: 按项目约定审查代码
    prompt: |
      You review code for correctness, style, and edge cases.
      逐条给出「问题 / 位置 / 建议」；没有发现问题时也明确说明。
  - name: Doc-Writer
    description: 把改动写成面向使用者的说明
    prompt: |
      You write user-facing documentation for code changes.
      只写读者需要知道的内容，不重复实现细节。
```

三个字段各有分工：

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 必填。显示名，同时决定子代理 id：名字转小写、空格换成连字符，再拼成 `<角色 id>--<名字>`，例如 `code-reviewer--coder` |
| `description` | string | 父角色选择子代理时看到的一句话说明 |
| `prompt` | string | 必填，也可以改用 `prompt_file` 指向一份提示词文件 |

子代理还接受与角色相同的可选字段（`model`、`temperature`、`permission`、`tools`、`skills`、`functions` 等）。**没有显式写出的字段沿用父角色的取值**，可继承的是 `model`、`color`、`variant`、`temperature`、`top_p`、`permission`、`tools`。文件式声明（`subagents/<名字>/role.yaml`）与内联声明可以混用，完整字段表见[子代理](/02-Guide/subagents)。

## 第 2 步：让改动生效

角色目录在 harness 启动时读取，所以重启会话即可（[教程 01](/02-Guide/tutorial/01-install) 讲过：本地角色不经过锁文件）。`rolebox sync` 面向的是从注册中心安装的角色，本地角色调用它会得到零条：

```bash
rolebox sync opencode
```
```text
应看到（本地角色不在锁文件里时）：
Synced 0 roles to opencode
```

重启后，三个子代理会随角色一起注册进 harness：它们是 `mode: subagent` 的代理，由父角色派活调用。

## 第 3 步：看父角色眼里的团队

新建会话、选中 `code-reviewer`，问它：

```text
你现在有哪几个子代理？分别负责什么？
```

rolebox 会把每个子代理的 id、名字与说明注入父角色的系统提示词（`<available_subagents>` 段），父角色据此认人：

```text
应看到（示例输出，措辞随模型变化）：
我有三个子代理：
- code-reviewer--coder —— 按需求实现代码改动
- code-reviewer--reviewer —— 按项目约定审查代码
- code-reviewer--doc-writer —— 把改动写成面向使用者的说明
```

如果三个都没出现，回到第 1 步检查缩进与必填字段：解析器对不合法的条目**只记日志、不报错**（缺 `name`、缺 `prompt`/`prompt_file`、`name` 里含 `--` 的条目都会被静默丢掉）。

## 第 4 步：派一个评审任务

现在给父角色一件真实的事，让它自己拆：

```text
在 ~/rolebox-lab 下写一个 scripts/hello.sh，打印一行问候。
把它跑成一条流水线：coder 先实现，reviewer 接着审，
doc-writer 最后写一段面向使用者的说明。
每一步都保留产出，三个人都跑完再给我汇总。
```

父角色不会同时扮演三个角色：它把每件事建模成一个**图节点（node，一次派发单元，形状是 `{agent, prompt}` 元组）**，交给图引擎派给对应的子代理。这个回合里你只看到它把图跑起来（`graph_run` 立即返回、不等待），回合结束后引擎注入 `[GRAPH COMPLETE]`，下一回合它拿到三份产出，再写成给你的汇总：

```text
应看到（示例输出，随模型与任务变化）：
父角色（第 1 回合）：已把任务拆成 implement → review → document 三个节点，图已运行。
<system-reminder>
[GRAPH COMPLETE]
graph: hello-script
phase: complete
nodes: completed=3
</system-reminder>
父角色（第 2 回合）：汇总——coder 写了 scripts/hello.sh；reviewer 指出缺少可执行权限；
doc-writer 的说明是「运行 bash scripts/hello.sh 即可看到问候」。
```

父角色这一回合究竟调用了哪几个工具、每个工具返回什么、结果怎么读回来，是下一章的全部内容。

## 常见错误

- **`subagents:` 缩进错位**：它必须是 `role.yaml` 的顶层键，列表项再缩进一级；写进 `prompt:` 块里就只是一段文字。
- **漏了 `prompt` 或 `prompt_file`**：该条目被静默跳过，父角色眼里没有这个人。
- **`name` 里带 `--`**：`--` 是 id 的分隔符，含它的名字会被丢掉——角色目录名（角色 id）同样不能含 `--`。
- **两个子代理同名**：后一个定义覆盖前一个，你只会得到三个人里的两个。
- **改完 `role.yaml` 不重启**：角色在启动时解析一次，当前会话不会热加载。
- **指望子代理记得你的对话**：子代理是独立会话，只看得到父角色交给它的提示词。

## 你现在拥有什么

- 一个父角色 `code-reviewer`，带技能、引用文档与自定义函数（第 02–03 章的产物）；
- 三名已注册的子代理：`code-reviewer--coder`、`code-reviewer--reviewer`、`code-reviewer--doc-writer`；
- 一句能让父角色自己拆活的提示词模板，以及「派活 → 汇总」两回合的节奏感。

下一章 [05 用图引擎编排团队](/02-Guide/tutorial/05-graph)：把这条委托链路变成一张看得见的图，并学会正确地读回结果。

## 备注

- 子代理可以再声明 `subagents:` 形成嵌套团队；嵌套声明与 `subagents/<名字>/role.yaml` 文件式声明按名字合并，同名时内联优先。
- 文件名与目录名决定角色 id，角色 id 与子代理名字共同决定子代理 id——改名等于改 id，调用方（包括图节点里的 `agent` 字段）都要跟着改。
