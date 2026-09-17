---
title: 子代理
description: 子代理的内联与文件式声明、ID 命名、配置继承、技能与函数作用域，以及三类常见问题的排查
---

# 子代理（Subagents）

子代理（subagent）是父角色委托工作的子级代理，拥有自己的提示词、模型与能力配置。声明一个子代理，只需要在父角色 `role.yaml` 里写一段 `subagents:`，或者放一个 `subagents/<name>/role.yaml` 文件。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[目录结构](/01-Overview/directory-structure)、[图工作流](/02-Guide/graph-workflows)

## 最小示例

```yaml
# ~/.config/opencode/rolebox/review-team/role.yaml
name: Review Team Lead
description: Coordinates a code review workflow
prompt: |
  You are a team lead. Delegate work to the appropriate specialist.
subagents:
  - name: Coder
    description: Implements code changes
    prompt: You are a senior developer. Write clean, testable code.
  - name: Reviewer
    description: Reviews code for quality
    prompt: You review code for correctness, style, and edge cases.
```

```bash
rolebox sync opencode
```
```text
应看到：
Synced 1 roles to opencode
```
（手工编写的角色重启 harness 即生效；`rolebox sync` 用来把已安装的角色重新链接进 harness 的角色目录。）

现在父角色下有两个可委托的子代理，ID 分别是 `review-team--coder` 与 `review-team--reviewer`。每个条目接受与 `role.yaml` 同名的字段：`name`、`description`、`prompt` / `prompt_file`、`model`、`temperature`、`top_p`、`permission`、`tools`、`skills`、`opencode_skills`、`functions`、`disable_functions`，以及嵌套的 `subagents:`。

## 两种声明方式

### 内联声明

把子代理直接写在父角色的 `subagents:` 列表里，适合提示词短、不需要私有技能或函数的场景：

```yaml
# team-lead/role.yaml
name: Team Lead
description: Delegates work to specialist sub-agents
model: gpt-4
prompt: |
  You are a team lead. Delegate tasks to the appropriate specialist.
subagents:
  - name: Implementer
    description: Writes production code
    prompt: |
      You are a senior software engineer. Write clean, testable code.
    temperature: 0.1
```

内联条目没有自己的目录，所以它的技能、函数与引用都从**父角色目录**解析。

### 文件式声明

需要给子代理独立的技能、函数或引用文档时，用目录形式——放一个 `subagents/<name>/role.yaml` 即可被自动发现：

```text
team-lead/
├── role.yaml
└── subagents/
    └── researcher/
        ├── role.yaml
        ├── skills/
        │   └── research-checklist/
        │       └── SKILL.md
        ├── functions/
        │   └── source-triage.md
        └── references/
            └── methodology.md
```

`team-lead/subagents/researcher/role.yaml` 的内容与普通角色定义同构：

```yaml
name: Researcher
description: Finds and synthesizes information
prompt: |
  You are a research specialist. Find accurate, up-to-date information
  and report it with sources.
skills:
  - research-checklist
```

两种方式可以混用：一部分子代理内联，一部分文件式。

## 命名与 ID

子代理 ID 由层级路径拼成，分隔符是 `--`：slug 取 `name` 的小写、空格转连字符形式，再接到父级 ID 后面。

| 层级 | 例子 |
|---|---|
| 父角色 | `team-lead` |
| 第 1 层子代理 | `team-lead--implementer` |
| 第 2 层子代理（孙） | `team-lead--implementer--linter` |

- 角色目录名与子代理的 `name` 都不能包含 `--`，否则该角色或条目会被跳过，日志里会写明原因。
- 同一个父角色下重复声明同名子代理时，后一个覆盖前一个。
- 每一层子代理都会以完整 ID 注册为一个独立代理，所以图节点可以按 ID 指名任意层级；惯常做法是父角色委托直属子代理，再往下由该子代理自己委托。

## 配置继承

