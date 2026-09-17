---
title: CLI 参考
description: rolebox 命令行参考 — 14 个子命令的摘要、用法、常用参数与预期输出，以及退出码与状态文件
---

# CLI 参考（Command-Line Interface）

rolebox 的命令行界面（Command-Line Interface，CLI）负责角色的安装、部署与诊断。本页逐个记录 14 个子命令的用法、常用参数与预期输出，末尾给出退出码与状态文件位置。

> 相关：[注册中心](/03-Reference/registry) — 角色从哪个仓库来｜[平台与 Harness](/01-Overview/platform-harnesses) — sync 三个目标的目录规则｜[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install) — 从零走一遍安装、初始化与同步

## 调用方式

```bash
npm install -g rolebox     # 全局安装
rolebox list               # 确认当前状态
```

```text
应看到（rolebox list；尚未安装任何角色时）：
No roles installed. Run `rolebox install <role>` to get started.
```

未全局安装时改用 `npx rolebox <command>`；`<command>` 换成 14 个子命令中的任意一个，每个都支持 `--help`。

## 命令一览

CLI 共注册 14 个子命令，下面逐个给出摘要、用法、常用参数与预期输出：`init`、`install`、`uninstall`、`sync`、`list`、`search`、`update`、`registry`、`status`、`info`、`config`、`monitor`、`memory`、`checkpoint`。

## 子命令

### `init [name]`

生成角色目录的脚手架；模板决定生成哪些文件。

```bash
rolebox init my-role -y               # 默认模板 standard，跳过交互
rolebox init my-role -t subagents     # 指定模板
rolebox init                          # 交互式向导
```

| 参数 | 说明 |
|---|---|
| `[name]` | 角色目录名；省略时在当前目录生成 |
| `-y`, `--yes` | 跳过交互，使用默认值 |
| `-t`, `--template` | `minimal` / `standard` / `subagents`，默认 `standard` |

```text
应看到：
✓ Created standard role at /Users/you/lab/my-role
Run `rolebox sync opencode` to deploy
```

备注：`standard` 生成 `role.yaml`、`PROMPT.md`、`skills/README.md` 与 `functions/README.md`；`subagents` 另外生成 `subagents/` 与 `references/README.md`。目标目录已有 `role.yaml` 时报错并以退出码 1 结束。

### `install [role]`

从注册中心安装一个角色；标识符支持 `role`、`role@version`、`registry:role`、`registry:role@version` 四种写法。省略角色名时进入交互式选择。

```bash
rolebox install software-architecture                  # 最新版本
rolebox install software-architecture@2.2.0            # 指定版本
rolebox install my-registry:my-role                    # 指定注册中心
```

| 参数 | 说明 |
|---|---|
| `[role]` | 角色标识符；省略时交互选择 |
| `-q`, `--quiet` | 抑制非错误输出 |
| `-v`, `--verbose` | 打印每个阶段的细节 |
| `--no-progress` | 禁用进度条，降级为行式日志 |

```text
应看到：
✓ Installed software-architecture@2.2.0 from oh-my-role
Run `rolebox sync opencode` to deploy
```

备注：安装是原子的——先下载到临时目录、校验完整性摘要（注册中心清单声明了 `integrity` 时必须匹配），再替换目标；任一环节失败都会回滚并保留原版本。已安装同一版本时输出 `Role "x@2.2.0" is already installed from oh-my-role` 并直接结束。进度按 resolving → downloading → verifying → extracting → installing → done 六个阶段推进，非 TTY、`CI`、`TERM=dumb` 或传入 `--no-progress` 时降级为行式日志。安装后还需 `rolebox sync` 才会部署到 harness。

### `uninstall [role]`

卸载一个已安装的角色，并清理它在各目标目录里留下的符号链接。

```bash
rolebox uninstall software-architecture
```

```text
应看到：
✓ Uninstalled software-architecture@2.2.0
```

备注：无额外选项；省略角色名时进入交互式选择。角色不在 lock 文件中时报错并以退出码 1 结束。

### `sync [target]`

