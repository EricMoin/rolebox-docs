---
title: 目录结构
description: 角色目录、全局目录与 .rolebox 状态目录各放什么，附一份「我该把文件放哪」的决策表和排查索引
---

# 目录结构（Directory Structure）

rolebox 用一组约定目录组织角色及其资源：每个角色一份目录，技能、函数、引用、子代理各有位置，运行时按约定路径自动加载。本页只讲读者要打交道的目录——每个目录放什么、放错会怎样、出问题时该看哪里。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[平台与 Harness](/01-Overview/platform-harnesses)、[技能系统](/02-Guide/skills)、[函数系统](/02-Guide/functions)、[引用文档](/02-Guide/references)、[子代理](/02-Guide/subagents)

## 角色根目录与角色目录

三个 harness 只在根路径上不同：opencode 是 `~/.config/opencode`，pi 是 `~/.pi/agent`，dsh 是 `$DSH_HOME` 或 `~/.dsh`。下文以 opencode 取值举例。

角色根目录的解析顺序是：当前项目下存在 `rolebox/` 就用它，否则用 `{configDir}/rolebox/`。**角色 ID 直接取自目录名。**

```text
~/.config/opencode/
├── rolebox/                        # 角色根目录
│   ├── code-reviewer/              # 一个角色：角色 ID 就是目录名
│   │   ├── role.yaml               # 角色定义（必需）
│   │   ├── PROMPT.md               # 提示词文件，由 role.yaml 的 prompt_file 指向
│   │   ├── skills/                 # 角色私有技能
│   │   │   ├── review-checklist.md # 单文件技能
│   │   │   └── style-check/
│   │   │       ├── SKILL.md        # 目录型技能的入口
│   │   │       └── references/     # 技能级引用文档
│   │   │           └── rules.md
│   │   ├── functions/              # 角色私有函数
│   │   │   └── security-scan.md
│   │   ├── references/             # 角色级引用文档（自动发现）
│   │   │   └── style-guide.md
│   │   └── subagents/              # 文件式子代理
│   │       └── researcher/
│   │           ├── role.yaml       # 子代理自己的定义
│   │           ├── skills/
│   │           └── functions/
│   └── team-lead/
│       └── role.yaml
├── skills/                         # 全局技能目录，所有角色可共享
└── functions/                      # 全局函数目录，对所有角色可见
```

角色目录里只有 `role.yaml` 是必需的，其余目录按需创建。

## 我该把文件放哪

| 我想做的事 | 放在哪里 | 备注 |
|---|---|---|
| 定义一个新角色 | `{roleRoot}/<roleId>/role.yaml` | 角色 ID = 目录名，不能含 `--`（它是子代理 ID 的分隔符） |
| 写角色的系统提示词 | 角色目录下的任意 `.md` + `role.yaml` 的 `prompt_file` | 也可直接内联在 `prompt:`；两者都给时以 `prompt_file` 为准 |
| 加一个只有这个角色能用的技能 | `<roleDir>/skills/<name>.md` 或 `<roleDir>/skills/<name>/SKILL.md` | 同名时目录型技能优先 |
| 加一个所有角色都能用的技能 | `{configDir}/skills/`，在 `role.yaml` 的 `opencode_skills:` 里引用 | 由 harness 的技能目录提供 |
| 加一个只有这个角色能用的函数 | `<roleDir>/functions/<name>.md` | 同名时覆盖全局函数与内置函数 |
| 加一个所有角色都能用的函数 | `{configDir}/functions/<name>.md` | 对所有角色可见 |
| 加一份角色常读的知识文档 | `<roleDir>/references/` 下的任意 `.md` | 自动发现；也可在 `references:` 里显式声明 |
| 加一份只在某个技能里用的知识文档 | `<skillDir>/references/` 下的任意 `.md` | 技能级与角色级引用合并注入 |
| 声明一个子代理 | 父角色 `role.yaml` 的 `subagents:`，或 `<roleDir>/subagents/<name>/role.yaml` | 文件式子代理可以有自己的 `skills/` 与 `functions/` |
| 放项目级运行时配置 | 项目根目录的 `.rolebox/config.json` | 例如默认角色，见下节 |
| 放跨会话记忆 | 项目根目录的 `.rolebox/memory.db` | SQLite，由 rolebox 维护，不要手改 |

## 每类文件的加载规则

### role.yaml

