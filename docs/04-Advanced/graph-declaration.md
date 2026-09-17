---
title: 图声明参考
description: "图文档（YAML/JSON）规范——信封、version、节点/边/循环组/预算字段、结构校验规则、序列化往返与拓扑模板原语"
---

# 图声明参考（Graph Declaration）

**图声明（graph declaration，schema 版本固定为 `2` 的图文档）**用一个顶层 `graph:` 信封描述一张图的节点、边、循环组与预算。本页是这份文档的字段规范：哪些键可以出现、每个键接受什么值、什么情况下会被结构校验拒绝，以及它如何被序列化回 YAML。

先记住一条边界：**图文档（graph document）不等于 `role.yaml` 的角色级 `graph:` 键**。两者同名，但不是一回事——图文档描述一张完整的图，角色级 `graph:` 只是一个编排引擎选择器。区别见下文「与角色级 graph: 键的区别」一节。

> 相关：[图工作流](/02-Guide/graph-workflows)（用 `graph_*` 工具把图搭出来并运行）｜[图执行引擎](/04-Advanced/graph-engine)（引擎如何消费这份声明）｜[role.yaml 参考](/03-Reference/role-yaml)（角色级 `graph:` 键）｜[编排工具](/03-Reference/tools/orchestration-tools)（每个 `graph_*` 工具的参数表）

## 最小示例

一份可校验的图文档只需要三样东西：顶层 `graph:`、`version: 2`、以及节点与边。

```yaml
graph:
  version: 2
  name: feature-delivery
  nodes:
    - { id: design,    agent: my-role--architect, prompt: 产出接口设计与验收标准 }
    - { id: implement, agent: my-role--backend,   prompt: 按设计实现并自测 }
    - { id: review,    agent: my-role--reviewer,  prompt: 独立复核实现与证据 }
  edges:
    - { from: design, to: implement, type: always }
    - { from: implement, to: review, type: on_signal, signal_filter: [answer] }
```

`design → implement` 是一条无条件边；`implement → review` 只在 `implement` 发出 `answer` 信号时才激活。把同样三个节点、两条边在运行时搭出来的操作步骤见[图工作流](/02-Guide/graph-workflows)。

下面这份更完整的文档用上了边触发方式、revise 回边、透传映射、重试、循环组与图级预算：

```yaml
graph:
  version: 2
  name: feature-delivery
  nodes:
    - { id: design,    agent: my-role--architect, prompt: 产出接口设计与验收标准 }
    - { id: implement, agent: my-role--backend,   prompt: 按设计实现并自测 }
    - { id: review,    agent: my-role--reviewer,  prompt: 独立复核实现与证据 }
  edges:
    - { from: design, to: implement, type: always }
    - { from: implement, to: review, type: on_signal, signal_filter: [answer] }
    - from: review
      to: implement
      type: on_signal
      signal_filter: [revise_needed]
      data_passthrough: { include: [findings], max_chars: 2000 }
      retry: 1
  loop_groups:
    - { id: impl-review, nodes: [implement, review], max_traversals: 3 }
  budget: { max_total_cost_usd: 12 }
```

评审节点发出 `revise_needed` 时，这条回边把实现打回重做，并把 `findings` 字段（超过 2000 字符截断）透传给下一轮 `implement`；`impl-review` 循环组给这个环一个 3 次的硬上限。

## 与角色级 `graph:` 键的区别

`role.yaml` 也接受一个角色级的 `graph:` 块，但它**不是**本页描述的图文档。两者只共享一个名字：

| 维度 | 图文档（本页） | 角色级 `graph:` 键 |
|---|---|---|
| 出现位置 | 独立的 YAML/JSON 图文档 | `role.yaml` 的顶层键 |
| 形状 | `version` + `nodes` + `edges`（+ 循环组、预算） | 只有 `orchestration` 一个子键 |
| 合法值 | 见下文字段表 | 目前唯一合法值 `graph_v2` |
| 作用 | 描述一张完整、可校验、可序列化往返的图 | 编排引擎选择器 |
| 运行时效果 | 引擎消费的正是它 | 角色加载器识别并告警，尚未接入图解析，没有任何运行时效果 |
| 规范页 | 本页 | [role.yaml 参考](/03-Reference/role-yaml) |

