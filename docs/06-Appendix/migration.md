---
title: 迁移对照
description: v0.x → v1.9.0 的破坏性变更清单与升级指南 — 声明式协作与终止子系统移除、dispatch 到 graph 的路径迁移、逐条旧写法与新写法对照
---

# 迁移对照（Migration）

本页回答一个问题：**把旧版本的 rolebox 升级到 v1.9.0，我需要改什么。** 内容分四部分：迁移的前提（没有自动迁移命令）、逐版本破坏性变更清单、`dispatch` → `graph` 的路径迁移，以及按起点版本排列的升级顺序。

> 相关：[协作图（已移除）](/02-Guide/collaboration-graph)｜[终止条件（已移除）](/04-Advanced/termination-conditions)｜[兼容性](/04-Advanced/compatibility)｜[CLI 参考](/03-Reference/cli)

## 迁移是配置改写，不是执行一条命令

rolebox 没有自动迁移入口，也没有把声明式配置转成命令式图文档的转换器。v1.9.0 的 14 个 CLI 子命令是 `init`、`install`、`uninstall`、`sync`、`list`、`search`、`update`、`registry`、`status`、`info`、`config`、`monitor`、`memory`、`checkpoint`——里面没有任何一个负责迁移。

升级动作全部落在你自己的文件上，共三类：

1. **删** —— 从 `role.yaml` 中删除已移除的块（`collaboration:` 及其 `termination` 字段）。
2. **改** —— 把多代理工作流从声明式改写为命令式 `graph_*` 调用（见「旧写法 → 新写法」）。
3. **对** —— 按破坏性变更清单处理运行时与依赖变化（状态目录、SQLite 驱动、目标 harness）。

> `migrate` 命令确实存在过：v1.0.0 引入，v1.8.0 随声明式子系统一并**已移除**。v1.9.0 不存在该子命令，也没有替代品。

## 破坏性变更清单（v0.x → v1.9.0）

| 版本 | 变更 | 所需操作 |
|---|---|---|
| v1.8.0 | 声明式协作与终止子系统移除 | 删除 `collaboration:` 块；多代理工作流改写为 `graph_*` |
| v1.0.0 | v1 图子系统退役 + 工具面整合 | 编排统一走 `graph_*`；面向模型的 `dispatch_*` / `loop_*` 退役，保留薄 `task_*` 兼容层；`function_state` 工具移除 |
| v0.24.0 | `task_*` → `dispatch_*` 工具重命名 | 旧名保留为弃用别名；该重命名随后被 v1.0.0 的工具面整合覆盖 |
| v0.23.0 | TUI 键盘交互移除 | 改用鼠标点击；快捷键迁移到 `Ctrl+` 前缀 |
| v0.20.0 | 持久记忆系统、微内核架构、TUI 引入 | 当时需要 Bun ≥ 1.1.0；v1.0.0 起记忆子系统改为双运行时 SQLite 驱动，不再强制 Bun |
| v0.17.0 | 会话工具套件、LSP 集成、Hashline 编辑引入 | 更新 peer 依赖（`@opencode-ai/plugin` 为 `^1.3.0`） |
| v0.15.0 | `\|loop\|` 语义重写 | 每轮循环（含第一轮）都在子工作线程中运行，主线程变为纯编排角色 |
| v0.12.0 | 状态存储迁移 | 状态目录从 `XDG_DATA_HOME` 变更为项目本地 `.rolebox/`；旧数据需手动迁移 |
| v0.10.0 | Dispatch 调度系统重写 | 全局轮询模式被 `TaskWatchdogManager` 取代；建议清空旧的 `.rolebox/state/` |

