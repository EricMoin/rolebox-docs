---
title: 错误处理
description: rolebox 的降级行为、自动恢复策略与排错入口 — 出错时会发生什么、该配哪条恢复链、错误消息怎么读。
---

# 错误处理（Error Handling）

rolebox 采用错误容忍（fault-tolerant）设计：某个角色、Hook、扩展或子代理出错时，出问题的那一部分被跳过或降级，其余功能继续运行。本页面向使用者，回答四个问题——出错时**会发生什么**、**该配哪条恢复链**、**错误消息是什么意思**、**从哪里开始排查**。恢复引擎的内部机制（错误模式匹配、策略链执行器、状态持久化、指标收集）见[恢复系统](/03-Reference/recovery-system)。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[恢复系统](/03-Reference/recovery-system)｜[调度配置](/03-Reference/dispatch-config)｜[已知限制](/03-Reference/limitations)

## 降级行为一览

每一条都对应一个真实会发生的故障场景：**行为**是系统实际做的事，**用户可见现象**是你据以确认发生了什么的东西。

| 场景 | 行为 | 用户可见现象 |
|---|---|---|
| 角色目录里没有 `role.yaml` | 该目录不会被当作角色发现，没有任何日志 | harness 中该角色不可用 |
| `role.yaml` 语法错误、缺 `name`、缺提示词 | 跳过该角色，不注册；其余角色照常加载 | harness 中该角色不可用；日志出现 `Skipping "<角色>": invalid YAML` 一类消息。（`rolebox list` 读的是安装锁文件，仍会把它列出来，不能用来判断加载是否成功） |
| 角色目录名含 `--` | 跳过该角色（`--` 被保留作子代理 ID 分隔符） | 角色不可用；日志提示 `role ID must not contain "--"` |
| 技能文件缺失 | 跳过该技能，角色与其余技能照常加载 | 日志 `Skill "<名字>" not found. Searched: …`；harness 中角色调不到该技能 |
| 函数文件缺失 | 跳过该函数 | 日志 `Function "<名字>" not found. Searched: …`（依次查角色本地、全局、内置三处） |
| 函数激活前缀无效（写成大写、或出现在句子中间而非行首） | 不解析为激活，消息原样送出 | 函数没有激活；那段文本仍留在用户消息里 |
| 自定义 Hook 模块加载失败（文件缺失、语法错误、导入抛错） | 按模块捕获，记录警告，跳过该 Hook | 日志 `Failed to load custom hook module`；该 Hook 的副作用不发生 |
| 自定义 Hook 的处理器抛异常 | 按事件捕获，记录警告，继续执行其它 Hook | 日志 `Custom hook "<名字>" failed on <事件>`；会话不中断 |
| 扩展模块加载失败 | 按模块捕获，记录警告，跳过该扩展 | 日志 `Failed to load extension module`；其它扩展与内置功能不受影响 |
| 子代理会话创建瞬时失败 | 退避重试，默认共 3 次尝试、每次间隔 250 ms | 任务延迟启动；重试耗尽后任务进入 `error`，错误文本记在任务上 |
| 服务端拒绝创建会话 | 不重试 | 任务立即进入 `error`；错误文本是服务端给出的原因，无原因时是 `Failed to create session: empty response` |
| 环境变量插值 `{env:NAME}` 中变量未设置 | 保留占位符原文，不做猜测性替换 | 配置里仍是 `{env:NAME}`；日志说明该变量未设置及如何设置 |
| 预算超限 | 返回结构化原因，取消对应任务，不抛异常 | 任务被取消；原因是 `Request input token budget exhausted: …` 这类固定模板 |
| 结果物化超时（默认 10 秒） | 记录 `fetchError: "timeout"`，结果 sidecar 留空 | 读到空结果，或图节点输出里出现 `[fetch error: timeout]` |
| 工作区状态文件损坏 | 启动检查把它移入 `quarantine/` 目录，相关子系统从空状态启动 | 日志 warning；此前的任务、指标记录不再可见 |
| 通知通道缺少平台命令 | 静默跳过该通道 | 收不到该类通知，其它通道照常；系统提示类通道会记录 `all system toast attempts failed` |
| 图上的循环组达到遍历硬上限 | 以 `max_traversals exhausted` 升级（escalate），而不是继续空转 | `graph_status` 中该节点为 `escalate`，并携带结构化 payload |

四条原则贯穿上表：**隔离故障**（每个角色、Hook、扩展都是独立故障域）、**优雅降级**（缺失的组件不阻塞启动）、**可见性**（多数降级写日志，个别如通知通道缺失是静默跳过）、**不做猜测**（无法解析的内容原样保留，不自动改写）。

## 自动恢复：我该配哪条链

**恢复策略**（recovery strategy）是出错时自动执行的补救动作；把策略按顺序排成一条**策略链**（strategy chain），引擎就逐个尝试，直到恢复成功或链走完。内置 7 种策略：