必填 `name`、`description`，以及 `prompt` 与 `prompt_file` 二选一；完整字段见 [role.yaml 参考](/03-Reference/role-yaml)。角色目录名与子代理的 `name` 都不能包含 `--`。

### skills/ — 按需加载的技能

技能是角色在执行相关任务时才加载的知识模块，可以是一份 Markdown，也可以是一个带 `SKILL.md` 入口的目录（目录型技能还能再带 `references/`）。同名时**目录优先于单文件**，四层按顺序取第一个存在的，找不到就不加载（不报错）：

1. `<roleDir>/skills/<name>/SKILL.md`
2. `<roleDir>/skills/<name>.md`
3. `{globalSkillsDir}/<name>/SKILL.md`
4. `{globalSkillsDir}/<name>.md`

`{globalSkillsDir}` 随 harness 变化（opencode 是 `~/.config/opencode/skills`）。用法见[技能系统](/02-Guide/skills)，编写见[编写技能](/02-Guide/authoring-skills)。

### functions/ — 用 |name| 激活的函数

解析顺序与技能同构，按「角色本地 → 全局 → 内置」三层取第一个命中的文件，因此**角色本地函数可以覆盖同名的全局函数或内置函数**：

1. `<roleDir>/functions/<name>.md`
2. `{configDir}/functions/<name>.md`
3. rolebox 包内置的 `functions/<name>.md`（`plan`、`execute`、`loop`）

内置函数默认启用；`role.yaml` 的 `functions:` 是合并语义，要移除内置函数得用 `disable_functions`。见[函数系统](/02-Guide/functions)。

### references/ — 被动阅读的知识文档

引用文档只有两个层级，**没有全局目录**：角色级 `<roleDir>/references/` 与技能级 `<skillDir>/references/`。两个层级都是「目录自动发现 + 显式声明」的合并，而不是优先级屏蔽：目录下（含子目录）的 `.md` 全部被发现，`references:` 里同名文件的显式条目只用来覆盖描述信息、或指向目录之外的文件。子代理还会继承父角色的角色级引用。见[引用文档](/02-Guide/references)。

### subagents/ — 文件式子代理

`subagents/<name>/role.yaml` 会被自动发现，递归深度上限为 3 层（父 → 子 → 孙）。文件式子代理有自己的目录，因而可以有自己的 `skills/`、`functions/` 与 `references/`；内联声明的子代理没有独立目录，它的技能与函数从父角色目录解析。命名、继承与排错见[子代理](/02-Guide/subagents)。

## .rolebox/ — 项目级运行时目录

rolebox 在项目根目录维护一个隐藏的 `.rolebox/` 目录，存放运行时状态、持久化数据与日志。它由 rolebox 自动管理，**不建议手动编辑**：

```text
你的项目/
└── .rolebox/
    ├── memory.db         # SQLite 记忆库，存放跨会话、跨角色的记忆条目
    ├── config.json       # 项目级配置，例如 { "defaultRole": "code-reviewer" }
    ├── logs/rolebox.log  # 项目本地日志
    └── state/            # 运行时状态
        ├── engine-*.json          # 图执行状态（节点生命周期、预算）
        ├── graph-events-*.ndjson  # 图引擎事件日志（追加式）
        ├── loops-*.json           # 循环协调器状态
        ├── dispatch-*.json        # 调度任务状态（任务图、结果引用、出站通知）
        ├── fnstate-*.json         # 函数状态机（阶段、门控、证据）
        ├── metrics-*.json         # 指标快照
        ├── signalledger-*.json    # 会话级信号账本
        ├── progress/              # 进度报告
        ├── checkpoints/           # 失败重试用的进度快照
        └── results/               # 溢出到侧车文件的任务结果
```

- 文件名里的短哈希由项目路径规范化后算出，同一个物理目录总是映射到同一组文件名。
- 状态文件采用「先写临时文件、再改名覆盖」的原子写入，写到一半崩溃不会留下半个文件。
- 启动时会清理超过 7 天未修改的 `dispatch-*.json` 与对应 `.lock` 文件；保留天数用环境变量 `ROLEBOX_STATE_RETENTION_DAYS` 调整。
- `.rolebox/config.json` 在角色解析之后、会话启动之前应用，所以它不影响 `rolebox list` 的输出，只影响新会话默认选哪个角色。
- `.rolebox/state/` 可以整体删除，rolebox 下次启动会自动重建；删除前先确认 `.rolebox/memory.db` 里没有要保留的记忆。
- 项目级配置与角色安装配置分工不同：`.rolebox/config.json` 管本项目的运行时行为，`~/.config/rolebox/config.yaml` 管角色的安装与注册中心。

