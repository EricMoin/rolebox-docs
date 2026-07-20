---
title: 运行时行为
description: rolebox 协作图运行时状态管理、dispatch 驱动的前沿推进机制、终止原因报告与状态生命周期锁定语义
---

# 运行时行为

> **相关文档：** [工作流模式](/04-Advanced/workflow-patterns) — 拓扑模板与展开 | [终止条件](/04-Advanced/termination-conditions) — 循环终止与超时 | [信号系统](/04-Advanced/signal-system) — 运行时信号控制

协作图在解析和校验完成后进入运行时阶段。`src/graph/state.ts` 中的 `GraphSessionState` 是运行时核心，管理所有活跃会话的图状态、前沿推进和持久化。

---

::: warning 状态持久化说明
协作图的状态会持久化到 `.rolebox/state/graph-{hash}.json` 文件中。如果手动删除该文件，运行中的协作会话将丢失当前进度。在正常关闭时，`GraphSessionState` 会自动保存状态；在意外崩溃情况下，未保存的迭代可能会在下次启动时丢失。
:::

## 1. 图状态初始化

### 状态数据结构

每个协作会话维护一个 `GraphExecutionState` 对象（`src/graph/state.ts:10-21`）：

```typescript
// src/graph/state.ts:10-21
export interface GraphExecutionState {
  frontier: string[];                     // 当前可派发的代理队列
  completed: string[];                    // 已完成代理列表
  iterationCount: number;                 // 全局循环迭代计数
  status: "active" | "complete" | "exhausted";  // 生命周期状态
  loopCounters?: Record<string, number>;  // 每个循环组的迭代计数
  lastResults?: Record<string, { hash: string; text: string }>;
  loopStartTimeMs?: number;               // 首次退边时间戳（超时用）
  terminationReason?: TerminationReason | null;
  correctionCount?: number;               // off-route 修正计数
  convergenceSignal?: string;             // 收敛信号标志
}
```

### initGraph 流程

当会话启动时，`initGraph`（`src/graph/state.ts:47-73`）根据图的边初始化 frontier：

```typescript
// src/graph/state.ts:47-57
initGraph(sessionID: string, graph: ResolvedGraph, agentId?: string): void {
  const frontier: string[] = [];
  for (const e of graph.edges) {
    if (e.from === PARENT_NODE && e.to !== PARENT_NODE && !frontier.includes(e.to)) {
      frontier.push(e.to);
    }
  }
  // ... 设置初始状态
  this.sessions.set(sessionID, {
    graph, agentId: agentId ?? sessionID,
    state: {
      frontier,                    // 所有 parent→agent 边的目标
      completed: [],               // 空列表
      iterationCount: 0,           // 从零开始
      status: "active",            // 初始为 active
      loopCounters: {},
      lastResults: {},
      terminationReason: null,
      correctionCount: 0,
    },
  });
}
```

初始化完成后，frontier 包含所有从 `parent`（Orchestrator）出发的直接下游代理。

---

## 2. `<collaboration_graph>` 注入机制

协作图指令通过 `buildCollaborationBlock`（`src/graph/prompt-builder.ts:298-349`）生成 XML 格式的提示块，注入到路由器（Orchestrator）的系统提示中。

### 生成的 XML 结构

对于 pipeline 拓扑，生成的 `<collaboration_graph>` 块形如：

```xml
<collaboration_graph>
<topology>pipeline</topology>
<routing>
  Step 1: Dispatch initial work to Coder using task(subagent_type="coder", ...)
  Step 2: Collect Coder's output and dispatch to Reviewer using task(subagent_type="reviewer", ...)
  Step 3: Reviewer's output is the final result — no further dispatching needed.
</routing>
<exit_conditions>
The graph completes when: the final agent returns their output, OR max 3 iteration(s) reached.
</exit_conditions>
<routing_rules>
- NEVER do specialist work yourself. Always dispatch via task().
- Never call more than one specialist in a single step.
- Always pass the previous step's context and output when dispatching the next step.
</routing_rules>
</collaboration_graph>
```

### 子代理角色块

