---
title: Hook 机制（Custom Hooks）
description: 自定义 Hook 参考 — role.yaml 声明字段、模块方法与输入参数、HookContext API、过滤器与阶段、生命周期、优先级、inject() 与安全机制。
---

# Hook 机制（Custom Hooks）

Hook（挂钩）让你在选定的事件上运行自己的代码：用户发消息、工具执行前后、系统提示词构建、会话生命周期事件。本页是 Hook 的参考——声明字段、模块接口、上下文 API 与运行语义；从零写一个能用的 Hook 见[自定义 Hook](/02-Guide/custom-hooks)。

> 相关：[自定义 Hook（任务走查）](/02-Guide/custom-hooks)｜[扩展机制](/03-Reference/extensions)｜[role.yaml 参考](/03-Reference/role-yaml)｜[平台与 Harness](/01-Overview/platform-harnesses)

> 自 v0.19.0 起，`role.yaml` 支持用 `hooks.custom` 注册自定义 Hook 模块。

## 最小示例

在 `role.yaml` 里声明一个 Hook，再写它的模块：

```yaml
# role.yaml
name: quality-coder
hooks:
  custom:
    - name: no-console-log
      description: 文件写入里出现 console.log 时提醒
      events: [tool.execute.after]
      module: /abs/path/to/hooks/no-console-log.js
      filter:
        tools: [write, edit]
      priority: 10
      phase: after
```

```javascript
// /abs/path/to/hooks/no-console-log.js
export default {
  onToolAfter: (ctx, { tool, args }) => {
    const content = typeof args?.content === "string" ? args.content : "";
    if (content.includes("console.log(")) {
      ctx.inject(`警告：${tool} 写入的内容里有 console.log()。`);
    }
  },
};
```

模块路径建议写绝对路径：相对路径以 rolebox 运行时的工作目录为基准解析，而不是角色目录。

## `hooks` 声明

`hooks:` 有三个子键：`custom`（自定义 Hook 列表）、`builtin`（恢复型内置 Hook 开关）、`recovery`（恢复引擎配置）。

```yaml
hooks:
  custom:
    - name: my-hook
      events: [chat.message]
      module: ./hooks/my-hook.js
  builtin:
    recovery: true
    session_error: true
  recovery:
    max_attempts: 3
```

### `hooks.custom[]` 字段

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | string | 必填 | Hook 的唯一标识 |
| `description` | string | — | 可读描述 |
| `events` | string[] | 必填 | 订阅的事件，取值见下方事件表 |
| `module` | string | 必填 | Hook 模块路径；绝对路径直接使用，相对路径按运行时工作目录解析 |
| `config` | object | — | 任意配置，原样出现在 `ctx.config` |
| `filter` | object | — | 触发限制，见「过滤器与阶段」 |
| `filter.tools` | string[] | — | 只在这些工具上触发（仅 `tool.execute.*`） |
| `filter.eventTypes` | string[] | — | 只在这些事件类型上触发（仅 `event`） |
| `priority` | number | `50` | 同一阶段内数值越小越早执行 |
| `phase` | `"before"` / `"after"` | `"after"` | 与内置处理器及核心逻辑的相对时机 |

### 事件与处理器

| 事件 | 触发时机 | 处理器 |
|---|---|---|
| `chat.message` | 用户消息进入后 | `onChatMessage` |
| `tool.execute.before` | 工具执行之前 | `onToolBefore` |
| `tool.execute.after` | 工具执行之后 | `onToolAfter` |
| `system.transform` | 系统提示词构建期间 | `onSystemTransform` |
| `event` | 生命周期事件（`session.idle`、`session.error` 等） | `onEvent` |

## Hook 模块接口

模块默认导出一个对象，属性都是**可选**的处理器，只实现需要的那几个。下面逐个给出触发时机、输入参数与示例；生命周期方法 `onLoad` / `onDispose` 不是事件处理器，见「生命周期」。

### `onChatMessage(ctx, { text })`

用户消息进入后调用，可读取、记录或按关键词追加提醒。

```javascript
onChatMessage: (ctx, { text }) => {
  if (text.includes("紧急")) ctx.inject("这是一条加急请求，请优先处理。");
},
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | HookContext | 见「HookContext API」 |
| `text` | string | 本轮消息的首个文本 part |

### `onToolBefore(ctx, { tool, args })`

工具执行之前调用，适合校验参数与记录审计信息。

```javascript
onToolBefore: (ctx, { tool, args }) => {
  if (tool === "bash" && String(args?.command ?? "").includes("rm -rf")) {
    ctx.inject("检测到 rm -rf，请先确认目标路径。");
  }
},
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | HookContext | 见「HookContext API」 |
| `tool` | string | 工具名（工具注册名，如 `write`、`bash`） |
| `args` | unknown | 该工具本次的调用参数 |