子代理未显式设置某些字段时，会从父角色继承。可继承的字段是固定的一份清单：

| 关系 | 字段 |
|---|---|
| 未声明时自动继承父角色 | `model`、`color`、`variant`、`temperature`、`top_p`、`permission`、`tools` |
| 不继承，必须自己声明 | `name`、`description`、`prompt` / `prompt_file`、`skills`、`opencode_skills`、`functions`、`disable_functions`、`subagents`、`auto_activate`、`locked` |

三条例外值得记住：

1. **子代理自己的声明永远优先**。显式写了 `model` 就用子代理的，没写才回退到父角色。
2. **`prompt` 绝不继承**。父子代理都不会替子代理说话；`prompt` 为空的条目会在解析阶段被跳过。
3. **`mode` 由系统决定**。子代理部署到 harness 时 `mode` 一律为 `subagent`；写别的值不会让它变成主代理，要主代理得单独定义一个角色。

继承是逐层的：孙代理从它的父级子代理继承，而那个父级子代理又可能继承了角色的值。

## 技能、函数与引用的作用域

子代理能用的资源取决于它有没有自己的目录：

| 资源 | 内联子代理 | 文件式子代理 |
|---|---|---|
| 技能 | 从父角色目录的 `skills/` 解析，再落到 harness 全局技能目录 | 先看自己目录的 `skills/`，再落到全局 |
| 函数 | 同样从父角色目录的 `functions/` 解析（同名覆盖全局与内置） | 先看自己目录的 `functions/`，再落到全局与内置 |
| 引用文档 | 父角色的角色级引用 + 技能级引用 | 自己的 `references/`（自动发现）+ 父角色的角色级引用 + 技能级引用 |

`functions:` 与角色一样是合并语义：最终启用集合 = 内置的 `plan`、`execute`、`loop` ∪ 声明的函数，去掉 `disable_functions` 里列出的名字。技能解析顺序与目录约定见[目录结构](/01-Overview/directory-structure)。

子代理的角色级技能会被链接到 harness 的全局技能目录，名字形如 `rolebox--{子代理 ID}~{技能名}`，因此多个角色的同名技能不会互相覆盖。

## 委托执行

父角色委托工作有两个入口：**图工具**（`graph_create` / `graph_add_node` / `graph_run` 等）是 v1.9.0 的主路径，节点是角色无关的 `{agent, prompt}` 元组，`agent` 就填上面那套子代理 ID；**`dispatch_*` 是早期命令式调用的兼容命名空间**，工厂代码仍在，但 v1.9.0 的默认工具注册表**不注册它**（裸调度会绕过图预算、审批门与循环上限），新配置不要再依赖。建图、连边、审批门、有界循环与结果回收的完整写法见[图工作流](/02-Guide/graph-workflows)，本页不重复。

## 限制

- **递归深度上限 3 层**（父 → 子 → 孙）。更深的 `subagents/` 目录不会被发现。
- **不能在运行时创建子代理**：子代理只能在 `role.yaml` 或 `subagents/<name>/role.yaml` 里声明，工具面里没有创建角色的工具。
- **没有子代理之间的私有通道**：协作要么由父角色中转，要么用图把节点连起来——图节点本身就是跨代理的边。
- **子代理条目上的 `auto_activate` / `locked` 目前不生效**：YAML 能解析这两个键，但会话启动时的自动激活表只按顶层角色 ID 建立。需要子代理会话里立刻有某个函数时，改用 `|name|` 激活它（例如在派发的 prompt 里带上 `|review|`）。
- **没有按模型的并发槽位或队列配置**：v1.5.0 起并发管理器、队列深度上限与同步保留槽位整体移除（`maxConcurrent`、`maxQueueDepth`、`syncReservedSlots` 这类字段都不再存在），图节点的并发由引擎自管——就绪前沿、循环组的 `max_traversals` 与节点预算，见[图引擎模型](/04-Advanced/graph-engine)。
- **技能与函数找不到都不会让角色启动失败**：技能名对不上文件时静默跳过，函数名对不上时只记一条日志；所以要用上面那张作用域表核对位置，别指望报错提醒。