| 策略 | 做什么 |
|---|---|
| `retry` | 退避后重试当前操作（默认 2 次，起始间隔 2000 ms，倍数 2） |
| `compact` | 压缩会话上下文，保留 `todos` 与 `artifacts` |
| `fallback_model` | 换用备选模型重新提示 |
| `remind_and_retry` | 向会话注入一段提示文本，然后让模型重试 |
| `truncate` | 要求模型把输出压缩到目标比例（默认 50%，最多 8 次） |
| `summarize` | 把上下文总结成摘要后继续 |
| `abort` | 终止恢复链，并向模型注入一条明确的中止消息 |

五个错误类别默认就有链，下表按**你看到的症状**给出它们；症状来自各内置恢复 Hook 的匹配条件。

| 症状 | 错误类别 | 内置默认链 |
|---|---|---|
| API 返回 5xx、网络超时、服务端错误（`session.error` 事件） | `session_error` | `retry`(2 次) → `compact` → `abort` |
| 报上下文超限：context length / context window / token limit / prompt too long | `context_window` | `truncate`(50%，最多 8 次) → `summarize` → `abort` |
| `edit` / `write` / `hashline_edit` 报 oldString not found、multiple matches、anchor not found、version mismatch，或权限、目录类磁盘错误 | `edit_error` | `remind_and_retry`(2 次) |
| 工具输出不是合法 JSON：Unexpected token、Invalid JSON、Unexpected end of JSON | `json_error` | `remind_and_retry`(2 次) |
| 工具调用返回空白或几乎没有内容（去空白后不足 5 个字符） | `empty_response` | `remind_and_retry`(1 次) |
| 当前模型持续失败，想换备选模型 | 在 `session_error` 链里插入 `fallback_model` | `retry` → `compact` → `fallback_model` → `abort` |

补充三个可判定的边界：

- 类别键**整个省略**时才回落到内置默认链；一旦写了该类别但没写 `chain`（或 `chain` 为空），该类别就**没有链**，错误不会被自动恢复。
- `enabled: false` 写在类别上时，即使给了 `chain` 也不执行。
- 一条链的尝试次数达到 `max_total_attempts`（默认 10）后，该次链执行以 `global attempt limit reached` 结束；链自然走完则以 `chain exhausted` 结束。两种情况都会把最终消息注入会话。

## 按角色配置恢复

恢复配置写在该角色 `role.yaml` 的 `hooks.recovery` 块里（**不是**顶层 `recovery:`）。字段级的完整清单见 [role.yaml 参考](/03-Reference/role-yaml)，这里给一份可直接改的配置：

```yaml
hooks:
  builtin:
    recovery: true            # 总开关：false 时不创建恢复引擎，也不运行内置恢复 Hook
    edit_error: false         # 单独关掉编辑错误这一类 Hook

  recovery:
    enabled: true             # false = 保留 Hook，但不执行任何恢复策略
    max_total_attempts: 15    # 一次链执行的尝试上限
    persist_state: true       # 恢复状态落盘
    collect_metrics: true     # 收集恢复指标

    session_error:            # 写了 chain 就完全替换默认链
      chain:
        - strategy: retry
          config:
            max_retries: 3
            backoff_ms: 1000
            backoff_factor: 2
        - strategy: compact
        - strategy: fallback_model
        - strategy: abort
          config:
            message: 会话失败，已尝试全部恢复手段

    json_error:
      chain:
        - strategy: remind_and_retry
          config:
            max_retries: 3
            reminder_text: "请检查 JSON 语法后重试"
```

两个开关的区别值得记牢，它们管的是不同层次：

| 开关 | 关掉之后 |
|---|---|
| `hooks.builtin.recovery: false` | 内置恢复 Hook 不再挂载，恢复引擎不再创建——错误检测与提示注入都不会发生，错误直接抛给上层调用方 |
| `hooks.recovery.enabled: false` | Hook 照常挂载，但引擎不做任何恢复尝试；Hook 检测到错误后不会注入任何提示 |
| `hooks.builtin.<类别>: false` | 只有该类的内置 Hook 不再拦截（例如 `edit_error`），其它类别不受影响 |

其余两条边界：

- 恢复引擎只在 opencode 组合根中装配；pi 与 dsh 下这份配置不生效，详见[平台与 Harness](/01-Overview/platform-harnesses)。
- 进程内有多个角色声明了 `hooks.recovery` 时，只采用**第一个**声明者的配置。
- 未知策略名会被记录警告并跳过，不会导致角色加载失败——链里少了那一步，但其它步骤照常执行。

## 错误消息的含义

