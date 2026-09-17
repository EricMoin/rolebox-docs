---
title: 会话工具实现
description: rolebox 六个会话内省工具的内部实现 — ISessionClient 端口、类型模型、ID 语义、与持久化的关系
---

# 会话工具（Session Tools）

六个会话工具让代理读取 harness 里的历史会话：列出、读取、搜索、取详情、看文件变更、分叉。
本页讲它们的实现——端口抽象、类型模型、ID 语义、与持久化的边界，以及每个工具在内部做了什么。

> **本页边界**：六个工具的**参数与返回格式**见[会话与记忆工具](/03-Reference/tools/session-memory-tools)；用它们做记忆合并的完整流程见[记忆系统](/04-Advanced/memory-system)与[教程 07 让代理记住你](/02-Guide/tutorial/07-memory)；调度任务的按时间桶查询属于 dispatch 域，见[编排工具](/03-Reference/tools/orchestration-tools)。

## 子系统结构

会话工具是**只读适配层**：角色不拥有会话存储，只通过一个端口读取 harness 持有的会话日志。

端口是 `ISessionClient`（`src/platform/ports/session-client.ts`），它把平台差异收敛成一组方法：`list` / `get` / `messages` / `children` / `todo` / `diff` / `fork` / `status` / `prompt` / `promptSync` / `create` / `abort`，加上可选的 `compact`。端口自己不做任何 I/O，也不允许 import 具体平台的 SDK。

三个 harness 各自提供实现：`src/platform/adapters/opencode/session.ts`、`src/platform/adapters/pi/session.ts`、`src/platform/adapters/dsh/session.ts`。`src/session/client.ts` 保留了一个向后兼容别名，把旧的 `SessionClientWrapper` 指到 OpenCode 适配器上；新代码应当直接用端口类型。

注册发生在共享装配层：`src/platform/tool-assembly.ts` 的 `buildCanonicalTools()` 只有在调用方传入 `sessionClient` 时才注册这六个工具，否则整个会话工具面不存在。三个平台都会传入自己的适配器，因此在 v1.9.0 上会话工具对三者都可用。

```text
6 个工具 → src/session/session-browse-tools.ts   session_list / session_search
         → src/session/session-inspect-tools.ts  session_read / session_info / session_diff / session_fork
         → src/session/tools.ts                  统一再导出
```

## 类型模型

工具之间传递的是 `src/session/types.ts` 里的结构，而不是各平台的原生对象：

| 类型 | 关键字段 | 用途 |
|------|----------|------|
| `SessionInfo` | `id` / `projectID` / `directory` / `parentID?` / `title` / `version` / `time{created,updated,compacting?}` / `summary?` | 会话元数据；`summary.diffs` 存在时附带文件变更概览 |
| `Message` | `info: MessageInfo` + `parts: Part[]` | 一条消息与其所有片段 |
| `Part` | `text` / `reasoning` / `tool` / `step-finish` 四种，其余按通用片段保留 | 渲染与搜索的输入 |
| `ToolPart.state` | `pending` / `running` / `completed` / `error` 四态 | 工具调用在会话中的落点 |
| `FileDiff` | `file` / `before` / `after` / `additions` / `deletions` | `session_diff` 与统计的输入 |
| `SessionStats` | token 分项、成本、工具频次、模型分布、增删行数 | `session_info` 的聚合结果 |
| `SearchMatch` | 会话、消息、角色、命中文本与前后文 | `session_search` 的结果单元 |
| `SessionStatus` | `idle` / `retry{attempt,message,next}` / `busy` | `session_info` 的 `Status` 行 |
| `Todo` | `content` / `status` / `priority` / `id` | 待办进度（不在会话日志里，单独查询） |

`MessageInfo.role` 的类型是 `"user" | "assistant" | (string & {})`：适配器特有的角色（例如 Pi 的 `toolResult`）被原样保留，避免工具输出被误判成助手正文。

## ID 语义

会话 ID 由 harness 生成，rolebox 全程透传，不铸造也不改写：

- `session_list` 输出的 ID 就是后续 `session_read` / `session_info` / `session_diff` / `session_fork` 要回填的值；
- `parentID` 表达父子关系（分叉与子会话）；`session_fork` 成功后返回一个全新的 ID，新旧会话此后独立演进；
- `message_id` 是会话**内部**的消息标识，只被 `session_diff`（取该消息之前的差异）与 `session_fork`（在该消息处分叉）使用。

