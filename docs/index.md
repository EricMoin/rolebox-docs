---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Rolebox"
  text: "AI Agent 编排框架"
  tagline: 声明式 YAML · 并行 dispatch · 持久记忆 — 秒级部署你的 AI 工程团队
  image:
    src: /logo.svg
    alt: Rolebox
  actions:
    - theme: brand
      text: 快速开始
      link: /01-Overview/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/EricMoin/rolebox
    - theme: alt
      text: 角色注册表
      link: https://github.com/EricMoin/oh-my-role

features:
  - icon: 🧩
    title: 角色驱动架构
    details: 通过 role.yaml 声明式定义 AI 代理的能力、权限与交互方式
  - icon: ⚡
    title: 灵活调度系统
    details: 支持同步 / 异步 dispatch、深度嵌套子任务、后台执行与预算控制
  - icon: 🔗
    title: 多代理协作
    details: 基于协作图与领域路由的代理间通信与编排
  - icon: 🛠️
    title: 技能与函数系统
    details: 可插拔技能加载、函数依赖注入与 State Machine 生命周期管理
  - icon: 🧠
    title: 持久记忆系统
    details: SQLite + FTS5 全文搜索，跨会话自动注入，workspace/role 隔离，`|memory|` 模式一键记忆
  - icon: 📬
    title: 桌面通知
    details: 原生 OS 通知，空闲检测免打扰，静音时段配置，事件过滤与突发抑制
  - icon: 🔄
    title: 资产热重载
    details: 编辑 role.yaml 或技能文件后即时生效，无需重启 — 开发与调试零等待
---

## 🚀 5 分钟构建第一个多代理团队

从零到拥有一个带 Emperor 编排器的多代理团队，只需三步：

::: tip 📦 步骤一：安装 rolebox
```bash
cd ~/.config/opencode && npm install rolebox
```

然后在 `opencode.jsonc` 中添加 `"plugin": ["rolebox"]`。
:::

::: tip 🔧 步骤二：初始化第一个角色
```bash
rolebox init my-agent -y
```

这会创建一个完整的角色目录，包含 `role.yaml` 配置和技能入口。
:::

::: tip 🚀 步骤三：安装 Emperor 编排器
```bash
rolebox install emperor
```

安装完成后重启 opencode，你就拥有了一个计划→调度→验证→修订闭环的 AI 工程主管团队。
:::

了解更多 → [快速开始指南](/01-Overview/quick-start)

## rolebox 能为你做什么

每次 AI 编程会话都从头开始。你的助手不记得昨天的架构决策、上周的 bug 修复、三个会话前你定下的编码规范。你需要重复解释，它重复犯错，进展变慢。

**rolebox 给你的 AI 装上持久记忆** — 跨会话、跨项目，代理们记得一切。

但记忆只是起点。rolebox 把一个通用的聊天助手变成一支精密的工程团队：用 YAML 定义，秒级部署，永不遗忘。

### 🧠 持久记忆系统

- **SQLite + FTS5** — 对每一条存储的决策、规范和教训执行全文搜索
- **Workspace vs Role 隔离** — 项目知识全局共享，角色笔记私有保留
- **`|memory|` 模式** — 回顾过往会话，提取持久知识，去重，持久化
- **自动注入** — 会话启动时相关记忆自动浮现为 `<available_memory>`
- **CLI** — `rolebox memory list`、`search`、`export`、`stats`

### ✂️ Hashline 编辑 — 永不漂移的编辑

基于行号的编辑在文件变更时断裂。rolebox 使用**内容哈希锚定编辑**：

- 每行标记内容哈希 — `LINE#HASH`
- 编辑按哈希匹配，而非行号。文件在读和写之间发生变化时，编辑定位的是*内容*，而非行号
- **多编辑批处理**支持快照语义 — 所有编辑引用文件原始状态，自底向上应用，行号始终正确
- **SHA-256 版本追踪** — 在写入前检测外部修改

### 🔬 LSP 集成（30+ 工具）

你的 IDE 拥有的每个语言服务器工具，现在你的 AI 助手也能用。导航（go-to-definition、find-references）、诊断、代码操作、补全、格式化、悬停信息、符号搜索、调用层次结构 — 一个系统对接所有 LSP 服务器，自动检测。

### 🚀 调度系统

并行运行多个代理，追踪一切。后台执行配合真实并发控制（模型池信号量）、预算追踪、带完整上下文的任务重试、任务依赖图可视化、时间分桶活动视图、实时指标与观测。

