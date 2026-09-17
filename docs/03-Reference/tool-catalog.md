---
title: 工具目录
description: rolebox 内置工具总索引：按能力域分册、工具与函数的区别、平台可用性矩阵与旧锚点跳转表
---

# 工具目录（Tool Catalog）

这一页回答三件事：rolebox 有哪些内置工具、每个工具的完整说明在哪个分册、以及它在你的 harness 上能不能用。工具的参数、返回格式与调用示例都落在四个分册页里，本页只做索引与路由。

> 相关：[函数系统](/02-Guide/functions)｜[role.yaml 参考](/03-Reference/role-yaml)｜[CLI 参考](/03-Reference/cli)｜[平台与 Harness](/01-Overview/platform-harnesses)

## 工具与函数

rolebox 有两个容易混淆的扩展机制。选错了，提示词写了也不会生效。

| 维度 | 工具（Tool） | 函数（Function） |
|---|---|---|
| 定义方式 | TypeScript 代码，参数用 Zod schema 声明 | Markdown 文件或 `role.yaml` 里的声明 |
| 由谁调用 | 模型在对话中自行调用 | 用户以 `\|函数名\|` 前缀激活 |
| 生命周期 | 直接执行，没有状态机 | 有状态机：自动激活、条件过渡 |
| 典型用途 | 文件、代码智能、网络、编排等系统级动作 | 工作流驱动的步骤 |
| 在哪里说明 | 本页的四个分册 | [函数系统](/02-Guide/functions) |

工具在运行时注册到 harness 的工具表里，模型看到的工具清单因此随 harness 而异（见下一节的矩阵）。

## 能力域与分册

78 个工具键按能力域分成四册。每一册里，每个工具都是"摘要行 + 参数表 + 调用示例"三件套。

| 能力域 | 工具数 | 分册 |
|---|---|---|
| 代码智能（LSP） | 32 | [LSP 工具](/03-Reference/tools/lsp-tools) |
| 会话与记忆 | 11 | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| 编排（图 / 调度查询 / 循环 / 信号） | 23 | [编排工具](/03-Reference/tools/orchestration-tools) |
| 平台（行哈希编辑 / 资产 / 网络 / 终端） | 12 | [平台工具](/03-Reference/tools/platform-tools) |
| **合计** | **78** | — |

> 78 个工具键里有 1 个——`task_retry`——从未被任何 harness 注册（OpenCode 与 Pi 在注册时都显式剔除了它），因此三个 harness 实际可注册的键合起来是 77 个；它只在[编排工具](/03-Reference/tools/orchestration-tools)的说明里出现。

四个分册各覆盖哪些工具：

- **[LSP 工具](/03-Reference/tools/lsp-tools)**（32）：`lsp_diagnostics`、`lsp_goto_definition`、`lsp_goto_type_definition`、`lsp_goto_implementation`、`lsp_goto_declaration`、`lsp_find_references`、`lsp_document_highlights`、`lsp_document_symbols`、`lsp_workspace_symbols`、`lsp_hover`、`lsp_signature_help`、`lsp_completion`、`lsp_prepare_rename`、`lsp_rename`、`lsp_code_actions`、`lsp_execute_code_action`、`lsp_format_document`、`lsp_format_range`、`lsp_prepare_call_hierarchy`、`lsp_incoming_calls`、`lsp_outgoing_calls`、`lsp_type_hierarchy_supertypes`、`lsp_type_hierarchy_subtypes`、`lsp_folding_ranges`、`lsp_selection_ranges`、`lsp_semantic_tokens`、`lsp_code_lens`、`lsp_inlay_hints`、`lsp_document_links`、`lsp_document_colors`、`lsp_servers`、`lsp_restart_server`
- **[会话与记忆工具](/03-Reference/tools/session-memory-tools)**（11）：6 个 `session_*`（`session_list`、`session_search`、`session_read`、`session_info`、`session_diff`、`session_fork`）、4 个 `memory_*`（`memory_write`、`memory_recall`、`memory_list`、`memory_update`）、`load_role_skill`
- **[编排工具](/03-Reference/tools/orchestration-tools)**（23）：8 个 `graph_*`（`graph_create`、`graph_add_node`、`graph_add_edge`、`graph_add_loop`、`graph_run`、`graph_status`、`graph_cancel`、`graph_approve`）、`function_graph`、6 个 `task_*`（`task_search`、`task_graph`、`task_budget`、`task_chronology`、`task_export`、`task_retry`）、6 个 `loop_*`（`loop_start`、`loop_status`、`loop_cancel`、`loop_output`、`loop_history`、`loop_list`）、`signal`、`context_assemble`
- **[平台工具](/03-Reference/tools/platform-tools)**（12）：`hashline_read`、`hashline_edit`、`asset_search`、`asset_inspect`、`asset_validate`、`asset_hot_reload`、`skill_compose`、`reference_search`、`web_search`、`web_read`、`web_fetch`、`interactive_terminal`

## 平台可用性矩阵

工具集由装配层决定，不是"装了 rolebox 就全都有"。下表是各 harness 的实际注册范围。

| 工具域 | OpenCode | Pi | dsh |
|---|---|---|---|
| 共享集合（20 个：行哈希 2、记忆 3、网络 3、`signal`、`interactive_terminal`、资产与引用 4、会话 6） | ✅ | ✅ | ✅ |
| 8 个 `graph_*` | ✅ | ✅ | ✅ |
| 5 个 `task_*`（`task_retry` 被扣留） | ✅ | ✅ | ❌ |
| 6 个 `loop_*` | ❌ | ❌ | ✅ |
| 32 个 `lsp_*` | ✅ | ✅ | ❌ |
| `memory_update` | ✅ | ✅ | ❌ |
| `function_graph` | ✅ | ✅ | ❌ |
| `skill_compose` | ✅ | ✅ | ❌ |
| `context_assemble` | ✅ | ✅ | ❌ |
| `asset_hot_reload` | ✅ | ❌ | ❌ |
| `load_role_skill` | ❌ | ✅ | ❌ |
| **合计** | **70** | **70** | **34** |

