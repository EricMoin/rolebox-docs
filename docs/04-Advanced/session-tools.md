---
title: 会话工具
description: 10 工具会话管理套件 — 会话列表/读取/搜索/分析/导出/标签/续期/时间线与链接工具
---

# 会话工具

> **v0.17.0 引入** — 10 工具会话管理套件（4 个兼容 omo + 6 个独有），覆盖列表/读取/搜索/分析/导出/标签/续期/时间线/链接（CHANGELOG.md:198）


> **相关文档：** [记忆系统](/04-Advanced/memory-system) — 跨会话持久记忆 | [CLI 参考](/03-Reference/cli) — 命令行管理 | [调度配置](/03-Reference/dispatch-config) — 并发与预算

rolebox 提供了一套完整的会话管理工具套件，共 10 个工具，让代理能够列出、读取、搜索、分析、导出、标记和管理会话。其中 4 个工具与 oh-my-openagent (omo) 兼容，6 个工具为 rolebox 独有。

::: tip omo 兼容说明
4 个工具（`session_list`、`session_read`、`session_search`、`session_info`）与 oh-my-openagent 同名且接口兼容，但功能更强。如果同时使用 omo 和 rolebox，rolebox 的版本会自动覆盖 omo 的工具——这是一个安全的覆盖，因为 rolebox 版本向后兼容 omo 的输入格式。其余 6 个工具为 rolebox 独有，不会产生冲突。
:::

## 工具总览

| 工具 | 类型 | 功能描述 |
|------|------|----------|
| `session_list` | 兼容增强 | 列出所有会话，支持按日期范围、项目路径、代理名称筛选。显示 token 消耗、成本、模型信息 |
| `session_read` | 兼容增强 | 读取会话完整记录，支持消息类型筛选、分页、工具调用展开 |
| `session_search` | 兼容增强 | 跨会话全文搜索，支持上下文窗口显示匹配位置 |
| `session_info` | 兼容增强 | 查看会话详细元数据：token 分解、成本、工具频率、模型分布 |
| `session_analytics` | 🆕 独有 | 分析仪表盘 — token 趋势、工具调用分布、按日/周/模型/代理分组统计 |
| `session_export` | 🆕 独有 | 将会话导出为 Markdown 或 JSON 文件，支持离线查看与分享 |
| `session_tag` | 🆕 独有 | 为会话添加/移除标签，便于分类和检索 |
| `session_resume` | 🆕 独有 | 从已有会话恢复上下文，创建延续会话 |
| `session_timeline` | 🆕 独有 | 按时间线汇总会话活动，可视化工作模式 |
| `session_link` | 🆕 独有 | 关联调度任务与会话，桥接 dispatch 和 session 两个系统域 |

## 最常用工具使用示例

### `session_list` — 列出会话

```
session_list(limit=10, from_date="2026-07-01")
```

返回表格：

```
| Session ID | Title | Agent | Model | Msgs | Created | Updated | Tokens In | Tokens Out | Cost |
```

可选 `include_archived: true` 包含已归档会话，`include_message_count: true` 获取消息数量。

### `session_read` — 读取会话

```
session_read(session_id="abc123", message_type="assistant", limit=50)
```

支持四种消息类型筛选：`user`、`assistant`、`tool`、`all`。工具调用结果会自动展开（截断至 2000 字符）。

### `session_search` — 搜索会话

```
session_search(query="数据库迁移策略", case_sensitive=false)
```

跨会话全文搜索，返回匹配行及上下文（±2 条消息）。

### `session_info` — 会话详情

```
session_info(session_id="abc123", include_todos=true)
```

返回完整元数据：token 消耗分解、成本计算、文件变更列表、子会话表格、待办事项完成统计。

### `session_export` — 导出会话

```
session_export(session_id="abc123", format="markdown", output_path="exports/session.md")
```

支持 `markdown` 和 `json` 两种格式。提供 `output_path` 时写入文件（原子写入：先写 `.tmp` 再 `rename`），不提供时返回内联字符串。

### `session_resume` — 恢复会话

```
session_resume(session_id="abc123", agent="code-reviewer")
```

从源会话提取最后 3 条助手消息作为上下文，创建延续会话并返回新的会话 ID。