把已安装角色部署到目标 harness。角色本体只有一份共享源，`sync` 在目标目录建立指向它的符号链接。

```bash
rolebox sync              # 默认目标 opencode
rolebox sync dsh
rolebox sync opencode --relink
```

| 参数 | 说明 |
|---|---|
| `[target]` | `opencode` / `pi` / `dsh`，默认 `opencode` |
| `--relink` | 把目标路径上的普通目录备份后替换为符号链接 |

目标与链接位置：

| 目标 | 链接位置 |
|---|---|
| `opencode` | `~/.config/opencode/rolebox/{roleId}` |
| `pi` | `$PI_CODING_AGENT_DIR/rolebox/{roleId}`（未设置时为 `~/.pi/agent/rolebox/{roleId}`） |
| `dsh` | `$DSH_HOME/rolebox/{roleId}`（未设置时为 `~/.dsh/rolebox/{roleId}`） |

```text
应看到：
Synced 1 roles to opencode
```

共享源位于 `~/.local/share/rolebox/roles/{registry}/{roleId}@{version}/`。目标路径上若是手动创建的普通目录，默认只警告并跳过；`--relink` 会先把它复制成同目录下的 `<role>.backup-<时间戳>`，再替换为符号链接，因此复制失败时原目录保持原样。

### `list`

列出 lock 文件中的已安装角色及其版本与来源注册中心。

```bash
rolebox list
rolebox list --json     # 结构化输出，便于脚本处理
```

参数：`--json` 以 JSON 输出角色数组。

```text
应看到：
Installed roles:
  software-architecture  2.2.0  (oh-my-role)
```

### `search [query]`

在所有已配置的注册中心里搜索角色，匹配范围是角色名、描述与标签（不区分大小写）。省略关键词时列出注册中心中的全部角色。

```bash
rolebox search architect
```

| 参数 | 说明 |
|---|---|
| `[query]` | 关键词；省略时不过滤 |
| `--no-cache` | 绕过注册中心清单缓存 |

```text
应看到：
Results from oh-my-role:
  software-architecture    2.2.0  Software architecture orchestrator — coordinates specialist subagents ...
```

备注：注册中心清单默认缓存 5 分钟。无匹配时输出 `No roles matching 'architect'. Try a different search term.`；所有注册中心都取不到清单时输出 `No roles found in any registry.`。

### `update [role]`

把已安装角色更新到注册中心里的最新版本；省略角色名时更新全部。

```bash
rolebox update                  # 更新全部已安装角色
rolebox update teacher          # 只更新一个角色
rolebox update --no-cache       # 绕过注册中心缓存
```

| 参数 | 说明 |
|---|---|
| `[role]` | 只更新指定角色；省略时更新全部 |
| `--no-cache` | 绕过注册中心清单缓存 |
| `-q`, `--quiet` | 抑制非错误输出 |
| `--no-progress` | 禁用进度条（`-v` / `--verbose` 同 `install`） |

```text
应看到：
✓ Updated teacher from 0.9.0 to 1.0.0
Updated 1 roles.
Run `rolebox sync opencode` to deploy changes
```

备注：更新与安装使用同一套原子替换与完整性校验；失败时保留此前已安装的版本，并逐个角色给出警告。全部已是最新时只打印一行汇总，不提示同步。

### `registry`

管理注册中心源。子命令为 `list`、`add`、`remove`；不带子命令时等同 `list`。

```bash
rolebox registry add https://github.com/my-org/my-registry
rolebox registry remove my-registry
```

| 子命令 | 说明 |
|---|---|
| `list` | 列出全部注册中心，默认项带 `(default)` 标记 |
| `add <url>` | 添加一个 GitHub 仓库为注册中心；注册中心名取仓库名，添加前先拉取清单校验 |
| `remove <name>` | 移除注册中心；默认注册中心不可移除 |

```text
应看到（rolebox registry list）：
Registries:
  oh-my-role    https://github.com/EricMoin/oh-my-role (default)
```

