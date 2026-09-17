---
title: 扩展机制（Extensions）
description: 扩展参考 — 7 种扩展作用域的 role.yaml 声明、模块合约、注册流程、接线现状、安全机制与平台支持。
---

# 扩展机制（Extensions）

扩展（extension）把 rolebox 的封闭词汇表打开一个口子：不改动 rolebox 源码，就能加入自定义条件、图拓扑、恢复策略与模式、通知通道与事件、观察事件。本页是扩展的参考——每种作用域声明什么、模块必须导出什么、注册时发生什么。

> 相关：[Hook 机制](/03-Reference/hooks)｜[role.yaml 参考](/03-Reference/role-yaml)｜[错误处理](/03-Reference/error-handling)｜[自定义 Hook（任务走查）](/02-Guide/custom-hooks)

> 自 v1.8.0 起，扩展作用域为 7 种；此前的一个作用域已随声明式协作子系统移除。

## 最小示例

在 `role.yaml` 里声明扩展，再写它们的模块。下面把 7 种作用域各写一条：

```yaml
# role.yaml
extensions:
  conditions:
    - name: dispatch_all_complete
      module: ext/dispatch-complete.js
  graph_topologies:
    - name: diamond
      module: ext/diamond-topology.js
  recovery_strategies:
    - name: my-recovery
      module: ext/my-recovery.js
      categories: [session_error]
  recovery_patterns:
    - name: my-pattern
      module: ext/my-pattern.js
      category: session_error
  notification_channels:
    - kind: slack
      module: ext/slack-channel.js
  notification_events:
    - name: custom_event_occurred
  observe_events:
    - name: dispatch_complete
      module: ext/dispatch-event.js
```

```javascript
// ext/slack-channel.js —— notification_channels 的模块合约
export default {
  create: (config) => ({
    kind: "slack",
    send: async (message) => {
      await fetch(config.webhookUrl, {
        method: "POST",
        body: JSON.stringify({ text: message.text }),
      });
    },
    dispose: async () => {
      // 释放 HTTP 连接等资源
    },
  }),
};
```

条目里的 `module` 建议写绝对路径：相对路径以 rolebox 运行时的工作目录为基准解析，而不是角色目录。

## 7 种扩展作用域

| 作用域 | 打开的内容 | 模块合约 | 条目字段 |
|---|---|---|---|
| `conditions` | 函数门控 / 转换条件名 | `{ handler(arg, env) => boolean }` | `name`、`module` |
| `graph_topologies` | 图拓扑模板 | `{ expand(agents) => FlowEdge[] }` | `name`、`module` |
| `recovery_strategies` | 错误恢复策略名 | `{ name, execute(ctx) => Promise }` | `name`、`module`、`categories?` |
| `recovery_patterns` | 错误检测模式 | `{ name, category, match(error) }` | `name`、`module`、`category` |
| `notification_channels` | 通知通道类型 | `{ create(config) => { kind, send, dispose } }` | `kind`、`module` |
| `notification_events` | 通知事件类型名 | 无（只登记名称，不加载模块） | `name` |
| `observe_events` | 函数观察事件处理器 | `{ handle(ctx, spec) => string[] }` | `name`、`module` |

所有条目都接受可选的 `description`。模块用默认导出（`export default`）暴露合约对象。

## 作用域详解

### `conditions`（条件）

注册一个命名条件，之后可以在函数 frontmatter 的 `gate`、`transition`、`continue_until` 里按名字引用。

```javascript
// ext/dispatch-complete.js
export default {
  capability: true, // 声明使用只读能力对象
  handler: (arg, cap) => cap.getStateValue("dispatch_complete") === "true",
};
```

模块导出 `handler(arg, env)`，`env` 是完整求值环境；如果模块额外导出 `capability: true`，第二个参数会换成**只读能力对象**，后者只暴露下面这些读取接口：

| 能力成员 | 说明 |
|---|---|
| `sessionID` / `fnName` | 会话 ID 与函数名 |
| `isUserMessagedThisTurn()` | 本轮用户是否发过消息 |
| `getTodosRemaining()` | 会话计划中未勾选的 `- [ ]` 数量 |
| `artifactExists(name)` | 命名制品是否存在且有内容 |
| `isEvidenceMet(evidence[])` | 指定证据标签是否全部满足 |
| `wasToolObserved(tool)` | 本会话是否观察到某个工具 |
| `getTurnsSinceActivation()` | 函数激活后经过的轮数 |
| `getStateValue(key)` | 只读读取运行时 KV 中的一个值 |

