---
title: 创建角色
description: 从最小可运行的 role.yaml 出发逐字段展开角色定义，并给出三个可直接粘贴的完整配方
---

# 创建角色（Create a Role）

一个 rolebox 角色就是一个目录加一份 `role.yaml`：YAML 声明这个代理是什么、能用哪些能力、能把工作派给谁，剩下的交给运行时。本页从最小可运行的配置开始，逐字段补齐，最后给出三个可直接粘贴的配方。

> 前置：[目录结构](/01-Overview/directory-structure)｜相关：[role.yaml 参考](/03-Reference/role-yaml)、[子代理](/02-Guide/subagents)、[图工作流](/02-Guide/graph-workflows)

## 最小可运行的 role.yaml

角色目录放在**角色根目录**下：项目里存在 `rolebox/` 就用它，否则用 harness 配置目录下的 `rolebox/`（opencode 为 `~/.config/opencode/rolebox/`）。角色 ID 就是目录名。

```bash
mkdir -p rolebox/copywriter
```
```text
应看到：命令无输出，rolebox/copywriter/ 目录被创建。
```

```yaml
# rolebox/copywriter/role.yaml
name: Copywriter
description: Writes concise, punchy copy.
prompt: |
  You are a copywriter. Short sentences. No jargon.
  Every word earns its place.
```

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 角色显示名，出现在代理列表里 |
| `description` | string | 是 | 一句话描述，harness 用它向其它代理介绍这个角色 |
| `prompt` | string | 二选一 | 系统提示词正文 |
| `prompt_file` | string | 二选一 | 指向提示词文件（相对角色目录），如 `PROMPT.md` |

`prompt` 与 `prompt_file` 至少要给一个：两个都没给时该角色会被整体跳过，日志里会写明原因。两个都给时以 `prompt_file` 为准；`prompt_file` 指向的文件读不到，角色同样会被跳过，不会回退到 `prompt`。

## 让改动生效

- **手工编写的角色**：保存文件后重启 harness。插件在启动时扫描角色根目录下的每一份 `role.yaml`，不需要安装命令。
- **从注册中心安装的角色**：`rolebox install <role>` 把它记入本机 lock 文件，再用 `rolebox sync <harness>` 把它符号链接进 harness 的角色目录。

```bash
rolebox sync opencode
```
```text
应看到：
Synced 1 roles to opencode
```
数字是本机已安装的角色数（一个都没装过时显示 `Synced 0 roles to opencode`）；`opencode` 可换成 `pi` 或 `dsh`。

## 逐字段展开

### mode — 角色以什么身份出现

```yaml
mode: subagent
```

| 取值 | 行为 |
|---|---|
| `primary`（默认） | 作为主代理出现在代理列表 |
| `subagent` | 只作为可委托的子代理，不主动出现在主列表 |
| `all` | 两种身份都可用 |

子代理被部署到 harness 时，`mode` 一律写成 `subagent`；要让它同时能当主代理用，就在父角色的 `subagents` 之外单独定义一个角色。

### 模型与采样

```yaml
model: gpt-4
temperature: 0.2
top_p: 0.95
variant: thorough
color: "#4CAF50"
```

| 字段 | 说明 |
|---|---|
| `model` | 模型标识；省略时用 harness 的默认模型，集中管理见[模型别名](/03-Reference/model-aliases) |
| `temperature` / `top_p` | 采样参数，取值范围分别是 0.0–2.0 与 0.0–1.0 |
| `variant` / `color` | 模型变体（配置风格）与界面颜色，按 harness 的支持程度生效 |

### 能力：技能与函数

```yaml
skills:            # 角色目录下 skills/ 里的技能
  - review-checklist
opencode_skills:   # harness 全局技能目录里的共享技能
  - humanizer
functions:
  - plan
  - review
disable_functions:
  - loop
```

`functions:` 是**合并**语义而不是替换：最终启用集合 = `plan`、`execute`、`loop` 三个内置函数 ∪ 你列出的函数（自动去重）。想移除内置函数，只能写进 `disable_functions`。技能与函数各自放在哪一层目录、按什么顺序解析，见[目录结构](/01-Overview/directory-structure)、[技能系统](/02-Guide/skills)与[函数系统](/02-Guide/functions)。

### 引用文档与子代理

```yaml
references:
  style-guide: references/style-guide.md
subagents:
  - name: Researcher
    description: Finds and synthesizes information
    prompt: You are a research specialist. Cite your sources.
```

`references/` 目录里的 Markdown 会被自动发现，`references:` 的显式声明与之**合并**：同名文件用显式声明补描述，也可以借此指向 `references/` 之外的文件。`subagents:` 只声明参与者，不声明流程；流程在运行时用图工具搭建，详见[子代理](/02-Guide/subagents)与[图工作流](/02-Guide/graph-workflows)。

