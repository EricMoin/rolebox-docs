---
title: 编写技能
description: 创建和管理 SKILL.md 技能模块 — 格式、引用、解析顺序和去重机制
---

# 编写技能

> **相关文档：** [技能系统](/02-Guide/skills) — 技能解析顺序与加载机制 | [引用文档](/02-Guide/references) — 引用文档的自动发现与声明 | [创建角色](/02-Guide/create-a-role) — 完整的角色创建指南

技能是按需加载的知识模块。与函数不同（函数一旦激活就持续存在），技能通过 `skill` 工具在需要时按上下文加载。

## SKILL.md 格式

每个技能是一个带有 YAML frontmatter 的 Markdown 文件，文件必须命名为 `SKILL.md`。

### 目录结构

技能可以通过两种方式组织：

**单文件形式：**
```
{roleDir}/skills/review-checklist.md
```

**目录形式（推荐，支持引用）：**
```
{roleDir}/skills/review-checklist/
├── SKILL.md
└── references/              # 可选 — 技能专有的引用文档
    └── best-practices.md
```
### 目录形式 vs 单文件形式：选型指南

| 场景 | 推荐形式 | 原因 |
|------|---------|------|
| 技能内容简短（< 50 行），无外部引用 | 单文件形式 | 文件数量最少，管理成本低 |
| 技能需要引用文档作为参考材料 | 目录形式 | `references/` 目录自动发现机制开箱即用 |
| 技能包含长篇幅说明、代码示例或多语言版本 | 目录形式 | 引用分离使 SKILL.md 保持专注和可维护 |
| 技能在多个角色间共享 | 目录形式 | 便于后期扩展引用，兼容全局部署 |
| 快速原型或实验性技能 | 单文件形式 | 无需创建目录，从单文件起步成本最低 |
| 技能需要声明 `allowed-tools` | 两者均可 | 该字段不依赖目录结构，单文件同样支持 |

单文件形式适合小规模、自包含的知识提示。一旦技能需要引用文档、代码清单或多语言内容，应迁移到目录形式。



### Frontmatter 规范

```yaml
---
name: review-checklist
description: Comprehensive code review checklist
model: gpt-4              # 可选 — 建议使用的模型
license: MIT              # 可选 — 许可标识
compatibility: claude-code opencode  # 可选 — 工具兼容性声明
allowed-tools: Read, Grep, Glob       # 可选 — 允许的工具
references:                            # 可选 — 显式引用声明
  best-practices: references/best-practices.md
  coding-standards:
    path: docs/standards.md
    description: Team coding conventions
---
```

| Frontmatter 字段 | 类型 | 必需 | 描述 |
|-----------------|------|------|------|
| `name` | string | 建议 | 技能名称，如果未提供则从目录名推导 |
| `description` | string | 是 | 人类可读的描述，显示在技能列表中 |
| `model` | string | 否 | 推荐使用的模型标识 |
| `license` | string | 否 | 许可标识 |
| `compatibility` | string | 否 | 工具兼容性声明 |
| `allowed-tools` | string \| array | 否 | 允许的工具列表 |
| `references` | object | 否 | 显式引用文件声明 |

### 技能内容示例

```markdown
---
name: review-checklist
description: Comprehensive code review checklist
references:
  security-guide: references/security-guide.md
---

When reviewing code, check:

### Correctness
- Error handling completeness
- Input validation at all entry points
- Type safety and null handling
- Edge cases (empty inputs, boundary values)

### Performance
- Unnecessary allocations
- Loop efficiency
- Cache utilization opportunities

### Security
- SQL injection / XSS prevention
- Authentication and authorization checks
- Sensitive data exposure
```

## 引用声明

技能可以声明自己的引用文档，这些引用会在技能加载时自动解析。

### 显式引用

在 SKILL.md 的 frontmatter 中声明的引用：

```markdown
---
references:
  api-spec: references/api-spec.md
  design-guide:
    path: docs/design-guide.md
    description: Custom description
---
```

引用解析实现在 `src/resolver/reference-resolver.ts:135-174`：
- `path` 相对于技能目录解析
- 可选的 `description` 覆盖自动生成的描述
- 如果文件不存在，引用会被跳过并记录日志

### 自动发现

技能目录下的 `references/` 目录中的 Markdown 文件会被自动发现（`src/resolver/reference-resolver.ts:97-128`）：

