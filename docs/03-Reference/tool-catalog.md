---
title: 工具目录
description: Rolebox 全部内置工具的完整参考手册，按领域分组并提供参数说明、返回格式与代码示例
---

# 工具目录

> **相关文档：** [函数系统](/02-Guide/functions) — 函数与工具的区分 | [role.yaml 参考](/03-Reference/role-yaml) — 角色定义参考 | [CLI 参考](/03-Reference/cli) — 命令行工具

Rolebox 在运行时注册约 80 个内置工具，涵盖代码智能（LSP）、会话管理、记忆存储、任务调度、资产查询、网络请求等能力域。每个工具均通过 `defineTool()`（`src/platform/ports/tool-factory.ts`）定义，使用 Zod Schema 声明参数，LLM 可直接调用。

## LSP 工具（代码智能）

> **v0.17.0 引入** — 32 个 LSP 协议工具，覆盖诊断、导航、补全、重构、格式化等能力（CHANGELOG.md:200）


共 32 个工具，通过 `createAllLspTools()`（`src/lsp/index.ts:117`）批量注册，基于 LSP 协议与编辑器语言服务器交互。

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

> **v0.17.0 引入** — 10 工具会话管理套件，含 4 个 omo 兼容工具和 6 个独有工具（CHANGELOG.md:198）


共 6 个工具（含 4 个别名），通过 `buildCanonicalTools()`（`src/platform/tool-assembly.ts:91-109`）注册。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `session_list` | 列出所有会话，支持日期过滤 | `src/session/session-browse-tools.ts` |
| `session_search` | 全文搜索会话消息 | `src/session/session-browse-tools.ts` |
| `session_read` | 读取会话完整转录 | `src/session/session-inspect-tools.ts` |
| `session_info` | 获取会话综合信息 | `src/session/session-inspect-tools.ts` |
| `session_diff` | 获取会话的变更差异 | `src/session/session-inspect-tools.ts` |
| `session_fork` | 在指定消息处分叉会话 | `src/session/session-inspect-tools.ts` |
| `session_inspect` | `session_info` 的别名 | `src/platform/tool-assembly.ts:107` |
| `session_changes` | `session_diff` 的别名 | `src/platform/tool-assembly.ts:108` |
| `session_branch` | `session_fork` 的别名 | `src/platform/tool-assembly.ts:109` |

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

> **v0.20.0 引入** — 4 个记忆工具（memory_write/recall/list/update），SQLite + FTS5 持久化（CHANGELOG.md:140）


4 个工具，使用 `MemoryStore`（`src/memory/store.ts`）持久化到本地文件系统。

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

## 调度工具（Dispatch Tools）

> **v0.10.0 引入** — 事件驱动 Dispatch 引擎，支持同步/后台分发、审批、指标与进度报告（CHANGELOG.md:316）


通过 `buildCanonicalTools()`（`src/platform/tool-assembly.ts:113-130`）条件注册。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `dispatch` | 向子代理分发任务（同步/后台） | `src/dispatch/tools.ts:13` |
| `dispatch_output` | 获取已完成后台任务的结果 | `src/dispatch/tools.ts:116` |
| `dispatch_cancel` | 取消运行中的后台任务 | `src/dispatch/tools.ts:262` |
| `dispatch_approve` | 批准等待人工审批的任务 | `src/dispatch/tools.ts:280` |
| `dispatch_reject` | 拒绝等待人工审批的任务 | `src/dispatch/tools.ts:311` |
| `dispatch_metrics` | 获取调度子系统运行时指标 | `src/dispatch/tools.ts:347` |
| `dispatch_status` | 查询任务活跃度或汇总表 | `src/dispatch/query/task-status.ts:49` |
| `dispatch_progress` | 发送进度事件 | `src/dispatch/progress/progress-tools.ts` |
| `dispatch_stream` | 查询累积的进度事件 | `src/dispatch/progress/progress-tools.ts` |

### dispatch

**参数（`src/dispatch/tools.ts:21`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `subagent` | `string` | 是 | 目标子代理 ID |
| `prompt` | `string` | 是 | 任务提示词 |
| `run_in_background` | `boolean` | 是 | 是否后台运行 |
| `description` | `string` | 否 | 人类可读的任务描述 |
| `session_id` | `string` | 否 | 续做之前任务的 ID |
| `timeout_ms` | `number` | 否 | 后台任务超时（毫秒） |

**返回格式**
- 同步执行：子代理返回的原始文本
- 后台执行：任务 ID 和会话 ID，提示等待 `<system-reminder>`

**示例**

```typescript
// 后台分发
dispatch({
  subagent: "emperor--jinyiwei--ui",
  prompt: "Create a button component with blue accent color",
  run_in_background: true,
  description: "UI button component"
})
// → "Background task launched.\nTask ID: bg_xxx\n..."

// 续做已有任务
dispatch({
  subagent: "emperor--jinyiwei--ui",
  prompt: "Continue from where you left off",
  run_in_background: true,
  session_id: "bg_xxx"
})
```

### dispatch_output