### `session_link` — 关联任务与会话

```
session_link(task_id="task-001", session_id="abc123")
```

持久化存储在 `.rolebox/state/session-links.json`。支持三种操作模式：添加链接、查询链接、列出全部链接。

## 标签系统

`session_tag` 工具使用 opencode 内建的会话 `metadata` 字段（键 `rolebox_tags`），无需额外持久化文件：

```
session_tag(session_id="abc123", tags=["重要", "待复习"])    # 添加标签
session_tag(session_id="abc123", list=true)                  # 查看标签
session_tag(session_id="abc123", remove=["待复习"])          # 移除标签
```

## 分析仪表盘

虽然 `session_analytics` 作为独立工具正在规划中，但当前可通过 `session_info`（别名 `session_inspect`）获取完整的分析仪表盘输出。该工具提供与 `session_analytics` 相同的 `collectSessionAnalytics` 数据源。

输出示例：

```
### Token Usage
  Input:     45,231
  Output:    12,847
  Reasoning: 3,210
  Cache read:   8,400
  Cache write:  2,100

Total Cost: $0.002345

### Models Used
  openai/gpt-4o: 12 messages
  openai/gpt-4o-mini: 3 messages

### Tool Usage
  session_list: 8 calls
  memory_write: 5 calls
  bash: 12 calls
  dispatch: 3 calls

### File Changes
  Files modified: 4
  Additions: 120
  Deletions: 45
```

`session_info` 的 `include_todos=true` 参数还会生成待办事项完成统计，帮助评估会话进度。

::: tip 使用场景
在长时间会话结束时查看 `session_info`，评估 token 消耗是否合理、哪些工具被高频调用、文件变更范围是否符合预期。
:::

## 调度时间线

按时间维度汇总调度任务活动的工具是 `task_chronology`（位于 dispatch 域，非 session 域）。`session_timeline` 工具正在规划中，当前推荐使用 `task_chronology`：

```
task_chronology(from_date="2026-07-01", to_date="2026-07-20", group_by="day")
```

输出示例：

```
## Task Chronology

Grouped by: day
Range: 2026-07-01 to 2026-07-20

| Bucket | Count | Pending | Running | Completed | Awaiting_approval | Error | Cancelled | Timeout |
|--------|-------|---------|---------|-----------|-------------------|-------|-----------|---------|
| 2026-07-15 | 5 | 0 | 0 | 4 | 1 | 0 | 0 | 0 |
| 2026-07-16 | 12 | 0 | 0 | 10 | 2 | 0 | 0 | 0 |
| 2026-07-17 | 8 | 0 | 1 | 6 | 0 | 1 | 0 | 0 |
```

支持三种分组方式：`hour`（按小时）、`day`（按天）、`agent`（按代理名称）。可用于分析工作节奏、检测异常堆积或评估不同代理的负载分布。

::: tip 为什么 task_chronology 在 dispatch 域而非 session 域？
会话活动（消息、token）属于 session 域；调度任务的生命周期（触发、完成、错误）属于 dispatch 域。`task_chronology` 追踪的是 dispatch 任务的时间线，而非消息时间线。
:::

## 会话分析 Recipes

以下是一组常用会话分析模式，帮助你在实际工作流中高效利用会话工具套件。

### 按日期查找会话

当需要回顾某一天或某一周的工作时，使用 `session_list` 的日期过滤参数：

```
session_list(from_date="2026-07-01", to_date="2026-07-10", limit=50)
```

返回该日期范围内的所有会话。结合 `session_info` 可以快速了解当天的工作量：

```
session_info(session_id="abc123")
```

也可以跨项目搜索：

```
session_list(from_date="2026-07-01", project_path="/path/to/other-project")
```

::: tip 日期范围技巧
- 查今天：`from_date="$(date +%F)"`
- 查本周一至今：`from_date="2026-07-13"`（手动填入周一日期）
- 指定精确时间：ISO 8601 格式如 `2026-07-15T09:00:00` 同样支持
:::

### 对比两个会话

当你需要比较两次不同实现尝试的结果时，使用 `session_diff` 工具对比会话之间的差异：

```
session_diff(session_id="abc123", other_session_id="def456")
```

输出会显示两次会话在文件变更、token 消耗、工具调用分布等方面的对比：

