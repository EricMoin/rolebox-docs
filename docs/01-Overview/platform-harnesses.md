---
title: 平台与 Harness
description: rolebox 支持的三个 harness（opencode / pi / dsh）——安装命令、四类目录、环境变量覆盖、目录解析规则与宿主集成差异
---

# 平台与 Harness（Platform Harnesses）

rolebox 不绑定单一宿主：同一套角色、技能、函数与命令式 `graph_*` 图编排可以部署到 opencode、pi、dsh 三个 **harness（宿主工具，承载 rolebox 运行的 agent 运行时）**。本页是安装与目录信息的唯一权威页；平台能力开关、工具面与版本约束见[兼容性](/04-Advanced/compatibility)。

> 前置：[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)｜相关：[目录结构](/01-Overview/directory-structure)、[CLI 参考](/03-Reference/cli)、[已知限制](/03-Reference/limitations)

## 支持矩阵

| Harness | 安装命令 | 配置目录（configDir） | 角色目录（roleboxDir） | 技能目录（skillsDir） | agent 目录（agentsDir） | 环境变量覆盖 |
|---|---|---|---|---|---|---|
| opencode | `cd ~/.config/opencode && npm install rolebox` | `~/.config/opencode` | `{configDir}/rolebox` | `{configDir}/skills` | `~/.claude/agents` | `XDG_CONFIG_HOME` |
| pi | `pi install npm:rolebox` | `~/.pi/agent` | `{configDir}/rolebox` | `{configDir}/skills` | `{configDir}/skills` | `PI_CODING_AGENT_DIR` |
| dsh | `dsh plugin --profile <name> add rolebox` | `~/.dsh` | `{configDir}/rolebox` | `{configDir}/skills` | `{configDir}/skills` | `DSH_HOME` |

- pi 与 dsh 的环境变量为空字符串或全空白时**视同未设置**；opencode 的 `XDG_CONFIG_HOME` 为空时回退默认目录。
- 角色目录一列是全局默认值：当前工作目录下存在 `rolebox/` 时，它优先于该全局目录。
- agent 目录是宿主存放 agent 定义文件的位置。opencode 使用独立的 `~/.claude/agents`；pi 与 dsh 没有原生 agents 目录，角色文件与技能同放在技能目录下。

## 最小示例

以 opencode 为例，从安装到部署一个角色：

```bash
cd ~/.config/opencode && npm install rolebox
mkdir -p ~/.config/opencode/rolebox && cd ~/.config/opencode/rolebox
rolebox init my-agent -y
rolebox sync opencode
```

```text
应看到：
✓ Created standard role at /Users/<你>/.config/opencode/rolebox/my-agent
Run `rolebox sync opencode` to deploy
Synced 1 roles to opencode
```

`init` 的第二行提示是固定文案（无论最终同步到哪个 harness），部署目标始终以 `rolebox sync <target>` 为准。

## 目录解析规则

解析分两层：**宿主目录**（上表，由 harness 决定）与 **rolebox 自己的配置与数据目录**（独立于 harness）。

### 当前工作目录优先

在每一个 harness 上，解析角色目录都是一个两分支回退——当前工作目录下有 `rolebox/` 就用它，否则用 `{configDir}/rolebox`：

```text
resolveRoleboxDirectories({ workingDir = 当前工作目录, platformId })
        │
        ├── 存在 {workingDir}/rolebox ──▶ roleboxDir = {workingDir}/rolebox
        │
        └── 不存在 ────────────────────▶ roleboxDir = {configDir}/rolebox
```

全局技能目录不参与这次选择：无论角色目录落在哪里，它始终是注册表解析出的 `{configDir}/skills`。平台标识省略或未知时宽松回退到 opencode。

### rolebox 自身的配置与数据目录

上表的 `configDir` 是 **harness 的**配置目录；rolebox 自己的配置根目录与数据目录独立于 harness，由环境变量与操作系统决定。从注册中心安装的角色落在数据目录下的 `roles/`。

| 目录 | 优先级（从高到低） |
|---|---|
| 配置目录 | `ROLEBOX_CONFIG_DIR` → `XDG_CONFIG_HOME/rolebox`（所有平台，含 Windows）→ `%APPDATA%/rolebox`（Windows）→ `~/.config/rolebox`（macOS 与 Unix） |
| 数据目录 | `ROLEBOX_DATA_DIR` → `XDG_DATA_HOME/rolebox`（所有平台，含 Windows）→ `%LOCALAPPDATA%/rolebox`（Windows）→ `~/.local/share/rolebox`（macOS 与 Unix） |

macOS 刻意对齐 XDG 风格布局（`~/.config`、`~/.local/share`），不使用 `~/Library/Application Support`：这是为了让既有安装不因迁移而丢失数据。

## opencode

默认宿主，也是三个 harness 中唯一能从单一文件检测「rolebox 是否已注册」的宿主。

```bash
cd ~/.config/opencode && npm install rolebox
```

```text
应看到：npm 把 rolebox 装入 ~/.config/opencode/node_modules 并更新 package.json 的依赖记录，无报错。
```

安装后把 `rolebox` 加入 `opencode.jsonc` 的 `plugin` 数组，再重启 harness：

```jsonc
// ~/.config/opencode/opencode.jsonc
{ "plugin": ["rolebox"] }
```

