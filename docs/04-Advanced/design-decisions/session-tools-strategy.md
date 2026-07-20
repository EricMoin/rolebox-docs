---
title: 会话工具套件 — 实现策略（历史记录）
description: 10 工具会话管理套件的实现策略文档 — 架构概览、工具规格、状态管理、实现计划与测试策略
---

::: warning 免责声明
本文档为 rolebox 内部实现策略的历史记录，基于 2026-07-03 的设计决策编写。**内容可能已过时**，具体行为以实际源码和当前文档为准。仅供内部参考和架构回溯。

相关用户文档请参阅：[会话工具](/04-Advanced/session-tools)。
:::

::: tip 快速参考
以下是规划工具名与实际注册工具名的映射表。请在会话工具用户文档中查阅各工具的详细参数和使用示例。

| 规划工具名 | 实际工具名 | 状态 | 源码位置 |
|-----------|-----------|------|---------|
| `session_list` | `session_list` | ✅ 已实现 | `src/session/session-browse-tools.ts` |
| `session_read` | `session_read` | ✅ 已实现 | `src/session/session-inspect-tools.ts` |
| `session_search` | `session_search` | ✅ 已实现 | `src/session/session-browse-tools.ts` |
| `session_info` | `session_info` / `session_inspect` | ✅ 已实现（+别名） | `src/session/session-inspect-tools.ts` |
| — | `session_diff` / `session_changes` | 🆕 新增（未在原始规划中） | `src/session/session-inspect-tools.ts` |
| — | `session_fork` / `session_branch` | 🆕 新增（未在原始规划中） | `src/session/session-inspect-tools.ts` |
| `session_analytics` | — | ⏳ 推迟 | — |
| `session_export` | — | ⏳ 推迟 | — |
| `session_tag` | — | ⏳ 推迟 | — |
| `session_resume` | — | ⏳ 推迟 | — |
| `session_timeline` | — | ⏳ 推迟 | — |
| `session_link` | — | ⏳ 推迟 | — |

> 实际工具注册见 `src/platform/tool-assembly.ts:100-109`。推迟的工具将在未来版本中评估。
:::

# Session Tools Suite — Implementation Strategy

**Date:** 2026-07-03
**Target:** rolebox v0.17.0
**Objective:** Implement a 10-tool session management suite comprising 4 parity tools (matching omo capabilities) and 6 new tools (exceeding omo), with full unit-test coverage.

---

## 1. Architecture Overview

### 1.1 File Structure

```
src/session/
  types.ts          — Internal types (SessionLinkRecord, AnalyticsResult, etc.)
  tools.ts          — All 10 tool creation functions (tool creators)
  analytics.ts      — Analytics computation engine (pure, no I/O)
  export.ts         — Markdown/JSON session export formatting
  search.ts         — Text search utility across SessionMessage arrays
  linking.ts        — Session-task link persistence (state file)

tests/session/
  tools.test.ts     — Unit tests for all 10 tools (mock client)
  analytics.test.ts — Unit tests for analytics computation
  export.test.ts    — Unit tests for export formatting
  search.test.ts    — Unit tests for text search
  linking.test.ts   — Unit tests for link persistence
```

### 1.2 Integration Point

In `src/plugin-hooks.ts`, add to the `tool:` object alongside dispatch tools:

```typescript
import {
  createSessionListTool, createSessionReadTool, createSessionSearchTool,
  createSessionInfoTool, createSessionAnalyticsTool, createSessionExportTool,
  createSessionTagTool, createSessionResumeTool, createSessionTimelineTool,
  createSessionLinkTool,
} from "./session/tools.ts";

// Inside createPluginHooks:
return {
  tool: {
    // ... existing dispatch tools ...
    session_list: createSessionListTool(client),
    session_read: createSessionReadTool(client),
    session_search: createSessionSearchTool(client),
    session_info: createSessionInfoTool(client),
    session_analytics: createSessionAnalyticsTool(client),
    session_export: createSessionExportTool(client),
    session_tag: createSessionTagTool(client),
    session_resume: createSessionResumeTool(client),
    session_timeline: createSessionTimelineTool(client),
    session_link: createSessionLinkTool(deps),  // needs HookDeps
  },
};
```

**No changes to `HookDeps` needed** — `client` and `dispatchManager` are already present. Only `session_link` requires `deps` (all others take only `client`).

### 1.3 Tool Creation Pattern

All tools follow the existing pattern from `src/dispatch/tools.ts`:

```typescript
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";

export function createMyTool(client: PluginInput["client"]) {
  return tool({
    description: "...",
    args: {
      param: z.string().describe("..."),
      optional: z.number().int().min(1).optional().describe("..."),
    },
    async execute(input, context) {
      // context provides: sessionID, messageID, agent, directory, worktree, abort
      // Use context.directory for client call `directory` parameter
      // Return string
    },
  });
}
```

