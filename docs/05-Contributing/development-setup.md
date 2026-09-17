---
title: 开发环境搭建
description: 克隆 rolebox、安装依赖、构建产物、运行测试切片、调试标志与在 harness 中加载本地构建的完整步骤
---

# 开发环境搭建（Development Setup）

本页把「在本地改 rolebox 源码」需要的步骤一次给全：前提条件、克隆与安装、构建、测试切片、调试开关与本地加载。提交规范、测试政策与发布流程见[贡献指南](/05-Contributing/contributing)；模块职责与数据流见[架构概览](/01-Overview/architecture-overview)。

> 相关：[贡献指南](/05-Contributing/contributing)｜[架构概览](/01-Overview/architecture-overview)｜[目录结构](/01-Overview/directory-structure)｜[平台与 Harness](/01-Overview/platform-harnesses)

## 最小示例：先把仓库跑起来

```bash
git clone https://github.com/EricMoin/rolebox.git
cd rolebox
bun install
bun run typecheck
```

```text
应看到：
bun install 结束时给出安装/检查的包数汇总；
bun run typecheck 打印 `$ tsc --noEmit` 后无其他输出并正常退出（退出码 0）。
（示例输出，随环境与依赖缓存略有差异）
```

到这里环境已经可用；下面的小节按需展开每一步。

## 前提条件

先确认三件工具都在：

```bash
bun --version
node --version
```

```text
应看到：
1.3.14        ← bun --version（示例输出，随环境略有差异）
v20.x         ← node --version；发布流水线用 Node 20，本地可以用更高版本
```

| 依赖 | 作用 | 版本依据 | 验证命令 |
|---|---|---|---|
| **Bun** | 运行时、包管理器、测试运行器与 bundler | CI 使用 `bun-version: latest` | `bun --version` |
| **TypeScript** | 类型检查与声明文件产出 | devDependencies 里的 `"typescript": "^5.7.0"` | `bunx tsc --version` |
| **Node.js** | `postinstall` 脚本与发布流水线 | 发布流水线固定 `node-version: 20`；`postinstall` 以 `node -e` 调用 | `node --version` |

::: tip 还没装 Bun？
`curl -fsSL https://bun.sh/install | bash` 即可；rolebox 以 Bun 作为运行时和包管理器，`bun install` 会安装 `dependencies`、`optionalDependencies`，以及未被标记为 optional 的 `peerDependencies`。
:::

## 克隆与安装

```bash
git clone https://github.com/EricMoin/rolebox.git
cd rolebox
bun install
```

```text
应看到：
bun install v1.3.14 (…)
 + @clack/prompts@…
 …（逐条依赖安装输出，缓存命中时显示 checked/resolved 统计）
 N packages installed [X.XXs]
（示例输出，随环境与依赖缓存略有差异）
```

依赖分成三组：

| 分组 | 内容 | 说明 |
|---|---|---|
| `dependencies` | `citty`、`js-yaml`、`fast-glob`、`tslog`、`zod`、`cheerio`、`turndown`、`turndown-plugin-gfm`、`@clack/prompts`、`@fontsource/space-grotesk` | 总是安装：CLI 框架、YAML 解析、角色发现、日志、schema 校验、网页抓取与 Markdown 转换 |
| `optionalDependencies` | `node-pty` | 终端能力的原生依赖 |
| `peerDependencies` | `@opencode-ai/plugin`、`@deepseek-ai/cordis`、`@earendil-works/pi-coding-agent`、`@opentui/core`、`@opentui/solid`、`solid-js`、`playwright`、`crawlee`、`@mozilla/readability`、`linkedom` | 三套 harness 的宿主包，以及 TUI 与网页抓取的可选后端；除 `@opencode-ai/plugin` 外都在 `peerDependenciesMeta` 中标记为 optional |

CI 使用 `bun install --frozen-lockfile`：它不改写 `bun.lock`，锁文件与 `package.json` 不一致时直接失败。

## 构建

日常使用两条命令就够：`bun run typecheck` 给最快的类型反馈，`bun run build` 产出完整发行物。

```bash
bun run typecheck      # 只做类型检查，不产出文件
bun run build          # tsc + TUI bundle + dsh web client bundle
```

```text
应看到：
$ tsc --noEmit
$ tsc && bun run build:tui && bun run build:dsh-web-client
$ bun run scripts/build-tui.ts
$ NODE_ENV=production bun run scripts/build-dsh-web-client.ts
（两条命令都成功退出；typecheck 阶段无输出才是通过）
（示例输出，随环境略有差异）
```

