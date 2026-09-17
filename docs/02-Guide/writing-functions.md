---
title: 函数规范
description: 函数文件 frontmatter 的完整规范 — 字段表、参数化、gate/transitions/observe/continue_until、条件表达式、Tier-2 处理器与验证方法
---

# 函数规范（Writing Functions）

一个函数就是一个带 YAML frontmatter 的 Markdown 文件：frontmatter 声明它叫什么、何时激活、何时延续、观察哪些事件，正文则是激活后注入系统提示的指令。本页是这份文件的格式规范——每个字段都给出摘要、类型、默认值与示例。

内置函数有哪些、怎么按角色声明函数，见[函数系统](/02-Guide/functions)；技能与函数该怎么选，见[技能系统](/02-Guide/skills)。

> 前置：[函数系统](/02-Guide/functions)｜相关：[创建角色](/02-Guide/create-a-role)、[教程 03 用函数改变行为](/02-Guide/tutorial/03-functions)

## 最小示例

把下面这个文件保存为 `{roleDir}/functions/review.md`：

```markdown
---
name: review
description: 以指定关注点审查代码
params:
  focus: correctness
---

以 **{focus}** 为关注点审查这段代码：逻辑错误与边界条件、性能影响、与既有模式的一致性。
```

同步到 harness：

```bash
rolebox sync opencode
```

```text
应看到：Synced 1 roles to opencode（示例输出，随环境与已安装角色数略有差异）
```

之后在对话开头写 `|review|`，函数被激活，正文进入系统提示；写 `|review:security|` 时 `{focus}` 被替换为 `security`。

函数文件放在 `{roleDir}/functions/{name}.md`。同名函数按三个位置依次解析，第一个存在且正文非空的文件生效：角色本地 `{roleDir}/functions/` → 全局 `{configDir}/functions/`（`{configDir}` 是当前 harness 的配置目录，opencode / Pi / dsh 各不相同）→ 内置函数目录（随 rolebox 包发布）。按角色声明函数、内置函数清单与 `disable_functions` 的用法见[函数系统](/02-Guide/functions)。

## Frontmatter 字段总表

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `name` | string | 激活时使用的名字（即文件名） | 函数名 | `name: review` |
| `description` | string | `""` | 人类可读的一句话描述 | `description: 代码审查模式` |
| `params` | object | 无 | 参数声明：名称 → 默认值 | `params: { focus: correctness }` |
| `phase` | string | 无 | 执行阶段标签，仅用于分组显示与日志 | `phase: verify` |
| `priority` | number | `50` | 系统提示中的注入排序，较小值先注入 | `priority: 30` |
| `requires` | string[] | 无 | 依赖的函数名；未激活时本函数指令不注入 | `requires: [plan]` |
| `produces` | string | 无 | 本函数产出的制品名（声明性元数据） | `produces: report` |
| `consumes` | string | 无 | 要注入的制品名，以 `<active_artifact>` 块呈现 | `consumes: plan` |
| `gate` | Condition | 无 | 门控条件；满足前函数停在 `gated` | `gate: { all: [user_approval] }` |
| `continue_until` | Condition | 无 | 自动延续的终止条件；满足即标记完成 | `continue_until: evidence_met()` |
| `continue_max` | number | `5` | 每函数的最大自动延续轮数 | `continue_max: 30` |
| `requires_evidence` | string[] | 无 | 必须已观察到的证据标签，否则不延续 | `requires_evidence: [test]` |
| `observe` | ObserveSpec[] | 无 | 生命周期观察器列表 | `observe: [{ on: activate, inject: … }]` |
| `transitions` | TransitionSpec[] | 无 | 状态转换规则：何时激活/停用函数 | `transitions: [{ when: gate, … }]` |
| `state_schema_version` | number | `1` | 状态 schema 版本；变更即重置该会话状态 | `state_schema_version: 2` |
| `handlers` | string | 无 | Tier-2 处理器模块路径（相对于本文件） | `handlers: handlers/review.js` |

frontmatter 由标准 YAML 解析；`---` 之后的部分是函数正文，正文（去掉首尾空白后）为空的文件不会被加载。