历史上有一个坑：`shortId()`（`src/session/tool-helpers.ts`）会把超过 12 字符的 ID 截成 `xxxxxxxxxxxx...`，它曾被用在会话表格的 ID 列上，导致表格里的 ID 无法回填。v1.8.0 起会话列表与搜索结果表改为输出完整 ID。

`shortId()` 目前只剩两处展示性用途：`session_read` 遇到没有消息的会话时提示里的 ID，以及 `session_fork` 成功块里「在哪个消息处分叉」那一行的消息引用。两者都不承担回填职责。

## 六个工具的实现要点

### session_list

先按 `project_path`（缺省取工具上下文的 `directory`）调用 `client.list()`，再用 `from_date` / `to_date` 按 `time.created` 过滤——日期解析失败（`NaN`）时该过滤器被静默忽略，不报错。之后按 `time.updated` 倒序、按 `limit` 截断，最后对每个入选会话再调一次 `client.messages()` 数消息条数，交给 `formatSessionListTable` 渲染。

这里有一个值得注意的成本特征：**消息数是逐会话读取后统计的**，所以列出 20 个会话会产生一次列表查询加 20 次消息查询。

表格的固定表头是：

```text
| Session ID | Title | Messages | Date Range | Duration |
```

行内容随环境变化。列表为空时返回 `No sessions found.`。

### session_search

搜索是**纯子串匹配**，不是模糊检索：默认大小写不敏感，逐条消息比对。参与匹配的文本默认只有非 `ignored` 的 text 片段；打开 `include_tool_output` 后，状态为 `completed` 的工具输出也进入匹配（`error` / `pending` 状态的输出不参与）。

命中的片段用 80 字符窗口取前后文（各截到窗口一半再加省略号）。搜索范围有硬上限：跨会话搜索最多扫描 200 个会话，命中数达到 `limit` 就提前停止。若因为上限而被截断，结果末尾会追加一行 `(searched first 200 sessions only)`；若在截断范围内一条都没命中，则直接返回「前 200 个会话中没有匹配」的提示，而不是空结果。

markdown 输出最多展示 20 条命中，多出的部分折叠成一行计数提示；`format: "json"` 则返回完整的匹配数组。

### session_read

`client.get()` 先确认会话存在，不存在返回 `Session not found: <id>`；没有消息时返回 `Session "<title>" (<shortId>) has no messages.`。之后拉取消息并按 `offset` 切片，拼接一段头部（标题、完整 ID、创建/更新时间、时长），再交给 `formatMessages`。

过滤发生在**渲染阶段**而不是取数阶段：`role_filter` 与 `tool_filter` 在遍历消息时跳过不匹配的项。每条 text 片段截断到 500 字符；reasoning 片段只在打开 `include_thinking` 时输出；工具输出只在打开 `include_tool_results` 时附在工具行之后。消息编号用 `offset + 序号` 还原成会话内的绝对序号，所以分页读取时编号是连续的。`include_todos` 打开时在末尾追加一节待办清单。

### session_info

一次 `collectSessionAnalytics()`（`src/session/tool-helpers.ts`）走完所有数据：拉消息、子会话、待办、文件差异与会话状态，遍历消息累加助手消息的 token 与成本（input / output / reasoning / cache read / cache write）并按 `provider/model` 计数，同时统计所有消息里 `tool` 片段的调用频次，最后把文件差异的增删行数累加。

渲染顺序固定：会话元数据（存在父会话时输出 `Parent Session`，存在 `summary.diffs` 时输出 `Summary`）、`Messages` / `Children` / `Status` 三行、`### Token Usage`、总成本、`### Models Used`（按模型名排序）、`### Tool Usage`（按调用次数降序）、`### File Changes`（有差异时才输出）、`### Todo Progress`（有待办时才输出）。

### session_diff

只调一次 `client.diff(session_id, { messageID })`，把结果交给 `formatDiff`：先输出 `Files changed` / `Additions` / `Deletions` 三行汇总，再对每个文件输出 `--- a/<path>` 与 `+++ b/<path>`，随后是本文件的差异体。

**实现细节**：差异体不是 LCS 或 Myers 对齐，而是**按行号位置**逐行比较 `before` 与 `after`——第 i 行不同就输出一行 `-` 与一行 `+`，相同则输出一行前导空格的上下文行。因此插入或删除整行时，后续所有行都会被报告为「删除 + 新增」。它给出的是可读的变更对照，不是可 `patch` 应用的标准 diff。

无变更时返回 `No file changes in this session.`。要比较两个会话，需要分别取差异后自行对照——这个工具的参数里没有第二个会话 ID。

