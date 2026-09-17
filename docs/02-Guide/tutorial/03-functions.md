---
title: 03 用函数改变行为
description: 教程第 03 章：用 |name| 激活内置函数，再写 review 与 security-scan 两个自定义函数，并搞清 functions 的合并语义。
---

# 03 用函数改变行为

技能给角色知识，函数给角色行为模式。本章先用一个内置函数看清 `|name|` 到底改变了什么，再写两个自定义函数（`review`、`security-scan`），最后弄清 `functions:` 的合并语义——它不是在挑选要启用哪些函数，而是在默认集合上追加。

> 前置：[教程 02 让角色懂你的项目](/02-Guide/tutorial/02-first-role)｜相关：[函数系统](/02-Guide/functions)｜[函数文件规范](/02-Guide/writing-functions)

## 函数与激活

- **函数（function，一段带 frontmatter 的 Markdown 指令；被激活后整段进入系统提示的 `<active_functions>` 区块）** 改变的是行为模式：进入计划模式、进入评审模式、进入执行模式。
- **激活（activation，在消息的行首写 `|name|`；标记会从消息里被剥掉，函数对当前会话生效）**。

rolebox 自带四个内置函数文件：`execute`、`loop`、`memory`、`plan`；默认合并进每个角色的是其中三个：`plan`、`execute`、`loop`。`memory` 要用得自己声明。

角色解析出的函数会以 `<available_functions>` 区块出现在系统提示里，说明句是「Use |function_name| or |function_name:params| syntax to activate them.」；一旦激活，该函数的正文转而在 `<active_functions>` 区块里出现，说明句变成「These functions are currently active for this session. Follow their instructions.」

## 步骤 1：激活一个内置函数

`rolebox init` 生成的 `role.yaml` 里已经声明了三个内置函数：

```bash
cd ~/rolebox-lab/code-reviewer
grep -A 4 '^functions:' role.yaml
```

```text
应看到：
functions:
  - plan
  - execute
  - loop
```

在 harness 里发一条以 `|plan|` 开头的消息：

```text
在 harness 里你会看到（示意）：
你发送：      |plan| 看一下这次改动，给我一个实施计划
模型收到：    看一下这次改动，给我一个实施计划
系统提示新增：
  <active_functions>
    These functions are currently active for this session. Follow their instructions.
    <function>
      <name>plan</name>
      <description>Strategic planning — investigate, then produce a verifiable plan artifact, wait for approval</description>
      <instructions>You are now in PLANNING mode. Do not change the codebase yet. …</instructions>
    </function>
  </active_functions>
观察到的行为：先调查、给出一份草稿计划并停下等确认，而不是直接动代码。
```

两件事值得记住：`|plan|` 必须在**行首**（行中间的竖线不是激活语法）；标记本身会从消息正文里消失。实验完开一个新会话，避免计划模式影响后面的步骤。

## 步骤 2：写第一个函数 review

内置函数是别人写好的指令，自定义函数就是你在角色目录里放一个 Markdown 文件。新建 `functions/review.md`：

```markdown
---
name: review
description: 进入代码评审模式：按严重度输出发现，不改代码
---

You are now in REVIEW mode. Keep these rules until the session ends:

1. Read the code around a hunk before judging it.
2. Group findings as Blocking / Should fix / Nit.
3. Every finding names the file, quotes the smallest relevant hunk, and states the smallest fix.
4. Do not edit files. Propose the patch in your message instead.
5. If the change is clean, say so in one line.
```

函数按名字解析，优先级是「角色目录的 `functions/<name>.md`」→「全局函数目录」→「内置函数目录」，第一个存在的文件生效。然后要在 `role.yaml` 的 `functions:` 里加上这个名字，角色才会解析到它：

```yaml
name: code-reviewer
description: A standard role created with rolebox init
prompt_file: PROMPT.md
skills:
  - review-checklist
functions:
  - plan
  - execute
  - loop
  - review
```

```bash
cd ~/rolebox-lab/code-reviewer
rolebox sync opencode
```

```text
应看到（示例输出，随环境略有差异）：
Synced 0 roles to opencode
```

本地角色不在安装锁文件里，所以这里是 0（原因见 [教程 02](/02-Guide/tutorial/02-first-role)）。重启 opencode 后发一条 `|review|` 开头的消息：标记被剥掉，`<active_functions>` 里出现你写的那五条规则，输出格式从「边聊边看」变成固定分级的评审。

## 步骤 3：再加一个带参数的 security-scan

第二个函数演示参数。新建 `functions/security-scan.md`：

```markdown
---
name: security-scan
description: 对改动做安全扫描，按严重度输出发现；level 取 standard 或 strict
params:
  level: standard
---

You are now in SECURITY SCAN mode (level: {level}). Inspect every changed file for:

- injection from untrusted input (shell, path, query);
- secrets committed to the tree;
- missing authorization checks on new endpoints;
- unsafe deserialization or eval of external data.

Report each finding as severity, file, the vulnerable line, and the fix.
At level strict, also flag missing input-length limits and missing timeouts.
If nothing is found, say "no security findings" and stop.
```

`params` 里的默认值会在激活时替换正文中的 `{level}`。三种激活写法都支持：

```text
在 harness 里你会看到（示意）：
|security-scan|                 → level 取 frontmatter 里的默认值 standard
|security-scan:strict|          → 位置参数，按 params 的声明顺序映射到 level
|security-scan level=strict|    → 具名参数，优先级高于位置参数
```

别忘了声明：在 `functions:` 末尾再加一行 `- security-scan`。

## 步骤 4：合并语义与移除函数

`functions:` 不是「这个角色要启用哪些函数」，而是**在默认集合之上追加**。解析时的算式是：

```text
实际启用的函数 = (默认集合 {plan, execute, loop} ∪ functions:) − disable_functions:
```

所以删掉 `functions:` 里的某一行并不会让函数消失——它可能仍来自默认集合；要从结果里移除，只能用 `disable_functions:`：

```yaml
functions:
  - plan
  - execute
  - loop
  - review
  - security-scan
disable_functions:
  - loop
```

三个默认名字即使从 `functions:` 里全部删掉也依然启用；反过来，`memory` 是内置函数文件却不在默认集合里，想用 `|memory|` 就必须在 `functions:` 中声明它。

## 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `\|name\|` 写了没反应 | 标记不在行首 | 把标记移到消息第一行的开头 |
| 函数文件写好了仍无法激活 | 文件存在，但没在 `functions:` 里声明 | 声明名字后重启 harness |
| 激活失败，消息里的标记却消失了 | 该名字对这个角色不可解析，标记仍会被剥掉 | 先确认声明名与文件名一致 |
| 删掉声明，函数却还在 | 它属于默认集合 | 用 `disable_functions:` 明确移除 |
| 提示里原样出现 `{level}` | 占位符既没有值也没有默认值 | 在 `params` 里给默认值，或激活时传参 |

## 你现在拥有什么

- `functions/review.md` 与 `functions/security-scan.md`：两个自定义行为模式；
- `|name|`、`:参数`、`key=value` 三种激活写法；
- `functions:` 的合并语义与 `disable_functions:` 的移除语义。

一个角色能做的事到此为止。下一章 [教程 04 把角色变成团队](/02-Guide/tutorial/04-team) 把它扩展成会分工的团队。