```
{roleDir}/skills/review-checklist/
├── SKILL.md
└── references/
    ├── security-guide.md      # 自动发现
    └── performance-tips.md    # 自动发现
```

自动发现的文件的描述来自：
1. 文件的 YAML frontmatter 中的 `description` 字段（`src/resolver/reference-resolver.ts:46-91`）
2. 如果无 frontmatter，则从文件名推导（`deriveDescriptionFromName`，`src/resolver/reference-resolver.ts:32-37`）

### 解析顺序

引用解析遵循以下优先级（`src/resolver/reference-resolver.ts:184-216`）：

1. 自动发现 `references/` 目录中的文件
2. 显式声明覆盖自动发现的文件的描述
3. 显式独有的条目（不在 `references/` 中的文件路径）附加到结果中
4. 文件路径去重：同一文件路径的显式条目优先于自动发现

## 解析顺序

技能的加载和解析遵循固定的优先级（`src/resolver/skill-resolver.ts:17-34`）：

1. `{roleDir}/skills/{name}/SKILL.md` — 角色本地目录形式（**最高优先级**）
2. `{roleDir}/skills/{name}.md` — 角色本地单文件形式
3. `~/.config/opencode/skills/{name}/SKILL.md` — 全局目录形式
4. `~/.config/opencode/skills/{name}.md` — 全局单文件形式

解析实现在 `src/resolver/skill-resolver.ts:43-118`：
- 使用 `fast-glob` 批量匹配所有候选模式以提高性能
- 对于每个技能名，按顺序检查 4 个候选位置，第一个存在的文件胜出
- 如果所有位置都找不到技能，会记录日志并静默跳过

## 多角色引用去重

当多个角色加载同一技能时，引用文档可能重复。去重机制（`src/resolver/reference-resolver.ts:201-216`）：

- 引用按**绝对文件路径**去重（`byPath` Map）
- 显式声明的引用优先于自动发现的引用（保留显式 `description`）
- 最终结果按名称排序以保证确定性输出

## 技能与函数对比

| 维度 | 技能 (Skill) | 函数 (Function) |
|------|-------------|-----------------|
| 激活方式 | 代理通过 `skill` 工具按需加载 | 用户通过 `\|name\|` 语法激活 |
| 生命周期 | 单次调用 | 持久化到会话结束 |
| 目的 | 参考知识 | 行为修改 |
| 注入方式 | 按需注入到上下文 | 活跃时始终在系统提示中 |
| 引用管理 | 支持引用声明和自动发现 | 无内置引用管理 |
| 参数化 | 无 | 支持参数化（位置/键值对） |

## 引用加载机制

引用文档的加载路径（`src/resolver/reference-resolver.ts`）：

```
技能目录             角色目录              全局目录
{sR}/references/    {role}/references/    ~/.config/opencode/references/
     │                    │                       │
     └──────┬─────────────┴──────┬────────────────┘
            │                    │
      自动发现               显式声明
   fg("**/*.md")           role.yaml references:
```

## 技能引用解析

技能加载时，`resolveSkills`（`src/resolver/skill-resolver.ts:43-106`）并行解析所有匹配技能的引用文档。

### 解析流程

```
resolveSkills(skillNames, roleDir, globalSkillsDir)
├── 第 1 轮：批量 glob 匹配 — 对所有候选路径使用 fast-glob
│   ├── 按优先级检查每个技能名的 4 个候选位置
│   │   ├── {roleDir}/skills/{name}/SKILL.md
│   │   ├── {roleDir}/skills/{name}.md
│   │   ├── {globalDir}/{name}/SKILL.md
│   │   └── {globalDir}/{name}.md
│   └── 第一个存在的文件胜出（早期匹配短路）
│
├── 第 2 轮：并行解析（Promise.all）
│   ├── 读取文件内容并解析 frontmatter（`parseFrontmatter`）
│   ├── 从 frontmatter 提取 description
│   └── 调用 resolveAllReferences(skillDir, ReferenceScope.Skill, references)
│       ├── 自动发现 references/ 目录中的 Markdown 文件
│       ├── 合并显式声明的引用（可覆盖 description）
│       ├── 按绝对路径去重
│       └── 按名称排序后返回
│
└── 未找到的技能名静默跳过（不抛异常）
```

`resolveAllReferences` 的调用发生在 `src/resolver/skill-resolver.ts:95-99`：

