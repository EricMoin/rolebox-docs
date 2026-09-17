---
title: 注册中心
description: 注册中心仓库的结构、registry.yaml 清单格式、发布自有注册中心，以及默认注册中心与精选角色库
---

# 注册中心（Registry）

注册中心（registry）是一个遵循固定目录结构的 GitHub 仓库：rolebox 读取仓库根目录的 `registry.yaml` 清单来索引可安装的角色。本页给出仓库结构、清单格式、发布流程与默认注册中心。

> 自 v0.4.0 起，rolebox 通过注册中心客户端从 GitHub 仓库读取 `registry.yaml` 清单，并提供 `rolebox registry` 子命令管理多个注册中心。

> 相关：[CLI 参考](/03-Reference/cli) — `rolebox registry` / `install` / `sync` 的确切用法｜[role.yaml 参考](/03-Reference/role-yaml) — 注册中心里每个角色的定义文件｜[平台与 Harness](/01-Overview/platform-harnesses) — `sync` 把角色部署到哪里

## 最小示例：添加、安装、部署

```bash
rolebox registry add https://github.com/my-org/my-registry
rolebox install my-registry:my-coder
rolebox sync opencode
```

```text
应看到：
✓ Added registry 'my-registry' (https://github.com/my-org/my-registry)
✓ Installed my-coder@1.0.0 from my-registry
Synced 1 roles to opencode
```

## 仓库结构

```text
my-registry/
├── registry.yaml          # 清单：注册中心元数据 + 角色索引
└── roles/
    ├── my-coder/
    │   ├── role.yaml
    │   ├── PROMPT.md
    │   ├── skills/
    │   └── functions/
    └── my-reviewer/
        ├── role.yaml
        └── PROMPT.md
```

`roles/<roleId>/` 就是一个完整的 rolebox 角色目录，与本地角色同构；`registry.yaml` 只做索引。清单里的角色键必须与 `roles/` 下的子目录名逐字符一致（含大小写）——安装时先按键在清单里查角色，再按同一个键去仓库里取 `roles/<roleId>` 目录。

## registry.yaml 格式

清单的骨架是四个顶层字段加一张角色表：

```yaml
name: my-registry
description: 团队内部角色注册中心
url: https://github.com/my-org/my-registry
roles:
  my-coder:
    version: "1.0.0"
    description: 团队编码助手
    tags: [coding, team]
```

### 顶层字段

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 注册中心名称；`rolebox search` 用它给结果分组 |
| `description` | string | 是 | 注册中心的简短描述 |
| `url` | string | 是 | 注册中心仓库 URL；拉取 tarball 时从中解析 owner / repo |
| `roles` | object | 是 | 角色索引：键为角色 id，值为角色元数据 |

### 角色条目字段（`roles` 下的每一项）

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `version` | string | 是 | 角色版本号，遵循 SemVer（如 `1.0.0`） |
| `description` | string | 是 | 角色简介，显示在 `rolebox search` 的结果行里 |
| `tags` | string[] | 是 | 标签，参与 `rolebox search` 的关键词匹配 |
| `integrity` | string | 否 | 完整性摘要；声明后安装与更新会强制比对，不一致即拒绝安装 |

### 校验规则

清单只做类型校验，不做格式或语义校验：`name`、`description`、`url` 必须是字符串，`roles` 必须是对象，每个角色条目的 `version`、`description` 必须是字符串、`tags` 必须是字符串数组。任一不符都会在拉取清单时立即报错，例如 `Registry manifest: role 'my-coder' must have a string 'version'`。`url` 字段本身只要求是字符串；URL 的格式检查发生在 `rolebox registry add` 一侧。

### 完整示例

```yaml
name: my-registry
description: 团队内部角色注册中心
url: https://github.com/my-org/my-registry
roles:
  my-coder:
    version: "1.0.0"
    description: 团队编码助手
    tags: [coding, team]
  my-reviewer:
    version: "0.5.0"
    description: 代码审查员
    tags: [review, quality]
```

## 发布自己的注册中心

1. 建一个 GitHub 仓库，根目录放 `registry.yaml`，每个角色放在 `roles/<roleId>/` 下。
2. 在清单里为每个角色写 `version`，并用 git 标签标记发布点。
3. 让使用者添加、安装并部署：

```bash
rolebox registry add https://github.com/my-org/my-registry
rolebox install my-registry:my-coder
rolebox sync opencode
```

```text
应看到：
✓ Added registry 'my-registry' (https://github.com/my-org/my-registry)
✓ Installed my-coder@1.0.0 from my-registry
Synced 1 roles to opencode
```

### 版本从哪里来