## 标识与参数

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `name` | string | 文件名 | 函数名；决定系统提示与日志里的标识 | `name: review` |
| `description` | string | `""` | 一句话描述，展示在资产面板与 `rolebox info` 中 | `description: 代码审查模式` |
| `params` | object | 无 | 参数名 → 默认值；正文里用 `{参数名}` 占位 | `params: { focus: correctness }` |

函数名要符合激活语法：小写字母开头，只含小写字母、数字和连字符（`[a-z][a-z0-9-]*`）。`params` 里声明的每个键都是正文里的一个 `{占位符}`。

### 参数化调用

激活语法支持两种参数写法，可以混用：

| 写法 | 语法 | 映射规则 | 示例 |
|---|---|---|---|
| 位置参数 | `\|name:arg1,arg2\|` | 按 `params` 的**声明顺序**映射 | `\|review:security,strict\|` |
| 键值对 | `\|name key=value\|` | 按**参数名**映射，优先于位置参数 | `\|review focus=security\|` |
| 混合 | `\|a\|x:arg\|` | 每个函数各自解析；前面的函数不带参数 | `\|plan\|review:security\|` |

`|review:security,strict| 检查认证模块` 会把 `{focus}` 替换为 `security`、`{severity}` 替换为 `strict`。未提供的参数回退到 `params` 里的默认值；既没有默认值也没有传值的占位符会原样留在正文里。函数没有声明 `params` 时，传入的参数被忽略。

`|name|` 只在一行开头才是激活语法，正文中间的 `|name|` 原样保留；一行里可以连续写多个（`|plan|execute|` 或 `|plan||execute|`）。

## 阶段与顺序

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `phase` | string | 无 | 纯标签（如 `plan`、`execute`、`verify`），不控制任何行为 | `phase: verify` |
| `priority` | number | `50` | 多个函数同时活跃时，系统提示按此值升序排列 | `priority: 30` |

`phase` 不会决定执行顺序——真正的排序由 `priority` 完成（较小值先注入）。`phase` 的用途是把函数按阶段分组显示、让日志可读。

```yaml
---
name: review
description: 代码审查模式
phase: verify
priority: 30
---
```

## 依赖与制品

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `requires` | string[] | 无 | 依赖的函数名；全部活跃后才注入本函数指令 | `requires: [plan]` |
| `produces` | string | 无 | 本函数产出的制品名；声明性元数据，供依赖图与资产检查使用 | `produces: plan` |
| `consumes` | string | 无 | 消费的制品名；该制品存在时注入系统提示 | `consumes: plan` |

`requires` 是一道**注入守卫**：依赖未激活时，本函数的指令不进入系统提示，取而代之的是一条「activate required functions first」提醒，指明还缺哪些函数。

`consumes` 有实际运行时效果：命名的制品存在时，它以 `<active_artifact name="plan">…</active_artifact>` 的形式注入系统提示。`produces` 只用于描述与依赖图，不改变运行时行为。

```yaml
---
name: execute
requires: [plan]
consumes: plan
produces: result
---
```

## 生命周期状态

运行时只有三种状态：

- `active`——指令注入系统提示，正常参与每轮的 gate 与转换评估。
- `gated`——`gate` 未满足，指令不注入；条件成立后回到 `active`。发出 `need_approval`、`blocked`、`need_clarification` 这类暂停信号也会把函数置为 `gated`。
- `complete`——函数已完成目标，不再参与延续评估。

「已注册但未激活」不是第四种状态：未激活的函数只是不在会话的活跃集合里。`transitions` 的 `deactivate` 把函数移出活跃集合，也不新增状态取值。处于 `gated` 的函数不参与自动延续；因 `signal(type="blocked")` 而阻塞的那个，会在默认 2 分钟的看门狗到期后强制解除阻塞、重新评估延续条件，避免会话停在那里。

## gate（门控）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `gate` | Condition | 无 | 函数进入 `active` 前必须成立的条件 | `gate: { all: [artifact_exists(plan), user_approval] }` |

没有 `gate` 的函数在激活后直接是 `active`；声明了 `gate` 的函数在条件成立前停在 `gated`（指令不注入）。gate 每轮重新求值，条件从成立变为不成立时会退回 `gated`。条件语法见下文的「条件表达式」。

```yaml
---
name: plan
gate:
  all: [artifact_exists(plan), user_approval]
transitions:
  - when: gate
    activate: [execute]
    deactivate: [plan]
---
```

