---
title: 引用文档
description: 引用（Reference）文档系统 — 自动发现、显式声明、技能级引用与解析机制
---

# 引用文档

> **相关文档：** [技能系统](/02-Guide/skills) — 按需加载的知识模块系统 | [编写技能](/02-Guide/authoring-skills) — 技能引用声明与自动发现 | [创建角色](/02-Guide/create-a-role) — 完整的角色创建指南

引用（Reference）是代理可以按需读取以获取上下文信息的深度知识文档。与技能（指令集）不同，引用提供原始领域知识 — 理论、规范、指南等。

## 为什么 References 重要

引用（Reference）是 rolebox 知识体系中的「知识层」，与技能（Skill）的「指令层」形成互补：

| 维度 | 技能（Skill） | 引用（Reference） |
|------|-------------|------------------|
| **本质** | 指令（Instructions） | 知识（Knowledge） |
| **激活方式** | 代理按需加载，注入到系统提示 | 自动列出在 `<available_references>` 中，代理按需读取 |
| **内容类型** | 可执行步骤、检查清单、工作流 | 原始领域知识、规范、理论文档 |
| **变更频率** | 随工作流调整而变化 | 相对稳定，随领域知识更新 |
| **受众** | 代理的执行指令 | 代理的决策依据 |

理解这一区分至关重要：**技能告诉代理怎么做，引用告诉代理需要知道什么。**

举例来说，一个代码审查角色可能有一个 `review-checklist` 技能（包含审查步骤），同时引用一份 `code-style-guide.md`（包含团队的编码标准）。技能驱动审查流程，引用提供审查所需的判断依据。这种分离确保了技能可以复用相同的知识，引用可以独立于具体的执行流程更新。

从系统设计角度看，引用机制还有几个关键价值：