```typescript
// Second pass: read files and resolve references in parallel
const resolved: ResolvedSkill[] = await Promise.all(
  winners.map(async ({ name, filePath, scope }) => {
    const content = await Bun.file(filePath).text();
    const { metadata } = parseFrontmatter(content);
    description = metadata.description ?? "";

    const skillDir = dirname(filePath);
    references = await resolveAllReferences(
      skillDir,
      ReferenceScope.Skill,
      metadata.references as SkillMetadata["references"],
    );
    // ...返回 { name, description, scope, filePath, references }
  }),
);
```

### 引用作用域

技能引用使用 `ReferenceScope.Skill` 作用域（`src/resolver/reference-resolver.ts`），与角色级引用（`ReferenceScope.Role`）共享相同的解析逻辑，但路径相对于技能目录解析。

## 测试技能

> **提示**：使用内置的 `skill_compose` 工具验证技能组合的兼容性。
>
> ```
> |skill_compose skill_names=["review-checklist", "security-audit"]|
> ```
>
> `skill_compose` 会分析指定技能之间是否存在以下冲突：
> - **引用路径冲突**：两个技能引用同名但不同路径的文档
> - **工具权限冲突**：两个技能声明冲突的 allowed-tools
>
> 该工具还自动对技能引用进行**去重**（按绝对路径合并），确保组合后的引用集合无冗余。

## 实践建议

1. **使用目录形式**：目录形式支持引用文档，使技能更加自包含
2. **提供描述**：frontmatter 中的 `description` 帮助代理判断何时加载技能
3. **引用分离**：将大段参考知识放入 `references/` 目录，保持 SKILL.md 简洁
4. **版本控制**：将技能与其引用文档一起纳入版本管理

## 端到端实践：从零构建一个 code-review-checklist 技能

本节演示从目录创建到加载验证的完整流程。以 `code-review-checklist` 为例，逐步构建一个包含引用文档的技能。

### 步骤 1：创建目录结构

在角色目录下创建技能目录和引用目录：

```bash
mkdir -p my-role/skills/code-review-checklist/references
```

目录结构如下：
```
my-role/skills/code-review-checklist/
├── SKILL.md
└── references/
    └── security-guide.md      # 安全审查参考文档
```

### 步骤 2：编写 SKILL.md

创建 `my-role/skills/code-review-checklist/SKILL.md`：

```markdown
---
name: code-review-checklist
description: 代码审查清单 — 检查正确性、安全性、性能和风格
license: MIT
compatibility: opencode
allowed-tools:
  - Read
  - Grep
  - Glob
references:
  security-guide: references/security-guide.md
---

# Code Review Checklist

## Correctness
- 是否处理了所有边界情况（空输入、极值、并发竞态）？
- 错误路径是否被妥善处理（重试、回退、降级）？
- 类型安全和空值处理是否完整？

## Security
- 输入是否经过验证和清理？
- 是否存在注入漏洞（SQL / XSS / 命令注入）？
- 敏感信息（密钥、令牌）是否被硬编码？

## Performance
- 是否存在 N+1 查询或冗余循环？
- 缓存策略是否合理？
- 是否有明显的优化空间（如不必要的内存分配）？
```

引用文档 `security-guide.md` 提供了详细的安全审查规则，`SKILL.md` 本身保持精简。

### 步骤 3：创建引用文档

创建 `my-role/skills/code-review-checklist/references/security-guide.md`：

```markdown
---
description: OWASP 驱动的安全审查规则，覆盖认证、授权、输入验证和数据保护
---

# 安全审查指南

### 认证与授权
- 是否使用标准的认证机制（OAuth 2.0 / OpenID Connect）？
- 权限检查是否在每个端点执行（不仅是前端隐藏）？
- 会话管理是否安全（HttpOnly Cookie、CSRF Token）？

### 输入验证
- 所有用户输入是否在服务端验证（不仅是客户端）？
- 是否对文件上传做了类型和大小限制？
- 是否存在 SSRF 或路径遍历风险？

### 数据保护
- 敏感数据是否在传输和存储时加密？
- 日志中是否可能泄漏个人身份信息（PII）？
- API 响应是否过度暴露内部数据结构？
```

这个引用文档会自动被 `resolveAllReferences` 发现（`src/resolver/reference-resolver.ts:97-128`），无需在 SKILL.md 中声明路径即可加载。这里在 frontmatter 中显式声明它，以便在加载时提供自定义描述。

