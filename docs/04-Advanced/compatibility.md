---
title: 兼容性
description: rolebox 与其他工具和框架的兼容性说明
---

# 兼容性

rolebox 设计为与现有 opencode 生态协同工作，不做破坏性变更。

> **相关文档：** [快速入门](/02-Guide/getting-started) — 安装与配置指南 | [已知限制](/03-Reference/limitations) — 当前版本的功能边界

## 与 oh-my-openagent 共存

rolebox 与 [oh-my-openagent](https://github.com/nicholasgriffintn/oh-my-openagent) (omo) 可以同时运行，互不冲突：

- rolebox 角色出现在 opencode 代理列表中，与 omo 代理并列
- rolebox 技能可通过 opencode 的 `skill` 工具发现和加载
- 4 个同名会话工具（`session_list`、`session_read`、`session_search`、`session_info`）为增强版但向后兼容
- 其余 6 个会话工具使用 `session_` 前缀命名空间，不会与任何其他工具冲突

## opencode 版本兼容性

| rolebox 版本 | opencode 最低版本 | 说明 |
|-------------|-------------------|------|
| v0.17.x | ≥1.3.0 | 完整功能支持（记忆系统、会话工具、Hashline 编辑） |
| v0.16.x | ≥1.2.0 | 核心功能（角色调度、技能、函数） |
| v0.15.x | ≥1.0.0 | 基本角色系统 |

rolebox 通过 `@opencode-ai/plugin` SDK 与 opencode 通信，插件接口的向后兼容性由 opencode 团队维护。

## 功能兼容性矩阵

以下矩阵映射 rolebox 各版本引入的主要功能领域及其对应的 opencode 版本要求。版本阈值来源于 [CHANGELOG](https://github.com/EricMoin/rolebox/blob/main/CHANGELOG.md) 和 `package.json` 中的引擎声明。

| 功能领域 | 引入版本 | opencode 要求 | 关键依赖 |
|---------|---------|-------------|---------|
| 角色 YAML 系统 | v0.1.0 | ≥1.0.0 | — |
| Functions 函数系统 (plan/execute) | v0.2.0 | ≥1.0.0 | — |
| CLI 工具链 (init/sync/search/list/update/registry) | v0.4.0 | ≥1.0.0 | — |
| 子代理系统 (dispatch/output/cancel) | v0.5.1 | ≥1.0.0 | — |
| References 与 Collaboration Graph | v0.6.0 | ≥1.0.0 | — |
| Dispatch 调度引擎 (事件驱动、并发隔离、持久化) | v0.10.0 | ≥1.0.0 | — |
| Monitor 监控面板 | v0.11.0 | ≥1.0.0 | — |
| Loop 循环迭代系统 | v0.14.0 | ≥1.0.0 | — |
| LSP 语言服务器集成 (30+ 工具) | v0.17.0 | ≥1.3.0 | `@opencode-ai/plugin` SDK ≥1.3.0 |
| 会话管理 (session_list/read/search/info/diff/fork) | v0.17.0 | ≥1.3.0 | `@opencode-ai/plugin` SDK ≥1.3.0 |
| Hashline 内容哈希编辑 | v0.17.0 | ≥1.3.0 | `@opencode-ai/plugin` SDK ≥1.3.0 |
| 模型重复预防 | v0.18.0 | ≥1.3.0 | — |
| 扩展系统与自定义 Hook | v0.19.0 | ≥1.3.0 | — |
| 错误恢复框架 (7+ 策略) | v0.19.0 | ≥1.3.0 | — |
| 通知管理器 (多通道、静默时段) | v0.19.0 | ≥1.3.0 | — |
| 持久记忆系统 (SQLite + FTS5) | v0.20.0 | ≥1.3.0 | **Bun** (bun:sqlite) |
| 微内核架构与热重载 | v0.20.0 | ≥1.3.0 | — |
| Token/成本预算管理 | v0.20.0 | ≥1.3.0 | — |
| TUI 仪表板 (rolebox monitor) | v0.20.0 | ≥1.3.0 | Solid.js + OpenTU |
| 崩溃恢复 (降级启动) | v0.21.0 | ≥1.3.0 | — |
| Asset 工具套件 (search/inspect/validate) | v0.21.0 | ≥1.3.0 | — |
| Context Assembly 跨域搜索 | v0.21.0 | ≥1.3.0 | — |
| web_fetch / web_read (多后端渲染) | v0.22.0 | ≥1.3.0 | Playwright / Crawlee (可选) |
| Signal 带外控制信号 | v0.22.0 | ≥1.3.0 | — |
| Dispatch 检查点与进度报告 | v0.23.0 | ≥1.3.0 | — |
| TUI 鼠标交互、指标面板 | v0.23.0 | ≥1.3.0 | Solid.js + OpenTU |

> 来源：`../rolebox/CHANGELOG.md` — 每项功能的引入版本；`../rolebox/package.json:5-7` — `engines.opencode` 声明为 `^1.0.0`；`../rolebox/package.json:77` — `peerDependencies['@opencode-ai/plugin']` 声明为 `^1.3.0`。

## 破坏性变更摘要

以下表格汇总了 rolebox 各版本引入的破坏性变更，帮助用户在升级前评估影响范围。版本信息来源于 [CHANGELOG](https://github.com/EricMoin/rolebox/blob/main/CHANGELOG.md)。

| 版本 | 变更类型 | 所需操作 |
|------|---------|---------|
| v0.23.0 | TUI 键盘交互移除 | 改用鼠标点击操作；原有键盘快捷键更新为 `Ctrl+` 前缀以避免冲突 |
| v0.20.0 | 运行时依赖变更 | 安装 **Bun ≥1.1.0**——持久记忆系统依赖于 `bun:sqlite`，无法在纯 Node.js 环境下运行 |
| v0.17.0 | 核心依赖升级 | 更新 `peerDependencies`：opencode ≥1.3.0，`@opencode-ai/plugin` 升级至 `^1.3.0` |
| v0.15.0 | Loop 语义重写 | `|loop|` 每轮循环（包括第一轮）在子工作线程中运行，主线程变为纯编排角色，不再直接执行循环任务 |
| v0.12.0 | 状态存储迁移 | 状态存储路径从 `XDG_DATA_HOME` 变更为项目本地 `.rolebox/` 目录；旧数据需手动迁移 |
| v0.10.0 | Dispatch 调度系统重写 | 旧的全局轮询模式被 `TaskWatchdogManager` 取代；建议清空旧的 `.rolebox/state/` 状态文件 |

> 来源：`../rolebox/CHANGELOG.md` — 各版本的破坏性变更记录。非破坏性版本（v0.16.x、v0.18.x、v0.19.x、v0.21.x、v0.22.x）不在此表列出。

### 兼容性变更与功能限制关联

| 破坏性变更 | 关联限制 | 说明 |
|-----------|---------|------|
| v0.23.0 TUI 键盘→鼠标 | — | 交互变更，不涉及底层功能限制 |
| v0.20.0 Bun 运行时依赖 | [持久记忆系统](/04-Advanced/memory-system) 依赖 `bun:sqlite` | 详见[兼容性 → Bun vs Node.js](/04-Advanced/compatibility#bun-vs-node-js) |
| v0.17.0 opencode ≥1.3.0 | [子代理嵌套深度上限](/03-Reference/limitations#子代理嵌套深度上限) 3 层 | SDK 升级，子代理模型不受影响 |
| v0.15.0 Loop 语义重写 | [循环系统](/04-Advanced/loop-system) 9 阶段状态机 | Loop 重启后自动恢复 |
| v0.12.0 状态迁移 `.rolebox/` | [无运行时角色切换](/03-Reference/limitations#无运行时角色切换) | 状态文件路径变更，角色模型不变 |
| v0.10.0 Dispatch 重写 | [调度并发限制](/03-Reference/limitations#调度系统dispatch) | 事件驱动架构，新增模型并发槽位

## 平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| macOS | 完整支持 | 主开发平台 |
| Linux | 完整支持 | CI 验证 |
| Windows | 基本支持 | 部分路径处理可能有差异；欢迎报告问题 |

## 运行时依赖

rolebox 对运行时环境的最低要求：

- **Bun** ≥1.1.0（用于 `bun:sqlite` 和运行时）
- **Node.js** ≥20.0.0（opencode 运行时要求）
- **npm** ≥9.0.0（包安装）

## Bun vs Node.js

rolebox 核心运行时依赖 **Bun**，但部分子系统和可选功能可兼容 Node.js。

### 必须使用 Bun 的功能

| 功能 | 依赖 | 来源 |
|------|------|------|
| 持久记忆系统 | `bun:sqlite` (内置 SQLite 引擎) | `src/memory/store.ts:3`, `src/memory/search.ts:1`, `src/memory/schema.ts:1` |
| 构建流程 | `bun run build` (TypeScript 编译 + TUI 构建) | `package.json:36` |
| 测试运行 | `bun test` | `package.json:40-41` |
| CLI 开发脚本 | `bun run scripts/*` | `package.json` |

### 可用 Node.js 运行的功能

以下功能在 Bun 环境下开发验证，但底层依赖均为纯 JavaScript/TypeScript 包，理论上可在 Node.js ≥20.0.0 下运行：

| 功能 | 说明 |
|------|------|
| 角色 YAML 加载与解析 | 依赖 `js-yaml` （纯 JS） |
| CLI 命令 (init/list/search/update/sync) | 依赖 `citty` (纯 JS) |
| Dispatch 调度系统 | 全部为纯 TS 实现 |
| LSP 集成 | 通过 child_process 调用语言服务器 |
| Hashline 编辑系统 | 纯文件 I/O |
| web_fetch / web_read | 依赖可选包 (Playwright 在 Node.js 下可用) |
| TUI 仪表板 | 依赖 Solid.js + OpenTU (跨运行时) |

> 注意：虽然上述功能在 Node.js 下可运行，但 rolebox 官方仅验证 Bun 运行时。在 Node.js 下运行未经完整测试，可能存在未预期的行为差异。建议始终使用 Bun 运行 rolebox。

### 运行时对比

| 维度 | Bun | Node.js |
|------|-----|---------|
| SQLite 支持 | ✅ 内置 `bun:sqlite` | ❌ 需额外安装 `better-sqlite3` 等包 |
| 启动速度 | ✅ 快速 (编译缓存) | ⚠️ 较慢 |
| 包管理 | ✅ 内置 (bun install) | ✅ npm/pnpm/yarn |
| rolebox 官方支持 | ✅ 完整支持 | ⚠️ 部分支持（未完整验证） |

> 来源：`../rolebox/src/memory/store.ts:3`, `../rolebox/src/memory/search.ts:1`, `../rolebox/src/memory/schema.ts:1` — 确认 `bun:sqlite` 为内存系统的硬依赖。

## 已知兼容性边界

- **无角色继承**：角色之间不支持继承关系，每个角色完全独立
- **无运行时角色切换**：会话中途不能更换代理角色
- **无跨子代理直接通信**：子代理之间不能直接通信，结果通过父角色传递
- **最多 3 级嵌套**：dispatch 支持的嵌套深度上限为 3 级（父 → 子 → 孙）

## 从 v0.x 升级指南

rolebox 经历了从 v0.1 到 v0.23 的快速迭代，其中部分版本引入了需要关注的变化。

### v0.15.x → v0.17.x：核心功能升级

这是功能最密集的升级窗口，新增了 LSP 集成（30+ 工具）、会话管理工具套件和 Hashline 编辑系统。升级后需注意：

- **opencode 版本要求提升至 ≥1.3.0**（原先 ≥1.0.0）
- **`@opencode-ai/plugin` 依赖更新至 `^1.3.0`**（新增 SDK 接口）
- 需确保 `package.json` 中的 `peerDependencies` 已更新

```bash
# 升级命令
npm install rolebox@latest
# 确认 opencode 版本
npx opencode --version  # 应 ≥1.3.0
```

### v0.12.0：状态存储迁移

v0.12.0 将状态存储从 `XDG_DATA_HOME` **迁移到项目本地 `.rolebox/` 目录**。如果你从 v0.11.x 或更早版本升级：

- 历史会话和调度状态**不会自动迁移**——旧数据保留在原位置
- 新会话和调度任务将写入 `.rolebox/` 目录
- 如需保留旧状态数据，手动复制 `~/.local/share/rolebox/` 的内容到项目 `.rolebox/state/` 目录

### v0.10.0：Dispatch 调度系统重写

v0.10.0 对 dispatch 子系统进行了全面重写（事件驱动、并发隔离、状态持久化 v2）：

- 旧的全局轮询模式被 `TaskWatchdogManager` 取代
- 引入了 per-model 并发隔离和背压队列
- 状态持久化使用新的 schema v3/v4——如果从更早版本升级，旧的 dispatch 状态文件不会被读取
- 建议升级后清空旧的状态目录：`rm -rf .rolebox/state/`（如果存在旧文件）

### v0.5.x 及更早版本：重大架构变更

- **v0.6.0**：引入 References 和 Collaboration Graph 系统
- **v0.10.0**：从简单 dispatch 到事件驱动架构
- **v0.15.0**：`|loop|` 语义重写——每轮循环（包括第一轮）在子工作线程中运行
- **v0.17.0**：LSP、会话工具、Hashline 编辑——需要更新 `peerDependencies`
- **v0.20.0**：微内核架构、记忆系统、TUI 仪表板——需要 Bun ≥1.1.0

> 来源：[CHANGELOG](https://github.com/EricMoin/rolebox/blob/main/CHANGELOG.md) — 完整的版本历史及各版本的破坏性变更说明。

::: tip 升级路径决策树

根据您当前使用的 rolebox 版本，参考以下升级路径：

- 从 **v0.5.x** 升级：需依次关注 v0.6.0（References 系统）→ v0.10.0（Dispatch 重写）→ v0.12.0（状态迁移）→ v0.15.0（Loop 重写）→ v0.17.0（依赖升级）→ v0.20.0（Bun 运行时）
- 从 **v0.10.x** 升级：需依次关注 v0.12.0（状态迁移）→ v0.15.0（Loop 重写）→ v0.17.0（依赖升级）→ v0.20.0（Bun 运行时）
- 从 **v0.17.x** 升级：需依次关注 v0.20.0（安装 Bun 运行时）→ v0.23.0（TUI 键盘交互变更为鼠标）
- 从 **v0.20.x** 升级：直接升级至最新版，注意 v0.23.0 中 TUI 键盘快捷键已变更为 `Ctrl+` 前缀

---

## 弃用时间线

以下功能已进入弃用路径或已被替代，在版本升级时需关注兼容性变更。

| 版本 | 弃用项 | 替代方案 | 状态 |
|------|--------|---------|------|
| v0.23.0 | TUI 键盘交互模式 | 鼠标交互（Ctrl+ 前缀快捷键） | 已移除（CHANGELOG.md:28） |
| v0.22.0 | OpencodeClient 会话接口 | ISessionClient 平台抽象层 | 已替换（CHANGELOG.md:62） |
| v0.15.0 | LoopManager 顺序状态机 | LoopCoordinator 推链调度 | 已替换（CHANGELOG.md:215） |
| v0.12.0 | XDG_DATA_HOME 状态存储 | 项目本地 .rolebox/ 目录 | 已迁移（CHANGELOG.md:302） |
| v0.10.0 | 全局轮询 Dispatch 模式 | TaskWatchdogManager 事件驱动 | 已替换（CHANGELOG.md:316） |

> 以上信息来源于 CHANGELOG.md。处于已替换或已迁移状态的功能在旧版本中仍保留，但后续版本不再维护。建议在升级时参考[破坏性变更摘要](#破坏性变更摘要)中的操作指引。

:::

## 下一步

- [已知限制](/03-Reference/limitations) — 完整的功能限制列表
- [子代理](/02-Guide/subagents) — 子代理层级与调度机制
- [调度配置](/03-Reference/dispatch-config) — 并发与预算控制
