---
title: CLI 参考
description: rolebox CLI 参考 — init/install/uninstall/sync/list/search/update/registry/info/monitor/status 命令详解
---

# CLI 参考

> **相关文档：** [调度配置](/03-Reference/dispatch-config) — dispatch 块配置 | [注册中心](/03-Reference/registry) — 角色注册表管理 | [工具目录](/03-Reference/tool-catalog) — 内置工具列表

rolebox 提供了命令行工具，用于从远程注册中心安装和管理 AI Agent 角色。

## 基本用法

```bash
npx rolebox <command> [options]
```

如果已全局安装：

```bash
rolebox <command> [options]
```

::: tip 全局安装建议
推荐使用 `npm install -g rolebox` 全局安装。全局安装后，`rolebox` 命令可直接在终端中使用，无需 `npx` 前缀。这对于频繁使用 `rolebox init`、`rolebox sync` 等命令的开发工作流尤为便利。同步到 opencode 前，CLI 独立于 opencode 运行。
:::

## 命令一览

### `init [name]`

交互式脚手架，创建一个可直接使用的角色目录结构。

```bash
rolebox init                          # 交互式向导
rolebox init my-role                  # 在 ./my-role 目录创建角色
rolebox init my-role -y               # 跳过交互，使用默认值
rolebox init my-role -t subagents     # 使用指定模板
```

**可选模板：**

| 模板 | 说明 |
|---|---|
| `minimal` | 仅包含 `role.yaml` 和 `PROMPT.md` |
| `standard` | 包含 skills、functions、references 目录的完整角色 |
| `subagents` | 带子代理脚手架的父角色 |
| `collaboration` | 带协作图拓扑的多代理角色 |

### `install <role>[@version]`

从注册中心安装一个角色。角色标识符支持多种格式：

- `rolebox install software-architect` — 从默认注册中心安装最新版本
- `rolebox install software-architect@1.0.0` — 安装指定版本
- `rolebox install my-registry:custom-role` — 从指定注册中心安装
- `rolebox install my-registry:role@2.0.0` — 从指定注册中心安装指定版本

安装后，运行 `rolebox sync opencode` 部署角色。

### `uninstall <role>`

卸载已安装的角色并清理相关的符号链接。

```bash
rolebox uninstall software-architect
```

### `sync <target>`

将已安装的角色部署到目标工具的配置目录。目前仅支持 `opencode`。

```bash
rolebox sync opencode
```

这会创建符号链接：`~/.config/opencode/rolebox/{roleId}` → `~/.local/share/rolebox/roles/{registry}/{roleId}@{version}/`

如果目标路径已存在手动创建的角色（普通目录），则会保留并输出警告。

### `list`

列出所有已安装的角色，显示版本和来源注册中心。

```bash
rolebox list
rolebox list --json   # JSON 格式输出，便于脚本处理
```

### `search [query]`

在所有已配置的注册中心中搜索可用角色。

```bash
rolebox search               # 列出所有可用角色
rolebox search react         # 搜索匹配 "react" 的角色
rolebox search --no-cache    # 绕过注册中心缓存
```

匹配范围包括角色名称、描述和标签（不区分大小写）。

### `update [role]`

将已安装的角色更新到注册中心的最新版本。

```bash
rolebox update                         # 更新所有已安装的角色
rolebox update software-architect      # 更新指定角色
rolebox update --no-cache              # 绕过注册中心缓存
```

### `registry <subcommand>`

管理注册中心源。

```bash
rolebox registry list                              # 显示所有已配置的注册中心
rolebox registry add https://github.com/user/my-roles  # 添加注册中心
rolebox registry remove my-roles                   # 移除注册中心（不能移除默认注册中心）
```

### `info <role>`

显示已安装角色的详细信息，包括模型配置、技能、函数、子代理、协作图和同步状态。

```bash
rolebox info software-architect
rolebox info software-architect --json    # JSON 格式输出
rolebox info software-architect --check   # 验证完整性哈希
```

### `monitor`

