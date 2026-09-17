---
title: 自定义 Hook
description: 从零写一个在文件编辑后跑质量检查的 Hook：role.yaml 声明、模块契约、代码实现与验证步骤
---

# 自定义 Hook（Custom Hooks）

自定义 Hook（钩子）让你把一段自己的逻辑挂到 rolebox 的生命周期上——例如每次文件写入后检查代码质量。你通过 `role.yaml` 的 `hooks.custom` 声明它，每个 Hook 是一个导出若干处理函数的 JavaScript 模块。本页用一个完整的质量检查 Hook 走完声明 → 模块契约 → 代码 → 验证，并给出另外两个代表性示例；字段与接口的完整定义见 [Hook 参考](/03-Reference/hooks)。

> 前置：[创建角色](/02-Guide/create-a-role)｜相关：[Hook 参考](/03-Reference/hooks)、[扩展机制](/03-Reference/extensions)

## 最小示例：编辑后检查代码质量

### 1. 声明

在角色目录的 `role.yaml` 里加一段 `hooks.custom`：

```yaml
# role.yaml
name: Quality-Conscious Coder
hooks:
  custom:
    - name: quality-checker
      description: 文件编辑后检查调试残留
      events: [tool.execute.after]
      module: hooks/quality-checker.js
      filter:
        tools: [write, edit, hashline_edit]
      config:
        rules: [no-console-log, no-debugger]
      priority: 10
      phase: after
```

这段声明做了四件事：

- `events` 订阅工具执行之后的事件。
- `module` 指向 Hook 模块；相对路径相对**角色目录**解析。
- `filter.tools` 把它收窄到 `write`、`edit`、`hashline_edit` 三个文件编辑工具。
- `config` 是任意配置，运行时通过 `ctx.config` 读取；`priority` 与 `phase` 控制执行顺序。

### 2. 模块契约

Hook 模块默认导出一个对象，键是处理函数名，全部可选：

```javascript
export default {
  onToolAfter: (ctx, { tool, args, output }) => {
    /* 工具执行之后：最常用于"编辑后检查" */
  },
  // 其余可选：onToolBefore / onChatMessage / onSystemTransform / onEvent / onLoad / onDispose
};
```

`ctx` 里最常用的两个成员是 `inject(text)`（把文本追加到下一次系统提示）与 `log`（结构化日志）；声明里的 `config` 对象通过 `ctx.config` 读取。每个处理函数的签名、`ctx` 的完整成员，以及事件与处理函数的对应关系见 [Hook 参考](/03-Reference/hooks)。

### 3. 实现

新建 `hooks/quality-checker.js`：

```javascript
// hooks/quality-checker.js
const RULES = {
  "no-console-log": {
    test: (text) => text.includes("console.log("),
    message: "发现 console.log()，请移除调试输出后再继续",
  },
  "no-debugger": {
    test: (text) => /\bdebugger\b/.test(text),
    message: "发现 debugger 语句，请移除后再继续",
  },
};

/** 从不同文件编辑工具的入参里取出本次写入的文本。 */
function editedText(args) {
  if (!args || typeof args !== "object") return "";
  const parts = [];
  if (typeof args.content === "string") parts.push(args.content);      // write
  if (typeof args.newString === "string") parts.push(args.newString);  // edit
  if (Array.isArray(args.edits)) {                                     // hashline_edit
    for (const edit of args.edits) {
      if (typeof edit?.lines === "string") parts.push(edit.lines);
      else if (Array.isArray(edit?.lines)) parts.push(edit.lines.join("\n"));
    }
  }
  return parts.join("\n");
}

export default {
  onToolAfter: (ctx, { tool, args }) => {
    const text = editedText(args);
    if (!text) return;

    const enabled = ctx.config?.rules ?? Object.keys(RULES);
    for (const id of enabled) {
      const rule = RULES[id];
      if (rule?.test(text)) {
        ctx.inject(`<quality-check rule="${id}">${rule.message}（${tool}）</quality-check>`);
      }
    }
  },

  onLoad: (ctx) => {
    ctx.log.info(`quality-checker loaded (rules: ${(ctx.config?.rules ?? []).join(", ") || "all"})`);
  },
};
```

`inject()` 写入的内容不会立刻出现在对话里：它在下一次构建系统提示时以系统提醒的形式追加进去，代理会看到并按提示处理。

### 4. 验证

先把角色同步到 harness：

```bash
rolebox sync opencode
```

```text
应看到：
Synced 1 roles to opencode
（示例输出：数字随已安装且需要同步的角色数量变化）
```

然后在 harness 里让代理写入一个包含 `console.log(...)` 的文件，例如：

```text
给这个函数补上日志后写入 utils/format.ts
```

应看到：文件写入成功，代理在下一轮收到一条形如 `<quality-check rule="no-console-log">` 的系统提醒，并据此移除调试语句。

没有生效时，按顺序检查：

