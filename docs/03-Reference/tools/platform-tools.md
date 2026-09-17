---
title: 平台工具
description: 平台工具分册：行哈希编辑、资产查询、网络与交互式终端工具的参数、返回与平台门控说明
---

# 平台工具（Platform Tools）

这一册覆盖不属于代码智能、会话记忆或编排的三类工具：直接改文件的**行哈希编辑**、检索角色资产与引用文档的**资产工具**、访问网络与驱动交互式终端的**环境工具**。它们大多属于三个 harness 共有的共享集合，个别工具的可用范围不同。

> 返回[工具目录](/03-Reference/tool-catalog)｜自 v0.17.0 起提供行哈希编辑，自 v0.22.0 起提供网络工具，自 v1.4.0 起提供交互式终端。

## 行哈希编辑工具

行哈希（hashline）编辑用**内容哈希锚点**代替行号定位：`hashline_read` 给每行标注 `LINE#HASH|content`，`hashline_edit` 用这些锚点提交编辑。文件在读取与写入之间被别人改动时，锚点依然能定位到正确的行；代价是每次编辑前都必须先读一次。原理与内部管线见[行哈希编辑系统](/04-Advanced/hashline-editing)。

### hashline_read

读取文件，返回整文件版本、哈希宽度、总行数与逐行标注。窗口读取（`offset` / `limit`）会额外返回 `startLine` / `endLine`，大文件应优先用窗口读取。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `filePath` | `string` | 是 | 文件路径；相对路径按会话工作目录解析 |
| `offset` | `number`（≥1） | 否 | 1-based 起始行，省略则从第一行开始 |
| `limit` | `number`（≥1） | 否 | 最大返回行数，省略则读到文件末尾 |

```json
{ "filePath": "docs/03-Reference/tool-catalog.md", "offset": 1, "limit": 40 }
```

```text
应看到：
version: 9f2c...   ← 整文件 SHA-256，编辑时必须原样回传
hashWidth: 2
totalLines: 398
1#aB|---
2#cD|title: 编排工具
```

### hashline_edit

用 `hashline_read` 给出的版本与锚点编辑一个或多个文件。所有编辑都针对**读取时的原始文件状态**，并自底向上应用；返回新版本、逐文件 diff 与新旧锚点映射。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `files` | `object[]` | 是 | 要编辑的文件列表，至少 1 个 |
| `files[].filePath` | `string` | 是 | 文件路径；相对路径按会话工作目录解析 |
| `files[].version` | `string` | 是 | 上一次 `hashline_read` 返回的 SHA-256 版本，用于检测外部修改 |
| `files[].hashWidth` | `number`（2–8） | 否 | 上一次读取返回的哈希宽度，给了就会与文件实际行数交叉校验 |
| `files[].edits` | `object[]` | 是 | 编辑操作列表，至少 1 条 |
| `edits[].op` | `"replace" \| "append" \| "prepend"` | 否 | 操作类型，默认 `replace` |
| `edits[].pos` | `string` | 视情况 | 目标行的锚点，如 `"10#aB"` |
| `edits[].end` | `string` | 视情况 | 范围替换的结束锚点（含），如 `"15#cD"`；单行替换时省略 |
| `edits[].lines` | `string \| string[]` | 视情况 | 替换或插入的内容，不要带锚点或 diff 标记 |

四种操作组合：

| 操作 | `pos` | `end` | `lines` | 行为 |
|---|---|---|---|---|
| `replace`（单行） | 必填 | 省略 | 可选 | 替换该行；省略 `lines` 即删除该行 |
| `replace`（范围） | 必填 | 必填 | 可选 | 替换 `[pos, end]` 范围；省略 `lines` 即删除整个范围 |
| `append` | 可选 | — | 必填 | 在 `pos` 之后插入；省略 `pos` 则追加到文件末尾 |
| `prepend` | 可选 | — | 必填 | 在 `pos` 之前插入；省略 `pos` 则插入到文件开头 |

```json
{
  "files": [
    {
      "filePath": "docs/03-Reference/tool-catalog.md",
      "version": "9f2c...",
      "edits": [
        { "op": "replace", "pos": "12#aB", "end": "14#cD", "lines": ["## 能力域与分册"] },
        { "op": "append", "lines": ["", "> 本节由 ST13 维护。"] }
      ]
    }
  ]
}
```

行为边界：同一文件的多次编辑在本进程内串行；写入前会再次校验版本，版本过期时整次调用被拒绝且不写盘；一批里的重复文件路径会被拒绝；批次不是跨文件事务，写入也不是 fsync 持久化。

## 资产工具

资产工具检索和校验角色加载到的技能、函数与引用文档。`asset_search` / `asset_inspect` / `asset_validate` / `reference_search` 四者在 OpenCode / Pi / dsh 都注册；`asset_hot_reload` 只在 OpenCode，`skill_compose` 在 OpenCode 与 Pi。

### asset_search

