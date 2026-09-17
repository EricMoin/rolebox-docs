---
title: 已知限制
description: rolebox v1.9.0 的已知限制清单——按子系统列出限制、撞上它的条件，以及可以采用的规避方式。
---

# 已知限制（Known Limitations）

本页列出 rolebox v1.9.0 中确实会撞上的边界。每条都写成可判定的形式：**限制**是什么、**什么情况下会撞上**、**怎么绕开**。这里不区分「有意为之」与「暂时如此」——只回答「我现在会不会被卡住」。

> 相关：[错误处理](/03-Reference/error-handling)｜[调度配置](/03-Reference/dispatch-config)｜[平台与 Harness](/01-Overview/platform-harnesses)｜[兼容性](/04-Advanced/compatibility)

## 角色与函数模型

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 角色之间没有继承机制 | 想在角色 A 的 `role.yaml` 里继承角色 B 的配置——没有对应字段，只能在每个角色里重复声明 | 用技能（skills）与引用文档（references）共享知识；用子代理做组合。注意子代理**会**继承父角色的 `model`、`color`、`variant`、`temperature`、`top_p`、`permission`、`tools` 七个字段，未显式覆盖即沿用父值 |
| 会话内不能切换角色 | 会话已经以某个角色启动，想中途换成另一个角色继续干活 | 把要换的活交给子代理；或退出当前会话，以另一个角色重新开始 |
| 函数激活是会话级的 | 用激活前缀打开的函数的整个会话里保持激活，做不到「只对下一条消息生效」 | 用 `transitions` 配 `deactivate`，让函数在条件满足时自行停用；用 `disable_functions` 在角色级排除；把不同阶段放进不同子代理 |
| 内置条件不包含项目上下文 | 想「文件是 TypeScript 就激活这个函数」这类按项目结构判断的激活方式——内置条件只有会话与函数状态：`user_approval`、`artifact_exists`、`plan_todos_complete`、`plan_incomplete`、`evidence_met`、`tool_observed`、`signal_observed`、`turn_count`、`state_eq`（可用 `all` / `any` / `not` 组合） | 通过扩展作用域 `conditions` 注册自定义条件模块（导出 `handler(arg, env)`）；或先用工具把项目特征写进 artifact 与运行时状态，再用 `artifact_exists`、`state_eq` 判断 |
| `--` 是保留分隔符 | 角色目录名里含 `--`（例如 `code--reviewer`）——该角色会被跳过，日志提示 `role ID must not contain "--"` | 用 `-`、`_`、`.` 之类分隔符；子代理 ID 里的 `--` 是系统拼出来的，不要手工使用 |

## 子代理与调度

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 文件式子代理最多递归 3 层 | 目录嵌套到第 4 层（`subagents/<子>/subagents/<孙>/subagents/<曾孙>/subagents/<玄孙>/role.yaml`）时，该层的 `role.yaml` 不会被加载，且没有报错 | 把更深的层级内联声明在父级的 `subagents:` 字段里，或把深层子代理扁平化到中间层 |
| 后台任务 stale 超时默认 15 分钟 | 后台任务连续无进展超过 `backgroundStaleTimeoutMs`（默认 `900000` ms）即被判为 `timeout` | 在派发到该任务的图节点上声明 `budget.timeout_ms`（它成为该任务的硬超时，覆盖后台默认值）；或在 `role.yaml` 的 `dispatch:` 块里调整 `backgroundStaleTimeoutMs` |
| 同步提示词超时默认 10 分钟 | 同步调度（sync）等待子代理提示词完成，超过 `syncPromptTimeoutMs`（默认 `600000` ms）即失败 | 改为后台任务；或在 `dispatch:` 块里调整 `syncPromptTimeoutMs` |
| 终态任务记录只保留 30 分钟 | 任务结束后超过 `taskTtlMs`（默认 `1800000` ms），记录被清出：查不到、也无法再重试 | 需要留存就用 `task_export` 提前落盘；结果 sidecar 文件默认保留 1 小时（`resultRetentionMs`），同样会过期 |
| 结果物化超时 10 秒 | 抓取子代理结果超过 `materializeTimeoutMs`（默认 `10000` ms）时，结果引用上的 `fetchError` 记为 `timeout`、sidecar 留空 | 重试该任务；或让子代理把结果写进工作区文件，而不是只放在回复文本里 |
| 调度层不设并发槽位上限 | 一次派发大量后台任务时它们会直接全部启动；卡住的任务只能靠 stale 超时与看门狗（reconcile 15 秒、全局 sweep 30 秒）兜底回收 | 在派发侧自行控制并发；给每个图节点设置合理的 `budget.timeout_ms` |
| 预算用量按 30 秒采样 | `budgetSampleIntervalMs` 默认 `30000` ms，两次采样之间可能已多消耗一些配额才触发取消 | 给预算留出余量；预算上限只能编程式注入，见[调度配置](/03-Reference/dispatch-config) |

