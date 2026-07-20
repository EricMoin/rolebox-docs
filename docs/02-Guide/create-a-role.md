---
title: 创建角色
description: 使用 role.yaml 声明式定义 AI 代理角色的完整指南
---

# 创建角色

> **相关文档：** [目录结构](/01-Overview/directory-structure) — 角色目录与文件布局 | [role.yaml 参考](/03-Reference/role-yaml) — 完整字段参考 | [子代理](/02-Guide/subagents) — 多代理协作

rolebox 通过 YAML 文件声明式定义 AI 代理角色。每个角色由一个目录和其中的 `role.yaml` 文件表示。

## 快速开始

创建一个角色目录和 `role.yaml`：

```bash
mkdir -p ~/.config/opencode/rolebox/copywriter
```

```yaml
# ~/.config/opencode/rolebox/copywriter/role.yaml
name: Copywriter
description: Writes concise, punchy copy.
prompt: |
  You are a copywriter. Short sentences. No jargon. Every word earns its place.
```

重启 opencode 后，该角色会出现在代理列表中。

## 角色模板对比

rolebox 提供三种角色模板，适用于不同的复杂度和场景：

| 维度 | 简单角色 (Simple) | Director 门控角色 | 嵌套状态机角色 |
|------|-------------------|-------------------|----------------|
| **适用场景** | 单一任务代理 | 需要审批/阶段转换 | 多函数协作编排 |
| **复杂度** | 低 | 中 | 高 |
| **YAML 字段** | name, description, prompt | + functions, hooks | + subagents, collaboration, graph |
| **函数数量** | 0（使用内置） | 1-3 个自定义 | 3+ 自定义 |
| **协作图** | 无 | 无 | 需要定义 |
| **状态管理** | 无 | gate + transition | 完整状态机 |

### 简单角色示例：代码审查员

```yaml
# rolebox/code-reviewer/role.yaml
name: Code Reviewer
description: Expert code reviewer
model: gpt-4
mode: subagent
temperature: 0.2
prompt: |
  You are an expert code reviewer. Review for correctness,
  performance, and readability. Be specific and actionable.
skills:
  - review-checklist
functions:
  - plan
permission:
  allow: [Read, Grep, Glob]
```

### 门控角色示例：带审批的审查流程

```yaml
# rolebox/review-team-approval/role.yaml
name: Review Team (Approval)
description: Multi-agent code review with approval gate
collaboration:
  topology: review-loop
  agents: [reviewer, lead]
  max_iterations: 5
  termination:
    any_of:
      - { max_iterations: 3 }
      - { result_matches: { agent: lead, contains: "APPROVED" } }
```

### 嵌套状态机角色示例：目录式子代理

```yaml
# rolebox/team-lead/role.yaml
name: Team Lead
description: Delegates work to specialist sub-agents
prompt: |
  You are a team lead. Coordinate work across your sub-agents.
subagents:
  - name: Implementer
    description: Writes production code
    prompt: You are a senior software engineer. Write clean, testable code.
    temperature: 0.1
```

文件式子代理定义在 `subagents/{name}/role.yaml` 目录中，支持嵌套递归发现（`src/loader/subagents.ts:234-325`）：

```yaml
# team-lead/subagents/researcher/role.yaml
name: Researcher
description: Finds and synthesizes information
prompt: |
  You are a research specialist. Find accurate, up-to-date information.
skills:
  - research-checklist
```

::: tip 模板选择速查
如果你不确定该选哪种模板，从**简单角色**开始——它只需要 name、description 和 prompt 三个字段。当你发现需要在多个子代理之间协调工作流时，再升级到 Director 门控角色或嵌套状态机角色。过度设计是 YAML 角色定义中最常见的陷阱，保持简单直到复杂度迫使你升级。
:::

## 模板选择指南

根据任务的编排复杂度选择合适的模板：

