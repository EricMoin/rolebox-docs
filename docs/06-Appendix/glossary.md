---
title: 术语表
description: rolebox 文档全站术语的唯一定义表：按主题分组，每条给出中英文术语、一句话定义与首次出现页面。
---

# 术语表（Glossary）

这一页回答「文档里的这个词是什么意思」。**术语表是全站唯一定义表**：正文里每个术语在首次出现处就地解释一次，之后直接使用；本页把它们按主题汇总，方便集中查找与横向对照。

> 相关：[源码索引](/06-Appendix/source-index)｜[迁移对照](/06-Appendix/migration)｜[文档首页](/)

## 角色与资产

| 术语 | 一句话定义 | 首次出现 |
|---|---|---|
| **角色（role）** | 一个含 `role.yaml` 的目录，定义一个代理的人格、能力与团队。 | [创建角色](/02-Guide/create-a-role) |
| **角色目录（role directory）** | 存放 `role.yaml`、提示词、`skills/`、`functions/`、`references/` 的目录，目录名就是角色 id。 | [目录结构](/01-Overview/directory-structure) |
| **`role.yaml`** | 角色的声明文件：身份字段必需，能力、编排与权限字段可选。 | [role.yaml 参考](/03-Reference/role-yaml) |
| **提示词文件（prompt file）** | 由 `prompt_file` 指向的外部 Markdown，每次会话全文进入系统提示。 | [教程 02](/02-Guide/tutorial/02-first-role) |
| **技能（skill）** | 一个含 `SKILL.md` 的目录；常驻上下文的只有名字与描述，正文按需加载。 | [技能系统](/02-Guide/skills) |
| **引用文档（reference）** | `references/` 下的 Markdown；元数据常驻，正文在真的需要时才读入。 | [引用文档](/02-Guide/references) |
| **渐进式披露（progressive disclosure）** | 先只告诉模型「有什么、什么时候用」，正文等真正需要时再取。 | [教程 02](/02-Guide/tutorial/02-first-role) |
| **函数（function）** | 一段按需注入系统提示的行为模块，用行首前缀激活，可带门控、参数与状态转换。 | [函数系统](/02-Guide/functions) |
| **激活语法（activation syntax）** | 写在消息行首、用竖线包裹函数名的前缀，把函数在本次会话中打开。 | [函数系统](/02-Guide/functions) |
| **内置函数（built-in function）** | 每个角色都有的三个函数：`plan`、`execute`、`loop`。 | [函数系统](/02-Guide/functions) |
| **合并语义（merge semantics）** | `functions:` 只往默认清单里追加，移除必须用 `disable_functions`。 | [role.yaml 参考](/03-Reference/role-yaml) |
| **子代理（subagent）** | 由父角色声明、在独立会话中执行任务的代理，id 形如 `父角色--子代理`；未声明的字段从父角色继承。 | [子代理](/02-Guide/subagents) |
| **父角色 / 编排器（parent role / orchestrator）** | 声明子代理、并把工作派发出去的那个角色。 | [教程 04](/02-Guide/tutorial/04-team) |
| **角色模板（template）** | `rolebox init` 可选的角色骨架，决定生成哪些文件与字段。 | [CLI 参考](/03-Reference/cli) |
| **注册中心（registry）** | 用 `registry.yaml` 发布与分发角色的仓库。 | [注册中心](/03-Reference/registry) |
| **资产（asset）** | 角色目录下可单独检索与校验的内容单元，例如技能与引用文档。 | [工具目录](/03-Reference/tool-catalog) |

## 图与编排

