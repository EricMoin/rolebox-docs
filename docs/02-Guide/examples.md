---
title: 示例展示
description: 10 个开箱即用的示例角色，按复杂度分级 — 从简单代理到完整的多代理协作工作流
---

# 示例展示

> **相关文档：** [创建角色](/02-Guide/create-a-role) — 角色创建实战指南 | [协作图](/02-Guide/collaboration-graph) — 工作流编排与拓扑 | [子代理](/02-Guide/subagents) — 子代理声明与 dispatch 调度

rolebox 在 `examples/` 目录下提供了 10 个开箱即用的示例角色。从最简单的代码审查员（10 行 YAML）到带终止条件的多代理审查团队，每个示例都针对一个核心概念。按复杂度分为三组。

所有示例位于 [rolebox/examples](https://github.com/EricMoin/rolebox/tree/main/examples)。

## 入门级

适合首次接触 rolebox 的用户。两个 YAML 文件，零子代理，零协作图。

### 代码审查员（code-reviewer）

**文件：** `rolebox/examples/code-reviewer/role.yaml`

```yaml
name: Code Reviewer
description: Expert code reviewer with deep understanding of CR and best practices
model: gpt-4
mode: subagent
color: '#4CAF50'
variant: thorough
temperature: 0.2
top_p: 0.95
prompt: |
  You are an expert code reviewer. Your job is to:
  1. Review code for correctness, performance, and readability
  2. Identify potential bugs and security issues
  3. Suggest improvements with concrete examples
  4. Be constructive and respectful in your feedback
skills:
  - review-checklist
functions:
  - plan
permission:
  allow:
    - Read
    - Grep
    - Glob
    - Edit
```

**演示的核心模式：**

| 模式 | 说明 |
|------|------|
| `mode: subagent` | 标记为子代理，不会主动出现在代理列表中 |
| `variant: thorough` | 预设变体 — 影响行为风格（更多变体参见[协作图](/02-Guide/collaboration-graph)） |
| `color` | 为角色分配十六进制颜色，[子代理](/02-Guide/subagents)在 UI 中以此颜色显示 |
| `skills: [review-checklist]` | 角色级技能引用 — 从 `{roleDir}/skills/` 加载 |
| `functions: [plan]` | 启用 `|plan|` 函数。与内置 `[plan, execute, loop]` 合并 |
| `permission.allow` | 白名单式权限控制 — 仅允许列出的工具 |

**可迁移的配置模式：** `temperature` / `top_p` 控制输出的随机性（低温更适合审查任务）。权限白名单 `[Read, Grep, Glob, Edit]` 限定了代理只能读取和修改代码，无法执行任意命令。

**参考链接：**
- [创建角色](/02-Guide/create-a-role) — role.yaml 完整 schema
- [权限配置](/02-Guide/create-a-role#权限配置) — 工具权限控制
- [子代理](/02-Guide/subagents) — `mode` 字段详解
- [函数系统](/02-Guide/functions) — `functions` 字段行为规则

### 技术文档撰写员（tech-writer）

**文件：** `rolebox/examples/tech-writer/role.yaml`

```yaml
name: Tech Writer
description: Technical documentation specialist
prompt: |
  You are a technical writer specializing in clear, concise documentation.
  Write documentation that is accurate, well-structured, and easy to understand.
opencode_skills:
  - humanizer
```

**演示的核心模式：**

| 模式 | 说明 |
|------|------|
| `opencode_skills: [humanizer]` | 加载全局技能。`humanizer` 推断 AI 生成文本中可识别的模式，使输出更自然 |
| 无 `functions` | 默认使用 `[plan, execute, loop]` |
| 无 `permission` | 默认允许所有工具 |

tech-writer 是"最简单的可用 rolebox 角色"——只有 name、description、prompt 和一个全局技能。它没有声明 `functions`，因此默认使用 `[plan, execute, loop]`（详见[创建角色](/02-Guide/create-a-role#函数配置)的函数合并规则）。它没有 `permission` 块，因此默认允许所有工具。

**参考链接：**
- [技能系统](/02-Guide/skills) — `opencode_skills` 与 `skills` 的对比
- [创建角色](/02-Guide/create-a-role) — 简单角色模板

## 进阶级

引入子代理和自定义 Hook。角色开始有内部结构。

### 团队主管（team-lead）

**文件：** `rolebox/examples/team-lead/role.yaml`

```yaml
name: Team Lead
description: Delegates work to specialist sub-agents
model: gpt-4
temperature: 0.3
prompt: |
  You are a team lead. You coordinate work across your sub-agents.
  Delegate tasks to the appropriate specialist when needed.
subagents:
  - name: Implementer
    description: Writes production code
    prompt: |
      You are a senior software engineer. Write clean, testable code.
    temperature: 0.1
```

**演示的核心模式：**

| 模式 | 说明 |
|------|------|
| 内联子代理 | 在 `subagents` 中直接定义子代理——最常用的声明方式 |
| 子代理级 `temperature` | Implementer 使用 `temperature: 0.1`（低温→确定性输出），覆盖父级的 `0.3` |
| 字段继承 | 子代理未指定的 `model` 会从父级继承（未显示但遵循[子代理](/02-Guide/subagents)中的继承规则） |

team-lead 是"委派模式"的原型。父角色接收任务，判断哪个子代理适合处理，然后通过 `dispatch` 工具委派。子代理在其自身 prompt 下执行，完成后将结果返回给父角色。关于 dispatch 的完整机制，参见[子代理](/02-Guide/subagents)和[调度配置](/03-Reference/dispatch-config)。

**参考链接：**
- [子代理](/02-Guide/subagents) — 内联声明、字段继承、dispatch API
- [协作图](/02-Guide/collaboration-graph) — 当需要结构化工作流时升级到此模式

### 自定义 Hook（hooks）

**文件：** `rolebox/examples/hooks/no-console-log.js`

```javascript
// A custom hook that warns about console.log in edited files
export default {
  onToolAfter: (ctx, { tool, args, output }) => {
    if (tool !== "write" && tool !== "edit") return;
    const content = typeof args?.content === "string" ? args.content : "";
    if (content.includes("console.log(")) {
      ctx.inject(
        `<system-reminder>Warning: console.log() detected in ${tool} output. ` +
        `Consider removing debug statements.</system-reminder>`
      );
    }
  },
};
```

**演示的核心模式：**

| 模式 | 说明 |
|------|------|
| 自定义 Hook | 拦截 `tool.execute.after` 事件并在系统提示中注入警告 |
| `onToolAfter` handler | 工具执行后触发的方法 |
| `ctx.inject()` | 向系统提示追加上下文——Hook 向代理沟通的主要通道 |
| 事件过滤 | 通过 `if` 条件过滤 `write`/`edit` 工具，避免无关工具触发 |

此 Hook 需要在 `role.yaml` 的 `hooks.custom` 块中注册（参考[自定义 Hook](/02-Guide/custom-hooks#hook-声明)的声明格式）。Hook 模块导出一个包含 handler 方法的对象，每个方法接收 `(ctx, payload)` 参数。`ctx.inject()` 是最常见的 action——它向系统提示追加文本，从而影响代理的下一次输出。

**参考链接：**
- [自定义 Hook](/02-Guide/custom-hooks) — 完整 API、所有 handler 方法、事件类型
- [HookContext API](/02-Guide/custom-hooks#hookcontext-api) — `ctx` 可用方法

## 高级：Review Team 系列

六个变体构成一个递进式教程，从基础协作图到带终止条件的多代理工作流。所有变体共享相同核心结构：

```yaml
name: Review Team Lead
description: Coordinates code review workflow
model: gpt-4
prompt: |
  You are a team lead coordinating a code review workflow.
  Follow the collaboration graph to dispatch work.
subagents:
  - name: Coder
    description: Implements code changes
    prompt: You are a senior developer. Write clean, testable code.
  - name: Reviewer
    description: Reviews code for quality
    prompt: You review code for correctness, style, and edge cases.
```

不同之处仅在于 `collaboration` 块——反映出 rolebox 的核心理念：**结构从配置中涌现，而非代码**。

### review-team（基础版）

**文件：** `rolebox/examples/review-team/role.yaml`

```yaml
collaboration:
  topology: review-loop
  agents: [coder, reviewer]
  max_iterations: 3
```

**演示的核心模式：** 使用最少的配置启动 `review-loop` 拓扑。父角色先派发给 Coder，Coder 的输出传递给 Reviewer，Reviewer 可以发回 Coder 进行修改。`max_iterations: 3` 是全局安全上限——3 轮循环后工作流自动结束。

### review-team-approval（审批版）

**文件：** `rolebox/examples/review-team-approval/role.yaml`

```yaml
collaboration:
  topology: review-loop
  agents: [coder, reviewer]
  max_iterations: 5
  termination:
    any_of:
      - { max_iterations: 5 }
      - result_matches:
          agent: reviewer
          contains: "APPROVED"
```

**演示的核心模式：** `termination.any_of` 接受条件数组——任意一个满足时终止。这里 Reviewer 输出包含 "APPROVED" 即满足条件。`max_iterations: 5` 是兜底，防止评审陷入僵局。

关键行为：一旦 Reviewer 说 "APPROVED"，工作流立即终止（当前轮次结束后）。不需要等到预设轮次用完。详见[终止条件](/04-Advanced/termination-conditions)。

### review-team-allof（全部条件版）

**文件：** `rolebox/examples/review-team-allof/role.yaml`

```yaml
collaboration:
  topology: review-loop
  agents: [coder, reviewer]
  max_iterations: 5
  termination:
    all_of:
      - { max_iterations: 2 }
      - result_matches:
          agent: reviewer
          contains: "APPROVED"
```

**演示的核心模式：** `termination.all_of` 要求所有条件同时满足。这里必须同时满足：至少 2 轮循环 + Reviewer 批准。不同于 `any_of`，这是**与**逻辑——所有条件都必须为真，终止才会触发。

典型场景：确保在批准前至少经过两轮审查迭代，防止过早批准。

### review-team-termination（收敛版）

**文件：** `rolebox/examples/review-team-termination/role.yaml`

```yaml
collaboration:
  topology: review-loop
  agents: [coder, reviewer]
  max_iterations: 5
  termination:
    any_of:
      - { max_iterations: 5 }
      - { converged: "reviewer confirms code quality is satisfactory" }
```

**演示的核心模式：** `converged` 条件通过语义判断是否收敛——当条件字符串描述的状态变为真时触发。与 `result_matches` 的流式文本匹配不同，`converged` 是运行时评估的字符串条件。细节参见[终止条件](/04-Advanced/termination-conditions#converged)。

### review-team-stuck（死锁检测版）

**文件：** `rolebox/examples/review-team-stuck/role.yaml`

```yaml
collaboration:
  topology: review-loop
  agents: [coder, reviewer]
  max_iterations: 10
  termination:
    any_of:
      - { max_iterations: 10 }
      - { stuck: { repeats: 2 } }
```

**演示的核心模式：** `stuck` 条件检测循环何时陷入死锁——当同一个代理连续 `repeats: 2` 次产生相同输出时触发。这防止了无线循环：如果 Reviewer 连续两次拒绝并给出相同的反馈，工作流终止。

这是失败安全模式的核心。初始循环上限设为 10 次以防止无限运行，但死锁检测通常在 4-6 轮内就能触发，实际循环次数远低于上限。

### review-team-custom（自定义流版）

**文件：** `rolebox/examples/review-team-custom/role.yaml`

```yaml
name: Custom Pipeline Lead
description: Custom multi-step workflow
subagents:
  - name: Researcher
    description: Researches topics
    prompt: You research and summarize.
  - name: Writer
    description: Writes content
    prompt: You write clear content.
  - name: Editor
    description: Edits for quality
    prompt: You edit for clarity and correctness.
collaboration:
  flow:
    - "parent -> researcher"
    - "researcher -> writer: research findings"
    - "writer -> editor: draft content"
    - from: editor
      to: writer
      label: revision requests
    - from: editor
      to: parent
      label: approved
      exit: true
  max_iterations: 2
```

**演示的核心模式：**

| 模式 | 说明 |
|------|------|
| `flow` 自定义流 | 完全手动定义工作流，替代内置拓扑。每条边为一个步骤 |
| 标签边 | `label` 字段为数据流添加语义标签（如 `research findings`、`draft content`） |
| `exit: true` | 标记边使工作流在到达该步骤后终止 |
| 分支流 | Editor 可以发回 Writer（修订）或发送给 parent（批准），取决于输出 |

自定义流是协作图中最灵活的模式，用于非循环拓扑或内置拓扑不能覆盖的场景。

**参考链接：**
- [协作图](/02-Guide/collaboration-graph) — 内置拓扑、自定义流、完整 schema
- [终止条件](/04-Advanced/termination-conditions) — `any_of` / `all_of`、条件类型详解
- [子代理](/02-Guide/subagents) — 多代理 dispatch 的基础

::: tip 最佳学习路径
从 **code-reviewer** 开始（10 行 YAML，零子代理），然后尝试 **team-lead**（引入子代理 dispatch），最后探索 **review-team** 系列（协作图与终止条件）。每个示例都在前一个的基础上增加一个核心概念。所有示例的完整代码在 [rolebox/examples](https://github.com/EricMoin/rolebox/tree/main/examples)。
:::

## 一览：模式对照表

| 组件 | 示例文件 | 关键语法 |
|------|----------|----------|
| 简单 subagent | `code-reviewer/role.yaml` | `mode: subagent` |
| 预设变体 | `code-reviewer/role.yaml` | `variant: thorough` |
| 角色技能 | `code-reviewer/role.yaml` | `skills: [review-checklist]` |
| 全局技能 | `tech-writer/role.yaml` | `opencode_skills: [humanizer]` |
| 内联子代理 | `team-lead/role.yaml` | `subagents: [{name, prompt}]` |
| 子代理级配置覆盖 | `team-lead/role.yaml` | `subagents[].temperature` |
| 自定义 Hook | `hooks/no-console-log.js` | `export default { onToolAfter }` |
| review-loop 拓扑 | `review-team/role.yaml` | `topology: review-loop` |
| 审批终止 | `review-team-approval/role.yaml` | `termination.any_of[]` + `result_matches` |
| 全部条件 | `review-team-allof/role.yaml` | `termination.all_of[]` |
| 收敛检测 | `review-team-termination/role.yaml` | `converged: "..."` 字符串条件 |
| 死锁检测 | `review-team-stuck/role.yaml` | `stuck: { repeats: 2 }` |
| 自定义流 | `review-team-custom/role.yaml` | `flow: [...]` + `exit: true` |
| 权限白名单 | `code-reviewer/role.yaml` | `permission.allow: [Read, Grep, ...]` |

## 下一步

现在你已经浏览了所有示例，接下来可以：

- 从最简单的一个入手：将 `code-reviewer/role.yaml` 复制到你的角色目录并尝试使用
- 动手创建一个角色：[创建角色](/02-Guide/create-a-role)
- 如果想为角色增加专业知识：[引用文档](/02-Guide/references)
- 如果想为角色增加可复用的指令：[编写技能](/02-Guide/authoring-skills)
- 如果想为角色增加多代理协作：[协作图](/02-Guide/collaboration-graph)
- 如果想深入每个字段的行为：[角色 YAML 参考](/03-Reference/role-yaml)
