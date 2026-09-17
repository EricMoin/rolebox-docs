---
title: 贡献指南
description: rolebox 的贡献流程、提交消息与代码风格、测试政策、CHANGELOG 约定、PR 清单、审查标准与发布流程
---

# 贡献指南（Contributing）

本页回答「给 rolebox 提一个改动，要遵守什么」：从分支、提交消息、代码风格、测试政策，到 PR 清单与发布流程。仓库根的 `CONTRIBUTING.md` 给出对外的最小流程，`AGENTS.md` 给出面向编码代理与贡献者的详细约定——本页把两者的规则整理成可执行清单；构建与测试的**具体命令**在[开发环境搭建](/05-Contributing/development-setup)。

> 相关：[开发环境搭建](/05-Contributing/development-setup)｜[架构概览](/01-Overview/architecture-overview)｜[CLI 参考](/03-Reference/cli)

## 贡献流程

1. **Fork 并从 `main` 建分支** —— 不要直接在 `main` 上工作。
2. **保持改动聚焦** —— 一个 PR 只做一件事，不做无关的重命名、重排版或清理。
3. **按需补测试** —— 新功能或修复带上对应的单元 / 集成测试。
4. **跑模块切片** —— 只跑改动模块对应的测试目录，不要本地跑全量（原因见下方[测试规范](#测试规范)）。
5. **向 `main` 提 Pull Request** —— 说明它做了什么、为什么这么做。

仓库根还有两份必读的贡献者文档：

| 文件 | 内容 |
|---|---|
| `CONTRIBUTING.md` | 对外的最小流程：issue、PR、角色创建与 YAML 风格 |
| `AGENTS.md` | 详细约定：关键脚本表、隐私与泄漏卫生、测试政策、模块 → 测试路径映射、测试编写约定 |

## 提交消息规范

提交消息采用 `<type>(<scope>): <描述>` 形式。仓库历史的真实样例：

```text
fix(ci): point order-independence guard at existing test files
feat(dsh-web-ui): redesign role dock and monitor
docs(readme): refocus and move detail to docs
chore(release): v1.9.0
```

| 类型 | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 错误修复 |
| `docs` | 文档更新 |
| `chore` | 构建、CI、依赖、发布等杂项 |

`scope` 取改动所在的模块或关注点（`ci`、`dsh`、`dsh-web-ui`、`readme`、`agents` 等都是实际出现过的取值）。仓库没有 commitlint 之类的强制配置，格式靠约定与审查维持。

## 代码风格

- **语言**：TypeScript（严格模式），编译配置见下表
- **缩进**：2 空格
- **命名**：camelCase（变量 / 函数）、PascalCase（类型 / 类）、kebab-case（文件名）
- **避免**：新增 `any` / `as any`、`@ts-ignore`、没有理由的抽象

### TypeScript 配置

`tsconfig.json` 为整个仓库定下严格的编译环境（TUI 由 `tsconfig.tui.json` 单独处理）：

| 选项 | 值 | 说明 |
|---|---|---|
| `target` | `ES2022` | 编译目标 |
| `module` / `moduleResolution` | `NodeNext` | ESM（ES 模块 / ECMAScript Modules）解析 |
| `rewriteRelativeImportExtensions` | `true` | 编译时把相对导入里的 `.ts` 改写成 `.js` |
| `outDir` | `dist` | 编译输出目录 |
| `declaration` / `declarationMap` | `true` | 生成 `.d.ts` 与声明源映射 |
| `sourceMap` | `true` | 源码映射（配合 Bun 运行时调试） |
| `strict` | `true` | 全部严格检查（`strictNullChecks`、`noImplicitAny` 等） |
| `esModuleInterop` | `true` | CommonJS 互操作 |
| `skipLibCheck` | `true` | 跳过 `node_modules` 的类型检查 |
| `forceConsistentCasingInFileNames` | `true` | 文件名大小写必须一致 |
| `types` | `["bun-types"]` | 使用 Bun 的类型定义 |
| `jsx` | `preserve` | 交由 TUI 构建脚本处理 JSX |
| `include` / `exclude` | `["src"]` / `["src/tui"]` | 根编译排除 TUI，TUI 单独编译 |

### 命名规范

| 类别 | 规范 | 现有例子 |
|---|---|---|
| 变量 / 函数 | camelCase | `createPluginHooks`、`resolveRoleboxDirectories` |
| 类型 / 接口 / 类 | PascalCase | `PluginCore`、`ServiceSupervisor` |
| 文件名 / 目录名 | kebab-case | `chat-message.ts`、`service-supervisor.ts`、`tool-registry.ts` |
| 常量 | UPPER_SNAKE_CASE | `SUPERVISOR_DEFAULTS`、`DEFAULT_MAX_FILE_BYTES` |
| 错误类 | PascalCase + `Error` 后缀 | `DescriptiveCycleError` |

### 导入规范

- 使用 ESM `import` / `export`，遵循 `NodeNext` 解析。
- 相对导入写 **`.ts` 扩展名**（如 `from "./platform/factory.ts"`）；`rewriteRelativeImportExtensions` 在编译时把它们改写成 `.js`。仓库里仍有少量历史文件直接写 `.js`，新代码统一写 `.ts`。
- 优先具名导入，避免 `import *` 通配导入。
- 类型导入使用 `import type { ... }`。

### 类型注释

公共 API（应用程序接口，Application Programming Interface）需要显式类型注释，内部实现可以依赖类型推断。工具定义用 `zod` schema 同时承担运行时校验与类型推导——见[插件接口](/03-Reference/plugin-interface)里的 `defineTool()`，不需要再手写一份参数类型。

### 错误处理

- 使用具名错误类型而不是裸 `new Error(...)`，便于调用方区分失败原因——服务依赖成环时抛出的 `DescriptiveCycleError` 就带着 `cycleMembers` 字段。
- 不要在 `catch` 块里静默吞掉错误：可选服务初始化失败时，`PluginCore` 会记日志并把该服务标记为**永久降级**，而不是假装成功。
- 工具函数应返回有意义的错误消息。

## 测试规范

::: warning 不要本地运行全量测试套件
`AGENTS.md` 明确禁止在本地运行完整套件（`bun test`）：它很慢，会用无关输出淹没上下文，那是 CI 的职责。本地只运行与改动模块对应的**切片**。
:::

::: warning 两份文档的测试指令不一致
`CONTRIBUTING.md` 的流程示例让贡献者运行 `bun test`（全量），而 `AGENTS.md` 禁止本地跑全量。**以 `AGENTS.md` 为准**：全量套件留给 CI 与维护者明确要求的预发布验证。
:::

| 命令 | 用途 |
|---|---|
| `bun run typecheck` | 只做类型检查，不跑测试（最快的门禁） |
| `bun test --isolate tests/<module>/` | 模块切片 |
| `bun test --isolate tests/<module>/<file>.test.ts` | 单文件（最快的反馈回路） |
| `bun test tests/tui/` | TUI 切片，**不加** `--isolate` |
| `bun run test` | 全量（`test:core` + `test:tui`），仅 CI / 预发布 |

core 与 TUI 的 `--isolate` 取舍：`@opentui/core` 在导入期执行顶层 `await`，在 `--isolate` 下会失败；core 切片则必须启用它——每个测试文件拿到独立模块注册表后，跨文件的 `mock.module` 污染在结构上不可能发生。

### 测试编写约定

- **镜像 `src/` 路径** —— `src/<模块>/<文件>.ts` 的测试放在 `tests/<模块>/<文件>.test.ts`。
- **文件命名** `<subject>.test.ts`。
- **保持工作树干净** —— CI 在最后一步断言 `git status --porcelain --untracked-files=all` 为空，测试不得留下临时文件或 `cache/` 之类的残留目录。
- **Unix-only 测试加守卫** —— 用来自 `tests/helpers/tar.ts` 的 `it.skipIf(!hasTar())`。
- **模块 mock 用 `mock.module()`** 在文件顶部设置；跨测试共享的夹具放 `tests/` 对应子目录，轻量夹具优先内联创建，而不是落成大型 JSON fixture。

测试目录与 `src/` 的完整对应表、每条命令的预期输出，见[开发环境搭建](/05-Contributing/development-setup)。

## CHANGELOG 格式

每次发布前更新 `CHANGELOG.md`。结构是**按版本分组、按类型分类**：

| 层级 | 形式 | 说明 |
|---|---|---|
| 版本标题 | `## <version>` | 例如 `## 1.9.0`；发布流水线要求它存在 |
| 分类标题 | `### <Category>` | 见下 |
| 条目 | `- **模块名** — 描述` | 模块名加粗，描述用自然语言 |

`CHANGELOG.md` 实际用过的分类：`Features`、`Bug Fixes`、`Refactors`、`Documentation`、`Tests`、`Breaking Changes`、`Performance`。一个版本通常只用到其中若干类。

关键原则：

- **模块名粗体** —— 条目以 `**模块名**` 开头，帮助读者快速定位变更范围；
- **描述以动词开头** —— 如 “Add”“Fix”“Remove”“Replace”；
- **一行一条** —— 每个变更独立成行，不合并为段落；
- **面向使用者** —— 描述库消费者能看到的行为，而不是内部实现细节。

## 代码组织

源码按功能域组织在 `src/` 下：26 个一级目录，加上 `index.ts`（opencode 入口）、`pi-extension.ts`、`dsh-plugin.ts` 三个入口与若干顶层模块文件。按分组看：

| 分组 | 目录 | 内容 |
|---|---|---|
| 核心 | `src/core/` | 插件内核 `PluginCore`、服务注册与拓扑初始化、事件总线、工具注册 |
| 编排 | `src/graph/`、`src/dispatch/`、`src/loop/`、`src/recovery/` | 图执行引擎、调度管理器、循环协调器、恢复策略 |
| 角色资产 | `src/loader/`、`src/resolver/`、`src/prompt/`、`src/function/`、`src/hooks/`、`src/extensions/`、`src/asset/` | 角色发现与解析、提示词组装、函数状态机、Hook、扩展点、资产查询 |
| 平台 | `src/platform/`、`src/cli/`、`src/tui/`、`src/sync/`、`src/terminal/` | 三套 harness 适配、命令行、终端 UI、代理同步、交互式终端 |
| 能力 | `src/memory/`、`src/session/`、`src/signal/`、`src/notifications/`、`src/hashline/`、`src/web/`、`src/lsp/`、`src/copilot/`、`src/utils/` | 记忆、会话工具、信号、通知、内容哈希编辑、网页工具、LSP、copilot、通用工具 |

新增功能先定位所属域目录，再到 `tests/` 的镜像位置补测试。逐模块的职责与运行时数据流见[架构概览](/01-Overview/architecture-overview)；具体服务之间的依赖拓扑见[服务架构](/01-Overview/service-architecture)。

## PR 清单

提交 Pull Request 前逐项检查：

- [ ] **提交消息**符合 `<type>(<scope>): <描述>` 形式（`feat` / `fix` / `docs` / `chore`）
- [ ] **类型检查通过**：`bun run typecheck`（`tsc --noEmit`）零错误
- [ ] **模块切片测试通过**：`bun test --isolate tests/<改动的模块>/`（不要本地跑全量套件）
- [ ] **新增测试覆盖**：新功能或修复包含对应的单元或集成测试
- [ ] **无新增类型逃逸**：未引入新的 `any` / `as any` / `@ts-ignore`
- [ ] **命名一致**：遵循 camelCase / PascalCase / kebab-case
- [ ] **错误路径已处理**：异常场景有明确的错误返回，不会被静默吞掉
- [ ] **公共 API 已记录**：新增工具或接口有对应的 JSDoc 注释
- [ ] **CHANGELOG 已更新**：若变更影响用户可见行为，在 `CHANGELOG.md` 对应版本下添加条目
- [ ] **工作树干净**：未遗留临时文件、测试日志或 mock 残留（CI 会断言）
- [ ] **隐私检查**：改动不包含私有基础设施标识、密钥或个人信息

::: tip 提交前至少跑一次 `bun run typecheck`
它比测试更快，适合在开发循环里频繁执行。
:::

## 隐私与泄漏卫生

任何离开会话的输出都可能公开：git 历史、提交消息、CHANGELOG、发布说明、workflow 文件、发布包内容、CI 日志。写出这类内容前先确认它不暴露：

- **私有厂商与基础设施** —— 内部主机名、服务名、账号或 provider key、模型代号，以及任何尚未公开的标识；
- **密钥与凭据** —— token、API key、密码、私钥、`.npmrc` 与环境变量值、CI secret；
- **可定位到个人的信息** —— 用户名、家目录路径、邮箱、机器专属路径。

规则：示例一律用中性占位符（`example-provider/model-name`、`/path/to/project`、`user@example.com`）；不在提交消息或发布说明里宣布「清理了某某数据」，保持措辞通用；发布前扫描真正离开的产物（例如 `npm pack` 的输出），并让扫描规则本身不进版本控制。

## PR 模板

提交 PR 时建议包含以下信息：

```markdown
## 变更类型

- [ ] feat: 新功能
- [ ] fix: 错误修复
- [ ] docs: 文档更新
- [ ] chore: 构建 / CI / 依赖

## 描述

<简要描述变更内容和动机>

## 测试

- [ ] 新增单元测试覆盖
- [ ] 受影响模块的测试切片通过
- [ ] bun run typecheck 通过

## 关联 Issue

Fixes #<issue-number>
```

## PR 审查标准

PR 会被审查以下方面：

1. **正确性**：代码是否按预期工作？
2. **测试覆盖**：是否包含合适的测试，并且只跑必要的切片？
3. **类型安全**：是否避免了新增的 `any` 与类型断言？
4. **错误处理**：错误路径是否被妥善处理、有可观测的失败信号？
5. **跨 harness 一致性**：改动是否同时适用于 opencode、pi 与 dsh，或明确说明了平台差异？
6. **文档**：公共 API 与用户可见行为是否已记录？

## 发布流程

发布由 tag 驱动，不要手动执行发布命令：

1. **更新 `package.json` 的 `version`**。
2. **写入 `CHANGELOG.md` 段** —— 必须存在 `## <version>` 标题，否则流水线在元数据校验一步就失败。
3. **打 tag 并推送**：

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z" <prepare-commit>
   git push origin vX.Y.Z
   ```

   ```text
   应看到：
   To github.com:EricMoin/rolebox.git
    * [new tag]         vX.Y.Z -> vX.Y.Z
   （示例输出，随远端配置与是否已存在同名 tag 略有差异）
   ```

4. **`publish.yml` 自动执行**：
   - 校验 tag 与 `package.json`、`CHANGELOG.md` 三者版本一致；
   - `bun run build` —— 必须是完整构建，因为 `dist/tui.js` 与 `dist/dsh-web-client.js` 是 `tsc` 不产出的 bundle；
   - `bun run test` —— 全量套件，CI 正是为它准备的运行位置；
   - `npm pack --dry-run` 断言关键文件都在包里；
   - `npm publish`；
   - 从 `CHANGELOG.md` 抽取该版本段作为 GitHub Release 说明。

`package.json` 的 `prepublishOnly` 钩子是 `tsc`，作为额外的类型门禁。

## 文档约定

站点在**独立的 rolebox-docs 仓库**维护，与源码仓库分开。改文档前先读该仓库根的 `HOUSE-STYLE.md`——它是全站写作契约（不进站点，VitePress 只发布 `docs/`）：

- **出处只有一个去处**：[/06-Appendix/source-index](/06-Appendix/source-index) 的「概念 → 模块 → 该模块负责什么」对照表。用户可见页面（教程 / 指南 / 参考 / 首页 / 术语表）不写 `src/` 路径，也不写「路径 + 行号」这类行号锚点。
- **模块路径只出现在三类页面**：内部实现、贡献、源码索引；且只在模块本身是句子主语时出现，不作为证据附件。
- **版本信息只有两种落点**：站点级一处（页脚版本说明），页面级最多一条 `> 自 vX.Y.Z 起，…`，且该版本必须真实存在于 `CHANGELOG.md`。
- **术语在首次出现处就地定义**：`中文（English，一句话解释）`，不写前置术语表。
- **结构变更要同步导航**：新增或移动页面时同步改 `docs/.vitepress/config.ts` 的 sidebar 与 nav，保证 `docs/` 下每个页面都能从侧边栏到达。

常用命令（在 rolebox-docs 仓库根执行）：

```bash
bun install
bun run docs:dev      # 本地预览
bun run docs:build    # 生产构建；部署流水线跑的就是它
```

```text
应看到：
  vitepress v1.6.x  ready in … ms
  ➜  Local:   http://localhost:5173/
docs:build 无报错退出，产物写入 docs/.vitepress/dist
（示例输出，随环境略有差异）
```

## 下一步

- [开发环境搭建](/05-Contributing/development-setup) — 前提条件、克隆、构建、测试与调试
- [插件接口](/03-Reference/plugin-interface) — 服务与平台适配器的接口契约
- [架构概览](/01-Overview/architecture-overview) — 模块地图与运行时数据流