### 1.4 Critical: SDK v2 API Call Pattern

The opencode v2 SDK uses **flat parameter objects** and returns a `RequestResult` envelope. **Every client call must follow this pattern:**

```typescript
// ✅ CORRECT — flat params
const result = await client.session.get({
  sessionID: input.session_id,
  directory: context.directory,   // always include for project scoping
});

// ✅ CORRECT — unwrap the RequestResult envelope
function unwrap<T>(result: { data?: T; error?: unknown }, label: string): T | null {
  if (result.error) {
    log.warn(`API error: ${label}`, { error: result.error });
    return null;
  }
  if (!result.data) {
    log.warn(`No data from: ${label}`);
    return null;
  }
  return result.data as T;
}

// ✅ CORRECT usage pattern in every tool:
const sessionResult = await client.session.get({ sessionID: sid, directory: context.directory });
const session = unwrap(sessionResult, "session.get");
if (!session) return `Error: Could not fetch session ${sid}.`;
```

**Key SDK method signatures (v2):**

| Method | Signature |
|---|---|
| `client.session.list({ directory?, search?, limit? })` | flat params |
| `client.session.get({ sessionID, directory? })` | flat params |
| `client.session.messages({ sessionID, directory?, limit? })` | flat params |
| `client.session.todo({ sessionID, directory? })` | flat params |
| `client.session.children({ sessionID, directory? })` | flat params |
| `client.session.create({ title?, parentID?, agent?, model?, metadata? })` | flat params |
| `client.session.update({ sessionID, title?, metadata? })` | flat params |
| `client.experimental.session.list({ directory?, archived?, limit? })` | flat params |

### 1.5 Conflict Strategy with omo

The 4 parity tools use the **same names** as omo's tools: `session_list`, `session_read`, `session_search`, `session_info`. Rolebox already coexists with omo (per README). Each tool's description signals superiority.

### 1.6 Logging

All modules use the existing pattern:
```typescript
import { createSubLogger } from "../logger.ts";
const log = createSubLogger("session-tools");
```

---

## 2. Internal Types (`src/session/types.ts`)

```typescript
export interface SessionLinkRecord {
  taskId: string;
  sessionId: string;
  createdAt: string;  // ISO 8601
}

export interface AnalyticsResult {
  sessions: number;
  dateRange: { earliest: string; latest: string };
  tokens: { total: number; input: number; output: number; reasoning: number };
  cost: number;
  toolDistribution: Record<string, number>;
  modelBreakdown: Record<string, number>;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export interface TimelineBucket {
  time: string;
  count: number;
  tokens: number;
  cost: number;
}

export interface SearchMatch {
  sessionId: string;
  sessionTitle: string;
  matchText: string;
  contextBefore: string[];
  contextAfter: string[];
}

export type ExportFormat = "markdown" | "json";

export interface TagResult {
  tags: string[];
}
```

---

## 3. Tool Specifications

### 3.1 `session_list` — List Sessions (Parity, Enhanced)

**Zod args:**
```typescript
{
  project_path: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  agent: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  include_archived: z.boolean().optional(),
  include_message_count: z.boolean().optional().default(false),
}
```

**Execute:** Call `client.session.list({ directory: context.directory, search: input.search, limit: input.limit })`. If `include_archived`, also call `client.experimental.session.list({ archived: true, limit: input.limit })`. Filter client-side by `from_date`/`to_date`, and by `agent`. If `include_message_count` is true, fetch messages for each session in parallel (capped at 20 concurrent).

**Exceeds omo:** Richer columns (tokens, cost, model), cross-project archived support, optional message counts.

### 3.2 `session_read` — Read Session Messages (Parity, Enhanced)

**Zod args:**
```typescript
{
  session_id: z.string(),
  include_todos: z.boolean().optional().default(false),
  include_transcript: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional(),
  message_type: z.enum(["user","assistant","tool","all"]).optional().default("all"),
  offset: z.number().int().min(0).optional().default(0),
}
```

**Execute:** Call `client.session.get()` for metadata. Call `client.session.messages()` for messages. Filter by `message_type`, apply offset/limit pagination. Render tool calls expanded with args/result (truncated to 2000 chars). Conditionally fetch todos and children.

**Exceeds omo:** message_type filter, offset/limit pagination, tool call expansion.

### 3.3 `session_search` — Search Sessions (Parity, Enhanced)

**Zod args:**
```typescript
{
  query: z.string().min(1),
  session_id: z.string().optional(),
  case_sensitive: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(50).default(20),
  include_context: z.boolean().optional().default(true),
}
```