角色级 `graph:` 的完整行为：只认一个合法值 `graph_v2`；解析结果挂到角色的 `graph.orchestration`；同时打印一条明确警告——该键已被识别，但尚未接入图解析、没有运行时效果。缺少 `orchestration` 或值未知时，同样警告并忽略，不会静默丢弃：

```yaml
# role.yaml —— 角色级 graph: 键（只是一个选择器）
graph:
  orchestration: graph_v2
```

要真正构建并运行一张图，请用命令式的 `graph_*` 工具（见[图工作流](/02-Guide/graph-workflows)）。

## 文档信封与版本

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `graph` | object | 无（推荐） | 主键；文档的唯一信封 | `graph: { version: 2 }` |
| `dag` | object | 无 | legacy 别名；`graph:` 缺失时回退到它 | `dag: { version: 2 }` |
| `version` | number | 无（校验期必填） | 必须等于 `2` | `version: 2` |
| `name` | string | `unnamed-graph` | 图名，用于日志与 `graph_status` 显示 | `name: feature-delivery` |
| `nodes` | array | `[]` | 节点数组 | `nodes: [{ id: design }]` |
| `edges` | array | `[]` | 边数组 | `edges: [{ from: design, to: implement }]` |
| `loop_groups` | array | `[]` | 有界循环组数组 | `loop_groups: [{ id: impl-review }]` |
| `budget` | object | 无 | 图级累计预算 | `budget: { max_total_cost_usd: 12 }` |

解析期对格式是宽容的，但宽容有边界：缺少 `version` 不会立刻报解析错误，而是留到结构校验期报「missing required field "version"」；`nodes` / `edges` / `loop_groups` 写成非数组会得到解析错误 `"nodes" must be an array`（其余两个字段同理）；`name` 缺失回落为 `unnamed-graph`；空的 `loop_groups` 与空的 `budget` 不会进入最终声明。文档为空、或根不是对象，同样会被直接拒绝。

## 节点（Node）

每个节点都是角色无关的 `{id, agent, prompt}` 元组——没有类型字段，也没有节点分类。一个节点是计划者、实现者、评审者还是审批门，完全由 `prompt` 与所派发的 `agent` 决定。

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `id` | string | 无（必填） | 图内唯一标识；重复由结构校验报错 | `id: design` |
| `agent` | string | 无（必填） | 承接该节点的可派发代理标识 | `agent: my-role--backend` |
| `prompt` | string | 无（必填） | 交给该代理的任务指令 | `prompt: 按设计实现并自测` |
| `completion_condition` | string | 无 | 来自条件词表的命名条件；成立即标记该节点完成 | `completion_condition: evidence_met()` |
| `needs_approval` | boolean | `false` | 执行后暂停、等待人工审批 | `needs_approval: true` |
| `join` | object | 无 | 扇入汇聚策略（见「边」一节） | `join: { strategy: all }` |
| `budget` | object | 无 | 节点级资源预算（见「预算」一节） | `budget: { max_retries: 1 }` |

两个容易踩的点：

- `needs_approval` 是一个**暂停标志**，不是节点类型（它取代了早期模型里的 `human_gate` 节点）。这类节点只允许非 `always` 的出边——审批通过后靠信号或条件边继续；写一条 `always` 出边会被结构校验直接拒绝。
- `needs_approval` 写成 YAML 字符串 `"true"` / `"false"` 也会被识别为布尔值。

```yaml
nodes:
  - id: finalize
    agent: my-role--doc-writer
    prompt: 汇总评审结论并定稿
    needs_approval: true
    completion_condition: evidence_met()
    join: { strategy: all }
    budget: { timeout_ms: 0, max_retries: 1 }
```

## 边（Edge）

