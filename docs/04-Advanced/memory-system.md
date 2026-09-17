---
title: 记忆系统实现
description: rolebox 记忆子系统的内部实现 — 双机制、SQLite + FTS5 存储、注入链路、部分更新、清理与淘汰
---

# 记忆系统（Memory System）

记忆是 rolebox 唯一自带持久化的知识通道：代理在会话中写入的决策与教训落进工作区里的一个 SQLite 文件，并在之后的提示组装中被读成一段摘要。
本页讲这条链路的实现——存储结构、注入时机、更新语义、淘汰条件，以及哪些设计只停留在纸面上。

> **本页边界**：记忆的用法（`|memory|` 合并回顾、CLI 工作流）见[教程 07 让代理记住你](/02-Guide/tutorial/07-memory)；`memory_write` / `memory_recall` / `memory_list` / `memory_update` 四个工具的**参数与返回格式**见[会话与记忆工具](/03-Reference/tools/session-memory-tools)；逐命令说明见 [CLI 参考](/03-Reference/cli)；2026-07 的原始设计记录见[记忆策略（设计决策）](/04-Advanced/design-decisions/memory-strategy)。

## 两种记忆机制

记忆有两条写入入口，共用同一份存储：一条是代理在会话中主动调用工具（即时记忆），另一条是内置函数在回顾模式下批量整理（合并回顾）。

### 即时记忆（Instant Memory）

代理在任务执行期间调用 `memory_write` 落盘一条条目。工具本身很薄：打开工作区的 `MemoryStore`，把字段交给 `write()`，然后关闭连接。几个默认值决定了条目落在哪一层：

| 字段 | 默认值 | 实现效果 |
|------|--------|----------|
| `scope` | `role` | 只对该角色可见；`workspace` 才对所有角色可见 |
| `role_id` | `workspace` 作用域下为 `shared`，否则为 `context.agent ?? "unknown"` | 作用域过滤的实际比较值 |
| `category` | `note` | 供 `memory_recall` 按分类过滤 |
| `relevance` | `medium` | 参与注入的 `min_relevance` 门槛与 `clean` 的档位过滤 |
| `source_sessions` | `[]` | 见下文的实现落差 |

条目 ID 由 `shortHash(title + Date.now())` 生成，是 12 个十六进制字符；`created_at` 与 `updated_at` 写同一次时间戳，插入在事务中完成。

### 合并回顾（Consolidation）

合并回顾**不是一段代码**，而是一个内置函数文件：`functions/memory.md`。它声明 `params: { scope: all }`，正文是一份给代理的操作指令——先 `memory_list` 看已有记忆，再 `session_list` 列出会话，跳过已处理的会话，用 `session_read` 读取内容，写之前先用 `memory_recall` 查重，最后用 `memory_write` 或 `memory_update` 落盘。

激活语法走的是函数参数的通用解析：`|memory|` 用默认值 `all`；`|memory:full|` 按 frontmatter 的参数顺序把 `full` 传给 `scope`；`|memory scope=full|` 是等价的键值写法。四种取值的行为差别是：

| `scope` 取值 | 行为 |
|---------------|------|
| `all`（默认） | 增量：跳过 `source_sessions` 已记录的会话 |
| `full` | 全量重扫所有会话，先查重再合并 |
| `recent` | 只处理最近 5 个会话 |
| `session:<id>` | 只处理指定的那一个会话 |

**一处实现落差**：函数正文要求把新处理的会话 ID 追加进 `source_sessions`，但 `memory_update` 的参数面只有 `title` / `content` / `category` / `tags` / `relevance` 五个字段。在 v1.9.0 中 `source_sessions` 只在 `memory_write` 时被初始化为空数组，此后没有任何代码路径修改它，因此该列实际上恒为空——增量模式真正依赖的是代理每轮重新比对 `session_list` 与 `memory_list` 的结果。`rolebox memory show <id>` 会显示这一列，看到空值属于预期。

## 存储与索引

### 数据库与表

`MemoryStore.create(workspaceDir)` 先解析数据库路径 —— `.rolebox/memory.db`（`src/utils/state-paths.ts` 的 `memoryDbPath`）—— 建目录、开库、执行 `PRAGMA journal_mode = WAL` 与 `PRAGMA foreign_keys = ON`，最后跑一遍幂等的建表逻辑：`src/memory/schema.ts` 的 `ensureMemorySchema` 全部语句带 `IF NOT EXISTS`，可以反复执行。