按关键词搜索资产（名称与描述，多个关键词取 AND），结果按相关度排序。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 搜索关键词 |
| `type` | `"skill" \| "function" \| "reference" \| "all"` | 否 | 资产类型过滤，默认 `all`（无效取值会被归一到 `all`） |
| `role_id` | `string` | 否 | 限定到某个角色 |
| `limit` | `number`（1–50） | 否 | 最大结果数，默认 20 |
| `format` | `"markdown" \| "json"` | 否 | 输出格式，默认 markdown |

```json
{ "query": "review", "type": "skill", "limit": 5 }
```

### asset_inspect

按精确名称和类型查看单个资产的完整内容。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 资产精确名称 |
| `type` | `"skill" \| "function" \| "reference"` | 是 | 资产类型 |

```json
{ "name": "review-checklist", "type": "skill" }
```

### asset_validate

校验全部已解析角色与子代理的资产完整性，检查三类问题：缺失依赖（函数 requires 的函数不存在）、断裂的引用路径（引用的文件不在磁盘上）、未知过渡条件（transition 里的条件名不在已注册的条件表中）。结果按严重度排序，错误在前。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `role_id` | `string` | 否 | 只校验该角色的资产；省略时校验全部角色及其子代理 |

```json
{ "role_id": "code-reviewer" }
```

```text
应看到（节选）：
## Asset Validation for role `code-reviewer`

**2 issue(s) found** — 1 error(s), 1 warning(s)

| Asset | Type | Severity | Issue |
|---|---|---|---|
| `security-scan` | function | 🔴 error | missing dependency: `plan` |
```

### asset_hot_reload

触发资产热重载。当前实现是**整表重新发现与重新解析**——无论传什么过滤条件都做全量重载，因此它没有参数。`ROLEBOX_HOT_RELOAD=false`（或 `0`）时该工具被禁用，调用会返回 disabled 说明而不是报错。

```json
{}
```

### skill_compose

分析一组技能的组合：找出匹配的技能、按文件路径去重它们引用的文档，并检测"两个技能以不同路径引用同名文档"这类路径冲突。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `skill_names` | `string[]` | 是 | 要组合分析的技能名，至少 1 个 |
| `check_conflicts` | `boolean` | 否 | 是否检查工具权限冲突，默认 true |

```json
{ "skill_names": ["review-checklist", "security-scan"], "check_conflicts": true }
```

### reference_search

在已解析角色加载的引用文档中做全文检索（匹配文件内容而非元数据），返回命中行及其上下文。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 检索词（子串匹配） |
| `case_sensitive` | `boolean` | 否 | 大小写敏感，默认 false |
| `limit` | `number`（1–50） | 否 | 最大命中数，默认 10 |
| `context_lines` | `number`（0–10） | 否 | 命中行前后各取多少行上下文，默认 2 |
| `role_id` | `string` | 否 | 限定到某个角色的引用 |
| `format` | `"markdown" \| "json"` | 否 | 输出格式，默认 markdown |

```json
{ "query": "命名规范", "context_lines": 3, "limit": 10 }
```

## 网络工具

3 个网络工具都在共享集合里，OpenCode / Pi / dsh 都注册，并带 SSRF 防护与多种渲染引擎。

### web_search