| 术语 | 一句话定义 | 首次出现 |
|---|---|---|
| **图（graph）** | 由 `graph_create` 创建、用 `graph_id` 寻址的编排容器。 | [图工作流](/02-Guide/graph-workflows) |
| **节点（node）** | 图中一次派发给某个代理的工作，内容是一个「代理 + 提示词」元组。 | [图工作流](/02-Guide/graph-workflows) |
| **边（edge）** | 节点之间的流转关系 `from → to`；节点本身不定义顺序，顺序由边决定。 | [图工作流](/02-Guide/graph-workflows) |
| **边触发方式（edge trigger）** | `always`（上游一有结果就激活）、`on_signal`（收到指定信号）、`on_condition`（条件为真）。 | [图工作流](/02-Guide/graph-workflows) |
| **join 评估（join evaluation）** | 判断一个节点的上游输入是否齐备、从而能否开始执行的评估。 | [图执行引擎](/04-Advanced/graph-engine) |
| **汇聚策略（join strategy）** | join 的判据：`all`（默认）、`any`、`quorum`（需给定数量，且不得超过该节点的入度）。 | [编排工具](/03-Reference/tools/orchestration-tools) |
| **工作流模式（workflow pattern）** | 对「谁先做、谁后做、谁可并行、谁能打回」的结构化表达，只决定边的形状。 | [工作流模式](/04-Advanced/workflow-patterns) |
| **拓扑（topology）** | 图的预设结构模式；保留 `pipeline`、`review-loop`、`star` 三个内建名字。 | [工作流模式](/04-Advanced/workflow-patterns) |
| **`parent`（编排器节点）** | 内建拓扑展开时使用的保留节点名；命令式图没有隐式的 `parent`。 | [工作流模式](/04-Advanced/workflow-patterns) |
| **图声明（graph declaration）** | 描述节点、边、循环组与预算的 YAML/JSON 文档，与 `role.yaml` 的角色级 `graph` 键不是一回事。 | [图声明参考](/04-Advanced/graph-declaration) |
| **循环组（loop group）** | 被声明成一个有界循环的一组节点，受最大遍历次数硬上限保护。 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| **`max_traversals`** | 循环组的硬性遍历上限；触顶后回边不再生效，成员节点升级为 `escalate`。 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| **审批门（approval gate / HITL）** | 节点在需要人工确认处暂停、等批准后再继续的机制。 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| **`needs_approval`** | 节点声明字段，标记「需要人工批准」；命中后节点停在 `blocked`。 | [教程 06](/02-Guide/tutorial/06-approval-and-loop) |
| **非阻塞运行（non-blocking run）** | `graph_run` 派发完就绪根节点就返回，不等它们跑完；调用方应随即结束当前回合。 | [教程 05](/02-Guide/tutorial/05-graph) |
| **图中断提醒（graph reminder）** | 引擎在全部节点结束或有人工审批待办时注入会话的系统提醒。 | [教程 05](/02-Guide/tutorial/05-graph) |
| **级联取消（cascade cancel）** | 取消一个节点时，连带取消它传递下游的节点。 | [图工作流](/02-Guide/graph-workflows) |
| **预算（budget）** | 一张图允许消耗的上限，耗尽后不再派发新节点。 | [图声明参考](/04-Advanced/graph-declaration) |
| **数据透传（data passthrough）** | 边把上游结果按字段筛选或裁剪后交给下游的机制。 | [编排工具](/03-Reference/tools/orchestration-tools) |
| **图工具（graph tools）** | 8 个命令式建图与运行工具，覆盖创建、加节点、连边、运行、观测、审批与取消。 | [编排工具](/03-Reference/tools/orchestration-tools) |
| **终止条件（termination，已移除）** | 声明式图里决定循环何时停止的配置；已随声明式工作流整体移除，现存终止语义见迁移对照。 | [迁移对照](/06-Appendix/migration) |
| **循环终止字段（已移除）** | `max_iterations`、`result_matches`、`converged`、`stuck` 四种声明式终止条件，已全部移除。 | [迁移对照](/06-Appendix/migration) |
| **协作图（已移除）** | `role.yaml` 里声明拓扑与代理列表的配置块，已随声明式工作流移除。 | [协作图（已移除）](/02-Guide/collaboration-graph) |

## 运行时与调度