每个子代理也会收到一个 `<collaboration_role>` 块（`src/graph/prompt-builder.ts:358-398`），描述其在协作中的位置：

```typescript
// src/graph/prompt-builder.ts:372-377
if (isExitPoint) {
  // "You receive work from: ... Your output completes the workflow."
} else if (isEntryPoint) {
  // "You receive work from the orchestrator."
} else {
  // "You are a middle agent in the collaboration. You ..."
}
```

### 运行时状态块

在工作流执行过程中，`buildGraphStateBlock`（`src/graph/state.ts:252-313`）生成当前状态的 XML 块用于注入系统提示：

```xml
<collaboration_state>
  <status>active</status>
  <frontier>reviewer</frontier>
  <completed>coder</completed>
  <iteration>0/5</iteration>
  <next_action>Dispatch to reviewer</next_action>
</collaboration_state>
```

当终止时，该块包含终止原因和循环计数（`src/graph/state.ts:261-288`）：

```xml
<collaboration_state>
  <status>exhausted</status>
  <frontier>none</frontier>
  <completed>writer, critic, writer, critic</completed>
  <iteration>4/5</iteration>
  <termination_reason>max_iterations</termination_reason>
  <loop_iterations group="writer,critic">4</loop_iterations>
  <next_action>Workflow terminated (reason: max_iterations) — synthesize the best final result</next_action>
</collaboration_state>
```

---

## 3. Dispatch 驱动状态推进

### advanceGraphForDispatch

每次路由器执行 `dispatch`（task 或 dispatch 工具）后，`advanceGraphForDispatch`（`src/graph/advance.ts:96-151`）推进图状态：

```typescript
// src/graph/advance.ts:96-103
export function advanceGraphForDispatch(
  sessionID: string, tool: string, args: unknown,
): { result: AdvanceResult; correction?: string } {
  const state = graphSessionState.getState(sessionID);
  if (!state) return { result: { kind: "ignored" } };
  if (state.status !== "active") return { result: { kind: "ignored" } };
  // ...
}
```

### 目标提取

`extractDispatchTarget`（`src/graph/advance.ts:47-86`）从工具调用参数中提取派发目标。支持 `task` 和 `dispatch` 两种工具，参数可以是结构化对象或字符串：

```typescript
// src/graph/advance.ts:47-62
export function extractDispatchTarget(tool: string, args: unknown): string | undefined {
  if (typeof args === "object" && args !== null) {
    if (tool === "task") return (args as Record<string, unknown>).subagent_type;
    if (tool === "dispatch") return (args as Record<string, unknown>).subagent;
  }
  // 字符串回退正则提取 ...
}
```

### advanceStep 核心逻辑

`advanceStep`（`src/graph/state.ts:75-172`）执行完整的推进逻辑：

1. **校验**：确认会话存在、状态为 `active`、目标在节点列表中、目标在 frontier 中
2. **前沿管理**：从 frontier 移除已完成代理，将其加入 `completed` 列表
3. **出口检查**：检查 exit 边，若无出口边则停止
4. **后继处理**：将非 exit 边的目标加入 frontier；若后继已在前沿但被再次访问，递增迭代计数器
5. **终止评估**：调用 `evaluateSync` 检查是否满足终止条件

```typescript
// src/graph/state.ts:75-84
advanceStep(sessionID: string, completedAgent: string): AdvanceResult {
  const entry = this.sessions.get(sessionID);
  if (!entry) return { kind: "ignored" };
  if (state.status !== "active") return { kind: "ignored" };
  if (!graph.nodes.includes(completedAgent)) return { kind: "unknown", got: completedAgent };
  if (!state.frontier.includes(completedAgent)) return { kind: "off_route", expected: [...state.frontier], got: completedAgent };
  // ...
}
```

### AdvanceResult 类型

推进操作返回 6 种可能结果（`src/graph/state.ts:23-29`）：

