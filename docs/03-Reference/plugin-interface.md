---
title: 插件接口
description: 内部实现文档 — 平台端口、PluginService 契约、PluginCore 生命周期、上下文容器、工具装配与扩展点系统
---

# 插件接口（Plugin Interface）

本页回答一个问题：**核心层与宿主之间、服务与服务之间的接口契约是什么**。你要写一个新服务（实现 `PluginService`）、把 rolebox 接到一套新 harness（实现平台端口），或给封闭词汇表加一个扩展点时，需要的签名与生命周期语义都在这里。只配置 `role.yaml` 的读者请从[角色定义](/03-Reference/role-yaml)开始。

> 相关：[服务架构](/01-Overview/service-architecture)｜[Hook 机制](/03-Reference/hooks)｜[扩展机制](/03-Reference/extensions)｜[平台与 Harness](/01-Overview/platform-harnesses)

> 自 v1.8.0 起，插件接口与 opencode 解耦：平台能力统一由 `ISessionClient` 等端口承载，三套 harness 共享同一份 `HookDeps`；同一版本移除了声明式协作配置块，多代理编排只走 `graph_*` 引擎。

入口按角色分三类：**配置**（`hooks.custom` 与 `extensions`，写法见[Hook 机制](/03-Reference/hooks)与[扩展机制](/03-Reference/extensions)）、**实现服务**（`PluginService`）、**接入宿主**（`src/platform/ports/` 下的平台端口加 `src/platform/adapters/` 下的适配器）。新增一个可被模型调用的工具则走 `defineTool()` 加 `IToolFactory.compile()`，见本页「工具注册模式」。

## 平台端口（Platform Ports）

`src/platform/ports/` 下的端口接口是核心层与宿主的唯一契约：端口实现里**禁止** import `@opencode-ai/*` 或 `@deepseek-ai/*`，具体适配器放在 `src/platform/adapters/{opencode,pi,dsh}/`。因此调度、通知、循环、会话工具都只认端口，不认宿主 SDK。

### ISessionClient — 会话读写

会话能力的唯一抽象（定义于 `src/platform/ports/session-client.ts`）：

```typescript
export interface ISessionClient {
  list(directory?: string): Promise<SessionInfo[]>;
  get(id: string, directory?: string): Promise<SessionInfo | null>;
  messages(id: string, options?: { directory?: string; limit?: number }): Promise<Message[]>;
  children(id: string, directory?: string): Promise<SessionInfo[]>;
  todo(id: string, directory?: string): Promise<Todo[]>;
  diff(id: string, options?: { directory?: string; messageID?: string }): Promise<FileDiff[]>;
  fork(id: string, options?: { directory?: string; messageID?: string }): Promise<SessionInfo | null>;
  status(id: string, directory?: string): Promise<SessionStatus | null>;
  prompt(id: string, options: { parts: Array<{ type: string; text: string }>; noReply?: boolean; system?: string; agent?: string; model?: { providerID: string; modelID: string }; fromLoop?: boolean }): Promise<{ id: string } | null>;
  promptSync(id: string, options: { parts: Array<{ type: string; text: string }>; agent?: string; signal?: AbortSignal }): Promise<{ parts: Array<{ type: string; text?: string }> } | null>;
  create(options: { directory: string; agent?: string; parentID?: string }): Promise<SessionInfo | null>;
  abort(id: string): Promise<boolean>;
  compact?(id: string): Promise<boolean>;
}
```

| 成员 | 关键参数 | 语义 |
|---|---|---|
| `list` / `get` / `messages` | `directory`、`limit` | 读取会话；`limit` 限制消息条数 |
| `prompt` / `promptSync` | `parts`、`noReply`、`agent`、`model`、`fromLoop`、`signal` | fire-and-forget 提示（`fromLoop: true` 时是否触发新回合由 `noReply` 推导）与同步等待响应（`signal` 用于取消） |
| `create` / `abort` / `compact` | `directory`、`agent`、`parentID` | 创建与中止会话；宿主不支持创建会话时返回 `null`，不支持压缩时 `compact` 返回 `false` |

```typescript
// 注入一条不触发新回合的进度提示（循环协调器走的正是这条路径）
await deps.session.prompt(sessionID, {
  parts: [{ type: "text", text: progressNote }],
  noReply: true,
  fromLoop: true,
});
```