同名条件会被后注册的覆盖，并记录一条 `Condition '<name>' already registered — overwriting` 警告。

### `graph_topologies`（图拓扑）

注册一个拓扑模板：`expand(agents)` 接收代理名列表，返回边列表，边形如 `{ from, to, label?, exit? }`。

```javascript
// ext/diamond-topology.js
export default {
  expand: (agents) => [
    { from: "parent", to: agents[0] },
    { from: agents[0], to: agents[1] },
    { from: agents[0], to: agents[2] },
    { from: agents[1], to: agents[3] },
    { from: agents[2], to: agents[3] },
  ],
};
```

注册的拓扑名同时进入图模板的合法取值集合；自定义拓扑的 `expand` 优先于内置的 `pipeline` / `review-loop` / `star`。同名拓扑会被覆盖，并记录一条 `overwriting existing custom topology: "<name>"` 警告。

### `recovery_strategies`（恢复策略）

注册一个可被恢复链引用的策略。模块必须导出 `name` 与 `execute`；`execute` 收到包含 `sessionID`、`error`、`category` 等信息的上下文，返回任意结果对象。

```javascript
// ext/my-recovery.js
export default {
  name: "my-recovery",
  execute: async (ctx) => {
    console.log(`Recovering from: ${ctx.error.message}`);
    return { status: "success" };
  },
};
```

通过扩展注册的策略会走完整链路：条目名登记为**已知策略**（YAML 的恢复链可以直接引用它），模块本身注册进恢复引擎的策略表。因此不需要再手工调用登记接口；只有绕过扩展、直接编程式注册时才需要自己登记策略名。可选的 `categories` 声明该策略适用的错误类别。

### `recovery_patterns`（恢复模式）

注册一个错误检测模式：模块必须导出 `name`、`category` 与 `match`，注册键取条目里的 `name`。

```javascript
// ext/my-pattern.js
export default {
  name: "my-pattern",
  category: "session_error",
  match: (error) =>
    error && error.code === "MY_PATTERN"
      ? { category: "session_error", message: String(error) }
      : null,
};
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 模式名（模块必须导出，注册键取条目 `name`） |
| `category` | string | 该模式归属的错误类别，如 `session_error` |
| `match` | function | `(error) => RecoveryError \| null`，命中返回错误对象，未命中返回 `null` |

模式按注册顺序追加进模式表：`detectFirst` 与 `detectCategory` 都取**第一个**命中项，所以顺序有意义；同名模式不会去重。单个模式在匹配时抛错只会被跳过，不影响其他模式。

### `notification_channels`（通知通道）

注册一种通知通道类型。条目用 `kind` 而不是 `name`；模块导出 `create(config)` 工厂，返回带 `kind`、`send(message)`、`dispose()` 的通道对象。

```javascript
// ext/slack-channel.js
export default {
  create: (config) => ({
    kind: "slack",
    send: async (message) => {
      await fetch(config.webhookUrl, { method: "POST", body: JSON.stringify({ text: message.text }) });
    },
    dispose: async () => {},
  }),
};
```

创建通道时先查自定义工厂、再落到内置通道，因此自定义 `kind` 可以覆盖同名内置通道。注册后即可在角色的通知配置里写 `kind: slack`。

### `notification_events`（通知事件）

只登记一个事件类型名，不加载 `module`——该作用域的条目即使写了 `module` 也不会被导入。

```yaml
extensions:
  notification_events:
    - name: custom_event_occurred