- **提示词减负**：长篇领域知识放在引用中，代理只在需要时读取，避免系统提示膨胀
- **知识复用**：同一份引用可以被多个技能或多个角色共享（见[跨角色共享引用](#跨角色共享引用)）
- **关注点分离**：领域知识（引用）与执行逻辑（技能）解耦，各自独立演进

相关实现参考 `src/resolver/reference-resolver.ts` 中的描述推导链与缓存机制。

## 自动发现

将 Markdown 文件放置在 `references/` 目录中，它们会被自动发现：

```
my-role/
├── role.yaml
└── references/
    ├── api-spec.md
    └── theory/
        └── core-principles.md
```

`references/` 下的所有 `.md` 文件都会被递归发现。描述提取逻辑实现在 `src/resolver/reference-resolver.ts:46-91`：

### 描述推导链

描述按以下优先级生成（第 119-120 行）：

```
frontmatter.description（存在时）→ deriveDescriptionFromName(name) → 空字符串
```

1. **YAML frontmatter**（`extractFrontmatterDescription`，第 46-91 行）：读取文件内容，解析 `---` 包裹的 YAML，提取 `description` 字段。结果缓存在模块级 `descriptionCache` 中避免重复读取
2. **自动推导**（`deriveDescriptionFromName`，第 32-37 行）：将文件名中的连字符/下划线替换为空格，首字母大写。例如 `"core-principles"` → `"Core Principles"`
3. **回退**：如果前述均不可用，描述为空字符串

### 描述优先级链

描述的决定过程遵循三级优先级链。以下表格总结了每种来源的优先级、触发条件和示例：

| 优先级 | 来源 | 触发条件 | 示例结果 |
|--------|------|----------|----------|
| 1（最高） | frontmatter `description` | 文件包含 YAML frontmatter 且存在 `description` 字段 | `"API specification"` |
| 2 | `deriveDescriptionFromName(name)` | 无 frontmatter 或无 `description` 字段 | `"core-principles"` → `"Core Principles"` |
| 3（回退） | 空字符串 | 两者均不可用 | `""` |

实现逻辑位于 `src/resolver/reference-resolver.ts:119-120`：

```typescript
const description = frontmatterDesc ?? deriveDescriptionFromName(name);
```

`??` 运算符确保只要 frontmatter 返回了值（`extractFrontmatterDescription` 在无 frontmatter 时返回 `undefined`），就优先使用 frontmatter 的描述。自动推导仅在 `undefined` 时生效。

**名称推导**（`deriveNameFromPath`，第 21-26 行）：从相对路径中剥离扩展名和 `references/` 前缀。例如 `"references/theory/core-principles.md"` → `"theory/core-principles"`。

### 多层集成示例

以下目录展示了角色级、技能级和全局引用共同工作的场景：

```
my-role/
├── role.yaml                    # 角色配置
├── references/                  # 角色级引用（自动发现）
│   ├── api-spec.md
│   └── theory/
│       └── core-principles.md
├── skills/
│   ├── review-checklist/        # 技能级引用（自动发现）
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── security-guide.md
│   └── code-style/
│       └── SKILL.md             # 技能级引用（显式声明）
```

**引用解析结果**会合并为一个 `<available_references>` XML 块注入到系统提示中：

```xml
<available_references>
  Reference documents provide deep knowledge. Use the Read tool to load full content when needed.
  <reference>
    <name>api-spec</name>
    <path>/.../my-role/references/api-spec.md</path>
    <description>API specification</description>
  </reference>
  <reference>
    <name>theory/core-principles</name>
    <path>/.../my-role/references/theory/core-principles.md</path>
    <description>Core Principles</description>
  </reference>
  <reference>
    <name>security-guide</name>
    <path>/.../my-role/skills/review-checklist/references/security-guide.md</path>
    <description>Security review guidelines</description>
  </reference>
</available_references>
```

其中 `security-guide` 的描述来自 `review-checklist/SKILL.md` 的 `references:` 声明（如果文件不在 `references/` 目录中则必须显式声明）。

## 显式声明

在 `role.yaml` 中声明引用，用于 `references/` 之外的文件或提供自定义描述：

```yaml
references:
  api-spec: references/api-spec.md
  design-guide:
    path: docs/design-guide.md
    description: Internal design system documentation
```

### 何时使用显式声明

以下决策表帮助你判断在 `role.yaml` 或 SKILL.md frontmatter 中何时需要显式引用声明：

| 场景 | 是否需要显式声明 | 说明 |
|------|-----------------|------|
| 文件位于 `references/` 目录中 | 否 | 会被自动发现（`discoverReferences`） |
| 需要自定义描述文字 | 是（可选） | 不声明则使用 frontmatter 或自动推导描述 |
| 文件位于 `references/` 之外 | **是** | 自动发现不会搜索其他目录 |
| 需要覆盖同一文件的描述（如角色级覆盖技能级） | 是 | 显式声明的 `description` 会覆盖自动发现的值 |
| 引用外部路径（如 `docs/` 或父目录） | **是** | 仅在 `references/` 内的文件会被自动发现 |

**最佳实践：** 将大部分引用文件放在 `references/` 目录中由自动发现处理，只有当需要自定义描述或引用外部文件时才使用显式声明。

## 技能级引用

技能也可以拥有自己的引用：

```
skills/
└── my-skill/
    ├── SKILL.md
    └── references/
        └── domain-theory.md
```

在技能的 SKILL.md frontmatter 中声明的引用以相同方式工作：

```markdown
---
name: my-skill
description: Does something
references:
  theory: references/domain-theory.md
---
```

## 引用 vs 技能 vs 函数：如何选择

引用（Reference）、技能（Skill）和函数（Function）是 rolebox 三种核心知识注入机制。选择不当会导致提示词膨胀或知识不可达。以下三维对比帮助你决策：

| 维度 | 引用（Reference） | 技能（Skill） | 函数（Function） |
|------|------------------|--------------|------------------|
| **激活方式** | 自动注入 `<available_references>`，代理按需 `Read` | 代理通过 `skill` 工具按需加载 | 用户通过 `\|name\|` 语法显式激活 |
| **生命周期** | 始终存在于上下文中（仅名称和描述，内容按需读取） | 调用 `skill` 时注入全部内容到系统提示 | 激活时注入指令，仅持续当前消息或会话 |
| **用途** | 提供原始领域知识、规范、理论文档 | 提供可执行的操作指南、检查清单、工作流 | 提供可复用的行为模式、模式切换、参数化指令 |
| **存放位置** | `references/` 目录（自动发现）或 `role.yaml` 显式声明 | `skills/` 目录下的 `.md` 或 `SKILL.md` | `functions/` 目录下的 `.md` 文件（或全局/内置） |
| **内容特征** | 长篇参考文档，代理选择性阅读 | 中等长度，完整注入，含可执行步骤 | 短小精悍，聚焦单一行为模式 |
| **典型容量** | 数百行，不直接进入系统提示 | < 100 行（过长会稀释提示词） | < 50 行，聚焦单一职责 |

**选择建议：**
- 需要代理**了解但不一定执行**的知识 → **引用**（如 API 规范、架构文档）
- 需要代理**按步骤执行**的操作指南 → **技能**（如代码审查清单、发布流程）
- 需要用户**主动切换**的行为模式 → **函数**（如 `|review|` 进入审查模式）

## 实践模式

引用系统的真正威力在于组织方式。以下三种模式覆盖了从简单到复杂的引用管理场景。

### 跨技能引用链

当多个技能需要共享同一份领域知识时，将引用放在角色级 `references/` 下，而非在每个技能内重复：

```
code-reviewer/
├── role.yaml
├── references/                   # 角色级引用，所有技能共享
│   ├── code-style-guide.md       # 编码规范
│   ├── security-best-practices.md # 安全最佳实践
│   └── performance-guidelines.md  # 性能指南
└── skills/
    ├── review-checklist/         # 审查技能 — 引用编码规范
    │   └── SKILL.md
    ├── security-audit/           # 安全审计技能 — 引用安全最佳实践
    │   └── SKILL.md
    └── perf-review/             # 性能审查技能 — 引用性能指南
        └── SKILL.md
```

在此结构中，`code-style-guide.md` 被 `review-checklist` 和 `security-audit` 两个技能共享。代理加载任一技能时，都能在 `<available_references>` 中看到该引用。

**适用场景：** 角色有多个技能但面向同一领域（如代码质量），各技能需要引用共同的领域标准。引用链的传递路径是：角色级引用 → 所有技能均可见，无需在每个技能的 SKILL.md 中重复声明。

### 跨角色共享引用

当多个角色需要引用同一份知识文档（如团队风格指南）时，有两种方式实现共享：

**方式一：全局引用目录（推荐）**

将共享引用放在全局配置目录中，多个角色通过显式声明引用：

```
~/.config/opencode/
└── rolebox/
    ├── shared-references/        # 共享引用目录
    │   └── style-guide.md        # 团队风格指南
    ├── frontend-dev/
    │   └── role.yaml
    └── backend-dev/
        └── role.yaml
```

在 `frontend-dev/role.yaml` 中：

```yaml
references:
  style-guide: ../shared-references/style-guide.md
```

在 `backend-dev/role.yaml` 中：

```yaml
references:
  style-guide: ../shared-references/style-guide.md
```

两个角色引用同一份 `style-guide.md` 文件。更新文件时，所有引用该文件的角色自动获得最新内容。这是最常见的「风格指南模式」—— 组织级别的编码规范、API 命名约定、文档模板等。

### 引用组合构建复杂领域

对于复杂的专业知识领域（如架构设计、安全合规），单一引用文件可能过于庞大。使用引用组合将知识拆分为层次化的模块：

```
references/
├── architecture/
│   ├── overview.md               # 总体架构概览（高层面描述）
│   ├── data-layer.md             # 数据层设计
│   ├── api-design.md             # API 设计规范
│   └── deployment.md             # 部署架构
├── standards/
│   ├── naming-conventions.md      # 命名规范
│   ├── error-handling.md         # 错误处理规范
│   └── logging.md                # 日志规范
└── compliance/
    ├── security-requirements.md   # 安全合规要求
    └── data-privacy.md           # 数据隐私规范
```

代理面对这些引用时，会根据当前任务选择读取哪些文件。例如，在设计 API 时，代理可能先读取 `architecture/api-design.md` 了解总体方向，再读取 `standards/naming-conventions.md` 了解命名约束。

**组合的关键原则：**

1. **横向分层**：按知识领域分组（架构/标准/合规），每个子目录聚焦一个维度
2. **纵向聚焦**：每个文件只讲一件事，文件名清晰体现内容（`error-handling.md` 只讲错误处理）
3. **粒度适中**：每个文件 100-300 行，避免代理因文件过大而不愿读取
4. **文件名可推导**：使用 `kebab-case` 命名，自动推导的描述应为有意义的短语（如 `"architecture/api-design"` 会推导为 `"Api Design"`，建议在 frontmatter 中显式声明为 `"API Design Specification"`）

这种模式在架构角色中尤其常见 — 参见[创建角色](/02-Guide/create-a-role)中的复杂角色模板。

### 完整示例：style-guide.md 在代码审查角色中的应用

以下是一个完整的实际场景：团队风格指南被嵌入到代码审查角色中，影响多个技能的行为。

**第一步：创建引用文件**

```markdown
---
title: 团队代码风格指南
description: 团队的编码规范、命名约定和最佳实践
---

# 团队代码风格指南

## 命名规范
- 使用 camelCase 命名变量和函数
- 使用 PascalCase 命名类和类型
- 常量使用 UPPER_SNAKE_CASE

## React 组件规范
- 使用函数组件 + Hooks
- Props 使用 TypeScript interface 声明
- 避免默认导出

## 错误处理
- 使用 try/catch 而非回调
- 用户可见错误需国际化
```

**第二步：将引用链接到角色**

放在 `references/` 目录中自动发现：

```
code-reviewer/
├── role.yaml
├── references/
│   └── style-guide.md            # 团队风格指南
└── skills/
    └── review-checklist/
        └── SKILL.md
```

**第三步：多个技能引用同一指南**

在 SKILL.md 中，代理会自然引用风格指南作为审查标准：

```markdown
---
name: review-checklist
description: Comprehensive code review checklist
---

# 代码审查清单

审查时参考团队风格指南（`style-guide`）中的以下标准：

1. 命名是否符合团队的 camelCase / PascalCase 约定
2. 组件结构是否符合函数组件 + Hooks 模式
3. 错误处理是否使用了 try/catch
```

代理在执行审查任务时，会自动读取 `<available_references>` 中的 `style-guide`，获取团队的具体规范。

**第四步：扩展 — 跨角色共享同一指南**

如果前端团队和后端团队共用同一风格指南，只需在各自的 `role.yaml` 中指向同一文件（见[跨角色共享引用](#跨角色共享引用)）。风格指南更新一次，所有角色自动同步。

这种模式的威力在于：引用（知识）与技能（指令）解耦 — 你可以更新风格指南而不用修改审查技能，也可以为不同团队配不同的风格指南而审查流程不变。

## 解析机制

- 角色级引用从 `{roleDir}/references/` 中发现
- 技能级引用从 `{roleDir}/skills/{name}/references/` 中发现
- 对于同一文件，显式声明会覆盖自动发现的描述
- 所有引用都会在 `<available_references>` 块中呈现给代理

::: warning
在 `role.yaml` 或 SKILL.md frontmatter 中声明 `references` 条目时，如果提供了显式的 `description` 字段，该值会**优先于**文件 frontmatter 中的 `description` 和自动推导的描述。此覆盖逻辑实现在 `src/resolver/reference-resolver.ts:162-168`：

```typescript
if (entry.description) {
  description = entry.description;
} else {
  const frontmatterDesc = await extractFrontmatterDescription(filePath);
  description = frontmatterDesc ?? deriveDescriptionFromName(name);
}
```

这意味着即使引用文件自身的 frontmatter 发生变化，`role.yaml` 中声明的描述也会保持不变。如需更新描述，请同时更新两处或移除 `role.yaml` 中的显式 `description`。
:::

### 引用文档最佳实践

以下命名和结构规范有助于保持引用系统的可维护性：

| 实践 | 推荐 | 说明 |
|------|------|------|
| **命名风格** | `kebab-case` | 使用连字符分隔单词（如 `api-spec.md`、`code-style-guide.md`）。避免下划线、驼峰或空格。自动推导的描述会将连字符转为空格（`"code-style-guide"` → `"Code Style Guide"`） |
| **文件大小** | < 500 行 | 单个引用文件超过 500 行时，代理可能不会完整阅读。对于长篇文档，拆分为多个聚焦的引用文件，并在文件名中体现层次（如 `database-schema.md`、`database-queries.md`） |
| **目录嵌套** | ≤ 2 层 | 在 `references/` 下最多使用两级子目录（如 `references/theory/core-principles.md`）。超过两层会增加引用名称长度（从 `theory/core-principles` 变为 `theory/deep/core/principles`），降低可读性 |
| **目录组织** | 按主题分组 | 使用子目录对相关引用归类。例如 `references/api/`、`references/architecture/`、`references/standards/` |
| **描述声明** | 优先 frontmatter | 在每个引用文件的 YAML frontmatter 中提供 `description` 字段，这样描述对用户和管理工具都可见 |

引用系统在设计上考虑了角色加载的性能开销，主要在以下环节进行优化：

**1. 描述缓存**

`extractFrontmatterDescription`（第 46-91 行）使用模块级 `descriptionCache`（`Map<string, Promise<string | undefined>>`）以文件绝对路径为键缓存已解析的 frontmatter 描述。同一文件在 `discoverReferences` 中被读取后，后续的 `resolveExplicitReferences` 不会再重复读取文件。缓存容量上限为 500 条（第 55-57 行），超出时自动清空以防止内存泄漏。

**2. 批量 glob 发现**

`discoverReferences()`（第 97-128 行）使用 `fast-glob` 的 `**/*.md` 模式一次性扫描整个 `references/` 目录，并通过 `Promise.all` 并行读取所有文件。这种方式相比逐文件检测，减少了 I/O 延迟的影响。

**3. 合并去重**

`resolveAllReferences()`（第 184-216 行）以 `filePath` 为键维护一个 `Map`，自动发现的引用先加入，显式声明的引用后覆盖。Map-based 合并（第 201-211 行）是 O(n) 操作，避免了嵌套循环和复杂的数据结构比较。

## 常见问题排查

引用系统的问题通常归结为三类：文件不可达、描述不匹配、声明未生效。以下是最常见的场景和排查方法。

### 引用文件未出现在 `<available_references>` 中

**症状：** 代理的系统提示中没有预期的引用条目。

**排查步骤：**

1. **检查文件位置**：文件必须在 `{roleDir}/references/` 目录下才能被自动发现（`discoverReferences` 使用 `fast-glob` 的 `**/*.md` 模式在 `references/` 下搜索，第 97-128 行）。文件放在同目录但不在 `references/` 下则不会被自动发现
2. **检查显式声明路径**：如果在 `role.yaml` 中显式声明，确认 `path` 相对于 `role.yaml` 所在目录。路径以引用文件的实际磁盘位置为准。如果路径指向不存在的文件，解析器会记录 `"Skipping reference ...: file not found at ..."` 日志并跳过该条目（第 148-153 行）
3. **检查 `.md` 扩展名**：自动发现只匹配 `**/*.md` 文件，非 Markdown 文件不会被发现。如需引用图片或其他格式，需在 `role.yaml` 中显式声明
4. **重启生效**：修改 `references/` 目录或 `role.yaml` 后，需要重启 opencode 或触发角色热重载

### 描述显示异常

**症状：** 引用文件的描述是意外的英文短语或空字符串。

**可能的根因：**

1. **缺少 frontmatter**：如果文件没有 YAML frontmatter（`---` 包裹的头部），描述由 `deriveDescriptionFromName` 从文件名自动推导（第 32-37 行）。例如 `security-best-practices.md` 会显示为 `"Security Best Practices"` — 如果文件名不能清晰表达内容，建议添加 frontmatter
2. **frontmatter 解析失败**：如果 YAML 格式错误（如缩进不正确、缺少闭合 `---`），`extractFrontmatterDescription` 会返回 `undefined`，回退到自动推导。检查文件的 frontmatter 是否严格遵循 YAML 规范
3. **前端空白符**：`extractFrontmatterDescription` 使用 `trimStart()` 处理文件内容（第 70 行）。如果文件以非 `---` 开头（如 BOM 或多余的空白符），frontmatter 将不会被识别

### 显式声明未覆盖预期

**症状：** 在 `role.yaml` 中声明了自定义描述，但代理看到的仍然是自动推导的描述。

**排查：**

- 确认声明的引用名称是否与自动发现产生的名称一致。自动发现从路径推导名称（`deriveNameFromPath`，第 21-26 行），例如 `references/api-spec.md` 的名称为 `api-spec`。显式声明的 key 必须与之完全相同才能覆盖
- 描述覆盖逻辑（第 162-168 行）仅在显式声明提供了 `description` 字段时才生效。如果声明为 `api-spec: references/api-spec.md`（无 description），则仍然使用文件的 frontmatter 或自动推导
- 如果存在同名的自动发现条目和显式声明条目，最终描述由 `resolveAllReferences` 的 Map-based 合并决定（第 201-211 行）：后处理（显式声明）覆盖先处理（自动发现），但仅在**同一文件路径**时才覆盖。如果文件路径不同，两个条目并存

### 技能级引用未被识别

**症状：** 技能有自己的 `references/` 目录，但引用未出现在 `<available_references>` 中。

**排查：**

1. 技能引用只在其父角色加载该技能后才被解析。如果角色 `role.yaml` 的 `skills` 列表中没有包含该技能，其引用不会被加载
2. 技能级引用文件的自动发现路径是 `{roleDir}/skills/{skillName}/references/`（第 173-174 行）。文件放在 `skills/{skillName}/` 下但不在 `references/` 中时，不会被自动发现
3. 如果技能是单文件形式（如 `skills/review-checklist.md` 而非 `skills/review-checklist/SKILL.md`），则不支持技能级引用。使用目录形式（含 `SKILL.md` 和 `references/`）才能使用此功能

### 引用文件修改后代理仍使用旧内容

**症状：** 更新了引用文件的 Markdown 内容，但代理仍然依据旧内容工作。

**可能原因：** 引用内容按需读取 — `<available_references>` 中只包含名称和描述。代理在运行时通过 `Read` 工具读取文件内容。如果代理在之前的消息中已经读取过该文件，其内部可能缓存了旧内容。可以要求代理重新读取引用文件，或开始一个新的会话。重启 opencode 始终是最干净的解决方案。

---

## 综合架构参考

引用系统不是孤立的。它与 rolebox 的以下子系统紧密相关 — 理解这些关联有助于在设计角色时做出更好的决策：

| 子系统 | 关联方式 | 相关文档 |
|--------|----------|----------|
| **技能系统** | 技能可以拥有自己的引用；引用为技能提供领域知识 | [技能系统](/02-Guide/skills) • [编写技能](/02-Guide/authoring-skills) |
| **函数系统** | 函数不直接使用引用，但可通过 role.yaml 共享同一引用池 | [函数系统](/02-Guide/functions) |
| **子代理** | 父角色的引用对子代理不可见 — 子代理需有自己的引用声明 | [子代理](/02-Guide/subagents) |
| **角色创建** | `references` 是 role.yaml 的可选字段，显式声明引用文件 | [创建角色](/02-Guide/create-a-role) |

来源：rolebox README 特性表（`README.md:276-297`）。

## 下一步

- [技能系统](/02-Guide/skills) — 了解按需加载的知识模块系统
- [编写技能](/02-Guide/authoring-skills) — 了解技能的引用声明与自动发现机制
- [创建角色](/02-Guide/create-a-role) — 了解如何创建和配置 rolebox 角色
- [子代理](/02-Guide/subagents) — 子代理中的引用可见性