更细的版本历史见 [rolebox CHANGELOG](https://github.com/EricMoin/rolebox/blob/main/CHANGELOG.md)。

## v1.8.0：声明式协作与终止子系统移除

这是离 v1.9.0 最近的一次语义断裂。`role.yaml` 的 `collaboration:` 块（`topology` / `flow` / `agents` / `max_iterations` / `termination`）整体从 schema 中删除，同时删除的还有终止声明类型词汇表、`termination_conditions` 扩展点、`graph_add_loop` 的 `termination` 参数，以及移植过来的 `collaboration-*` 图模块与 v1 残留（含 v1 graph-session 运行时状态读取器、其 compaction 与 `monitor` 界面、四个示例协作角色）。

逐类删除清单见[协作图（已移除）](/02-Guide/collaboration-graph)。**没有任何自动转换器**：删除 `collaboration:` 块后按图文档手写；终止语义的现状见[终止条件（已移除）](/04-Advanced/termination-conditions)。

## v1.0.0：dispatch → graph 的路径迁移

v1.0.0 把多代理编排的入口从「面向模型的调度工具」收缩到命令式图引擎：

- **编排统一走 `graph_*`**：`graph_create` → `graph_add_node` / `graph_add_edge` → `graph_run` → `graph_status`。图节点是角色无关的 `{agent, prompt}` 元组。
- **v1 图子系统退役**：v1 执行子系统被移除，其语义先被移植进 `collaboration-*` 模块并以 `collaboration-{hash}.json` 路径持久化，这套模块又在 v1.8.0 被删除。
- **`dispatch_*` / `loop_*` 退役**：面向模型的裸调度工具与 checkpoint / budget / concurrency / query 套件一并退役，只保留一层薄的 `task_*` 兼容工具。
- **`function_state` 工具移除**：函数状态不再由独立工具查询，状态观察走 `graph_status`。

如果你从 v1.0 之前升级，这一步比 v1.8.0 影响更大——它是「编排入口换了」，而不只是「某个配置块没了」。

## 旧写法 → 新写法

| 旧写法（已移除或已退役） | 新写法 |
|---|---|
| `collaboration:` 块（`topology` / `flow` / `agents`） | 删除该块；用 `graph_create` + `graph_add_node` + `graph_add_edge` 搭出同一拓扑 |
| `collaboration.max_iterations` | `graph_add_loop` 的 `max_traversals`（硬上限，整数 ≥ 1） |
| `collaboration.termination` 的 `any_of` / `all_of` | `max_traversals` 硬上限 + `graph_status` 观测 + `graph_cancel` 终止 |
| `graph_add_loop` 的 `termination` 参数 | 只传 `nodes` + `max_traversals`；会话隔离模式用 `mode` |
| 面向模型的 `dispatch_*` / `loop_*` 工具 | `graph_*` 编排；需要调度自省时用薄的 `task_*` 兼容工具 |
| v1 图文档与 `collaboration-{hash}.json` 状态 | 命令式 `graph_*` 工具；引擎状态由引擎自己持久化 |
| `function_state` 工具 | 已移除；用 `graph_status` 观察节点状态 |
| `rolebox migrate` | 该子命令不存在；手工改写配置 |
| 状态目录 `XDG_DATA_HOME` | 项目本地 `.rolebox/`（旧数据需手动复制） |
| TUI 键盘快捷键 | 鼠标交互，快捷键加 `Ctrl+` 前缀 |

## 升级指南

按「语义断裂点」升级，而不是按版本号逐个平推：

- **从 v0.5.x 及更早**：v0.6.0（References 与协作图系统）→ v0.10.0（Dispatch 重写）→ v0.12.0（状态迁移）→ v0.15.0（`|loop|` 重写）→ v0.17.0（会话工具 / LSP / Hashline）→ v0.20.0（记忆系统、微内核、TUI）→ v1.0.0（图优先）→ v1.8.0（声明式协作移除）→ v1.9.0（跨 harness 对齐）。
- **从 v0.17.x 附近**：v0.20.0（记忆与 TUI）→ v0.23.0（TUI 鼠标化）→ v0.24.0（`task_*` → `dispatch_*` 重命名）→ v1.0.0（图优先，工具面再整合）→ v1.8.0（移除）→ v1.9.0。
- **从 v1.0 – v1.7**：只需处理 v1.8.0 的移除语义与 v1.9.0 的 harness 对齐；`pi` / `dsh` 作为同步目标自 v1.3.0 起可用。
- **从 v1.8.x**：无需迁移配置；v1.9.0 是 dsh web UI 与图门禁的修复版本。

每一步之后用 `rolebox sync <opencode|pi|dsh>` 重新部署角色，变更才在 harness 中生效。

## 弃用时间线

| 版本 | 弃用项 | 替代方案 | 状态 |
|---|---|---|---|
| v1.8.0 | 声明式协作与终止条件词汇 | 命令式 `graph_*` 图引擎 | 已移除 |
| v1.0.0 | v1 图子系统与面向模型的 `dispatch_*` / `loop_*` 工具 | v2 图引擎 + `task_*` 兼容层 | 已替换 |
| v0.23.0 | TUI 键盘交互模式 | 鼠标交互（`Ctrl+` 前缀快捷键） | 已移除 |
| v0.22.0 | `OpencodeClient` 会话接口 | `ISessionClient` 平台抽象层 | 已替换 |
| v0.15.0 | `LoopManager` 顺序状态机 | `LoopCoordinator` 推链调度 | 已替换 |
| v0.12.0 | `XDG_DATA_HOME` 状态存储 | 项目本地 `.rolebox/` 目录 | 已迁移 |
| v0.10.0 | 全局轮询 Dispatch 模式 | `TaskWatchdogManager` 事件驱动 | 已替换 |

## 常见错误

- **在 `role.yaml` 里保留 `collaboration:` 块**。v1.9.0 不再解析它，也不会给出迁移提示——它只是一个未知键。
- **升级后配置看起来「没生效」**。改了 `role.yaml` 但没跑 `rolebox sync <target>`；角色目录里的副本仍是旧的。
- **指望自动转换**。不存在把声明式工作流转成 `graph_*` 调用的工具，也不存在 `rolebox migrate`。
- **沿用旧的记忆数据库路径**。状态目录自 v0.12.0 起是项目本地 `.rolebox/`；记忆数据库由工作区路径推导，不会自动从 `XDG_DATA_HOME` 搬过来。

## 下一步

- [协作图（已移除）](/02-Guide/collaboration-graph) — 声明式协作图的移除范围与字段级迁移要点
- [终止条件（已移除）](/04-Advanced/termination-conditions) — 终止子系统的移除范围与仍生效的终止语义
- [图工作流](/02-Guide/graph-workflows) — 用 `graph_*` 工具编写现行多代理工作流
- [兼容性](/04-Advanced/compatibility) — 各 harness 的能力矩阵与运行时要求