| 消息（节选） | 出现位置 | 含义与处理 |
|---|---|---|
| `Skipping "<角色>": invalid YAML`、`… missing or invalid "name" field`、`… must provide "prompt" or "prompt_file"` | 日志 | 该角色的 `role.yaml` 没有通过加载校验，角色被跳过。按消息提示补全字段 |
| `Skipping "<角色>": role ID must not contain "--"` | 日志 | 目录名里有 `--`。改名即可 |
| `Failed to load custom hook module` / `Failed to load extension module` | 日志 | 该模块被跳过。检查模块路径与导出，其它功能不受影响 |
| `Skill "<名字>" not found` / `Function "<名字>" not found` | 日志 | 声明了但没找到文件；消息里会列出搜索过的位置 |
| `Failed to create session: empty response` | 任务记录 | 平台拒绝创建子代理会话且没给原因；该任务进入 `error` |
| `Rejected by parent` | 任务记录 | 父会话拒绝了这个任务 |
| `Session lost after process restart — You can re-dispatch with dispatch(...)` | 任务记录 | 进程重启后原会话不可恢复。消息文本沿用旧工具名，实际用 `task_retry` 重开该任务 |
| `Task result expired: <任务 ID>` / `Task result fetch error: …` | `task_export` 等工具输出 | 结果已过保留期（终态任务记录默认保留 30 分钟，结果 sidecar 默认保留 1 小时）或抓取失败 |
| `Request/Session input token budget exhausted: {已用} >= {上限}` 等五条模板 | 任务记录 | 触发预算上限，任务被取消。预算只能编程式注入，见[调度配置](/03-Reference/dispatch-config) |
| `Operation "materialize" timed out after 10000ms` | 日志 | 抓取子代理结果超时；同一原因在结果引用上表现为 `fetchError: "timeout"` |
| 任务状态 `error` / `timeout` / `cancelled` | `task_search`、`graph_status` | 三种失败终态：启动或执行失败 / 超过 stale 超时 / 被主动取消 |

## 排查步骤

按顺序做这四件事，多数问题在第二步就能定位。

**第一步：看整体健康。** `rolebox status` 报告已安装角色、技能符号链接与 opencode 集成状态。要确认某个角色是否真的被加载，看日志里的 `Skipping …` 消息——安装清单里有它，不代表它加载成功。

```bash
rolebox status
```

```text
应看到：示例输出，随环境略有差异
Rolebox v1.9.0
（角色列表；每个角色带版本与注册中心）
Skill symlinks (n): all valid
```

**第二步：看恢复日志。** 日志默认写在项目的 `.rolebox/logs/rolebox.log`，可用 `ROLEBOX_LOG_FILE` 指定别的路径；`ROLEBOX_LOG_LEVEL=debug` 可提高详细度。恢复相关组件各用自己的前缀，下面这条命令直接看恢复动作：

```bash
grep -o "RecoveryEngine initialized\|Starting recovery chain\|Recovery successful\|Recovery aborted\|Recovery exhausted\|Unknown recovery strategy" .rolebox/logs/rolebox.log | tail -n 20
```

```text
应看到：示例输出，随环境略有差异——命中的是消息文本
RecoveryEngine initialized
Starting recovery chain
Recovery successful
```

各前缀的归属：`recovery:engine`（引擎初始化、链起止）、`recovery:config`（配置解析；未知策略名在这里告警）、`recovery:chain-executor`（策略链逐步执行）、`recovery:state`（状态持久化）、`recovery:metrics`（指标收集）、`recovery:startup-check`（启动时的状态文件检查与隔离）、`ext:loader`（扩展模块加载）、`hook:custom-loader`（自定义 Hook 加载）。

**第三步：确认配置真的生效。** `rolebox info <角色> --check` 做的是角色完整性校验（校验和、同步状态），**不显示恢复配置**；要确认恢复配置是否被接受，看引擎初始化那条日志：它带出 `enabled`、已装配的链类别与已注册策略名，未知策略名则在 `recovery:config` 里被点名。另外，配置写在顶层 `recovery:` 下不会有任何效果。

恢复指标（每个类别的尝试次数与成功数）在启用 `ROLEBOX_METRICS` 后随调度指标一起写入状态目录的 metrics 文件，快照字段见[恢复系统](/03-Reference/recovery-system)。

**第四步：手动补救。** 自动恢复管不到的东西可以手工处理：`task_search` 找到失败任务，`task_retry` 重开它的会话（终态任务才可以重试，原会话上下文保留），`task_export` 在结果过期前把内容落盘。

| 症状 | 可能原因 | 检查点 |
|---|---|---|
| 错误完全没有被恢复 | 该类别的 Hook 被关掉，或类别没有链 | `hooks.builtin.<类别>` 是否为 `false`；`hooks.recovery.<类别>` 是否只写了 `enabled: false` 而没写 `chain` |
| 链走到一半就停了 | 一次链执行的尝试次数用尽 | 日志里的 `global attempt limit reached`；提高 `max_total_attempts` |
| 改了配置但行为不变 | 配置位置不对，或不是第一个声明者 | 是否写在 `hooks.recovery` 下；是否有多角色同时声明 |
| 自定义策略不生效 | 策略名未登记为已知策略 | `recovery:config` 的 `Unknown recovery strategy` 警告 |
| 恢复后任务状态丢失 | 终态任务记录超过 TTL 被清出 | 终态记录默认保留 30 分钟；需要留存就提前 `task_export` |

## 相关

- [恢复系统](/03-Reference/recovery-system) — 恢复引擎内部机制
- [已知限制](/03-Reference/limitations) — 每个子系统的边界与规避方式
- [Hook 机制](/03-Reference/hooks) — 自定义 Hook 的事件与生命周期
- [扩展机制](/03-Reference/extensions) — 自定义恢复策略与错误模式的注册入口