```
## Session Diff: abc123 vs def456

### File Changes
  abc123: 4 files modified (+120 / -45)
  def456: 7 files modified (+230 / -89)

### Token Usage
  abc123: Input 45,231 | Output 12,847
  def456: Input 78,902 | Output 23,456

### Tool Call Distribution
  abc123: bash(12) memory_write(5) dispatch(3)
  def456: bash(20) memory_write(8) session_search(4)
```

这在评估不同方案的工作量和效果时非常有用。若需查看具体消息内容的差异，可以配合 `session_read` 分别读取两个会话的完整记录手动比较。

### Fork 会话用于探索

当你有以下需求时，使用 `session_fork` 将会话分叉：

- 想在一个已完成会话的基础上尝试不同方向
- 需要保留原有会话的完整性作为基准线
- 对比两种不同策略的结果

```
session_fork(session_id="abc123")
```

分叉会创建一个新会话，继承原会话的历史消息（最后 N 条助手消息）作为上下文起点。新会话拥有独立的 ID，与原会话互不影响：

```
Forked session created.
  Source: abc123
  Forked: xyz789
```

之后可以在分叉会话中自由探索，而不影响原始会话的完整性。

### 完整的工作流示例

一个典型的问题诊断工作流：

```
# 1. 按日期定位相关会话
session_list(from_date="2026-07-13", to_date="2026-07-15")

# 2. 深入读取关键会话的详情
session_info(session_id="abc123", include_todos=true)
session_read(session_id="abc123", include_tool_results=true)

# 3. 搜索相关关键词确认问题范围
session_search(query="数据库连接超时")

# 4. Fork 一个隔离的调试会话
session_fork(session_id="abc123")

# 5. 在分叉会话中尝试修复，完成后导出
session_export(session_id="xyz789", format="markdown", output_path="exports/debug-session.md")

# 6. 与原始会话对比验证差异
session_diff(session_id="abc123", other_session_id="xyz789")
```

::: tip 使用 `session_resume` 还是 `session_fork`？
- 需要**延续**未完成的工作 → 使用 `session_resume`（创建子会话）
- 想要**复制上下文**用于探索性工作 → 使用 `session_fork`（创建独立副本）
- `session_resume` 保持父子关系（新会话以旧会话为父），`session_fork` 创建独立的平行副本
:::

## 常见问题排查

### 会话未找到

```
session_info(session_id="abc123")
# 返回: Session not found: abc123
```

可能原因：

- 会话 ID 拼写错误 — 用 `session_list` 确认有效的会话 ID
- 会话属于其他项目目录 — `session_list` 默认按当前项目过滤，指定 `project_path` 参数可跨项目搜索
- 会话已被清理或过期

### 导出路径权限被拒绝

```
session_export(session_id="abc123", format="markdown", output_path="/root/exports/session.md")
```

如果输出路径不可写，工具会静默回退到返回内联字符串。请在导出前确认目标目录存在且可写。建议使用项目内路径，如 `exports/session.md`。

### 标签未显示

标签存储在 opencode 内建的会话 `metadata` 字段（键 `rolebox_tags`），仅当前会话的代理可以读写。如果标签未出现：

- 确认使用 `list=true` 参数查询，而非仅依赖注入摘要
- 标签数据通过 `session_tag` 写入，不会自动传播到之前已结束的会话
- 重启会话后，新代理需要通过 `session_tag` 工具重新检索才可看到标签

### 时间线无数据

```
task_chronology()
# 返回: No tasks found.
```

`task_chronology` 追踪的是 dispatch 调度任务。如果当前项目尚未进行任何调度（未使用 `dispatch` 工具），则时间线为空。请先执行至少一次 dispatch 调用。

> **免责声明**
>
> 本文档基于内部实现策略文档整理。具体行为可能因版本变化而不同，以实际源码为准。实现策略原文参见[会话工具实现策略文档](/04-Advanced/design-decisions/session-tools-strategy)，仅供内部参考。

## 下一步

- [记忆系统](/04-Advanced/memory-system) — 跨会话持久记忆
- [CLI 使用](/03-Reference/cli) — 命令行工具完整参考
- [调度配置](/03-Reference/dispatch-config) — 并发与预算控制