这段声明让 `plan` 在「制品已产出**且**用户已批准」之前保持 `gated`，成立后激活 `execute` 并停用自己。

## Transitions（状态转换）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `transitions` | TransitionSpec[] | 无 | 状态转换规则列表 | `transitions: [{ when: gate, activate: [execute] }]` |
| `transitions[].when` | Condition | 无（必填） | 触发条件；特殊值 `gate` 表示本函数的 gate 已满足 | `when: user_approval` |
| `transitions[].activate` | string[] | 无 | 条件成立时要激活的函数 | `activate: [execute]` |
| `transitions[].deactivate` | string[] | 无 | 条件成立时要停用的函数 | `deactivate: [plan]` |

```yaml
transitions:
  - when: gate
    activate: [execute]
    deactivate: [plan]
  - when: user_approval
    deactivate: [review]
```

转换在每轮评估 gate 之后执行。两条容易误解的规则：

- `activate` 可以激活**其它**函数；被激活的函数在那之后进入自己的 gate/状态机评估。
- `deactivate` 只能停用**声明这条转换的函数自身**（自停用规则）。上面第二行写的是「当用户批准时，`review` 停用 `review`」——要停用别的函数，得由那个函数自己的转换来声明。

## Observe（生命周期观察器）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `observe` | ObserveSpec[] | 无 | 观察器列表，每项由 `on` 指定事件 | `observe: [{ on: activate, inject: 开始评审 }]` |

内置事件只有三个：

| 事件 | 触发时机 | 示例 |
|---|---|---|
| `tool_after` | 某个工具执行之后 | `{ on: tool_after, tool: todowrite, sync_todos: true }` |
| `message` | 用户发来消息 | `{ on: message, inject: 用户有新指示 }` |
| `activate` | 函数被激活时 | `{ on: activate, inject: 先读计划文件 }` |

自定义事件由扩展注册，声明写法与内置事件一致。

ObserveSpec 的字段：

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `on` | string | 无（必填） | 事件名 | `on: tool_after` |
| `tool` | string | 无（任意工具） | 仅 `tool_after`：只在指定工具执行后触发 | `tool: write` |
| `when` | Condition | 无 | 额外的守卫条件；`message` 事件会求值，`tool_after` 请改用 `when_output` / `when_args` | `when: user_approval` |
| `inject` | string | 无 | 触发时注入系统提示的内容 | `inject: 已写入文件，检查规范` |
| `set_evidence` | string | 无 | 把某个证据标签标记为已观察到 | `set_evidence: code_reviewed` |
| `capture_artifact` | string | 无 | 从助手消息里抽取同名块，落盘为制品 | `capture_artifact: plan` |
| `capture_payload_as` | string | 无 | 把工具参数的 `payload` 字段序列化为制品 | `capture_payload_as: approval` |
| `sync_todos` | boolean | `false` | 仅 `tool_after` + `todowrite`：同步待办状态 | `sync_todos: true` |
| `when_output` | object | 无 | 输出内容匹配条件：`contains` / `not_contains`（区分大小写） | `when_output: { contains: ERROR }` |
| `when_args` | object | 无 | 工具参数匹配条件：`match` / `not_match`（按键做 JSON 等值比较） | `when_args: { match: { path: a.ts } }` |

`capture_artifact` 接受两种块：`<Name>…</Name>`（标签大小写不敏感，取最后一个），或行首精确匹配的名字围栏块（三个反引号后紧跟制品名）；两者都可以在 `tool_after` 触发时或回合结束时被抽取。

```yaml
---
name: execute
observe:
  # 每当 todowrite 被调用，同步待办列表状态
  - on: tool_after
    tool: todowrite
    sync_todos: true

  # 激活时注入一条指令
  - on: activate
    inject: "若设置了 {plan} 参数，先读 .rolebox/plans/{plan}.md 找到续做点。"

  # 只在写文件失败时记录证据
  - on: tool_after
    tool: write
    when_output:
      not_contains: "written"
    set_evidence: write_failed
---
```

## Continue Until（自动延续）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `continue_until` | Condition | 无 | 终止条件；成立时函数标记 `complete` 并停止自动延续 | `continue_until: plan_todos_complete()` |
| `continue_max` | number | `5` | 本函数的最大自动延续轮数 | `continue_max: 30` |
| `requires_evidence` | string[] | 无 | 这些证据未全部观察到时，延续被完全跳过 | `requires_evidence: [test]` |