### `onToolAfter(ctx, { tool, args, output })`

工具执行之后调用，是最常用的处理器（质量检查、结果校验都在这里）。

```javascript
onToolAfter: (ctx, { tool, output }) => {
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  if (tool === "bash" && /\bFAIL\b/.test(text)) {
    ctx.inject("上一条命令输出里出现了 FAIL，请核对结果。");
  }
},
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | HookContext | 见「HookContext API」 |
| `tool` | string | 工具名 |
| `args` | unknown | 该工具本次的调用参数 |
| `output` | unknown | 该工具本次的返回结果 |

### `onSystemTransform(ctx, { system })`

构建系统提示词期间调用。`system` 就是要发给模型的条目数组，直接改数组即生效。

```javascript
onSystemTransform: (ctx, { system }) => {
  system.push("<repo-rules>\n提交前必须跑 bun test。\n</repo-rules>");
  // 也可以按标签操作：ctx.replaceBlock("repo-rules", "新内容") / ctx.removeBlock("repo-rules")
},
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | HookContext | 见「HookContext API」 |
| `system` | string[] | 系统提示词条目数组（可变） |

### `onEvent(ctx, { type, properties })`

生命周期事件到达时调用，`type` 是事件类型，`properties` 是该事件的原始属性。

```javascript
onEvent: (ctx, { type, properties }) => {
  if (type === "session.error") {
    ctx.log.warn("会话出错", { sessionID: properties?.sessionID });
  }
},
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `ctx` | HookContext | 见「HookContext API」 |
| `type` | string | 事件类型，如 `session.idle`、`session.error`、`session.deleted` |
| `properties` | object \| undefined | 事件属性（各类型不同，常见键为 `sessionID`） |

## HookContext API

每个处理器收到的 `ctx`（HookContext）提供下表成员：

| 成员 | 类型 | 说明 |
|---|---|---|
| `hookName` | string | Hook 名。事件处理器拿到的是阶段占位符 `[custom.before]` / `[custom.after]`；只有 `onLoad` / `onDispose` 是配置里的 `name` |
| `config` | object \| undefined | `role.yaml` 中该 Hook 的 `config` |
| `sessionID` | string \| undefined | 当前会话 ID（可用时） |
| `agent` | string \| undefined | 当前代理 ID；`chat.message`、`tool.execute.after`、`system.transform` 的 ctx 有值，`tool.execute.before` 与 `event` 的 ctx 没有 |
| `inject(text)` | function | 向下一个系统提示词追加文本，见「inject() 机制」 |
| `log` | Logger | 结构化日志器：事件处理器为 `hook:custom-before` / `hook:custom-after`，`onLoad` / `onDispose` 为 `hook:<name>` |
| `replaceBlock(tag, newContent)` | function \| undefined | 替换系统提示词中以 `<tag>` 开头的块；仅 `system.transform` 生效，其余事件为 no-op |
| `removeBlock(tag)` | function \| undefined | 删除 `<tag>` 块；仅 `system.transform` 生效，其余事件为 no-op |
| `getBlocks()` | function \| undefined | 读取当前系统提示词块列表（`{ tag, content }`）；非 `system.transform` 返回空数组 |
| `getFunctionState(fnName)` | function \| undefined | 读取函数运行时状态 |
| `getDispatchState()` | function \| undefined | 读取调度快照：`{ activeTaskCount, tasks }` |
| `skip()` | function \| undefined | 在事件输入对象上置位 `__skip` 标记 |
| `retry()` | function \| undefined | 在事件输入对象上置位 `__retry` 标记 |

带 `| undefined` 的成员由注册中心在每次分发前按事件装配；`onLoad` / `onDispose` 的 ctx 只有 `hookName`、`config`、`log` 和一个空操作的 `inject`。

**关于 `skip()` / `retry()`**：这两个方法只在事件输入对象上写入标记，当前版本没有读取这两个标记的处理器，因此调用是安全的，但不会跳过或重试任何内置处理。

## 过滤器与阶段

两个开关各管一半：`filter` 决定**要不要**为这次事件调用 Hook，`phase` 决定调用发生在内置逻辑的**哪一侧**。

```yaml
hooks:
  custom:
    - name: write-audit
      events: [tool.execute.after]
      module: ./hooks/audit.js
      filter:
        tools: [write, edit]     # 只在 write / edit 上触发
      phase: after               # 内置处理器之后
