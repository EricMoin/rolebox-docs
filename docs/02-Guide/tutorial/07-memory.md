---
title: 07 让代理记住你（第二教程）
description: 第二个小教程：用记忆库让代理跨会话记住你的决策，并观察它如何被自动注回上下文。
---

# 07 让代理记住你（第二教程）（Memory）

本章是一条独立的小教程：让角色把「上次定下的规矩」写进记忆库，再让下一个会话里的它自己想起来。

> 前置：[教程 01 安装并跑通第一个角色](/02-Guide/tutorial/01-install)（有一个能对话的 `code-reviewer` 就够了）｜相关：[记忆系统](/04-Advanced/memory-system)、[CLI 参考](/03-Reference/cli)

## 记忆是什么

**记忆（memory，写在项目 `.rolebox/` 目录下、由 rolebox 在会话启动时回注给角色的持久条目）** 和「会话历史」是两件事：会话是一次性的上下文，记忆是你要它跨会话长期记住的东西。

三个关键事实：

- 记忆库是**每个项目一份**的 SQLite 数据库，落在 `<项目>/.rolebox/memory.db`；
- 角色每次开会话时，rolebox 会把符合条件的记忆摘要拼成 `<available_memory>` 块注入系统提示——**记忆库为空时这个块根本不出现**；
- 「写下来」和「会被自动注入」不是一个门槛：默认只注入相关度 `medium` 及以上的最近若干条。

本章继续用 01 章的练习项目 `~/rolebox-lab`。

## 第 1 步：先看记忆库里有什么

```bash
cd ~/rolebox-lab
rolebox memory list
```
```text
应看到（还没写过任何记忆时）：
No memory entries found.
```

```bash
rolebox memory stats
```
```text
应看到（空库的形状）：
  Memory Store Statistics
  ────────────────────────────────────
  Total entries:     0
  By scope:
    (none)
  By category:
    (none)
  By relevance:
    (none)
```

两条命令回答的问题不同：`list` 列条目（默认按最近更新排序，最多 20 条），`stats` 给库的分布——按作用域、按类别、按相关度。定位方式是**工作目录**：CLI 从当前目录向上找到第一个含 `.rolebox/` 的目录，把它当作项目根，所以在项目的子目录里执行也能命中同一个库。

## 第 2 步：把 memory 函数交给角色

记忆的读写由四个工具完成（`memory_list`、`memory_recall`、`memory_write`、`memory_update`；教程主线用的 opencode 四个都可用），而「回顾会话 → 提炼决策 → 落盘」整套流程封装在内置函数 `memory` 里。函数要先在 `role.yaml` 里声明才能激活——函数清单是**合并**语义：`plan`、`execute`、`loop` 三个默认函数始终在，声明只是往清单里加，所以在现有列表末尾追加一行即可（别删掉已经有的函数）：

```yaml
functions:
  - plan
  - execute
  - memory
```

改完重启 harness，让插件重新解析角色（角色在启动时加载）。

## 第 3 步：在新会话里触发 |memory|

新开一个 `code-reviewer` 会话，在**行首**发送：

```text
|memory| 请回顾这个项目的会话，把「错误信息必须包含修复建议」这条约定写进记忆库。
```

`|函数名|` 是函数激活语法，必须写在行首。`|memory|` 默认走增量模式：只处理还没有被记忆归档过的会话；想只扫最近 5 个会话，写成 `|memory:recent|`。

应看到角色按内置流程走一遍：先用 `memory_list` 看已有什么，再用 `session_list` / `session_read` 翻会话，写之前用 `memory_recall` 查重，最后落盘并汇报：

```text
应看到（示例输出，条数与措辞随你的实际会话不同）：
Memory consolidation complete.
Processed 1 sessions, wrote 1 new memories, updated 0.
```

## 第 4 步：用命令行验证落盘

```bash
rolebox memory search 修复建议
```
```text
应看到（示例输出，ID、标题与时间随你的实际决策不同）：
  ID           Title                          Category         Relevance  Content
  ────────────────────────────────────────────────────────────────────────────────────────
  a1b2c3d4e5f6 错误信息必须给出修复建议                   decision         high       错误信息必须包含修复建议…
```

再确认库里的形状：

```bash
rolebox memory stats
```
```text
应看到（示例输出，作用域取决于这条记忆写成了哪种）：
  Memory Store Statistics
  ────────────────────────────────────
  Total entries:     1
  By scope:
    workspace    1
  By category:
    decision         1
  By relevance:
    high       1
```