`memories` 表的列：

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PRIMARY KEY | 12 位短哈希 |
| `scope` / `role_id` | TEXT | 作用域与归属角色 |
| `category` / `relevance` | TEXT | 分类；相关性默认 `medium` |
| `title` / `content` | TEXT | 标题与正文 |
| `tags` / `source_sessions` | TEXT | JSON 字符串，读出时解析回数组 |
| `created_at` / `updated_at` / `accessed_at` | TEXT | ISO 8601 时间 |
| `access_count` | INTEGER DEFAULT 0 | 访问计数，淘汰判据 |
| `session_id` | TEXT | 写入时的会话 |

辅助索引四个：`(scope, role_id)` 与 `category` 服务过滤，`accessed_at` 服务「按访问时间」排序，`relevance` 服务按相关性过滤。

### FTS5 全文索引

`memories_fts` 是一张 FTS5 外部内容表（external content table）：索引 `title` / `content` / `tags` 三列，`content='memories'` 与 `content_rowid='rowid'` 让它只存索引、不重复存正文。

三支触发器维持同步：`AFTER INSERT` 插入索引行，`AFTER DELETE` 用 FTS5 的 `'delete'` 指令删除索引行，`AFTER UPDATE` 先删旧行再插新行。因此 `MemoryStore.update()` 不需要自己维护 FTS，删除一条记忆时索引也随之消失。

查询逻辑在 `src/memory/search.ts`：把查询串里的双引号翻倍转义后交给 `MATCH`，用 `INNER JOIN memories_fts ON m.rowid = memories_fts.rowid` 取回正文，`ORDER BY rank` 排序（FTS5 的 `rank` 列就是 BM25 分数），`LIMIT` 收尾；`scope` 与 `category` 作为 SQL 级 `WHERE` 条件叠加在同一句上。

建表时没有指定分词器，所以使用 FTS5 的默认分词器 `unicode61`：英文按空格与标点切词，中文这类无分隔文本容易被当成整段 token。库层对此没有额外处理，规避方式是在查询侧把词缩短（2–6 字）或使用 `*` 前缀匹配。

### 双运行时驱动

`src/memory/db-driver.ts` 在运行时二选一：检测到 `globalThis.Bun` 就用 `bun:sqlite` 的 `Database`，否则用 `node:sqlite` 的 `DatabaseSync`（Node 22.5 起可用）。两个模块都通过动态 `import()` 载入，这样 Node 进程不会在模块求值阶段因为静态引用 `bun:sqlite` 而崩溃。

驱动对外只暴露记忆模块真正用到的五个方法：`exec` / `run` / `query` / `transaction` / `close`。Bun 侧直接转发内建 statement；Node 侧包一层 `prepare()`，`transaction` 由驱动自己写 `BEGIN` / `COMMIT` / `ROLLBACK`。

## 注入机制

注入发生在系统提示组装阶段，而不是写入时。链路是：

1. `system.transform` 进入 `src/hooks/system-transform.ts` 的 `handleSystemTransform`；无论当前有没有激活的函数，记忆这一段都会执行；
2. 从角色配置读 `memory` 块，缺省值为 `{ inject: true, max_inject: 10, min_relevance: "medium", scope: "both" }`，`inject: false` 直接跳过；
3. `MemoryStore.create(deps.dir)` 打开库，用 `store.list({ scope, limit: max_inject, minRelevance: min_relevance })` 取摘要——只查 `id` / `title` / `category` / `relevance` / `updated_at`，不读正文；
4. `buildMemoryBlock()`（`src/prompt/builder.ts`）把摘要渲染成 `<available_memory>` 块：块首固定一行说明「Memory entries from previous sessions. Use memory_recall to search for specific memories.」，每个条目是一个 `<memory>` 元素，含 id / title / category / relevance / updated。列表为空时返回空串，调用方不推入任何内容。

两个后果值得记进实现笔记：

- 摘要块是**组装时的快照**。它读的是数据库而不是内存缓存，所以新写入的条目在下次组装时可见；但组装时机由 harness 决定，会话中途不会热更新已经发出的提示。
- `store.list` 默认按 `updated_at DESC` 排序，`max_inject` 是硬截断——老条目会被挤出注入窗口，但它仍然可以被 `memory_recall` 搜到。

**平台差异**：这条链路并非在所有 harness 上都生效。

| 平台 | 注入路径 | 结果 |
|------|----------|------|
| opencode | `system.transform` 钩子（`src/hooks/system-transform.ts`） | 注入 `<available_memory>` |
| Pi | Pi 系统提示适配器复用同一条流水线（`src/platform/adapters/pi/system-transform.ts`） | 注入 `<available_memory>` |
| dsh | `system.transform` 是文档化的 no-op（`src/platform/adapters/dsh/hook-provider.ts`），会话级改走系统提示注册表（`src/platform/adapters/dsh/system-prompt.ts`） | **不注入**记忆块 |

