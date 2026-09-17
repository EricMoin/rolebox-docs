---
title: 函数系统
description: 用 |name| 前缀激活函数：内置 plan/execute/loop、按角色声明与合并语义、参数化调用，以及激活失败的排查方法
---

# 函数系统（Function System）

函数（Function）是角色可组合的行为模块——一段按需注入系统提示的指令。你在消息的行首用 `|名称|` 前缀（激活语法）激活它，激活后的指令在整个会话中持续生效。本页讲怎么用：激活语法、内置函数、按角色声明、参数化调用与 `|loop|` 迭代；字段与条件的完整规范见[编写函数](/02-Guide/writing-functions)。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[编写函数](/02-Guide/writing-functions)、[技能系统](/02-Guide/skills)

## 最小示例

在消息的行首写 `|plan|`，后面的文本就是这条消息：

```text
|plan| 重新设计认证模块
```

应看到：解析器剥离 `|plan|` 前缀，代理进入规划模式——先调查代码库、给出计划并等你确认，而不是直接改代码。

前缀只影响激活，不改变消息内容：上面的消息对代理来说就是「重新设计认证模块」。

## 激活语法

```text
|plan| 重新设计认证模块                    # 激活一个函数
|plan|execute| 为 API 添加分页功能          # 一次激活多个
|review:security,strict| 检查认证模块       # 带参数（见「参数化函数」）
```

- 前缀写在**行首**；句中出现的 `|…|` 不会被识别。
- 函数名只允许小写字母、数字和连字符，例如 `plan`、`security-scan`。
- 多个函数可以连写（`|a|b|`），也可以写成 `|a||b|`。
- 活跃函数是**会话级集合**：同一个函数重复激活不会叠加；新会话不继承上一个会话的活跃函数。
- 角色自定义函数要先在 `role.yaml` 声明才能激活；三个内置函数始终可激活。

## 内置函数

每个角色都有三个内置函数：`plan`、`execute`、`loop`。

### plan：先调查，后计划

```text
|plan| 把用户模块从 REST 迁移到 GraphQL
```

代理进入规划模式：用工具调查现状，先给一份带关键决策点的草稿，等你确认后再落一份可执行计划。它不会在计划阶段改代码；计划被批准后，`plan` 自动激活 `execute` 并把自己停用，所以通常只需要激活 `|plan|`。

### execute：按计划逐步实现

```text
|execute| 按计划改造用户模块
```

代理进入执行模式，按计划逐步实现，每一步之后用 LSP 诊断与测试验证，直到所有步骤完成。它消费 `plan` 产出的**制品（artifact，函数产出并被其他函数消费的内容）**——计划制品存在时会一并注入提示。

### loop：多轮迭代

```text
|loop:3| 调研 rollout 失败的原因并给出结论
```

代理只做**编排器（orchestrator，负责派发与汇总、不亲自执行任务的会话角色）**：把任务按轮派发到独立的 worker 会话，每轮结束后给出一段面向用户的摘要。参数与模式见下一节。

## 用 `|loop|` 迭代执行

`|loop|` 把同一个任务重复运行 N 轮，并把上一轮的统一摘要作为下一轮的种子上下文。它适合需要反复打磨的任务：多轮调研、迭代改进、独立评估。

```text
|loop:3| 调研 dispatch 通知机制，列出所有通知类型和触发条件
```

应看到（`<session>` 与耗时随环境不同，此处为示例输出）：

```text
[loop-progress loop started: 3 rounds, inherit mode]
[loop-progress round 1/3 completed, session=<session>, duration=12.5s]
[loop-progress round 2/3 completed, session=<session>, duration=10.2s]
[loop-progress round 3/3 completed, session=<session>, duration=8.1s]
[loop-progress loop complete]
```

参数写在 `|loop:` 之后，用逗号分隔：

| 参数 | 位置 | 默认值 | 说明 |
|---|---|---|---|
| 轮数 | 第 1 个 | `5` | 取值范围 1–50；超过 50 会钳位到 50 并追加提示 |
| 模式 | 第 2 个 | `inherit` | `inherit` 把上一轮摘要作为下一轮的种子上下文；`fresh` 每轮从零开始 |

模式别名：`inherit` 也可写 `on`、`true`；`fresh` 也可写 `no-inherit`、`off`、`false`。

```text
|loop| 重构 utils 模块            # 5 轮，inherit
|loop:10,fresh| 生成示例           # 10 轮，fresh
|loop:3,off| 运行测试套件          # 3 轮，fresh（别名）
```

要按名字传参，用空格语法，而不是冒号语法：

```text
|loop iterations=3 mode=fresh| 从头重复实验
```

::: warning 冒号语法里 `mode=` 不会生效
`|loop:3,mode=fresh|` 会把 `mode=fresh` 当成第 2 个位置参数的值；它不是合法模式，于是回退到默认的 `inherit`。要指定模式，写 `|loop:3,fresh|`，或用空格语法 `|loop iterations=3 mode=fresh|`。
:::

轮数越界不会报错：`|loop:100|` 会钳位到 50 轮并追加一条 `Loop: 50 iterations (clamped to 50)` 提示；`|loop:0|` 则直接无效，循环不会启动。