```

通知管理器发送通知前会校验事件类型是否属于内建集合：`idle`、`question`、`permission`、`error`、`dispatch_complete`、`dispatch_progress`、`loop_complete`、`approval_pending`、`session_deleted`、`custom`。集合之外的名称会被记录为 `Unknown notification event type` 并丢弃，所以自定义事件当前请复用内建的 `custom`。

### `observe_events`（观察事件）

注册一个以事件名为键的观察处理器：模块导出 `handle(ctx, spec)`，返回要注入的字符串数组，`spec` 是函数 `observe:` 里对应的那条声明（用 `spec.on` 比对事件名）。

```javascript
// ext/dispatch-event.js
export default {
  handle: (ctx, spec) => (spec.on === "dispatch_complete" ? ["[observe] 调度全部完成"] : []),
};
```

模块也可以导出 `capability: true`，此时第一个参数换成只读的观察能力对象：

| 能力成员 | 说明 |
|---|---|
| `sessionID` / `eventName` | 会话 ID 与事件名 |
| `toolName` / `toolArgs` / `toolOutput` | 事件来自工具调用时的工具信息 |
| `lastAssistantText` | 事件触发前最后一条助手文本 |

```javascript
// 能力模式下同样用 spec.on 比对事件名
export default {
  capability: true,
  handle: (cap, spec) => (spec.on === cap.eventName ? [`[observe] ${cap.eventName}`] : []),
};
```

## 注册流程

插件初始化时按下面的顺序处理每个角色的 `extensions:`：

1. 读取角色的 `extensions:` 块；块缺失或为空则整步是 no-op。
2. 逐作用域交给对应的扩展点，扩展点逐条加载模块：绝对路径直接使用，相对路径按运行时工作目录拼接。
3. 模块按绝对路径缓存，同一路径只导入一次；加载失败记录 `Failed to load extension module` 警告并返回空，该条目被跳过，其余条目继续加载。
4. 加载成功的模块按作用域注册，注册键是条目里的 `name`（`notification_channels` 用 `kind`）。
5. 恢复策略与恢复模式额外桥接进恢复引擎：策略同时登记为已知策略，模式注册进模式表。

| 作用域 | 注册到 | 冲突行为 |
|---|---|---|
| `conditions` | 命名条件表 | 覆盖并记警告 |
| `graph_topologies` | 拓扑表 + 图模板合法取值集合 | 覆盖并记警告 |
| `recovery_strategies` | 已知策略表 + 恢复引擎策略表 | 后注册覆盖先注册 |
| `recovery_patterns` | 恢复引擎模式表（按注册顺序追加） | 不去重，顺序决定命中优先级 |
| `notification_channels` | 通道工厂表 | 覆盖；自定义优先于内置通道 |
| `notification_events` | 事件名登记 | 后注册覆盖先注册 |
| `observe_events` | 观察处理器表 | 后注册覆盖先注册 |

## 接线现状

注册成功不等于运行时会用到它。当前版本各作用域的实际使用情况：

| 作用域 | 运行时是否消费 |
|---|---|
| `conditions` | 是——命名条件在函数 frontmatter 的 `gate` / `transition` / `continue_until` 求值时使用 |
| `recovery_strategies` | 是——恢复链按策略名查找并调用 `execute` |
| `recovery_patterns` | 是——错误分类时按模式表匹配 |
| `notification_channels` | 是——创建通道时先查自定义工厂 |
| `graph_topologies` | 否——拓扑展开器没有运行时调用点（自定义拓扑名仍会进入图模板合法取值集合） |
| `notification_events` | 否——发送前的事件类型闸门只接受内建事件类型 |
| `observe_events` | 否——观察处理器表没有运行时调用点 |

## 安全机制与注意事项

- **故障隔离**：加载或注册失败的条目只影响自己——记录警告后跳过，不影响同一角色的其他扩展、其他角色的扩展与插件启动。
- **增量开放**：内置词汇表（条件、拓扑、恢复策略与模式、通知通道与事件）保持不变，扩展只做加法；空配置或缺失的 `extensions:` 块不改变任何行为。
- **模块缓存**：模块按解析后的绝对路径缓存，失败结果同样入缓存，后续同路径请求不再重试；热重载会清空扩展模块的加载缓存。开发期间改动模块代码后，重启进程最保险。
- **进程级作用域**：所有角色的扩展注册进同一批表，不按角色隔离；角色被移除或热重载后，已注册的扩展不会被撤回。
- **能力对象只读**：`capability: true` 时处理器拿到的是只读能力对象，写不进函数状态与制品，改动内部结构必须走默认的完整环境写法。

## 平台支持

| Harness | `extensions:` 是否生效 |
|---|---|
| opencode | 生效——插件初始化时装配扩展服务并加载每个角色的声明 |
| pi | 不生效——Pi 的服务栈不装配扩展服务，声明被忽略 |
| dsh | 不生效——同上 |

在 pi 与 dsh 上，角色里的 `extensions:` 块不会报错也不会生效；需要扩展能力时请在 opencode 上运行。三套 harness 的目录与能力总览见[平台与 Harness](/01-Overview/platform-harnesses)。