```
需要创建什么类型的角色？
├── 单一任务，无子代理
│   └── → 简单角色 (Simple)
│       ├── 仅需 prompt + skills，无函数
│       ├── 示例：tech-writer, code-reviewer
│       └── YAML: name + description + prompt (± skills)
│
├── 需要子代理 + 协作流程，带审批门控
│   └── → Director 门控角色
│       ├── 声明 subagents + collaboration topology
│       ├── 支持 termination 条件（any_of / all_of）
│       ├── 示例：review-team-approval, review-team-allof
│       └── YAML: 添加 collaboration, termination
│
└── 需要多函数编排 + 嵌套子代理 + 状态机
    └── → 嵌套状态机角色 (Nested FSM)
        ├── 支持文件式子代理 (subagents/{name}/role.yaml)
        ├── 支持递归嵌套发现 (maxDepth=3)
        ├── 函数级 gate/transition/continue_until
        ├── 示例：team-lead (含 researcher 子代理)
        └── YAML: subagents + functions + graph
```

### 决策要点

| 决策因素 | 简单角色 | Director 门控 | 嵌套状态机 |
|----------|---------|---------------|-----------|
| 子代理数量 | 0 | 1-3 个内联 | 3+，可文件式 |
| 协作拓扑 | 无 | review-loop | 自定义 flow |
| 函数 gate/transition | 不需要 | 可选 | 核心机制 |
| 多轮审批 | 不支持 | 内置 | 配合函数实现 |
| 嵌套子代理 | 不支持 | 不支持 | 支持 |

## 完整 schema 字段

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `name` | string | 是 | 角色名称 |
| `description` | string | 是 | 角色描述，显示在代理列表中 |
| `prompt` | string | 否 | 系统提示（与 `prompt_file` 互斥） |
| `prompt_file` | string | 否 | 外部提示文件路径 |
| `model` | string | 否 | 模型标识（如 `gpt-4`、`claude-3-sonnet`） |
| `mode` | string | 否 | `primary` / `subagent` / `all`，默认 `primary` |
| `temperature` | number | 否 | 0.0 - 2.0 |
| `top_p` | number | 否 | 0.0 - 1.0 |
| `color` | string | 否 | UI 颜色 |
| `version` | string | 否 | 语义化版本 |
| `functions` | string[] | 否 | 启用函数（与内置合并，非替换） |
| `disable_functions` | string[] | 否 | 禁用特定内置函数 |
| `skills` | string[] | 否 | 角色级技能引用 |
| `opencode_skills` | string[] | 否 | 全局技能引用 |
| `references` | object | 否 | 显式引用声明 |
| `subagents` | array | 否 | 内联子代理定义 |
| `hooks` | object | 否 | 自定义 hook 配置 |
| `collaboration` | object | 否 | 协作图配置 |
| `dispatch` | object | 否 | 调度配置覆盖 |
| `permission` | object | 否 | 工具权限控制 |

## 函数配置

`functions:` 字段与内置默认值**合并**而非替换：

```yaml
functions:
  - plan                   # 内置 — 明确列出
  - review                 # 自定义函数
  - my-custom-fn           # 从 roleDir/functions/ 加载

# 禁用特定内置函数
disable_functions:
  - execute                # 从最终集合中移除 execute
```

行为规则（来自 `docs/functions.md:85-89`）：
- `functions: [my-fn]` → 启用 = `[plan, execute, loop, my-fn]`（合并去重）
- `functions: [plan, my-fn]` → 启用 = `[plan, execute, loop, my-fn]`（重复项移除）
- `disable_functions: [execute]` → 从合并结果中移除 execute
- 未声明 `functions:` 字段时，默认使用 `[plan, execute, loop]`

## 环境变量插值

在 role.yaml 中使用 `{env:VARIABLE_NAME}` 语法进行环境变量插值，启动时解析：

