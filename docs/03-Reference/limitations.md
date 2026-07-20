---
title: 已知限制
description: rolebox 当前版本已知限制 — 角色继承、运行时切换、函数持久化、子代理嵌套深度
---

# 已知限制

> **相关文档：** [错误处理](/03-Reference/error-handling) — 错误容忍机制 | [调度配置](/03-Reference/dispatch-config) — 调度系统限制与配置 | [Hook 机制](/03-Reference/hooks) — Hook 限制

以下是 rolebox 当前版本（v1.x）的已知功能限制。

## 限制一览

| 限制 | 说明 | 应对策略 |
|---|---|---|
| **无角色继承** | 角色之间不支持继承或组合机制，每个角色是独立定义 | 通过技能（skills）和引用（references）共享通用配置；利用子代理（subagents）实现功能组合与分层复用 |
| **无运行时角色切换** | 会话启动后不能动态切换角色 | 预先定义多个子代理在不同工作模式下并行激活；或退出当前会话后以新角色身份重新启动 |
| **函数全会话持久化** | 函数在整个会话期间持续激活，暂不支持按消息级别激活/停用 | 通过条件函数设计控制函数的生效范围；利用子代理隔离不同阶段所需的函数上下文 |
| **无项目上下文条件函数** | 不支持根据项目上下文（如文件类型、目录结构）条件性地激活函数 | 在角色初始化阶段手动识别项目类型；为不同项目类型分别定义专用角色并在需要时切换 |
| **子代理嵌套深度上限** | 基于文件的递归子代理嵌套最高支持 3 层（父 → 子 → 孙） | 将超出深度的子代理以内联方式声明在父级 role.yaml 的 `subagents:` 字段中；或将深层子代理扁平化为中间层引用 |
| **`--` 为保留字符** | `--` 在角色 ID 中作为父/子代理分隔符使用，不可用于命名 | 使用 `-` 或 `.` 等替代分隔符；避免在角色名称中包含 `--` 组合 |

## 详细说明

### 无角色继承

每个角色通过 `role.yaml` 独立定义，不允许从一个角色继承另一个角色的配置（如函数、技能、权限等）。如果多个角色需要共享配置，目前需要通过复制或引用来实现。

### 无运行时角色切换

角色在会话初始化时确定，会话运行期间不能切换为其他角色。如果需要在不同角色之间切换工作模式，需要通过子代理调度来实现。

### 函数全会话持久化

通过 `functions:` 字段激活的函数会在整个会话生命周期内保持激活状态。当前不支持按消息粒度动态启用/禁用函数。

### 子代理嵌套深度上限

子代理可以通过文件目录进行递归嵌套，但深度上限为 3 层（父 → 子 → 孙 → 曾孙）。超过深度限制的子代理将无法加载。

## 各子系统限制

### 调度系统（Dispatch）

| 限制 | 默认值 | 说明 |
|---|---|---|
| **模型并发槽位数** | 5 | 每个模型密钥（`providerID/modelID`）的并发执行上限。详见 `concurrency.ts:92` |
| **保留槽位数** | 1 | 保留给同步（sync）任务的槽位，后台任务可用上限为 `limit - reserved`（即 4 个）。详见 `concurrency.ts:92` |
| **队列最大深度** | 10 | 等待队列最大长度，超出时返回 `QueueFullError`。详见 `concurrency.ts:92` |
| **等待超时** | 300 秒（5 分钟） | 队列中等待超时后抛出 `WaiterTimeoutError`，详见 `concurrency.ts:46` |
| **子代理嵌套深度** | 3 层 | 基于文件的子代理递归解析最大深度，超过深度限制的层级被忽略。详见 `subagents.ts:237` |
| **通知间隔** | 2 秒 | `loop` 模块中连续轮次之间的最小延迟。详见 `loop/constants.ts:14` |

### 记忆系统（Memory）

| 限制 | 默认值 | 说明 |
|---|---|---|
| **存储后端** | bun:sqlite（WAL 模式） | 使用 `bun:sqlite` 作为持久化引擎，启用 WAL 日志模式以提高并发性能。详见 `store.ts:28-29` |
| **全文检索引擎** | FTS5 | 基于 SQLite FTS5 虚拟表，自动同步 `title`、`content`、`tags` 字段。详见 `schema.ts:29-34` |
| **列表默认上限** | 20 条 | `memory_list` 未指定 `limit` 时最多返回 20 条摘要记录。详见 `store.ts:212` |
| **搜索默认上限** | 10 条 | `memory_recall` 未指定 `limit` 时最多返回 10 条完整记录。详见 `search.ts:42` |
| **自动注入上限** | 10 条 | 会话启动时自动注入系统提示的记忆摘要最大数量。详见 `types.ts:13` |
| **分类维度** | scope / category / relevance | 支持按作用域、分类和相关性等级过滤；tags 和 source_sessions 以 JSON 数组存储 |

### 图编排系统（Graph）

