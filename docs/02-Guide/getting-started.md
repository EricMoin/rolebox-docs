---
title: 快速入门
description: 用户快速入门 — 安装、创建角色、使用场景；以及贡献者开发指南
---

# 快速入门

> **相关文档：** [快速概览](/01-Overview/quick-start) — 30秒快速体验 | [创建角色](/02-Guide/create-a-role) — 角色创建实战指南 | [CLI 使用](/03-Reference/cli) — 命令行工具参考 | [目录结构](/01-Overview/directory-structure) — 项目文件组织

rolebox 是一个 opencode 插件，可将一个 AI 编码助手转变为一支专业团队。定义角色、函数、技能和协作图，全部使用 YAML 配置，无需编写代码。

## 用户快速入门

在 30 秒内安装 rolebox 并创建你的第一个角色：

```bash
# 安装 rolebox 插件
cd ~/.config/opencode && npm install rolebox
```

在 `opencode.jsonc` 中添加插件声明：

```jsonc
{
  "plugin": ["rolebox"]
}
```

**创建你的第一个角色：**

```bash
rolebox init my-agent -y
```

一个可直接使用的角色目录将创建在 `~/.config/opencode/rolebox/my-agent/` 中。重启 opencode 后，从代理列表中选择 `my-agent` 即可开始使用。

**安装 Emperor 编排器**（可选，用于多代理协作）：

```bash
rolebox install emperor
```

安装成功后，你的角色目录结构如下：

```
~/.config/opencode/rolebox/my-agent/
├── role.yaml           # 角色配置（名称、技能、函数等）
├── functions/          # 函数定义
├── skills/             # 技能定义
└── references/         # 引用文档
```

关于角色配置的更多信息，参见[创建角色](/02-Guide/create-a-role)。关于函数和技能的编写规范，参见[编写函数](/02-Guide/writing-functions)和[编写技能](/02-Guide/authoring-skills)。

### 选择正确模板

`rolebox init` 提供了四种内置模板（`src/cli/templates/index.ts:31-35`），覆盖从简单单角色到多代理协作的常见场景：

| 模板 | 适用场景 | 何时选择 |
|------|----------|----------|
| `minimal` | 简单单角色，仅需 YAML 配置与提示词文件 | 快速原型、个人工具角色、无需子代理或技能的独立任务 |
| `standard` | 标准角色，附带 functions/、skills/、references/ 目录 | 多数场景的默认选择，为后续扩展预留完整目录结构 |
| `subagents` | 父角色 + 子代理，通过 `task()` 派发任务 | 需要分工协作（如研究 → 写作 → 审校），子代理各有专用提示词 |
| `collaboration` | 多代理协作图，具备内置拓扑（pipeline / review-loop / star） | 需要结构化工作流编排，代理间有明确的传递顺序和循环规则 |

选择策略：以 `standard` 作为起点，按需逐步升级；当角色需要拆分任务时改为 `subagents`；当需要自动化工作流路由时改为 `collaboration`。

## 贡献者指南

本指南面向希望为 rolebox 贡献代码的开发者。rolebox 是一个基于 Bun 和 TypeScript 的 opencode 插件，提供 AI 代理角色定义、调度系统和多代理协作能力。

### 前提条件