### session_fork

先 `client.get()` 证明会话存在，再 `client.fork(session_id, { messageID })`。省略 `message_id` 时在最新消息处分叉。失败被明确分成两种文案：给了 `message_id` 时说明会话存在、分叉被拒可能源于无效的消息 ID；没给时只说分叉被拒，不提消息 ID，也不再声称会话「可能不存在」——这是 v1.8.0 修正的措辞。

成功时返回 `## Session Forked Successfully` 块，列出原会话与新会话的**完整** ID、新会话创建时间、分叉点，并提示新会话只是分叉点之前的副本。

## 与持久化的关系

会话日志的所有权在 harness，不在 rolebox：

- 六个工具读到的每一个字节都经过 `ISessionClient`，rolebox 侧没有会话数据库，也不写 harness 的会话日志；
- `session_fork` 是唯一会**创建**状态的操作，而创建的仍是 harness 的会话，rolebox 只是转发；
- rolebox 自己的持久化只落在工作区目录：记忆库是 `.rolebox/memory.db`，函数运行时与信号台账等状态在 `.rolebox/state/` 下按工作区哈希命名。

这条边界解释了一个常见困惑：会话工具的可见范围就是当前 harness 与当前工作区。换一个工作区目录、换一个 harness，看到的是另一批会话。

## 典型工作流

### 定位并检查一个会话

```text
session_list(from_date="2026-07-01", to_date="2026-07-15", limit=50)
session_info(session_id="ses_abc123")
session_read(session_id="ses_abc123", include_tool_results=true, limit=50)
```

先按日期收敛候选，用详情页判断这条会话值不值得细读（token、成本、工具分布、文件变更），再带工具输出读取正文。要读很长会话时用 `limit` + `offset` 分段，编号会保持连续。

### 搜索、分叉、对照

```text
session_search(query="数据库连接超时", limit=10)
session_fork(session_id="ses_abc123", message_id="msg_456")
session_diff(session_id="ses_abc123")
```

搜索给出命中所在的会话与消息；分叉在感兴趣的分叉点复制出一条新会话；`session_diff` 用来看某一条会话内部改动了哪些文件。分叉之后两侧独立演进，各自的差异要分别查询。

## 排错

### 会话未找到

`Session not found: <id>` 只会来自 `session_read` / `session_info` / `session_fork` 的前置检查。三种常见原因：ID 拼写或复制不全（用 `session_list` 重新取完整 ID）；会话属于另一个项目目录——`session_list` 默认按当前目录过滤，指定 `project_path` 才能跨项目；会话已被清理或过期。

### 搜索无结果

`session_search` 是子串匹配：查询词必须真的出现在消息文本里。默认不搜工具输出，打开 `include_tool_output` 才覆盖；跨会话搜索只扫前 200 个会话，命不中时先用 `session_id` 把范围收窄到单条会话再搜。

### 差异或统计为空

`session_diff` 返回 `No file changes in this session.` 说明这条会话没有文件变更，或 `message_id` 过滤掉了它们。`session_info` 的 token 与成本全为零，通常意味着适配器没有提供这层元数据，或该会话的助手消息没有附带 token 统计——这不影响消息数、工具频次与文件变更等其他分项。

## 实现模块

| 模块 | 职责 |
|------|------|
| `src/platform/ports/session-client.ts` | `ISessionClient` 端口定义 |
| `src/platform/adapters/opencode/session.ts` | OpenCode 适配器（旧名 `SessionClientWrapper`） |
| `src/platform/adapters/pi/session.ts` | Pi 适配器 |
| `src/platform/adapters/dsh/session.ts` | dsh 适配器 |
| `src/session/session-browse-tools.ts` | `session_list` 与 `session_search` |
| `src/session/session-inspect-tools.ts` | `session_read` / `session_info` / `session_diff` / `session_fork` |
| `src/session/tool-helpers.ts` | `shortId`、子串匹配、上下文窗口、会话统计汇总 |
| `src/session/formatters.ts` | 列表表格、消息渲染、统计块、差异块、搜索结果的格式化 |
| `src/session/types.ts` | 会话域的全部类型 |
| `src/session/tools.ts` | 六个工具工厂的统一再导出 |
| `src/platform/tool-assembly.ts` | 有 `sessionClient` 时注册六个工具 |

## 备注

> 自 v0.17.0 起，rolebox 提供六个会话内省工具；自 v1.8.0 起，会话列表与搜索表格输出完整 ID，不再截断为 12 字符。