```yaml
---
name: execute
continue_until:
  all: [plan_todos_complete, evidence_met]
continue_max: 30
requires_evidence: [lsp_diagnostics, test]
---
```

运行时的延续语义：

- 每次会话空闲时评估 `continue_until`：成立 → 函数转为 `complete`；不成立 → 发出一条自动延续提示（每次空闲最多一条）。
- 一次延续爆发中的全局上限是 25 轮；每函数上限是 `continue_max`（未声明时为 5）。
- 冷却规则：连续延续到第 3 轮后冷却 1 个回合，到第 5 轮后冷却 3 个回合。
- `requires_evidence` 有任意一项未观察到时，整个延续被跳过。
- 连续两次输出完全相同（疑似循环）或模型正在向用户提问时，不延续。

## 条件表达式

`gate`、`transitions[].when`、`continue_until` 和 `observe[].when` 都使用同一套条件表达式。

| 条件 | 语法 | 成立条件 | 示例 |
|---|---|---|---|
| `user_approval` | `user_approval()` | 用户在本轮发了消息 | `gate: user_approval()` |
| `artifact_exists` | `artifact_exists(name)` | 指定名字的制品存在且非空 | `artifact_exists(plan)` |
| `plan_todos_complete` | `plan_todos_complete()` | 待办列表没有未勾选项 | `continue_until: plan_todos_complete()` |
| `evidence_met` | `evidence_met()` | `requires_evidence` 全部已观察到 | `evidence_met()` |
| `tool_observed` | `tool_observed(name)` | 指定工具已被调用过 | `tool_observed(approve)` |
| `signal_observed` | `signal_observed(type)` | 观察到指定类型的信号 | `signal_observed(blocked)` |
| `turn_count` | `turn_count(N)` | 自激活起已过去 N 轮或更多 | `turn_count(3)` |
| `state_eq` | `state_eq(key=value)` | 函数状态键等于指定值 | `state_eq(mode=strict)` |
| `plan_incomplete` | `plan_incomplete(name)` | 计划文件里仍有未勾选的复选框 | `plan_incomplete(release)` |

复合逻辑用 `all` / `any` / `not` 嵌套，可以任意组合：

```yaml
# 所有条件都成立
gate:
  all: [artifact_exists(plan), user_approval]

# 任一条件成立即可
continue_until:
  any:
    - plan_todos_complete
    - tool_observed(approve)

# 取反
gate:
  not: plan_todos_complete
```

## Tier-2 处理器（handlers）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `handlers` | string | 无 | 处理器模块路径；相对路径以函数文件所在目录为基准 | `handlers: handlers/review.js` |

处理器模块导出三个可选回调：`onToolAfter(ctx, { tool, args })`、`onIdle(ctx)`、`shouldContinue(ctx)`。

```javascript
// handlers/review.js
export default {
  onToolAfter: (ctx, { tool, args }) => {
    if (tool === "write") {
      ctx.inject("文件已写入，检查是否与既有模式一致。");
    }
  },
  onIdle: (ctx) => {
    // 每次会话空闲时运行
  },
  shouldContinue: (ctx) => {
    // true 继续；false 且未声明 continue_until 时标记 complete
    return ctx.artifact.exists("result") === false;
  },
};
```

处理器里的 `ctx` 提供：

| 成员 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `ctx.state.get(name)` / `ctx.state.set(name, value)` | — | 读/写本函数的持久状态键 | `ctx.state.set("round", 2)` |
| `ctx.artifact.read(name)` / `write` / `append` / `exists(name)` | — | 读/写/追加/检查制品 | `ctx.artifact.exists("plan")` |
| `ctx.query.lastMessage()` | — | 最后一条助手消息 | `ctx.query.lastMessage()` |
| `ctx.query.state(fn, key)` | — | 读其它函数的状态键 | `ctx.query.state("plan", "mode")` |
| `ctx.query.artifacts()` | — | 列出当前会话的全部制品名 | `ctx.query.artifacts()` |
| `ctx.inject(content)` | — | 注入一段系统提示内容 | `ctx.inject("继续第 2 步")` |
| `ctx.requestContinuation(reason)` | — | 请求一次延续 | `ctx.requestContinuation("还有未完成步骤")` |
| `ctx.activate(fn)` / `ctx.deactivate(fn)` | — | 排队激活/停用函数 | `ctx.activate("execute")` |

