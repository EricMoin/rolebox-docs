---
title: 记忆系统
description: 跨会话、跨角色的持久记忆系统 — 即时写入与合并回顾双机制、SQLite 存储、FTS5 全文搜索
---

# 记忆系统

> **v0.20.0 引入** — SQLite 持久化记忆系统，支持 FTS5 全文搜索、双层作用域与自动注入（CHANGELOG.md:140）


> **相关文档：** [记忆策略（设计决策）](/04-Advanced/design-decisions/memory-strategy) — 存储架构与淘汰策略 | [会话工具](/04-Advanced/session-tools) — 会话搜索与分析 | [CLI 参考](/03-Reference/cli) — `rolebox memory` 子命令

记住昨天、上周、上个月的决策与经验 — 代理不再遗忘。

rolebox 的记忆系统解决了 AI 代理在会话结束后丢失上下文的根本问题。通过两种互补机制，代理能够跨会话、跨角色持久保存知识。

## 两种记忆机制

### 1. 即时记忆 (Instant Memory)

工作中的角色主动调用 `memory_write` 工具，在任务执行期间即时记录：

- **决策**：为什么选择这种方案而非其他
- **偏好**：用户的风格、结构或工作流偏好
- **事实**：项目的依赖结构、模块职责、数据流
- **教训**：什么失败了、为什么、需要注意什么
- **笔记**：任意需要跨会话保留的信息

调用方式：

```
memory_write(title="Auth 使用 JWT+Refresh Token", content="认证系统选用...", category="decision", relevance="high")
```

### 2. 合并回顾 (Consolidation)

用户激活 `|memory|` 命令后，当前代理进入记忆合并模式，回顾项目会话并批量写入或更新记忆。支持多种模式：

```
|memory|                  # 增量模式：仅处理未回顾的会话
|memory:full|             # 完整模式：重新扫描所有会话
|memory:recent|           # 最近模式：仅最近 5 个会话
|memory:session:abc123|   # 指定会话
```

## 源码文件映射

`src/memory/` 目录各文件与本文档章节的对应关系：