**Exceeds omo:** Cross-session search, context window around matches.

### 3.4 `session_info` — Session Metadata (Parity, Enhanced)

**Exceeds omo:** Token breakdown, cost, share URL, file changes, children table.

### 3.5 `session_analytics` — Analytics Dashboard (NEW)

**Zod args:**
```typescript
{
  session_id: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  group_by: z.enum(["day","week","model","agent"]).optional().default("day"),
  format: z.enum(["summary","json"]).optional().default("summary"),
}
```

**Execute:** Fetch sessions, filter by date range. For message-level analytics, fetch messages for qualifying sessions in parallel — **capped at 20 sessions, batched in chunks of 5**. If more than 20 sessions qualify, sample the 20 most recent and warn.

**Exceeds omo:** Token trends, tool call distribution, model usage breakdown, time-bucketed views.

### 3.6 `session_export` — Export Session (NEW)

**Zod args:**
```typescript
{
  session_id: z.string(),
  format: z.enum(["markdown","json"]).optional().default("markdown"),
  include_todos: z.boolean().optional().default(true),
  include_transcript: z.boolean().optional().default(true),
  output_path: z.string().optional(),
}
```

**Exceeds omo:** Not available in omo. Enables offline viewing, sharing, archiving.

### 3.7 `session_tag` — Tag/Bookmark Sessions (NEW)

**Persistence:** Uses opencode's built-in session `metadata` field with the namespaced key `rolebox_tags`.

**Exceeds omo:** Not available in omo.

### 3.8 `session_resume` — Resume Context from Previous Session (NEW)

**Execute:** Fetch source session, extract last 3 assistant messages for context. Create new session via `client.session.create()`. Do NOT call `promptAsync` — just create and return the ID.

**Exceeds omo:** Not available in omo. Enables continuity across sessions.

### 3.9 `session_timeline` — Activity Timeline (NEW)

**Exceeds omo:** Not available in omo. Visualizes session patterns over time.

### 3.10 `session_link` — Link Dispatch Tasks to Sessions (NEW)

**Persistence:** `.rolebox/state/session-links.json` using atomic write pattern.

**Exceeds omo:** Not available in omo. Bridges rolebox's dispatch and session domains.

---

## 4. State Management

### 4.1 Session Tag Persistence

Uses opencode's built-in `client.session.update()` with `metadata.rolebox_tags` (JSON string array). Key is namespaced to avoid collision.

```typescript
await client.session.update({
  sessionID: sessionId,
  metadata: { rolebox_tags: ["important", "review-later"] },
});
```

### 4.2 Session-Task Link Persistence (`src/session/linking.ts`)

```typescript
// State file: .rolebox/state/session-links.json
// Format: SessionLinkRecord[]
```