显示当前项目的运行时调度活动、激活的函数和代理工作流。数据来源为项目本地 `.rolebox/state/` 目录中的持久化状态文件。支持 TUI 仪表盘（基于 Solid.js + OpenTU），提供实时更新的状态面板、任务表格和函数状态追踪。

```bash
rolebox monitor                              # TUI 仪表盘，显示活跃任务和函数快照
rolebox monitor --all                        # 包括已完成/已取消的任务
rolebox monitor --json                       # JSON 格式输出
rolebox monitor --no-status                  # 隐藏状态概览面板
rolebox monitor --watch                      # 实时刷新仪表盘（默认 1 秒间隔）
rolebox monitor --watch --interval 5000      # 自定义刷新间隔
rolebox monitor --watch --json               # NDJSON 输出（每个间隔一行 JSON）
```

TUI 仪表盘显示内容：活跃的循环任务、图工作流、调度摘要（队列深度、并发槽位）和并发池健康状态。使用 `--no-status` 可以隐藏概览面板。

### `status`

显示 rolebox 安装的整体健康状态：版本、注册中心、已安装角色的同步状态、opencode 插件注册以及技能符号链接完整性。

```bash
rolebox status
rolebox status --check-updates   # 同时检查注册中心中的更新版本
rolebox status --json            # JSON 格式输出，便于脚本处理
```

### `memory <subcommand>`

管理 rolebox 持久化记忆存储。记忆数据存储在项目本地的 SQLite 数据库中（`MemoryStore`），支持跨会话保持上下文。

```bash
rolebox memory list                          # 列出记忆条目（默认最近 20 条）
rolebox memory list --scope workspace        # 仅显示工作空间范围的记忆
rolebox memory list --category decision      # 按类别过滤
rolebox memory list --sort relevance         # 按相关性排序
rolebox memory show <id>                     # 查看单条记忆的完整内容
rolebox memory search <query>                # 全文搜索记忆
rolebox memory search <query> --scope role   # 仅搜索角色私有记忆
rolebox memory delete <id>                   # 删除单条记忆（交互确认）
rolebox memory delete <id> --yes             # 跳过确认直接删除
rolebox memory export                        # 导出全部记忆为 Markdown（标准输出）
rolebox memory export --format json          # 导出为 JSON 格式
rolebox memory export --output memories.md   # 写入文件
rolebox memory clean                         # 清理过期记忆（干运行，仅列出候选）
rolebox memory clean --yes                   # 执行删除过期的未访问记忆
rolebox memory clean --max-age-days 90       # 指定未访问期限（默认 180 天）
rolebox memory clean --min-relevance high    # 仅清理低相关性的记忆
rolebox memory stats                         # 显示记忆存储统计信息
```

**子命令：**

| 子命令 | 说明 |
|---|---|
| `list` | 列出记忆条目，支持 `--scope`（workspace/role/both）、`--category`、`--limit`（默认 20）、`--sort`（recent/relevance/accessed） |
| `show` | 显示单条记忆的完整元数据和内容 |
| `search` | 全文搜索，支持 `--scope` 和 `--limit`（默认 10） |
| `delete` | 删除单条记忆，支持 `--yes` 跳过确认 |
| `export` | 导出全部记忆为 Markdown 或 JSON（`--format`），支持 `--output` 写入文件 |
| `clean` | 清理长时间未访问的过期记忆，支持 `--max-age-days`（默认 180）、`--min-relevance`（high/medium/low）、`--yes`（默认干运行） |
| `stats` | 显示记忆存储统计信息 |

### `checkpoint <subcommand>`

管理调度检查点（checkpoint）。检查点在任务执行过程中持久化阶段状态，失败重试时可自动注入上下文，避免重复工作。自 v0.23.0 起可用。

```bash
rolebox checkpoint list                       # 列出所有活跃检查点
rolebox checkpoint list --task <taskId>       # 按任务 ID 过滤
rolebox checkpoint clean                      # 清理已过期的检查点
rolebox checkpoint clean --all                # 清理所有检查点（需要交互确认）
```

**子命令：**