| 项目 | 值 |
|---|---|
| 配置目录 | `~/.config/opencode`；`XDG_CONFIG_HOME` 非空时改为 `{XDG_CONFIG_HOME}/opencode` |
| 角色目录 | `{configDir}/rolebox`，当前工作目录下的 `rolebox/` 优先 |
| 技能目录 | `{configDir}/skills` |
| agent 目录 | `~/.claude/agents`——opencode 的 agent 定义文件写在这里，与另外两个 harness 不同 |
| 注册检测 | `plugin` 数组包含 `rolebox` 或 `rolebox@版本` 时，`rolebox status` 与 `rolebox info` 报告为已注册；否则给出补全提示 |

## pi

pi 通过扩展（extension）机制挂载 rolebox。

```bash
pi install npm:rolebox          # 项目本地安装改用 pi install -l npm:rolebox
mkdir -p ~/.pi/agent/rolebox && cd ~/.pi/agent/rolebox
rolebox init my-agent -y
rolebox sync pi
```

```text
应看到：
✓ Created standard role at /Users/<你>/.pi/agent/rolebox/my-agent
Run `rolebox sync opencode` to deploy
Synced 1 roles to pi
```

| 项目 | 值 |
|---|---|
| 配置目录 | `$PI_CODING_AGENT_DIR`，未设置或为空白时回退 `~/.pi/agent` |
| 角色目录 | `{configDir}/rolebox` |
| 技能目录 | `{configDir}/skills` |
| agent 目录 | 与技能目录相同——pi 没有原生 agents 目录 |
| sessions / extensions | `{configDir}/sessions`、`{configDir}/extensions` |
| 注册检测 | 无。pi 没有 rolebox 自己拥有的单一清单文件，`status` 与 `info` 不报告注册状态 |

从源码检出安装时，改为在 `~/.pi/agent/settings.json` 的 `extensions` 数组里指向 `dist/pi-extension.js`。

pi 没有原生 skill 工具，角色加载技能用的是 rolebox 提供的 `load_role_skill`；opencode 使用自己的原生实现。

## dsh

dsh（DeepSeek Harness）通过 cordis profile bundle 挂载 rolebox。

```bash
dsh plugin --profile <name> add rolebox
mkdir -p ~/.dsh/rolebox && cd ~/.dsh/rolebox    # $DSH_HOME 已设置时用 $DSH_HOME/rolebox
rolebox init my-agent -y
rolebox sync dsh
```

```text
应看到：
✓ Created standard role at /Users/<你>/.dsh/rolebox/my-agent
Run `rolebox sync opencode` to deploy
Synced 1 roles to dsh
```

| 项目 | 值 |
|---|---|
| 配置目录 | `$DSH_HOME`，未设置或为空白时回退 `~/.dsh` |
| 角色目录 | `{configDir}/rolebox` |
| 技能目录 | `{configDir}/skills` |
| agent 目录 | 与技能目录相同——dsh 没有原生 agents 目录 |
| sessions | `{configDir}/sessions` |
| extensions | 无——dsh 走 cordis 插件机制，不使用扩展目录 |
| 注册检测 | 无。注册由 `dsh plugin` 协调的 profile bundle 完成，无法从单一文件检测 |

非 bundle 安装需要在该 profile 的 `cordis.patch.yml` 中补一行 `- insert:`，指向 profile 相对路径 `./node_modules/rolebox/dist/dsh-plugin.js`。

## 同步目标

`rolebox sync <target>` 的 target 会被严格校验：未知值直接抛错并列出当前支持的列表。三个 target 的落点都从同一份平台注册表推导，因此 CLI 的落点与运行时入口解析出的角色目录不会漂移。

| target | 角色部署到 | 技能链接到 | 判定该 harness 是否已安装的目录 |
|---|---|---|---|
| `opencode` | `~/.config/opencode/rolebox` | `~/.config/opencode/skills` | `~/.config/opencode` |
| `pi` | `$PI_CODING_AGENT_DIR` 或 `~/.pi/agent` 下的 `rolebox/` | 同左配置目录下的 `skills/` | 同左的配置目录 |
| `dsh` | `$DSH_HOME` 或 `~/.dsh` 下的 `rolebox/` | 同左配置目录下的 `skills/` | 同左的配置目录 |

注册中心的角色先用 `rolebox install <name>` 安装，再用 `rolebox sync <target>` 部署。

> 自 v1.3.0 起，pi 与 dsh 是 `rolebox sync` 的正式同步目标。

## 宿主集成差异

三个 harness 共享同一套 **规范工具集（canonical tools，跨 harness 共享的公共工具面）**——hashline 编辑、记忆读写、web 工具、`signal`、交互式终端、asset 与引用查询、会话工具，以及 8 个 `graph_*` 图编排工具都在其中。差异只出现在平台扩展与编排层：

- **opencode** 是唯一有可检测注册机制的宿主，也是唯一运行完整微内核服务栈的宿主。`lsp_*`、`memory_update`、`function_graph`、`skill_compose`、`context_assemble`、`asset_hot_reload` 与 `task_*` 兼容层由它装配，角色加载技能用宿主原生的 skill 工具。
- **pi** 挂载同一套共享工具面与大部分 opencode 扩展（含 `lsp_*`），但不转发 `asset_hot_reload`；它没有原生 skill 工具，因此由 rolebox 提供 `load_role_skill`。热重载、扩展、恢复引擎与 TUI 在 pi 上是显式非目标。
- **dsh** 只装配共享工具面、`graph_*` 与 `loop_*`；`lsp_*` 与 opencode 的扩展工具不装配，图节点改走 dsh 子代理接口。

多代理编排在三个 harness 上走同一条命令式路径：`graph_create` → `graph_add_node` / `graph_add_edge` → `graph_run`。完整的平台能力开关矩阵、逐工具清单与版本约束见[兼容性](/04-Advanced/compatibility)。