```yaml
model: "{env:PREFERRED_MODEL}"
prompt: |
  You work for {env:COMPANY_NAME}, a {env:INDUSTRY} company.

dispatch:
  maxConcurrent: "{env:DISPATCH_CONCURRENCY}"
```

插值规则：
- 不存在的环境变量会保留为字面字符串（`{env:UNDEFINED_VAR}`）
- 支持嵌套在字符串中的任意位置
- 解析发生在启动阶段 `src/resolver/env-resolver.ts`

## 模式选择

角色通过 `mode` 字段控制行为模式：

| 模式 | 值 | 行为 |
|------|-----|------|
| **auto** | `mode: primary` (默认) | 自动选择模式：单代理使用 simple，多代理使用 appropriate |
| **plan** | 函数驱动 | 通过 `\|plan\|` 函数激活规划阶段，需要用户审批后进入执行 |
| **default** | 无特殊模式 | 内置 `plan`、`execute`、`loop` 函数始终可用 |

模式的行为差异：
- **auto** 模式：根据 `subagents` 和 `collaboration` 的存在自动决定
- **plan** 模式：需要显式使用 `|plan|` 激活规划工作流
- **default** 模式：函数按需激活，无预设编排

## 子代理字段继承规则

子代理**不会自动继承**父角色的字段（`src/loader/subagents.ts:91-137`，`buildSubAgentFields`）。每个子代理必须显式声明其配置：

### 可显式继承的字段

| 字段 | 类型 | 继承行为 |
|------|------|----------|
| `name` | string | **必需** — 子代理的唯一标识符 |
| `description` | string | 可选，默认为空字符串 |
| `prompt` / `prompt_file` | string | **必需** — 二选一提供 |
| `model` | string | 可选，不继承父角色的 model |
| `color` | string | 可选，不继承父角色的 color |
| `temperature` | number | 可选，不继承父角色的 temperature |
| `top_p` | number | 可选，不继承父角色的 top_p |
| `permission` | object | 可选，不继承父角色的 permission |
| `tools` | object | 可选，不继承父角色的 tools |
| `skills` | string[] | 可选，不继承父角色的 skills |
| `opencode_skills` | string[] | 可选，不继承父角色的 opencode_skills |
| `functions` | string[] | 可选，不继承父角色的 functions |
| `disable_functions` | string[] | 可选，不继承父角色的 disable_functions |
| `auto_activate` | string[] | 可选，子代理自动激活的函数 |
| `locked` | boolean | 可选，锁定子代理配置 |

### 继承原则

1. **零自动继承**：父角色的 `model`、`temperature`、`skills`、`permission` 等不会传播到子代理
2. **显式声明**：子代理只需要声明与其父角色不同的字段
3. **嵌套继承**：内联子代理可以拥有自己的 `subagents`，形成递归嵌套（`src/loader/subagents.ts:162-174`）
4. **文件式发现**：子代理可以通过 `subagents/{name}/role.yaml` 文件定义，支持 `maxDepth=3` 的递归发现（`src/loader/subagents.ts:234-325`）

```yaml
# 父角色 — 声明 model 和 permission，但子代理不会继承
name: Team Lead
model: gpt-4
permission:
  allow: [Read, Grep, Glob, Bash, Edit]
subagents:
  - name: Researcher
    description: Researches code patterns
    model: claude-3-haiku       # 必须显式声明
    prompt: Research the code...
    # Researcher 没有 Edit 权限 — 需要显式声明
```

## 权限配置

```yaml
permission:
  allow:
    - Read
    - Grep
  deny:
    - Bash
tools:
  Bash: false
```

## 完整示例

```yaml
name: Team Lead
description: Orchestrates multi-agent code review
model: gpt-4
mode: primary
prompt: |
  You are a team lead. Coordinate reviewer and researcher
  agents to deliver comprehensive code reviews.
skills:
  - review-checklist
functions:
  - plan
  - execute
references:
  api-spec: references/api-spec.md
subagents:
  - name: researcher
    description: Researches code patterns
    prompt: Research the relevant code...
hooks:
  custom:
    - name: quality-check
      events: [tool.execute.after]
      module: hooks/quality-checker.js
      phase: after
permission:
  allow: [Read, Grep, Glob, Bash, Edit]
```

