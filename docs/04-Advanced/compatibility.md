---
title: 兼容性
description: rolebox 与 opencode / pi / dsh 的兼容性参考——平台能力矩阵、工具面、harness 版本约束、功能矩阵、运行时依赖与已知边界
---

# 兼容性（Compatibility）

本页回答「这个功能在我用的 harness 上能不能用、需要什么版本」。内容按维度组织：平台能力开关、工具面、harness 版本约束、功能引入版本、运行时依赖、操作系统支持与已知兼容边界。安装命令与目录布局见[平台与 Harness](/01-Overview/platform-harnesses)；破坏性变更与升级步骤见[迁移对照](/06-Appendix/migration)。

> 相关：[平台与 Harness](/01-Overview/platform-harnesses)｜[已知限制](/03-Reference/limitations)｜[CLI 参考](/03-Reference/cli)

## 快速核对

`rolebox status` 按平台注册表逐个报告 harness 的集成状态与同步落点，是核对本机兼容性的第一条命令：

```bash
rolebox status
```

```text
应看到（示例输出，随环境略有差异）：
Rolebox v1.9.0
  Configuration
    Config               <rolebox 配置目录>/config.json
    Registries           <注册中心列表>
  Installed Roles
    ✓ <角色名>  <版本>  (<注册中心>)  → synced
  OpenCode Integration
    Plugin               ✓ registered
    Sync target          ~/.config/opencode/rolebox
  pi Integration (not detected)
    Sync target          ~/.pi/agent/rolebox
  dsh Integration (not detected)
    Sync target          ~/.dsh/rolebox
```

只有 opencode 能报告「已注册/未注册」；pi 与 dsh 没有 rolebox 自己拥有的单一清单文件，因此只报告同步落点。

## 平台能力矩阵（Platform Capabilities）

rolebox 用一组**能力开关（PlatformCapabilities，宿主声明自己支持哪些操作的布尔集合）**描述宿主差异，同一份核心代码据此优雅降级，而不是为每个 harness 分叉逻辑。

| 能力开关 | opencode | pi | dsh | 含义 |
|---|---|---|---|---|
| `hasBackgroundTasks` | ✅ | ✅ | ❌ | 后台/异步任务调度 |
| `hasSessionFork` | ✅ | ❌ | ✅ | 会话分叉/分支 |
| `hasSessionCreate` | ✅ | ❌ | ✅ | 新建会话 |
| `hasSessionAbort` | ✅ | ✅ | ❌ | 中止会话 |
| `hasAgentFileSync` | ✅ | ❌ | ❌ | agent 文件注册 |
| `hasMultiStepTools` | ✅ | ✅ | ✅ | 多步工具执行 |
| `hasEventStream` | ✅ | ✅ | ✅ | 事件流 |
| `hasSessionStatus` | ✅ | ✅ | ✅ | 会话状态轮询 |
| `hasRoleSwitch` | ❌ | ✅ | ✅ | 会话内切换活动角色 |

**能力开关目前是「声明」而非「门禁」**：工具装配阶段并不读取这组值，因此能力矩阵用于解释行为差异，不能替代逐工具的可用性核对。

## 工具面（Tool Surface）

三个 harness 都消费同一套**规范工具集（canonical tools，跨 harness 共享的公共工具面）**，平台差异通过额外的工具注入实现。

### 共享工具面

| 工具组 | 工具 |
|---|---|
| Hashline 编辑 | `hashline_read` / `hashline_edit` |
| 记忆 | `memory_write` / `memory_recall` / `memory_list` |
| Web | `web_search` / `web_read` / `web_fetch` |
| 控制与终端 | `signal` / `interactive_terminal` |
| Asset 与引用 | `asset_search` / `asset_inspect` / `asset_validate` / `reference_search` |
| 会话（需要会话客户端） | `session_list` / `session_read` / `session_search` / `session_info` / `session_diff` / `session_fork` |
| 图编排（需要调度管理器或平台图工具集） | `graph_create` / `graph_add_node` / `graph_add_edge` / `graph_add_loop` / `graph_run` / `graph_status` / `graph_cancel` / `graph_approve` |

### harness 专属与编排工具