三条容易踩的边界：

- `task_retry` 仍然存在于工厂里，但 OpenCode 与 Pi 在注册时都显式剔除了它——它会绕过图的预算与审批约束，因此**只可读、不可调**。
- `loop_*` 目前只在 dsh 上注册；OpenCode 与 Pi 的注册调用点已被停用，工厂保留但工具不可调用。
- 旧的 `dispatch_*` 家族（`dispatch`、`dispatch_output`、`dispatch_status`、`dispatch_cancel`、`dispatch_metrics`、`dispatch_progress`、`dispatch_stream`、`dispatch_checkpoint`、`dispatch_budget`、`dispatch_approve`、`dispatch_reject`）已不再注册为可调用工具：编排统一走 `graph_*`，其中 `dispatch_approve` / `dispatch_reject` 由 `graph_approve` 取代。迁移写法见[迁移对照](/06-Appendix/migration)。

装配与覆盖规则的细节（哪些工具来自共享集合、哪些来自平台追加）见[平台工具](/03-Reference/tools/platform-tools)的「平台门控」一节。

## 旧锚点跳转表

只做索引的代价是：旧页面的 `/03-Reference/tool-catalog#某个工具名` 这类书签不再直接命中。下表按旧页面出现顺序列出每一个章节锚点，右侧是它现在所在的分册页。

| 旧锚点 | 现在去哪 |
|---|---|
| `#工具目录` | [工具目录](/03-Reference/tool-catalog)（本页） |
| `#lsp-工具-代码智能` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-diagnostics` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-goto-definition` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-workspace-symbols` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-find-references` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-completion` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-code-actions` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-format-document-lsp-format-range` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-rename` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-hover` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#lsp-servers` | [LSP 工具](/03-Reference/tools/lsp-tools) |
| `#会话工具-session-tools` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-list` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-search` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-read` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-info` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-diff` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#session-fork` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#记忆工具-memory-tools` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#memory-write` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#memory-recall` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#memory-list` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#memory-update` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#调度查询工具-dispatch-query-budget` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#调度工具-dispatch-tools-—-工厂保留但未注册` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-search` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-graph` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-budget` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-chronology` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-export` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#task-retry-工厂保留但未注册` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#循环工具-loop-tools` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-start` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-status` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-cancel` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-output` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-history` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#loop-list` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#交互式终端工具-interactive-terminal` | [平台工具](/03-Reference/tools/platform-tools) |
| `#interactive-terminal` | [平台工具](/03-Reference/tools/platform-tools) |
| `#技能加载工具-skill-loading` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#load-role-skill` | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| `#graph-工具-v2-引擎` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-create` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-add-node` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-add-edge` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-add-loop` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-run` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-status` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-cancel` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#graph-approve` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#函数图工具-function-graph` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#function-graph` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#资产管理工具-asset-tools` | [平台工具](/03-Reference/tools/platform-tools) |
| `#asset-search` | [平台工具](/03-Reference/tools/platform-tools) |
| `#asset-inspect` | [平台工具](/03-Reference/tools/platform-tools) |
| `#asset-validate` | [平台工具](/03-Reference/tools/platform-tools) |
| `#asset-hot-reload` | [平台工具](/03-Reference/tools/platform-tools) |
| `#skill-compose` | [平台工具](/03-Reference/tools/platform-tools) |
| `#reference-search` | [平台工具](/03-Reference/tools/platform-tools) |
| `#网络工具-web-tools` | [平台工具](/03-Reference/tools/platform-tools) |
| `#web-search` | [平台工具](/03-Reference/tools/platform-tools) |
| `#web-read` | [平台工具](/03-Reference/tools/platform-tools) |
| `#web-fetch` | [平台工具](/03-Reference/tools/platform-tools) |
| `#行哈希编辑工具-hashline-tools` | [平台工具](/03-Reference/tools/platform-tools) |
| `#hashline-read` | [平台工具](/03-Reference/tools/platform-tools) |
| `#hashline-edit` | [平台工具](/03-Reference/tools/platform-tools) |
| `#信号与上下文工具` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#signal` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#context-assemble` | [编排工具](/03-Reference/tools/orchestration-tools) |
| `#平台可用性矩阵-harness-scope` | [工具目录](/03-Reference/tool-catalog)（本页） |
| `#核心要点` | [工具目录](/03-Reference/tool-catalog)（本页） |
| `#工具与函数的区分` | [工具目录](/03-Reference/tool-catalog)（本页） |
| `#下一步` | [工具目录](/03-Reference/tool-catalog)（本页） |

旧版页面中还有一个 `#task-concurrency` 锚点，对应的小节已更名为 `task_chronology`，归属同上。

## 怎么用这套目录

1. 先用本页的四册分类表定位能力域，或直接在搜索里查工具名。
2. 进分册页后，每个工具都是"摘要行 → 参数表 → 调用示例"；示例可直接改写后调用。
3. 调用前不确定工具在当前 harness 是否存在，回到本页的「平台可用性矩阵」核对——不存在的工具名会被宿主拒绝，而不是被静默忽略。

想理解工具背后的机制，而不是怎么调用它们，看[架构概览](/01-Overview/architecture-overview)与[处理管道](/01-Overview/processing-pipeline)。
