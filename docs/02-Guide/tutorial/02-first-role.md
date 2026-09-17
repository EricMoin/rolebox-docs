---
title: 02 让角色懂你的项目
description: 教程第 02 章：给 code-reviewer 写 PROMPT.md、技能与引用文档，让它在评审代码时按需加载你的项目知识。
---

# 02 让角色懂你的项目

教程 01 让 `code-reviewer` 能跑起来，但它还不知道你的项目怎么做事。本章给它三类知识：一份每次都读的人格说明、一份按需加载的评审清单、一份用到才读的样式指南。做完之后，它会自己判断什么时候该加载哪一份。

> 前置：[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)｜相关：[技能系统](/02-Guide/skills)｜[引用文档](/02-Guide/references)

## 三种文件，三种进入上下文的时机

角色目录里的三类文件不是一回事，区别在**正文什么时候进入模型的上下文**：

| 文件 | 会话开始时注入的内容 | 正文何时进入上下文 |
|---|---|---|
| `PROMPT.md`（由 `role.yaml` 的 `prompt_file` 指定） | 全文 | 每次会话开始 |
| `skills/<name>/SKILL.md` | 只有 `name` 与 `description` | 模型调用技能工具时 |
| `references/*.md` | 只有 `name`、`path`、`description` | 模型读该文件时 |

这张表背后是同一个设计：**渐进式披露（progressive disclosure，先只告诉模型「有什么、什么时候用」，正文等真正需要时再取）**。模型的上下文很贵，一份 500 行的样式指南只有在评审格式问题时才值得读进去。

- **技能（skill，一份带 frontmatter 的 `SKILL.md`，正文在被调用时才进入上下文）** 适合「一类任务的做法」：清单、流程、检查表。
- **引用文档（reference，`references/` 目录下的 `.md`，默认自动发现）** 适合「需要时才查的知识」：样式指南、接口约定、领域术语。

## 步骤 1：写 PROMPT.md

`PROMPT.md` 是角色的人格，每次会话原样进入系统提示。把 `code-reviewer/PROMPT.md` 换成下面这份（内容属于你的项目，按团队习惯改）：

```markdown
# code-reviewer

You review changes in this repository. You review diffs, not whole codebases.

## How to review

- Read the code around a hunk before judging it; a diff alone hides intent.
- Report findings by severity, with the file name and the smallest relevant hunk.
- Propose fixes; do not apply them unless asked.
- If a change is clean, say so in one line. Never invent findings to look useful.

## Output format

1. **Blocking** — correctness, security, data loss.
2. **Should fix** — missing tests, unclear naming, duplicated logic.
3. **Nit** — style only, one line each.

## Project knowledge

A review checklist skill and a style guide reference ship with this role.
Load the checklist for every review; read the style guide only when the change
touches formatting or naming.
```

## 步骤 2：写技能 review-checklist

技能是一个目录加一个 `SKILL.md`。frontmatter 里的 `description` 会随技能名一起注入系统提示——它是「什么时候该加载我」的说明书，所以要写成触发条件；正文不会进去。下面是完整内容：

```markdown
---
name: review-checklist
description: 逐项评审改动的清单：正确性、安全、测试、可读性。评审代码时加载。
---

# Review Checklist

Work top to bottom. Stop at the first Blocking item and report it immediately.

## 1. Correctness

- Does the change do what its message claims?
- Are edge cases handled: empty input, one item, maximum size?
- Is the error path tested, not only the happy path?

## 2. Safety

- Is untrusted input validated before it reaches a shell, a path, or a query?
- Are secrets read from the environment instead of hard-coded?
- Does a new endpoint check authorization?

## 3. Tests

- Is there a test that fails without the fix?
- Would the test still pass if the fix were reverted?

## 4. Readability

- Can every new name be read aloud without explanation?
- Is this the smallest diff that solves the problem?

## Reporting

Group findings by severity, cite the file, quote the smallest relevant hunk.
```

## 步骤 3：声明技能并建好引用目录

技能不会自己生效，要在 `role.yaml` 的 `skills:` 里按名字声明；引用文档放进 `references/` 就够了，不需要声明。

```bash
cd ~/rolebox-lab/code-reviewer
mkdir -p skills/review-checklist references
test -d skills/review-checklist && test -d references && echo "directories ready"
```

```text
应看到：
directories ready
```

把 `role.yaml` 改成下面这样（`skills:` 从空列表变成一项）：

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
```

## 步骤 4：写引用文档 style-guide.md

引用文档与技能的区别在加载时机：技能是「做这类任务前先读」，引用是「需要那条知识时再读」。`references/style-guide.md` 给一个 `description` 就够了（不写时描述由文件名派生）：

```markdown
---
description: 本仓库的格式与命名约定。改动涉及格式或命名时阅读。
---