状态文件用 `rolebox monitor` 查看：`--task-id=<id>` 看单个任务详情，`--json` 输出机器可读格式，全部参数见 `rolebox monitor --help`。注意 opencode 上的图引擎完全在内存中运行，状态不落盘、也没有崩溃恢复扫描——图状态要用 `graph_status` 查询，而不是找文件。

### 状态的旧位置（v0.12.0 之前）

v0.12.0 之前，调度与图状态存放在 `~/.local/share/rolebox/state/`；从 v0.12.0 起改为项目本地的 `.rolebox/state/`。如果你在新位置看不到文件、而旧位置有残留，删除旧位置的文件是安全的——当前版本只读项目本地这一份。

## rolebox 自己的配置与数据目录

除 harness 的配置目录外，rolebox 在下面两处维护与 harness 无关的配置和数据：

| 路径 | 内容 | 能删吗 |
|---|---|---|
| `~/.config/rolebox/config.yaml` | 注册中心列表，默认含 `oh-my-role` | 删除后下次使用会自动重建默认配置 |
| `~/.config/rolebox/rolebox.lock` | 已安装角色的版本、来源与完整性哈希 | 删除后角色仍在，但 `rolebox sync` 找不到它们 |
| `~/.config/rolebox/logs/rolebox.log` | CLI 操作日志 | 可安全删除，自动轮转 |
| `~/.local/share/rolebox/roles/` | 已安装角色包 | 交给 `rolebox install` / `rolebox uninstall` 管理 |
| `~/.local/share/rolebox/cache/` | 注册中心清单缓存 | 可删；默认缓存 5 分钟，`--no-cache` 跳过 |

配置目录的解析顺序是 `ROLEBOX_CONFIG_DIR` → `XDG_CONFIG_HOME/rolebox` → `%APPDATA%/rolebox`（Windows）→ `~/.config/rolebox`；数据目录同理，依次为 `ROLEBOX_DATA_DIR` → `XDG_DATA_HOME/rolebox` → `%LOCALAPPDATA%/rolebox` → `~/.local/share/rolebox`。

## 出问题时该看哪个目录

| 场景 | 先看哪里 | 怎么查 |
|---|---|---|
| 角色没按预期响应，技能或函数没加载 | `role.yaml` 与对应的 `skills/`、`functions/` 目录 | 核对声明里的名字与文件名是否一致 |
| 任务卡住或状态异常 | `.rolebox/state/dispatch-*.json` | `rolebox monitor --task-id=<id>` |
| 函数状态机行为异常 | `.rolebox/state/fnstate-*.json` | `rolebox monitor` |
| 图执行停滞（pi / dsh） | `.rolebox/state/engine-*.json` | `rolebox monitor`；opencode 上图在内存里，用 `graph_status` 查 |
| 进度报告丢失或不更新 | `.rolebox/state/progress/` | 直接读 JSON，看时间戳是否更新 |
| 角色安装后没生效 | `{configDir}/rolebox/<roleId>/` | `rolebox sync opencode`（或 `pi` / `dsh`），确认符号链接存在 |
| 角色版本不匹配 | `~/.config/rolebox/rolebox.lock` | `rolebox list` |
| 注册中心下载失败 | `~/.local/share/rolebox/cache/` | `rolebox search <role> --no-cache` |
| 跨会话记忆丢失 | `.rolebox/memory.db` | 检查文件存在且非空 |
| 状态文件损坏，想重置 | `.rolebox/state/` | 删除整个目录，rolebox 下次启动重建 |
| 想彻底清理运行时数据 | `.rolebox/` | 删除整个目录（`memory.db` 含记忆，先确认备份） |

## 下一步

- [创建角色](/02-Guide/create-a-role) — role.yaml 逐字段与三个配方
- [平台与 Harness](/01-Overview/platform-harnesses) — 三个 harness 的目录、安装与同步对照
- [架构概览](/01-Overview/architecture-overview) — 角色从目录到运行时的加载过程
- [子代理](/02-Guide/subagents) — 子代理目录、命名与配置继承