## 排错

### 配方 1：子代理没有出现

现象：调用图工具时提示找不到目标代理，或父角色声称没有可用的子代理。

检查顺序：

1. **看目录与文件名**。文件式子代理必须落在 `<roleDir>/subagents/<name>/role.yaml`；目录名不匹配时它不会被发现。
   ```text
   review-team/
   ├── role.yaml
   └── subagents/
       └── researcher/
           └── role.yaml
   ```
2. **看 YAML 形状**。内联 `subagents:` 必须是列表：

   ```yaml
   # 错误：写成了映射，解析不出条目
   subagents:
     researcher:
       description: Researches code patterns

   # 正确：以 - 开头的列表
   subagents:
     - name: Researcher
       description: Researches code patterns
       prompt: Research the relevant code...
   ```

3. **看它有没有被跳过**。`name` 或目录名含 `--`、`prompt` 与 `prompt_file` 都为空、`prompt_file` 指向的文件不存在，都会让这个条目被静默跳过，日志里会给出原因。
4. **对已安装的角色可用 `rolebox info` 复核**：

   ```bash
   rolebox info review-team
   ```
   ```text
   应看到（节选）：
   Subagents (2)
       • Coder — Implements code changes
       • Reviewer — Reviews code for quality
   ```
   `rolebox info` 读的是本机安装记录（`rolebox list` 能列出的角色）；手工编写的角色直接看 `role.yaml` 与 `subagents/` 目录。
5. **最后重启 harness**。角色与子代理在启动时解析，改完不重启不会生效。

### 配方 2：子代理返回空结果

现象：父角色说已经委托、也拿到了回复，但回复里没有实质内容。

- **`prompt` 为空或过于笼统**。子代理的系统提示就是它的全部上下文起点，父角色不会替它补；把任务写清楚，并明确要它输出什么。
- **权限不足**。需要改文件的子代理必须有 `Edit` / `Write`（还要有 `Bash` 才能跑命令）；只给读权限时它会读完然后无话可说。

  ```yaml
  subagents:
    - name: Implementer
      description: Writes code
      prompt: Implement the approved change and report the files you touched.
      permission:
        allow: [Read, Grep, Glob, Bash, Edit, Write]
  ```

- **任务描述里缺少输入**。子代理有独立的上下文，看不到父角色已经读过的文件和已经做过的判断；把关键结论显式写进派发的 `prompt`。

### 配方 3：子代理用了错误的模型

现象：父角色跑在 `gpt-4` 上，子代理却在用默认模型。

原因是继承只发生在父角色**声明了** `model` 的时候：

```yaml
# 父角色与子代理都没写 model → 子代理用平台默认模型
name: Team Lead
prompt: You are a team lead.
subagents:
  - name: Researcher
    description: Researches topics
    prompt: Research the relevant code...
```

两种修法——在父角色上声明让全体继承，或在子代理上单独覆盖：

```yaml
# 修法一：父角色声明，未覆盖的子代理继承
name: Team Lead
model: gpt-4
prompt: You are a team lead.
subagents:
  - name: Researcher
    description: Researches topics
    prompt: Research the relevant code...
```

```yaml
# 修法二：子代理显式覆盖父角色的 model
subagents:
  - name: Researcher
    description: Researches topics
    model: claude-3-haiku
    prompt: Research the relevant code...
```

## 下一步

- [图工作流](/02-Guide/graph-workflows) — 把子代理编排成流水线、审批门与有界循环
- [图执行引擎](/04-Advanced/graph-engine) — 引擎如何派发节点、传播信号
- [创建角色](/02-Guide/create-a-role) — 角色定义逐字段与三个配方
- [目录结构](/01-Overview/directory-structure) — 角色根目录、作用域与 `.rolebox` 状态目录