**参数（`src/dispatch/tools.ts:120`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `task_id` | `string` | 是 | — | 要查询的任务 ID |
| `max_chars` | `number` | 否 | 16000 | 内联最大字符数 |
| `offset` | `number` | 否 | 0 | 读取起始偏移 |
| `limit` | `number` | 否 | — | 从 offset 读取最大字符数 |
| `tail` | `boolean` | 否 | — | 读取末尾内容 |

### dispatch_metrics

**参数（`src/dispatch/tools.ts:351`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `format` | `"summary" \| "json"` | 否 | `"summary"` | 输出格式 |
| `export_path` | `string` | 否 | — | JSON 导出路径 |

---

## 调度查询工具（Dispatch Query & Budget）

> **v0.21.0 引入** — 任务搜索、图可视化、预算查询、时间线、导出、并发与重试工具（CHANGELOG.md:89）


由 `ToolService`（`src/core/services/tool-service.ts:70-87`）以 `extraTools` 注册。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `task_search` | 搜索调度任务历史 | `src/dispatch/query/task-search.ts` |
| `task_graph` | 可视化调度任务依赖树 | `src/dispatch/query/task-graph.ts` |
| `task_budget` | 查询 Token/成本预算状态 | `src/dispatch/budget/task-budget.ts` |
| `task_chronology` | 按时间分桶显示任务活动 | `src/dispatch/query/task-chronology.ts` |
| `task_export` | 导出已完成任务的完整结果 | `src/dispatch/query/task-export.ts` |
| `task_concurrency` | 查看并发槽位状态 | `src/dispatch/concurrency/task-concurrency.ts` |
| `task_retry` | 重试失败的任务 | `src/dispatch/query/task-retry.ts` |

### task_search

**参数（`src/dispatch/query/task-search.ts:17`）**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | — | 全文搜索（不区分大小写） |
| `status` | `"pending" \| "running" \| "completed" \| "error" \| "cancelled" \| "timeout"` | 否 | — | 状态过滤 |
| `agent` | `string` | 否 | — | 子代理名精确匹配 |
| `parent_session` | `string` | 否 | — | 父会话 ID 过滤 |
| `from_date` | `string` | 否 | — | ISO 8601 开始日期 |
| `to_date` | `string` | 否 | — | ISO 8601 结束日期 |
| `limit` | `number` | 否 | 20 | 最大结果（1-100） |
| `include_result` | `boolean` | 否 | false | 包含结果预览 |

### task_retry

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `task_id` | `string` | 是 | — | 要重试的任务 ID |
| `modify_prompt` | `string` | 否 | — | 在原始提示前追加的内容 |
| `reset_budget` | `boolean` | 否 | false | 重置预算计数器 |

### dispatch_checkpoint

创建或更新任务执行检查点。

**参数**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `task_id` | `string` | 是 | 任务 ID |
| `phase` | `string` | 是 | 当前阶段标签 |
| `completed_items` | `string[]` | 是 | 已完成项 |
| `remaining_items` | `string[]` | 是 | 待处理项 |
| `metadata` | `Record<string, unknown>` | 否 | 自定义元数据 |

---

## 函数状态工具（Function State Tools）

2 个工具，由 `ToolService` 注册。

| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `function_state` | 查询当前会话的函数状态机 | `src/function/function-state.ts` |
| `function_graph` | 可视化函数依赖关系/状态机图 | `src/function/function-graph.ts` |

### function_state

**参数**

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `session_id` | `string` | 否 | 当前会话 | 检查的会话 ID |
| `include_artifacts` | `boolean` | 否 | true | 包含制品文件状态 |
| `include_evidence` | `boolean` | 否 | true | 包含证据观察标签 |

---

## 资产管理工具（Asset Tools）

> **v0.21.0 引入** — 6 个资产查询工具，覆盖搜索/检查/验证/热重载/组合分析/引用搜索（CHANGELOG.md:89）


6 个工具，用于查询和操作 Rolebox 资产（技能、函数、引用）。

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

> **v0.22.0 引入** — web_search/web_read/web_fetch 三件套，支持多渲染引擎与 SSRF 防护（CHANGELOG.md:47）


3 个工具，支持 SSRF 防护、多种渲染引擎、内容格式转换。

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


2 个工具，实现基于内容哈希的精确文件编辑。通过 `buildCanonicalTools()` 注册（`src/platform/tool-assembly.ts:76-77`）。

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

> **v0.22.0 引入** — signal 通用带外控制信号 + context_assemble 跨域搜索组装（CHANGELOG.md:50）


| 工具名 | 说明 | 定义文件 |
|--------|------|----------|
| `signal` | 发出带外控制信号（完成/审批/阻塞等） | `src/signal/signal-tool.ts:45` |
| `context_assemble` | 跨域搜索并组装上下文块 | `src/dispatch/query/context-assemble.ts` |

### signal

**参数（`src/signal/signal-tool.ts:52`）**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | `"answer" \| "need_approval" \| "blocked" \| "need_clarification" \| "handoff" \| "progress" \| "revise_needed" \| "escalate"` | 是 | 信号类型 |
| `payload` | `Record<string, unknown>` | 否 | 可选的附带数据 |

**信号类型分类**
- **终止信号**: `answer`, `revise_needed`, `escalate` — 满足 `continue_until` 条件
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