备注：`add` 只接受 `https://github.com/owner/repo` 或 `git@github.com:owner/repo.git` 两种 URL 写法，其余报 `Invalid GitHub URL`。移除后若仍有角色来自该注册中心，会提示先卸载它们。清单格式与发布流程见[注册中心](/03-Reference/registry)。

### `status`

打印一份整体状态报告：版本、配置文件位置、注册中心、每个已安装角色在各目标上的部署状态，以及各 harness 的集成情况。

```bash
rolebox status
rolebox status --check-updates    # 同时查询注册中心里的新版本
rolebox status --json             # 结构化输出
```

参数：`-u` / `--check-updates` 查询并标注可用的新版本；`--json` 以 JSON 输出同样的字段。

```text
应看到（节选）：
Rolebox v1.9.0

Installed Roles
  ✓ software-architecture  2.2.0    (oh-my-role)  → synced

OpenCode Integration
  Sync target:   ~/.config/opencode/rolebox
  Synced:        1/1 roles
```

备注：报告末尾用提示行给出下一步命令，例如未同步时提示 `rolebox sync opencode`、opencode 未注册插件时提示把它加进配置。

### `info [role]`

显示一个已安装角色的详情：元数据与安装路径、模型配置、技能与函数、子代理，以及各目标的部署状态。

```bash
rolebox info teacher
rolebox info teacher --check    # 校验完整性哈希
rolebox info teacher --json     # 结构化输出
```

| 参数 | 说明 |
|---|---|
| `[role]` | 角色名；省略时交互选择 |
| `--check` | 校验安装目录的完整性哈希 |
| `--json` | 以 JSON 输出；必须显式给出角色名 |

```text
应看到（节选）：
teacher

Details
  Version:      1.0.0
  Registry:     oh-my-role
  Path:         ~/.local/share/rolebox/roles/oh-my-role/teacher@1.0.0

Sync
  ✓ OpenCode  Symlinked to ~/.config/opencode/rolebox/teacher
```

备注：`--check` 失败时打印 expected / actual 两个摘要并以退出码 1 结束；`--json` 若省略角色名会直接报错，以保证管道里的输出是纯 JSON。

### `config [role]`

为一个已同步的角色（及其子代理）选择模型，并把结果写回对应的 `role.yaml`。

```bash
rolebox config teacher                                    # 交互式向导
rolebox config teacher -m provider/model                  # 非交互：批量设定模型
rolebox config teacher -t dsh -m provider/model           # 指定目标
```

| 参数 | 说明 |
|---|---|
| `[role]` | 角色名；该角色必须已同步到目标 |
| `-m`, `--model` | 非交互模式下的模型 ID |
| `-p`, `--primary-only` | 只更新根角色的 `role.yaml` |
| `-t`, `--target` | `opencode` / `pi` / `dsh`，默认 `opencode` |

```text
应看到（第二段的路径随运行目录而变）：
Updated 1 role.yaml file(s) to model "provider/model":
  teacher (<运行目录到 role.yaml 的相对路径>): (none) → provider/model
```

备注：交互模式需要 TTY，非 TTY 下必须传 `--model`。角色没有同步到目标时以退出码 1 结束，并指出它同步到了哪个目标。

### `monitor`

读取项目本地 `.rolebox/state/` 中的运行时状态，显示活跃任务、激活的函数、循环与图工作流。

```bash
rolebox monitor                      # 一次性快照
rolebox monitor --watch              # 实时刷新（默认 1000 毫秒）
rolebox monitor --all --json         # 含已完成 / 已取消任务的 JSON
rolebox monitor --export json --output snapshot.json
```

| 参数 | 说明 |
|---|---|
| `-a`, `--all` | 包含已完成 / 已取消的任务 |
| `--json` | JSON 输出；配合 `--watch` 时是 NDJSON |
| `-w`, `--watch` | 实时刷新仪表盘 |
| `-i`, `--interval <ms>` | 刷新间隔，默认 1000，最小 500 |
| `--task-id <id>` | 只看某个任务的完整详情 |
| `--export <fmt>`, `--output <file>` | 导出 `json` / `prometheus` / `summary`，可写入文件 |