| 术语 | 一句话定义 | 首次出现 |
|---|---|---|
| **派发（dispatch）** | 把一段提示词交给某个代理执行的过程；由调度管理器负责生命周期、并发与结果收集。 | [教程 05](/02-Guide/tutorial/05-graph) |
| **任务（task）** | 一次派发在调度器里的生命周期载体，用任务 id 追踪状态、进度与结果。 | [调度配置](/03-Reference/dispatch-config) |
| **看门狗（watchdog）** | 周期性核对后台任务状态、回收僵死任务的定时器。 | [调度配置](/03-Reference/dispatch-config) |
| **并发槽位（concurrency slot，已移除）** | 旧版按模型限制同时在跑的任务数的子系统；已移除，并发度改由图引擎自管。 | [调度配置](/03-Reference/dispatch-config) |
| **背压（backpressure，已移除）** | 旧版在槽位满载时让调用方排队或延迟重试的保护机制；已随并发槽位子系统移除。 | [调度配置](/03-Reference/dispatch-config) |
| **检查点（checkpoint）** | 任务执行期间保存的进度快照，重试时可注入，避免重复已完成的工作。 | [CLI 参考](/03-Reference/cli) |
| **状态文件（state file）** | `.rolebox/state/` 下按内容哈希命名的运行时状态；结果超出内联限制时另落一份侧车文件。 | [目录结构](/01-Overview/directory-structure) |
| **函数状态机（FSM）** | 驱动函数在 inactive / gated / active / complete 等状态间转换的模型。 | [函数规范](/02-Guide/writing-functions) |
| **门控（gate）** | 函数满足特定条件后才被激活的机制；未满足前保持 gated 状态。 | [函数规范](/02-Guide/writing-functions) |
| **状态转换（transitions）** | 条件满足时激活或停用其它函数的规则，用于跨函数编排。 | [函数规范](/02-Guide/writing-functions) |
| **自动延续（continue_until）** | 满足即把函数标记为完成、停止自动延续的条件。 | [函数规范](/02-Guide/writing-functions) |
| **观察器（observe）** | 挂在消息等生命周期事件上运行、并把结果作为校正回注系统提示的钩子。 | [函数规范](/02-Guide/writing-functions) |
| **制品（artifact）** | 函数声明产生或消费的命名产物，例如 plan 阶段的计划文本。 | [函数规范](/02-Guide/writing-functions) |
| **条件表达式（condition expression）** | 门控与延续里使用的判定表达式，例如查询「是否观察到某类信号」的 `signal_observed`。 | [函数规范](/02-Guide/writing-functions) |
| **信号（signal）** | 不嵌入文本、独立传递的控制信令；共 8 种，分终止、暂停、移交、信息四类。 | [信号系统](/04-Advanced/signal-system) |
| **信号类型（signal type）** | `answer`、`need_approval`、`blocked`、`need_clarification`、`handoff`、`progress`、`revise_needed`、`escalate`。 | [信号系统](/04-Advanced/signal-system) |
| **信号台账（signal ledger）** | 按会话或函数记录的信号写入历史；信号在裸子代理会话中依然存活。 | [信号系统](/04-Advanced/signal-system) |
| **信号传播（signal propagation）** | 节点完成时引擎沿边把信号传给下游，无轮询地解锁满足条件的节点。 | [图执行引擎](/04-Advanced/graph-engine) |
| **节点生命周期（NodeStatus）** | 节点从注册到结束的状态序列，正常路径是 pending → ready → running → completed → done。 | [运行时行为](/04-Advanced/runtime-behavior) |
| **引擎生命周期（EnginePhase）** | 一次图执行的阶段：`idle`、`executing`、`complete`。 | [图执行引擎](/04-Advanced/graph-engine) |
| **引擎运行时（EngineRuntime / EngineState）** | 承载一次图执行的对象与它持有的状态，提供初始化、运行、恢复与采纳既有进度等方法。 | [图执行引擎](/04-Advanced/graph-engine) |
| **循环协调器（LoopCoordinator）** | 驱动 `loop` 函数顺序多轮执行、并负责取消与持久化恢复的组件。 | [循环系统](/04-Advanced/loop-system) |
| **记忆（memory）** | 写在项目 `.rolebox/memory.db` 里、会话启动时按相关度回注给角色的持久条目。 | [教程 07](/02-Guide/tutorial/07-memory) |
| **记忆作用域（memory scope）** | `workspace`（项目共享）与 `role`（写入者自己的角色）；两者同库，按作用域过滤而不是按权限隔离。 | [教程 07](/02-Guide/tutorial/07-memory) |
| **会话（session）** | 一次对话的上下文与它的持久化记录；记忆与它不同，跨会话存活。 | [会话工具](/04-Advanced/session-tools) |
| **会话工具（session tools）** | 六个检索与管理会话的工具：列表、读取、搜索、信息、差异、分叉。 | [会话与记忆工具](/03-Reference/tools/session-memory-tools) |
| **恢复策略（recovery strategy）** | 错误发生时系统自动执行的补救动作，例如重试、压缩上下文、换模型。 | [错误处理](/03-Reference/error-handling) |
| **策略链（strategy chain）** | 把多个恢复策略按顺序串起来，错误发生时逐个尝试，直到恢复成功或链耗尽。 | [错误处理](/03-Reference/error-handling) |
| **错误检测（error detection）** | 先判断错误属于哪一类，再据此选择对应的策略链。 | [错误处理](/03-Reference/error-handling) |
| **通知（notification）** | 由空闲、出错、审批待办等事件触发的外发消息，可配安静时段与频率限制。 | [通知系统](/04-Advanced/notification-system) |
| **通知通道（notification channel）** | 通知的投递方式：系统提示、声音、自定义命令、Webhook、文件、日志。 | [通知系统](/04-Advanced/notification-system) |
| **Hook** | 在特定生命周期事件（消息、工具执行前后等）触发并注入自定义逻辑的机制。 | [Hook 机制](/03-Reference/hooks) |
| **HookContext API** | 传给每个 Hook 处理器的上下文对象，暴露会话、配置与注入能力。 | [Hook 机制](/03-Reference/hooks) |
| **扩展点（extension point）** | rolebox 预留给自定义模块接入的位置；每个扩展作用域对应一类扩展点。 | [扩展机制](/03-Reference/extensions) |
| **扩展作用域（ExtensionScope）** | 可扩展的 7 个封闭词汇表：条件、图拓扑、恢复策略、恢复模式、通知通道、通知事件、观察事件。 | [扩展机制](/03-Reference/extensions) |