| 源码文件 | 对应文档章节 | 核心职责 |
|---------|-------------|---------|
| `src/memory/store.ts` | [设计决策摘要](#设计决策摘要) / [全文搜索行为详解](#全文搜索行为详解) | MemoryStore 类：SQLite CRUD + FTS5 搜索 + LRU touch |
| `src/memory/search.ts` | [全文搜索行为详解](#全文搜索行为详解) | FTS5 查询逻辑与 BM25 排序 |
| `src/memory/tools.ts` | [工具参考](#工具参考) / [memory_update](#memory-update--部分更新) | 4 个工具创建函数（memory_write/recall/list/update） |
| `src/memory/schema.ts` | [清理与淘汰机制](#清理与淘汰机制) | SQLite 表结构与 FTS5 索引定义 |
| `src/memory/types.ts` | [设计决策摘要](#设计决策摘要) | MemoryEntry、MemorySummary、MemoryConfig 等类型 |
| `src/memory/inject.ts` | [注入机制](#注入机制) | buildMemoryBlock + 系统提示注入逻辑 |

> 实现策略的完整 898 行原文请参阅[记忆系统实现策略文档](/04-Advanced/design-decisions/memory-strategy)。

## 设计决策摘要

| 决策项 | 方案 |
|--------|------|
| 作用域 | 角色私有 + 工作区共享，两层隔离 |
| 存储引擎 | SQLite（WAL 模式），文件位置 `.rolebox/memory.db` |
| 全文搜索 | FTS5 + BM25 排序 |
| 工具可用性 | 内置于所有角色（`memory_write`、`memory_recall`、`memory_list`、`memory_update`） |
| 注入方式 | 会话开始自动注入 `<available_memory>` 摘要块（仅标题和元数据，不含全文） |
| 注入配置 | 可在 `role.yaml` 中控制注入开关、数量上限、最低相关性级别 |
| 容量管理 | 每作用域默认上限 500 条，支持按访问时间 LRU 淘汰 |
| 合并触发 | 手动 `\|memory\|` 激活，无自动触发 |

::: tip 记忆系统最佳实践
- **即时记录**：在做出架构决策或发现重要信息时立即调用 `memory_write`，不要等到合并没有灵感时再回忆
- **适度标记**：仅将真正关键的条目标记为 `relevance="high"`，避免高频条目冲淡注入质量
- **合理分类**：善用 `category` 字段（decision / preference / fact / lesson / note），便于后续 `memory_recall` 的精确过滤
- **定期合并**：每隔几个会话运行一次 `|memory|`，避免未回顾的会话堆积
:::

## 工具参考

rolebox 提供 4 个核心记忆工具，所有角色均可使用：

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| `memory_write` | 写入新记忆 | `title`, `content`, `category`, `scope`, `tags`, `relevance` |
| `memory_recall` | 全文搜索记忆 | `query`, `scope`, `category`, `limit` |
| `memory_list` | 浏览记忆摘要 | `scope`, `category`, `limit`, `sort` |
| `memory_update` | 更新已有记忆 | `id`, `title?`, `content?`, `category?`, `tags?` |

### 使用示例

写入一条架构决策：

```
memory_write(
  title="数据库选型：SQLite",
  content="在 memory 和 artifact 存储中统一使用 SQLite，原因是：1) Bun 内置 bun:sqlite，零额外依赖；2) FTS5 全文搜索优于 grep；3) WAL 模式支持并发读写。",
  category="decision",
  scope="workspace",
  relevance="high"
)
```

搜索相关记忆：

```
memory_recall(query="缓存策略", scope="both", limit=5)
```

## 全文搜索行为详解

rolebox 的 FTS5 全文搜索基于 SQLite 内置的 BM25 排序算法（src/memory/search.ts:44）：

- **排名算法**：BM25（Okapi BM25）—— 基于词频和逆文档频率的经典信息检索模型，`ORDER BY rank` 返回相关性最高的结果
- **精确匹配 vs 子串匹配**：FTS5 默认使用 `unicode61` 分词器，对英文按空格和标点分词、按词匹配；对中文等无分隔符语言，整段文本可能被视作单一 token，导致子串匹配不准确
- **中文搜索建议**：查询较短的关键词片段（2-6 字），FTS5 的 `MATCH` 语法支持前缀匹配（`"缓存*"`）和短语匹配（`"JWT 认证"`）
- **查询转义**：查询中的双引号字符会被自动转义（`"` → `""`），防止 FTS 语法错误
- **scope/category 过滤**：FTS 结果通过 `INNER JOIN` 与主表关联，支持 `scope` 和 `category` 的 SQL 级 WHERE 过滤

```sql
-- 等效 SQL（简化）
SELECT m.* FROM memories m
INNER JOIN memories_fts ON m.rowid = memories_fts.rowid
WHERE memories_fts MATCH ?
ORDER BY rank
LIMIT ?
```

::: warning 中文搜索注意事项
FTS5 默认 `unicode61` 分词器对中文分词效果有限。如果中文搜索未返回预期结果，建议：(1) 使用更短的查询词；(2) 尝试英文关键词+中文混合查询；(3) 用 `memory_list` 先浏览可用记忆标题，再针对搜索。
:::

## 注入机制

会话启动时，rolebox 自动注入 `<available_memory>` XML 块到系统提示词中。注入内容仅包含摘要（ID、标题、分类、相关性、更新时间），不含完整正文，以最小化 token 消耗。

注入行为可在 `role.yaml` 中配置：

```yaml
memory:
  inject: true           # 是否注入（默认 true）
  max_inject: 10         # 最多注入条数（默认 10）
  min_relevance: medium  # 最低相关性级别（默认 medium）
  scope: both            # 注入作用域：role | workspace | both
```

代理在需要完整内容时通过 `memory_recall` 工具获取 — 按需加载，节省 token。

## memory_update — 部分更新

`memory_update` 遵循部分合并（partial merge）语义——仅更新调用方提供的字段，其余字段保持不变（src/memory/tools.ts:178-184）：

```javascript
// 只更新标题和相关性，内容和分类保持不变
memory_update(
  id="auth-jwt-decision",
  title="Auth 使用 JWT + Refresh Token（已升级至 RS256）",
  relevance="high"
)

// 追加标签（需先通过 memory_recall 获取现有标签再合并）
memory_update(
  id="auth-jwt-decision",
  tags=["auth", "jwt", "rs256", "security"]
)
```

实现逻辑：
1. 通过 `id` 读取现有记录（`store.read()`），不存在则返回提示
2. 仅将 `title`、`content`、`category`、`tags`、`relevance` 中非 `undefined` 的字段写入更新
3. 自动将 `updated_at` 设置为当前时间
4. 数据库级 `AFTER UPDATE` 触发器同步更新 FTS5 索引

::: tip 何时使用 memory_update
当一条现有记忆需要完善（补充细节）、修正（纠正错误信息）或升级（提高相关性级别）时，优先使用 `memory_update` 而非重新写入。这保持了 ID 不变，使 `<available_memory>` 注入的链接保持有效。
:::

## CLI 命令

```bash
rolebox memory list [--scope workspace|role|both] [--category <cat>] [--limit N]
rolebox memory show <id>
rolebox memory search <query> [--scope ...] [--limit N]
rolebox memory delete <id>
rolebox memory export [--format markdown|json] [--output <path>]
rolebox memory clean [--max-age-days N] [--min-relevance low]
rolebox memory stats
```

> 各个子命令的详细说明请参见 [CLI 参考 → memory](/03-Reference/cli#memory-subcommand)。

## 清理与淘汰机制

`rolebox memory clean` 命令通过 SQL 查询识别可淘汰的记忆（src/cli/commands/memory/memory-clean.ts:62-74）：

- **淘汰条件**：`access_count = 0` 且（`accessed_at IS NULL` 或最后访问时间早于 N 天前）
- **相关性过滤**：`--min-relevance` 控制最低保留级别，`high` 仅删 `high`、`medium` 删 `high`+`medium`、`low` 删全部三级
- **默认值**：`--max-age-days 180`（半年无访问）、`--min-relevance low`（仅删除低相关性条目）
- **干跑模式**：默认只输出预览列表，加 `--yes`（或 `-y`）才真正执行删除

### 记忆清理工作流

```bash
# 1. 查看内存统计
rolebox memory stats
# 输出示例：
# Total: 47 entries
# By scope: workspace: 32, role: 15
# By category: decision: 8, fact: 20, lesson: 5, note: 14
# By relevance: high: 12, medium: 25, low: 10

# 2. 干跑模式——查看哪些记忆将被清理
rolebox memory clean --max-age-days 90
# Found 3 candidate(s) for cleanup (dry-run):
#   (use --yes to perform deletion)
#
#   ID           Title                          Relevance  Last accessed
#   ──────────────────────────────────────────────────────────────────
#   a1b2c3d4e5f6 旧的实验笔记                    low        2026-03-15
#   f6e5d4c3b2a1 废弃的 API 设计草稿             low        2026-04-01

# 3. 执行清理
rolebox memory clean --max-age-days 90 --min-relevance low --yes
# Deleted 3 stale memory entries.

# 4. 验证结果
rolebox memory stats
# Total: 44 entries (少了 3 条)
```

内存的按作用域容量上限（默认 500 条/作用域）属于策略层设计，当前通过 CLI 手动清理实现。自动 LRU 淘汰和 `ROLEBOX_MEMORY_MAX_ENTRIES` 环境变量支持详见[实现策略文档](/04-Advanced/design-decisions/memory-strategy)。

## 记忆 CLI Cookbook

以下是常见的记忆管理工作流，覆盖从日常记录到定期维护的完整周期。

### 1. 日常记录 — 快速写入

在开发过程中遇到关键决策或发现时，立即记录：

```bash
memory_write(
  title="模块拆分：将支付模块拆为 4 个子模块",
  content="拆分方案：PaymentProcessor（核心）+ FraudDetection（风控）+ RefundManager（退款）+ SubscriptionManager（订阅）。依据：单一职责，便于独立测试。",
  category="decision",
  scope="workspace",
  relevance="high",
)
```

### 2. 批量回顾 — 会话合并

完成一个阶段的开发后，运行合并回顾将多场会话中的经验提炼为结构化记忆：

```
|memory|            # 增量模式：仅处理未回顾的会话
|memory:full|       # 完整重扫：去重 + 合并
|memory:recent|     # 最近 5 个会话
```

合并回顾会自动检查已有记忆的 `source_sessions`，跳过已处理过的会话。

### 3. 搜索 → 导出 → 清理 循环

这是最常见的维护工作流，建议在项目里程碑前后执行：

```bash
# 第一步：搜索——找到需要复用的记忆
rolebox memory search "缓存策略"
rolebox memory search "架构决策" --scope workspace --limit 20

# 第二步：导出——备份或分享给团队
rolebox memory export --format markdown --output docs/adrs/memory-backup.md
rolebox memory export --format json --output exports/memories.json

# 第三步：统计——了解记忆库的整体状况
rolebox memory stats

# 第四步：清理——干跑预览后再执行
rolebox memory clean --max-age-days 60 --min-relevance low
rolebox memory clean --max-age-days 60 --yes

# 第五步：验证——确认清理结果
rolebox memory stats
```

### 4. 跨角色知识共享

当不同角色需要共享知识时，写入 `scope="workspace"` 的记忆会被所有角色在会话启动时注入：

```bash
memory_write(
  title="项目测试策略：单元测试覆盖率目标 80%",
  content="关键模块（支付、用户认证）需 ≥ 90%；工具类允许 60%。使用 vitest + playwright。",
  category="fact",
  scope="workspace",
  relevance="high",
)
```

角色私有记忆（`scope="role"`）仅对该角色可见，适合存储角色专用的偏好或内部约定。

### 5. 标签分类体系

为记忆添加一致的标签可以大幅提升检索效率。建议的标签分类：

| 标签类别 | 示例标签 |
|---------|---------|
| 模块 | `auth`, `payment`, `notification` |
| 技术栈 | `sqlite`, `react`, `bun` |
| 关注点 | `security`, `performance`, `testing` |
| 阶段 | `design`, `migration`, `bugfix` |

```bash
memory_write(
  title="API 鉴权方案",
  content="JWT + Refresh Token，access_token 有效期 15 分钟...",
  category="decision",
  tags=["auth", "jwt", "security", "design"],
  relevance="high",
)
```

## 何时使用 Memory vs References

记忆系统 (Memory) 和参考文档 (References) 是 rolebox 两种互补的知识管理机制，各有适用场景：

| 维度 | Memory（记忆） | References（参考） |
|------|---------------|-------------------|
| **存储位置** | `.rolebox/memory.db`（SQLite 运行时数据） | `references/` 目录（Markdown 源码） |
| **持久性** | 运行时持久化，可被清理/淘汰 | Git 版本控制，永久保留 |
| **写入方式** | 代理在运行时通过 `memory_write` 工具写入 | 开发者手动编写 Markdown |
| **搜索方式** | FTS5 全文搜索（BM25 排名） | 按文件路径/名称引用 |
| **注入方式** | 自动注入摘要 `<available_memory>`，按需加载全文 | 按参考声明注入 `<available_references>` |
| **适用范围** | 动态知识：决策记录、教训、偏好、临时事实 | 静态知识：API 文档、架构规范、团队约定 |
| **生命周期** | 会话级 → 项目级，可按访问频率淘汰 | 随代码库版本迭代 |
| **典型用例** | "为什么当时选了方案 A？""这个 bug 以前遇到过吗？" | "这个 API 的签名是什么？""项目的编码规范是什么？" |
| **内容审查** | 自动写入，可能有噪声 | 人工编写，质量可控 |

### 选择指南

- **写操作频繁、内容动态变化** → Memory（决策、配置选择、临时发现）
- **内容稳定、需要多人审阅** → References（API 设计规范、架构决策记录、团队约定）
- **跨会话知识复用** → Memory（代理会在后续会话中自动看到摘要）
- **跨角色共享** → 均可：Memory 用 `scope="workspace"`，References 放入公共 `references/`
- **需要 Git 历史追踪** → References（运行时数据不应进入版本控制）

两者可以配合使用：当一条记忆经过验证、确认具有长期价值后，可以从 Memory 迁移为正式的 References 文档。反之，References 中的关键知识点也可以通过 `|memory|` 合并回顾写入 Memory，提高代理在会话中的检索效率。

## 常见问题排查

### 记忆未出现在 `<available_memory>` 中

- 确认 `role.yaml` 中 `memory.inject` 未被设为 `false`（默认为 `true`）
- 新写入的记忆只在下一次会话启动时才会被注入——当前会话不会动态更新摘要块
- 如果某条记忆的相关性为 `low` 且 `min_relevance` 设为 `medium`，该条会被跳过

### 搜索返回空结果

```
memory_recall(query="缓存策略", scope="both", limit=5)
# 返回: No memories found matching "缓存策略".
```

可能原因：

- **中文分词限制**：FTS5 默认 `unicode61` 分词器对中文支持有限，尝试拆分为更短的查询词
- **拼写不匹配**：FTS5 不支持模糊匹配或通配符前缀（除非显式指定 `*`），精确拼写必填
- **作用域过滤**：如果记忆是 `scope="role"` 而当前查询 `scope="workspace"`，则不会命中。使用 `scope="both"` 覆盖全部作用域

### 记忆过时

如果 `rolebox memory list` 中某条记忆的 `updated_at` 明显过时（如数月前的决策），建议：

1. 用 `memory_recall` 获取完整内容评估相关性
2. 用 `memory_update` 补充最新信息并更新 `relevance`
3. 或用 `memory_write` 写入新版并删除旧版

::: tip 深入阅读
完整的记忆系统设计决策、存储架构、淘汰策略、环境变量和实现计划请参见[记忆系统实现策略文档](/04-Advanced/design-decisions/memory-strategy)。本文档为浓缩版用户指南，不重复 800+ 行的策略原文。
:::

> **免责声明**
>
> 本文档基于内部实现策略文档整理。具体行为可能因版本变化而不同，以实际源码为准。实现策略原文参见[记忆系统实现策略文档](/04-Advanced/design-decisions/memory-strategy)，仅供内部参考。

## 下一步

- [会话工具](/04-Advanced/session-tools) — 10 工具会话管理套件
- [CLI 使用](/03-Reference/cli) — 命令行工具完整参考