| 依赖 | 最低版本 | 验证命令 |
|------|----------|----------|
| [Bun](https://bun.sh) | 1.1.x | `bun --version` |
| [Node.js](https://nodejs.org) | 20.x | `node --version` |
| [TypeScript](https://www.typescriptlang.org) | 5.7+ | `tsc --version` |

::: tip
rolebox 使用 Bun 作为运行时和包管理器。如果尚未安装 Bun，请运行 `curl -fsSL https://bun.sh/install | bash`。
:::

### 克隆与安装

```bash
git clone https://github.com/mgdream/rolebox.git
cd rolebox
bun install
```

`bun install` 会安装所有依赖（包括 `peerDependencies` 中的可选包）。核心依赖包括 `js-yaml`、`fast-glob`、`tslog`；可选依赖包括 `playwright`、`@opentui/core`、`solid-js` 等（`package.json:62-83`）。

### 构建

```bash
bun run build          # 执行 tsc 编译 + TUI 构建
bun run build:tui      # 仅构建 TUI 子系统 (scripts/build-tui.ts)
bun run typecheck      # 仅类型检查 (tsc --noEmit)，不含输出
```

`build` 脚本定义于 `package.json:36`，先后执行 `tsc` 和 `bun run build:tui`。TUI 构建脚本位于 `scripts/build-tui.ts`。

### 运行测试

```bash
bun test               # 运行所有测试
bun test:tui           # 仅运行 TUI 测试 (tests/tui/)
```

rolebox 使用 Bun 内置的测试运行器。测试文件位于 `tests/` 目录下，覆盖 20 多个子目录，共 63+ 个测试文件。

### 本地链接与调试

要在本地 opencode 开发环境中测试 rolebox 变更：

```bash
# 在 rolebox 项目目录中构建
bun run build

# 创建一个指向本地构建的链接
# opencode 从 ~/.config/opencode/ 加载插件
# 可以通过符号链接或直接复制 dist/ 目录进行测试
```

#### VS Code 调试设置

在 `.vscode/launch.json` 中添加以下配置以调试 rolebox 的 TypeScript 源码：

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

#### 推荐 IDE 插件

| 插件 | 用途 |
|------|------|
| [TypeScript](https://code.visualstudio.com/docs/languages/typescript) | 类型检查与导航 |
| [Edge](https://marketplace.visualstudio.com/items?itemName=EditorSyntax.Edge) | 配置文件的语法高亮 |
| [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) | role.yaml 补全与校验 |

### 项目结构

```
rolebox/
├── src/                  # 源码
│   ├── core/             # 插件核心：plugin-core.ts, event-bus, service-supervisor
│   ├── function/         # 函数系统：parser, state-machine, observe, continuation
│   ├── hooks/            # Hook 系统：chat-message, event-handler, custom hook registry
│   ├── dispatch/         # 调度系统：tools, concurrency, budget, checkpoint
│   ├── resolver/         # 解析器：role-loader, frontmatter, env-resolver, reference-resolver
│   ├── loader/           # 加载层：role-loader, subagents
│   ├── extensions/       # 扩展系统：extension-point, loader, conditions, capabilities
│   ├── recovery/         # 恢复引擎：retry, fallback, truncate, compaction 策略
│   ├── graph/            # 协作图：templates, validator, termination
│   ├── notifications/    # 通知系统：email, slack, webhook channels
│   ├── signal/           # 信号系统：signal-ledger, signal-tool
│   ├── session/          # 会话工具：analytics, export, search
│   ├── memory/           # 记忆存储
│   ├── loop/             # 循环协调器
│   ├── tui/              # 终端 UI 组件
│   ├── web/              # 网络工具：web-fetch, web-search, browser-detect
│   ├── lsp/              # LSP 客户端管理器
│   └── cli/              # CLI 入口
├── functions/            # 内置函数定义 (plan.md, execute.md, loop.md)
├── examples/             # 角色示例 (code-reviewer, team-lead, tech-writer)
├── tests/                # 测试文件
└── docs/                 # 源文档
```

### 发布流程

1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md`
3. 执行 `bun run build` 确认构建通过
4. 执行 `bun test` 确认所有测试通过
5. 发布 npm 包：`npm publish`

### 快速参考

```bash
# 常用开发命令
bun install              # 安装依赖 (package.json:62-83)
bun run build            # 完整构建 (package.json:36)
bun run typecheck        # 类型检查 (package.json:39)
bun test                 # 单元测试 (package.json:40)
bun test:tui             # TUI 测试 (package.json:41)
```

### 开发速查表

| 命令 | 作用 |
|------|------|
| `bun install` | 安装所有依赖（包括 peerDependencies 中的可选包） |
| `bun run build` | 完整构建：执行 `tsc` 编译 + TUI 构建 |
| `bun run build:tui` | 仅构建 TUI 子系统（`scripts/build-tui.ts`） |
| `bun run typecheck` | 仅类型检查，不产生输出文件（`tsc --noEmit`） |
| `bun test` | 运行所有测试（Bun 内置测试运行器） |
| `bun test:tui` | 仅运行 TUI 测试（`tests/tui/`） |
| `bun run docs:dev` | 启动文档本地开发服务器（VitePress） |
| `bun run docs:build` | 构建生产文档站点 |
| `bun run docs:preview` | 预览已构建的文档站点 |

以上脚本定义于 `package.json:35-46`。开发时最常用的组合：`bun run build` 确保代码可编译，`bun test` 确保回归通过。

## 下一步

- [创建角色](/02-Guide/create-a-role) — 编写完整的 `role.yaml` 配置
- [目录结构](/01-Overview/directory-structure) — 了解项目文件组织
- [CLI 使用](/03-Reference/cli) — 命令行工具完整参考
