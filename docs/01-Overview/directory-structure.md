---
title: 目录结构
description: rolebox 项目的目录结构说明 — 角色目录、技能、函数、引用、子代理的组织方式
---

# 目录结构

> **相关文档：** [快速开始](/01-Overview/quick-start) — 5 分钟上手 rolebox | [创建角色](/02-Guide/create-a-role) — 完整的角色创建指南 | [角色定义参考](/03-Reference/role-yaml) — `role.yaml` 完整字段说明

rolebox 的所有角色、技能、函数和引用文件都组织在 `~/.config/opencode/` 目录下。以下为完整的目录树，每个部分都有详细说明。

```
~/.config/opencode/
├── opencode.jsonc                  # opencode 主配置文件，声明插件
├── rolebox/                        # rolebox 角色根目录
│   ├── copywriter/                 # 角色示例：文案作者
│   │   └── role.yaml               # 角色配置文件（模型、技能、函数声明）
│   ├── code-reviewer/              # 角色示例：代码审查员
│   │   ├── role.yaml               # 角色定义（模型选择、提示词、行为约束）
│   │   ├── skills/                 # 角色私有技能目录
│   │   │   └── review-checklist.md # 技能文件：审查清单知识
│   │   ├── functions/              # 角色私有函数目录
│   │   │   └── plan.md             # 函数定义：可覆盖内置函数
│   │   └── references/             # 角色私有引用文档目录
│   │       └── style-guide.md      # 深度知识文档：编码规范参考
│   ├── team-lead/                  # 角色示例：团队领导
│   │   ├── role.yaml               # 父角色配置（可内联子代理定义）
│   │   ├── references/             # 父角色引用文档
│   │   │   └── architecture.md     # 架构决策参考
│   │   └── subagents/              # 基于文件的子代理定义
│   │       └── researcher/         # 子代理：研究员
│   │           ├── role.yaml       # 子代理角色定义
│   │           └── skills/         # 子代理技能目录
│   │               └── research-checklist/
│   │                   ├── SKILL.md           # 技能入口文件
│   │                   └── references/        # 技能级引用文档
│   │                       └── methodology.md # 研究方法论
│   └── ...                         # 更多角色目录
├── functions/                      # 全局用户自定义函数
│   └── my-custom-fn.md             # 对所有角色可见的自定义函数
└── skills/                         # 全局 opencode 技能
    └── ...                         # 可被所有角色加载的共享技能
```

## 目录与文件说明

### `role.yaml` — 角色定义

每个角色目录必须包含 `role.yaml` 文件，它是角色的声明式配置入口。内容包括：

- **模型配置**：指定角色使用的 AI 模型（可从模型池中选择）
- **系统提示词**：定义角色的行为、职责和约束
- **技能声明**：列出角色可加载的技能模块
- **函数声明**：声明角色激活的内置或自定义函数
- **子代理定义**：可内联定义子代理，或通过 `subagents/` 目录引用
- **权限与能力**：配置角色的工具访问权限（文件读写、网络访问等）
- **调度配置**：并发限制、预算控制、超时设置

详见 [角色定义 (role.yaml)](/03-Reference/role-yaml)。

### `skills/` — 技能目录

技能是按需加载的知识模块，角色只在执行相关任务时才加载对应技能。每个技能是一个 Markdown 文件（简单技能）或一个包含 `SKILL.md` 入口文件的子目录（复杂技能，可附带 `references/` 引用文档）。

技能的分层加载优先级：
1. **角色私有技能**：位于 `{roleDir}/skills/` — 仅该角色可用
2. **全局技能**：位于 `~/.config/opencode/skills/` — 所有角色共享

技能文件命名约定：简单技能使用 `{name}.md`，复杂技能使用 `{name}/SKILL.md` 目录布局。分辨率为先目录后文件：同名的 `{name}/SKILL.md` 优先于 `{name}.md`。详见 [技能系统](/02-Guide/skills)。

