---
title: 会话与记忆工具
description: 会话与记忆工具分册：6 个会话工具、4 个记忆工具与技能加载工具的完整参数、返回与调用示例
---

# 会话与记忆工具（Session & Memory）

这一册回答："让代理回顾过去的对话、跨会话记住一件事"分别该调哪个工具、传什么参数。会话工具读的是 harness 的会话存储，记忆工具写的是 rolebox 自己的记忆库，两者的持久化位置和作用域完全不同。

> 返回[工具目录](/03-Reference/tool-catalog)｜平台范围：会话与记忆工具三个 harness 都注册；`memory_update` 与 `load_role_skill` 例外，见下文；自 v0.20.0 起提供记忆工具，会话工具自 v0.17.0 起提供。

## 会话工具

6 个会话工具读取 harness 的会话记录：列会话、搜消息、读转录、看统计、看文件变更、分叉。它们只在 harness 提供了会话客户端时注册，OpenCode / Pi / dsh 三者都满足。

**共同约定**：除 `session_list` 与 `session_search` 外，其余工具都必须显式传 `session_id`；ID 从 `session_list` 或 `session_search` 的结果里复制，表格输出的是完整 ID，可以直接回填。

### session_list

按日期范围或项目目录列出会话，返回 Markdown 表格（会话 ID、标题、消息数、日期范围、时长），按更新时间倒序。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `limit` | `number`（1–100） | 否 | 最大返回条数，默认 20 |
| `from_date` | `string` | 否 | ISO 8601 起始时间，按创建时间过滤 |
| `to_date` | `string` | 否 | ISO 8601 结束时间 |
| `project_path` | `string` | 否 | 按项目目录过滤，默认当前目录 |

```json
{ "limit": 5, "from_date": "2026-01-01" }
```

```text
应看到：
| Session ID | Title | Messages | Date Range | Duration |
|------------|-------|----------|------------|----------|
| ses_abc123 | 修复图引擎预算 | 42 | 2026-01-03 → 2026-01-03 | 12m |
```

### session_search

跨会话全文搜索消息，返回带上下文的匹配片段。匹配是**纯子串匹配**（默认不区分大小写），不是模糊搜索。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 搜索文本 |
| `session_id` | `string` | 否 | 限定在单个会话内搜索；省略则跨会话 |
| `case_sensitive` | `boolean` | 否 | 大小写敏感，默认 false |
| `limit` | `number`（1–100） | 否 | 最大结果数，默认 20 |
| `include_tool_output` | `boolean` | 否 | 同时搜索工具调用输出，默认 false |
| `format` | `"markdown" \| "json"` | 否 | 输出格式，默认 markdown |

```json
{ "query": "数据库连接超时", "limit": 10 }
```

**注意**：每个匹配只带 80 字符的上下文窗口；跨会话搜索最多扫描 200 个会话，被截断时结果末尾会出现 `(searched first 200 sessions only)`；markdown 输出最多展示前 20 条匹配。

### session_read

读取会话的完整转录，支持按角色、工具与消息范围过滤。会话不存在时返回 `Session not found: <id>`。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 会话 ID |
| `include_todos` | `boolean` | 否 | 附带待办列表 |
| `include_thinking` | `boolean` | 否 | 包含推理过程 |
| `include_tool_results` | `boolean` | 否 | 包含工具调用输出 |
| `limit` | `number` | 否 | 最大消息数；省略返回全部 |
| `offset` | `number` | 否 | 跳过前 N 条消息，默认 0 |
| `role_filter` | `"user" \| "assistant"` | 否 | 只显示指定角色 |
| `tool_filter` | `string` | 否 | 只显示匹配该工具名的调用（子串匹配） |

```json
{ "session_id": "ses_abc123", "include_tool_results": true, "limit": 50 }
```

### session_info

返回单个会话的综合统计：元数据（标题、ID、项目、目录、创建 / 更新 / 时长、版本、父会话）、消息 / 子会话 / 状态计数、Token 用量（input / output / reasoning / cache read / cache write）、总成本、模型分布、工具调用频率、文件变更统计，以及存在待办时的完成进度。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 会话 ID |

```json
{ "session_id": "ses_abc123" }
```

### session_diff

返回**单个会话内部**的文件变更 unified diff，可用 `message_id` 截断到某条消息之前。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 会话 ID |
| `message_id` | `string` | 否 | 只取该消息之前的差异 |

```json
{ "session_id": "ses_abc123", "message_id": "msg_456" }
```

**它不是会话对比工具**：参数只有 `session_id` 与 `message_id`，要比较两个会话的文件差异，请分别 `session_diff` 后自行比对。没有变更时返回 `No file changes in this session.`

### session_fork

在指定消息处分叉会话，成功后返回 `## Session Forked Successfully` 并列出原会话与新会话的完整 ID。新会话独立演进，与源会话互不影响。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | `string` | 是 | 要分叉的会话 |
| `message_id` | `string` | 否 | 在该消息处分叉；省略则在最新消息处 |

```json
{ "session_id": "ses_abc123", "message_id": "msg_456" }
```

### 配套用法：定位 → 检查 → 分叉

```text
session_list(from_date="2026-07-01", to_date="2026-07-15", limit=50)   # 1. 找候选会话
session_info(session_id="ses_abc123")                                  # 2. 看成本、工具分布、文件变更
session_read(session_id="ses_abc123", include_tool_results=true)       # 3. 读转录
session_fork(session_id="ses_abc123", message_id="msg_456")            # 4. 从分叉点另起一条线
```