### IToolFactory 与 defineTool — 工具编译

`defineTool()` 产出的 `CanonicalToolDef` 与平台无关；`IToolFactory` 由适配器实现，把它编译成宿主原生工具对象（`src/platform/ports/tool-factory.ts`）：

```typescript
export interface IToolFactory {
  compile<Args extends z.ZodRawShape>(def: CanonicalToolDef<Args>): unknown;
  compileAll(defs: Record<string, CanonicalToolDef>): Record<string, unknown>;
}

export function defineTool<Args extends z.ZodRawShape>(input: {
  description: string;
  args: Args;
  execute(args: z.infer<z.ZodObject<Args>>, context: CanonicalToolContext): Promise<ToolResult>;
}): CanonicalToolDef<Args>;
```

| 参数 | 说明 |
|---|---|
| `description` | 给模型看的工具说明，决定它何时被调用 |
| `args` | zod raw shape；同时承担运行时校验与 `z.infer` 类型推导 |
| `execute` | 收到已校验的参数与 `CanonicalToolContext`，返回 `ToolResult` |

`defineTool()` 不做任何平台转换（校验形状后原样返回）；dsh 侧由 `src/platform/adapters/dsh/tool-factory.ts` 实现 `compileAll()`，opencode / pi 由各自的装配层编译。

### IHookProvider — 处理器交付

宿主拿到 rolebox 的入口就是一个 handler map（`src/platform/ports/hook-provider.ts`）：

```typescript
export interface IHookProvider {
  getHandlers(): Record<string, unknown>;
}
```

返回的 map **至少**含 `tool` 键（各平台原生工具定义表）；opencode 还消费 `event`、`config`、`chat.message`、`tool.execute.*`、`experimental.*` 与 `dispose`（完整清单见本页「HookService 处理链」），其余键由各平台自行约定。opencode 的 `HookService.getHandlers()` 与 pi 的轻量服务栈都满足这一端口，因此可以复用同一批处理函数。

### IEventBridge — 事件规范化

把宿主原生事件流翻译成规范事件，再分发给核心处理器（`src/platform/ports/event-bridge.ts`）：

```typescript
export interface IEventBridge {
  on(handler: CanonicalEventHandler): () => void;
  onType(type: CanonicalEventType, handler: CanonicalEventHandler): () => void;
  normalize(rawEvent: unknown): CanonicalEvent;
  emit(event: CanonicalEvent): Promise<void>;
}
```

| 成员 | 参数 | 说明 |
|---|---|---|
| `on` / `onType` | `handler`、`type` | 返回取消订阅函数；`onType` 只订阅一种事件类型 |
| `normalize` / `emit` | `rawEvent`、`event` | 适配器把原生事件转成 `CanonicalEvent`（测试也可直接调用），再推给全部订阅者 |

### IAgentRegistrar — 代理注册

把解析结果同步成宿主可发现的代理（`src/platform/ports/agent-registrar.ts`）：

```typescript
export interface IAgentRegistrar {
  register(agents: AgentDefinition[]): Promise<void>;
  unregister(agentIds: string[]): Promise<void>;
  sync(agents: AgentDefinition[]): Promise<{ added: string[]; removed: string[]; unchanged: string[] }>;
  list(): Promise<string[]>;
}
```

`register` / `unregister` 必须幂等——重复注册同一份定义是 no-op，`unregister` 负责清理平台侧产物；`sync` 等价于「注册新增与变更 + 注销已移除」，并回报三类 ID。

### ISkillSurface — 技能发布

把当前角色的技能发布到宿主的技能注册表（`src/platform/ports/skill-surface.ts`）：

```typescript
export interface ISkillSurface {
  publish(entries: CanonicalSkillEntry[]): () => void;
}

export interface CanonicalSkillEntry {
  name: string; description: string; scope: SkillScope;
  filePath: string; resourceDir: string;
  roleId: string; ownerAgentId: string;
}
```

`publish()` 必须幂等，并返回一个 disposer：调用它即移除本次发布的全部条目，重复调用是无害的。条目里只有元数据与绝对路径，平台原生字段（注册键、provider 对象）由适配器自行推导。

## PluginService 接口

所有子系统服务都实现同一个契约（`src/core/service.ts`），由 `PluginCore` 按拓扑序初始化：

