---
title: role.yaml 参考
description: role.yaml 的完整字段参考——每个顶层键的类型、必需性、默认值与示例，以及子代理、Hook、调度等嵌套块的结构
---

# role.yaml 参考（Role Configuration）

`role.yaml` 声明一个角色的一切：它是谁、用什么模型、加载哪些技能与函数、可以调度哪些子代理，以及 Hook、调度与扩展设置。本页逐个给出顶层键的类型、必需性、默认值与示例，并说明嵌套块的结构。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[调度配置](/03-Reference/dispatch-config)｜[模型别名](/03-Reference/model-aliases)｜[子代理](/02-Guide/subagents)｜[Hook 机制](/03-Reference/hooks)｜[扩展机制](/03-Reference/extensions)

## 最小示例

只有 `name` 和提示词（`prompt` / `prompt_file` 二者之一）是硬性要求。文件放在 `{角色目录}/role.yaml`，**角色 id 就是那个目录名**。

```yaml
name: code-reviewer
description: 严格的代码评审者
prompt: |
  你是代码评审者。先读 diff，再给结论，最后列出必须修改的项。
```

以下情况该角色会被**跳过**（只记录一条日志，不影响其它角色加载）：YAML 解析失败、缺少非空的 `name`、既没有 `prompt` 也没有可读的 `prompt_file`、目录名包含 `--`（`--` 是子代理 id 的分隔符）。

## 完整骨架

按需删减即可得到一份可用的 `role.yaml`。标「必需」的键不能省。

```yaml
# ── 身份 ────────────────────────────────────────────────
name: code-reviewer                    # 必需
description: 严格的代码评审者           # 缺省为空字符串
version: "1.0.0"                       # 语义化版本号
color: "#4A90D9"                       # UI 标识色

# ── 提示词（二选一；都写时 prompt_file 优先）────────────
prompt: |
  你是代码评审者……
# prompt_file: PROMPT.md

# ── 模型与采样 ──────────────────────────────────────────
model: openrouter/anthropic/claude-sonnet-4   # provider/model-id
mode: primary                          # primary / subagent / all
variant: claude-3-sonnet-20240229      # 模型变体标识
temperature: 0.3                       # 0.0 - 2.0
top_p: 0.9                             # 0.0 - 1.0

# ── 能力 ────────────────────────────────────────────────
skills: [review-checklist]             # 角色目录 skills/ 下的技能
opencode_skills: []                    # harness 全局技能目录下的技能
functions: [security-scan]             # 追加到默认函数之上（合并语义）
disable_functions: [loop]              # 从最终函数集合中移除
auto_activate: []                      # 会话启动即激活，无需 |name| 语法
locked: false                          # 为真时 auto_activate 不可被停用
references:
  style-guide: references/style-guide.md
  api-spec:
    path: references/api-spec.md
    description: 对外 API 契约

# ── 子代理与开放角色 ────────────────────────────────────
subagents:
  - name: reviewer
    description: 复核实现
    prompt: |
      你负责复核上一棒的改动……
open: false                            # 为真时成为开放角色
exports: []                            # 开放角色对外暴露的子代理
open_roles: []                         # 允许发现并调度的开放角色 id

# ── 编排与调度 ──────────────────────────────────────────
graph:
  orchestration: graph_v2              # 目前唯一识别的选择器
dispatch:
  backgroundStaleTimeoutMs: 900000
  syncPromptTimeoutMs: 600000

# ── 权限 ────────────────────────────────────────────────
permission:
  allow: [Read, Grep]
  deny: [Bash]
tools:
  Bash: false

# ── Hook 与恢复 ─────────────────────────────────────────
hooks:
  builtin:
    recovery: true                     # 恢复引擎主开关
    bash_file_read_guard: false        # 护栏类默认关闭
  recovery:
    enabled: true
    max_total_attempts: 10

# ── 回合结束、记忆、通知、扩展 ──────────────────────────
copilot:
  enabled: false
  rules: []
memory:
  inject: true
  max_inject: 10
  min_relevance: medium
  scope: both
notifications:
  enabled: true                        # 角色级通知覆盖
extensions: {}                         # 7 种作用域，见扩展机制
```

## 顶层字段

### 身份

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `name` | `string` | 是 | — | `name: code-reviewer` | 角色的人类可读名称，用于 UI、日志与代理标识 |
| `description` | `string` | 否 | `""` | `description: 严格的代码评审者` | 选择角色时显示的简短说明 |
| `version` | `string` | 否 | — | `version: "1.2.0"` | 语义化版本号，供注册中心做版本管理 |
| `color` | `string` | 否 | — | `color: "#4A90D9"` | UI 中区分角色的标记色 |

