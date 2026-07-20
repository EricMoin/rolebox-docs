---
title: 架构概览
description: rolebox 模块职责与数据流概览
---

# 架构概览

> **相关文档：** [开发环境搭建](/05-Contributing/development-setup) — 构建和测试指南 | [贡献指南](/05-Contributing/contributing) — PR 流程和代码规范 | [系统架构](/01-Overview/architecture-overview) — 用户视角的系统架构概述

本文档面向贡献者，描述核心模块的职责和数据流。

## 模块地图

```
src/
├── index.ts              # 插件入口，引导启动
├── pi-extension.ts       # opencode 插件集成点
│
├── core/                 # 核心基础设施
│   ├── plugin-core.ts    # 插件生命周期管理
│   ├── service.ts        # 服务注册模式
│   ├── event-bus.ts      # 事件总线
│   └── state-registry.ts # 全局状态注册
│
├── loader/               # 加载层
│   ├── role-loader.ts    # 角色 YAML 加载与解析
│   └── subagents.ts      # 子代理发现
│
├── resolver/             # 解析器
│   ├── bootstrap.ts      # 启动引导
│   ├── env-resolver.ts   # 环境变量解析
│   ├── frontmatter.ts    # 文件前置元数据
│   ├── orchestrator.ts   # 编排器
│   ├── reference-resolver.ts
│   └── skill-resolver.ts
│
├── hooks/                # Hook 系统
│   ├── chat-message.ts   # 用户消息处理
│   ├── system-transform.ts # 系统提示词构建
│   ├── tool-before.ts    # 工具调用前拦截
│   ├── tool-after.ts     # 工具调用后处理
│   └── ...
│
├── function/             # 函数系统
│   ├── parser.ts         # |function:args| 语法解析
│   ├── phase-machine.ts  # 函数阶段状态机
│   └── runtime-state.ts  # 会话级函数状态
│
├── graph/                # 协作图
│   ├── templates.ts      # 拓扑模板（pipeline / review-loop / star）
│   ├── validator.ts      # 图结构验证
│   ├── state.ts          # 图执行状态
│   ├── advance.ts        # 步骤推进
│   └── termination.ts    # 终止条件评估
│
├── dispatch/             # 调度系统
│   ├── tools.ts          # dispatch 工具注册
│   ├── factory.ts        # 子代理会话工厂
│   ├── concurrency.ts    # 信号量并发控制
│   ├── budget.ts         # 预算跟踪
│   └── checkpoint.ts     # 断点续传
│
├── recovery/             # 恢复引擎
│   ├── engine.ts         # 恢复链执行器
│   ├── error-detection.ts # 错误模式匹配
│   └── strategies/       # 7 种恢复策略
│
├── memory/               # 记忆存储
│   ├── store.ts          # 记忆持久化
│   └── tools.ts          # memory_write / memory_recall 工具
│
├── session/              # 会话工具
│   ├── tools.ts          # 10 个会话管理工具
│   ├── analytics.ts      # 分析仪表盘
│   └── export.ts         # 导出
│
├── notifications/        # 通知系统
│   ├── manager.ts        # 通知管理器
│   ├── channels/         # email / slack / webhook
│   └── scheduler.ts      # 定时投递
│
├── prompt/               # 提示词构建 — 系统提示组装
│   ├── builder.ts        # 提示词构建器
│   └── agent-config.ts   # 代理配置
│
├── signal/               # 信号系统
│   ├── signal-ledger.ts  # 信号日志
│   └── signal-tool.ts    # 信号发射工具
│
├── sync/                 # 同步工具 — 符号链接、代理文件
│   ├── agent-files.ts    # 代理文件管理
│   └── skill-symlinks.ts # 技能符号链接
│
├── loop/                 # 循环协调器
│   ├── coordinator.ts    # 多轮迭代控制
│   └── worker-dispatch.ts # 子 worker 派发
│
├── web/                  # 网络工具
│   ├── web-fetch.ts      # URL 抓取
│   ├── web-search.ts     # 网页搜索
│   └── ssrf-guard.ts     # SSRF 防护
│
├── lsp/                  # LSP 客户端
│   ├── client-manager.ts # 语言服务器管理
│   └── tools/            # LSP 工具实现
│
├── platform/             # 平台抽象层 — 工具装配、适配器
│   ├── tool-assembly.ts  # 工具注册与装配
│   └── types.ts          # 平台类型
│
├── extensions/           # 扩展系统
│   └── extension-point.ts # 扩展点注册
│
├── asset/                # 资产工具 — 检索、搜索、验证
│   ├── asset-inspect.ts  # 资产检视
│   ├── asset-search.ts   # 资产搜索
│   ├── asset-validate.ts # 资产验证
│   └── skill-compose.ts  # 技能组合分析
│
├── tui/                  # 终端 UI
│   └── components/       # SolidJS 组件
│
├── utils/                # 工具函数 — 路径、超时、显示辅助
│
└── cli/                  # CLI 入口
    └── main.ts           # 子命令定义
```

## 模块依赖关系

下表列出各 `src/` 模块之间的核心依赖关系。依赖链决定了模块初始化和降级顺序，详见 [服务架构](/01-Overview/service-architecture) 中拓扑排序的五个层级（Tier 0–4）。