## 平台与 Harness

| 术语 | 一句话定义 | 首次出现 |
|---|---|---|
| **Harness（宿主）** | 承载 rolebox 插件的宿主程序，支持 opencode、pi、dsh 三种。 | [平台与 Harness](/01-Overview/platform-harnesses) |
| **平台端口（platform ports）** | rolebox 依赖的宿主能力接口，例如会话客户端、工具工厂与技能面。 | [插件接口](/03-Reference/plugin-interface) |
| **平台适配器（platform adapter）** | 把某个宿主的能力翻译成平台端口的实现层。 | [插件接口](/03-Reference/plugin-interface) |
| **平台门控（platform gating）** | 按宿主与平台能力决定某个工具是否可用。 | [平台工具](/03-Reference/tools/platform-tools) |
| **PluginCore** | rolebox 插件的核心容器：服务注册、事件总线与工具注册的汇合点。 | [架构概览](/01-Overview/architecture-overview) |
| **组合根（composition root）** | 程序启动时把全部依赖组件装配起来的位置。 | [架构概览](/01-Overview/architecture-overview) |
| **拓扑排序（topological sort）** | 按依赖关系决定初始化顺序：先初始化被依赖的服务，再初始化依赖它的服务。 | [架构概览](/01-Overview/architecture-overview) |
| **Role Loader / Role Resolver** | 加载器扫描角色目录发现 `role.yaml`；解析器把角色解析出技能、引用、函数与子代理。 | [架构概览](/01-Overview/architecture-overview) |
| **引导链（bootstrap chain）** | 从插件入口到返回 hook handler 的固定启动顺序。 | [架构概览](/01-Overview/architecture-overview) |
| **事件总线（event bus）** | 服务之间广播与订阅事件的通道。 | [服务架构](/01-Overview/service-architecture) |
| **处理管道（processing pipeline）** | 消息从入站、系统提示构建、工具执行到函数解析与恢复的固定阶段序列。 | [处理管道](/01-Overview/processing-pipeline) |
| **图执行引擎（graph engine）** | rolebox 统一的多代理编排引擎：把「谁把工作传给谁」建模成有向图来执行。 | [图执行引擎](/04-Advanced/graph-engine) |
| **LSP 工具（code intelligence）** | 通过语言服务器提供的诊断、导航、符号与重构工具集。 | [LSP 工具](/03-Reference/tools/lsp-tools) |
| **Hashline 编辑（hashline editing）** | 用「行号 + 内容哈希」锚点定位文本的编辑方式；行内容一变，锚点即失配。 | [Hashline 编辑](/04-Advanced/hashline-editing) |
| **锚点（anchor）** | Hashline 编辑里的定位标记，由行号与内容哈希组成。 | [Hashline 编辑](/04-Advanced/hashline-editing) |
| **内容哈希（content hash）** | 由行内容算出的短哈希；行内容变化后旧锚点会被拒绝，而不是静默改错行。 | [Hashline 编辑](/04-Advanced/hashline-editing) |
| **工具（tool）** | 暴露给模型调用的具名能力；与函数的分工见工具目录。 | [工具目录](/03-Reference/tool-catalog) |
| **模型别名（model alias）** | 把别名映射到真实模型 ID 的配置；解析优先级与热重载规则见参考页。 | [模型别名](/03-Reference/model-aliases) |

## 文档与流程

| 术语 | 一句话定义 | 首次出现 |
|---|---|---|
| **文档分层（Tutorial / Guide / Reference / Internals / Appendix）** | 按读者任务划分的五层：教程带你跑通、指南给配方、参考查语义、内部实现讲为什么、附录放术语与出处。 | [教程总览](/02-Guide/getting-started) |
| **迁移对照（migration）** | 旧写法到新写法的逐条映射；迁移是配置改写，不是执行一条命令。 | [迁移对照](/06-Appendix/migration) |
| **历史设计记录（design decision archive）** | 记录当时设计取舍的存档页，保留原文规模，不是当前 API 参考。 | [记忆策略（历史）](/04-Advanced/design-decisions/memory-strategy) |
| **提交消息规范（Conventional Commits）** | 贡献流程里约定的提交消息格式，变更日志据此归类。 | [贡献指南](/05-Contributing/contributing) |
| **变更日志（CHANGELOG）** | 按版本记录变更的文件；发布流程据此生成 Release 说明。 | [贡献指南](/05-Contributing/contributing) |

---

术语在正文里首次出现时就地解释；本页只是它们的总目录。找某个行为由哪个模块负责，看[源码索引](/06-Appendix/source-index)。