```typescript
export interface PluginService {
  name: string;
  dependencies: string[];
  critical?: boolean;
  init(ctx: PluginContext): Promise<void>;
  dispose(): Promise<void>;
  health?(): ServiceHealth;
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  detail?: string;
}
```

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 唯一服务名（如 `"dispatch-service"`），依赖声明按名字匹配 |
| `dependencies` | `string[]` | 是 | 必须先完成初始化的服务名 |
| `critical` | `boolean` | 否 | `init()` 失败是否致命，默认 `false` |
| `init()` | `(ctx) => Promise<void>` | 是 | 依赖就绪后调用 |
| `dispose()` | `() => Promise<void>` | 是 | 关闭与热重载时调用；即使 `init()` 失败过也必须可安全调用 |
| `health()` | `() => ServiceHealth` | 否 | 定义后 `HealthMonitorService` 会周期轮询 |

```typescript
// 注册一个服务：core 负责拓扑排序与降级，服务本身不关心顺序
core.registerService(new LoopService());
const loopService = core.getService<LoopService>("loop-service");
```

## PluginCore 生命周期

`PluginCore`（`src/core/plugin-core.ts`）是服务容器：注册、拓扑排序、初始化、降级与关闭都在这里。它同时实现 `PluginCoreLike`（`getService` / `getServices` / `restartService` / `isDegraded`），供服务互相查找，避免服务之间直接 import 具体类。

### 注册与初始化

`init(ctx)` 的固定顺序：

```text
1. StartupChecker 一致性检查（隔离损坏状态、清理陈旧锁与残留临时文件）
2. topoSort() 按 dependencies 做深度优先拓扑排序，随后逐个调用 svc.init(ctx)
3. 依赖已被降级 → 跳过该服务并标记降级；critical 服务 init 失败 → 抛出致命错误
4. 非 critical 服务 init 失败 → 记日志并标记为永久降级
```

依赖成环时 `topoSort()` 抛出 `DescriptiveCycleError`，异常的 `cycleMembers` 字段直接给出环上的服务名，便于定位。

### 降级语义

非关键服务的失败是**隔离**的：失败的 `init()` 只让该服务进入永久降级集合，其传递依赖者被整体跳过，插件本身继续启动并提供其余能力。因此新增服务时的默认选择是 `critical: false`——只有「没有它插件就不成立」的服务才声明 `critical: true`。

### 关闭与局部重启

- `dispose()`：按逆拓扑序逐服务清理，单个 `dispose()` 抛错只记日志、不中断其余服务；重复调用是 no-op。
- `restartService(name)`：先构建反向依赖图，用 BFS 找出目标服务及其全部传递依赖者，再按拓扑序对这批服务依次 `dispose() → init()`。热重载走的就是这条路径；`dispose` 阶段的错误被捕获记录，`init` 阶段的错误向上抛出。

## PluginContext

每个服务 `init()` 时收到的上下文（`src/core/context.ts`）：

```typescript
export interface PluginContext {
  session: ISessionClient;
  resolvedRoles: ResolvedRole[];
  roleFunctionsMap: Map<string, ResolvedFunction[]>;
  rawDirectory: string;      directory: string;
  core: PluginCoreLike;      bus: EventBus;
  roleboxDir?: string;       globalSkillsDir?: string;
  configDir?: string;        builtinDir?: string;
  capabilities?: PlatformCapabilities;
}
```

| 字段 | 说明 |
|---|---|
| `session` | 平台无关的会话客户端，服务访问会话的唯一通道 |
| `resolvedRoles` / `roleFunctionsMap` | 已解析的角色，以及 角色 ID → 函数列表 的映射 |
| `rawDirectory` / `directory` | 原始工作目录（未标准化，**用作各类 Map 的键**）与 `realpath` 标准化后的工作目录（用于文件与状态路径） |
| `core` / `bus` / `capabilities` | 容器引用与事件总线（跨服务查找走 `core.getService()`）；平台能力探测，缺省按「全部支持」处理 |

`rawDirectory` 与 `directory` 的分工是刻意的：键必须与宿主传入值逐字一致（否则热重载后查不到），路径必须解析过软链接（否则状态目录会写错位置）。

## HookDeps

Hook 处理器共享的依赖容器（`src/hooks/deps.ts`）：