### 核心依赖链

```
依赖方向:  模块A → 模块B  表示 "模块A 导入/使用 模块B"
```

```
src/index.ts  → loader → resolver → core → hooks
src/pi-extension.ts → platform → core

core/  ←──  所有上游模块（hooks, dispatch, loop, session, ...）
  │
  ├── dispatch/   → core/, recovery/*.d.ts
  ├── hooks/      → dispatch/, function/, graph/, core/, session/, memory/, signal/
  ├── loop/       → dispatch/, core/
  ├── recovery/   → dispatch/types
  ├── extensions/ → dispatch/, recovery/, core/
  ├── notifications/ → core/ (event-bus)
  ├── function/   → core/ (state-registry)
  ├── graph/      → core/ (state)
  ├── session/    → core/
  ├── memory/     → core/
  ├── lsp/        → core/
  ├── asset/      → core/
  ├── platform/   → core/
  └── prompt/     → function/, core/

独立/叶子模块:
  ├── web/        — 无 src/ 内部依赖
  ├── hashline/   — 无 src/ 内部依赖
  ├── sync/       — 无 src/ 内部依赖
  ├── tui/        — 无 src/ 内部依赖
  └── utils/      — 被多个模块导入的工具函数
```

### 依赖详情

| 模块 | 依赖方 | 依赖类型 |
|------|--------|----------|
| `core/` | hooks, dispatch, loop, function, graph, session, memory, lsp, asset, platform, extensions, notifications, prompt, recovery | 基础设施 — 服务注册、事件总线、状态注册表 |
| `dispatch/` | hooks (核心调用), loop (子代理派发), extensions (条件注册), tool-service | 调度引擎 — 并发控制、预算、检查点 |
| `function/` | hooks (chat-message, system-transform), prompt (builder) | 函数状态机 — 解析、门控、观察 |
| `recovery/` | dispatch (错误恢复), extensions (策略注册) | 恢复引擎 — 模式匹配、策略链 |
| `graph/` | hooks (tool-after 图推进), extensions (拓扑注册) | 协作图引擎 — 验证、终止 |
| `session/` | hooks, dispatch (会话上下文) | 会话工具 — CRUD、导出、搜索 |
| `memory/` | hooks (system-transform 记忆注入) | 记忆存储 — SQLite 持久化、搜索 |
| `notifications/` | hooks, extensions (通知通道注册) | 事件订阅 — 多通道投递、节流 |

### 生命周期交叉引用

模块的初始化顺序由 ServiceSupervisor 按拓扑排序驱动：

- **服务初始化顺序**（`src/core/plugin-core.ts:187-219`）：Tier 0 无依赖服务 → Tier 1 loop/extensions → Tier 2 tool → Tier 3 hook → Tier 4 health-monitor
- **详细拓扑**：参见 [服务架构 — 服务依赖关系](/01-Overview/service-architecture#服务依赖关系)
- **完整角色引导生命周期**：参见 [架构概览 — 角色引导生命周期](/01-Overview/architecture-overview#角色引导生命周期)
- **插件加载管道**：参见 [处理管道 — 阶段 1](/01-Overview/processing-pipeline#阶段-1-插件加载-plugin-loading)

::: warning 依赖方向约束
在贡献代码时，请遵循依赖方向：**上层模块可以导入下层模块，但下层模块不应反向依赖上层模块**。例如 `hooks/` 可以导入 `dispatch/`，但 `dispatch/` 不应导入 `hooks/`。独立模块（`web/`、`hashline/`）也不应导入其他业务模块。
:::

## 数据流

一条用户消息的典型处理管线：

```
用户输入
    │
    ▼
src/index.ts (插件入口)
    │
    ▼
src/hooks/chat-message.ts (消息拦截)
    │
    ▼
src/function/parser.ts (函数语法解析)
    │  ┌─────────────────────────┐
    │  │ |plan| → plan 函数激活   │
    │  │ |execute| → execute 激活│
    │  │ |loop:N| → loop 激活    │
    │  └─────────────────────────┘
    ▼
src/hooks/system-transform.ts (系统提示构建)
    │  ┌──────────────────────────┐
    │  │ 注入技能、引用、函数声明   │
    │  └──────────────────────────┘
    ▼
src/hooks/tool-before.ts (工具调用前)
src/hooks/tool-after.ts  (工具调用后)
    │
    ▼
src/dispatch/tools.ts (子代理派发)
    │  ┌─────────────────────────────┐
    │  │ dispatch → concurrency 控制 │
    │  │         → budget 检查       │
    │  │         → 子代理会话创建     │
    │  └─────────────────────────────┘
    ▼
src/recovery/engine.ts (错误恢复)
    │  ┌──────────────────────────────┐
    │  │ 重试 → 模型降级 → 截断 → 汇总 │
    │  └──────────────────────────────┘
    ▼
结果返回给用户
```

## 下一步

- [开发环境搭建](/05-Contributing/development-setup) — 构建和测试指南
- [贡献指南](/05-Contributing/contributing) — PR 流程和代码规范
- [服务架构](/01-Overview/service-architecture) — 服务初始化拓扑与降级策略