```typescript
// src/graph/state.ts:23-29
export type AdvanceResult =
  | { kind: "advanced"; frontier: string[] }     // 正常推进，有后继
  | { kind: "completed" }                          // 正常完成（frontier 为空）
  | { kind: "exhausted" }                          // 非正常终止
  | { kind: "off_route"; expected: string[]; got: string }  // 派发了错误的代理
  | { kind: "unknown"; got: string }               // 派发了不在图中的代理
  | { kind: "ignored" };                           // 会话不存在或已非 active
```

### off_route 修正

当路由器派发了错误的代理时，`advanceGraphForDispatch` 会生成 `<system-reminder>` 修正提示（`src/graph/advance.ts:110-126`）：

```typescript
// src/graph/advance.ts:115-125
if (state.correctionCount >= MAX_CORRECTIONS) {
  // MAX_CORRECTIONS = 3（advance.ts:8）
  correction = `<system-reminder>
The workflow has terminated due to repeated off-route dispatches. Stop dispatching and
synthesize the best final result from the completed agents' work.
</system-remory>`;
} else {
  correction = `<system-reminder>
The dispatch to "${result.got}" went off the collaboration graph route.
Expected next target(s): ${expected}.
The graph state has not been advanced.
</system-reminder>`;
}
```

---

## 4. 终止原因报告

### stop_reasons 种类

`src/types.graph.ts:83-89` 定义了 6 种终止原因：

```typescript
// src/types.graph.ts:83-89
export type TerminationReason =
  | "max_iterations"    // 达到最大迭代次数
  | "timeout"           // 超时
  | "stuck"             // 输出停滞重复
  | "converged"         // 收敛（异步 judge 判定）
  | "result_match"      // 结果匹配预设条件
  | "error";            // 解析或其他错误
```

### 终止触发后的状态变迁

`advanceStep` 在每次前沿更新后调用 `evaluateSync`（`src/graph/state.ts:138-146`）：

```typescript
// src/graph/state.ts:138-146
const reason = evaluateSync(state, graph, Date.now());
if (reason) {
  state.terminationReason = reason;
  if (reason === "converged" || reason === "result_match") {
    state.status = "complete";     // 正常完成——成功终止
  } else {
    state.status = "exhausted";    // 异常终止——保护性停止
  }
}
```

两种状态的区别：
- **`complete`**：`converged` 或 `result_match` 触发，表示工作流成功完成
- **`exhausted`**：`max_iterations`、`timeout`、`stuck`、`error` 触发，表示非正常但安全的终止

### 空 frontier 自动完成

当 frontier 变为空且无活跃出口边时，图自动进入 `complete` 状态（`src/graph/state.ts:158-169`）：

```typescript
// src/graph/state.ts:158-169
if (state.frontier.length === 0) {
  if (forward.length > 0 && skippedLoopDueToCap && exitEdges.length === 0) {
    state.status = "exhausted";
    return { kind: "exhausted" };
  }
  state.status = "complete";
  return { kind: "completed" };
}
```

---

## 5. 状态生命周期与锁定语义

### 生命周期流转

以下 Mermaid 图展示了协作图运行时状态的完整生命周期流转——从初始化到正常完成或保护性终止：

```mermaid
graph TD
    INIT["initGraph()"] -->|status: active| ACTIVE["active\n可推进状态"]

    ACTIVE -->| advanceStep() \n出口边| COMPLETE["complete\n✓ 正常完成"]
    ACTIVE -->| evaluateSync() \nmax_iterations / timeout / stuck / error| EXHAUSTED["exhausted\n⚠ 保护性终止"]
    ACTIVE -->| evaluateSync() \nconverged / result_match| COMPLETE

    COMPLETE -->|状态持久化| PERSIST["持久化到磁盘\n.rolebox/state/graph-*.json"]
    EXHAUSTED -->|状态持久化| PERSIST

    PERSIST -->| recover() \n下次启动| RECOVER["恢复 / 重连"]
    PERSIST -->| clear() \n会话结束| CLEAR["清理\n内存 + 磁盘"]

    ACTIVE -.->|后续 advanceStep| IGNORED["ignored\n所有调用被忽略"]

    style ACTIVE fill:#e3f2fd,stroke:#1565c0
    style COMPLETE fill:#e8f5e9,stroke:#2e7d32
    style EXHAUSTED fill:#fff3e0,stroke:#e65100

```


