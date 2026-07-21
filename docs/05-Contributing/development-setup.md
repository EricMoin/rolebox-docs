---
title: 开发环境搭建
description: 克隆、构建、测试和调试 rolebox 开发环境
---

# 开发环境搭建

> **相关文档：** [架构概览](/05-Contributing/architecture-overview) — 模块职责和数据流 | [贡献指南](/05-Contributing/contributing) — PR 流程和代码规范 | [目录结构](/01-Overview/directory-structure) — 源码目录说明

本指南面向希望为 rolebox 贡献代码的开发者。rolebox 是一个基于 Bun 和 TypeScript 的 opencode 插件，提供 AI 代理角色定义、调度系统和多代理协作能力。

## 前提条件

| 依赖 | 最低版本 | 验证命令 |
|------|----------|----------|
| [Bun](https://bun.sh) | 1.1.x | `bun --version` |
| [Node.js](https://nodejs.org) | 20.x | `node --version` |
| [TypeScript](https://www.typescriptlang.org) | 5.7+ | `tsc --version` |

::: info
rolebox 使用 Bun 作为运行时和包管理器。如果尚未安装 Bun，请运行 `curl -fsSL https://bun.sh/install | bash`。
:::

## 克隆与安装

```bash
git clone https://github.com/EricMoin/rolebox.git
cd rolebox
bun install
```

`bun install` 会安装所有依赖（包括 `peerDependencies` 中的可选包）。核心依赖包括 `js-yaml`、`fast-glob`、`tslog`；可选依赖包括 `playwright`、`@opentui/core`、`solid-js` 等。

## 构建

| 命令 | 用途 |
|------|------|
| `bun run build` | 执行 tsc 编译 + TUI 构建 |
| `bun run build:tui` | 仅构建 TUI 子系统 |
| `bun run typecheck` | 仅类型检查 (`tsc --noEmit`)，不含输出 |

::: tip
`bun run build` 是日常开发最常用的命令；仅修改 TUI 代码时可单独运行 `bun run build:tui` 加快反馈。
:::

### TUI 构建细节

`bun run build:tui` 由 `scripts/build-tui.ts` 驱动，分三步执行：

1. **Bun 打包**：以 `src/tui/index.tsx` 为入口，使用 `@opentui/solid` 的 Bun 插件转换 JSX，输出 `dist/tui.js`（ESM 格式，目标 `bun`）
2. **类型声明**：通过 `tsconfig.tui.json` 运行 `tsc --declaration --emitDeclarationOnly`，输出到 `dist/tui/` 目录；已知 `tsc` 返回退出码 2 是预期的（Solid 插件的运行时类型不匹配，不影响运行时）
3. **`d.ts` 重定位**：将 `dist/tui/index.d.ts` 复制为 `dist/tui.d.ts`，匹配 `package.json` 中 `exports["./tui"].types` 的引用路径

最终产出物：
- `dist/tui.js` — 打包后的 TUI 运行时
- `dist/tui.d.ts` — 类型声明入口

::: tip 增量构建
开发 TUI 时可单独运行 `bun run build:tui`，无需等待 `tsc` 全量编译。仅修改非 TUI 代码时运行 `tsc` 即可：`bunx tsc`
:::

## 测试

| 命令 | 用途 |
|------|------|
| `bun test` | 运行所有测试 |
| `bun test:tui` | 仅运行 TUI 测试（`tests/tui/`） |
| `bun test -t "memory"` | 按测试名称匹配过滤 |
| `bun test --test-name-pattern "dispatch"` | 同上，完整标志形式 |

rolebox 使用 Bun 内置的测试运行器（`bun test`），支持通过 `--test-name-pattern`（短名 `-t`）按测试名称正则过滤。测试文件位于 `tests/` 目录下，覆盖 20 多个子目录，共 200+ 个测试文件。

### 测试目录结构

```
tests/
├── dispatch/              # 调度子系统（管理器、存储、并发、检查点、进度）
│   ├── manager.test.ts    # DispatchManager 生命周期
│   ├── task-store.test.ts # 任务状态持久化
│   ├── concurrency.test.ts# 并发策略与限制
│   ├── checkpoint-*.ts    # 检查点工具与存储
│   ├── progress-*.ts      # 进度报告工具
│   └── ...
├── graph/                 # 协作图子系统（推进、解析、终止、存储）
│   ├── advance.test.ts    # 图推进逻辑
│   ├── parser.test.ts     # 边/流解析
│   ├── state.test.ts      # 执行状态管理
│   ├── termination*.ts    # 终止条件评估
│   └── ...
├── cli/                   # CLI 命令
│   ├── commands/          # 各子命令独立测试
│   ├── config.test.ts     # 配置管理
│   ├── e2e.test.ts        # CLI E2E 测试
│   └── monitor-*.ts       # monitor 阅读器与渲染
├── core/                  # 核心服务（热重载、健康监控、LSP、会话）
│   ├── hot-reload-service.test.ts
│   ├── health-monitor-service.test.ts
│   └── ...
├── hooks/                 # 生命周期 Hook（chat-message, system-transform, tool-before/after...）
├── session/               # 会话管理工具
├── memory/                # 记忆存储与注入
├── recovery/              # 崩溃恢复与错误处理
├── signal/                # 信号系统
├── extensions/            # 扩展注册表与兼容性
├── hashline/              # 哈希锚点编辑引擎
├── web/                   # Web 抓取与 SSRF 防护
├── tui/                   # TUI 仪表盘逻辑
├── lsp/                   # LSP 客户端管理
├── utils/                 # 工具函数（路径、超时、显示）
└── integration/           # 跨模块集成测试

### 测试约定

#### 测试文件命名

测试文件遵循 `{module}.test.ts` 命名规则，与 `src/` 模块结构一一对应：

| 源码路径 | 测试文件 |
|----------|----------|
| `src/dispatch/manager.ts` | `tests/dispatch/manager.test.ts` |
| `src/graph/state.ts` | `tests/graph/state.test.ts` |
| `src/memory/store.ts` | `tests/memory/store.test.ts` |
| `src/cli/commands/list.ts` | `tests/cli/commands/list.test.ts` |

#### 测试风格

```typescript
import { describe, it, expect } from "bun:test";

describe("dispatch manager", () => {
  it("rejects tasks when concurrency limit is reached", () => {
    // ...
    expect(result).toBe("backpressure");
  });
});
```

- 使用 `bun:test` 的内置 `describe` / `it` / `expect`
- 测试脚手架（临时目录、mock 模块）在各测试文件的模块作用域中初始化
- 全局 mock 通过 `mock.module()` 在文件顶部设置（如 `tests/cli/commands/list.test.ts` 中使用 `mock.module("../../../src/cli/paths")`）

#### 测试夹具

- 轻量测试直接在测试函数中内联创建临时目录和 mock
- 跨测试共享的夹具放在 `tests/` 对应子目录中（如 `tests/dispatch/helpers.ts`）
- 避免大型 JSON fixture 文件；优先使用内联对象和工厂函数

#### 覆盖率预期

rolebox 采用模块级测试覆盖策略。当前 `tests/` 目录下覆盖 25+ 子目录，共 200+ 测试文件。新功能应添加对应的单元测试文件，集成测试统一放在 `tests/integration/` 目录下。运行 `bun test --coverage` 可查看覆盖率报告，重点关注：

- **dispatch/**（34 个测试文件）— 核心调度逻辑，需覆盖正常路径和错误路径（超时、并发限制、检查点恢复）
- **graph/**（19 个测试文件）— 协作图推进和终止条件，需覆盖多种拓扑模板
- **hooks/**（10 个测试文件）— 生命周期 Hook，需覆盖消息拦截和工具调用前后处理
- **core/**（9 个测试文件）— 服务生命周期和降级机制
- **integration/**（8 个测试文件）— 跨模块端到端场景，验证调度 → 循环 → 恢复全链路

## 调试标志

| 环境变量 | 用途 | 定义位置 |
|----------|------|----------|
| `ROLEBOX_LOG_LEVEL` | 日志级别：`silly` / `trace` / `debug` / `info` / `warn` / `error` / `fatal`，默认 `info` | `src/logger.ts` |
| `ROLEBOX_METRICS` | 设为 `true` 启用指标收集与持久化 | `src/dispatch/persistence/metrics.ts` |
| `ROLEBOX_LOG_FILE` | 日志文件路径，未设置时默认 `~/.config/rolebox/logs/rolebox.log` | `src/logger.ts` |
| `ROLEBOX_METRICS_EXPORT` | 指标导出文件路径（为 `dispatch_metrics` 工具的 `export_path` 提供后备） | `src/dispatch/tools.ts` |

使用示例：

```bash
ROLEBOX_LOG_LEVEL=debug bun test
ROLEBOX_METRICS=true bun run build
```

### 调试技巧

| 问题 | 排查方法 |
|------|----------|
| **`bun test` 夹具污染** | 检查测试是否共享了可变状态（如全局 mock、文件系统状态）。使用 `mock.module()` 时确保在文件顶部设置，或在每个 `describe` 块中重新声明。 |
| **TUI 构建退出码 2** | `bun run build:tui` 中 `tsc` 返回退出码 2 是预期行为（Solid 插件运行时类型不兼容），不影响 `dist/tui.js` 产出。检查 `tsconfig.tui.json` 的 `include` 范围是否正确。 |
| **本地链接不生效** | 确认 `bun run build` 已完成且 `dist/` 目录包含最新产出。`npm link` 需要在 `dist/` 目录内执行。重启 opencode 后运行 `rolebox --version` 确认显示 `dev` 版本。 |
| **日志文件位置** | 默认日志路径为 `~/.config/rolebox/logs/rolebox.log`。设置 `ROLEBOX_LOG_FILE` 环境变量可重定向到自定义路径。 |
| **测试超时** | Bun 默认测试超时为 5 秒。对涉及文件系统或子进程的测试，在 `it()` 中设置显式超时：`it("handles slow op", async () => { ... }, { timeout: 10000 })`。 |

## 本地链接

在本地开发中快速测试变更，最关键的是让 opencode 加载 `dist/` 而非 npm 包：

```bash
# 1. 构建
bun run build

# 2. 使用 npm link（推荐）
cd dist && npm link

# 在 opencode 项目或全局中链接
cd ~/.config/opencode && npm link rolebox

# 3. 重启 opencode 以加载本地构建
```

验证本地链接生效：

```bash
# 确认 rolebox CLI 指向本地构建
which rolebox
rolebox --version    # 应显示 dev 版本
```

::: tip
每次修改代码后，只需运行 `bun run build` 然后重启 opencode 即可。TUI 修改可单独运行 `bun run build:tui` 来提速。
:::

### VS Code 调试

在 `.vscode/launch.json` 中添加以下配置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug rolebox CLI",
      "runtimeExecutable": "bun",
      "args": ["run", "src/cli/main.ts"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true
    }
  ]
}
```

## 下一步

- [架构概览](/05-Contributing/architecture-overview) — 模块职责和数据流
- [贡献指南](/05-Contributing/contributing) — PR 流程和代码规范
- [CLI 命令参考](/03-Reference/cli) — 命令行工具参考