`rolebox memory list` 现在也会列出这一行。要读全文用 `rolebox memory show <完整 ID>`，删掉用 `rolebox memory delete <完整 ID>`（`delete` 会先让你确认，加 `-y` 跳过）。

## 第 5 步：下一个会话，它自己想起来

重启 harness 再开一个会话。这次什么都不用输入——rolebox 已经把记忆摘要拼进了系统提示，形状是：

```text
<available_memory>
Memory entries from previous sessions. Use memory_recall to search for specific memories.
  <memory>
    <id>a1b2c3d4e5f6</id>
    <title>错误信息必须给出修复建议</title>
    <category>decision</category>
    <relevance>high</relevance>
    <updated>2026-09-17T08:21:04.512Z</updated>
  </memory>
</available_memory>
```

注入的是**摘要**（ID、标题、类别、相关度、更新时间），不是正文；代理需要细节时会用 `memory_recall` 检索全文。想亲眼确认，直接在会话里问：

```text
我对错误信息的写法有什么约定？
```

它应当答出你刚落盘的那条决策，而不是回头问你一遍。

注入行为可以按角色调整，写在 `role.yaml` 的 `memory:` 块里：

| 字段 | 默认值 | 作用 |
|---|---|---|
| `inject` | `true` | 会话启动时是否注入 `<available_memory>` |
| `max_inject` | `10` | 最多注入多少条摘要 |
| `min_relevance` | `medium` | 注入的相关度门槛（`high` / `medium` / `low`） |
| `scope` | `both` | 注入哪些作用域（`role` / `workspace` / `both`） |

## 第 6 步：workspace 与 role 两种作用域

每条记忆都带一个作用域，它决定的是**归属与过滤**，不是访问权限：

| 作用域 | 写入时记录的 `role_id` | 适合放什么 | 只看它 |
|---|---|---|---|
| `workspace` | `shared` | 项目事实、架构决策、团队约定——所有角色都该知道 | `rolebox memory list --scope workspace` |
| `role` | 写入者的角色 ID | 这个角色自己的工作习惯与内部方法 | `rolebox memory list --scope role` |

两点必须说清楚：

1. **两种作用域存在同一个库里**（`<项目>/.rolebox/memory.db`），不是两个隔离的数据库。列表、检索、注入都按 `scope` 过滤，不按 `role_id` 做访问控制——所以 `role` 的含义是「归属清晰、可以按作用域挑出来」，而不是「别的角色一定读不到」。要区分它们，看 `role_id`：`workspace` 恒为 `shared`，`role` 是写入它的角色。
2. **真正决定「会不会自动出现」的是 `memory:` 块**，尤其是 `scope` 与 `min_relevance`。默认 `both` + `medium`：`low` 相关度的记忆不会被注入，但仍可被 `rolebox memory search` 或 `memory_recall` 检索到。

## 常见错误

1. **`|memory|` 什么也没发生。** 先确认 `memory` 在 `role.yaml` 的 `functions:` 里：不在角色函数清单里的函数名会被解析器吃掉但不激活，看起来只是消息少了前缀。再确认前缀写在**行首**。
2. **`rolebox memory list` 显示 `No memory entries found.`** 多半是目录不对：换到含 `.rolebox/` 的项目根目录再执行。记忆跟随工作目录，不跟随角色目录。
3. **写了 `low` 相关度的记忆，下个会话却看不到。** 默认注入门槛是 `medium`；把它调低，或用 `memory_recall` 主动检索。
4. **以为重开会话就会忘记。** 记忆在磁盘上的 SQLite 库里，与任何一次会话的生命周期无关。

## 你现在拥有什么

- 一个会「回顾会话 → 提炼决策 → 落盘」的角色（`memory` 函数）；
- 三个观察记忆库的入口：`rolebox memory list` / `stats` / `search`；
- 一套跨会话闭环：这次的决策，下次会话自动以 `<available_memory>` 出现在代理眼前。

教程到这里结束。回头看你搭出的东西：角色、技能、引用文档、函数、子代理、带审批门与有界循环的图流水线，以及跨会话记忆。想继续深入，接着读[图工作流](/02-Guide/graph-workflows)与[记忆系统](/04-Advanced/memory-system)。