1. `module` 路径是否正确——相对角色目录解析，不是相对工作区；路径错误时 Hook 会被记录一条警告并跳过。
2. `events` 与处理函数是否对应——声明 `tool.execute.after` 就要实现 `onToolAfter`。
3. `filter.tools` 里的工具名是否写对；名字写错时 Hook 永远不会触发。
4. 是否在 `rolebox sync` 之后重启了 harness——Hook 模块在插件初始化时加载并缓存。
5. 打开调试日志确认加载记录：日志前缀是 `hook:custom-loader`（加载失败）与 `hook:custom-registry`（注册与分发）；把 `ROLEBOX_LOG_LEVEL` 设为 `debug` 还会输出 `Registered custom hook`。完整排查方法见 [Hook 参考](/03-Reference/hooks)。

## 示例：把项目规范注入系统提示

`onSystemTransform` 适合放"每次都要告诉代理"的固定上下文。下面的 Hook 在系统提示里补一段项目规则，并用 `getBlocks()` 避免重复注入：

```javascript
// hooks/project-rules.js
export default {
  onSystemTransform: (ctx, { system }) => {
    const tag = "project-rules";
    const already = ctx.getBlocks?.().some((block) => block.tag === tag);
    if (already) return;

    system.push(`<${tag}>`);
    system.push("优先使用 TypeScript strict 模式；禁止新增 any；提交前必须通过 lint 与类型检查。");
    system.push(`</${tag}>`);
  },
};
```

```yaml
# role.yaml
hooks:
  custom:
    - name: project-rules
      events: [system.transform]
      module: hooks/project-rules.js
      priority: 20
      phase: after
```

它和 `inject()` 的区别：`onSystemTransform` 直接改写本次提示片段数组，改动立即生效；`inject()` 追加的内容要等到下一次提示构建。两者都只应写稳定的规则，不要放会随分支、时间变化的信息。

## 示例：记录会话生命周期

需要审计或排错时，用 `onEvent`、`onLoad`、`onDispose` 记录会话事件：

```javascript
// hooks/session-audit.js
export default {
  onEvent: (ctx, { type, properties }) => {
    if (type === "session.error") {
      ctx.log.warn(`会话错误：${JSON.stringify(properties)}`);
    }
    if (type === "session.idle") {
      const dispatch = ctx.getDispatchState?.();
      ctx.log.info(`会话空闲，运行中的任务数：${dispatch?.activeTaskCount ?? 0}`);
    }
  },

  onLoad: (ctx) => ctx.log.info(`已加载 ${ctx.hookName}`),
  onDispose: (ctx) => ctx.log.info(`已卸载 ${ctx.hookName}`),
};
```

```yaml
# role.yaml
hooks:
  custom:
    - name: session-audit
      events: [event]
      module: hooks/session-audit.js
      filter:
        eventTypes: [session.idle, session.error]
      priority: 100
      phase: after
```

日志写到 rolebox 的日志文件（默认 `~/.config/rolebox/logs/rolebox.log`），前缀为 `hook:session-audit`。

## 常用旋钮

三个示例已经用到全部旋钮，要点如下：

- `events` 决定 Hook 在什么时机被调用；`filter.tools` / `filter.eventTypes` 把它进一步收窄到具体工具或事件子类型。
- `phase` 选择相对内置逻辑的位置：`before` 在内置处理之前，`after`（默认）在其之后。
- `priority` 决定同一相位内的顺序：数值小的先执行，默认 `50`；所有 `before` 相位都在任何 `after` 相位之前。

```yaml
hooks:
  custom:
    - name: strict-check
      events: [tool.execute.after]
      module: hooks/strict-check.js
      filter:
        tools: [write, edit]
      phase: after
      priority: 10        # 比默认的 50 先执行
```

字段类型、默认值、执行顺序与 `ctx` 的完整 API 见 [Hook 参考](/03-Reference/hooks)。

## 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| Hook 完全不触发 | `module` 路径错误 | 相对角色目录改写路径，或查日志确认加载失败 |
| Hook 完全不触发 | `events` 与实现的处理函数不匹配 | 让事件与 `onXxx` 对应 |
| 只在部分工具之后触发 | `filter.tools` 名称写错或漏写 | 对照实际工具名补齐 |
| 提醒没有出现在对话里 | `inject()` 要到下一次提示构建才生效 | 继续一轮，或改用 `onSystemTransform` |
| 改了代码但行为不变 | 模块被缓存且未重新加载 | 重新 `rolebox sync` 并重启 harness |
| 一个 Hook 报错后其他 Hook 也不执行 | 不应发生：每个处理函数都被独立捕获 | 用 `hook:custom-registry` 日志定位该 Hook |

## 备注

> 自 v0.19.0 起，可以在 `role.yaml` 的 `hooks.custom` 中声明自定义 Hook（事件订阅、相位、优先级与过滤）。

## 相关

- [Hook 参考](/03-Reference/hooks) — 声明字段、模块接口、HookContext API、执行顺序与调试
- [扩展机制](/03-Reference/extensions) — 用扩展点扩展条件、图拓扑、通知渠道等封闭词表
- [创建角色](/02-Guide/create-a-role) — role.yaml 的结构与角色目录布局
- [平台与 Harness](/01-Overview/platform-harnesses) — 三套 harness 的目录与能力差异
