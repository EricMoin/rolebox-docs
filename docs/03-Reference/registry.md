---
title: 注册中心
description: 创建与管理注册中心 — GitHub 仓库结构、registry.yaml 格式与默认注册中心 oh-my-role
---

# 注册中心

> **相关文档：** [CLI 参考](/03-Reference/cli) — 通过 `rolebox registry` 管理注册中心 | [role.yaml 参考](/03-Reference/role-yaml) — 角色定义参考 | [创建角色](/02-Guide/create-a-role) — 角色创建指南

注册中心是一个符合特定结构的 GitHub 仓库，用于发布和分发角色。

## 仓库结构

```
registry-repo/
├── registry.yaml
└── roles/
    ├── role-a/
    │   ├── role.yaml
    │   └── skills/
    └── role-b/
        ├── role.yaml
        └── skills/
```

## registry.yaml 格式

`registry.yaml` 文件必须遵循以下格式：

```yaml
name: my-registry
description: 注册中心的描述信息
url: https://github.com/user/my-registry
roles:
  role-a:
    version: "1.0.0"
    description: 角色描述
    tags: [tag1, tag2]
  role-b:
    version: "1.1.0"
    description: 另一个角色
    tags: [tag3]
```

## 发布自己的注册中心

1. 按照上述结构创建一个 GitHub 仓库
2. 将角色作为子目录添加到 `roles/` 下
3. **版本管理**：在仓库上使用 git 标签（如 `v1.0.0`）
4. 用户可以通过以下命令添加：`rolebox registry add https://github.com/your-org/your-registry`

### 分步详解

#### 第 1 步：创建仓库结构

创建一个新的 GitHub 仓库，按照上述目录结构初始化：

```bash
mkdir my-registry && cd my-registry
mkdir -p roles
```

在仓库根目录创建 `registry.yaml` 清单文件。

#### 第 2 步：编写 registry.yaml

registry.yaml 是整个注册中心的索引文件，声明注册中心元数据和所有可用角色列表。使用 `rolebox info` 或 `rolebox search` 查询注册中心时，系统读取此文件获取角色概要。

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
    tags: [review, team]
```

#### 第 3 步：添加角色目录

在 `roles/` 下为每个角色创建子目录，结构即一个完整的 rolebox 角色：

```
roles/
├── my-coder/
│   ├── role.yaml
│   ├── PROMPT.md
│   ├── skills/
│   └── references/
└── my-reviewer/
    ├── role.yaml
    ├── PROMPT.md
    └── functions/
```

每个角色目录独立可发布，`registry.yaml` 仅做索引。

#### 第 4 步：版本控制

使用 git 标签管理版本号。推荐遵循[语义化版本](https://semver.org/)（SemVer）规范：

```bash
git tag v1.0.0
git push origin v1.0.0

# 发布新版本
git tag v1.1.0
git push origin v1.1.0
```

用户可以通过 `rolebox install my-registry:my-coder@1.0.0` 安装特定版本。未指定版本时使用默认分支的最新代码。

#### 第 5 步：发布与安装

推送仓库到 GitHub 后，用户即可添加并安装：

```bash
rolebox registry add https://github.com/my-org/my-registry
rolebox install my-registry:my-coder
rolebox sync opencode
```

如需更新注册中心中的角色版本，用户运行 `rolebox update` 即可拉取最新版本。

### 注册中心维护建议

::: tip 维护实践
- **版本前向兼容**：保持 `role.yaml` 的向后兼容性，避免发布破坏性变更
- **标签一致性**：角色版本号与 git 标签一致，建议每次更新角色时都打标签
- **描述更新**：更新 `registry.yaml` 中的描述后提交推送，无需打标签
- **删除角色**：从 `registry.yaml` 的 `roles:` 列表中移除条目即可，旧版本用户仍可使用已安装的角色
:::

### 注册中心故障排查

#### `rolebox install` 返回 404

**现象：** 执行 `rolebox install my-registry:my-role` 时提示角色未找到。

**原因：** `registry.yaml` 中 `roles:` 下的键名与 `roles/` 目录中的子目录名称不一致。系统在安装时通过 `manifest.roles[roleId]` 查找角色（`src/cli/commands/install.ts:77-79`），键名必须精确匹配目录名。

**排查步骤：**
1. 打开仓库根目录的 `registry.yaml`，检查 `roles:` 下的键名
2. 查看 `roles/` 目录下的子目录实际名称
3. 确保两者完全一致（包括大小写）

#### `rolebox registry add` 报告无效 URL

**现象：** `rolebox registry add` 抛出 `Invalid GitHub URL` 错误。

**原因：** `registryAddFn()`（`src/cli/commands/registry.ts:15-21`）调用 `parseGitHubUrl()` 验证 URL 格式。该函数只接受 `https://github.com/owner/repo` 或 `git@github.com:owner/repo.git` 格式。

**排查步骤：**
1. 确认 URL 以 `https://github.com/` 开头
2. 确认包含 owner 和 repo 两部分（如 `https://github.com/my-org/my-registry`）
3. 移除末尾多余的路径或参数

#### 版本未找到

**现象：** 安装时指定版本号但提示版本不存在。

**原因：** 仓库中的 git 标签与 `registry.yaml` 中的 `version` 字段格式不匹配。`resolveVersion()`（`src/cli/registry-client.ts:38-44`）从 `registry.yaml` 读取角色版本信息（`manifest.roles[roleId].version`），但实际下载依赖 git 标签。