搜索网络信息，返回标题、URL、摘要与来源，无需 API Key。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string`（≤500 字符） | 是 | 搜索查询 |
| `source` | `"auto" \| "jina" \| "duckduckgo" \| "wikipedia" \| "npm" \| "hackernews"` | 否 | 搜索源；`auto` 按查询内容智能路由 |
| `max_results` | `number`（1–10） | 否 | 最大结果数，默认 5 |

```json
{ "query": "vitepress dead link check", "max_results": 3 }
```

### web_read

读取一个 URL 并转换成适合模型阅读的 Markdown，Jina Reader 是首选后端。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | `string` | 是 | 页面完整 URL |
| `selector` | `string` | 否 | CSS 选择器，只提取匹配区域（如 `.main-content`） |
| `engine` | `"default" \| "browser"` | 否 | 渲染引擎，默认 `default`（静态 HTML）；JS 重的单页应用用 `browser` |

```json
{ "url": "https://vitepress.dev/guide/routing", "selector": ".main-content" }
```

### web_fetch

通用 HTTP 客户端：抓取 URL 并转换成指定格式，可选渲染引擎、超时与体积上限。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | `string` | 是 | 完整 URL（http / https） |
| `format` | `"markdown" \| "text" \| "html" \| "json" \| "raw" \| "auto"` | 否 | 输出格式，默认 `auto`（按内容类型推断）；`raw` 对二进制返回 base64 |
| `engine` | `"default" \| "browser" \| "jina" \| "reader"` | 否 | 渲染引擎：静态抓取 / JS 渲染 / Jina Reader / Mozilla Readability 正文提取 |
| `selector` | `string` | 否 | CSS 选择器 |
| `timeout` | `number`（1–120） | 否 | 请求超时秒数，默认 30 |
| `max_size` | `number`（1KB–5MB） | 否 | 最大输出字节数，默认 51200 |
| `headers` | `Record<string, string>` | 否 | 自定义请求头 |
| `include_metadata` | `boolean` | 否 | 是否附带页面元数据，默认 false |

```json
{ "url": "https://api.github.com/repos/octocat/Hello-World", "format": "json", "timeout": 15 }
```

## 交互式终端

`interactive_terminal` 驱动一个**跨调用保活**的持久终端会话，面向 REPL、交互式提示与全屏 TUI；"一条命令换一个结果"的一次性执行不需要它。三个 harness 都注册。

### interactive_terminal

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `action` | `"open" \| "write" \| "read" \| "resize" \| "close" \| "list"` | 是 | 要执行的动作 |
| `id` | `string` | 视情况 | 会话 ID，由 `open` 返回；`write` / `read` / `resize` / `close` 必填。`open` 时也可以指定自定义 ID（会被清洗，冲突时加后缀） |
| `command` `args` `shell` `cwd` `env` | `string` / `string[]` / `boolean` / `string` / `Record<string,string>` | 否 | `open`：要运行的程序（默认 `$SHELL`）、参数、是否经系统 shell 执行、工作目录、额外环境变量 |
| `backend` | `"auto" \| "pty" \| "pipe"` | 否 | 后端偏好。`auto`（默认）优先真实 PTY（完整 TUI 支持），失败时回退管道；Bun 运行时下 node-pty 不可靠，用 `pipe` 强制行模式 |
| `cols` `rows` | `number` | 否 | 终端列数 / 行数（`open` / `resize`） |
| `idle_timeout_ms` | `number` | 否 | 空闲多久后自动杀掉会话（`open`） |
| `data` `keys` `append_newline` | `string` / `string[]` / `boolean` | 否 | `write`：要发送的文本（支持 `\uXXXX`、`\xXX` 与 `\r` `\n` `\t` `\e` 转义）；具名按键如 `["escape", "ctrl+c", "enter", "f5"]`（未知键名会被拒绝）；`data` 之后是否追加回车（默认 true，发原始按键时设为 false） |
| `mode` | `"auto" \| "stream" \| "screen"` | 否 | `read` 的视图。`screen` 返回当前渲染屏（仅 PTY），适合全屏 TUI |
| `wait_ms` `until` `timeout_ms` `from_start` `strip_ansi` | `number` / `string` / `number` / `boolean` / `boolean` | 否 | `read` 的阻塞与呈现控制：输出静默多久后返回、正则匹配后返回、总等待预算、返回全部保留缓冲而非仅新输出、是否剥离 ANSI 转义序列（默认 true） |
| `signal` | `string` | 否 | `close` 的终止信号（`SIGTERM` / `SIGINT` / `SIGKILL`）；超时后进程仍存活时升级为 `SIGKILL` |

```json
{ "action": "open", "command": "python3", "backend": "pty", "cols": 120, "rows": 40 }
```

```json
{ "action": "write", "id": "term_1", "data": "print(2**10)", "append_newline": true }
```

```text
应看到：
1024
```

## 平台门控

工具不是"装了 rolebox 就全都有"：每个 harness 在装配时决定注册哪些键。规则如下。

- **共享集合**：行哈希编辑 2 个、记忆读写 3 个（`memory_write` / `memory_recall` / `memory_list`）、网络 3 个、`signal`、`interactive_terminal`、资产与引用工具 4 个、会话工具 6 个——共 20 个，OpenCode / Pi / dsh 都注册。
- **OpenCode 追加**：`memory_update`、32 个 `lsp_*`、`function_graph`、`skill_compose`、`asset_hot_reload`、`context_assemble`、`task_*`（不含 `task_retry`），另有 8 个 `graph_*`，合计 70 个工具。
- **Pi 追加**：`memory_update`、32 个 `lsp_*`、`function_graph`、`skill_compose`、`load_role_skill`、`context_assemble`、`task_*`（不含 `task_retry`），另有 8 个 `graph_*`，合计 70 个。
- **dsh 追加**：8 个 `graph_*` 与 6 个 `loop_*`，合计 34 个；dsh 不注册 `task_*`、LSP、`function_graph`、`skill_compose`、`asset_hot_reload`、`context_assemble`、`load_role_skill` 与 `memory_update`。
- **覆盖与冲突**：平台可以用自己的实现覆盖同名工具；工具名在宿主注册表里是全局唯一的，重复注册会被拒绝，而不是静默替换。

选工具前先确认它在你的 harness 上存在——完整对照表见[工具目录](/03-Reference/tool-catalog)。

## 常见错误

- **`hashline_edit` 报版本过期**：读取之后文件被改过，重新 `hashline_read` 取最新 `version` 与锚点再提交；一批编辑里不要出现同一个文件两次。
- **`asset_hot_reload` 返回 disabled**：环境变量 `ROLEBOX_HOT_RELOAD` 被设为 `false` 或 `0`；这是刻意的开关，不是失败。
- **`web_read` 抓不到正文**：先换 `engine: "browser"`（JS 渲染）或加 `selector`；需要精确控制超时与体积时改用 `web_fetch`。
- **`interactive_terminal` 返回的是管道输出**：说明 PTY 不可用（常见于 Bun 运行时）。全屏 TUI 需要 `backend: "pty"`，退而求其次用 `mode: "stream"` 读行模式输出。
