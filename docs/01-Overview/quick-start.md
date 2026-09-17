---
title: 三步速查
description: 三条命令把 rolebox 跑起来：装插件、建角色、在 harness 里对话，附五条常见排查。
---

# 三步速查（Quick Start）

这一页只给最短路径：装、建、跑。每一步为什么这样做、每条输出怎么读，见[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)；三个 harness 的完整安装矩阵见[平台与 Harness](/01-Overview/platform-harnesses)。

## 第 1 步：装

opencode 是本页与教程的主线，在它的配置目录里安装插件：

```bash
cd ~/.config/opencode && npm install rolebox
```
```text
应看到（示例输出，包数量与耗时随 npm 版本、网络环境略有差异）：
added 83 packages in 22s
```

另外两个 harness 各一行：

- pi：`pi install npm:rolebox`（想在项目里安装用 `pi install -l npm:rolebox`）
- dsh：`dsh plugin --profile <name> add rolebox`

opencode 还必须在配置里声明插件，否则它不会被加载：

```jsonc
// ~/.config/opencode/opencode.jsonc
{ "plugin": ["rolebox"] }
```

## 第 2 步：建

harness 会扫描 `<会话工作目录>/rolebox/`（存在时优先）或 harness 的全局角色目录里的角色。在 `~/rolebox-lab` 下建一个练习项目，再创建角色：

```bash
mkdir -p ~/rolebox-lab/rolebox && cd ~/rolebox-lab/rolebox
rolebox init code-reviewer -y
```
```text
应看到：
✓ Created standard role at /Users/<你>/rolebox-lab/rolebox/code-reviewer
Run `rolebox sync opencode` to deploy
```

`-y` 跳过交互向导并使用默认的 `standard` 模板，生成 `role.yaml`、`PROMPT.md`、`skills/` 与 `functions/`。

## 第 3 步：跑

从 `~/rolebox-lab` 启动 harness——会话工作目录决定它去哪个 `rolebox/` 目录找角色：

```bash
cd ~/rolebox-lab && opencode
```
```text
应看到（示例输出，随 harness 与版本略有差异）：
代理列表里出现 code-reviewer
```

选中 `code-reviewer` 就能对话。它现在只会照模板回答，因为 `PROMPT.md` 还是脚手架里的 `TODO`——这正是教程第 02 章要改的。

## 常见排查

**harness 里看不到角色。** 角色目录按「会话工作目录下的 `rolebox/`」优先解析。确认 `ls ~/rolebox-lab/rolebox/code-reviewer/role.yaml` 能找到文件，从 `~/rolebox-lab` 启动 harness，改动之后重启一次。

**`rolebox sync` 没有部署我 `init` 的角色。** 正常。`sync` 面向从注册中心安装的角色：`rolebox install <角色名>` 把角色登记进安装锁文件，`rolebox sync <harness>` 部署锁文件里的条目；`rolebox init` 生成的本地角色不经过锁文件，放进角色目录就已经生效。还没装过注册中心角色时，这两条命令的输出是：

```bash
rolebox list
rolebox sync opencode
```
```text
应看到（还没有安装过注册中心角色时）：
No roles installed. Run `rolebox install <role>` to get started.
Synced 0 roles to opencode
```

**`rolebox: command not found`。** 按上面的方式安装时，包只存在于 harness 配置目录的 `node_modules/` 下，跨目录不可见；在该目录里用 `npx rolebox <子命令>` 调用，或按[CLI 参考](/03-Reference/cli)全局安装。

**插件装了但没生效（opencode）。** 检查 `~/.config/opencode/opencode.jsonc` 里有 `"plugin": ["rolebox"]`，保存后重启 harness。

**`role.yaml` 报解析错误。** 用空格缩进（不支持 Tab）；`skills` 与 `functions` 是字符串数组；字段语义见[role.yaml 参考](/03-Reference/role-yaml)。

## 下一步

- [教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)——同样的三步，逐步讲清每条输出
- [平台与 Harness](/01-Overview/platform-harnesses)——pi 与 dsh 的安装命令、配置目录与环境变量覆盖
- [创建角色](/02-Guide/create-a-role)——写出完整的 `role.yaml`
