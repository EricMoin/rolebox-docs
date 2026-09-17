---
title: 源码索引
description: 概念到 rolebox 源码模块的唯一出处页：每个概念由哪个模块负责，以及该到哪一页读它的行为。
---

# 源码索引（Source Index）

这一页回答「文档描述的某个行为，在 rolebox 源码里由哪个模块负责」。**本页是唯一保留模块路径的用户可见索引**：行号不作为文档的一部分（会随重构漂移），需要定位实现请在仓库中检索符号。

> 相关：[架构概览](/01-Overview/architecture-overview)｜[服务架构](/01-Overview/service-architecture)｜[贡献指南](/05-Contributing/contributing)

## 怎么用这一页

- 表里的**模块路径**指向只读参考仓库 `rolebox` 中真实存在的文件或目录；找不到文件时先确认你的 checkout 版本。
- 「相关页面」给的是**语义**所在：想知道某模块对读者意味着什么，读那一页，而不是读代码。
- 这一页只登记出处。术语的**定义**在[术语表](/06-Appendix/glossary)，模块之间**为什么这样分层**在[架构概览](/01-Overview/architecture-overview)。

## 引导与解析

| 概念 | 模块 | 该模块负责什么 | 相关页面 |
|---|---|---|---|
| 插件入口与三宿主引导 | `src/index.ts`、`src/pi-extension.ts`、`src/dsh-plugin.ts` | 三个入口各自完成「解析角色目录 → 装配运行时 → 返回 hook handler」 | [架构概览](/01-Overview/architecture-overview)、[平台与 Harness](/01-Overview/platform-harnesses) |
| 角色发现与解析 | `src/loader/role-loader.ts`、`src/loader/subagents.ts`、`src/resolver/orchestrator.ts` | 扫描角色目录里的 `role.yaml`、按目录名给出角色 id，并把角色解析成技能、引用、函数与子代理的完整清单 | [role.yaml 参考](/03-Reference/role-yaml) |
| 技能与引用解析 | `src/resolver/skill-resolver.ts`、`src/resolver/reference-resolver.ts`、`src/asset/skill-compose.ts` | 按名字解析技能目录与引用文档，并合并多层技能 | [技能系统](/02-Guide/skills)、[引用文档](/02-Guide/references) |
| 提示词构建 | `src/prompt/builder.ts` | 把角色人格、技能与引用的元数据拼成系统提示 | [处理管道](/01-Overview/processing-pipeline) |
| 插件核心与事件总线 | `src/core/plugin-core.ts`、`src/core/composition.ts`、`src/core/service.ts`、`src/core/event-bus.ts` | 创建核心容器、注册服务、按拓扑排序初始化并广播事件 | [服务架构](/01-Overview/service-architecture) |
| Hook 处理链 | `src/hooks/chat-message.ts`、`src/hooks/system-transform.ts`、`src/hooks/tool-before.ts`、`src/hooks/tool-after.ts` | 消息入站、系统提示构建、工具执行前后四个拦截点 | [处理管道](/01-Overview/processing-pipeline) |

## 图与编排