| 限制 | 默认值 | 说明 |
|---|---|---|
| **最大迭代次数（含环图）** | 3 次 | 当图中检测到环（cycle）且未显式设置 `max_iterations` 时，默认上限为 3 次。详见 `parser.ts:80-81` |
| **最大迭代次数（无环图）** | 无限制（0） | 无环图默认不限制迭代次数。详见 `parser.ts:82-83` |
| **用户自定义上限** | 由 `max_iterations` 字段指定 | 支持在 graph 配置中显式设置，最小值为 0。详见 `parser.ts:44-47` |
| **环组独立上限** | 通过 termination 配置 | 每个 loop group 可单独设置 `maxIterations`，互不干扰。详见 `termination.ts:49` |

### 循环执行系统（Loop）

| 限制 | 默认值 | 说明 |
|---|---|---|
| **默认迭代次数** | 5 次 | 未指定 `iterations` 参数时的默认循环轮次。详见 `constants.ts:2` |
| **硬上限** | 50 次 | 单次循环的最大轮次，防止失控执行。详见 `constants.ts:5` |
| **单轮超时** | 900 秒（15 分钟） | 每个 dispatch 轮次的最长等待时间。详见 `constants.ts:8` |
| **轮次间隔** | 2 秒 | 连续轮次之间的最小延迟，避免瞬态负载。详见 `constants.ts:14` |
| **摘要输入上限** | 8,000 字符 | 每次轮次输出送入摘要器的最大字符数。详见 `constants.ts:17` |
| **种子字符上限** | 8,000 字符 | 合并后预置到下一轮次的摘要最大字符数。详见 `constants.ts:20` |

### 通知系统（Notifications）

| 通道 | 平台支持 | 说明 |
|---|---|---|
| **SystemToast** | macOS（terminal-notifier / osascript）、Linux（notify-send）、Windows（PowerShell） | 原生系统通知，各平台依赖不同命令行工具。详见 `system-toast.ts` |
| **Sound** | macOS（afplay）、Linux（paplay / aplay 回退）、Windows（PowerShell SoundPlayer） | 播放通知音效，需要对应平台音频播放工具。详见 `sound.ts` |
| **File** | 全平台 | 以 JSONL 格式追加写入文件，无平台依赖。详见 `file.ts` |
| **Log** | 全平台 | 写入结构化日志，无平台依赖。详见 `log.ts` |
| **Webhook** | 全平台（依赖网络可达） | HTTP POST 到指定 URL，支持自定义请求头和超时（默认 5 秒）。详见 `webhook.ts:21` |
| **CustomCommand** | 全平台 | 通过子进程执行自定义命令，参数以环境变量传递，支持 stdin 输入。详见 `custom-command.ts` |

### 哈希行系统（Hashline）

| 限制 | 默认值 | 说明 |
|---|---|---|
| **小文件哈希宽度** | 2 位 | 文件 ≤ 1000 行时使用，提供 64² = 4,096 个不重复桶。详见 `constants.ts:6` |
| **中文件哈希宽度** | 3 位 | 文件 1001–10000 行时使用，提供 64³ = 262,144 个桶。详见 `constants.ts:7` |
| **大文件哈希宽度** | 4 位 | 文件 > 10000 行时使用，提供 64⁴ = 16,777,216 个桶。详见 `constants.ts:8` |
| **环境变量覆盖** | `ROLEBOX_HASHLINE_WIDTH` | 可覆盖自动选择的哈希宽度。详见 `constants.ts:14` |
| **校验正则** | `/^(\d+)#([A-Za-z0-9_-]{2,4})$/` | 哈希引用格式为 `行号#哈希`，宽度限制 2-4 位。详见 `constants.ts:18` |
| **模糊搜索窗口** | ±10 行 | 定位失败时在目标行前后各 10 行内搜索匹配内容。详见 `constants.ts:27` |

### 平台命令依赖

通知后端通过平台特定的命令行工具发送通知（`src/notifications/platform.ts`）：

| 平台 | SystemToast | Sound |
|------|-------------|-------|
| macOS | `terminal-notifier` 或回退到 `osascript` | `afplay` |
| Linux | `notify-send` | `paplay`，回退到 `aplay` |
| Windows | PowerShell | PowerShell (`SoundPlayer`) |

如果目标平台缺少对应的命令行工具，通知静默降级（跳过该通道），不会报错。