## 图与循环

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 循环组必须声明遍历硬上限 | `loop_groups[].max_traversals` 是必填（整数、≥ 1）：图声明里漏写会解析报错；用 `graph_add_loop` 时小于 1 会被直接拒绝 | 按「最多允许评审几轮」给一个明确的值 |
| 达到硬上限后升级而非继续 | 还有 `revise_needed` 但遍历次数已到 `max_traversals` 时，循环组以 `max_traversals exhausted` 升级（escalate），携带未解决项与遍历计数 | 提高 `max_traversals`；或检查上游节点为什么反复要求修订 |
| 连续两次相同收敛结果会被判为卡住 | 相邻遍历的收敛输出完全相同、累计达到 2 次时，循环组以 `stuck` 升级，且不再消耗遍历次数 | 让收敛节点的输出携带区分信息；或把不收敛的原因当成节点缺陷来修 |
| 图声明上的迭代上限字段不生效 | 在声明里写图级 `max_iterations` 不起作用——它只作为往返解析用的元数据保留；真正生效的是循环组的 `max_traversals` | 一律用 `max_traversals` 表达「最多几轮」 |
| `graph_add_loop` 的 `mode: "fresh"` 不受支持 | 想让每一轮循环在互相隔离的会话里执行时选择 `fresh`，会得到明确的错误而不是该行为 | 每一轮建一张独立的图来获得会话隔离；不需要隔离时用默认的 `inherit` |
| 循环次数与轮次开销有硬上限 | 未指定 `iterations` 时默认 5 轮；单次循环最多 50 轮；每个 dispatch 轮次最长 15 分钟；相邻轮次之间至少间隔 2 秒；送入摘要器的轮次输出与合并后的种子各上限 8000 字符 | 显式给 `iterations`；把长任务拆成多轮；把关键上下文写进文件或 artifact，避免被摘要截断 |

## 记忆系统

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 默认返回条数有限 | `memory_list` 不给 `limit` 时最多返回 20 条摘要；`memory_recall` 不给 `limit` 时最多返回 10 条完整记录；会话启动时自动注入的记忆摘要上限为 10 条 | 显式传 `limit`；用 `scope`、`category`、`relevance` 过滤缩小范围 |
| 依赖 SQLite，Node 侧要求 ≥ 22.5 | Node 运行时走 `node:sqlite`（自 Node 22.5 起提供）；Bun 运行时走 `bun:sqlite` | 用 Node 22.5 及以上，或直接用 Bun；记忆库启用 WAL 日志模式 |
| 全文检索依赖 SQLite FTS5 虚拟表 | 记忆库用 FTS5 建全文索引；所在运行时的 SQLite 未带 FTS5 时，建表与搜索都会失败 | 用 `bun:sqlite` 或 `node:sqlite` 自带的 SQLite（两者均支持 FTS5）；记忆库的驱动按运行时自动选择，没有配置项可换 |