| 概念 | 模块 | 该模块负责什么 | 相关页面 |
|---|---|---|---|
| 图声明解析与校验 | `src/graph/parser-v2.ts`、`src/graph/validator-v2.ts` | 把 YAML/JSON 图文档解析成声明，并做结构校验 | [图声明参考](/04-Advanced/graph-declaration) |
| 拓扑模板 | `src/graph/templates.ts` | 三个内建拓扑的展开规则与自定义拓扑注册 | [工作流模式](/04-Advanced/workflow-patterns) |
| 引擎入口、状态与节点生命周期 | `src/graph/engine/index.ts`、`src/graph/engine/engine-state.ts`、`src/graph/engine/node-lifecycle.ts` | 创建运行时、持有图状态、提供生命周期方法并推进节点状态 | [图执行引擎](/04-Advanced/graph-engine)、[运行时行为](/04-Advanced/runtime-behavior) |
| join 与扇入 | `src/graph/engine/join-evaluator.ts` | 按 all / any / quorum 判定汇聚条件，并保留上游结果 | [运行时行为](/04-Advanced/runtime-behavior) |
| 信号传播与桥接 | `src/graph/engine/signal-propagation.ts`、`src/graph/engine/signal-bridge.ts` | 把带外信号翻译成边的激活与回边返工 | [信号系统](/04-Advanced/signal-system) |
| 循环组执行 | `src/graph/engine/loop-group-executor.ts` | 遍历计数与循环组的硬上限判定 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| 审批门 | `src/graph/engine/approval-handler.ts`、`src/graph/engine/approval-payload.ts` | 批准、拒绝与部分批准的状态变更，以及人工可见的审批载荷 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| 级联取消与预算闸 | `src/graph/engine/cascade-canceller.ts`、`src/graph/engine/budget-bridge.ts` | join 结算后取消多余上游；派发前检查预算上限 | [图工作流](/02-Guide/graph-workflows) |
| 持久化与事件日志 | `src/graph/engine/engine-persistence.ts`、`src/graph/engine/graph-events.ts` | 原子写入引擎状态；追加式记录节点派发、终态转换与阶段变化 | [运行时行为](/04-Advanced/runtime-behavior) |
| 每轮图状态块 | `src/graph/engine/graph-state-block.ts` | 渲染注入系统提示的图状态方位块 | [运行时行为](/04-Advanced/runtime-behavior) |
| 图工具注册 | `src/graph/tools/index.ts`、`src/graph/tools/graph-tools.ts`、`src/graph/tools/approve-tools.ts` | 八个命令式工具的 schema、逻辑与审批入口 | [编排工具](/03-Reference/tools/orchestration-tools) |

## 调度与运行时

| 概念 | 模块 | 该模块负责什么 | 相关页面 |
|---|---|---|---|
| 调度管理器、配置与看门狗 | `src/dispatch/core/manager.ts`、`src/dispatch/core/watchdog.ts`、`src/dispatch/config.ts` | 任务创建、并发与执行，配置白名单合并，僵死任务回收 | [调度配置](/03-Reference/dispatch-config) |
| 任务持久化与预算 | `src/dispatch/persistence/task-store.ts`、`src/dispatch/budget/budget-tracker.ts` | 任务状态落盘与预算采样 | [调度配置](/03-Reference/dispatch-config) |
| 检查点、进度与结果 | `src/dispatch/checkpoint/checkpoint-store.ts`、`src/dispatch/progress/progress-store.ts`、`src/dispatch/completion/result-extractor.ts` | 进度快照、进度报告，以及超长结果的侧车文件 | [CLI 参考](/03-Reference/cli) |
| 循环协调器与工具 | `src/loop/coordinator.ts`、`src/loop/worker-dispatch.ts`、`src/loop/loop-store.ts`、`src/loop/loop-tools.ts` | 轮次推链、取消、循环状态持久化与循环工具 | [循环系统](/04-Advanced/loop-system) |
| 函数解析与状态机 | `src/function/parser.ts`、`src/function/phase-machine.ts`、`src/function/conditions.ts` | 激活语法解析、门控与转换评估、条件表达式求值 | [函数规范](/02-Guide/writing-functions) |
| 函数运行时状态 | `src/function/runtime-state.ts`、`src/function/runtime-store.ts` | 会话内的函数状态与落盘的函数状态文件 | [函数系统](/02-Guide/functions) |

## 子系统