角色版本的事实来源是清单里该条目的 `version` 字段，git 标签只标记发布点。推荐遵循[语义化版本](https://semver.org/)（SemVer）；用 CI 在推标签时同步清单，例如 GitHub Actions：

```yaml
name: Publish Registry
on:
  push:
    tags: ["v*"]
jobs:
  update-registry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update registry.yaml versions
        run: |
          VERSION="${GITHUB_REF_NAME#v}"
          yq eval '.roles[].version = "'"$VERSION"'"' -i registry.yaml
      - name: Commit and push
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add registry.yaml
          git commit -m "chore: bump registry version to ${GITHUB_REF_NAME#v}"
          git push
```

### 版本锁定的实际边界

注册中心不通过 git 标签分发代码：无论是否指定 `@版本`，安装与更新都从默认分支 `main` 的 tarball 下载。`@版本` 只影响清单校验、lock 记录与安装目录 `{rolesDir}/{registry}/{roleId}@{version}/`。

因此要让 `rolebox install my-registry:my-coder@1.0.0` 里的版本与代码内容真正对应，需要在清单里声明 `integrity`：声明后哈希不一致会直接拒绝安装；未声明时只把实测哈希记进 lock，作为尽力而为的 pin。

### 维护建议

- 保持 `role.yaml` 向后兼容，避免发布破坏性变更。
- 清单里的 `version` 与 git 标签保持一致，每次发版都打标签。
- 更新描述后提交推送即可，无需打标签。
- 删除角色只需从 `roles:` 里移除条目；旧版本的使用者仍可使用已安装的角色。

## 默认注册中心

首次运行 CLI 时会自动写入默认配置，其中唯一的注册中心是 [oh-my-role](https://github.com/EricMoin/oh-my-role)，带 `default: true` 标记。

### 精选角色库

| 角色 | 功能 | 安装命令 |
|---|---|---|
| `emperor` | 顶层编排器 — 分类请求、派发给 planner / executor 子树、闭环校验结果 | `rolebox install emperor` |
| `software-architecture` | 软件架构 — 协调专家子代理完成设计、评审、ADR 与迁移方案 | `rolebox install software-architecture` |
| `react-frontend` | React / Next.js 前端 — 组件设计、状态管理与前端架构 | `rolebox install react-frontend` |
| `ai-designer` | AI 应用设计 — 分层路由的设计主管，制品先出、按严重度分级评审 | `rolebox install ai-designer` |
| `tauri` | Tauri 桌面应用 — Rust 与 Web 技术栈、IPC、插件与窗口管理 | `rolebox install tauri` |
| `dart-flutter` | Dart / Flutter — 构建、测试、性能剖析与全流程质量门 | `rolebox install dart-flutter` |

安装任意角色后运行 `rolebox sync opencode` 即可部署到 harness。完整角色列表与各角色的详细说明见 [oh-my-role](https://github.com/EricMoin/oh-my-role)。

## 本地注册中心示例

注册中心也可以放在私有 Git 仓库里——rolebox 只要求它是一个能按 `https://github.com/owner/repo` 访问的 GitHub 仓库。目录结构：

```text
my-registry/
├── registry.yaml
└── roles/
    └── my-coder/
        ├── role.yaml
        └── skills/
```

```yaml
name: my-registry
description: 团队内部角色注册中心
url: https://github.com/my-org/my-registry
roles:
  my-coder:
    version: "1.0.0"
    description: 团队编码助手
    tags: [coding, team]
```

发布新版本时更新清单里的版本号并推一个标签：

```bash
git tag v1.1.0
git push origin v1.1.0
```

成员侧用 `rolebox update` 重新读取清单，把角色更新到清单里的最新版本：

```bash
rolebox update my-coder
```

```text
应看到：
✓ Updated my-coder from 1.0.0 to 1.1.0
Updated 1 roles.
Run `rolebox sync opencode` to deploy changes
```

## CLI 工作流

本节只演示与注册中心相关的三条命令；每个子命令的完整参数、常用选项与退出码见 [CLI 参考](/03-Reference/cli)。

### 添加注册中心

`rolebox registry add <url>` 先校验 URL、拉取一次清单确认可读，再写入配置；注册中心名直接取仓库名。

```bash
rolebox registry add https://github.com/my-org/my-registry
```

```text
应看到：
✓ Added registry 'my-registry' (https://github.com/my-org/my-registry)
```

### 列出注册中心

```bash
rolebox registry list
```

```text
应看到：
Registries:
  oh-my-role    https://github.com/EricMoin/oh-my-role (default)
  my-registry   https://github.com/my-org/my-registry
```

### 移除注册中心

`rolebox registry remove <name>` 不能移除默认注册中心；若仍有角色来自该注册中心，会给出警告。

```bash
rolebox registry remove my-registry
```

```text
应看到：
✓ Removed registry 'my-registry'
Warning: 2 role(s) from 'my-registry' are still installed. Use 'rolebox uninstall' to remove them.
```

### 安装与更新

`rolebox install` 按 `registry:role@version` 解析目标；省略注册中心前缀时使用默认注册中心。`rolebox update` 是独立于 `rolebox registry` 的顶层命令，重新读取清单后按同样的原子替换流程升级角色。

## 常见错误

- **`rolebox install` 报角色未找到**：清单 `roles:` 里的键与 `roles/` 下的目录名不一致，或清单里根本没有该键。两者必须逐字符一致。
- **`rolebox registry add` 报 `Invalid GitHub URL`**：只接受 `https://github.com/owner/repo`（可带 `.git` 后缀或尾斜杠）与 `git@github.com:owner/repo.git` 两种写法。
- **指定 `@版本` 后拿到的仍是新代码**：版本解析只查清单，代码始终来自默认分支 tarball；要让版本锁定生效，请在清单里声明 `integrity`。
