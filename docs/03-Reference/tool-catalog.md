---
title: 工具目录
description: Rolebox 全部内置工具的完整参考手册，按领域分组并提供参数说明、返回格式与代码示例
---

# 工具目录

> **相关文档：** [函数系统](/02-Guide/functions) — 函数与工具的区分 | [role.yaml 参考](/03-Reference/role-yaml) — 角色定义参考 | [CLI 参考](/03-Reference/cli) — 命令行工具

Rolebox 在运行时注册约 80 个内置工具，涵盖代码智能（LSP，语言服务器协议 Language Server Protocol）、会话管理、记忆存储、任务调度、资产查询、网络请求等能力域。这些工具相当于给大语言模型（Large Language Model，LLM）配备的"可调用操作库"——模型不直接操作文件或网络，而是通过调用工具完成具体动作，因此工具越丰富，模型能做的事就越多。每个工具均通过 `defineTool()`（`src/platform/ports/tool-factory.ts`）定义，使用 Zod Schema 声明参数，LLM 可直接调用。

## LSP 工具（代码智能）

> **v0.17.0 引入** — 32 个 LSP 协议工具，覆盖诊断、导航、补全、重构、格式化等能力（CHANGELOG.md:200）


共 32 个工具，通过 `createAllLspTools()`（`src/lsp/index.ts:117`）批量注册，基于 LSP 协议与编辑器语言服务器交互。**何时使用**：当你需要让模型"读懂代码"——查错误、跳转定义、找引用、补全、格式化——就交给这批工具。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `lsp_diagnostics` | 获取文件或全部打开文档的诊断信息（错误/警告/提示） | `src/lsp/tools/diags.ts` |
| `lsp_goto_definition` | 跳转到符号定义位置 | `src/lsp/tools/nav.ts` |
| `lsp_goto_type_definition` | 跳转到符号类型定义位置 | `src/lsp/tools/nav.ts` |
| `lsp_goto_implementation` | 跳转到符号实现位置 | `src/lsp/tools/nav.ts` |
| `lsp_goto_declaration` | 跳转到符号声明位置 | `src/lsp/tools/nav.ts` |
| `lsp_find_references` | 查找符号在全部文件中的引用 | `src/lsp/tools/nav.ts` |
| `lsp_document_highlights` | 高亮当前文件中符号的所有出现 | `src/lsp/tools/nav.ts` |
| `lsp_document_symbols` | 列出当前文件中定义的所有符号 | `src/lsp/tools/symbols.ts` |
| `lsp_workspace_symbols` | 搜索整个工作区的符号 | `src/lsp/tools/symbols.ts` |
| `lsp_hover` | 获取符号的类型签名与文档 | `src/lsp/tools/hover.ts` |
| `lsp_signature_help` | 获取函数/方法的参数签名信息 | `src/lsp/tools/hover.ts` |
| `lsp_completion` | 获取指定位置的代码补全建议 | `src/lsp/tools/completion.ts` |
| `lsp_prepare_rename` | 准备重命名符号（验证可行性） | `src/lsp/tools/rename.ts` |
| `lsp_rename` | 在工作区范围内重命名符号 | `src/lsp/tools/rename.ts` |
| `lsp_code_actions` | 获取指定范围的可用代码操作 | `src/lsp/tools/code-actions.ts` |
| `lsp_execute_code_action` | 按标题执行指定代码操作 | `src/lsp/tools/code-actions.ts` |
| `lsp_format_document` | 格式化整个文档 | `src/lsp/tools/format.ts` |
| `lsp_format_range` | 格式化指定范围 | `src/lsp/tools/format.ts` |
| `lsp_prepare_call_hierarchy` | 准备调用层级 | `src/lsp/tools/hierarchy.ts` |
| `lsp_incoming_calls` | 获取调用当前符号的调用者 | `src/lsp/tools/hierarchy.ts` |
| `lsp_outgoing_calls` | 获取当前符号调用的被调用者 | `src/lsp/tools/hierarchy.ts` |
| `lsp_type_hierarchy_supertypes` | 获取类型的父类型 | `src/lsp/tools/hierarchy.ts` |
| `lsp_type_hierarchy_subtypes` | 获取类型的子类型 | `src/lsp/tools/hierarchy.ts` |
| `lsp_folding_ranges` | 获取文档的折叠范围 | `src/lsp/tools/structure.ts` |
| `lsp_selection_ranges` | 获取指定位置的层级选择范围 | `src/lsp/tools/structure.ts` |
| `lsp_semantic_tokens` | 获取语义 Token（语法高亮信息） | `src/lsp/tools/structure.ts` |
| `lsp_code_lens` | 获取代码镜头（运行/测试命令） | `src/lsp/tools/lens.ts` |
| `lsp_inlay_hints` | 获取内联提示（类型/参数名） | `src/lsp/tools/lens.ts` |
| `lsp_document_links` | 获取文档中的可点击链接 | `src/lsp/tools/lens.ts` |
| `lsp_document_colors` | 获取文档中的颜色信息 | `src/lsp/tools/lens.ts` |
| `lsp_servers` | 列出所有 LSP 服务器及其状态 | `src/lsp/tools/server-mgmt.ts` |
| `lsp_restart_server` | 按语言 ID 重启指定 LSP 服务器 | `src/lsp/tools/server-mgmt.ts` |