## 常见模式

### 模式 1：只读代理（Read-only Agent）

适用于代码审查、文档分析等只需读取不修改的场景：

```yaml
name: Code Reviewer
description: Reviews code — read-only by design
prompt: |
  You are a code reviewer. Read and analyze code.
  Do NOT modify any files.
permission:
  allow: [Read, Grep, Glob, LSP]
  deny: [Edit, Write, Bash]
```

### 模式 2：写能力代理（Write-capable Agent）

适用于需要修改代码、创建文件的开发代理：

```yaml
name: Implementer
description: Writes production code
prompt: |
  You are a senior engineer. Write clean, testable code.
permission:
  allow: [Read, Grep, Glob, Bash, Edit, Write]
functions:
  - plan
  - execute
```

### 模式 3：编排代理（Orchestrator）

适用于协调多子代理工作流的管理角色：

```yaml
name: Team Lead
description: Coordinates specialist sub-agents
prompt: |
  You are a team lead. Delegate tasks to sub-agents.
subagents:
  - name: Researcher
    description: Researches code patterns
    prompt: Research the relevant code...
    permission:
      allow: [Read, Grep, Glob]
  - name: Implementer
    description: Writes production code
    prompt: Implement the approved solution...
    permission:
      allow: [Read, Grep, Glob, Bash, Edit]
collaboration:
  topology: review-loop
  agents: [researcher, implementer]
  max_iterations: 5
  termination:
    any_of:
      - { max_iterations: 5 }
      - { result_matches: { agent: implementer, contains: "DONE" } }
```

## 常见配方

以下配方覆盖从简单到复杂的常见角色创建场景。每个配方包含完整的 YAML 配置、预期行为以及排查指引。

### 配方 1：10 行创建一个代码审查者

**问题陈述：** 你想用最少的配置创建一个专注于代码审查的角色。不需要子代理，不需要协作图，只需一个能回答问题、阅读文件和检查代码的代理。

**YAML 配置**（保存到 `~/.config/opencode/rolebox/code-reviewer/role.yaml`，来源：`examples/code-reviewer/role.yaml`）：

```yaml
name: Code Reviewer
description: Expert code reviewer
model: gpt-4
mode: subagent
temperature: 0.2
prompt: |
  You are an expert code reviewer. Review code for correctness,
  performance, and readability. Be specific and actionable.
skills:
  - review-checklist
permission:
  allow: [Read, Grep, Glob]
```

**预期行为：**
1. 重启 opencode 后，"Code Reviewer" 出现在代理列表中
2. 激活后，代理仅拥有读取权限（Read、Grep、Glob），无法修改代码
3. 你可以提出审查请求，如"|execute| 审查 src/auth.ts 的认证逻辑"

**出错时检查什么：**
- `~/.config/opencode/rolebox/code-reviewer/role.yaml` 路径是否正确
- YAML 缩进是否正确（使用两个空格缩进）
- `mode: subagent` 确保该角色以子代理模式运行
- 如果代理列表中没有出现，运行 `rolebox list` 确认角色已注册

### 配方 2：创建带 3 个专家的团队负责人

**问题陈述：** 你需要一个团队主管角色来协调多个专家子代理——调研员（Researcher）、实现者（Implementer）和审查员（Reviewer）——组成一个完整的代码审查流水线。

**YAML 配置**（保存到 `~/.config/opencode/rolebox/review-team-lead/role.yaml`，基于 `examples/review-team-approval/role.yaml` 和 `examples/team-lead/role.yaml`）：