```typescript
export interface HookDeps {
  session: ISessionClient;
  roleFunctionsMap: Map<string, ResolvedFunction[]>;
  roleMap: Map<string, ResolvedRole>;
  dir: string;
  dispatchManager: DispatchManager;
  loopManager: LoopCoordinator;
  customHooks: CustomHookRegistry;
  recoveryEngine?: RecoveryEngine;
  builtInHooks?: BuiltInHookRegistry;
  notificationManager?: NotificationManager;
  extensionRegistry?: ExtensionRegistry;
  builtinConfig?: Record<string, boolean>;
  graphTools?: { hasInflightGraphsForSession(sessionID: string): boolean };
  copilotConfigs?: Map<string, CopilotConfig>;
  resolvedSubagents?: Map<string, { parentFullId: string }>;
}
```

| 字段组 | 说明 |
|---|---|
| `session`、`roleFunctionsMap`、`roleMap`、`dir` | 会话、角色函数、角色表与工作目录：每个 Hook 处理器的基本输入 |
| `dispatchManager`、`loopManager`、`customHooks` | 调度、循环与自定义 Hook 注册表，前两者必填 |
| `recoveryEngine` … `builtinConfig` | 恢复、通知、扩展与内置开关；对应服务降级时缺省 |
| `graphTools` | 只暴露一个查询：本会话是否还有在飞图。它背后是与 `graph_*` 工具**同一个** `GraphToolSet` 实例，空闲/续跑判断因此不会与图状态脱节；`copilotConfigs` 与 `resolvedSubagents` 则分别承载各角色的 copilot 配置与「子代理 → 归属父代理」表，缺省时对应判定来源被跳过 |

`HookDeps` 由 `HookService.init()` 从 `PluginContext` 组装：`session` 直接取 `ctx.session`，其余成员从各服务各自的 getter 取（如 `loopService.getLoopManager()`、`toolService.getGraphToolSet()`），可选服务缺失时字段留空，调用方按「该能力不可用」降级。

## 工具注册模式

### 定义：defineTool 与 zod

工具定义是「描述 + zod 参数形状 + 执行函数」三件套；zod schema 同时承担运行时校验与类型推导。

```typescript
const createExampleTool = () => defineTool({
  description: "Dispatch work to a subagent and return its result.",
  args: {
    subagent: z.string().describe("The subagent to dispatch to"),
    prompt: z.string().describe("The task prompt for the subagent"),
    run_in_background: z.boolean().describe("Whether to run in the background"),
  },
  async execute({ subagent, prompt, run_in_background }, context) {
    // context 提供 canonical 形态的会话/代理信息
    return { output: "…" };
  },
});
```

### 装配：分层覆盖

`buildCanonicalTools()`（`src/platform/tool-assembly.ts`）按固定顺序分层装配，后合并的层覆盖同名的前一层：

| 顺序 | 层 | 合并来源 |
|---|---|---|
| 1 | 核心独立工具 + 角色快照工具 | 始终装配：`hashline_*`、`memory_*`、`web_*`、`signal`、`interactive_terminal`；快照工具由 `buildRoleSnapshotTools()` 单独产出 |
| 2 | 会话工具 | 传入 `sessionClient` 时装配 |
| 3 | `dispatchToolsOverride` | 优先级最低：opencode 的正式 shim 或 pi 上的 stub（当前两侧都不注册 `dispatch_*`） |
| 4 | `extraTools` | 平台定制层：opencode / pi 用它挂 `memory_update`、`function_graph`、`skill_compose`、`context_assemble`、`asset_hot_reload`、`lsp_*` 与 `load_role_skill` |
| 5 | `loopToolsOverride` | `loop_*` 覆盖，优先级最高 |
| 6 | `taskToolsOverride` | `task_*` 兼容面（`task_retry` 被显式剔除），与 `loop_*` 同层且键不重叠 |
| 7 | 图工具 | 传入 `dispatchManager` 时附加 `graph_*`，与既有键不重叠 |

`ROLE_SNAPSHOT_TOOL_KEYS` 把四个角色快照工具（`asset_search`、`asset_inspect`、`asset_validate`、`reference_search`）单独登记出来：只有它们的实现绑定在 `resolvedRoles` 快照上，因此 dsh 插件在角色热重载时只重建这一代工具，不必重新编译整套工具集。

### 校验：schema 注册表