```

| 键 | 生效事件 | 语义 |
|---|---|---|
| `filter.tools` | `tool.execute.before` / `tool.execute.after` | 本次工具名不在列表里就跳过该 Hook |
| `filter.eventTypes` | `event` | 本次事件 `type` 不在列表里就跳过该 Hook |

一次事件固定穿过五段，`phase` 就是第 2 段与第 4 段的分界：

1. 内置 Hook `before` 阶段
2. 自定义 Hook `before` 阶段（按 `priority` 升序）
3. 核心处理器（工具调用、消息处理、事件分发）
4. 自定义 Hook `after` 阶段（按 `priority` 升序）
5. 内置 Hook `after` 阶段

每个处理器各自被 try/catch 包裹，前一个 Hook 抛错不会影响同一阶段的其他 Hook，也不会影响核心处理器。

## 生命周期：`onLoad` / `onDispose`

两个生命周期方法都是可选的，签名相同（`(ctx) => void | Promise<void>`），收到的是同一个精简 HookContext（只有 `hookName`、`config`、`log`，`inject` 是空操作）：

| 方法 | 签名 | 摘要 |
|---|---|---|
| `onLoad` | `onLoad(ctx)` | 模块加载成功后调用一次，适合初始化资源 |
| `onDispose` | `onDispose(ctx)` | 插件 dispose 时调用一次，适合清理资源 |

```javascript
// hooks/lifecycle.js
export default {
  onLoad: (ctx) => {
    ctx.log.info(`Hook ${ctx.hookName} 已加载`);
  },
  onDispose: (ctx) => {
    ctx.log.info(`Hook ${ctx.hookName} 已卸载`);
  },
};
```

| 时机 | 行为 |
|---|---|
| 模块加载成功后 | 调用一次 `onLoad`，适合初始化资源 |
| 插件 dispose | 对每个实现了 `onDispose` 的 Hook 调用一次，适合清理资源；同名 Hook 只调用一次 |
| `onLoad` 抛异常 | 记录 `Custom hook "<name>" onLoad threw`，Hook 仍然注册并继续参与事件分发 |
| 模块加载失败 | 不调用 `onLoad`；该 Hook 仍登记在事件表里，但分发时被跳过 |

不要在 `onLoad` 里执行耗时或可能阻塞的操作——它属于插件初始化流程的一部分。

## 优先级

同一阶段内按 `priority` 升序执行，默认 `50`：

```yaml
hooks:
  custom:
    - name: early-checker
      events: [tool.execute.before]
      module: ./hooks/early.js
      phase: before
      priority: 10
    - name: late-checker
      events: [tool.execute.before]
      module: ./hooks/late.js
      phase: before
      priority: 50
```

执行顺序为 `early-checker` → `late-checker`。两个 Hook 的 `priority` 相同时保持 `role.yaml` 中的声明顺序。

## `inject()` 机制

`ctx.inject(text)` 不立即改写系统提示词，而是把文本排进**下一个**系统提示词：

```javascript
onToolAfter: (ctx, { tool }) => {
  if (tool === "bash") ctx.inject("本轮已执行过 shell 命令，回答前请回读输出。");
},
```

| 环节 | 行为 |
|---|---|
| 调用 | 文本以待注入表按会话 ID 累积；同一会话的多次注入用换行拼接 |
| 落地 | 下一次 `system.transform` 把累积文本作为一个条目追加进系统提示词 |
| 清除 | 落地后立即从待注入表删除，不会重复注入 |
| 无会话 ID | `onLoad` / `onDispose` 的 `inject` 是空操作 |

在 `system.transform` 的 `before` 阶段注入的文本会在同一轮落地；在其它事件、或 `system.transform` 的 `after` 阶段注入的，都在下一次构建时落地。这条通道与内置护栏共用。

## 内置 Hook 开关（`hooks.builtin`）

`hooks.builtin` 是一个 `Record<string, boolean>`：`recovery` 是主开关，其余 9 个键各对应一个恢复型内置 Hook。错误恢复类默认开启，护栏类默认关闭。

```yaml
hooks:
  builtin:
    recovery: true                    # 主开关；false 会禁用恢复引擎与全部内置 Hook
    session_error: true               # 错误恢复类，默认 true
    write_existing_file_guard: true   # 护栏类，默认 false，这里显式打开