## 通知

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 原生通知依赖平台命令行工具 | 平台命令不在 `PATH` 中时该通道**静默跳过**（不报错、不影响其它通道） | 安装对应工具，或改用没有外部依赖的 `file` / `log` / `webhook` 通道 |
| Webhook 默认 5 秒超时 | 目标端点响应慢于 5 秒时该次投递失败 | 换更快的端点；或改用 `custom-command` 通道自行控制超时 |

平台命令对照：

| 平台 | SystemToast | Sound |
|---|---|---|
| macOS | `terminal-notifier`，缺失时回退 `osascript` | `afplay` |
| Linux | `notify-send` | `paplay`，缺失时回退 `aplay` |
| Windows | PowerShell | PowerShell（`System.Media.SoundPlayer`） |

六个通道里，`file`（JSONL 追加写）、`log`（结构化日志）、`custom-command`（子进程，参数经环境变量传入）没有平台命令依赖；`webhook` 只要求网络可达。

## 哈希行编辑

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 锚点会因外部改动失效 | 读取之后文件被别的进程（或你自己用其它工具）改过，`hashline_edit` 会报 anchor not found、version mismatch 或 hashWidth mismatch | 按提示重新执行 `hashline_read` 取回新的锚点与版本号再改；不要跨编辑复用旧锚点 |
| 哈希宽度随文件大小变化 | 文件超过 1000 行后宽度由 2 位升到 3 位，超过 10000 行升到 4 位；用旧的宽度提交会报 hashWidth mismatch | 用同一次读取返回的宽度；确需固定时用 `ROLEBOX_HASHLINE_WIDTH` 覆盖 |
| 校验格式固定为 2–8 位哈希 | 锚点必须写成 `行号#哈希`，哈希由字母、数字、`_`、`-` 组成且长度 2–8 位 | 直接复制读取结果里的锚点，不要手写 |
| 定位失败只在 ±10 行内模糊搜索 | 目标内容移动超过 10 行时模糊纠正找不到它，编辑失败 | 重新读取该区域；大范围移动后重建锚点 |
| 文件不存在时无法用锚点编辑 | 对不存在的文件做锚点替换会报 `File not found` | 用无锚点的追加 / 前插操作创建文件 |

## 外部工具依赖

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| LSP 功能要求本机装有语言服务器 | 注册表覆盖 TypeScript/JavaScript、Python、Go、Rust、C、C++、Java、Ruby、Bash、Lua、Kotlin；对应二进制不在 `PATH` 或常见安装目录时，该语言的诊断、跳转、补全不可用 | 安装对应服务器：`typescript-language-server`、`pyright-langserver`、`gopls`、`rust-analyzer`、`clangd`、`jdtls`、`solargraph`、`bash-language-server`、`lua-language-server`、`kotlin-lsp` |
| JavaScript 渲染依赖可选包 | 未安装 Playwright 时，需要执行 JS 才能取到内容的页面退回静态 HTTP 抓取，抓到的内容不完整 | 安装 `playwright`；Crawlee 提供更进一步的爬取能力，同样可选 |
| 自定义 Hook 的清理不是强制的 | Hook 模块没有导出 `onDispose` 时，关闭阶段不会为它调用任何清理逻辑 | 需要清理资源（子进程、临时文件、连接）的 Hook 请实现 `onDispose` |

## 平台差异

| 限制 | 什么情况下会撞上 | 规避方式 |
|---|---|---|
| 恢复框架只在 opencode 上装配 | 在 pi 或 dsh 下配置 `hooks.recovery`，恢复策略与内置恢复 Hook 都不会运行 | 依赖自动恢复的能力放到 opencode；其它平台上按[错误处理](/03-Reference/error-handling)里的手工步骤处理失败任务 |

## 相关

- [错误处理](/03-Reference/error-handling) — 每个故障场景的降级行为与排查步骤
- [调度配置](/03-Reference/dispatch-config) — 上面出现的调度参数
- [兼容性](/04-Advanced/compatibility) — harness 能力矩阵与破坏性变更