边同时承载结构与行为：既是 `from → to` 的数据流，也是信号路由。

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `from` | string | 无（必填） | 源节点 id；必须引用已声明节点 | `from: review` |
| `to` | string | 无（必填） | 目标节点 id；必须引用已声明节点 | `to: implement` |
| `type` | string | `always` | 激活语义：`always` / `on_signal` / `on_condition` | `type: on_signal` |
| `signal_filter` | string[] | 无 | `on_signal` 边：只有列出的信号类型能激活它 | `signal_filter: [revise_needed]` |
| `condition` | string | 无 | `on_condition` 边：已注册的命名条件 | `condition: evidence_met()` |
| `data_passthrough` | object | 无（全量透传） | 向下游透传的数据子集 | `data_passthrough: { max_chars: 2000 }` |
| `retry` | number 或 object | 无 | 升级（escalate）时的自动重试策略 | `retry: 1` |
| `label` | string | 无 | 仅类型层元数据；解析期不映射，写进文档没有效果 | `label: loop` |

`type` 的三种取值：`always` 无条件激活；`on_signal` 由源节点发出的信号类型激活；`on_condition` 由命名条件求值为真激活。

```yaml
edges:
  - { from: design, to: implement, type: always }
  - { from: implement, to: review, type: on_signal, signal_filter: [answer] }
  - from: review
    to: implement
    type: on_signal
    signal_filter: [revise_needed]
    data_passthrough: { include: [findings], max_chars: 2000 }
    retry: { max: 2, backoff_ms: 500 }
  - { from: review, to: finalize, type: on_condition, condition: evidence_met() }
```

关于 `signal_filter` 有一个文档层与工具层的差异：文档里的 `on_signal` 边不强制写 `signal_filter`，但缺省时引擎按空列表匹配，这条边永不激活；工具层的 `graph_add_edge` 会直接拒绝没有 `signal_filter` 的 `on_signal` 边。写文档时请显式给出。

`retry` 支持两种写法：裸数字 `retry: 3` 等价于 `{ max: 3 }`，或 `{ max, backoff_ms }`。重试是**边**的属性而非节点属性：它同时覆盖边两端节点在 escalate 时的自动重试；某个节点自身的有效重试预算，取该节点 `budget.max_retries` 与它所有关联边 `retry.max` 的较大值。

### 透传映射（data_passthrough）

| YAML 写法 | 语义 | 示例 |
|---|---|---|
| `include` | 字段白名单；为空表示全量透传 | `include: [findings, diff]` |
| `exclude` | 字段黑名单；按名剔除字段，也剔除同名的制品路径 | `exclude: [raw_logs]` |
| `max_chars` | 把下游 `result` 截断到 N 个字符；必须非负 | `max_chars: 2000` |

### join（扇入汇聚）

| YAML 写法 | 解析结果 | 语义 | 示例 |
|---|---|---|---|
| `join: all` | `{ strategy: "all" }` | 等所有上游发出 `answer` | `join: all` |
| `join: any` | `{ strategy: "any" }` | 任一上游发出 `answer` 即可继续 | `join: any` |
| `join: quorum:2` | `{ strategy: "quorum", quorum: 2 }` | N 个上游发出 `answer` 后继续 | `join: quorum:2` |

`quorum:N` 的匹配大小写不敏感，也允许 `quorum : 2` 这样的空白；`all` 与 `any` 必须精确匹配。校验期还要求 `quorum` 是不超过该节点入度的正整数——节点暂时没有任何入边时，上界检查会推迟到第一条入边出现之后。

## 循环组（Loop Group）

图整体仍是 DAG：环只能存在于显式声明的循环组里。

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `id` | string | 无（必填） | 循环组唯一标识 | `id: impl-review` |
| `nodes` | string[] | 无（必填） | 参与循环的节点 id；必须是已声明节点 | `nodes: [implement, review]` |
| `max_traversals` | number | 无（必填） | **硬性遍历上限**，防止无限循环 | `max_traversals: 3` |
| `mode` | string | 无（继承默认行为） | `inherit` 是唯一真实模式；`fresh` 文档化不支持，请求即显式报错 | `mode: inherit` |

```yaml
loop_groups:
  - { id: impl-review, nodes: [implement, review], max_traversals: 3, mode: inherit }
```