```
                     initGraph()
                         │
                         ▼
                    ┌──────────┐
           ┌───────│  active   │────────┐
           │       └──────────┘        │
           │            │              │
           │   advanceStep(exit)       │   evaluateSync(
           │            │              │     max_iterations/
           │            ▼              │     timeout/stuck/error)
           │       ┌──────────┐        │
           └───────│ complete │        │
                   └──────────┘        │
                                        ▼
                                  ┌──────────┐
                                  │ exhausted │
                                  └──────────┘
```

### 锁定语义

一旦状态离开 `active`，所有后续 `advanceStep` 调用都被忽略（`src/graph/state.ts:79`）：

```typescript
if (state.status !== "active") return { kind: "ignored" };
```

同样，`advanceGraphForDispatch` 在进入前也检查 active 状态（`src/graph/advance.ts:103`）。

### 持久化

`GraphSessionState` 支持将运行时状态持久化到磁盘，通过 `GraphStore`（`src/graph/graph-store.ts`）：

- **异步写入**：`_persist()` — 状态变更后 500ms 延迟批量写入（`state.ts:201-215`），避免高频写入
- **同步写入**：`flushSync()` — 确保立即写入磁盘（`state.ts:217-231`）
- **恢复**：`recover()` 方法从磁盘加载并重连已持久化的图（`state.ts:233-247`）

```typescript
// src/graph/state.ts:233-247
recover(reattach: (sessionID: string, agentId: string) => ResolvedGraph | undefined): void {
  if (!this.store) return;
  const loaded = this.store.load();
  if (!loaded) return;
  for (const [sessionID, entry] of loaded) {
    const graph = reattach(sessionID, entry.agentId);
    if (graph) {
      this.sessions.set(sessionID, { graph, state: entry.state, agentId: entry.agentId });
    }
  }
}
```

持久化的文件位于 `.rolebox/state/graph-<dirHash>.json`（`src/graph/graph-store.ts:127`），包含 V2 格式的序列化状态。

### 清理

会话完成后调用 `clear(sessionID)` 从内存和磁盘中移除状态（`state.ts:188-191`）。

---

## 引用索引

| 引用 | 文件 | 行号 |
|------|------|------|
| 状态数据结构 | `src/graph/state.ts` | 10-21 |
| initGraph | `src/graph/state.ts` | 47-73 |
| advanceStep | `src/graph/state.ts` | 75-172 |
| AdvanceResult 类型 | `src/graph/state.ts` | 23-29 |
| 状态构建块 | `src/graph/state.ts` | 252-313 |
| 持久化（异步 `_persist`） | `src/graph/state.ts` | 201-215 |
| 持久化（同步 `flushSync`） | `src/graph/state.ts` | 217-231 |
| recover | `src/graph/state.ts` | 233-247 |
| 协作块生成 | `src/graph/prompt-builder.ts` | 298-349 |
| 子代理角色块 | `src/graph/prompt-builder.ts` | 358-398 |
| 结果契约 | `src/graph/prompt-builder.ts` | 285-287 |
| advanceGraph | `src/graph/advance.ts` | 96-151 |
| 目标提取 | `src/graph/advance.ts` | 47-86 |
| off-route 修正 | `src/graph/advance.ts` | 110-126 |
| 异步收敛 | `src/graph/advance.ts` | 161-219 |
| 终止原因类型 | `src/types.graph.ts` | 83-89 |
| 终止评估 | `src/graph/termination.ts` | 82-116 |
| 图存储 | `src/graph/graph-store.ts` | 23-174 |

## 下一步

- [工作流模式](/04-Advanced/workflow-patterns) — 协作图拓扑与 Pipeline / Review-Loop / Star
- [终止条件](/04-Advanced/termination-conditions) — continue_until 条件与运行时终止评估
- [信号系统](/04-Advanced/signal-system) — 带外控制信令机制
- [循环系统](/04-Advanced/loop-system) — 循环协调器与工作器调度

---