| 命令 | 实际执行 | 何时用 |
|---|---|---|
| `bun run build` | `tsc && bun run build:tui && bun run build:dsh-web-client` | 需要完整产物时（发布、联调 harness） |
| `bun run build:tui` | `bun run scripts/build-tui.ts` | 只改 TUI，反馈更快 |
| `bun run build:dsh-web-client` | `NODE_ENV=production bun run scripts/build-dsh-web-client.ts` | 只改 dsh web UI |
| `bun run typecheck` | `tsc --noEmit` | 开发循环中的默认门禁 |

### TUI 构建细节

`bun run build:tui` 由 `scripts/build-tui.ts` 驱动，分三步：

1. **Bun 打包** —— 以 `src/tui/index.tsx` 为入口，用 `@opentui/solid/bun-plugin` 的 `createSolidTransformPlugin` 转换 JSX，输出 `dist/tui.js`（`target: "bun"`、`format: "esm"`）；`@opencode-ai/*`、`@opentui/*`、`solid-js` 保持 external。
2. **类型声明** —— 运行 `bunx tsc -p tsconfig.tui.json --declaration --emitDeclarationOnly --outDir dist`。`tsc` 退出码 2 是**已知假阳性**（Solid 插件的运行时类型不匹配，不影响运行时），脚本显式接受该退出码；其它非零退出码直接失败。
3. **`d.ts` 重定位** —— 把 `dist/tui/index.d.ts` 写成 `dist/tui.d.ts`（同时修正 `sourceMappingURL` 并复制 `.d.ts.map`），匹配 `package.json` 中 `exports["./tui"].types` 指向的路径。

`tsconfig.tui.json` 继承根 `tsconfig.json`，但改用 `module: "esnext"`、`moduleResolution: "bundler"`、`jsxImportSource: "@opentui/solid"`，并把 `include` 收窄到 `src/tui/**` 与 `src/utils/**`。

### dsh web client 构建细节

`bun run build:dsh-web-client` 由 `scripts/build-dsh-web-client.ts` 驱动：以 `src/platform/adapters/dsh/web-ui/client.ts` 为浏览器入口，输出 `dist/dsh-web-client.js`（`target: "browser"`、`format: "cjs"`），`react`、`react/jsx-runtime` 与 `@deepseek-ai/*` 保持 external。脚本必须由 `NODE_ENV=production` 启动：Bun 在进程启动时依据 `NODE_ENV` 选择 JSX runtime，而 dsh web app 的 loader 表只注册了 `react/jsx-runtime`。

### 产物清单

| 产物 | 来源 | 用途 |
|---|---|---|
| `dist/index.js` / `dist/index.d.ts` | `tsc` | opencode 插件主体 |
| `dist/pi-extension.js` | `tsc` | pi 扩展入口 |
| `dist/dsh-plugin.js` | `tsc` | dsh cordis 插件入口 |
| `dist/tui.js` / `dist/tui.d.ts` | `scripts/build-tui.ts` | TUI 仪表盘 |
| `dist/dsh-web-client.js` | `scripts/build-dsh-web-client.ts` | dsh web UI 的角色坞与监视面板 |
| `dist/cli/main.js` | `tsc` | `rolebox` 命令行入口 |

## 测试

::: warning 不要本地运行全量测试套件
`AGENTS.md` 明确规定：**不要在本地运行完整测试套件**（`bun test`）。它很慢，会用无关输出淹没上下文，那是 CI 的职责。本地只运行与改动模块对应的切片。测试政策与编写约定的完整清单在[贡献指南](/05-Contributing/contributing)。
:::

测试脚本共三条：`bun run test`（`test:core` + `test:tui`）、`bun run test:core`（`bun test --isolate --path-ignore-patterns=tests/tui`）、`bun run test:tui`（`bun test tests/tui/`）。

**rolebox 没有 lint 脚本。** `package.json` 的 `scripts` 只有构建、类型检查、测试与 `postinstall`，仓库根也没有 ESLint / Biome / Prettier 配置——静态质量由 `bun run typecheck` 与人工审查把关。

### 运行模块切片

```bash
# 模块切片（把 <module> 换成一个 tests/ 下的目录）
bun test --isolate tests/<module>/

# 单文件（最快的反馈回路）
bun test --isolate tests/<module>/<file>.test.ts

# TUI 测试 —— 不要加 --isolate
bun test tests/tui/

# 只做类型检查，不跑测试
bun run typecheck
```

```text
应看到：
bun test v1.3.14 (…)
tests/utils/paths.test.ts:
✓ …（逐条用例）
 N pass, 0 fail, M expect() calls
Ran N tests across K files. [X.XXs]
（示例输出，随环境略有差异）
```

TUI 切片之所以**必须省略 `--isolate`**：`@opentui/core` 在导入期执行顶层 `await`，在 `--isolate` 下会失败。core 切片则必须启用它——每个测试文件获得独立模块注册表后，跨文件的 `mock.module` 污染在结构上不可能发生。

### 测试目录布局

新测试镜像 `src/` 的模块路径：