处理器是**追加**语义：`shouldContinue` 返回 `true` 可以请求延续，但无法否决声明式的 `continue_until`；返回 `false` 只在函数没有声明 `continue_until` 时才把函数标记为 `complete`。模块加载失败或回调抛错只会记一条警告，不会打断会话。

## 状态版本（state_schema_version）

| 字段 | 类型 | 默认值 | 摘要 | 示例 |
|---|---|---|---|---|
| `state_schema_version` | number | `1` | 函数状态的 schema 版本 | `state_schema_version: 2` |

每个会话为每个活跃函数保存一份状态（`phase`、已观察证据、延续计数等）。当声明里的 `state_schema_version` 与已持久化状态不一致时，该函数的旧状态被丢弃并重新初始化——改动状态结构（例如换了 `ctx.state` 里键的含义）时提升这个版本号，可以避免读到语义已变的旧值。

状态持久化在 `.rolebox/state/fnstate-{hash}.json`（`{hash}` 取自工作区路径），系统提示里则以 `<function_state>` 块呈现每个活跃函数的 `phase`、`gate_satisfied`、`todos_remaining`、`evidence`、`continuation`。排查激活与延续问题的步骤见[函数系统](/02-Guide/functions)。

## 验证

### 函数测试

函数行为的验证点集中在几处，按你要确认的行为选择观察目标：

| 要验证的行为 | 观察点 | 断言示例 |
|---|---|---|
| gate 是否生效 | 状态的 `phase` 与 `gateSatisfied` | 条件不成立时 `phase === "gated"` |
| transition 是否触发 | 转换求值返回的 `activate` / `deactivate` | 返回数组包含目标函数名 |
| 证据是否被标记 | 状态的 `evidenceObserved` | `evidenceObserved.test === true` |
| 延续是否推进 | 状态的 `continuationCount` 与 `cooldownUntilTurn` | 计数递增、冷却按规则布防 |
| `requires` 是否放行 | 函数指令是否出现在系统提示中 | 依赖未激活时不出现在提示里 |

gate/转换求值与条件求值都是**纯函数**：传入构造好的函数声明与环境（状态、制品、是否本轮收到用户消息等）即可断言，不需要依赖提示文本。

### 函数依赖图

`function_graph` 工具可视化跨角色与子代理的函数关系：

| 参数 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `role_id` | string | 无（全部角色） | 只看某个角色（含它的子代理）的函数 | `role_id: emperor--jinyiwei` |
| `focus` | `dependencies` / `state_machine` | `dependencies` | 依赖图，或基于 `transitions` 的状态机图 | `focus: state_machine` |

`focus: dependencies` 展示 `requires` / `produces` / `consumes` 的依赖关系；`focus: state_machine` 展示 `transitions` 的激活与停用流。函数没有被角色加载时，工具会直接说明找不到函数。

## 常见错误

- **占位符没被替换**：`params` 里没有同名参数，或该参数既没传值也没有默认值——`{name}` 会原样留在正文里。
- **函数激活了但指令没进系统提示**：正文为空（frontmatter 之后没有内容）的文件不会被加载；`requires` 未满足时指令被守卫拦下并给出提醒。
- **想停用别的函数**：`transitions[].deactivate` 只对声明它的函数自身生效。
- **想让参数化生效**：`|name|` 必须在行首；函数还必须声明 `params`。
- **想禁用内置函数**：在 `role.yaml` 里用 `disable_functions`，不要建同名文件覆盖（会遮蔽内置实现且难以排查）。
- **`function_state` 不是函数也不是工具**：该工具已移除；状态看系统提示里的 `<function_state>` 块或状态文件。

## 下一步

- [函数系统](/02-Guide/functions)——内置函数、按角色声明函数与 `disable_functions`
- [技能系统](/02-Guide/skills)——什么时候该写技能而不是函数
- [创建角色](/02-Guide/create-a-role)——把函数接进一个完整角色
- [信号系统](/04-Advanced/signal-system)——`signal_observed` 背后的信号机制