### 权限

```yaml
permission:
  allow: [Read, Grep, Glob]
  deny: [Edit, Write, Bash]
tools:
  Bash: false
```

`permission.allow` / `permission.deny` 是工具名清单，rolebox 会把它转换成 harness 的逐工具权限配置（工具名转小写后映射为 `allow` / `deny`），真正的拦截由 harness 执行；`tools` 是「工具名 → 是否启用」的映射。

### 自动化：auto_activate 与 locked

```yaml
auto_activate:
  - review
locked: true
```

`auto_activate` 让这些函数在会话启动时直接处于激活状态，无需用户输入 `|name|`；`locked: true` 保证它们不会被状态迁移或用户意外关掉。

### 编排与调度两个键

```yaml
graph:
  orchestration: graph_v2
dispatch:
  backgroundStaleTimeoutMs: 900000
```

`graph:` 目前是前向兼容占位：解析器认识这个键，但还没有接入图解析，当前没有运行时效果——多代理编排一律走命令式 `graph_*` 工具（见[图工作流](/02-Guide/graph-workflows)）。`dispatch:` 只接受 `backgroundStaleTimeoutMs` 与 `syncPromptTimeoutMs` 两个键，其余键会被忽略，细节见[调度配置](/03-Reference/dispatch-config)。

### 环境变量插值

```yaml
model: "{env:PREFERRED_MODEL}"
prompt: |
  You work for {env:COMPANY_NAME}.
```

`{env:NAME}` 在启动时解析，可以出现在任意字符串位置；变量不存在时占位符原样保留，并写一条日志。

### 其余字段

`version`（语义化版本）、`memory`（角色级记忆的持久化与注入）、`notifications`（会话生命周期通知）、`copilot`（统一回合结束决策管道）、`hooks`（自定义生命周期 Hook）、`extensions`（注册自定义条件 / 拓扑 / 通知通道）、`open` / `exports` / `open_roles`（跨角色发现）都有完整的字段说明，见 [role.yaml 参考](/03-Reference/role-yaml)；使用场景见 [Hook 机制](/03-Reference/hooks)、[扩展机制](/03-Reference/extensions)、[记忆系统](/04-Advanced/memory-system)。

## 从模板开始：rolebox init

`rolebox init <name>` 按模板生成角色骨架，`--template` 选模板（默认 `standard`），`-y` 跳过交互提问：

```bash
cd rolebox && rolebox init code-reviewer --template standard -y
```
```text
应看到：
✓ Created standard role at <你的工作目录>/rolebox/code-reviewer
Run `rolebox sync opencode` to deploy
```
（路径随你的工作目录变化。）

| 模板 | 生成的文件 | 什么时候选它 |
|---|---|---|
| `minimal` | `role.yaml`、`PROMPT.md` | 只要一个能跑的最小角色 |
| `standard`（默认） | 另加 `skills/`、`functions/`、`references/` 三份 README 占位 | 需要角色级技能与函数目录（最常见） |
| `subagents` | 另加 `subagents/README.md`，并按你输入的名字逐个生成 `subagents/{name}/role.yaml` 与 `PROMPT.md` | 父角色 + 多个子代理 |

三个模板生成的 `role.yaml` 只有少量键不同（`standard` 与 `subagents` 会写入 `skills: []`、`functions: [plan, execute]`，`subagents` 再写入 `subagents:` 列表），逐键含义见 [role.yaml 参考](/03-Reference/role-yaml)。

## 配方 1：最小可运行的只读审查者

场景：需要一个能读文件、能搜索、能评审，但改不了任何东西的审查角色。

```yaml
# ~/.config/opencode/rolebox/code-reviewer/role.yaml
name: Code Reviewer
description: Reviews code for correctness, performance, and readability
model: gpt-4
mode: subagent
temperature: 0.2
prompt: |
  You are an expert code reviewer. Review for correctness, performance,
  and readability. Be specific and actionable. Never modify files.
skills:
  - review-checklist
permission:
  allow: [Read, Grep, Glob]
  deny: [Edit, Write, Bash]
```

预期行为：重启 harness 后这个角色以 `code-reviewer` 出现在可委托的代理里；它只能读；贴一段代码给它，它会按 `review-checklist` 技能逐条评审。

```bash
rolebox sync opencode
```
```text
应看到：
Synced 1 roles to opencode
```
（手工编写的角色重启 harness 即生效；这条命令用于把已安装的角色重新链接进 harness 的角色目录。）

出错时检查：

- `skills:` 里的名字要对上文件：`skills/<name>.md` 或 `skills/<name>/SKILL.md`。
- `mode: subagent` 表示它不会作为主代理出现在列表里；想让它出现在主列表就删掉这一行。
- 角色没出现时，先确认文件在 `<角色根>/code-reviewer/role.yaml`（角色 ID = 目录名），再重启 harness。