三条结构约束：每个被声明的循环组必须真的在它的成员节点上构成有向环（否则报错）；一个节点最多属于一个循环组（跨组重叠报错）；循环组必须有来自组外的入口，否则该组不可达、运行时必然死锁。

## 预算（Budget）

节点级预算：

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `max_input_tokens` | number | 无 | 该节点的输入 token 上限 | `max_input_tokens: 50000` |
| `max_output_tokens` | number | 无 | 该节点的输出 token 上限 | `max_output_tokens: 8000` |
| `max_cost_usd` | number | 无 | 该节点的累计成本上限（美元） | `max_cost_usd: 2.5` |
| `timeout_ms` | number | 无 | 该节点的墙钟超时；`0` 合法，表示关闭停滞看门狗 | `timeout_ms: 600000` |
| `max_retries` | number | 无 | escalate 时的自动重试次数；必须是非负整数 | `max_retries: 1` |

图级预算（所有节点的累计上限）：

| 字段 | 类型 | 默认值 | 说明 | 示例 |
|---|---|---|---|---|
| `max_total_input_tokens` | number | 无 | 全图输入 token 上限 | `max_total_input_tokens: 200000` |
| `max_total_output_tokens` | number | 无 | 全图输出 token 上限 | `max_total_output_tokens: 40000` |
| `max_total_cost_usd` | number | 无 | 全图累计成本上限（美元） | `max_total_cost_usd: 12` |

编排方可以把图预算再分配给子节点，允许超额预订（各节点预算之和可以超过图预算），但实际消耗以图预算为界。

## 结构校验规则

校验只看**结构**，从不检查 `agent` 是否是已知的可派发标识（那是环境与绑定问题），也没有任何节点类型检查。文档从文本到可执行声明的完整管线（谁在什么阶段调用解析器与校验器）属于引擎实现，见[图执行引擎](/04-Advanced/graph-engine)；本页只定义被校验的规则本身。

| # | 规则 | 违反后果 |
|---|---|---|
| 1 | `version` 存在且等于 `2` | 缺失或非 2：ERROR |
| 2 | 节点 id 在图内唯一 | 重复的 id 逐个报 ERROR |
| 3 | 边两端的 `from` / `to` 都引用已声明节点 | 未声明的端点：ERROR |
| 4 | `on_condition` 边的 `condition` 来自已注册条件词表；缺失或为空同样报错 | 未知条件名：ERROR（错误信息会列出全部合法条件名） |
| 5 | 循环组 id 唯一、成员是已声明节点、成员不跨组重叠 | 任一违反：ERROR |
| 6 | 循环包含：声明的循环组必须真的构成有向环；图中的每个环必须被至少一个循环组覆盖 | 循环组不构成环：ERROR；未覆盖的环：按校验模式判 WARNING 或 ERROR |
| 7 | `needs_approval` 节点只允许非 `always` 的出边 | 出现 `always` 出边：ERROR |
| 8 | `data_passthrough.max_chars` 非负 | 负数：ERROR |
| 9 | 根可达：过滤 revise 回边后，若没有任何入度为零的节点且声明了循环组，则图没有入口；循环组若没有来自组外的入口则不可达 | 无入口 + 有循环组：ERROR；无入口 + 无循环组：WARNING；循环组无外部入口：ERROR |
| 10 | `join.quorum` 是不超过该节点入度的正整数 | 非正数或超过入度：ERROR（节点尚无入边时暂缓上界检查） |
| 11 | 节点预算边界：`timeout_ms` 非负、`max_retries` 非负整数 | 违规：ERROR |

校验有两种模式：

- **`construct`（默认）**——增量构建。未覆盖的环只是 WARNING：构建方可以先加收尾边、后声明循环组，两种顺序都不应失败。
- **`execution`**——图即将运行。**不含** revise 回边（`on_signal` + `signal_filter: [revise_needed]`）的纯环或自环被提升为 ERROR，因为这种环永远无法激活、运行时必然死锁；含 revise 回边的未覆盖环仍是 WARNING——那正是把节点拉进循环组的规范写法。从文件加载一份图文档时按 execution 模式校验，因此「能解析、跑不起来」的文档会在加载期被拒绝，而不是留到运行时才死锁。