### `functions/` — 函数目录

函数是角色可激活的组合行为模块，通过 `|name|` 语法触发。可以是内置函数（如 `plan`、`execute`、`loop`）或自定义函数。

函数的分层覆盖优先级：
1. **角色私有函数**：位于 `{roleDir}/functions/` — 可覆盖内置函数
2. **全局用户函数**：位于 `~/.config/opencode/functions/` — 对所有角色可见
3. **内置函数**：rolebox 自带的基础函数（`plan`、`execute`、`loop`）

函数通过 `|functionName|` 语法在对话中触发，支持参数化调用（如 `|review:security,strict|`）。内置函数为默认加载项，仅在 `role.yaml` 显式声明 `functions` 字段时被覆盖。详见 [函数系统](/02-Guide/functions)。

### `references/` — 引用文档目录

引用文档是角色或技能被动阅读的深度知识文档，在相关任务执行时自动注入到上下文中。与技能不同，引用文档不会改变角色的行为模式，而是提供领域知识上下文。

引用文档可以放在三个层级：
- **角色级**：`{roleDir}/references/`
- **技能级**：`{skillDir}/references/`
- **全局级**：`~/.config/opencode/references/`

引用文档系统支持从 Markdown 头部的 `description` 字段自动提取摘要，在相关任务执行时作为上下文注入。详见 [引用文档](/02-Guide/references)。

### `subagents/` — 子代理目录

子代理是父角色派生的专门化代理，拥有独立的角色定义、技能和提示词。父角色通过 `dispatch()` 工具将任务委托给子代理。子代理目录组织方式与普通角色完全相同（包含 `role.yaml`、`skills/`、`functions/`、`references/`）。

子代理的关键特性：
- **独立上下文**：每个子代理有独立的会话上下文
- **并发执行**：多个子代理可并行运行
- **层级嵌套**：支持最多 3 级嵌套（父 → 子 → 孙）
- **结果回传**：子代理完成后将结构化结果返回给父角色

详见 [子代理](/02-Guide/subagents)。

---

### 解析优先级图

rolebox 在运行时会按以下优先级解析技能、函数和引用文档。低优先级仅在高优先级未找到时生效：

```
技能解析优先级 (src/resolver/skill-resolver.ts:22-34)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
高  1. {roleDir}/skills/{name}/SKILL.md    ← 角色私有目录技能（复杂）
   2. {roleDir}/skills/{name}.md            ← 角色私有单文件技能
   3. ~/.config/opencode/skills/{name}/SKILL.md  ← 全局目录技能
低  4. ~/.config/opencode/skills/{name}.md       ← 全局单文件技能

函数解析优先级 (src/function/file-resolver.ts:19-23)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
高  1. {roleDir}/functions/{name}.md        ← 角色私有（可覆盖内置）
   2. ~/.config/opencode/functions/{name}.md ← 全局用户函数
低  3. {builtinDir}/{name}.md               ← rolebox 内置函数

引用文档优先级 (src/resolver/reference-resolver.ts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
高  1. {roleDir}/references/                ← 角色级引用
   2. {skillDir}/references/                ← 技能级引用
低  3. ~/.config/opencode/references/       ← 全局引用
```

::: tip 优先级记忆口诀
三个维度的共同规律：**角色本地 > 全局 > 内置**。注意函数与引用的行为差异——函数采用**覆盖**策略（高优先级同名文件会屏蔽低优先级），引用采用**合并**策略（所有匹配的引用全部注入上下文，不存在屏蔽关系）。
:::

### `.rolebox/` — 运行时状态与持久化目录

rolebox 在项目根目录下维护一个隐藏的 `.rolebox/` 目录，用于存储运行时状态、持久化数据和日志。该目录由 rolebox 自动管理，**不建议手动编辑**。

