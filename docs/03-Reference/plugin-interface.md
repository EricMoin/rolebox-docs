---
title: 插件接口
description: Rolebox 插件系统的核心接口说明，包括 HookDeps、RoleConfig、工具注册模式、服务生命周期与 HookContext API
---

# 插件接口

> **相关文档：** [扩展机制](/03-Reference/extensions) — 扩展系统 | [Hook 机制](/03-Reference/hooks) — Hook 接口 | [服务架构](/01-Overview/service-architecture) — PluginCore 生命周期

Rolebox 插件系统基于 opencode 的 `PluginInput` 协议构建，通过一套分层接口实现角色解析、子代理管理、任务调度、通知、扩展等能力。本文档描述核心接口的生命周期与使用模式。

## Quick Start：与 rolebox 集成

要在你的角色或工具中与 rolebox 插件系统集成，只需三步：

### 1. 选择集成点

根据你的需求选择以下入口之一：

| 场景 | 入口 | 参考文档 |
|------|------|---------|
| 添加自定义回调逻辑 | `hooks.custom`（`role.yaml`） | [Hook 机制](./hooks) |
| 扩展封闭词汇表（条件/策略/通道等） | `extensions`（`role.yaml`） | [扩展机制](./extensions) |
| 实现完整的生命周期服务 | `PluginService` 接口 | [服务架构](/01-Overview/service-architecture) |
| 注册自定义恢复策略 | `engine.registerStrategy()` | [错误处理](./error-handling#恢复系统-recovery-system) |

### 2. 编写模块

以最简单的自定义 Hook 为例：

```javascript
// hooks/hello-hook.js
export default {
  onLoad: (ctx) => ctx.log.info("Hello from plugin!"),
  onChatMessage: (ctx, { text }) => {
    if (text.includes("ping")) {
      ctx.inject("pong!");
    }
  },
};
```

### 3. 在角色中声明

```yaml
# role.yaml
hooks:
  custom:
    - name: hello-hook
      events: [chat.message]
      module: hooks/hello-hook.js
```

启动后，`PluginCore` 会自动发现并注册该 Hook，无需额外配置。

> 完整服务注册流程见[服务架构](/01-Overview/service-architecture#组合根)。

## 1. PluginService 接口

所有子系统服务均实现 `PluginService` 接口（`src/core/service.ts:14`），由 `PluginCore` 按拓扑序统一初始化。

```typescript
// src/core/service.ts:14
export interface PluginService {
  name: string;
  dependencies: string[];
  critical?: boolean;
  init(ctx: PluginContext): Promise<void>;
  dispose(): Promise<void>;
  health?(): ServiceHealth;
}
```

**字段说明**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 唯一服务名（如 `"dispatch-service"`） |
| `dependencies` | `string[]` | 是 | 依赖的其他服务名列表 |
| `critical` | `boolean` | 否 | init 失败时是否致命 |
| `init()` | `(ctx) => Promise<void>` | 是 | 依赖就绪后的初始化 |
| `dispose()` | `() => Promise<void>` | 是 | 关闭/热重载时的清理 |
| `health()` | `() => ServiceHealth` | 否 | 可选健康检查 |

::: tip 服务降级
非关键服务（`critical: false`）的 `init()` 失败不会导致插件崩溃——该服务会被标记为 `degraded` 并跳过，其依赖项也会自动跳过。这确保了即使部分能力不可用，插件也能启动并提供基础功能。这种渐进式降级是 rolebox 错误容忍设计原则的核心体现。
:::

**ServiceHealth 类型**（`src/core/service.ts:2`）

```typescript
// src/core/service.ts:2
interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  detail?: string;
}
```

## 2. PluginCore 生命周期

`PluginCore`（`src/core/plugin-core.ts:22`）是插件的核心容器，管理所有服务的注册、拓扑排序、初始化、降级恢复和关闭。

### 注册与初始化

```typescript
// src/core/composition.ts:64-77
const core = new PluginCore();
core.registerService(new HotReloadService());
core.registerService(new DispatchService());
core.registerService(new LoopService());
core.registerService(new LspService());
core.registerService(new NotificationService());
core.registerService(new SessionService());
core.registerService(new RecoveryService());
core.registerService(new ExtensionService());
core.registerService(new ToolService());
core.registerService(new HookService());
core.registerService(new HealthMonitorService());

await core.init({ client, resolvedRoles, roleFunctionsMap, ... });
```

### 拓扑排序与降级

`PluginCore.init()`（`src/core/plugin-core.ts:63-107`）执行：

```
1. StartupChecker 一致性检查
2. topoSort() — 按依赖拓扑排序
3. 逐一调用 svc.init(ctx)
4. 如果依赖降级 → 跳过当前服务 → 标记 degraded
5. 如果 critical 服务的 init 失败 → 致命错误
6. 如果非 critical 服务的 init 失败 → 标记 permanent degraded
```

```typescript
// src/core/plugin-core.ts:63-107 (摘录)
async init(ctx: PluginContext): Promise<void> {
  this.ctx = { ...ctx, bus: this.bus };
  const health = StartupChecker.checkAll(ctx.directory, ...);
  // ...
  const ordered = this.topoSort();
  for (const svc of ordered) {
    const degradedDeps = svc.dependencies.filter(d => this.degraded.has(d));
    if (degradedDeps.length > 0) {
      this.degraded.add(svc.name);
      continue; // 跳过
    }
    try {
      await svc.init(this.ctx);
    } catch (err) {
      if (svc.critical) throw err;   // 致命
      this.degraded.add(svc.name);   // 非致命→降级
    }
  }
}
```

### 关闭流程

`dispose()`（`src/core/plugin-core.ts:110-122`）按逆向拓扑序逐服务清理，每个 `dispose()` 失败被捕获记录而非传播。

### 局部重启

`restartService(name)`（`src/core/plugin-core.ts:130-185`）支持热替换单个服务及其所有传递依赖项：

```
1. 构建反向依赖图
2. BFS 找出所有受影响的服务
3. 按拓扑序逐一 dispose() → init()
```

## 3. PluginContext

`PluginContext`（`src/core/context.ts:12`）是每个服务 `init()` 时接收的上下文对象。

```typescript
// src/core/context.ts:12
interface PluginContext {
  client: PluginInput["client"];
  resolvedRoles: ResolvedRole[];
  roleFunctionsMap: Map<string, ResolvedFunction[]>;
  roleGraphMap: Map<string, ResolvedGraph>;
  rawDirectory: string;
  directory: string;
  core: PluginCoreLike;
  bus: EventBus;
  roleboxDir?: string;
  globalSkillsDir?: string;
  configDir?: string;
  builtinDir?: string;
  capabilities?: PlatformCapabilities;
}
```

**核心字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `client` | `PluginInput["client"]` | opencode 平台客户端（会话创建/消息读写） |
| `resolvedRoles` | `ResolvedRole[]` | 已解析的全部角色 |
| `roleFunctionsMap` | `Map<string, ResolvedFunction[]>` | 角色 ID → 函数列表 |
| `directory` | `string` | 工作目录（`realpath` 标准化后） |
| `core` | `PluginCoreLike` | 用于跨服务查找的容器引用 |
| `bus` | `EventBus` | 服务间发布/订阅事件总线 |

## 4. HookDeps

`HookDeps`（`src/hooks/deps.ts:12`）是Hook系统的依赖容器，所有Hook处理函数共享此依赖集合。

```typescript
// src/hooks/deps.ts:12
interface HookDeps {
  /** @deprecated 使用 session 替代 */
  client: PluginInput["client"];
  /** 平台无关的会话客户端 */
  session: ISessionClient;
  roleFunctionsMap: Map<string, ResolvedFunction[]>;
  roleGraphMap: Map<string, ResolvedGraph>;
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
}
```

`HookDeps` 由 `HookService.init()`（`src/core/services/hook-service.ts:111-126`）组装并注入到所有Hook处理器中：

```typescript
// src/core/services/hook-service.ts:111-126 (摘录)
this.deps = {
  client,
  session: new OpencodeSessionAdapter(client),
  roleFunctionsMap,
  roleGraphMap,
  roleMap,
  dir,
  dispatchManager,
  loopManager: loopService.getLoopManager(),
  customHooks: this.customHookRegistry,
  recoveryEngine: recoveryService?.getRecoveryEngine(),
  builtInHooks: recoveryService?.getBuiltInHookRegistry(),
  notificationManager: notificationService?.getNotificationManager(),
  extensionRegistry: extensionService?.getExtensionRegistry(),
  builtinConfig: recoveryService?.getBuiltinConfig(),
};
```

## 5. 工具注册模式

工具通过 `defineTool()` 工厂函数（`src/platform/ports/tool-factory.ts`）定义，使用 Zod Schema 声明参数类型和验证规则。

### 基础模式

```typescript
// src/dispatch/tools.ts:13-112 (dispatch 工具摘录)
function createDispatchTool(manager: DispatchManager, ...) {
  return defineTool({
    description: "Dispatch work to a subagent. Run synchronously or in the background.",
    args: {
      subagent: z.string().describe("The subagent to dispatch to"),
      prompt: z.string().describe("The task prompt for the subagent"),
      run_in_background: z.boolean()
        .describe("Whether to run the task in the background"),
      description: z.string().optional()
        .describe("Human-readable description of the task"),
      // ...
    },
    async execute(input, context) {
      // 实现逻辑
    },
  });
}
```

### Schema 注册

所有工具的参数 Schema 在 `ToolService.init()` 中统一注册：

```typescript
// src/core/services/tool-service.ts:92-94
for (const [name, def] of Object.entries(this.tools)) {
  registerToolSchema(name, (def as any).args);
}
```

`registerToolSchema()`（`src/hooks/tool-before.ts:15`）将工具名 → Zod raw shape 存入全局映射，供 `handleToolBefore` 在每次工具调用前做参数校验和转换。

### 工具装配流程

`buildCanonicalTools()`（`src/platform/tool-assembly.ts:66-147`）分层装配全部工具：

```
1. 核心独立工具（hashline_read/edit, memory_*, web_*, signal, asset_*）
2. 会话工具（session_*，需 sessionClient）
3. 调度工具（dispatch_*，需 dispatchManager）
4. extraTools（平台特定扩展，优先级最高）
5. loopToolsOverride（循环系统覆盖，最高优先级）
```

## 6. RoleConfig Schema

`RoleConfig`（`src/types.core.ts:88-143`）定义角色的完整配置结构，对应于 `role.yaml` 文件。

```typescript
// src/types.core.ts:88-143 (部分字段)
interface RoleConfig {
  name: string;                    // 人类可读角色名
  description: string;             // 角色用途描述
  model?: string;                  // LLM 模型标识（如 "gpt-4"）
  mode?: RoleMode;                 // 角色模式: "primary" | "subagent" | "all"
  color?: string;                  // UI 显示颜色
  variant?: string;                // 模型变体
  prompt: string;                  // 系统提示词
  prompt_file?: string;            // 提示词文件路径
  skills?: string[];              // 本地技能
  opencode_skills?: string[];     // 全局技能
  permission?: PermissionConfig;   // 工具权限控制
  subagents?: SubAgentConfig[];    // 子代理定义
  tools?: Record<string, boolean>; // 工具启用/禁用
  temperature?: number;            // 采样温度 0.0-2.0
  top_p?: number;                  // Top-p 采样 0.0-1.0
  functions?: string[];           // 可用函数
  disable_functions?: string[];   // 禁用函数
  references?: Record<string, string | ReferenceEntry>; // 引用文档
  collaboration?: CollaborationConfig; // 协作图
  dispatch?: DispatchRoleConfig;  // 调度配置
  auto_activate?: string[];       // 自动激活函数
  locked?: boolean;               // 锁定自动激活
  version?: string;               // 语义版本
  notifications?: NotificationConfig; // 通知配置
  hooks?: HooksBlock;             // 自定义Hook
  extensions?: ExtensionConfig;   // 扩展模块
  memory?: MemoryConfig;          // 记忆配置
}
```

### SubAgentConfig

子代理配置（`src/types.core.ts:44-81`）支持递归嵌套（最大深度 3 层）：

```typescript
// src/types.core.ts:44-81
interface SubAgentConfig {
  name: string;
  description: string;
  prompt: string;
  prompt_file?: string;
  model?: string;
  // ...（权限、温度、函数等覆盖）
  subagents?: SubAgentConfig[]; // 递归嵌套
}
```

## 7. HookContext API

Hook上下文提供了一组工具函数（`src/hooks/context.ts`），在Hook处理函数内部使用。

### appendCorrection

向会话追加纠正文本：

```typescript
// src/hooks/context.ts:8
function appendCorrection(
  corrections: Map<string, string>,
  sessionID: string,
  text: string,
): void
```

### fetchLastAssistantText

获取会话上一条助手消息的文本内容：

```typescript
// src/hooks/context.ts:25
async function fetchLastAssistantText(
  client: ISessionClient,
  sessionID: string,
): Promise<string | null>
```

### collectAllFunctions

收集所有角色的函数到平铺数组：

```typescript
// src/hooks/context.ts:17
function collectAllFunctions(
  fnMap: Map<string, ResolvedFunction[]>,
): ResolvedFunction[]
```

### Tool Schema Registration

`registerToolSchema` 在工具调用前执行参数校验：

```typescript
// src/hooks/tool-before.ts:15
function registerToolSchema(
  toolName: string,
  args: z.ZodRawShape,
): void
```

## 8. HookService 处理链

`HookService`（`src/core/services/hook-service.ts:151-247`）将上述接口组装为 opencode 插件可识别的处理函数：

```typescript
// src/core/services/hook-service.ts:151-247 (buildHandlers 摘录)
private buildHandlers(tools: Record<string, any>, bus: EventBus, ...) {
  const handlers = {
    tool: tools,                              // 工具映射
    event: async (input) => { ... },          // 事件处理
    config: async (config) => { ... },        // 配置注入
    "chat.message": async (input, output) => { ... },  // 消息处理
    "tool.execute.after": async (input, output) => { ... },
    "tool.execute.before": async (input, output) => { ... },
    "experimental.chat.system.transform": async (input, output) => { ... },
    "experimental.session.compacting": async (input, output) => { ... },
    dispose: async () => { ... },
  };
  return handlers;
}
```

## 9. Hook State

Hook状态（`src/hooks/state.ts`）是一个全局单例对象，保存所有运行时事务状态：

```typescript
// src/core/composition.ts:24-32 (共有导出)
export const managerMap = hookState.managerMap;
export const loopManagerMap = hookState.loopManagerMap;
export const pendingCorrections = hookState.pendingCorrections;
export const userMessagedSessions = hookState.userMessagedSessions;
export const sessionAgentRegistry = hookState.sessionAgentRegistry;
export const autoActivatedSessions = hookState.autoActivatedSessions;
export const roleAutoActivateMap = hookState.roleAutoActivateMap;
export const roleLockedMap = hookState.roleLockedMap;
export let activeLoopManager = hookState.activeLoopManager;
```

**关键状态字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `managerMap` | `Map<string, DispatchManager>` | 工作目录 → 调度管理器 |
| `loopManagerMap` | `Map<string, LoopCoordinator>` | 工作目录 → 循环协调器 |
| `pendingCorrections` | `Map<string, string>` | 会话 ID → 待发送纠正文本 |
| `sessionAgentRegistry` | `Map<string, string>` | 会话 ID → 当前代理 ID |
| `roleAutoActivateMap` | `Map<string, string[]>` | 角色 ID → 自动激活函数列表 |
| `roleLockedMap` | `Map<string, boolean>` | 角色 ID → 锁定标记 |

## 10. 扩展点系统

Extension 系统（`src/extensions/`）支持自定义条件函数、通知通道、图形拓扑等。

```typescript
// src/extensions/extension-point.ts
interface ExtensionPoint<T> {
  name: string;
  description?: string;
  register(handler: T): void;
  // ...
}
```

内置扩展点（`src/extensions/points/index.ts`）：

- `recovery-patterns` — 自定义恢复模式
- `notification-channels` — 自定义通知通道
- `notification-events` — 自定义通知事件处理器
- `observe-events` — 自定义观察事件
- `graph-topologies` — 自定义协作图拓扑

## 数据流示意

```
PluginInput (opencode)
       │
       ▼
  createPluginHooks()
       │
       ├── PluginCore (容器 + 生命周期)
       │     ├── HotReloadService
       │     ├── DispatchService
       │     ├── LoopService
       │     ├── LspService
       │     ├── NotificationService
       │     ├── SessionService
       │     ├── RecoveryService
       │     ├── ExtensionService
       │     ├── ToolService ───→ registerToolSchema()
       │     ├── HookService ───→ buildHandlers()
       │     └── HealthMonitorService
       │
       └── 返回 handlers → opencode 平台
```

## 相关参考

- [角色定义 (`role.yaml`)](/03-Reference/role-yaml)
- [函数系统](/02-Guide/functions)
- [扩展机制](/03-Reference/extensions)
- [Hook 机制](/03-Reference/hooks)
- [服务架构](/01-Overview/service-architecture) — PluginCore 生命周期、11 个服务的初始化拓扑序与降级机制

## 下一步

- [开发环境搭建](/05-Contributing/development-setup) — 贡献者构建、测试和调试指南
- [服务架构](/01-Overview/service-architecture) — 完整的 PluginCore 生命周期