| 子命令 | 说明 |
|---|---|
| `list` | 列出活跃检查点，支持 `--task` 过滤。显示列：任务 ID、检查点 ID、阶段、已完成/剩余项数、创建时间和 TTL |
| `clean` | 清理过期检查点（默认使用 `DEFAULT_CHECKPOINT_TTL_MS`），`--all` 清理全部（需交互确认） |

### `config <role> [options]`

交互式配置角色的模型分配。支持为根角色和子代理分别或批量指定模型。自 v0.23.0 起支持项目级配置。

```bash
rolebox config my-role                          # 交互式向导 — 为角色及其子代理选择或输入模型
rolebox config my-role --model provider/gpt-4   # 非交互模式 — 批量设定模型
rolebox config my-role --model provider/gpt-4 --primary-only  # 仅更新根角色的 role.yaml
```

交互模式下会依次：扫描可用模型、为根角色选择模型、为子代理选择"统一应用"或"逐个配置"模式，最终汇总写回 `role.yaml`。

非交互模式下使用 `--model` 指定模型标识符，使用 `--primary-only` 限制仅更新根角色。

## 常用工作流组合

以下三个工作流覆盖了 rolebox CLI 的典型使用场景，将单条命令串联为完整的操作流程。

### 工作流 1：安装新角色

从注册中心发现、安装并部署一个角色到 opencode：

```bash
# 1. 搜索可用角色
rolebox search react

# 2. 安装指定角色（支持 @version 锁定版本）
rolebox install react-ui

# 3. 同步到 opencode 配置目录
rolebox sync opencode

# 4. 验证角色配置和完整性
rolebox info react-ui --check
```

此工作流适用于首次部署角色或从社区注册中心引入新代理。

### 工作流 2：发布角色到注册中心

从零创建角色、本地编辑后推送到注册中心：

```bash
# 1. 脚手架生成角色目录
rolebox init my-role -t standard

# 2. 编辑 role.yaml、skills、functions 等文件（手动操作）

# 3. 将本地目录添加为注册中心源
rolebox registry add https://github.com/user/my-roles

# 4. 使用 git 打 tag 发布版本
git tag v1.0.0 && git push origin v1.0.0
```

::: tip
发布工作流依赖 Git 标签作为版本标识。注册中心通过扫描仓库的语义化版本标签来索引可用角色。
:::

### 工作流 3：诊断问题

当角色行为异常或系统状态不明确时，按以下顺序排查：

```bash
# 1. 检查全局安装状态和同步完整性
rolebox status

# 2. 深入检查目标角色的配置和完整性哈希
rolebox info my-role --check

# 3. 查看运行时调度活动和函数状态（TUI 仪表盘）
rolebox monitor
```

使用 `rolebox status --json` 可将状态导出为结构化数据，便于脚本集成到告警或 CI 流水线。

## CLI 退出码参考

rolebox CLI 使用标准的 Unix 进程退出码约定。CLI 基于 `citty` 的 `runMain` 运行（`src/cli/main.ts:40`），未定义自定义退出码体系。

| 退出码 | 含义 | 说明 |
|--------|------|------|
| `0` | 成功 | 命令正常完成 |
| `1` | 一般错误 | 参数错误、运行时异常、子命令失败等（如 `info.ts:223`、`config.ts:289` 设置 `process.exitCode = 1`） |
| `130` | SIGINT | 用户按下 Ctrl+C 中断进程（`src/core/composition.ts:92`） |
| `143` | SIGTERM | 进程收到终止信号（`src/core/composition.ts:93`） |

::: tip 退出码使用建议
在 CI 或脚本中调用 rolebox CLI 时，建议检查 `$?`（退出码）。非零退出码表示命令未按预期完成，应中止后续依赖步骤。
:::

## 配置文件

CLI 的状态存储在以下两个文件中：

- `~/.config/rolebox/config.yaml` — 注册中心配置（默认注册中心：oh-my-role）
- `~/.config/rolebox/rolebox.lock` — 已安装角色清单，包含版本和完整性追踪

## 下一步

- [调度配置](./dispatch-config) — 了解如何通过 role.yaml 和环境变量控制子代理调度行为
- [注册中心](./registry) — 了解如何创建和管理角色注册中心