::: warning
`.rolebox/` 目录已包含在 `.gitignore` 中，不会提交到版本控制。如果需要重置 rolebox 的运行时状态，可以安全地删除整个 `.rolebox/state/` 目录——rolebox 会在下次运行时自动重建。但 `.rolebox/memory.db` 包含跨会话的记忆数据，删除前请确认是否需要备份。
:::

项目级配置 `.rolebox/config.json` 使用简单 JSON 格式（`{ "defaultRole": "role-name" }`），由 `src/project-config.ts:42-70` 读取。该配置在角色解析之后、会话启动之前应用，因此不会影响 `rolebox list` 的输出，但会影响打开新会话时的默认角色选择。

### Runtime State (运行时状态)

运行时状态是 rolebox 执行引擎的核心数据层，对应的模块实现参见 [架构概览 - 模块地图](/01-Overview/architecture-overview#_30-模块地图)。每个状态文件由对应的服务模块在运行时自动维护：

```
.project-root/
└── .rolebox/
    ├── memory.db                    # SQLite 持久化记忆数据库
    │                                # 存储跨会话、跨角色的记忆条目
    ├── config.json                  # 项目级配置（如默认角色）
    └── state/                       # 运行时状态目录
        ├── dispatch-{hash}.json     # 调度任务状态（含出站通知、结果引用）
        ├── fnstate-{hash}.json      # 函数运行时状态（阶段、门控、证据）
        ├── graph-{hash}.json        # 协作图执行状态（前沿、迭代计数）
        ├── metrics-{hash}.json      # 指标持久化（原子写入）
        ├── metrics-events-{hash}.ndjson  # 指标事件环形缓冲区（上限 100KB）
        ├── progress/{taskId}.json   # 进度报告数据
        ├── checkpoints/{taskId}.json # 检查点持久化（用于失败重试）
        └── results/{taskId}.txt     # 任务结果侧车文件（溢出文本）
```

关键文件说明：

| 文件 | 来源模块 | 用途 |
|------|----------|------|
| `memory.db` | `src/memory/store.ts` | SQLite 数据库，存储 `memory_write` 写入的记忆条目 |
| `config.json` | `src/project-config.ts` | 项目级配置，设置 `defaultRole` 指定默认角色。在 `~/.config/opencode/` 全局配置之后加载，仅对该项目生效 |
| `dispatch-{hash}.json` | `src/dispatch/persistence/task-store.ts` | 所有调度任务的持久化状态，含任务图、结果引用、出站通知队列 |
| `fnstate-{hash}.json` | `src/function/runtime-store.ts` | 函数状态机的阶段/门控/证据观测记录 |
| `graph-{hash}.json` | `src/graph/graph-store.ts` | 协作图的前沿节点、迭代次数、终止状态 |
| `metrics-{hash}.json` | `src/dispatch/persistence/metrics-persister.ts` | 指标快照（计数器、仪表盘、直方图、恢复数据），由 `ROLEBOX_METRICS` 环境变量控制 |
| `metrics-events-{hash}.ndjson` | `src/dispatch/persistence/metrics-persister.ts` | 指标事件环形缓冲区，上限 100KB，超限后自动截断保留后半 |
| `progress/{taskId}.json` | `src/dispatch/progress/progress-store.ts` | 运行中任务的进度报告（阶段、百分比、消息），5 秒去抖写入 |
| `checkpoints/{taskId}.json` | `src/dispatch/checkpoint/checkpoint-store.ts` | 检查点数据数组，用于失败后带上下文恢复。每任务最多保留 100 条（FIFO 淘汰） |
| `results/{taskId}.txt` | `src/dispatch/persistence/task-store.ts` | 任务结果侧车文件，存储超出内联限制（4KB）的 `dispatch_output` 文本 |
| `dispatch-{hash}.json.lock` | `src/dispatch/concurrency/state-lock.ts` | 文件锁，防止多进程并发写入冲突。5 分钟无活动自动失效回收。锁竞争时退化为只读模式 |

`{hash}` 是项目目录规范化后的 SHA-256 前 12 位，确保同一物理路径总是映射到相同的状态文件名。

#### 状态文件示例内容

每个 JSON 状态文件的内部结构如下：

| 文件 | 示例内容（缩略） |
|------|-----------------|
| `dispatch-{hash}.json` | `{ "tasks": [{ "id": "bg_xxx", "agent": "backend", "status": "running" }] }` |
| `fnstate-{hash}.json` | `{ "sessions": { "sid": { "phase": "active", "gateSatisfied": true } } }` |
| `graph-{hash}.json` | `{ "version": 2, "sessions": [{ "sessionId": "...", "state": { "frontier": ["agent-a"], "iterationCount": 3 } }] }` |
| `metrics-{hash}.json` | `{ "dispatchCount": 42, "avgDurationMs": 1250, "lastUpdated": "..." }` |
| `progress/{taskId}.json` | `{ "stage": "implementing", "percentage": 60, "message": "处理中..." }` |
| `checkpoints/{taskId}.json` | `{ "phase": "research", "completedItems": [...], "remainingItems": [...] }` |
| `results/{taskId}.txt` | 纯文本形式存储，内容为工具调用的完整输出 |

`{hash}` 经 `src/utils/state-paths.ts:15-17` 中的 `shortHash()` 函数计算（SHA-256 前 12 位十六进制），确保同一物理路径总是映射到固定的文件名。

#### 原子写入与临时文件

所有状态文件（`dispatch-*`、`graph-*`、`metrics-*`、`checkpoints/*`、`progress/*`）均采用 **原子写入模式**：先写入 `.tmp` 临时文件，再通过 `renameSync()` 覆盖目标文件。这意味着：
- 写入中途崩溃不会产生损坏的 state 文件
- 读取方永远只看到完整的先前版本或完整的新版本
- `.tmp` 文件可以安全删除，rolebox 不会残留打开句柄

#### 状态文件垃圾回收（GC）

rolebox 在启动时自动执行 `cleanExpiredState()`（`src/dispatch/persistence/state-gc.ts:23`），清理超过 7 天未修改的 `dispatch-*.json` 和 `dispatch-*.json.lock` 文件。可通过环境变量 `ROLEBOX_STATE_RETENTION_DAYS` 自定义保留天数。GC 为"发起即忘"设计，异常仅记录日志，不会阻止启动。

状态文件可通过 `rolebox monitor` 命令查看实时内容，使用 `--task-id=<id>` 查看特定任务的详细结果。

## rolebox 全局路径

以下全局目录位于 `~/.config/opencode/` 下，对本地开发环境中的 **所有项目** 可见：

| 路径 | 用途 |
|------|------|
| `~/.config/opencode/rolebox/` | rolebox 角色同步目标，`rolebox sync opencode` 在此创建符号链接 |
| `~/.config/opencode/skills/` | 全局技能目录，所有角色可加载的共享技能 |
| `~/.config/opencode/functions/` | 全局函数目录，对所有角色可见的自定义函数 |
| `~/.config/opencode/references/` | 全局引用文档目录，跨角色共享的深度知识文档 |

## rolebox 自身配置与数据目录

除了上述 `~/.config/opencode/` 下的全局目录外，rolebox 在以下两个位置维护独立配置和数据：

### `~/.config/rolebox/` — 角色管理器配置

| 文件 | 用途 | 安全删除？ |
|------|------|-----------|
| `config.yaml` | 注册表配置。默认包含 `oh-my-role` 注册表，记录 GitHub 仓库 URL 和默认注册表标记 | 删除后下次使用自动重建默认配置 |
| `rolebox.lock` | 锁文件，记录已安装角色的版本号、注册表源和完整性哈希（`sha256-...`） | 删除后角色仍存在，但 `rolebox sync` 将无法找到它们 |
| `logs/rolebox.log` | rolebox CLI 操作日志 | 可安全删除，自动轮转 |

`~/.config/rolebox/config.yaml` 与项目本地的 `.rolebox/config.json` 分工明确：config.yaml 管理**角色安装和注册表**（影响 `rolebox install`、`rolebox sync`），而 `.rolebox/config.json` 管理**项目级运行时配置**（如默认角色）。

### `~/.local/share/rolebox/` — 角色包与缓存数据

| 路径 | 用途 |
|------|------|
| `roles/{registry}/{roleId}@{version}/` | 已安装角色包的完整目录。`rolebox install` 将角色下载到此处，`rolebox sync` 从此创建符号链接到 `~/.config/opencode/rolebox/` |
| `cache/{registry}/` | 注册表清单缓存（`registry.yaml` + `.timestamp`）。默认缓存 30 分钟，可通过 `--no-cache` 跳过 |

角色存储路径格式为 `{dataDir}/roles/{registry}/{roleId}@{version}/`（见 `src/cli/paths.ts:54-56`），确保同一角色不同版本可以共存。升级角色时旧版本目录被自动删除。

## 状态迁移记录

### v0.12.0 — 状态存储位置迁移

在 v0.12.0 之前（参见 `CHANGELOG.md:302`），dispatch 和 graph 状态存储在 `~/.local/share/rolebox/`（`XDG_DATA_HOME`）下。v0.12.0 将状态存储迁移到项目本地的 `.rolebox/` 目录中。这意味着：

- **旧位置**（v0.12.0 前）：`~/.local/share/rolebox/state/dispatch-*.json`
- **新位置**（v0.12.0 起）：`.rolebox/state/dispatch-*.json`

迁移由 rolebox 自动处理——启动时检测旧位置并搬移到新位置。如果发现 `.rolebox/state/` 为空而旧位置有残留，删除旧位置文件是安全的。

## 遇到问题时该看哪个目录

| 场景 | 对应目录 / 文件 | 查看方法 |
|------|----------------|---------|
| 角色没有按预期响应，技能/函数未加载 | `~/.config/opencode/rolebox/{roleName}/` | 检查 `role.yaml` 中的 `skills` 和 `functions` 声明 |
| 任务卡住或状态异常 | `.rolebox/state/dispatch-{hash}.json` | `rolebox monitor --task-id=<id>` |
| 函数状态机行为异常 | `.rolebox/state/fnstate-{hash}.json` | `rolebox monitor`（过滤 Functions 面板） |
| 协作图执行停滞 | `.rolebox/state/graph-{hash}.json` | `rolebox monitor`（过滤 Graph 面板） |
| 进度报告丢失或不更新 | `.rolebox/state/progress/{taskId}.json` | 直接读取 JSON，检查 `timestamp` 是否更新 |
| 角色安装后未生效 | `~/.config/opencode/rolebox/{roleName}/` | 运行 `rolebox sync opencode`，确认符号链接存在 |
| 角色版本不匹配 | `~/.config/rolebox/rolebox.lock` | `rolebox list` 查看已安装版本 |
| 注册表下载失败 | `~/.local/share/rolebox/cache/{registry}/` | 运行 `rolebox search <role> --no-cache` 跳过缓存 |
| 跨会话记忆丢失 | `.rolebox/memory.db` | 检查文件是否存在且非空（SQLite 格式） |
| 状态文件损坏需重置 | `.rolebox/state/` | 安全删除整个 `.rolebox/state/` 目录，rolebox 下次启动自动重建 |
| 希望完全清理所有运行时数据 | `.rolebox/` | 删除 `.rolebox/`（注意 `memory.db` 包含记忆数据，确认备份后操作） |

## 下一步

- [快速开始](/01-Overview/quick-start) — 5 分钟上手 rolebox
- [创建角色](/02-Guide/create-a-role) — 完整的角色创建指南
- [角色定义参考](/03-Reference/role-yaml) — `role.yaml` 完整字段说明