### 步骤 4：在 role.yaml 中注册

在角色配置文件中声明技能引用：

```yaml
# my-role/role.yaml
name: Code Reviewer
description: 代码审查专家
skills:
  - code-review-checklist      # 从角色本地 skills 目录加载
# …其他配置
```

注册后，解析器会按以下优先级搜索（`src/resolver/skill-resolver.ts:17-34`）：

1. `my-role/skills/code-review-checklist/SKILL.md` ✅ 目录形式 — 匹配成功
2. `my-role/skills/code-review-checklist.md` — 跳过（上一步已匹配）
3. `~/.config/opencode/skills/code-review-checklist/SKILL.md` — 跳过
4. `~/.config/opencode/skills/code-review-checklist.md` — 跳过

### 步骤 5：验证加载

启动代理后，使用内置工具验证技能是否正常加载：

```
|skill_compose skill_names=["code-review-checklist"]|
```

输出应包含：

```
## Skill Composition Analysis

**Requested:** code-review-checklist

### Found Skills
| Skill | Source | References Count |
|-------|--------|-----------------|
| code-review-checklist | code-reviewer | 1 |

### Combined References (deduplicated)
| Name | Description | Source Skills |
|------|-------------|--------------|
| security-guide | OWASP 驱动的安全审查规则，覆盖认证、授权、输入验证和数据保护 | code-review-checklist |

### Conflicts
No conflicts detected.

**Summary:** 1 skills found, 1 unique references, 0 conflicts, 0 missing.
```

验证要点：

1. **技能名称正确** — `code-review-checklist` 出现在 Found Skills 表中
2. **引用文档已解析** — `security-guide` 引用存在，描述与 frontmatter 一致
3. **无冲突** — Conflicts 区显示 No conflicts detected
4. **无缺失** — Summary 中 missing 计数为 0