# Style Guide

- TypeScript: 2-space indent, single quotes, trailing commas.
- Files are kebab-case; exported types are PascalCase.
- A function does one thing. If you need "and" to describe it, split it.
- Comments explain why, never what.
- Every public function has a test with the same name.
```

## 步骤 5：同步，并让 harness 重新读取角色

本地角色目录的改动在 harness 重新读取后生效。`rolebox sync` 负责把 `rolebox install` 从注册中心装来的角色部署到 harness 的角色目录；团队里加入注册中心角色后，这一步是必须的。现在先跑一次：

```bash
cd ~/rolebox-lab/code-reviewer
rolebox sync opencode
```

```text
应看到（示例输出，随环境略有差异）：
Synced 0 roles to opencode
```

`Synced N roles` 里的 N 是 `~/.config/rolebox/rolebox.lock` 中已安装角色的数量。教程角色是本地目录，不在这个锁文件里，所以这里是 0——`rolebox sync` 部署的是 `rolebox install` 从注册中心装来的角色，不是本地创建的目录。

还有一条规则要记住：**opencode 只从「当前工作目录的 `rolebox/`」或「`~/.config/opencode/rolebox/`」发现角色，前者优先**。确认 `code-reviewer` 位于这两处之一，然后重启 opencode——重启后 rolebox 会重新扫描角色目录，重新构建提示。

## 步骤 6：在 harness 里验证

选中 `code-reviewer` 角色后，会话开始前 rolebox 会把技能与引用文档的**元数据**注入系统提示。你会看到（示意）：

```text
应看到（系统提示中注入的块）：
<available_references>
  Reference documents provide deep knowledge. Use the Read tool to load full content when needed.
  <reference>
    <name>style-guide</name>
    <path>/Users/you/rolebox-lab/code-reviewer/references/style-guide.md</path>
    <description>本仓库的格式与命名约定。改动涉及格式或命名时阅读。</description>
  </reference>
</available_references>

<available_skills>
  Skills provide specialized instructions. Use the skill tool to load when task matches.
  <skill>
    <name>review-checklist</name>
    <description>逐项评审改动的清单：正确性、安全、测试、可读性。评审代码时加载。</description>
    <scope>rolebox</scope>
    <location>/Users/you/rolebox-lab/code-reviewer/skills/review-checklist/SKILL.md</location>
  </skill>
</available_skills>
```

注意：清单正文和样式指南正文都**不在**这里，只有名字和一句话描述——这就是渐进式披露。当请求匹配上那句描述，模型会调用技能工具去取全文：

- opencode 与 dsh 用 `skill` 工具：`skill { name: "review-checklist" }`；
- pi 用 `load_role_skill` 工具：`load_role_skill { name: "review-checklist" }`。

两个工具都会返回 `SKILL.md` 的完整正文，外加这份技能目录下 `references/` 里的引用元数据。引用文档则由模型按需用读文件的工具打开，不经过技能工具。

现在发一段有问题的代码试试：

```text
在 harness 里你会看到（示意）：
你：Review this function for edge cases:

    def average(values):
        return sum(values) / len(values)

code-reviewer：先加载 review-checklist 技能，再逐项报告：
  Blocking — average([]) 抛 ZeroDivisionError；空输入应返回 0，或抛出带消息的异常。
  Should fix — 没有覆盖空输入的测试。
  命名与格式没有问题，已对照 style-guide。
```

关键在于顺序：它先取技能、再回答，而不是凭印象直接评审；只有当改动涉及格式或命名时，它才会去读 `style-guide.md`。

## 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| 角色完全不提技能 | `role.yaml` 的 `skills:` 里没有这个名字 | 声明名必须与技能目录名一致 |
| 技能从不被加载 | `description` 写成了「是什么」而不是「什么时候用」 | 改成触发条件，例如「评审代码时加载」 |
| 改了文件没反应 | harness 仍在用上一次解析的结果 | 重启 opencode，并确认角色目录在发现路径上 |
| 引用文档没进上下文 | 文件不在 `references/` 下，或缺少 `description` | 放进 `references/`，或补上 frontmatter |

## 你现在拥有什么

- `PROMPT.md`：角色的人格与输出格式；
- `skills/review-checklist/SKILL.md`：按需加载的评审清单；
- `references/style-guide.md`：用到才读的样式指南；
- 一个知道「什么时候该加载什么」的 `code-reviewer`。

知识与人格都有了，但它还只有一种行为模式。下一章 [教程 03 用函数改变行为](/02-Guide/tutorial/03-functions) 给它加上函数。