> **参数详解为精选子集。** 上表为完整工具清单（全部 32 个，与 `createAllLspTools()` 注册一致）。下方仅对最常用的工具展开参数说明；其余工具的完整参数定义见对应定义文件中的 Zod schema。

### lsp_diagnostics

获取诊断信息。

**参数（`src/lsp/tools/diags.ts:16`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 否 | 文件绝对路径，省略时聚合所有打开文档 |
| `severity` | `"error" \| "warning" \| "information" \| "hint" \| "all"` | 否 | 最低严重级别过滤，默认 `"all"` |

**返回格式**: 格式化的诊断表格（文件名、行号、严重级别、消息）。

**示例**

```typescript
// 获取特定文件的全部错误
lsp_diagnostics({ filePath: "/project/src/app.ts", severity: "error" })
// → "File: file:///project/src/app.ts\n| Severity | Line | Message |\n| ..."

// 聚合所有打开文档的诊断
lsp_diagnostics({ severity: "warning" })
```

### lsp_goto_definition

跳转到符号定义。

**参数（`src/lsp/tools/nav.ts`，通过工具内的 Zod schema 定义）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `line` | `number` | 是 | 0-based 行号 |
| `character` | `number` | 是 | 0-based 字符偏移 |

**返回格式**: 格式化的位置列表（文件、行、列）。

### lsp_workspace_symbols

搜索工作区符号。

**参数（`src/lsp/tools/symbols.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `query` | `string` | 是 | 搜索查询 |

**返回格式**: 按符号种类分组的列表。

### lsp_find_references

查找符号引用。

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `line` | `number` | 是 | 0-based 行号 |
| `character` | `number` | 是 | 0-based 字符偏移 |
| `includeDeclaration` | `boolean` | 否 | 是否包含声明，默认 `true` |

**返回格式**: 位置列表 + 上下文代码片段。

### lsp_completion

获取代码补全。

**参数（`src/lsp/tools/completion.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `line` | `number` | 是 | 0-based 行号 |
| `character` | `number` | 是 | 0-based 字符偏移 |
| `maxItems` | `number` | 否 | 最大返回数，默认 20 |

**返回格式**: 补全项目列表（标签、类型、详情、文档）。

### lsp_code_actions

获取代码操作。

**参数（`src/lsp/tools/code-actions.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `startLine` | `number` | 是 | 起始行（0-based） |
| `startChar` | `number` | 是 | 起始字符（0-based） |
| `endLine` | `number` | 是 | 结束行（0-based） |
| `endChar` | `number` | 是 | 结束字符（0-based） |
| `kind` | `string` | 否 | 操作种类过滤（如 `"quickfix"`） |

### lsp_format_document / lsp_format_range

格式化文档。

**参数**（`lsp_format_document`）

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |

**返回格式**: 变更行数摘要或完整格式化内容。

### lsp_rename

重命名符号。

**参数（`src/lsp/tools/rename.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `line` | `number` | 是 | 0-based 行号 |
| `character` | `number` | 是 | 0-based 字符偏移 |
| `newName` | `string` | 是 | 新的符号名 |

**返回格式**: 修改的文件数量与编辑位置摘要。

### lsp_hover

获取悬浮信息。

