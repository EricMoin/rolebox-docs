---
title: LSP 工具
description: LSP 代码智能工具分册：32 个诊断、导航、补全、重构与格式化工具的参数、返回与调用示例
---

# LSP 工具（Code Intelligence）

LSP 工具让模型"读懂代码"：查错误、跳定义、找引用、补全、重命名、格式化。共 32 个工具，只有在当前语言服务器声明了对应能力时才真正生效。

> 返回[工具目录](/03-Reference/tool-catalog)｜平台范围：仅 OpenCode 与 Pi 提供（dsh 不注册）；自 v0.17.0 起提供本套工具。

## 参数约定

- **位置三元组**：`filePath`（文件绝对路径）、`line`（0-based 行号）、`character`（0-based 字符偏移），三者都必填。下文凡用这三个参数的工具，表格里合并成一行。
- **范围四元组**：`startLine` / `startChar` / `endLine` / `endChar`，同样 0-based 且都必填。
- **返回形式**：多数工具返回格式化好的文本（位置列表、符号表、诊断表、diff 摘要），少数返回错误说明。
- **能力缺失不报错**：服务器没声明某项能力时返回"不支持"说明；先用 `lsp_servers` 看能力再决定调哪个工具。此外文件必须先落盘——工具只把磁盘内容同步给服务器。

## 诊断与符号

### lsp_diagnostics
获取诊断信息（错误、警告、提示），可只看单个文件或聚合全部已打开文档。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 否 | 文件绝对路径；省略时聚合所有已打开文档 |
| `severity` | `"error" \| "warning" \| "information" \| "hint" \| "all"` | 否 | 最低严重级别过滤，默认 `"all"` |

```json
{ "filePath": "/project/app.ts", "severity": "error" }
```

### lsp_document_symbols
列出文档中定义的全部符号；服务器支持层级时返回嵌套树。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_workspace_symbols
在整个工作区按名字搜索符号，结果按符号种类分组。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 符号名搜索词 |

```json
{ "query": "GraphEngine" }
```

## 导航与信息查询

### lsp_goto_definition
跳转到符号的定义位置，返回格式化位置列表。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_goto_type_definition
跳转到符号的**类型**定义位置（拿到的是类型，不是符号自身）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_goto_implementation
跳转到符号的实现位置（接口 → 实现类）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_goto_declaration
跳转到符号的声明位置。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_find_references
查找符号在工作区中的全部引用，返回位置列表并附带命中处的上下文代码片段。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |
| `includeDeclaration` | `boolean` | 否 | 是否把声明本身计入结果，默认 `true` |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8, "includeDeclaration": false }
```

### lsp_document_highlights
高亮同一文档内该符号的全部出现，用于确认局部一致性。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_hover
返回符号的类型签名与文档字符串。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_signature_help
返回函数或方法的签名与参数信息（当前第几个参数、各参数类型）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_completion
返回该位置的代码补全建议，含标签、种类、详情与文档。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |
| `maxItems` | `number`（1–100） | 否 | 最多返回多少条，默认 20 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8, "maxItems": 10 }
```

## 重构与格式化