**排查步骤：**
1. 检查 `registry.yaml` 中角色的 `version` 字段是否匹配语义化版本格式（如 `1.0.0`）
2. 运行 `git tag` 确认仓库中存在对应的 git 标签（如 `v1.0.0`）
3. 确保 `registry.yaml` 中的版本号与 git 标签号一致（均不含 `v` 前缀，或统一格式）

## 注册中心格式规范

以下文档描述了 `registry.yaml` 文件的完整字段定义和验证规则。

### 顶层字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 注册中心名称，建议使用 kebab-case。用于 CLI 命令中的 `registry` 标识符 |
| `description` | string | 否 | 注册中心的简短描述，在 `rolebox search` 结果中显示 |
| `url` | string | 是 | GitHub 仓库 URL。用于 `rolebox registry add` 的安装源 |
| `roles` | object | 是 | 角色索引映射，键为角色名称，值为角色元数据 |

### 角色元数据字段（`roles` 下的每个条目）

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `version` | string | 是 | 当前角色版本号，遵循 SemVer（如 `1.0.0`）。与仓库的 git 标签对应 |
| `description` | string | 否 | 角色的简短描述，在 `rolebox search` 和 `rolebox list` 中显示 |
| `tags` | string[] | 否 | 标签列表，用于分类和搜索匹配 |

### 验证规则

- `name` 不能为空，且必须合法为目录名称
- `url` 必须是有效的 GitHub HTTPS 仓库地址（`https://github.com/*`）
- `roles` 中每个键必须与 `roles/` 目录下的子目录名称完全一致
- `version` 必须匹配语义化版本格式（如 `1.0.0`、`2.3.4-alpha.1`）
- 同一注册中心中角色名称不可重复

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

## 默认注册中心

默认注册中心是 [oh-my-role](https://github.com/EricMoin/oh-my-role)，提供了一组精选角色：

| 角色 | 说明 |
|---|---|
| `emperor` | 顶层编排器，采用 Planner → Executor → Validator 架构 |
| `software-architect` | 系统设计与架构 |
| `react-frontend` | React/Next.js 前端开发 |
| `ai-designer` | AI 应用设计 |
| `tauri` | Tauri 桌面应用开发 |
| `dart-flutter` | Flutter 跨平台移动端和桌面端开发 |

## CLI 工作流

通过 `rolebox registry` 子命令管理注册中心（`src/cli/commands/registry.ts:86-97`）：

### `rolebox registry add <url>`
添加一个新的注册中心。验证 URL 必须是有效的 GitHub 仓库地址，并在添加前尝试获取注册清单（`src/cli/commands/registry.ts:15-38`）。

```bash
rolebox registry add https://github.com/your-org/your-registry
# ✓ Added registry 'your-registry' (https://github.com/your-org/your-registry)
```

### `rolebox registry list`
列出所有已配置的注册中心，默认注册中心带有 `(default)` 标记（`src/cli/commands/registry.ts:6-13`）。

```bash
rolebox registry list
# Registries:
#   oh-my-role    https://github.com/EricMoin/oh-my-role (default)
#   my-registry   https://github.com/your-org/your-registry
```

### `rolebox registry remove <name>`
移除一个注册中心。不能移除默认注册中心。如果已安装来自该注册中心的角色，会给出警告提示（`src/cli/commands/registry.ts:40-63`）。

```bash
rolebox registry remove my-registry
# ✓ Removed registry 'my-registry'
# Warning: 2 role(s) from 'my-registry' are still installed. Use 'rolebox uninstall' to remove them.
```

## 本地注册中心示例

你可以在本地或私有 Git 仓库中搭建自己的注册中心。目录结构：

```
my-registry/
├── registry.yaml
└── roles/
    └── my-coder/
        ├── role.yaml
        └── skills/
```

`registry.yaml`：

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

版本管理使用 git 标签：

```bash
git tag v1.0.0
git push origin v1.0.0
```

::: tip 版本固定
注册中心通过 git 标签管理版本。如果用户安装时没有指定标签，则使用默认分支的最新代码。建议在生产环境中使用语义化版本标签（如 `v1.0.0`）来锁定角色版本，避免意外升级引入破坏性变更。
:::

### CI/CD 自动发布示例

以下 GitHub Actions 工作流在推送标签时自动更新版本并提交 `registry.yaml`，适合作为注册中心仓库的发布流水线：

```yaml
name: Publish Registry

on:
  push:
    tags:
      - "v*"

jobs:
  update-registry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # 需要推送权限以更新 registry.yaml
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Update registry.yaml versions
        run: |
          # 从 git 标签提取版本号（去掉 v 前缀）
          VERSION="${GITHUB_REF_NAME#v}"
          echo "Release version: $VERSION"
          # 使用 yq 更新 registry.yaml 中的所有角色版本
          # 安装 yq: https://github.com/mikefarah/yq
          yq eval '.roles[].version = "'"$VERSION"'"' -i registry.yaml

      - name: Commit and push
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add registry.yaml
          git commit -m "chore: bump registry version to ${GITHUB_REF_NAME#v}"
          git push
```

该工作流在推送 `v*` 标签时触发，使用 `yq` 工具统一更新 `registry.yaml` 中所有角色的 `version` 字段。如果角色版本需要独立管理，可在 `Update registry.yaml versions` 步骤中按角色分别处理。

## 下一步

- [CLI 参考](./cli) — 通过 `rolebox registry add/remove/list/update` 管理注册中心