```text
应看到（--json 的节选结构，无活跃调度时）：
{
  "projectDir": "/path/to/project",
  "tasks": [],
  "activeFunctions": [],
  "graphSessions": [],
  "dispatchSummary": { "pending": 0, "running": 0, "completed": 0, "error": 0, "cancelled": 0 }
}
```

备注：TUI 的 Graphs 面板直接读取图引擎的持久化状态与事件日志，展示每个图的阶段、节点计数、累计预算与前沿节点。完整参数见 `rolebox monitor --help`。

### `memory`

管理项目本地的持久记忆库（SQLite），让代理跨会话保留上下文。子命令为 `list`、`show`、`search`、`delete`、`export`、`clean`、`stats`。

```bash
rolebox memory list                        # 最近 20 条
rolebox memory search "构建命令"            # 全文搜索
rolebox memory stats                       # 存储统计
rolebox memory clean --max-age-days 90 --yes
```

| 子命令 | 说明 |
|---|---|
| `list` | 列出记忆；`--scope`（workspace / role / both，默认 both）、`--category`、`--limit`（默认 20）、`--sort`（recent / relevance / accessed） |
| `show <id>` | 显示单条记忆的完整内容 |
| `search <query>` | 全文搜索；`--scope`、`--limit`（默认 10） |
| `delete <id>` | 删除一条记忆；`--yes` 跳过确认 |
| `export` | 导出为 Markdown 或 JSON（`--format`），`--output` 写入文件 |
| `clean` | 清理长期未访问的记忆；`--max-age-days`（默认 180）、`--min-relevance`、`--yes`；不带 `--yes` 时是干运行 |
| `stats` | 统计总数，并按 scope / category / relevance 分组 |

```text
应看到（尚未写入任何记忆时）：
No memory entries found.
```

备注：`list` 有数据时打印 ID / Title / Category / Relevance / Updated 五列。`delete` 在非 TTY 环境会拒绝交互确认并要求改用 `--yes`，不会阻塞等待输入。

### `checkpoint`

管理调度检查点：任务执行过程中持久化的阶段状态，失败重试时可自动注入，避免重复工作。子命令为 `list` 与 `clean`。

```bash
rolebox checkpoint list                 # 列出所有活跃检查点
rolebox checkpoint clean                # 清理过期检查点
rolebox checkpoint clean --all          # 清理全部（需确认）
```

| 子命令 | 说明 |
|---|---|
| `list` | 列出活跃检查点；`--task` 过滤。列为任务 ID、检查点 ID、阶段、已完成 / 剩余、创建时间与过期时间 |
| `clean` | 清理过期检查点；`--all` 连未过期的也清理 |

```text
应看到（尚无检查点时）：
No checkpoint directory found. No checkpoints exist.
```

备注：检查点数据同样位于项目的 `.rolebox/state/` 下，默认按 TTL 判定过期。

## 退出码

CLI 沿用标准 Unix 退出码约定；在 CI 或脚本中检查 `$?`，非零即中止后续依赖步骤。

| 退出码 | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 一般错误：参数错误、运行时异常、子命令失败 |
| `130` | 用户按 Ctrl+C 中断（SIGINT） |
| `143` | 进程收到终止信号（SIGTERM） |

## 状态文件

| 路径 | 内容 |
|---|---|
| `~/.config/rolebox/config.yaml` | 注册中心列表（默认 oh-my-role） |
| `~/.config/rolebox/rolebox.lock` | 已安装角色清单：版本、来源注册中心、安装时间与完整性摘要 |
| `~/.local/share/rolebox/roles/` | 角色本体的共享源目录，`sync` 的符号链接都指向它 |
| `.rolebox/state/`（项目本地） | `monitor` 与 `checkpoint` 读取的运行时状态 |

`ROLEBOX_CONFIG_DIR` 与 `ROLEBOX_DATA_DIR` 可分别覆盖前两处所在目录；`XDG_CONFIG_HOME` 与 `XDG_DATA_HOME` 也会被尊重。