```yaml
name: Review Team Lead
description: Coordinates 3 specialist sub-agents for code review
model: gpt-4
prompt: |
  You are a team lead. Dispatch work to the appropriate specialist
  using the collaboration graph.
subagents:
  - name: Researcher
    description: Researches code patterns and context
    prompt: |
      You are a research specialist. Find relevant code patterns,
      API usage, and design decisions. Provide context.
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
      When satisfied, include "APPROVED" in your response.
    permission:
      allow: [Read, Grep, Glob]
collaboration:
  topology: review-loop
  agents: [researcher, implementer, reviewer]
  max_iterations: 5
  termination:
    any_of:
      - { max_iterations: 5 }
      - result_matches:
          agent: reviewer
          contains: "APPROVED"
```

**预期行为：**
1. 团队主管接收任务后，通过 `dispatch` 将调研工作委派给 Researcher
2. Researcher 返回调研结果后，主管将实现任务委派给 Implementer
3. Implementer 完成代码修改后，主管将审查任务委派给 Reviewer
4. Reviewer 返回 `"APPROVED"` 时流程自动终止（来源：`examples/review-team-approval/role.yaml:23-24`）
5. 若 5 轮迭代后仍未批准，也自动终止（来源：`examples/review-team-approval/role.yaml:22`）

**出错时检查什么：**
- 子代理的 `permission` 是否正确——Implementer 需要 `Edit` 和 `Write`，而 Researcher 和 Reviewer 不需要
- 每个子代理的 `prompt` 是否非空（空 prompt 会导致子代理返回空结果）
- `collaboration.agents` 中的名称是否与 `subagents` 下的 `name` 完全匹配（`review-team-approval/role.yaml:18`）
- 子代理不会自动继承父角色的 `model`，每个子代理需显式声明（`create-a-role.md:232-235`）

### 配方 3：创建只读文档代理

**问题陈述：** 你需要一个仅限读取的文档代理，可以阅读项目文件、搜索代码库、撰写技术文档——但绝不能修改任何文件。

**YAML 配置**（保存到 `~/.config/opencode/rolebox/tech-writer/role.yaml`，基于 `examples/tech-writer/role.yaml` 和文档的"只读代理"模式 `create-a-role.md:316-329`）：

```yaml
name: Tech Writer
description: Technical documentation specialist — read-only
prompt: |
  You are a technical writer specializing in clear, concise documentation.
  Write documentation that is accurate, well-structured, and easy to
  understand. Read the codebase to understand the feature, then write
  docs. You may NOT edit any files.
opencode_skills:
  - humanizer
permission:
  allow: [Read, Grep, Glob, LSP]
  deny: [Edit, Write, Bash]
```

**预期行为：**
1. 代理可以阅读任意文件、搜索代码模式、使用 LSP 分析代码
2. 代理**不能**编辑文件、创建文件或运行命令
3. `humanizer` 技能使其输出更接近人类写作风格（来源：`examples/tech-writer/role.yaml:6-7`）
4. 适合与 `|plan|` 搭配使用："|plan| 阅读 API 模块并为新端点编写文档"

**出错时检查什么：**
- `permission.deny` 中包含 `Edit`、`Write` 和 `Bash`，确保代理不会意外修改文件
- 如果代理需要运行测试或查看构建输出，移除 `deny` 中的 `Bash`
- `opencode_skills` 引用的是全局技能（`humanizer`），角色级 skill 用 `skills` 字段
- 如果不需要自然语言润色，可以删除 `opencode_skills` 行

## 下一步

- [函数系统](/02-Guide/functions) — 内置函数与函数系统详解
- [编写函数](/02-Guide/writing-functions) — 自定义函数定义
- [编写技能](/02-Guide/authoring-skills) — 技能模块开发
- [自定义 Hook](/02-Guide/custom-hooks) — Hook 扩展开发
- [角色 YAML 参考](/03-Reference/role-yaml) — 完整 schema 参考