| 概念 | 模块 | 该模块负责什么 | 相关页面 |
|---|---|---|---|
| 记忆存储与检索 | `src/memory/store.ts`、`src/memory/search.ts`、`src/memory/schema.ts` | SQLite 记忆库的读写、检索与表结构 | [记忆系统](/04-Advanced/memory-system) |
| 记忆工具 | `src/memory/tools.ts` | 四个记忆工具的注册与参数处理 | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| 会话工具 | `src/session/session-browse-tools.ts`、`src/session/session-inspect-tools.ts` | 会话的列出与搜索，以及读取、差异与分叉 | [会话工具](/04-Advanced/session-tools) |
| 信号工具与词表 | `src/signal/signal-tool.ts`、`src/signal/signal-constants.ts` | 八种信号类型的唯一词表与信号工具入口 | [信号系统](/04-Advanced/signal-system) |
| 信号台账 | `src/signal/session-signal-ledger.ts`、`src/signal/signal-ledger.ts` | 会话级与函数级的信号写入记录 | [信号系统](/04-Advanced/signal-system) |
| 恢复引擎与策略 | `src/recovery/engine.ts`、`src/recovery/error-detection.ts`、`src/recovery/chain-executor.ts`、`src/recovery/strategies/` | 错误模式匹配、策略链执行，以及七个内置策略 | [恢复系统](/03-Reference/recovery-system)、[错误处理](/03-Reference/error-handling) |
| 恢复状态与指标 | `src/recovery/state.ts`、`src/recovery/metrics.ts` | 按会话持久化恢复状态与采集恢复指标 | [恢复系统](/03-Reference/recovery-system) |
| 通知管理器与调度 | `src/notifications/manager.ts`、`src/notifications/scheduler.ts` | 通知主流程、空闲检测与调度 | [通知系统](/04-Advanced/notification-system) |
| 通知通道与抑制 | `src/notifications/channels/`、`src/notifications/quiet-hours.ts`、`src/notifications/throttle.ts` | 六种投递通道、安静时段与频率限制 | [通知系统](/04-Advanced/notification-system) |
| Hashline 管线 | `src/hashline/hashline-read.ts`、`src/hashline/hashline-edit.ts`、`src/hashline/hash.ts`、`src/hashline/edit-ordering.ts`、`src/hashline/myers-diff.ts`、`src/hashline/diff.ts`、`src/hashline/atomic-write.ts` | 锚点读取与编辑管线：内容哈希、自底向上排序、差异与再锚定、原子落盘 | [Hashline 编辑](/04-Advanced/hashline-editing) |

## 平台、工具与命令行

| 概念 | 模块 | 该模块负责什么 | 相关页面 |
|---|---|---|---|
| 平台端口 | `src/platform/ports/session-client.ts`、`src/platform/ports/tool-factory.ts` | 宿主必须提供的会话与工具能力接口 | [插件接口](/03-Reference/plugin-interface) |
| 工具装配与能力门控 | `src/platform/tool-assembly.ts`、`src/platform/capabilities.ts` | 按平台能力决定工具集合并完成注册 | [平台工具](/03-Reference/tools/platform-tools) |
| 平台适配器 | `src/platform/adapters/opencode/`、`src/platform/adapters/pi/`、`src/platform/adapters/dsh/` | 三个宿主各自的端口实现与事件桥 | [平台与 Harness](/01-Overview/platform-harnesses) |
| 扩展注册与加载 | `src/extensions/registry.ts`、`src/extensions/loader.ts`、`src/extensions/extension-point.ts` | 七个作用域的注册表、模块加载与扩展点契约 | [扩展机制](/03-Reference/extensions) |
| LSP 工具 | `src/lsp/client-manager.ts`、`src/lsp/tools/` | 语言服务器的生命周期，以及诊断、导航、符号与重构工具 | [LSP 工具](/03-Reference/tools/lsp-tools) |
| 资产、网络与终端工具 | `src/asset/asset-inspect.ts`、`src/asset/asset-search.ts`、`src/asset/asset-validate.ts`、`src/web/web-search.ts`、`src/web/web-fetch.ts`、`src/terminal/interactive-terminal-tool.ts` | 资产的查询、检索与校验，联网读取，以及交互式终端 | [平台工具](/03-Reference/tools/platform-tools) |
| CLI 入口、子命令与模板 | `src/cli/main.ts`、`src/cli/commands/init.ts`、`src/cli/commands/memory.ts`、`src/cli/templates/minimal.ts`、`src/cli/templates/standard.ts`、`src/cli/templates/subagents.ts` | 十四个子命令的注册与实现入口，以及 `rolebox init` 的三套模板 | [CLI 参考](/03-Reference/cli) |
| 状态路径与全局常量 | `src/utils/state-paths.ts`、`src/constants.ts` | 状态文件路径推导，以及函数默认值、节点状态等全局常量 | [目录结构](/01-Overview/directory-structure) |

---

索引到这里为止。想看模块之间的分层理由，读[架构概览](/01-Overview/architecture-overview)；想改这些模块，读[贡献指南](/05-Contributing/contributing)。