::: tip rolebox 的核心设计理念
- **YAML 优先** — 无需编码，用声明式 YAML 定义角色、技能、子代理和协作关系
- **容错设计** — 即使 YAML 配置有误、技能缺失或函数引用断裂，rolebox 也会优雅降级而非崩溃
- **渐进式采纳** — 可从单个记忆插件起步，逐步扩展到完整的多代理编排团队
:::

---

## rolebox 为 opencode 带来的能力

| 能力 | 原生 opencode | + rolebox |
|---|---|---|
| **持久记忆** | ❌ 会话从零开始 | ✅ SQLite + FTS5，自动注入过往决策 |
| **多代理团队** | ❌ 单一代理 | ✅ YAML 定义的专家团队，并行调度 |
| **LSP 集成** | ❌ 无语言服务器访问 | ✅ 30+ 工具（跳转定义、引用、重命名、诊断…） |
| **Hashline 编辑** | ❌ 基于行号 | ✅ 内容哈希锚定 — 编辑永不漂移 |
| **桌面通知** | ❌ 无 | ✅ 原生 OS 通知、静音时段、空闲检测、节流 |
| **会话分析** | ❌ 基础会话列表 | ✅ 10 种工具：搜索、导出、分叉、对比、检查 |
| **后台调度** | ❌ 串行 | ✅ 真实并发，预算追踪 |
| **任务依赖图** | ❌ 扁平 | ✅ 可视化父子调度树 |
| **函数状态机** | ❌ 静态提示词 | ✅ 带证据与状态转换的生命周期管理 |
| **上下文组装** | ❌ 手动 | ✅ 跨域搜索（记忆 + 资产 + 任务 + 会话） |
| **热重载资产** | ❌ 需重启 | ✅ 编辑 YAML，即时重载 |
| **资产验证** | ❌ 无 | ✅ 依赖与完整性检查 |
| **可共享角色注册表** | ❌ 无 | ✅ npm 风格 `rolebox install <name>` |
| **编排器（Emperor）** | ❌ 无 | ✅ 计划 → 调度 → 验证 → 修订闭环 |

---

::: tip 📊 项目统计

rolebox 目前拥有：

| 指标 | 数值 | 说明 |
|------|------|------|
| **文档页面** | 43 页 | 涵盖架构、指南、参考与高级主题 |
| **内置工具** | 80+ | LSP、会话、记忆、调度、资产、网络等 10 大领域 |
| **CLI 命令** | 14 个 | init、install、list、memory、checkpoint 等完整工具链 |
| **恢复策略** | 7 个 | retry、compact、fallback-model、abort、remind-and-retry、truncate、summarize |
| **文档覆盖** | 100% | 每个 CLI 命令和配置项均有对应文档页面 |

:::

## 📦 精选角色库

rolebox 社区提供了丰富的预制角色，即装即用：

| 角色 | 功能简介 | 安装命令 |
|------|---------|---------|
| **emperor** | 顶层编排器 — 计划、调度、验证复杂工作至专业团队 | `rolebox install emperor` |
| **software-architect** | 系统设计与架构评审 — ADR、C4 模型、权衡分析 | `rolebox install software-architect` |
| **react-frontend** | React/Next.js 前端开发 — 组件设计、状态管理 | `rolebox install react-frontend` |
| **ai-designer** | AI 应用设计 — 人性化 UX、交互建模、设计系统 | `rolebox install ai-designer` |
| **tauri** | 桌面应用开发 — Tauri v2 IPC、插件、窗口管理 | `rolebox install tauri` |
| **dart-flutter** | 跨平台 Flutter 开发 — 完整 Gate 审查流水线 | `rolebox install dart-flutter` |

安装任意角色后重启 opencode 即可使用。浏览完整角色列表 → [oh-my-role 注册表](https://github.com/EricMoin/oh-my-role)

---

## ✨ 推荐功能：Emperor — 你的 AI 工程主管

[Emperor](https://github.com/EricMoin/oh-my-role) 是一个顶层编排器，负责计划、委派和验证跨多个专家子代理的复杂工作 — 它自己不写一行代码。

### 工作方式：
1. 你用自然语言描述需求
2. Emperor **计划**工作（三阶段：草案 → 评审 → 定稿）
3. **调度**子任务给专业部门（`ui`、`backend`、`test`、`data`、`docs`、`quality`），尽可能并行
4. **验证**每个结果 — 闭环校验
5. 必要时**修订** — 带校正预算的两轮重调度
6. **返回**结构化总结

了解更多 → [快速开始](/01-Overview/quick-start)