| 源码路径 | 测试路径 |
|---|---|
| `src/asset/**` | `tests/asset/` |
| `src/cli/**` | `tests/cli/` |
| `src/core/**` | `tests/core/` |
| `src/dispatch/**` | `tests/dispatch/` |
| `src/extensions/**` | `tests/extensions/` |
| `src/graph/**` | `tests/graph/` |
| `src/hashline/**` | `tests/hashline/` |
| `src/hooks/**` | `tests/hooks/` |
| `src/loop/**` | `tests/loop/` |
| `src/lsp/**` | `tests/lsp/` |
| `src/memory/**` | `tests/memory/` |
| `src/notifications/**` | `tests/notifications/` |
| `src/platform/**` | `tests/platform/` |
| `src/prompt/**` | `tests/prompt/` |
| `src/recovery/**` | `tests/recovery/` |
| `src/session/**` | `tests/session/` |
| `src/signal/**` | `tests/signal/` |
| `src/tui/**` | `tests/tui/`（不加 `--isolate`） |
| `src/utils/**` | `tests/utils/` |
| `src/web/**` | `tests/web/` |

没有专属测试目录的模块，测试放在 `tests/` 根下：

| 源码路径 | 测试位置 |
|---|---|
| `src/function/**` | `tests/function-*.test.ts`、`tests/handlers.test.ts`、`tests/conditions.test.ts`、`tests/observe.test.ts`、`tests/continuation.test.ts` |
| `src/copilot/**` | `tests/copilot-*.test.ts` |
| `src/loader/**` | `tests/role-loader*.test.ts`、`tests/open-roles.test.ts` |
| `src/resolver/**` | `tests/*-resolver.test.ts`、`tests/resolver-recursive.test.ts` |
| `src/sync/**`、`src/terminal/**`、`src/logger.ts` | `tests/agent-registry.test.ts`、`tests/interactive-terminal.test.ts`、`tests/logger.test.ts` |
| `src/index.ts` / `src/pi-extension.ts` / `src/dsh-plugin.ts` | `tests/index.test.ts`、`tests/pi-*.test.ts`、`tests/dsh-*.test.ts`、`tests/e2e.test.ts` |

辅助目录（不是模块）：`tests/helpers/`、`tests/integration/`、`tests/monitor/`。

### 测试风格

一个真实的用例：

```typescript
it("cancelTask() returns false for unknown task", async () => {
  const client = createMockClient();
  const manager = new DispatchManager(client);

  const result = await manager.cancelTask("nonexistent-task");
  expect(result).toBe(false);
});
```

`createMockClient()` 来自 `tests/dispatch/helpers.ts`，`DispatchManager` 来自 `src/dispatch/core/manager.ts`。需要更长的超时时，把选项对象作为 `it()` 的第三个参数传给 Bun：

```typescript
it("handles a slow operation", async () => {
  // ...
}, { timeout: 15000 });
```

## 调试标志

把开关放在命令前面即可（下表的变量都这样用）：

```bash
ROLEBOX_LOG_LEVEL=debug bun run src/cli/main.ts status
```

```text
应看到：
Rolebox  v1.9.0

Configuration
   Config:       ~/.config/rolebox/config.yaml
   Registries:   oh-my-role (default)

Installed Roles
   ✓ <role>  <version>  (<registry>)  →  synced
（示例输出，随本机已装角色与配置不同）
```

| 环境变量 | 作用 | 默认值 | 定义位置 |
|---|---|---|---|
| `ROLEBOX_LOG_LEVEL` | 日志级别：`silly` / `trace` / `debug` / `info` / `warn` / `error` / `fatal`；大小写不敏感，非法值回退 `info` 并写 stderr | `info` | `src/logger.ts` |
| `ROLEBOX_LOG_FILE` | 显式日志文件路径，优先级最高 | 见下方解析链 | `src/logger.ts` |
| `ROLEBOX_LOG_MAX_BYTES` | 日志轮转阈值；非法值回退默认值，最多保留 3 个轮转文件 | 10 MB | `src/logger.ts` |
| `ROLEBOX_METRICS` | 设为真值才启用指标收集与持久化；未设置时所有指标方法为 NO-OP | 关闭 | `src/dispatch/persistence/metrics.ts` |
| `ROLEBOX_METRICS_EXPORT` | 指标快照导出路径的后备（参数优先） | 无 | `src/dispatch/tools.ts` |
| `ROLEBOX_CONFIG_DIR` | 覆盖 rolebox 配置目录 | 见 `getConfigDir()` | `src/cli/paths.ts` |

日志文件路径按四级链解析：

```text
1. ROLEBOX_LOG_FILE 环境变量
2. <项目目录>/.rolebox/logs/rolebox.log     （插件启动时经 configureLogDirectory 设置）
3. <配置目录>/logs/rolebox.log              （CLI / 初始化前的回退；配置目录默认 ~/.config/rolebox）
4. {os.tmpdir()}/rolebox.log
```