**参数（`src/lsp/tools/hover.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `line` | `number` | 是 | 0-based 行号 |
| `character` | `number` | 是 | 0-based 字符偏移 |

**返回格式**: 类型签名与文档字符串。

### lsp_servers

列出 LSP 服务器状态。

**参数（`src/lsp/tools/server-mgmt.ts`）**

无参数。

**返回格式**: 服务器列表（语言 ID、状态、PID、运行时长）。

---

## 会话工具（Session Tools）

> **v0.17.0 引入** — 会话管理工具套件，共 6 个工具（CHANGELOG.md:198）


共 6 个工具，通过 `buildCanonicalTools()`（`src/platform/tool-assembly.ts:107-112`）注册。**何时使用**：当你想让模型回顾过去的对话、搜索某条历史消息，或把一段会话分叉成新分支时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `session_list` | 列出所有会话，支持日期过滤 | `src/session/session-browse-tools.ts` |
| `session_search` | 全文搜索会话消息 | `src/session/session-browse-tools.ts` |
| `session_read` | 读取会话完整转录 | `src/session/session-inspect-tools.ts` |
| `session_info` | 获取会话综合信息 | `src/session/session-inspect-tools.ts` |
| `session_diff` | 获取会话的变更差异 | `src/session/session-inspect-tools.ts` |
| `session_fork` | 在指定消息处分叉会话 | `src/session/session-inspect-tools.ts` |

**通用参数模式（通过 `ToolContext` 自动注入）**

会话工具使用 `ISessionClient` 接口操作 opencode 的会话存储。`directory` 参数通常从 `ToolContext` 自动获取，部分工具支持通过 `project_path` 显式指定。

### session_list

**参数（`src/session/session-browse-tools.ts:15`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `limit` | `number` | 否 | 20 | 最大返回数（1-100） |
| `from_date` | `string` | 否 | — | ISO 8601 开始日期 |
| `to_date` | `string` | 否 | — | ISO 8601 结束日期 |
| `project_path` | `string` | 否 | 当前目录 | 按项目目录过滤 |

**返回格式**: Markdown 表格（会话 ID、标题、消息数、日期、时长）。

**示例**

```typescript
session_list({ limit: 5, from_date: "2026-01-01" })
// → | Session ID | Title | Messages | Created | Duration |
```

### session_search

**参数（`src/session/session-browse-tools.ts:62`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 搜索文本 |
| `session_id` | `string` | 否 | — | 限定单个会话搜索 |
| `case_sensitive` | `boolean` | 否 | false | 是否大小写敏感 |
| `limit` | `number` | 否 | 20 | 最大结果数 |
| `include_tool_output` | `boolean` | 否 | false | 是否搜索工具调用输出 |

**返回格式**: 排序后的匹配结果，含上下文摘录和高亮匹配项。

### session_read

**参数（`src/session/session-inspect-tools.ts:20`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `session_id` | `string` | 是 | — | 会话 ID |
| `include_todos` | `boolean` | 否 | false | 包含待办列表 |
| `include_thinking` | `boolean` | 否 | false | 包含推理过程 |
| `include_tool_results` | `boolean` | 否 | false | 包含工具调用输出 |
| `limit` | `number` | 否 | 全部 | 最大消息数 |
| `offset` | `number` | 否 | 0 | 跳过的消息数 |
| `role_filter` | `"user" \| "assistant"` | 否 | — | 按角色过滤 |
| `tool_filter` | `string` | 否 | — | 按工具名子串匹配过滤 |

### session_info

**参数（`src/session/session-inspect-tools.ts:77`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |

**返回格式**: 综合信息（Token 用量/成本/工具调用频率/模型分布/文件修改/待办进度）。

### session_diff

**参数（`src/session/session-inspect-tools.ts:126`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话 ID |
| `message_id` | `string` | 否 | 截断到指定消息 |

**返回格式**: Unified diff。

### session_fork

**参数（`src/session/session-inspect-tools.ts:146`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 要分叉的会话 ID |
| `message_id` | `string` | 否 | 分叉点消息 ID（默认最末条） |

**返回格式**: 分叉结果（原会话信息 + 新会话信息）。

---

## 记忆工具（Memory Tools）

> **v0.20.0 引入** — 4 个记忆工具（memory_write/recall/list/update），SQLite + FTS5（Full-Text Search version 5，SQLite 内置全文搜索扩展）持久化（CHANGELOG.md:140）


4 个工具，使用 `MemoryStore`（`src/memory/store.ts`）持久化到本地文件系统。**何时使用**：当你想让角色在多次会话之间"记住"信息（事实、偏好、教训）时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `memory_write` | 写入新的记忆条目 | `src/memory/tools.ts:7` |
| `memory_recall` | 全文搜索记忆 | `src/memory/tools.ts:61` |
| `memory_list` | 列出记忆摘要 | `src/memory/tools.ts:110` |
| `memory_update` | 更新已有记忆条目 | `src/memory/tools.ts:153` |

### memory_write

**参数（`src/memory/tools.ts:11`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `title` | `string` | 是 | — | 简短标题（最长 200 字符） |
| `content` | `string` | 是 | — | Markdown 格式内容 |
| `category` | `"decision" \| "preference" \| "fact" \| "lesson" \| "note"` | 否 | `"note"` | 分类 |
| `scope` | `"workspace" \| "role"` | 否 | `"role"` | 共享范围 |
| `tags` | `string[]` | 否 | — | 标签 |
| `relevance` | `"high" \| "medium" \| "low"` | 否 | `"medium"` | 相关性 |

**返回格式**: 包含记忆 ID 的确认消息。

**示例**

```typescript
memory_write({
  title: "DB connection string",
  content: "PostgreSQL at localhost:5432, user=app",
  category: "fact",
  scope: "workspace",
  tags: ["database", "config"],
  relevance: "high"
})
// → "Memory written. ID: abc123"
```

### memory_recall

**参数（`src/memory/tools.ts:65`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 全文搜索查询 |
| `scope` | `"workspace" \| "role" \| "both"` | 否 | `"both"` | 搜索范围 |
| `category` | `string` | 否 | — | 分类过滤 |
| `limit` | `number` | 否 | 10 | 最大结果（1-50） |

**返回格式**: 排序后的记忆条目列表（ID、标题、分类、相关性、内容摘要）。

### memory_list

**参数（`src/memory/tools.ts:114`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `scope` | `"workspace" \| "role" \| "both"` | 否 | `"both"` |
| `category` | `string` | 否 | — |
| `limit` | `number` | 否 | 20 | 最大结果（1-100） |
| `sort` | `"recent" \| "relevance" \| "accessed"` | 否 | `"recent"` |

### memory_update

**参数（`src/memory/tools.ts:157`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 要更新的记忆 ID |
| `title` | `string` | 否 | — |
| `content` | `string` | 否 | — |
| `category` | `"decision" \| "preference" \| "fact" \| "lesson" \| "note"` | 否 |
| `tags` | `string[]` | 否 | — |
| `relevance` | `"high" \| "medium" \| "low"` | 否 |

---

## 调度查询工具（Dispatch Query & Budget）

> **v0.21.0 引入** — 任务搜索、图可视化、预算查询、时间线、导出与并发工具（CHANGELOG.md:89）

**命名说明：** 调度相关的只读/查询工具以 `task_*` 命名。0.24.0 曾计划将 `task_*` 重命名为 `dispatch_*`（CHANGELOG.md:82），但该重命名在 Unreleased 阶段被撤销——裸的 `dispatch_*`/`loop_*` 工具被停用，仅保留一层薄的 `task_*` 兼容层（`src/dispatch/query/task-tools.ts:1-15`，模块自述为 "Restored legacy `task_*` compatibility surface"）。当前**实际注册**的 `task_*` 查询工具为 6 个，由 `ToolService` 以 `taskToolsOverride` 注册（`src/core/services/tool-service.ts:87-90`）。**何时使用**：当你想查看后台派发任务的状态、预算消耗、并发占用，或导出某个任务的完整结果时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `task_search` | 搜索调度任务历史 | `src/dispatch/query/task-tools.ts` |
| `task_graph` | 可视化调度任务依赖树 | `src/dispatch/query/task-tools.ts` |
| `task_budget` | 查询 Token/成本预算状态 | `src/dispatch/query/task-tools.ts` |
| `task_concurrency` | 查看并发槽位状态 | `src/dispatch/query/task-tools.ts` |
| `task_chronology` | 按时间分桶显示任务活动 | `src/dispatch/query/task-tools.ts` |
| `task_export` | 导出已完成任务的完整结果 | `src/dispatch/query/task-tools.ts` |

> **`dispatch_*` 家族已退役。** `dispatch`、`dispatch_output`、`dispatch_cancel`、`dispatch_metrics`、`dispatch_status`、`dispatch_progress`、`dispatch_stream`、`dispatch_checkpoint` 以及审批用的 `dispatch_approve`/`dispatch_reject` 均**不再注册**为可调用工具。编排已改为图优先（`graph_*`）；`dispatch_approve`/`dispatch_reject` 由 `graph_approve` 取代，`dispatch_progress`/`dispatch_stream` 与 `dispatch_checkpoint` 的持久化仅作为内部机制保留，不再暴露为模型工具。

::: tip 源码定位
| 机制 | 实现位置 |
|---|---|
| 退役开关：禁用 `dispatchToolsOverride` | `src/core/services/tool-service.ts:80-81` |
| `graph_approve`（取代 `dispatch_approve`/`dispatch_reject`） | `src/graph/tools/approve-tools.ts:7-14` |
| `dispatch_progress`/`dispatch_stream` 持久化 | `src/dispatch/progress/progress-store.ts` |
| `dispatch_checkpoint` 持久化 | `src/dispatch/checkpoint/checkpoint-store.ts` |
:::

### 调度工具（Dispatch Tools）— 工厂保留但未注册

`createDispatchTools()`（`src/dispatch/tools.ts:382-393`）仍定义并返回 5 个派发工具的 `CanonicalToolDef`，但它们**只存在于工厂层**——`ToolService` 与 Pi 栈均不把它们注册为可调用工具（见上方退役说明）。下表记录这 5 个工具的签名，便于理解历史接口或在自定义注册中重新启用。

| 工具 | 工厂函数 | 定义位置 | 原始用途 |
|------|---------|---------|---------|
| `dispatch` | `createDispatchTool` | `src/dispatch/tools.ts:26` | 向子代理派发工作；同步返回输出文本，后台返回任务 ID |
| `dispatch_output` | `createDispatchOutputTool` | `src/dispatch/tools.ts:141` | 读取已完成后台任务的结果（支持 `max_chars`/`offset`/`tail`） |
| `dispatch_status` | `createDispatchStatusTool` | `src/dispatch/query/task-status.ts:17` | 查询任务活跃度或汇总表（`task_id` 可选） |
| `dispatch_cancel` | `createDispatchCancelTool` | `src/dispatch/tools.ts:277` | 取消运行中的后台任务 |
| `dispatch_metrics` | `createDispatchMetricsTool` | `src/dispatch/tools.ts:295` | 获取调度子系统运行时指标（`format`/`export_path`） |

**`dispatch` 参数**（`src/dispatch/tools.ts:36-61`）：`subagent`、`prompt`、`run_in_background`（必填），`description`、`session_id`、`timeout_ms`（可选）。

**`dispatch_output` 参数**（`src/dispatch/tools.ts:145-171`）：`task_id`（必填）；`max_chars`（默认结果上限）、`offset`（默认 0）、`tail`（取末尾窗口）可选。

**`dispatch_status` 参数**（`src/dispatch/query/task-status.ts:36-42`）：`task_id`（可选）。省略时返回调用会话的全部任务汇总表。

**`dispatch_cancel` 参数**（`src/dispatch/tools.ts:280-284`）：`task_id`（必填）。

**`dispatch_metrics` 参数**（`src/dispatch/tools.ts:299-309`）：`format`（`"summary" | "json"`，默认 `"summary"`）、`export_path`（可选，优先于 `ROLEBOX_METRICS_EXPORT` 环境变量）。

### task_search

**参数（`src/dispatch/query/task-tools.ts` 内 zod schema）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 搜索查询，匹配任务 prompt/description/agent（不区分大小写的子串） |
| `status` | `"pending" \| "running" \| "completed" \| "awaiting_approval" \| "error" \| "cancelled" \| "timeout"` | 否 | — | 状态过滤 |
| `from_date` | `string` | 否 | — | ISO 8601 开始日期 |
| `to_date` | `string` | 否 | — | ISO 8601 结束日期 |
| `limit` | `number` | 否 | 20 | 最大结果（1-100） |
| `include_result` | `boolean` | 否 | false | 包含结果预览（前 200 字符） |

### task_graph

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `root_session` | `string` | 否 | — | 作为树根的会话 ID；省略时渲染所有顶层（无父）任务森林 |
| `depth` | `number` | 否 | 5 | 最大展开深度（1-20） |
| `include_status` | `boolean` | 否 | true | 在节点标签中包含任务状态与代理名 |

### task_budget

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `session_id` | `string` | 否 | 当前工具上下文会话 | 要检查的会话 ID |

### task_concurrency

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `format` | `"summary" \| "json"` | 否 | `"summary"` | 输出格式 |
| `export_path` | `string` | 否 | — | 原子写出状态 JSON 的文件路径 |

### task_chronology

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `group_by` | `"hour" \| "day" \| "agent"` | 否 | `"hour"` | 分桶方式 |
| `from_date` | `string` | 否 | — | ISO 8601 开始日期 |
| `to_date` | `string` | 否 | — | ISO 8601 结束日期 |

### task_export

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `task_id` | `string` | 是 | — | 要导出的任务 ID |
| `format` | `"markdown" \| "json"` | 否 | `"markdown"` | 输出格式 |
| `export_path` | `string` | 否 | — | 相对项目根（worktree）的导出路径 |
| `output_path` | `string` | 否 | — | `export_path` 的别名（仅当 `export_path` 缺省时使用） |
| `include_prompt` | `boolean` | 否 | true | 输出中包含任务 prompt |

> **`task_retry` 已扣留。** 该工具的工厂仍存在于 `src/dispatch/query/task-tools.ts:440-516`，但注册时被显式剔除（`src/core/services/tool-service.ts:87-90` 的 `task_retry: _omitted`），因为它会经 `reopenForContinuation` 重新分发、绕过图的预算与审批约束。

---

## Graph 工具（v2 引擎）

> **v2.0 引擎（`1.0.0` 引入）** — 命令式图编排引擎工具集，共 8 个工具。v2 图执行引擎使用了一套新的实现位置；旧版协作图（`collaboration:` 声明式路径）仍保留，但实现文件已重组。编排与执行语义详见[协作图](/02-Guide/collaboration-graph)。

::: tip 源码定位
| 路径 | 说明 |
|---|---|
| `src/graph/engine/*` | v2 图执行引擎实现 |
| `src/graph/tools/*` | v2 图工具实现 |
| `src/graph/collaboration-{state,advance,store}.ts` | 旧版协作图（由 `src/graph/{state,advance,graph-store}.ts` 重组而来） |
:::

8 个工具，由 `createGraphTools()` 注册（`src/graph/tools/index.ts:151-160`），经 `buildCanonicalTools()` 在有 dispatch manager 时合并（`src/platform/tool-assembly.ts:152-157`）。所有工具返回 JSON 字符串。**何时使用**：当你要编排"多个子代理接力协作"（如流水线、评审循环、并行分发）时，用这批工具搭建并执行协作图。

> **术语说明：** 本节图编排术语：**循环组**（图中被标记为可重复执行的一组节点，带最大轮数上限）；`needs_approval`（一种信号/状态类型，表示"需要人工批准"，图引擎会在此暂停等待人类确认）；`on_signal`（图边的触发方式之一：收到指定信号时激活这条边）；`on_condition`（图边的触发方式之一：指定条件为真时激活这条边）。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `graph_create` | 创建图/编排上下文，返回 `graph_id` | `src/graph/tools/index.ts` |
| `graph_add_node` | 向图添加节点（`{agent, prompt}` 元组） | `src/graph/tools/index.ts` |
| `graph_add_edge` | 在节点间添加有向边（数据流/信号路由） | `src/graph/tools/index.ts` |
| `graph_add_loop` | 声明有界循环组（往返上限 + 软终止条件） | `src/graph/tools/index.ts` |
| `graph_run` | 非阻塞执行图，分发就绪根节点 | `src/graph/tools/index.ts` |
| `graph_status` | 统一可观测端点，查询节点/循环/图状态 | `src/graph/tools/index.ts` |
| `graph_cancel` | 取消图、节点或循环组 | `src/graph/tools/index.ts` |
| `graph_approve` | 批准/拒绝阻塞的 `needs_approval` 节点 | `src/graph/tools/approve-tools.ts` |

### graph_create

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 人类可读的图名称（日志用） |
| `budget` | `object` | 否 | 图级资源上限（`max_total_sessions`/`max_total_input_tokens`/`max_total_output_tokens`/`max_total_cost_usd`） |

### graph_add_node

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 目标图 |
| `id` | `string` | 是 | 图内唯一节点标识 |
| `agent` | `string` | 是 | 要分派的代理标识（如子代理完整 ID） |
| `prompt` | `string` | 是 | 该代理执行的提示词 |
| `completion_condition` | `string` | 否 | 自动完成节点的命名条件 |
| `needs_approval` | `boolean` | 否 | 为 true 时引擎在此节点暂停等待人工审批 |
| `join` | `object` | 否 | 扇入汇聚策略（`strategy` + 可选 `quorum`） |
| `budget` | `object` | 否 | 节点级资源上限（`max_sessions`/`max_input_tokens`/`max_output_tokens`/`max_cost_usd`/`timeout_ms`/`max_retries`） |
| `timeout_ms` | `number` | 否 | 节点墙钟超时（毫秒） |
| `max_retries` | `number` | 否 | 升级（escalate）时的自动重试次数 |

### graph_add_edge

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 目标图 |
| `from` | `string` | 是 | 源节点 ID |
| `to` | `string` | 是 | 目标节点 ID |
| `type` | `"always" \| "on_signal" \| "on_condition"` | 否 | 边激活规则 |
| `signal_filter` | `string[]` | 否 | 激活此边的信号类型（`type=on_signal` 时必需） |
| `condition` | `string` | 否 | 必须为真的命名条件（`type=on_condition` 时必需） |
| `data_passthrough_include` | `string[]` | 否 | 向下游传递的载荷字段白名单 |
| `data_passthrough_exclude` | `string[]` | 否 | 省略的载荷字段黑名单 |
| `data_passthrough_max_chars` | `number` | 否 | 传递上下文截断上限 |
| `retry` | `number \| object` | 否 | 源节点发出 escalate 时的自动重试（裸数字或 `{max, backoff_ms}`） |

### graph_add_loop

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 目标图 |
| `id` | `string` | 是 | 唯一循环组标识 |
| `nodes` | `string[]` | 是 | 构成循环的节点 ID（至少 1 个） |
| `max_traversals` | `number` | 是 | 硬上限——循环在此次遍历后退出 |
| `termination` | `object` | 否 | 软终止条件（`any_of`/`all_of`） |
| `mode` | `"inherit" \| "fresh"` | 否 | 循环轮次的会话隔离模式；`fresh` 不受支持并返回显式错误 |

### graph_run

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 要执行的图 |
| `node_id` | `string` | 否 | 指定时重跑某个节点 |
| `retry` | `boolean` | 否 | 为 true 且带 `node_id` 时重试该节点 |
| `modify_prompt` | `string` | 否 | 重试时可选地修改节点提示词 |
| `dry_run` | `boolean` | 否 | 校验图结构但不执行 |

### graph_status

**参数（主要）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 否 | 要查询的图（缺省时从 `node_id`/`loop_id` 推断；无目标时列出所有图） |
| `node_id` | `string` | 否 | 查询单个节点的运行时状态 |
| `loop_id` | `string` | 否 | 查询循环组状态 |
| `scope` | `"session" \| "persisted" \| "all"` | 否 | 查询的会话作用域（`session` 仅内存注册表；`persisted` 磁盘引擎状态；`all` 合并） |
| `format` | `"summary" \| "tree" \| "json"` | 否 | 输出格式 |
| `query` | `string` | 否 | 按节点 ID/prompt/代理名做不区分大小写的子串过滤 |
| `status` | `string` | 否 | 按生命周期状态过滤（pending/ready/running/completed/blocked/timeout/escalate/cancelled/done） |
| `agent` | `string` | 否 | 按代理精确匹配过滤 |
| `group_by` | `"hour" \| "day" \| "agent"` | 否 | 将已完成节点分桶聚合 |
| `limit` | `number` | 否 | 限制输出的节点行数 |
| `depth` | `number` | 否 | 裁剪树渲染层级 |
| `include_output` | `boolean` | 否 | 响应中包含物化节点结果 |
| `export_path` | `string` | 否 | 原子写出导出并返回确认（替代状态渲染） |

`graph_status` 另支持多项布尔观察开关：`include_progress`/`include_budget`/`include_metrics`/`include_loops`/`include_concurrency`/`include_checkpoint`/`include_artifacts`/`include_evidence`/`include_history`，以及 `round`/`stream`/`since`/`max_chars`/`offset`/`tail` 等分页与历史参数。

### graph_cancel

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 含目标的图 |
| `node_id` | `string` | 否 | 取消特定节点 |
| `loop_id` | `string` | 否 | 取消循环组（解析为其成员节点集合） |
| `cascade` | `boolean` | 否 | 为 true 时同时取消目标下游所有节点（边前向闭包）。默认：循环目标为 true，裸 `node_id` 为 false |

### graph_approve

**参数（`src/graph/tools/approve-tools.ts`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `graph_id` | `string` | 是 | 含阻塞节点的图 |
| `node_id` | `string` | 是 | 当前阻塞等待人工的 `needs_approval` 节点 |
| `action` | `"approve" \| "reject"` | 是 | 批准则解除门禁（blocked → completed）；拒绝则重入（循环组）或升级（无循环）节点 |
| `reason` | `string` | 否 | 人工提供的拒绝反馈（`action=reject` 时使用） |
| `payload` | `unknown` | 否 | 可选的批准输出，经 answer 边向下游传递（`action=approve` 时使用） |

---

## 函数图工具（Function Graph）

1 个工具，由 `ToolService` 以 `extraTools` 注册。`function_state` 工具已**移除**（`src/platform/tool-assembly.ts:97` 仅保留 `function_graph`）。**何时使用**：当你想直观地查看函数之间的依赖关系或状态机流转时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `function_graph` | 可视化函数依赖关系/状态机图 | `src/function/function-graph.ts` |

### function_graph

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `role_id` | `string` | 否 | 全部角色 | 限定到特定角色（含其子代理）的函数 |
| `focus` | `"dependencies" \| "state_machine"` | 否 | `"dependencies"` | 图类型：`dependencies` 显示 requires/produces/consumes DAG；`state_machine` 显示基于条件的激活/停用流 |

---

## 资产管理工具（Asset Tools）

> **v0.21.0 引入** — 6 个资产查询工具，覆盖搜索/检查/验证/热重载/组合分析/引用搜索（CHANGELOG.md:89）


6 个工具，用于查询和操作 Rolebox 资产（技能、函数、引用）。**何时使用**：当你想检索、检查、验证或热重载某个资产时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `asset_search` | 按关键词搜索资产 | `src/asset/asset-search.ts:145` |
| `asset_inspect` | 按精确名称查看单个资产 | `src/asset/asset-inspect.ts:264` |
| `asset_validate` | 验证所有资产的完整性 | `src/asset/asset-validate.ts:278` |
| `asset_hot_reload` | 触发资产热重载 | `src/asset/hot-reload.ts:10` |
| `skill_compose` | 分析技能组合的冲突与引用去重 | `src/asset/skill-compose.ts:194` |
| `reference_search` | 在引用文档中全文搜索 | `src/utils/reference-search.ts:113` |

### asset_search

**参数（`src/asset/asset-search.ts:154`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 搜索关键词（AND 逻辑） |
| `type` | `"skill" \| "function" \| "reference" \| "all"` | 否 | `"all"` | 资产类型过滤 |
| `role_id` | `string` | 否 | — | 按角色 ID 限定 |
| `limit` | `number` | 否 | 20 | 最大结果（1-50） |

**示例**

```typescript
asset_search({ query: "compose", type: "skill" })
// → "## Asset Search Results: compose\n\n| Name | Type | Role | Description |\n| ..."
```

### asset_inspect

**参数（`src/asset/asset-inspect.ts:269`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 资产精确名称 |
| `type` | `"skill" \| "function" \| "reference"` | 是 | 资产类型 |

### asset_validate

**参数（`src/asset/asset-validate.ts:286`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `role_id` | `string` | 否 | 全部 | 限定检查的角色 |
| `fix` | `boolean` | 否 | false | 尝试自动修复 |

### asset_hot_reload

**参数（`src/asset/hot-reload.ts:17`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `type` | `"skill" \| "function" \| "reference" \| "role"` | 否 | `"role"` | 资产类型 |
| `name` | `string` | 否 | — | 特定资产名称 |

### skill_compose

**参数（`src/asset/skill-compose.ts:202`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `skill_names` | `string[]` | 是 | — | 要分析组合的技能名称 |
| `check_conflicts` | `boolean` | 否 | true | 检查工具权限冲突 |

### reference_search

**参数（`src/utils/reference-search.ts:119`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 子串匹配搜索 |
| `case_sensitive` | `boolean` | 否 | false |
| `limit` | `number` | 否 | 10 | 最大结果（1-50） |
| `context_lines` | `number` | 否 | 2 | 上下文行数（0-10） |
| `role_id` | `string` | 否 | — | 限定角色 |

---

## 网络工具（Web Tools）

> **v0.22.0 引入** — web_search/web_read/web_fetch 三件套，支持多渲染引擎与 SSRF（服务端请求伪造，Server-Side Request Forgery）防护（CHANGELOG.md:47）


3 个工具，支持 SSRF 防护、多种渲染引擎、内容格式转换。**何时使用**：当模型需要搜索网络、读取网页或抓取接口内容时使用。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `web_search` | 搜索网络信息（Jina/DDG/Wikipedia/npm/HN） | `src/web/web-search.ts:22` |
| `web_read` | 读取 URL 并转换为 LLM 友好的 Markdown | `src/web/page-read.ts:24` |
| `web_fetch` | 全面 HTTP 客户端，支持多引擎多格式 | `src/web/web-fetch.ts:368` |

### web_search

**参数（`src/web/web-search.ts:28`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 搜索查询（最长 500 字符） |
| `source` | `"auto" \| "jina" \| "duckduckgo" \| "wikipedia" \| "npm" \| "hackernews"` | 否 | `"auto"` | 搜索源 |
| `max_results` | `number` | 否 | 5 | 最大结果（1-10） |

**返回格式**: 排序后的搜索结果（标题、URL、摘要、来源）。

**示例**

```typescript
web_search({ query: "React 19 new features", max_results: 3 })
// → "## Search Results for \"React 19 new features\"\n1. [React 19](https://react.dev/) ..."
```

### web_read

**参数（`src/web/page-read.ts:30`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `url` | `string` | 是 | — | 页面完整 URL |
| `selector` | `string` | 否 | — | CSS 选择器提取特定内容 |
| `engine` | `"default" \| "browser"` | 否 | `"default"` | 渲染引擎 |

**返回格式**: 干净的 Markdown 文本，Jina Reader 为首选后端。

### web_fetch

**参数（`src/web/web-fetch.ts:379`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `url` | `string` | 是 | — | 完整 URL（http/https） |
| `format` | `"markdown" \| "text" \| "html" \| "json" \| "raw" \| "auto"` | 否 | `"auto"` | 输出格式 |
| `engine` | `"default" \| "browser" \| "jina" \| "reader"` | 否 | `"default"` | 渲染引擎 |
| `selector` | `string` | 否 | — | CSS 选择器 |
| `timeout` | `number` | 否 | 30 | 超时秒数（1-120） |
| `max_size` | `number` | 否 | 51200 | 最大输出字节数（1KB-5MB） |
| `headers` | `Record<string, string>` | 否 | — | 自定义请求头 |
| `include_metadata` | `boolean` | 否 | false | 包含页面元数据 |

---

## 行哈希编辑工具（Hashline Tools）

> **v0.17.0 引入** — hashline_read/hashline_edit，内容哈希锚定文件编辑（CHANGELOG.md:202）


2 个工具，实现基于内容哈希的精确文件编辑。通过 `buildCanonicalTools()` 注册（`src/platform/tool-assembly.ts:76-77`）。**何时使用**：当需要精确、可定位地增量修改文件（而不是整段重写）时使用，尤其适合大文件。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `hashline_read` | 读取文件并返回带内容哈希锚点的行 | `src/hashline/hashline-read.ts:6` |
| `hashline_edit` | 基于 LINE#HASH 锚点编辑文件 | `src/hashline/hashline-edit.ts` |

### hashline_read

**参数（`src/hashline/hashline-read.ts:22`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `offset` | `number` | 否 | 1-based 起始行（省略=全量读取） |
| `limit` | `number` | 否 | 最大返回行数 |

**返回格式**: `version`（SHA-256）、`hashWidth`、`totalLines`、每行以 `LINE#HASH|content` 格式标注。

### hashline_edit

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `files` | `Array` | 是 | 要编辑的文件列表 |
| `files[].filePath` | `string` | 是 | 文件绝对路径 |
| `files[].version` | `string` | 是 | 上一次 `hashline_read` 的版本 |
| `files[].edits` | `Array` | 是 | 编辑操作列表 |
| `edits[].op` | `"replace" \| "append" \| "prepend"` | 否 | 操作类型，默认 `"replace"` |
| `edits[].pos` | `string` | 视情况 | LINE#HASH 锚点 |
| `edits[].lines` | `string \| string[]` | 视情况 | 替换/插入的内容 |

**返回格式**: 版本哈希、每个文件的统一差异（diff）、添加/删除行数、锚点重映射信息。

---

## 信号与上下文工具

> **v0.22.0 引入** — signal 通用带外控制信号（out-of-band，不嵌入文本内容、独立传递的控制信令） + context_assemble 跨域搜索组装（CHANGELOG.md:50）


| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `signal` | 发出带外控制信号（完成/审批/阻塞等） | `src/signal/signal-tool.ts:45` |
| `context_assemble` | 跨域搜索并组装上下文块 | `src/dispatch/query/context-assemble.ts` |

**何时使用**：`signal` 在你想显式通知编排器"任务完成 / 需要审批 / 遇到阻塞"等状态时使用；`context_assemble` 在你想把记忆、资产、任务、会话等多处信息汇总成一段精简上下文时使用。

### signal

**参数（`src/signal/signal-tool.ts:52`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | `"answer" \| "need_approval" \| "blocked" \| "need_clarification" \| "handoff" \| "progress" \| "revise_needed" \| "escalate"` | 是 | 信号类型 |
| `payload` | `Record<string, unknown>` | 否 | 可选的附带数据 |

**信号类型分类**
- **终止信号**: `answer`, `revise_needed`, `escalate` — 满足 `continue_until`（终止/继续条件：持续执行直到某条件满足）
- **暂停信号**: `need_approval`, `blocked`, `need_clarification` — 设置 `paused` 证据标签
- **交接信号**: `handoff` — 触发非终止的手递交接
- **信息信号**: `progress` — 仅记录，无状态转换

**返回格式**: 确认消息（信号类型、记录的函数数、状态转换说明）。

### context_assemble

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `topic` | `string` | 是 | — | 搜索主题/查询 |
| `max_tokens` | `number` | 否 | 4000 | Token 预算 |
| `sources` | `("memory" \| "asset" \| "task" \| "session")[]` | 否 | 所有源 | 搜索域 |

---

## 核心要点

| 维度 | 关键信息 |
|------|----------|
| **工具总数** | 约 80 个内置工具，分 10 大领域 |
| **最大领域** | LSP 工具——32 个，是最大的工具域 |
| **独有工具** | hashline 编辑、dispatch 套件、会话工具、记忆工具、Function Graph 等为 rolebox 独有 |
| **工具 vs 函数** | 工具是 TypeScript 代码（LLM 直接调用），函数是提示词模板（用户通过 `|name|` 激活） |
| **注册方式** | 所有工具通过 `ToolService.init()` 在运行时注册，Zod Schema 定义参数 |

## 工具与函数的区分

Rolebox 中有两个相似的机制：

| 维度 | 工具（Tool） | 函数（Function） |
|------|-------------|-------------------|
| 定义位置 | TypeScript `defineTool()` | Markdown 文件或 `role.yaml` |
| 注册方式 | 运行时 `ToolService.init()` | 通过 `rolesFunctionsMap` 静态注册 |
| 调用者 | LLM 内部调用 | 用户通过 `\|函数名\|` 语法调用 |
| 实现 | TypeScript 代码 | 提示词模板 |
| 典型用途 | 系统级操作（读文件、查 LSP） | 工作流驱动的状态机步骤 |

函数系统有独立的生命周期（状态机、自动激活、条件过渡），工具则直接执行。详细内容见[函数系统](/02-Guide/functions)和[角色定义](/03-Reference/role-yaml)。

## 下一步

- [函数系统](/02-Guide/functions) — 了解基于行为修改的函数系统
- [角色定义](/03-Reference/role-yaml) — 完整的 role.yaml 字段参考
- [编写函数](/02-Guide/writing-functions) — 编写自定义函数的指南
- [CLI 参考](/03-Reference/cli) — rolebox 命令行工具