### 提示词

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `prompt` | `string` | 与 `prompt_file` 二选一 | — | `prompt: \|\n  你是……` | 内联的系统提示词 |
| `prompt_file` | `string` | 与 `prompt` 二选一 | — | `prompt_file: PROMPT.md` | 外部提示词文件，相对角色目录解析 |

### 模型与采样

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `model` | `string` | 否 | 全局默认模型 | `model: openrouter/anthropic/claude-sonnet-4` | 规范的 `provider/model-id`；provider 是第一个 `/` 之前的部分 |
| `mode` | `string`（`primary` / `subagent` / `all`） | 否 | `primary` | `mode: subagent` | 能否被选为主角色 |
| `variant` | `string` | 否 | — | `variant: claude-3-sonnet-20240229` | 同一模型的不同配置项 |
| `temperature` | `number`（0.0–2.0） | 否 | — | `temperature: 0.3` | 采样温度，越低越确定 |
| `top_p` | `number`（0.0–1.0） | 否 | — | `top_p: 0.9` | 核采样阈值 |

### 能力

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `skills` | `string[]` | 否 | `[]` | `skills: [review-checklist]` | 角色目录 `skills/` 下的本地技能 |
| `opencode_skills` | `string[]` | 否 | `[]` | `opencode_skills: [humanizer]` | 当前 harness 配置目录下全局技能目录里的技能 |
| `functions` | `string[]` | 否 | `[]` | `functions: [security-scan]` | **追加**到默认函数 `plan` / `execute` / `loop` 之上 |
| `disable_functions` | `string[]` | 否 | `[]` | `disable_functions: [loop]` | 从最终函数集合中移除指定函数 |
| `auto_activate` | `string[]` | 否 | `[]` | `auto_activate: [security-guard]` | 会话启动即激活，无需 `\|name\|` 语法 |
| `locked` | `boolean` | 否 | `false` | `locked: true` | 为真时 `auto_activate` 的函数不可被停用 |
| `references` | `Record<string, string \| { path, description? }>` | 否 | `{}` | `references: { api-spec: references/api-spec.md }` | 显式声明引用文档；自动发现的引用无需声明 |

### 团队与编排

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `subagents` | `SubAgentConfig[]` | 否 | `[]` | 见上方骨架 | 内联或文件式声明的子代理，递归上限 3 层 |
| `open` | `boolean` | 否 | `false` | `open: true` | 成为开放角色，可把子代理暴露给消费者 |
| `exports` | `string[]` | 否 | — | `exports: [reviewer]` | 开放角色要暴露的子代理名称；缺省只暴露角色 id |
| `open_roles` | `string[]` | 否 | — | `open_roles: [design-system]` | 允许发现并调度的开放角色（producer）id |
| `graph` | `GraphRoleConfig` | 否 | — | `graph: { orchestration: graph_v2 }` | 图编排选择器 |
| `dispatch` | `DispatchRoleConfig` | 否 | — | 见[调度配置](/03-Reference/dispatch-config) | 覆盖子代理调度的两个超时 |

### 治理与集成

| 键 | 类型 | 必需 | 默认值 | 示例 | 说明 |
|---|---|---|---|---|---|
| `permission` | `PermissionConfig` | 否 | — | `permission: { deny: [Bash] }` | 工具级 `allow` / `deny` 列表 |
| `tools` | `Record<string, boolean>` | 否 | — | `tools: { Bash: false }` | 按工具名开关，等价于 `permission` 的另一种写法 |
| `hooks` | `HooksBlock` | 否 | — | `hooks: { builtin: { recovery: true } }` | 内置 Hook 开关、自定义 Hook 与恢复配置 |
| `notifications` | `NotificationConfig` | 否 | — | `notifications: { enabled: false }` | 会话生命周期通知：通道、事件、静默时段 |
| `copilot` | `CopilotConfig` | 否 | `enabled: false`、`rules: []` | `copilot: { enabled: true }` | 回合结束决策流水线 |
| `memory` | `MemoryConfig` | 否 | `inject: true`、`max_inject: 10` | `memory: { inject: false }` | 角色级记忆注入行为 |
| `extensions` | `ExtensionConfig` | 否 | — | `extensions: { conditions: [...] }` | 注册自定义扩展模块（7 种作用域） |