## 调试技巧

| 现象 | 排查方法 |
|---|---|
| **TUI 构建时 `tsc` 返回退出码 2** | 已知假阳性（Solid 插件的运行时类型不匹配），脚本接受该退出码并继续。若退出码不是 0 或 2，先检查 `tsconfig.tui.json` 的 `include` 范围。 |
| **core 测试在多个文件之间互相影响** | 确认命令带 `--isolate`；共享模块注册表会让一个文件的 `mock.module` 遮蔽后续文件的真实模块。 |
| **TUI 测试在 `--isolate` 下失败** | `@opentui/core` 的顶层 `await` 在 `--isolate` 下必然失败，TUI 腿必须不加该选项。 |
| **CI 报工作树变脏** | CI 在最后一步断言工作树干净；测试不得写出 `cache/` 之类的残留目录。 |
| **找不到日志文件** | 按上面的四级解析链逐项排查；`ROLEBOX_LOG_FILE` 可强制重定向。 |

## 本地运行

`rolebox` CLI 的版本号直接读自仓库根的 `package.json`，因此可以先用 Bun 直接运行源码，不必先构建：

```bash
# 以源码运行 CLI（版本号 = 该 checkout 的 package.json version）
bun run src/cli/main.ts --version
bun run src/cli/main.ts status

# 需要完整产物时
bun run build
```

```text
应看到：
1.9.0
Rolebox  v1.9.0
（status 接着打印 Configuration 与 Installed Roles 两段；示例输出，随环境不同）
```

::: warning 不存在单独的 “dev” 版本标识
`rolebox --version` 输出的是所加载 `package.json` 的 `version` 字段。从 checkout 运行时它就是该 checkout 的版本号，而不是某个特殊的 dev 版本。
:::

### 在 harness 中加载本地构建

| Harness | 从 checkout 加载的方式 |
|---|---|
| **pi** | 在 `~/.pi/agent/settings.json` 的 `extensions` 数组里加入指向 checkout 中 `dist/pi-extension.js` 的绝对路径 |
| **opencode** | 官方安装路径是 npm 包：`cd ~/.config/opencode && npm install rolebox`，并在 `opencode.jsonc` 中声明 `"plugin": ["rolebox"]`；如需从 checkout 加载，用符号链接或本地包安装把该路径接到配置目录 |
| **dsh** | `dsh plugin --profile <name> add rolebox`；非 bundle 安装需要在 profile 的 `cordis.patch.yml` 中加一行 `- insert:` 指向 `./node_modules/rolebox/dist/dsh-plugin.js`（可配置示例见 rolebox 仓库的 `examples/dsh/cordis.patch.yml`） |

三套 harness 的配置目录分别是 `~/.config/opencode`、`~/.pi/agent`、`~/.dsh`，可分别用 `XDG_CONFIG_HOME`、`PI_CODING_AGENT_DIR`、`DSH_HOME` 覆盖。

### VS Code 调试

在 `.vscode/launch.json` 中加入以下配置，即可用 Bun 在调试器中直接启动 CLI（入口与 `package.json` 的 `bin` 一致）：

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

### 推荐 IDE 插件

| 插件 | 用途 |
|---|---|
| [TypeScript](https://code.visualstudio.com/docs/languages/typescript) | 类型检查与跳转（`tsc --noEmit` 的编辑器内版本） |
| [YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) | `role.yaml` 的补全与校验 |
| [Edge](https://marketplace.visualstudio.com/items?itemName=EditorSyntax.Edge) | 配置文件的语法高亮 |

## 提交前检查

```bash
bun run typecheck                          # 必须零错误
bun test --isolate tests/<改动的模块>/      # 只跑模块切片
```

```text
应看到：
$ tsc --noEmit
（无输出即通过；有错时列出 file(line,col): error TSxxxx）
$ bun test --isolate tests/utils/
 N pass, 0 fail
（示例输出，随环境略有差异）
```

CI 在三个平台（ubuntu / macos / windows）上依次执行：`bun install --frozen-lockfile` → `bun run typecheck` → `bunx tsc` → `bun run build:tui` → `bun run build:dsh-web-client` → core 测试（isolated）→ TUI 测试（non-isolated）→ 顺序无关性回归守卫（正反两遍）→ 随机顺序 fuzz（仅 ubuntu）→ 工作树干净断言。提交前的两项检查覆盖其中最容易失败的两步，完整清单见 [PR 清单](/05-Contributing/contributing)。

## 下一步

- [贡献指南](/05-Contributing/contributing) — 提交消息、代码风格、测试政策与发布流程
- [插件接口](/03-Reference/plugin-interface) — 服务与平台适配器的接口契约
- [架构概览](/01-Overview/architecture-overview) — 模块地图与运行时数据流