## 记忆工具

4 个记忆工具把事实、偏好、教训写入 rolebox 的记忆库（SQLite + FTS5 持久化），并支持跨会话检索。`memory_write` / `memory_recall` / `memory_list` 三个在 OpenCode / Pi / dsh 都注册；`memory_update` 只在 OpenCode 与 Pi 注册。

**作用域（scope）是记忆工具最关键的参数**：

| 取值 | 含义 |
|---|---|
| `workspace` | 共享——当前工作区的所有角色都能读到 |
| `role` | 私有——只有写入它的角色能读到（`memory_write` 的默认值） |
| `both` | 检索时合并两个作用域（`memory_recall` / `memory_list` 的默认值） |

### memory_write

写入一条新记忆，返回新记忆 ID。记忆跨会话保留。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | `string`（最长 200 字符） | 是 | 简短标题 |
| `content` | `string` | 是 | Markdown 正文 |
| `category` | `"decision" \| "preference" \| "fact" \| "lesson" \| "note"` | 否 | 分类，默认 `"note"` |
| `scope` | `"workspace" \| "role"` | 否 | 作用域，默认 `"role"` |
| `tags` | `string[]` | 否 | 标签 |
| `relevance` | `"high" \| "medium" \| "low"` | 否 | 相关性，默认 `"medium"` |

```json
{
  "title": "数据库连接串",
  "content": "生产库在 db.internal:5432，用户 app，走连接池。",
  "category": "fact",
  "scope": "workspace",
  "tags": ["database"],
  "relevance": "high"
}
```

```text
应看到：
Memory written. ID: a3f91c2d
```

### memory_recall

按全文查询检索记忆，返回排序后的条目（ID、标题、分类、相关性、内容摘要）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 全文检索词 |
| `format` | `"markdown" \| "json"` | 否 | 输出格式，默认 markdown |
| `scope` | `"workspace" \| "role" \| "both"` | 否 | 搜索范围，默认 `"both"` |
| `category` | `string` | 否 | 按分类过滤 |
| `limit` | `number`（1–50） | 否 | 最大结果数，默认 10 |

```json
{ "query": "数据库 连接", "scope": "both", "limit": 5 }
```

FTS5 默认分词器对中文分词能力有限：中文查询建议用更短的词，或中英混合关键词；拿不准时先用 `memory_list` 浏览标题再定位。

### memory_list

浏览记忆摘要，返回按时间、相关性或访问时间排序的扁平列表。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | `"workspace" \| "role" \| "both"` | 否 | 范围，默认 `"both"` |
| `category` | `string` | 否 | 按分类过滤 |
| `limit` | `number`（1–100） | 否 | 最大结果数，默认 20 |
| `sort` | `"recent" \| "relevance" \| "accessed"` | 否 | 排序方式，默认 `"recent"` |

```json
{ "scope": "role", "sort": "relevance", "limit": 10 }
```

### memory_update

更新已有记忆条目。**只更新传入的字段**，其余保持不变（部分合并语义）；记忆 ID 不变，因此系统提示里 `<available_memory>` 的引用继续有效。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | 是 | 要更新的记忆 ID |
| `title` | `string` | 否 | 新标题 |
| `content` | `string` | 否 | 新正文 |
| `category` | `"decision" \| "preference" \| "fact" \| "lesson" \| "note"` | 否 | 新分类 |
| `tags` | `string[]` | 否 | 新标签（整体替换，不是追加） |
| `relevance` | `"high" \| "medium" \| "low"` | 否 | 新相关性 |

```json
{ "id": "a3f91c2d", "relevance": "high", "tags": ["database", "prod"] }
```

记忆 ID 不存在时返回 `Memory ID <id> not found — nothing updated`。**dsh 上没有这个工具**，需要修改时只能重新 `memory_write` 一条。

### 配套用法：写入 → 检索 → 更新

```text
memory_write(title="缓存策略", content="选用 LRU，容量 512MB", category="decision", scope="workspace")
memory_recall(query="缓存策略", scope="both")     # 下次会话里可直接检索到
memory_update(id="a3f91c2d", relevance="high")  # 保留 ID，只改相关性
```

## 技能加载工具

### load_role_skill

按精确名称从已加载角色及其嵌套子代理中加载技能（子代理优先），返回完整的 `SKILL.md` 内容与解析后的引用元数据。**只有 Pi 提供**：OpenCode 与 dsh 使用自己的原生技能机制，不需要这个工具。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 要加载的技能精确名称 |

```json
{ "name": "review-checklist" }
```

名称不存在时错误信息会列出当前可用的全部技能名，直接从中挑一个重试即可。

## 常见错误

- **会话找不到**：ID 拼错，或会话属于别的项目目录。用 `session_list` 确认（表格输出完整 ID），必要时显式传 `project_path`。
- **搜不到消息**：`session_search` 是子串匹配，查询词必须真的出现在文本里；工具输出默认不参与搜索，需要时把 `include_tool_output` 设为 true。
- **记忆搜不到**：先确认 scope——用 `role` 写入的记忆在别的角色的 `workspace` 查询里看不到；中文检索再参考上面的分词提示。
- **`memory_update` 在 dsh 上不存在**：这是平台差异，不是配置错误，改用 `memory_write` 重新写入。