**Persistence pattern** (same as `src/dispatch/task-store.ts`):
1. Read existing data from file (or start with `[]` if file doesn't exist)
2. Mutate in-memory
3. Write atomically: `writeFileSync(tmpPath, json); renameSync(tmpPath, targetPath)`

### 4.3 No Other Custom State

All other tools (search, analytics, export, timeline) are stateless.

---

## 5. Utility Specifications

### 5.1 `src/session/search.ts`

Searches `SessionMessageUser` (text field) and `SessionMessageAssistant` (content parts with `type: "text"`). Excludes shell output, synthetic, compaction, and agent/model-switched messages.

### 5.2 `src/session/analytics.ts`

Pure synchronous function — no I/O. Computes: token totals, cost aggregation, tool call frequency, model usage breakdown, duration stats. Handles empty input gracefully (returns zeroes).

### 5.3 `src/session/export.ts`

Markdown format: `# {title}` header, metadata block, `## Messages` section with timestamped entries, tool calls in fenced code blocks. JSON: standard `JSON.stringify`.

---

## 6. Implementation Plan (22 Subtasks)

### Phase 1: Scaffolding
**Subtask 1** — Create `src/session/` directory, `types.ts`, and barrel `tools.ts`.

### Phase 2: Utilities
**Subtask 2** — `src/session/linking.ts`
**Subtask 3** — `src/session/search.ts`
**Subtask 4** — `src/session/analytics.ts`
**Subtask 5** — `src/session/export.ts`

### Phase 3: Tools
**Subtask 6-15** — All 10 tool creation functions (list, read, search, info, analytics, export, tag, resume, timeline, link)

### Phase 4: Integration
**Subtask 16** — Wire all tools into `src/plugin-hooks.ts`

### Phase 5: Testing
**Subtask 17-21** — 5 test files (tools, analytics, export, search, linking)

### Phase 6: Verification
**Subtask 22** — Full test suite, `tsc --noEmit`, regression check

---

## 7. Dependency Graph

```
[1] Scaffolding
 ├── [2] linking
 ├── [3] search
 ├── [4] analytics
 └── [5] export
                 
 [6-15] tools ──── depends on [2-5]
 [16] WIRING ───── depends on [6-15]
 [17-21] tests ─── depends on [16]
 [22] VERIFY ───── depends on [17-21]
```

**Critical path:** [1] → [3] → [8] → [16] → [17] → [22] (6 steps)

---

## What Changed Since This Strategy

本文档规划于 2026-07-03，截至当前文档编写时的实际实现差异如下：

| 规划项 | 策略预期 | 实际现状 | 说明 |
|-------|---------|---------|------|
| 10 个工具 | 10 工具完整套件 | 6 工具 + 3 别名 | `src/session/` 6 个独立工具函数 |
| session_analytics | 独立分析仪表盘 | ⏳ 推迟，通过 `session_info`（别名 `session_inspect`）提供部分数据 | `collectSessionAnalytics` 数据源已实现 |
| session_export | Markdown/JSON 导出 | ⏳ 推迟 | — |
| session_tag | metadata.rolebox_tags | ⏳ 推迟 | — |
| session_resume | 创建延续会话 | ⏳ 推迟 | — |
| session_timeline | 时间线可视化 | ⏳ 推迟，推荐使用 `task_chronology` 替代 | — |
| session_link | 任务-会话关联 | ⏳ 推迟 | — |
| session_diff | 未规划 | 🆕 新增 (`session_diff` + 别名 `session_changes`) | 对比两次会话差异 |
| session_fork | 未规划 | 🆕 新增 (`session_fork` + 别名 `session_branch`) | 会话分叉独立副本 |
| 工具创建模式 | `create*Tool(client)` | ✅ 按计划实现 | 使用 `defineTool`（`src/platform/ports/tool-factory.ts`） |
| SDK API 模式 | 扁平参数 + RequestResult 解包 | ✅ 按计划实现 | SessionClientWrapper 封装 |

> **注意：** 实际工具注册见 `src/platform/tool-assembly.ts:100-109`。推迟的工具未来可能以不同形式实现。

## 8. Test Plan

Following `tests/dispatch/tools.test.ts`: Use `bun:test`, mock `OpencodeClient` stubs, test each tool for happy path, empty results, error handling, edge cases.

### Minimum Test Cases per Tool
- **session_list:** basic list, date filtering, agent filtering, empty results, include_archived, include_message_count
- **session_read:** full transcript, user-only filter, pagination, todo inclusion, tool call expansion
- **session_search:** single-session, cross-session, case sensitivity, context, no results
- **session_info:** full metadata, no todos, no children
- **session_analytics:** summary, JSON, single session, empty, sampling
- **session_export:** markdown, JSON, file write, atomicity
- **session_tag:** list, add, remove, reject long
- **session_resume:** success, missing source, no messages
- **session_timeline:** day/hour/week grouping, too few
- **session_link:** list, link, unlink, invalid, query

---

## 9. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Tool name collision with omo | Medium | Same names but richer descriptions; rolebox already coexists with omo |
| SDK API changes between opencode versions | Medium | Pin peer dependency; wrap all client calls in error-unwrapping pattern |
| Large session message volume causing memory pressure | Low | Cap parallel fetches (20 sessions, batched 5 at a time) |
| `metadata.rolebox_tags` conflict with other plugins | Low | Namespaced key |
| `experimental.session.list` API deprecation | Low | Fall back to v1 session.list with archived check |

---

## 10. Environment Variables

None required. All configuration is via tool parameters.

---

## 11. Acceptance Criteria

1. All 10 tools registered as `plugin.tool` hooks in `src/plugin-hooks.ts`
2. `tsc --noEmit` passes with zero errors
3. `bun test tests/session/` passes all 5 test files (minimum 40+ test cases)
4. `bun test tests/dispatch/` and `bun test tests/plugin-hooks.test.ts` pass with no regressions
5. All client API calls use correct v2 flat parameter signatures with `directory: context.directory`
6. All client API calls unwrap the `RequestResult` envelope with error handling
7. `session_link` tool uses `HookDeps`; all other 9 tools use only `PluginInput["client"]`
8. Atomic file writes use `.tmp` + `renameSync` pattern
9. Logger sub-loggers created for each module


## 下一步

- [会话工具](/04-Advanced/session-tools) — 会话工具用户文档与使用指南
- [记忆系统](/04-Advanced/memory-system) — 跨会话持久记忆
- [CLI 参考](/03-Reference/cli) — 命令行工具完整参考