`registerToolSchema(name, args)`（`src/hooks/tool-before.ts`）把 工具名 → zod raw shape 存进全局映射，供 `tool.execute.before` 处理器在每次调用前做 `.strict()` 参数校验：模型幻觉出的多余参数在这一步被拒绝，而不是流进执行函数。

## RoleConfig schema

`RoleConfig`（`src/types.core.ts`）是 `role.yaml` 的类型契约，共 31 个顶层键：`name`、`description`、`model`、`mode`、`color`、`variant`、`prompt`、`prompt_file`、`skills`、`opencode_skills`、`permission`、`subagents`、`tools`、`temperature`、`top_p`、`functions`、`disable_functions`、`references`、`graph`、`dispatch`、`auto_activate`、`locked`、`open`、`exports`、`open_roles`、`version`、`notifications`、`copilot`、`hooks`、`extensions`、`memory`。

字段语义与用户面取值见[角色定义](/03-Reference/role-yaml)与[调度配置](/03-Reference/dispatch-config)；接口层面只需记住两点：`prompt` 与 `prompt_file` 互斥；`SubAgentConfig`（同文件定义）可递归嵌套，加载器默认最多下钻 **3 层**（`src/loader/subagents.ts`），超过的部分不会被解析。

## HookService 处理链

`HookService`（`src/core/services/hook-service.ts`）把上面的接口组装成宿主可识别的 handler map，`buildHandlers()` 产出的键即 opencode 的各 hook 点：

```text
tool / event / config                工具映射；事件处理 + EventBus 转发 + 节点存活心跳中继；子代理配置注入
chat.message / tool.execute.*       消息处理（函数激活、循环、校正注入）；工具调用前后的校验与观察
experimental.* / dispose            system.transform 与 session.compacting；自定义 Hook 注册表清理
```

pi 侧由 `PiHookPipeline`（`src/platform/adapters/pi/hook-pipeline.ts`）复用同一批处理函数，只是交付方式不同：它不返回 handler map，而是把 `handleEvent` 等函数接到 pi 的事件与拦截器上。

### Hook 与恢复引擎共用的辅助函数

`src/hooks/context.ts` 还导出三个辅助函数，供 Hook 处理器与恢复引擎共用：

- `appendCorrection(corrections: Map<string, string>, sessionID: string, text: string): void` —— 向会话累积一条待注入的纠正文本。
- `fetchLastAssistantText(client: ISessionClient, sessionID: string): Promise<string | null>` —— 取会话上一条助手消息的文本。
- `collectAllFunctions(fnMap: Map<string, ResolvedFunction[]>): ResolvedFunction[]` —— 把所有角色的函数平铺成一个数组。

## Hook State

Hook 层的运行时状态是**全局单例** `hookState`（`src/hooks/state.ts`）：

```typescript
class HookState {
  readonly managerMap = new Map<string, DispatchManager>();      // 原始工作目录 → 调度管理器
  readonly loopManagerMap = new Map<string, LoopCoordinator>();  // 原始工作目录 → 循环协调器
  readonly loopStoreMap = new Map<string, LoopStore>();          // 原始工作目录 → 循环持久化
  readonly pendingCorrections = new Map<string, string>();       // 会话 ID → 待注入纠正文本
  readonly sessionAgentRegistry = new Map<string, string>();     // 会话 ID → 当前代理 ID
  readonly roleAutoActivateMap = new Map<string, string[]>();    // 角色 ID → 自动激活函数
  readonly roleLockedMap = new Map<string, boolean>();           // 角色 ID → 锁定标记
}
```

单例的原因很实际：Hook 处理器是宿主在启动时一次性注册的闭包，拿不到「每次调用都传进来的实例」，因此按原始工作目录/会话 ID 分键的运行时状态必须挂在一个进程级对象上；`activeLoopManager` 则单独保存当前活跃的循环协调器。组合根也把其中若干成员再导出为具名绑定（`managerMap`、`loopManagerMap`、`pendingCorrections`、`sessionAgentRegistry`、`roleAutoActivateMap`、`roleLockedMap`、`activeLoopManager`），并在进程退出、`SIGINT`、`SIGTERM` 时同步刷盘。

## 扩展点系统

扩展系统把 rolebox 的封闭词汇表开放给角色作者，契约是一个**非泛型**接口（`src/extensions/extension-point.ts`）：