## 逐块说明

### 提示词：`prompt_file` 优先于 `prompt`

两者都写不会报错：加载器先读 `prompt_file`，读不到才回退到 `prompt`。因此把长提示词放进单独的 `PROMPT.md` 并只声明 `prompt_file` 是最常见的做法。`prompt_file` 相对**角色目录**解析，内容同样会被环境变量插值处理。

### 函数：`functions` 是合并，不是替换

默认函数 `plan` / `execute` / `loop` 始终存在，`functions` 只是在它们之上追加；要从集合里去掉某个函数，只能写进 `disable_functions`。

```yaml
functions:
  - plan
  - security-scan
disable_functions:
  - loop
```

### 引用：显式声明与自动发现

`references` 只用于**补充**说明：角色目录 `references/` 下的文档会被自动发现，无需声明。需要给引用加描述或指向目录之外的路径时才写这个键。

```yaml
references:
  style-guide: references/style-guide.md
  api-spec:
    path: docs/api-spec.md
    description: 对外 API 契约
```

### 子代理：内联、文件式与继承

子代理既可以内联在 `subagents` 下，也可以按 `subagents/{name}/role.yaml` 的目录约定声明——两种方式可以混用，同名时以**内联**为准。子代理字段与顶层同形，并额外支持递归嵌套（上限 3 层）。

```yaml
subagents:
  - name: coder
    description: 实现改动
    prompt: |
      你负责实现……
  - name: reviewer
    description: 复核实现
    prompt: |
      你负责复核……
```

可继承的字段只有 `model`、`color`、`variant`、`temperature`、`top_p`、`permission`、`tools`：子代理没写时继承父角色的值，其余字段（提示词、技能、函数、子代理）不继承，必须自己声明。命名与调度的细节见[子代理](/02-Guide/subagents)。

### 开放角色：`open` / `exports` / `open_roles`

这是一套跨角色发现机制：producer 声明 `open: true` 并用 `exports` 列出要公开的子代理；consumer 用 `open_roles` 列出它想调度的 producer id。

```yaml
# producer 侧
open: true
exports:
  - reviewer
```

```yaml
# consumer 侧
open_roles:
  - design-system
```

`exports` 里的名称按 slug（小写、空白转连字符）做大小写与空白不敏感匹配：匹配不到子代理的名称会被记录警告并丢弃，不会导致加载失败。`open_roles` 里不存在的 producer id 同样记录警告并跳过，重复声明会被折叠。`open: false`（或缺省）时角色保持私有，只有角色 id 可被寻址。

### 图编排选择器：`graph`

`graph` 只接受一个键 `orchestration`，当前唯一识别 `graph_v2`。它记录的是角色希望用哪个编排引擎；多代理工作流本身由命令式的图工具构建，见[图工作流](/02-Guide/graph-workflows)与[图声明参考](/04-Advanced/graph-declaration)。

### 调度覆盖：`dispatch`

`dispatch` 只接受两个毫秒级超时字段，用于覆盖子代理调度的默认值。其余调度参数（含预算上限）属于编程式配置，不能写在这里——完整边界见[调度配置](/03-Reference/dispatch-config)。

```yaml
dispatch:
  backgroundStaleTimeoutMs: 900000
  syncPromptTimeoutMs: 600000
```

### Hook：`hooks.builtin` 与 `hooks.custom`

`hooks.builtin` 是一组布尔开关，控制内置的恢复型 Hook；`hooks.custom` 声明自定义 Hook 模块。开关的默认值分两档：

| 键 | 默认值 | 作用 |
|---|---|---|
| `recovery` | `true` | 总开关：为 false 时不创建恢复引擎，其余开关一并失效 |
| `session_error`、`edit_error`、`json_error`、`context_window`、`empty_response` | `true` | 错误恢复型 Hook |
| `tool_pair_validation`、`write_existing_file_guard`、`bash_file_read_guard`、`webfetch_redirect_guard` | `false` | 护栏型 Hook，需要显式开启 |

`hooks.custom` 的字段（`name` / `description` / `events` / `module` / `config` / `filter` / `priority` / `phase`）见 [Hook 机制](/03-Reference/hooks)。

> 多个角色同时声明开关时按「显式 true 优先」合并：任一角色写了 `true` 就生效，单个角色无法关掉别的角色已开启的 Hook。

### 恢复配置：`hooks.recovery`

恢复配置**嵌在 `hooks` 下**（不是顶层键）。它控制恢复引擎的总行为，并按错误类别覆盖策略链。