### lsp_prepare_rename
校验该位置的符号能否重命名，返回可重命名范围；不修改任何文件。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_rename
在工作区范围内重命名符号，返回改动文件数与编辑位置摘要。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |
| `newName` | `string` | 是 | 新的符号名 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8, "newName": "loadConfig" }
```

### lsp_code_actions
列出指定范围内可用的代码操作（快速修复、重构、整理导入等）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `startLine` `startChar` `endLine` `endChar` | `number` | 是 | 范围四元组，全部 0-based |
| `kind` | `string` | 否 | 按操作种类前缀过滤，如 `"quickfix"`、`"refactor"` |

```json
{ "filePath": "/project/app.ts", "startLine": 10, "startChar": 0, "endLine": 10, "endChar": 24, "kind": "quickfix" }
```

### lsp_execute_code_action
按标题（模糊匹配）执行一条代码操作，并应用它带来的工作区编辑或命令。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `startLine` `startChar` `endLine` `endChar` | `number` | 是 | 范围四元组，全部 0-based |
| `title` | `string` | 是 | 要执行的操作标题，模糊匹配 |

```json
{ "filePath": "/project/app.ts", "startLine": 10, "startChar": 0, "endLine": 10, "endChar": 24, "title": "Remove unused import" }
```

### lsp_format_document
用语言服务器格式化整个文档。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_format_range
只格式化文档中的指定范围。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `startLine` `startChar` `endLine` `endChar` | `number` | 是 | 范围四元组，全部 0-based |

```json
{ "filePath": "/project/app.ts", "startLine": 10, "startChar": 0, "endLine": 40, "endChar": 0 }
```

## 调用层级与类型层级

### lsp_prepare_call_hierarchy
为符号准备调用层级，返回后续查询要用的层级项。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_incoming_calls
用 `lsp_prepare_call_hierarchy` 返回的层级项查询"谁调用了它"。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `item` | `object` | 是 | 上一步返回的层级项，原样传入 |

```json
{ "item": { "name": "loadConfig", "kind": 12, "uri": "file:///project/app.ts" } }
```

### lsp_outgoing_calls
用同一个层级项查询"它调用了谁"。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `item` | `object` | 是 | 上一步返回的层级项，原样传入 |

```json
{ "item": { "name": "loadConfig", "kind": 12, "uri": "file:///project/app.ts" } }
```

### lsp_type_hierarchy_supertypes
查询类型的父类型。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

### lsp_type_hierarchy_subtypes
查询类型的子类型。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` `line` `character` | `string` `number` `number` | 是 | 文件绝对路径、0-based 行号、0-based 字符偏移 |

```json
{ "filePath": "/project/app.ts", "line": 42, "character": 8 }
```

## 文档结构与服务器

### lsp_folding_ranges
返回文档的可折叠范围，用于快速概览文件结构。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_selection_ranges
返回一组位置由内到外的嵌套选择范围。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `positions` | `{ line, character }[]`（1–50 项） | 是 | 要展开的位置列表，元素为 0-based 行列 |

```json
{ "filePath": "/project/app.ts", "positions": [{ "line": 42, "character": 8 }] }
```

### lsp_semantic_tokens
返回文档的语义 Token（语法高亮所需的分类与修饰信息）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_code_lens
返回代码镜头——函数上方的运行/测试/调试入口与引用计数等。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_inlay_hints
返回内联提示（推断出的类型、参数名），可限定范围。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |
| `startLine` `startChar` `endLine` `endChar` | `number` | 否 | 可选的 0-based 范围限制；省略时覆盖整个文档 |

```json
{ "filePath": "/project/app.ts", "startLine": 10, "startChar": 0, "endLine": 40, "endChar": 0 }
```

### lsp_document_links
返回文档中的可点击链接（导入路径、URL 等）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.ts" }
```

### lsp_document_colors
返回文档中的颜色引用及其范围。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件绝对路径 |

```json
{ "filePath": "/project/app.css" }
```

### lsp_servers
列出已检测与正在运行的语言服务器：语言 ID、状态、PID、能力摘要与运行时长。无参数。

```json
{}
```

### lsp_restart_server
按语言 ID 重启语言服务器（关掉旧进程再启动新的），返回新 PID 与状态。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `languageId` | `string` | 是 | 语言 ID，如 `"typescript"`、`"python"`、`"go"` |

```json
{ "languageId": "typescript" }
```

## 常见错误

- **返回"不支持"**：工具可用不等于服务器实现了该能力，先查 `lsp_servers` 再换同类工具（没有 `implementationProvider` 就改用 `lsp_find_references`）。
- **请求超时**：索引大项目时可能超时，重试或缩小到单文件通常更快。
- **位置对不上**：`line` 与 `character` 都是 0-based，编辑器显示的第 42 行要传 `line: 41`。
- **语言未配置**：返回 `No language server configured` 时，需先安装并配置该语言的服务器。