## 配方 2：带三个专家的团队负责人

场景：一个父角色带着调研、实现、评审三个子代理完成一段工作。

```yaml
# ~/.config/opencode/rolebox/review-team/role.yaml
name: Review Team Lead
description: Coordinates a research, implement, and review workflow
model: gpt-4
prompt: |
  You are a team lead. Break the task down and delegate to your sub-agents.
subagents:
  - name: Researcher
    description: Researches code patterns and context
    prompt: |
      You are a research specialist. Find relevant code, API usage, and
      design decisions, and report them with file references.
    permission:
      allow: [Read, Grep, Glob]
  - name: Implementer
    description: Writes production code
    prompt: You are a senior engineer. Write clean, testable code.
    permission:
      allow: [Read, Grep, Glob, Bash, Edit, Write]
  - name: Reviewer
    description: Reviews code for quality
    prompt: |
      You review code for correctness, style, and edge cases.
      Reply with APPROVED when the change is ready.
```

预期行为：父角色把调研派给 `review-team--researcher`、实现派给 `review-team--implementer`、评审派给 `review-team--reviewer`，然后汇总三段结果。子代理的 `prompt` 不会从父角色继承，必须逐个写明。

把这三步串成带返工和审批门的自动流水线，用运行时的图工具，见[图工作流](/02-Guide/graph-workflows)与[工作流模式](/04-Advanced/workflow-patterns)。

```bash
rolebox sync opencode
```
```text
应看到：
Synced 1 roles to opencode
```

出错时检查：

- 子代理的 `name` 不能包含 `--`，它是层级 ID 的分隔符。
- 子代理 ID 由 `父角色 ID--name 的小写连字符形式` 组成；命名规则与继承规则见[子代理](/02-Guide/subagents)。
- 子代理的 `prompt` 为空时该条目会被跳过，日志里会写明。

## 配方 3：只读文档代理

场景：一个能读代码、能查全局技能，但不能改文件的写作角色。

```yaml
# ~/.config/opencode/rolebox/tech-writer/role.yaml
name: Tech Writer
description: Technical documentation specialist, read-only
prompt: |
  You are a technical writer. Read the codebase to understand a feature,
  then write documentation. You may NOT edit any files.
opencode_skills:
  - humanizer
functions:
  - plan
permission:
  allow: [Read, Grep, Glob, LSP]
  deny: [Edit, Write, Bash]
```

预期行为：可以用 `|plan| 阅读 X 模块并为新端点写文档` 先出提纲再逐节写正文；`humanizer` 来自 harness 的全局技能目录。

```bash
rolebox sync opencode
```
```text
应看到：
Synced 1 roles to opencode
```

出错时检查：

- `opencode_skills` 引用的是全局技能目录（opencode 为 `~/.config/opencode/skills/`），角色私有技能用 `skills`。
- 需要跑构建或测试时，把 `Bash` 从 `deny` 里去掉。

## 常见错误

| 现象 | 原因与修法 |
|---|---|
| 角色完全没出现 | `role.yaml` 不在 `<角色根>/<roleId>/` 下，或 YAML 解析失败；角色 ID 取目录名，且不能含 `--` |
| 角色出现但提示词是空的 | `prompt` 与 `prompt_file` 都没给，或 `prompt_file` 指向的文件不存在——两种情况该角色都会被跳过 |
| 技能或函数声明了却不生效 | 名字对不上文件：技能找 `skills/<name>.md` 或 `skills/<name>/SKILL.md`，函数找 `functions/<name>.md` |
| 加了函数却少了一个内置函数 | `functions:` 是合并，不会移除内置函数；要移除得用 `disable_functions` |
| 子代理没出现 | 内联声明缩进写错（`subagents` 必须是列表），或 `subagents/<name>/role.yaml` 的目录名与声明不一致 |
| 子代理返回空结果 | 子代理的 `prompt` 为空，或它的权限不足以完成交给它的任务 |
| 改了 YAML 却不生效 | 角色在启动时加载，要重启 harness；安装来的角色还要跑一次 `rolebox sync <harness>` |

## 下一步

- [子代理](/02-Guide/subagents) — 内联与文件式声明、ID 命名、配置继承
- [role.yaml 参考](/03-Reference/role-yaml) — 全部顶层键、类型与默认值
- [图工作流](/02-Guide/graph-workflows) — 用 `graph_*` 工具编排多个代理
- [编写技能](/02-Guide/authoring-skills)、[编写函数](/02-Guide/writing-functions)、[引用文档](/02-Guide/references)

## 备注

> 自 v1.8.0 起，`role.yaml` 里的声明式协作配置（拓扑 / 数据流 / 参与者 / 循环上限）已被移除，多代理编排只保留命令式 `graph_*` 一条路径；升级写法见[迁移对照](/06-Appendix/migration)。