```

| 键 | 内置 Hook | 事件 | 阶段 | 默认 |
|---|---|---|---|---|
| `recovery` | 主开关 | — | — | `true` |
| `session_error` | session-error-recovery | `event`（`session.error`） | after | `true` |
| `edit_error` | edit-error-recovery | `tool.execute.after`（`edit` / `write` / `hashline_edit`） | after | `true` |
| `json_error` | json-error-recovery | `tool.execute.after` | after | `true` |
| `context_window` | context-window-monitor | `tool.execute.after` / `event` | after | `true` |
| `empty_response` | empty-response-detector | `tool.execute.after` | after | `true` |
| `tool_pair_validation` | tool-pair-validator | `system.transform` | after | `false` |
| `write_existing_file_guard` | write-existing-file-guard | `tool.execute.before`（`write`） | before | `false` |
| `bash_file_read_guard` | bash-file-read-guard | `tool.execute.before`（`bash`） | before | `false` |
| `webfetch_redirect_guard` | webfetch-redirect-guard | `tool.execute.after`（`webfetch`） | after | `false` |

内置 Hook 与自定义 Hook 共用上面那套五段顺序，各自的 `filter` 与 `priority` 语义也一致。

`auto_activate` **不是**这里的键：它是 `role.yaml` 的顶层字段（同级还有 `locked`），由内置的 `chat.message` 处理器在首条用户消息到达时按列表自动激活函数，写在 `hooks.builtin` 里不会被解析。字段本身见 [role.yaml 参考](/03-Reference/role-yaml)。

## 安全机制

- **故障隔离**：每个处理器单独 try/catch，失败只记一条 `Custom hook "<name>" failed on <event>`，同一阶段的其他 Hook 与核心逻辑继续执行，Agent 不会因此崩溃。
- **加载失败可降级**：模块缺失或语法错误时模块记为 `null` 并被跳过，插件照常启动。
- **模块缓存**：模块按解析后的绝对路径缓存，同一路径只加载一次；加载失败也会被缓存，后续同路径请求不再重试。修改模块代码后需要重启进程。
- **模块作用域隔离**：每个 Hook 模块有自己的模块作用域，全局状态不共享；跨 Hook 传数据用 `config`，或自行持久化到文件。
- **注入通道受控**：`inject()` 只能追加文本，且与内置护栏走同一条待注入通道。

## 平台差异（harness）

| Harness | 自定义 Hook | 恢复型内置 Hook | 说明 |
|---|---|---|---|
| opencode | 支持 | 支持 | 完整装配：生命周期处理器同时注入 `customHooks` 与 `builtInHooks` |
| pi | 支持 | 不装配 | Pi 的 Hook 管线只注入各角色声明的 `customHooks`；恢复/内置引擎是 opencode 专有 |
| dsh | 未接线 | 未接线 | dsh 的 Hook provider 只映射 chat-message / tool-before / tool-after 三类扩展点，且启动时传入空回调 |

因此本页描述的两类 Hook 属于 opencode 路径：在 pi 上恢复型内置 Hook 不参与，在 dsh 上自定义 Hook 当前不会触发。三套 harness 的目录与能力总览见[平台与 Harness](/01-Overview/platform-harnesses)。

## 排错

### Hook 没有触发

| 检查点 | 说明 |
|---|---|
| `events` | 必须是 5 个事件名之一；写错的名称不会报错，只是永远不匹配 |
| `filter.tools` | 工具名不在列表里会静默跳过，工具名以注册名为准（`write`、`edit`、`bash` 等） |
| `filter.eventTypes` | 只对 `event` 生效，比较的是事件实际的 `type` |
| `phase` | `before` / `after` 都会触发，它只决定与内置处理器的相对顺序 |
| `module` 路径 | 相对路径以运行时工作目录为基准；同一角色在不同项目目录下会解析到不同的相对路径，用绝对路径最稳 |

### 模块加载失败

日志前缀 `hook:custom-loader`，消息 `Failed to load custom hook module`，附带解析后的绝对路径与异常。常见原因是文件不存在、扩展名不被运行时识别，或模块顶层 import 了不存在的依赖。

### 处理器抛异常

日志前缀 `hook:custom-registry`，消息 `Custom hook "<name>" failed on <event>`。异常不会中断事件分发，但该处理器本次的副作用会丢失。

### 日志前缀对照

| 前缀 | 来源 | 典型消息 |
|---|---|---|
| `hook:custom-loader` | 模块加载 | `Failed to load custom hook module` |
| `hook:custom-registry` | 注册与分发 | `Registered custom hook` / `onLoad threw` / `failed on <event>` |
| `hook:custom-before` / `hook:custom-after` | 事件处理器 ctx 的 `log` | 处理器自己写下的日志 |
| `hook:<name>` | `onLoad` / `onDispose` 的 ctx 的 `log` | 同上 |

### 用 CLI 检查角色

`rolebox info <role> --check` 校验的是角色完整性哈希（通过打印 `Integrity check passed`，不一致打印 `Integrity check FAILED` 并以退出码 1 结束）。它**不**解析也不校验 `hooks.custom` 的 `module` 路径，通过它无法确认 Hook 是否可加载。