取消：循环运行期间发送 `/stop-loop` 即可取消，已完成轮次的摘要保留在会话中。普通用户消息不会打断运行中的轮次。

边界：本页只讲 `|loop|` 的使用。轮次调度、状态机、持久化与恢复的实现见[循环系统](/04-Advanced/loop-system)；6 个 `loop_*` 编程接口工具的参数见[编排工具](/03-Reference/tools/orchestration-tools)。

## 按角色声明函数

自定义函数要在 `role.yaml` 里声明，才能用 `|名称|` 激活：

```yaml
# role.yaml
functions:
  - review          # 自定义函数
  - security-scan
disable_functions:
  - execute         # 从最终集合中移除内置的 execute
```

`functions:` 是**合并**语义：

- 与内置默认值 `[plan, execute, loop]` 求并集并去重——只写 `functions: [review]` 时，最终集合是 `[plan, execute, loop, review]`。
- `disable_functions:` 从合并结果中移除指定函数；这是移除内置函数的唯一方式。
- 两个字段都不写时，最终集合就是内置默认值。
- 子代理的 `functions:` / `disable_functions:` 用同一条规则合并进它自己的配置。

> 自 v0.23.0 起，`functions:` 与内置默认值合并而不是替换；要移除内置函数请用 `disable_functions`。

函数文件放在哪里、角色本地定义与全局定义谁覆盖谁，见[编写函数](/02-Guide/writing-functions)。

## 参数化函数

在函数文件的 frontmatter 里用 `params` 声明参数名与默认值：

```markdown
---
name: review
description: 按指定重点与严格度评审代码
params:
  focus: correctness
  severity: normal
---

以 **{focus}** 为重点、按 **{severity}** 严格度评审代码。
```

两种传参写法：

```text
|review:security,strict| 检查认证模块                 # 位置参数：按 params 声明顺序
|review focus=security severity=strict| 检查认证模块   # 键值参数：按名字
```

- 位置参数按 `params` 的声明顺序映射；键值参数按名字映射；两者可以混用，例如 `|plan|review:security| 分析这个 PR`。
- 未传的参数回退到声明的默认值。
- 函数没有 `params` 块时，传入的参数被忽略。
- 冒号语法只接受逗号分隔的位置值；键值语法要求参数与函数名之间是空格。

## 调试激活失败

### 1. 确认函数在最终集合里

对已安装的角色运行：

```bash
rolebox info my-role
```

应看到（示例输出，函数名随角色不同）：

```text
Functions (4)
    plan, execute, loop, review
```

这里列出的是角色**声明**的函数；没有声明 `functions:` 时显示内置默认值。目标函数不在列表里，说明它既不是内置函数也没有在 `role.yaml` 声明。注意：`rolebox info` 只认 `rolebox install` 安装的角色；用 `rolebox init` 在本地创建的角色不在安装锁里，直接看它的 `role.yaml` 即可。

### 2. 排除 disable_functions

被 `disable_functions` 列出的函数即使写在 `functions:` 里也会被移除。`rolebox info` 会在函数列表下方单列一行 `disabled:`。

### 3. 检查运行时状态

函数运行时状态按工作区持久化在 `.rolebox/state/fnstate-{hash}.json`：`{hash}` 是工作区绝对路径的 SHA-256 前 12 位。文件按会话分组，每个函数一段，重点看 `phase` 与 `gateSatisfied`：

```json
{
  "name": "analyze",
  "state": {
    "phase": "gated",
    "gateSatisfied": false
  }
}
```

`phase` 取 `active`、`gated`、`complete` 三者之一：`gated` 表示 `gate` 条件未满足，函数还在等条件（制品、信号或用户确认），这不是错误。

### 4. 检查 requires 依赖

`requires` 与 `gate` 是两套机制：依赖未满足时函数不会被标记为 `gated`，而是指令不注入，同时收到一条「先激活依赖函数」的提醒（`activate required functions first`）。所以「函数像是没生效」也可能是依赖链没走通——确认每个 `requires` 的函数都已进入活跃集合。

### 常见现象对照

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 前缀完全没有反应 | 函数名不在最终集合里 | 在 `role.yaml` 声明，或改用内置函数 |
| 提示中出现 `activate required functions first` | `requires` 依赖未激活 | 先激活依赖函数 |
| 状态文件里 `phase` 为 `gated` | `gate` 条件未满足 | 满足 gate 依赖的制品、信号或用户确认 |
| 声明后仍不生效 | 被 `disable_functions` 移除 | 从 `disable_functions` 中删除该项 |
| 参数没有生效 | 没有 `params` 块，或传参语法不对 | 补 `params`，并区分位置参数与键值参数 |

## 相关

- [编写函数](/02-Guide/writing-functions) — frontmatter、phase、gate、transitions、observe 与条件表达式规范
- [技能系统](/02-Guide/skills) — 按需加载的知识模块，以及它与函数的分工
- [子代理](/02-Guide/subagents) — 函数与调度目标的协作
- [循环系统](/04-Advanced/loop-system) — `|loop|` 的调度、状态机与恢复的内部实现