dsh 的缺席是刻意的：注册表的 `text` provider 是同步的，而 `MemoryStore.create` 是异步的，在同步 provider 里做异步读会阻塞提示组装或与写入竞态。该适配器因此只注册 `rolebox:role`（角色提示）与 `rolebox:context`（可用函数块）；spawn 时的上下文提供者（`src/dsh-plugin.ts`）同样只生成函数块。要让 dsh 也拿到记忆，前提是出现一个同步的记忆来源，或者注册表提供异步 API。

同一个数据库还有第二个读取方：`context_assemble` 工具（`src/dispatch/query/context-assemble.ts`）按当前话题直接 `store.search()`，把命中条目的标题与正文前 200 字拼成 `### Memory Matches` 段。它与注入是两条不同的取数策略——注入按更新时间取摘要，它按话题相关性取片段。

## 更新与部分更新

`memory_update` 是部分合并（partial merge）：只写调用方真正给出的字段。执行顺序是：

1. 按 `id` 读出现有条目；读不到直接返回 `Memory ID <id> not found — nothing updated`；
2. 把 `title` / `content` / `category` / `tags` / `relevance` 中非 `undefined` 的字段收进一个更新对象；
3. 交给 `MemoryStore.update()`：拼动态 `SET` 列表、把 `tags` 序列化成 JSON、**无条件**把 `updated_at` 设为当前时间，全部在一个事务里；
4. 数据库的 `AFTER UPDATE` 触发器重建索引行。

两点实现层的事实值得与直觉核对：

- `MemoryStore.update()` 的字段映射其实还覆盖 `scope`、`role_id`、`session_id`、`source_sessions`，但 `memory_update` 只暴露五个字段——这条更宽的通道目前没有调用方。
- 「只更新 `updated_at`」有专门分支：当 `SET` 列表里只剩时间戳时走一条更短的语句，因此传一个空更新也不会报错。

**平台可用性**：共享装配层 `src/platform/tool-assembly.ts` 只注册 `memory_write` / `memory_recall` / `memory_list` 三个；`memory_update` 由平台在 extraTools 里额外补上——OpenCode 见 `src/core/services/tool-service.ts`，Pi 见 `src/pi-extension.ts`。dsh 没有这个工具，在 dsh 上修正一条记忆只能重新写入。

## 清理与淘汰机制

### 淘汰判据与执行

`rolebox memory clean`（`src/cli/commands/memory/memory-clean.ts`）先用一条 SQL 选出候选：

```sql
SELECT id, title, category, relevance, accessed_at FROM memories
WHERE access_count = 0 AND (accessed_at IS NULL OR accessed_at < ?)
```

`?` 是「今天减去 `--max-age-days` 天」（默认 180）的 ISO 时间。关键在于第一个条件：**一条记忆只要被 `memory_recall` 命中过一次，`access_count` 就不再为 0，它永远进不了候选集**。这正是 `touch()` 存在的意义——`memory_recall` 在返回结果之前对每条命中调用 `store.touch(id)`，把 `accessed_at` 刷成当前时间并让 `access_count` 加一。`memory_list` 与 `store.read()` 都不调用 `touch()`。

候选再按相关性档位过滤。`--min-relevance` 的语义是「**可被删除的最低档位**」，实现是 `relevanceLevels()` 取 `[high, medium, low]` 的前缀：

| `--min-relevance` | 可删除的档位 |
|--------------------|--------------|
| `high` | 只删 `high` |
| `medium` | 删 `high` + `medium` |
| `low`（默认） | 三级全删 |

不带 `--yes`（或 `-y`）时是干跑，只打印候选表；带 `--yes` 时在一个事务里逐条 `DELETE`，FTS 索引由 `AFTER DELETE` 触发器同步清理。

```bash
rolebox memory clean --max-age-days 90
```
```text
应看到（干跑，不删数据）：
Found 3 candidate(s) for cleanup (dry-run):
  (use --yes to perform deletion)

  ID           Title                          Relevance  Last accessed
  ──────────────────────────────────────────────────────────────────
  a1b2c3d4e5f6 旧的实验笔记                    low        2026-03-15
```

示例输出，行数与内容随环境变化。没有候选时输出 `No stale memory entries to clean.`；真删后的收尾行是 `Deleted N stale memory entries.`（N 为 1 时写作 `entry`）。

CLI 侧还会先定位工作区：`resolveProjectRoot()` 从当前目录向上最多 64 层寻找 `.rolebox` 目录，找不到就退回当前目录。所以 `rolebox memory clean` 作用的是**离你最近的那个 rolebox 工作区**，而不是某个全局记忆库。

