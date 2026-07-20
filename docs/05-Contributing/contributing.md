---
title: 贡献指南
description: PR 流程、代码风格与测试规范
---

# 贡献指南

> **相关文档：** [开发环境搭建](/05-Contributing/development-setup) — 构建和测试指南 | [架构概览](/05-Contributing/architecture-overview) — 模块职责和数据流 | [CLI 命令参考](/03-Reference/cli) — 命令行工具参考

感谢你考虑为 rolebox 贡献代码！本文档概述了贡献流程、代码规范和 PR 审查标准。

## 贡献流程

1. **Fork 仓库** — 将 [rolebox](https://github.com/mgdream/rolebox) fork 到你的 GitHub 账号
2. **创建分支** — 从 `main` 分支创建功能分支：`git checkout -b feat/my-feature`
3. **开发** — 实现变更，确保通过类型检查和测试
4. **提交** — 使用约定的提交消息格式
5. **推送并创建 PR** — 向 `main` 分支提交 Pull Request

## 提交消息规范

rolebox 使用[约定式提交](https://www.conventionalcommits.org/)规范：

```
<type>: <简短描述>

<可选: 详细说明>
```

类型包括：

| 类型 | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 错误修复 |
| `refactor` | 代码重构（非功能变更） |
| `docs` | 文档更新 |
| `test` | 测试添加或修改 |
| `chore` | 构建、CI、依赖等杂项 |
| `perf` | 性能优化 |

示例：
```
feat: 添加自定义拓扑模板支持
fix: 修复 dispatch 超时后状态未清理的问题
docs: 更新 API 参考中的工具签名
```

::: tip 提交前检查清单
1. `bun run typecheck` 通过（零类型错误）
2. `bun run build` 通过
3. `bun test` 通过（包括现有测试）
4. 提交消息符合约定式提交格式
5. 无 `any` 类型、`@ts-ignore` 或空的 catch 块
:::

## 代码风格

- **语言**: TypeScript（严格模式），详见下方 tsconfig 配置
- **缩进**: 2 空格
- **命名**: camelCase（变量/函数）、PascalCase（类型/类）、kebab-case（文件名）
- **禁止**: `any` 类型、`@ts-ignore`、空的 catch 块、死代码、无理由的抽象

### TypeScript 配置

`tsconfig.json` 定义了严格的 TypeScript 编译环境：

| 选项 | 值 | 说明 |
|------|-----|------|
| `target` | `ES2022` | 编译目标为 ES2022 |
| `module` | `NodeNext` | ESM 模块解析（Node.js Next 模式） |
| `strict` | `true` | 全部严格检查（`strictNullChecks`、`noImplicitAny` 等） |
| `declaration` | `true` | 自动生成 `.d.ts` 声明文件 |
| `declarationMap` | `true` | 声明文件源映射 |
| `sourceMap` | `true` | 源码映射（配合 Bun 运行时调试） |
| `skipLibCheck` | `true` | 跳过 `node_modules` 类型检查 |
| `rewriteRelativeImportExtensions` | `true` | 编译时自动将 `.ts` 重写为 `.js` |

### 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 变量 / 函数 | camelCase | `getHandler`、`resolveRole` |
| 类型 / 接口 / 类 | PascalCase | `DispatchManager`、`PluginCore` |
| 文件名 / 目录名 | kebab-case | `chat-message.ts`、`event-bus.ts` |
| 常量 (顶层) | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`、`MAX_RETRIES` |
| 枚举成员 | PascalCase | `TaskStatus.Running` |

### 导入规范

- 使用 ESM `import` / `export` 语法，遵循 `NodeNext` 模块解析
- 相对导入路径包含 `.js` 扩展名：`import { foo } from "./bar.js"`（编译后为 ESM，`rewriteRelativeImportExtensions` 自动转换）
- 优先具名导入，避免 `import *` 通配导入
- 类型导入使用 `import type { ... }` 语法

### 类型注释

为所有公共 API 添加显式类型注释。内部实现可以使用类型推断。

### 错误处理

- 使用自定义错误类型而非通用 `Error`
- 不要在 catch 块中静默吞掉错误
- 工具函数应返回有意义的错误消息

## 测试规范

- 为所有新功能添加单元测试
- 测试文件放在 `tests/` 目录下，与 `src/` 结构对应
- 使用 Bun 内置测试运行器
- 测试命名：`describe('功能名')` / `it('应该...')`

### 测试文件命名

测试文件按照 `{module}.test.ts` 格式命名，与 `src/` 模块结构一一对应：

| 源码路径 | 测试文件 |
|----------|----------|
| `src/dispatch/manager.ts` | `tests/dispatch/manager.test.ts` |
| `src/graph/state.ts` | `tests/graph/state.test.ts` |
| `src/memory/store.ts` | `tests/memory/store.test.ts` |
| `src/cli/commands/list.ts` | `tests/cli/commands/list.test.ts` |

### 测试风格

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

### 测试目录布局

| 命令 | 用途 |
|------|------|
| `bun test` | 运行所有测试 |
| `bun test:tui` | 仅运行 TUI 测试 |
| `bun test -t "dispatch"` | 按测试名称匹配过滤 |

测试目录按功能域分组：

```
tests/
├── dispatch/       → src/dispatch/       # 调度管理器、状态持久化、并发
├── graph/          → src/graph/          # 协作图推进、解析、终止
├── cli/commands/   → src/cli/commands/   # CLI 子命令
├── core/           → src/core/           # 核心服务
├── hooks/          → src/hooks/          # 生命周期 Hook
├── memory/         → src/memory/         # 记忆存储
├── hashline/       → src/hashline/       # 编辑引擎
├── web/            → src/web/            # 网络工具
└── integration/    — 跨模块集成测试
```

### 测试夹具

- 轻量测试直接在测试函数中内联创建临时目录和 mock
- 跨测试共享的夹具放在 `tests/` 对应子目录中（如 `tests/dispatch/helpers.ts`）
- 避免大型 JSON fixture 文件；优先使用内联对象和工厂函数

## CHANGELOG 格式

每次发布前更新 `CHANGELOG.md`。CHANGELOG 采用 **按版本分组、按类型分类** 的结构，版本号遵循 `semver`。

### 结构模板

```markdown
## 0.x.0

### Features

- **模块名** — 功能描述，说明新能力及使用场景

### Bug Fixes

- **模块名** — 修复描述，说明修复的问题及影响范围

### Refactors

- **模块名** — 重构说明，说明变更动机（性能、可维护性、解耦等）

### Tests

- **模块名** — 测试说明，描述新增的测试覆盖范围

### Documentation

- **模块名** — 文档更新说明

### Breaking Changes

- **模块名** — 破坏性变更说明及迁移指南
```

### 模板规则

1. **版本标题**：`## 0.x.0` 三级标题，隔一个空行后接分类
2. **分类标题**：`### Features` / `### Bug Fixes` / `### Refactors` / `### Tests` / `### Documentation` / `### Breaking Changes`
3. **条目格式**：`- **模块名** — 自然语言描述，无需编号`
4. **描述风格**：自然语言，建议用一句话说明变更内容，必要时补充动机或影响范围
5. **排序**：按 Features → Bug Fixes → Refactors → Tests → Documentation → Breaking Changes 顺序排列

### 实际示例（来自 CHANGELOG.md）

```markdown
### Features

- **TUI mouse interactions** — Click-to-select sessions, task rows, and filter options in the monitor.
- **Dispatch checkpoint and progress** — New checkpoint persistence (`dispatch_checkpoint`) and progress reporting (`dispatch_progress`) tools.

### Bug Fixes

- **SSRF guard improvements** — Block link-local (`169.254.x.x`) addresses in `web_fetch` in addition to existing private/localhost blocks.
- **Memory validation** — Validate `category` and `relevance` fields in `memory_write` and `memory_update` with Zod enum at runtime.

### Refactors

- **Hashline engine** — Per-file content-hash versioning, hashWidth auto-escalation based on line count.

### Breaking Changes

- **Loop rewrite** — Every round (including the first) now runs in a child worker session dispatched through the dispatch system.
```

### 关键原则

- **模块名粗体**：条目以 `**模块名**` 开头，帮助读者快速定位变更范围
- **描述以动词开头**：如 "Add", "Fix", "Remove", "Migrate", "Replace"
- **一行一条**：每个变更独立成行，不合并为段落
- **避免内部引用**：描述面向库的消费者，而非内部开发者（不引用类名或源码路径）

## 代码组织

rolebox 的源码按功能域组织在 `src/` 子目录中：

| 目录 | 对应 `tests/` | 用途 |
|------|---------------|------|
| `src/dispatch/` | `tests/dispatch/` | 任务调度引擎：管理器、状态持久化、并发控制、预算跟踪、检查点、进度报告 |
| `src/graph/` | `tests/graph/` | 协作图执行引擎：图推进、解析器、终止条件、状态管理 |
| `src/cli/` | `tests/cli/` | CLI 接口：citty 命令定义、配置管理、路径解析 |
| `src/core/` | `tests/core/` | 核心基础设施：服务注册、事件总线、状态管理、热重载 |
| `src/hooks/` | `tests/hooks/` | 云台生命周期 Hook：chat-message、system-transform、tool-before/after |
| `src/function/` | `tests/…` | 函数状态机：运行时状态、条件评估、观察者 |
| `src/resolver/` | `tests/…` | 资源解析器：技能、引用、环境变量 |
| `src/loader/` | `tests/…` | 角色加载器：YAML 解析、递归角色加载 |
| `src/memory/` | `tests/memory/` | 记忆系统：SQLite 存储、搜索、注入 |
| `src/session/` | `tests/session/` | 会话管理：浏览、检查工具 |
| `src/signal/` | `tests/signal/` | 信号系统：出带外信号周期 |
| `src/hashline/` | `tests/hashline/` | 哈希锚点编辑引擎 |
| `src/web/` | `tests/web/` | 网络工具：页面抓取、SSRF 防护 |
| `src/tui/` | `tests/tui/` | TUI 仪表盘：Solid.js + OpenTU |
| `src/extensions/` | `tests/extensions/` | 扩展注册表：条件、拓扑、通知通道 |
| `src/recovery/` | `tests/recovery/` | 错误恢复：策略链、启动检查 |

新增功能应先定位所属域目录，再添加对应的测试文件。

## PR 清单

提交 Pull Request 前逐项检查以下内容：

- [ ] **提交消息**符合[约定式提交]规范（`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:` / `perf:`）
- [ ] **类型检查通过**：`bun run typecheck`（`tsc --noEmit`）无错误
- [ ] **所有测试通过**：`bun test` 全部绿色
- [ ] **新增测试覆盖**：新功能或修复包含对应的单元或集成测试
- [ ] **无新增 lint 问题**：未引入 `any` 类型、`@ts-ignore` 或空的 catch 块
- [ ] **代码风格一致**：遵循 camelCase / PascalCase / kebab-case 命名规范
- [ ] **错误路径已处理**：异常场景有明确的错误返回，不会被静默吞掉
- [ ] **公共 API 已记录**：新增工具或接口有对应的 JSDoc 注释
- [ ] **CHANGELOG 已更新**：如果变更影响用户可见行为，在 `CHANGELOG.md` 中对应版本下添加条目
- [ ] **测试脚手架干净**：未遗留临时文件、测试日志或 mock 残留在文件系统中

::: tip
每次提交前至少运行 `bun run typecheck && bun test` — 这组命令耗时通常在 30 秒以内，是发现返工最便宜的环节。
:::

## PR 模板

提交 PR 时建议包含以下信息：

```markdown
## 变更类型

- [ ] feat: 新功能
- [ ] fix: 错误修复
- [ ] refactor: 代码重构
- [ ] docs: 文档更新
- [ ] test: 测试变更
- [ ] chore: 构建/CI/依赖

## 描述

<简要描述变更内容和动机>

## 测试

- [ ] 新增单元测试覆盖
- [ ] 所有现有测试通过
- [ ] bun run typecheck 通过

## 关联 Issue

Fixes #<issue-number>
```

## PR 审查标准

PR 将被审查以下方面：

1. **正确性**: 代码是否按预期工作？
2. **测试覆盖**: 是否包含合适的测试？
3. **类型安全**: 是否避免了 `any` 和类型断言？
4. **错误处理**: 错误路径是否被妥善处理？
5. **文档**: 公共 API 是否已记录？

::: tip
提交前始终运行 `bun run typecheck`（执行 `tsc --noEmit`），确保没有类型错误。类型检查比测试运行更快，可以在开发循环中频繁执行。
:::

## 发布流程

1. 更新 `package.json` 中的版本号
2. 更新 `CHANGELOG.md`，按 Features / Bug Fixes / Refactors / Tests 分类归档
3. 执行 `bun run build` 确认构建通过
4. 执行 `bun test` 确认所有测试通过
5. 发布 npm 包：`npm publish`

## 下一步

- [开发环境搭建](/05-Contributing/development-setup) — 构建、调试和本地链接指南
- [架构概览](/05-Contributing/architecture-overview) — 模块职责和数据流
- [CLI 命令参考](/03-Reference/cli) — 命令行工具参考