```typescript
export interface ExtensionPoint {
  name: string;
  load(entries: ExtensionEntry[], roleDir: string): Promise<void>;
  dispose?(): Promise<void>;
}
```

7 个作用域与内置扩展点一一对应（`ExtensionScope`，`src/extensions/types.ts`）：

| 作用域 | 扩展点 | 用途 |
|---|---|---|
| `conditions` | `ConditionExtensionPoint` | 自定义条件函数 |
| `graph_topologies` | `GraphTopologyExtensionPoint` | 自定义图拓扑 |
| `recovery_strategies` | `RecoveryStrategyExtensionPoint` | 自定义恢复策略 |
| `recovery_patterns` | `RecoveryPatternExtensionPoint` | 自定义恢复错误模式 |
| `notification_channels` | `NotificationChannelExtensionPoint` | 自定义通知通道 |
| `notification_events` | `NotificationEventExtensionPoint` | 自定义通知事件处理器 |
| `observe_events` | `ObserveEventExtensionPoint` | 自定义观察事件 |

分发流程是查表：`ExtensionRegistry.loadExtensions()`（`src/extensions/registry.ts`）遍历 `role.yaml` 的 `extensions:` 块，按作用域名取出对应 `ExtensionPoint` 并调用 `load(entries, roleDir)`；`ExtensionService` 在插件初始化时驱动它，并把加载到的策略与模式桥接进 `RecoveryEngine`。新增作用域不必改核心：`registerExtensionPoint(point)` 允许第三方或测试注入新的扩展点。

## 工具可用性与 harness 门控

`buildCanonicalTools()` 只装配**跨平台交集**，平台专属工具由各 harness 通过 `extraTools` 等覆盖点自行注入。所以「rolebox 有某个工具」这句话必须带 harness 限定词：

| 工具 | opencode | pi | dsh | 装配层 |
|---|---|---|---|---|
| 核心集：`hashline_read` / `hashline_edit`、`memory_write` / `memory_recall` / `memory_list`、`web_search` / `web_read` / `web_fetch`、`signal`、`interactive_terminal` | ✓ | ✓ | ✓ | 共享层第 1 层 |
| 角色快照工具：`asset_search` / `asset_inspect` / `asset_validate` / `reference_search` | ✓ | ✓ | ✓ | `buildRoleSnapshotTools()` |
| 会话工具：`session_list` / `session_read` / `session_search` / `session_info` / `session_diff` / `session_fork` | ✓ | ✓ | ✓ | 需 `sessionClient` |
| 图工具：`graph_*` | ✓ | ✓ | ✓ | 需 `dispatchManager` |
| `task_search` / `task_budget` / `task_graph`（不含 `task_retry`） | ✓ | ✓ | ✗ | `taskToolsOverride` |
| `memory_update`、`function_graph`、`skill_compose`、`context_assemble` | ✓ | ✓ | ✗ | `extraTools` |
| `lsp_*`（32 个） | ✓ | ✓ | ✗ | opencode 走 `LspService.getTools()`；pi 直接构造 LSP 管理器 |
| `asset_hot_reload` | ✓ | ✗ | ✗ | opencode `extraTools`；pi 明确省略 |
| `load_role_skill` | ✗ | ✓ | ✗ | pi 专属；opencode 用自己的原生技能工具 |

补充两点：dsh 以对象式调用 `buildCanonicalTools({ resolvedRoles, directory, sessionClient, capabilities })`，随后自行展开图工具与循环工具，不传 `extraTools` 与 `taskToolsOverride`；即使在 opencode 上，`dispatch_*` 与 `loop_*` 也不在默认装配里，多代理编排统一走 `graph_*`。

## 相关页面

- [服务架构](/01-Overview/service-architecture) — 11 个服务的职责、依赖拓扑与降级链
- [Hook 机制](/03-Reference/hooks)｜[扩展机制](/03-Reference/extensions) — 面向 Hook 与扩展作者的配置、`HookContext` API 与模块合约
- [平台与 Harness](/01-Overview/platform-harnesses)｜[工具目录](/03-Reference/tool-catalog) — 三套 harness 的装配差异与全部内置工具
- [开发环境搭建](/05-Contributing/development-setup)｜[贡献指南](/05-Contributing/contributing) — 改 rolebox 源码本身的构建与提交