```yaml
hooks:
  recovery:
    enabled: true
    max_total_attempts: 15
    persist_state: true
    collect_metrics: true
    session_error:
      chain:
        - strategy: retry
          config:
            max_retries: 3
            backoff_ms: 1000
        - strategy: abort
          config:
            message: 会话恢复失败
```

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enabled` | `boolean` | `true` | 总开关；为 false 时不运行任何恢复策略 |
| `max_total_attempts` | `number` | `10` | 单会话内所有类别的恢复尝试总上限 |
| `persist_state` | `boolean` | `true` | 是否把恢复状态持久化到磁盘 |
| `collect_metrics` | `boolean` | `true` | 是否收集恢复指标 |
| `<错误类别>` | `{ chain: [...], enabled?: boolean }` | 内置默认链 | 覆盖该类别的策略链；`enabled` 缺省为 true |

可用的错误类别：`session_error`、`context_window`、`edit_error`、`json_error`、`empty_response`、`tool_pair`、`guard_violation`。可用的策略名：`retry`、`compact`、`fallback_model`、`abort`、`remind_and_retry`、`truncate`、`summarize`；未知策略名会被记录警告并跳过，不会导致加载失败。某个类别没有声明 `chain` 时回落到内置默认链，声明了就**完全替换**该类别的默认链。

两条边界：恢复引擎只在 opencode 上装配，pi 与 dsh 下这份配置不生效（见[平台与 Harness](/01-Overview/platform-harnesses)）；进程内只采用**第一个**声明了 `hooks.recovery` 的角色的配置。

### 回合结束决策：`copilot`

`copilot` 用有序规则（或可选的 LLM 判定）决定一个回合结束后是继续、跳过、阻塞还是完成。默认关闭。

```yaml
copilot:
  enabled: true
  rules:
    - id: ask-continue
      match:
        contains: "继续吗？"
      action: continue          # continue / skip / blocked / done
      reply: 继续
  llm:
    role: judge
    max_verdict_timeout_ms: 30000
```

规则按顺序求值、**首条命中生效**；每条规则需要 `id` 与至少一个匹配条件（`match.pattern` 正则或 `match.contains` 子串）。格式不合法的规则会被跳过并记录警告。省略 `llm` 时走纯启发式判定。

### 记忆注入：`memory`

```yaml
memory:
  inject: true          # 是否在系统提示中注入 <available_memory> 块（默认 true）
  max_inject: 10        # 最多注入多少条摘要（默认 10）
  min_relevance: medium # 注入的最低相关度：high / medium / low（默认 medium）
  scope: both           # 注入范围：role / workspace / both（默认 both）
```

### 通知与扩展的生效边界

`notifications` 与 `extensions` 的类型与结构分别见[通知机制](/04-Advanced/notification-system)与[扩展机制](/03-Reference/extensions)。需要知道的是：v1.9.0 的角色加载器只把上表列出的键复制进运行时配置，这两个块目前**不会被带进运行时**。全局通知改用环境变量 `ROLEBOX_NOTIFICATIONS_CONFIG` 指向的 YAML 文件配置；扩展模块的注册入口以[扩展机制](/03-Reference/extensions)为准。

## 环境变量插值

`role.yaml` 中任意字符串位置都可以写 `{env:变量名}`，在加载时解析；对象与数组会深度遍历。

```yaml
model: "{env:PREFERRED_MODEL}"
prompt: |
  你正在为 {env:COMPANY_NAME} 工作……
```

变量未设置时，占位符**原样保留**并记录一条日志，不会被替换成空字符串。

## 常见错误

1. **以为 `functions` 会替换默认函数** —— 它是合并；要移除 `plan` / `execute` / `loop` 必须写 `disable_functions`。
2. **把恢复配置写成顶层键** —— 正确位置是 `hooks.recovery`；写成顶层 `recovery:` 不会有任何效果。
3. **同时声明 `prompt` 与 `prompt_file`** —— 不报错，但 `prompt_file` 会静默盖掉 `prompt`。
4. **把预算字段塞进 `dispatch:`** —— 解析器只读两个超时键，预算属于编程式配置，见[调度配置](/03-Reference/dispatch-config)。
5. **角色目录名带 `--`** —— 该角色会被跳过加载；`--` 保留给子代理 id。

## 备注

> 自 v1.8.0 起，`role.yaml` 接受角色级 `graph:` 块；该键会被解析并记录一条警告，但尚未接入图解析，目前没有运行时效果。