如果技能加载失败，参见下方的[调试与排查](#调试与排查)节。

从创建目录到验证加载，整个流程约 5 分钟即可完成。这个模式适用于所有自包含技能。

## 技能组合模式

### 多技能协同

一个角色可以注册多个技能，代理会根据上下文按需加载。合理的组合方式：

```yaml
# role.yaml — 多技能注册
skills:
  - code-review-checklist    # 代码审查专业知识
  - security-audit          # 安全审计专业技能
  - performance-review      # 性能分析技能
```

当一个任务涉及多个方面（如 PR 审查同时需要正确性、安全性和性能分析），代理可以根据任务描述自主决定加载哪些技能。

### 技能组合分析（skill_compose）

`skill_compose` 工具（`src/asset/skill-compose.ts`）是技能组合的核心验证工具，提供以下分析：

#### 引用去重

当两个技能引用同名但同路径的文档时，`deduplicateReferences`（`src/asset/skill-compose.ts:41-65`）按绝对文件路径合并引用：

- 使用 `Map<filePath, DedupedReference>` 按路径去重
- 合并后的引用保留所有来源技能的名称
- 最终结果按名称排序以确保确定性输出

```
|skill_compose skill_names=["review-checklist", "security-audit"]|
```

#### 冲突检测

`detectReferenceConflicts`（`src/asset/skill-compose.ts:75-103`）检测引用路径冲突：

- 按引用名称分组，收集所有涉及的 `(filePath, skillName)` 对
- 如果同一名称的引用指向不同路径，标记为冲突
- 冲突详细信息包括：冲突的引用名、涉及的路径、来源技能

冲突输出示例：

```
### Conflicts
- ⚠️ Reference "security-guide" exists at different paths:
  /role-a/skills/review/references/security-guide.md vs
  /role-b/skills/audit/references/security-guide.md
```

#### 缺失技能检测

当请求的技能名在所有已加载角色中都不存在时，`renderMissingSkills`（`src/asset/skill-compose.ts:169-181`）列出缺失项。每个缺失技能显示为：

```
### Missing Skills
- ❌ security-audit not found in any loaded role
```

### 子代理技能继承

子代理可以声明自己的技能，这些技能也会被 `collectSkills`（`src/asset/skill-compose.ts:15-30`）递归收集。递归遍历子代理时，来源路径格式为 `parentRole/subAgentId`：

```yaml
# team-lead/role.yaml
subagents:
  - name: Researcher
    skills:
      - research-checklist    # 子代理独有技能
```

在组合分析中，该技能的 source 显示为 `team-lead/researcher`，便于定位技能来源。

## 调试与排查

### 常用调试命令

**检查角色完整性：**

```bash
rolebox info <role-name> --check   # 验证角色完整性哈希
```

`--check` 标志（`docs/cli.md:120`）会计算并验证角色的完整性哈希，确保所有声明文件（包括技能）与预期一致。

**查看解析日志：**

rolebox 的解析器会输出详细的调试日志。关键日志点包括：

| 日志级别 | 来源 | 触发条件 |
|---------|------|---------|
| `info` | `skill-resolver.ts:113` | 技能在所有候选路径中未找到 |
| `debug` | `skill-resolver.ts:102` | 技能文件存在但读取失败（如格式错误） |
| `info` | `reference-resolver.ts:151` | 显式引用的文件目标不存在 |
| `debug` | `reference-resolver.ts:88` | 引用文件读取失败 |

**显式设置日志级别：**

```bash
LOG_LEVEL=debug rolebox <command>   # 启用 debug 级日志以查看更多细节
```

### 常见加载错误

#### 1. 技能未找到（Not Found）

```
[skill-resolver] Skill "my-skill" not found. Searched:
  candidates: [
    ".../skills/my-skill/SKILL.md",
    ".../skills/my-skill.md",
    "...
  ]
```

**原因与修复：**

- **路径错误**：检查技能目录是否在正确的 `skills/` 目录下（角色本地或全局）
- **命名不匹配**：确保 role.yaml 中的名称与 SKILL.md 的 `name` 字段或目录名一致
- **文件名错误**：目录形式的技能必须包含 `SKILL.md` 文件（注意大小写）

#### 2. 文件读取失败

```
[skill-resolver] Failed to read skill file
  filePath: ".../skills/my-skill/SKILL.md"
  error: ...
```

**原因与修复：**

- **YAML 格式错误**：frontmatter 中的 YAML 语法不正确，使用 `js-yaml` 解析失败时静默回退为空描述（`skill-resolver.ts:100-103`）
- **编码问题**：文件不是 UTF-8 编码

#### 3. 引用文件不存在

```
[reference-resolver] Skipping reference "security-guide":
  file not found at "references/security-guide.md"
```

**原因与修复：**

- **路径错误**：引用路径相对于技能目录解析，确认文件确实在预期位置
- **文件缺失**：在 frontmatter 中声明了引用但忘记创建对应的文件，解析器会静默跳过（`reference-resolver.ts:148-152`），不会中断加载

#### 4. 引用路径冲突

使用 `|skill_compose|` 检测到冲突时：

```
### Conflicts
- ⚠️ Reference "guidelines" exists at different paths:
  ...
```

**原因与修复：**

- **同名不同文件**：两个技能各自声明了同名引用但指向不同物理文件
- **解决方案**：统一引用名或合并引用文档到共享位置，避免知识分裂

### 快速排查清单

当技能加载行为不符合预期时，依次检查：

1. **确认文件位置** — 技能文件是否在 `{roleDir}/skills/` 或 `~/.config/opencode/skills/` 下
2. **确认文件命名** — 目录形式需要 `SKILL.md`（注意大小写），单文件形式需要 `{name}.md`
3. **确认 role.yaml 注册** — `skills:` 字段中是否包含技能名
4. **验证 SKILL.md 格式** — frontmatter 是否以 `---` 包裹，YAML 是否合法
5. **检查引用路径** — `references:` 中的路径相对于技能目录是否正确
6. **运行 skill_compose** — 用组合分析工具确认技能和引用是否成功加载
7. **查看日志** — 启用 `LOG_LEVEL=debug` 观察解析器输出

## 技能注册

技能通过在 role.yaml 中声明 `skills` 字段注册：

```yaml
# role.yaml
skills:
  - review-checklist          # 从角色本地或全局技能目录加载
opencode_skills:             # 从 opencode 全局技能目录加载
  - humanizer
```

`skills:` 字段从角色本地 `{roleDir}/skills/` 和全局 `~/.config/opencode/skills/` 目录搜索。
`opencode_skills:` 字段仅从全局目录搜索，用于共享技能。

## 下一步

- [技能系统](/02-Guide/skills) — 技能解析顺序与加载机制
- [引用文档](/02-Guide/references) — 引用文档的自动发现与声明
- [创建角色](/02-Guide/create-a-role) — 完整的角色创建指南