| 工具组 | opencode | pi | dsh |
|---|---|---|---|
| `memory_update` | ✅ | ✅ | ❌ 未装配 |
| `function_graph` / `skill_compose` / `context_assemble` | ✅ | ✅ | ❌ 未装配 |
| `lsp_*`（32 个语言服务器工具） | ✅ | ✅ | ❌ 未装配 |
| `asset_hot_reload` | ✅ | ❌ opencode 专属 | ❌ |
| `load_role_skill` | ❌ opencode 有原生 skill 工具 | ✅ pi 专属 | ❌ |
| `task_*` 兼容层 | ✅ | ✅ | ❌ 未装配 |
| `dispatch_*` | ❌ 禁用，编排图化 | ❌ 不注册 | ❌ 未装配 |
| `loop_*` | ❌ 禁用，由 `graph_add_loop` 取代 | ❌ 禁用 | ✅ 仍注册 |

`task_retry` 在装配 `task_*` 的两个平台上都被刻意扣留：它会绕过图引擎的预算与审批门。

### 引擎状态持久化差异

`graph_*` 引擎的持久化范围随 harness 而异：

| harness | 引擎状态 |
|---|---|
| opencode | **完全内存运行**：状态不写入 `.rolebox/state/engine-*.json`，没有跨会话恢复扫描，也不写 graph 事件日志；图的生命周期限定在创建它的进程内 |
| pi | 传入状态目录并接上启动恢复扫描与事件记录器，状态落在 `.rolebox/state` |
| dsh | 传入状态目录，状态落在 `.rolebox/state`；插件启动时另外执行 loop 状态恢复 |

## harness 版本约束

| harness | 声明位置 | 约束 |
|---|---|---|
| opencode | `package.json` 的 `engines.opencode` | `^1.0.0` |
| opencode | `package.json` 的 `peerDependencies["@opencode-ai/plugin"]` | `^1.3.0` |
| pi | `peerDependencies["@earendil-works/pi-coding-agent"]` | `>=0.70.0`（可选 peer） |
| dsh | `peerDependencies["@deepseek-ai/cordis"]` | `4.0.2`（可选 peer） |

早于 v1.0.0 的文档给出过按 rolebox 版本递增的 opencode 最低版本表（如 v0.17.x → opencode ≥1.3.0）。当前仓库只声明上表约束，旧阈值不再作为安装前置条件。

## 功能兼容矩阵（Feature Matrix）

下表列出各功能领域的引入版本与适用 harness。**适用 harness** 一列是重点：不默认「全部功能都属于 opencode」。

| 功能领域 | 引入版本 | 适用 harness | 说明 |
|---|---|---|---|
| 角色 YAML 系统 | v0.1.x（早于 CHANGELOG 记录） | 三种 | `role.yaml` 加载与解析 |
| Functions 函数系统 | v0.2.0 | 三种 | 用竖线包裹函数名激活（如 plan、execute） |
| CLI 工具链（init / list / search / update / registry / sync） | v0.4.0 | 三种（CLI 层，与 harness 无关） | citty |
| 子代理系统 | v0.5.1 | 三种 | 命名 `{parent}--{child}` |
| References 引用文档系统 | v0.6.0 | 三种 | 递归发现 `references/` |
| Dispatch 调度引擎（事件驱动） | v0.10.0 | 三种 | `TaskWatchdogManager`；dsh 声明 `hasBackgroundTasks: false` |
| Monitor 监控面板 | v0.11.0 | 三种（交互 TUI 为 opencode 专属） | — |
| Loop 循环系统 | v0.14.0 | 三种 | 有界循环组；硬上限参数为 `max_traversals` |
| LSP 集成（32 个工具） | v0.17.0 | opencode、pi | dsh 未装配 |
| 会话管理工具（6 个） | v0.17.0 | 三种 | 分叉能力：opencode ✅ / pi ❌ / dsh ✅ |
| Hashline 内容哈希编辑 | v0.17.0 | 三种 | 内容哈希锚点 + 文件版本守卫 |
| 模型重复预防 | v0.18.0 | 三种 | — |
| 扩展系统与自定义 Hook | v0.19.0 | opencode 完整、pi 非目标 | pi 运行轻量服务栈 |
| 错误恢复框架 | v0.19.0 | opencode 完整、pi 非目标 | pi 仅保留图引擎启动恢复 |
| 通知管理器 | v0.19.0 | 三种 | 多通道、静默时段 |
| 持久记忆系统（SQLite + FTS5） | v0.20.0 | 三种 | 双运行时驱动（Bun / Node） |
| 微内核架构与角色热重载 | v0.20.0 | opencode 完整、pi 非目标 | pi 运行轻量服务栈 |
| Token/成本预算管理 | v0.20.0 | 三种 | 图级与节点级预算 |
| TUI 仪表板（`rolebox monitor`） | v0.20.0 | opencode（交互 TUI） | 文本输出为 CLI 层 |
| 崩溃恢复 | v0.21.0 | 三种 | 引擎状态持久化范围随 harness 而异 |
| Asset 工具套件（search / inspect / validate） | v0.21.0 | 三种 | — |
| web_fetch / web_read（多后端渲染） | v0.22.0 | 三种 | Playwright / Crawlee 可选 |
| Signal 带外控制信号 | v0.22.0 | 三种 | 不嵌入文本内容 |
| 平台抽象层（`ISessionClient`） | v0.22.0 | 三种 | ports-and-adapters |
| 交互式终端工具 | v1.4.0 | 三种 | node-pty 可选，缺失时回退管道 |
| pi 扩展与 dsh 插件 | v1.2.0 | pi、dsh | 各自的宿主入口模块 |
| pi / dsh 作为 CLI 同步目标 | v1.3.0 | 三种 | `rolebox sync <target>` |
| 引擎 `<graph_state>` 提示块与 `graph:` 角色配置键 | v1.8.0 | 三种 | v2 引擎系统提示块 |
| dsh web 角色坞与监控面板 | v1.5.0 / v1.9.0 | dsh | cordis 插件 + 浏览器侧 bundle |