### 容量管理：尚未落地的部分

设计记录中规划过「每个作用域默认上限 500 条 + LRU 自动淘汰 + `ROLEBOX_MEMORY_MAX_ENTRIES` 环境变量」。在 v1.9.0 的实现里这三项都不存在：源码中没有容量上限常量、没有读取该环境变量、`MemoryStore` 也没有任何写入时的容量检查。唯一减少条目数量的路径就是上面这条 `rolebox memory clean`；规划细节与理由见[记忆策略（设计决策）](/04-Advanced/design-decisions/memory-strategy)。

## 与 references 的分工

记忆（Memory）和引用文档（References）都会进入系统提示，但负责的知识类型不同：引用是随代码库版本走的静态文档，记忆是运行时产生、可被淘汰的动态记录。

| 维度 | Memory | References |
|------|--------|------------|
| 存储 | `.rolebox/memory.db`（SQLite 运行时数据） | `references/` 目录下的 Markdown |
| 写入者 | 代理运行时调用工具 | 开发者手写，随仓库提交 |
| 检索 | FTS5 全文搜索（BM25 排序） | 按声明注入，按文件路径引用 |
| 注入形态 | `<available_memory>` 摘要，正文按需召回 | `<available_references>` 的元数据条目 |
| 生命周期 | 可被 `memory clean` 淘汰 | 随版本迭代，除非删除文件 |

选择上可以按两条线判断：内容**动态变化、写操作频繁**（决策、教训、临时事实）放进记忆；内容**稳定、需要评审与版本追溯**（接口规范、架构约定）写进引用。两者可以互相迁移——一条被反复验证的记忆值得提升为引用文档，而引用文档里的关键结论也可以在合并回顾时落成一条记忆，让它在会话中被自动看到。

## 排错

### 记忆没有出现在注入块里

按可能性从高到低排查：`role.yaml` 的 `memory.inject` 是否为 `false`；条目的 `relevance` 是否低于 `min_relevance`（默认 `medium`，即 `low` 条目被跳过）；`scope` 是否与配置的注入作用域相符；条目是否被 `max_inject` 挤出窗口——该截断按 `updated_at DESC` 取前 N 条，写入较晚的记忆会挤掉较早的。另外 dsh 上不会注入，见前文的平台差异表。

### 搜索返回空结果

四条常见原因：中文分词限制（缩短查询词或改用前缀匹配）；查询串里的双引号被当成 FTS 语法的一部分（内部会转义成 `""`，但不是模糊匹配）；`scope` 过滤不匹配（角色私有记忆在 `scope="workspace"` 的查询下不会命中，用 `both` 覆盖）；拼写要求精确——FTS5 不做模糊匹配，除非显式写 `*`。

### 记忆过时

先用 `memory_recall` 取全文判断是否还有效，再决定修正还是重写。修正用 `memory_update`（OpenCode / Pi），它保持 `id` 不变，注入块里的条目因此不会断链；如果所在平台没有这个工具，只能 `memory_delete` 旧条目后重新 `memory_write`。

## 实现模块

下面这些模块构成记忆子系统；行号不作为文档的一部分，需要定位实现时在仓库中检索符号。

| 模块 | 职责 |
|------|------|
| `src/memory/store.ts` | `MemoryStore`：打开/关闭数据库、CRUD、`list` / `stats` / `touch` |
| `src/memory/schema.ts` | 表、FTS5 虚拟表、三支同步触发器与四个索引的定义 |
| `src/memory/search.ts` | FTS5 `MATCH` 查询、转义、`rank` 排序与作用域/分类过滤 |
| `src/memory/tools.ts` | `memory_write` / `memory_recall` / `memory_list` / `memory_update` 四个工具 |
| `src/memory/db-driver.ts` | Bun / Node 双运行时 SQLite 驱动 |
| `src/memory/types.ts` | `MemoryEntry` / `MemorySummary` / `MemoryConfig` 类型 |
| `src/utils/state-paths.ts` | `.rolebox/memory.db` 路径与 12 位短哈希 |
| `src/hooks/system-transform.ts` | 注入触发点：读配置、取摘要、推入系统提示 |
| `src/prompt/builder.ts` | `buildMemoryBlock`：`<available_memory>` 块的渲染 |
| `src/cli/commands/memory/memory-clean.ts` | `clean` 子命令的候选 SQL、档位过滤与干跑 |
| `functions/memory.md` | 合并回顾内置函数的指令正文 |

## 备注

> 自 v0.20.0 起，rolebox 提供工作区内的 SQLite 持久记忆与 `rolebox memory` 子命令；本页描述的实现在 v1.9.0 上核对。