::: tip 升级注意事项
从 v0.12.0 开始，状态存储从 `XDG_DATA_HOME` 迁移到项目本地 `.rolebox/` 目录。如果你从更早版本升级，旧的状态文件不会自动迁移。升级后建议先运行 `rolebox status` 确认所有子系统正常工作。详见[兼容性](/04-Advanced/compatibility#v0-12-0-状态存储迁移)。
:::

## 外部工具限制

### LSP 服务器

rolebox 内置的 LSP 服务器注册表（`src/lsp/servers.ts:9-122`）支持以下语言，每个语言对应一个外部服务器二进制文件：

| 语言 | 服务器命令 | 根文件标记 |
|------|-----------|-----------|
| TypeScript/JavaScript | `typescript-language-server` | `tsconfig.json` / `package.json` |
| Python | `pyright-langserver` | `pyproject.toml` / `setup.py` |
| Go | `gopls` | `go.mod` |
| Rust | `rust-analyzer` | `Cargo.toml` |
| C/C++ | `clangd` | `compile_commands.json` / `CMakeLists.txt` |
| Java | `jdtls` | `pom.xml` / `build.gradle` |
| Ruby | `solargraph` | `Gemfile` |
| Bash | `bash-language-server` | 自动检测 |
| Lua | `lua-language-server` | `.luarc.json` |
| Kotlin | `kotlin-lsp` | `build.gradle.kts` |

如果对应服务器的二进制文件未在 `PATH` 或常见安装路径中找到，该语言的 LSP 功能（诊断、跳转定义、补全等）不可用（`src/lsp/servers.ts:226-233`）。

### Web 搜索与渲染引擎

Web 抓取功能依赖可选的浏览器自动化包（`src/web/browser-detect.ts:24-46`）：

- **Playwright**：提供完整的 JS 渲染能力，用于抓取 SPA 和动态网页。
- **Crawlee**：提供高级爬取功能。

如果两者都未安装，web 抓取回退到静态 HTTP 请求模式，无法渲染 JavaScript 生成的内容。

### TUI (终端 UI)

rolebox 的终端 UI 默认支持 macOS 和 Linux 终端（如 iTerm2、Kitty、Terminator）。Windows 终端兼容性取决于使用的终端模拟器 —— PowerShell 和 Windows Terminal 的基本功能可用，但某些高级渲染特性（如 ANSI 转义序列）可能受限。

## 已知边缘情况

| 场景 | 表现 | 相关参考 |
|------|------|---------|
| **同时启动大量并发任务** | 超出 `maxConcurrent` + `maxQueueDepth` 的任务返回 `QueueFullError`，需等待重试 | [调度配置](./dispatch-config) |
| **子代理长时间无响应** | 后台任务在 `backgroundStaleTimeoutMs`（默认 15 分钟）后标记为过期 | [调度配置](./dispatch-config) |
| **队列中任务等待超时** | 超过 `WAITER_TTL_MS`（300 秒）后抛出 `WaiterTimeoutError` | [调度配置](./dispatch-config)、[错误处理](./error-handling) |
| **图循环中代理卡住** | 达到 `max_iterations` 或 termination 条件后自动终止 | [错误处理](./error-handling) |
| **预算限制触发后任务取消** | 采样间隔 `budgetSampleIntervalMs` 内可能多消耗一些配额 | [调度配置](./dispatch-config) |
| **扩展模块加载失败** | 按模块捕获，记录警告，跳过该扩展，不会影响其他功能 | [扩展机制](./extensions) |
| **Hook 模块加载失败** | 记录警告，Hook 被跳过，注册中心存储 `null` 并继续 | [Hook 机制](./hooks) |
| **插件关闭时 Hook 未释放** | `onDispose` 确保在关闭时清理资源；如果模块未实现 `onDispose`，资源由进程回收 | [Hook 机制](./hooks) |
| **环境变量插值未解析** | 保留原始 `{env:VARIABLE_NAME}` 文本，不做猜测性替换 | [调度配置](./dispatch-config) |
| **通知通道平台命令缺失** | 通道静默降级，无报错；不影响其他功能 | 本页上方「平台命令依赖」 |
| **并发策略自定义实现错误** | `concurrency_policies` 扩展加载失败仅影响该策略，回退到默认 `ConcurrencyManager` | [扩展机制](./extensions) |

## 版本演进路线

以下标记哪些限制属于有意设计约束（短期内不会改变），哪些在规划路线上可能调整。

::: info 设计约束 vs 路线图
「设计约束」标记的限制基于架构性决策，短期内不会改变——应将其视为系统的稳定边界来规划你的角色设计。「路线图待定」标记的限制在规划中可能调整，但无明确时间表。在受这些限制影响时，可以先采用「应对策略」列中建议的变通方案。
:::

| 限制 | 分类 | 说明 |
|------|------|------|
| **无角色继承** | 设计约束 | 角色模型基于组合（composition）而非继承（inheritance），通过子代理和技能复用实现模块化。此为架构性决策，不计划引入继承机制 |
| **无运行时角色切换** | 路线图待定 | 技术上可通过 `dispatch()` 间接实现，但原生会话内角色切换需要更复杂的上下文管理机制 |
| **函数全会话持久化** | 设计约束 | 函数激活模型与函数状态机的生命期绑定，按消息粒度激活/停用将显著增加状态管理复杂度。暂不在路线图中 |
| **无项目上下文条件函数** | 路线图待定 | 条件函数是需求中高频出现的请求，可能在后续版本中通过扩展 `conditions` 系统增强 |
| **子代理嵌套深度上限** | 路线图待定 | 当前 `maxDepth: number = 3` 在源码中为可调默认值（`src/loader/subagents.ts:237`），未来可能提高或开放配置 |
| **`--` 为保留字符** | 设计约束 | 此分隔符是子代理 ID 路由机制的基础，无法变更 |

## 下一步

- [错误处理](./error-handling) — 了解 rolebox 的错误容忍与降级机制