「pi 非目标」指热重载、扩展、恢复引擎与 TUI 是 pi 相对于 opencode 的显式缺口；完整清单见[已知限制](/03-Reference/limitations)。

## 运行时依赖

| 依赖 | 要求 | 说明 |
|---|---|---|
| 持久记忆（Bun 运行时） | `bun:sqlite` | 动态导入 |
| 持久记忆（Node 运行时） | `node:sqlite`，自 Node 22.5 起可用 | 动态导入；两条路径都不会在另一种运行时下于模块求值阶段崩溃 |
| 可选渲染后端 | `playwright` ≥1.40.0 或 `crawlee` ≥3.0.0 | web 工具的页面渲染 |
| 可选终端后端 | `node-pty` ≥1.0.0 | `interactive_terminal`；缺失时回退管道 |
| 构建与测试 | `bun run build`、`bun test` | 仓库开发用，与运行时部署无关 |

## 操作系统支持

| 平台 | 状态 | 说明 |
|---|---|---|
| macOS | 完整支持 | CI 矩阵覆盖 |
| Linux | 完整支持 | CI 矩阵覆盖 |
| Windows | 基本支持 | CI 矩阵覆盖；历史上有多轮 Windows 可移植性修复 |

CI 在 `ubuntu-latest` / `macos-latest` / `windows-latest` 三个 runner 上运行类型检查、构建与测试。少数依赖真实 `tar` 的安装测试在没有可用 `tar` 的宿主上会优雅跳过而不是让构建失败。Windows 的路径分隔符与符号链接行为仍可能与类 Unix 系统不同。

## 已知兼容边界

- **会话内角色切换**：opencode 不支持（`hasRoleSwitch: false`）；pi 与 dsh 支持（角色选择器与宿主路由）。
- **子代理嵌套**：基于文件系统的子代理支持递归嵌套，最大深度 3；子代理之间不能直接通信，所有协调经父角色进行。
- **无角色继承**：角色之间不支持继承关系，每个角色完全独立。
- **pi 的平台固有缺口**：热重载、扩展、恢复引擎与 TUI 在 pi 上为显式非目标——pi 运行轻量服务栈，而不是完整的微内核服务栈。

## 与 opencode 生态共存

rolebox 与 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 可以同时运行：角色出现在 agent 列表中，技能可由原生 skill 工具发现，两者无冲突。这条共存说明只适用于 opencode——pi 与 dsh 不使用 opencode 的 agent/skill 发现机制，而是各自走扩展与 cordis 插件注册。

## 破坏性变更与升级

本页不再重复破坏性变更清单与升级步骤：各版本的移除项、旧写法到新写法的对照，以及 v0.x 到 v1.9.0 的升级路径，统一见[迁移对照](/06-Appendix/migration)。