## 序列化与往返

序列化与解析互为逆过程：声明写成 `{ graph: … }` 信封的 YAML，重新解析后得到同一份声明（解析期本就不映射的字段除外，见下文的 `template` 提示）。序列化输出刻意保持「干净」：不自动换行、不为共享引用生成 `&idN` 别名、保留字段的书写顺序。因此导出的文件就是一份普通的图文档——形状正是本页描述的这套 schema。

运行时的导出入口是 `graph_status` 的 `export_path`：当既没有指定 `node_id` 也没有指定 `include_metrics` 时，它把该图的声明序列化为 YAML 并**原子写入**目标路径（先写同目录临时文件再改名，读者不会看到写了一半的文件），返回文本里同时带上完整的序列化结果。参数细节见[编排工具](/03-Reference/tools/orchestration-tools)。

目前没有面向用户的「从文件导入一张图」命令：图在运行时由 `graph_*` 工具构建，`export_path` 是文档的写出方向。

## 拓扑模板原语

内置拓扑只有三个。展开规则里的 `agents = [a1, a2, a3]`，而 `parent` 是编排器的保留节点名：

| 拓扑 | 生成的边 | 三个代理时的形状 |
|---|---|---|
| `pipeline` | `parent → a1 → a2 → … → an → parent`（末边标记 exit） | `parent → a1 → a2 → a3 → parent` |
| `review-loop` | `parent → a1 → … → an`，再加 `an → a1`（loop）与 `an → parent`（exit） | `parent → a1 → a2 → a3`，`a3 → a1`，`a3 → parent` |
| `star` | 每个 `ai` 都是 `parent → ai → parent`（exit） | `parent → a1 → parent`、`parent → a2 → parent`、`parent → a3 → parent` |

模板展开是一个纯函数：输入拓扑名与代理列表，输出一组规范边；代理列表为空时返回空边集。未知拓扑名会直接报错 `Unknown template topology: …`。它只定义形状，不建图、不派发。

自定义拓扑通过 `graph_topologies` 扩展点注册：在 `role.yaml` 的 `extensions.graph_topologies` 下写一条 `name` + `module`（例如 `ext/diamond-topology.js`），模块导出 `expand: (agents) => FlowEdge[]` 即被注册，同时把该拓扑名加入模板词汇表；同名注册会先告警再覆盖，模块缺少 `expand` 时只告警、不注册。扩展条目的完整字段见[扩展机制](/03-Reference/extensions)。

::: warning 图文档里手写 `template:` 没有运行时效果
`template` 与 `max_iterations` 只存在于声明类型层：图引擎会忽略它们，解析器组装文档时也不会提取这两个字段（解析器只写入 `version` / `name` / `nodes` / `edges`，再按需附加 `budget` 与 `loop_groups`）。在 YAML/JSON 图文档里手写它们不会改变任何行为——拓扑要么由扩展点注册，要么用 `graph_*` 工具在运行时搭出来。
:::

## 备注

> 自 v1.0.0 起，图模型固定为 v2（`version: 2`），多代理编排由这套图引擎承载；v1.8.0 起旧的声明式多代理配置块已从 `role.yaml` 中整体移除，多代理工作流只走命令式 `graph_*` 引擎。移除范围与逐项迁移对照见[迁移对照](/06-Appendix/migration)。

本页描述的图文档是 v2 图模型自身的声明式表示，用于解析、结构校验与导出——它不是旧配置块的替代写法，也不提供旧配置块的拓扑。

## 下一步

- [图工作流](/02-Guide/graph-workflows)——用八个 `graph_*` 工具在运行时构建并运行图
- [图执行引擎](/04-Advanced/graph-engine)——节点生命周期、join 评估、信号传播、循环组与审批门
- [编排工具](/03-Reference/tools/orchestration-tools)——每个 `graph_*` 工具的参数表
- [role.yaml 参考](/03-Reference/role-yaml)——角色级 `graph:` 键与其余角色配置
