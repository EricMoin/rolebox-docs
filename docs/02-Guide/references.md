---
title: 引用文档
description: 引用的自动发现与显式声明、名称与描述的来源、技能级引用、解析机制与排错
---

# 引用文档（Reference Documents）

引用（Reference）是代理按需读取的深度知识文档：系统提示只列出名称、路径与描述，代理需要时才用 Read 工具读取全文，与技能一样遵循渐进式披露。本页说明引用放在哪、怎么声明、名称与描述从哪里来、与技能和函数如何分工，以及没有出现在系统提示里时怎么查。

> 相关：[技能系统](/02-Guide/skills)｜[编写技能](/02-Guide/authoring-skills)｜[创建角色](/02-Guide/create-a-role)

## 最小示例：把团队风格指南变成引用

放在角色目录的 `references/` 下即可，不需要在 `role.yaml` 里声明：

```text
code-reviewer/
├── role.yaml
├── references/
│   └── style-guide.md
└── skills/
    └── review-checklist/
        └── SKILL.md
```

`references/style-guide.md`：

```markdown
---
description: 团队的编码规范、命名约定与最佳实践
---

# 团队代码风格指南

## 命名
- 变量与函数用 camelCase
- 类与类型用 PascalCase
- 常量用 UPPER_SNAKE_CASE

## 错误处理
- 使用 try/catch 而非回调
- 用户可见错误需要国际化
```

先确认文件确实在自动发现会扫描的目录里：

```bash
ls code-reviewer/references
```

```text
应看到（此目录下的 Markdown 都会被加载）：

style-guide.md
```

重启宿主或触发热重载后，让代理用 `reference_search` 检索它的内容：

```text
reference_search(query="camelCase")
```

```text
应看到（示例输出，路径随实际角色目录变化）：

## Reference Search Results: "camelCase"

Found 1 match(es) across 1 file(s).

### style-guide (code-reviewer)
File: /home/you/rolebox/code-reviewer/references/style-guide.md:6

  ## 命名
> **- 变量与函数用 camelCase**
  - 类与类型用 PascalCase
```

能搜到，说明这条引用已经进入角色的引用集合；代理执行任务时会按需读取它的正文。

## 引用的两种来源

### 自动发现

`references/` 目录下的每个 `.md` 都会被递归发现，包括子目录：

```text
references/
├── style-guide.md
└── theory/
    └── core-principles.md
```

不需要注册，也不需要声明——放进去就是一条引用。

### 显式声明

需要引用 `references/` 之外的文件，或需要自定义描述时，在 `role.yaml` 里声明：

```yaml
references:
  style-guide: references/style-guide.md       # 简写：只给路径
  design-guide:
    path: docs/design-guide.md                 # 路径相对 role.yaml 所在目录
    description: 内部设计系统文档
```

| 场景 | 需要显式声明吗 | 说明 |
|---|---|---|
| 文件在 `references/` 中 | 否 | 自动发现 |
| 文件在 `references/` 中，但想要自定义描述 | 可选 | 声明的 `description` 覆盖自动值 |
| 文件在 `references/` 之外 | 是 | 自动发现只扫描 `references/` |
| 引用父目录或绝对路径下的共享文档 | 是 | `path` 可以指向任意位置 |

两个来源会合并成同一个引用集合，去重按**文件路径**进行，显式声明优先。

要让多个角色共享同一份文档（例如团队风格指南），无需复制文件：让每个角色在各自 `role.yaml` 中用显式声明指向同一条路径即可，`path` 可以指向角色目录之外，例如 `../shared-references/style-guide.md`。文档只维护一份，所有声明它的角色都会读到最新内容。

## 名称与描述

### 名称从哪来

| 来源 | 名称 |
|---|---|
| 自动发现 | 相对 `references/` 的路径去掉扩展名，例如 `style-guide`、`theory/core-principles` |
| 显式声明 | YAML 的 key，例如 `style-guide` |

### 描述的三级优先级

| 优先级 | 来源 | 触发条件 | 示例 |
|---|---|---|---|
| 1 | 显式声明的 `description` | 声明中写了该字段 | `内部设计系统文档` |
| 2 | 文件 frontmatter 的 `description` | 文件以 `---` 开头且含该字段 | `API specification` |
| 3 | 从文件名推导 | 前两者都不可用 | `core-principles` → `Core Principles` |

第 3 级只看名称的最后一段（文件名部分）：连字符与下划线换成空格，每个单词首字母大写。文件名不足以说明内容时，在文件里补一行 frontmatter `description`。

## 技能级引用

技能也可以拥有自己的引用，解析基准是技能目录：

```text
code-reviewer/skills/review-checklist/
├── SKILL.md
└── references/
    └── security-guide.md
```

- 自动发现扫描 `{技能目录}/references/`，规则与角色级完全相同。
- 显式声明写在 SKILL.md 的 frontmatter 中，`path` 相对技能目录（写法见[编写技能](/02-Guide/authoring-skills)）。
- 技能级引用随技能一起解析，最终并入该角色的引用集合，与角色级引用一起呈现给代理。

## 引用 vs 技能 vs 函数

| 维度 | 引用（Reference） | 技能（Skill） | 函数（Function） |
|---|---|---|---|
| 放什么 | 原始领域知识、规范、长文档 | 可执行的操作指南、检查清单 | 行为模式与状态机 |
| 怎么触发 | 系统提示列出名称与描述，代理按需读取 | 代理判断需要时用技能工具加载正文 | 用户用 `\|名称\|` 激活 |
| 何时进上下文 | 只有名称与描述常驻 | 加载后整篇进入上下文 | 激活期间指令常驻 |
| 典型体量 | 数百行 | 100 行以内 | 50 行以内，聚焦单一职责 |
| 存放位置 | `references/`（角色级或技能级） | `skills/` | `functions/` |

选择办法：**代理需要知道、但不必照做的知识 → 引用；代理需要照着做的步骤 → 技能；用户要主动切换的行为模式 → 函数。** 技能与函数之间的进一步取舍见[技能系统](/02-Guide/skills)。

## 解析机制

角色加载时，引用解析按下面的顺序进行：

1. 递归发现角色目录 `references/` 下的全部 Markdown，为每条算出名称与描述。
2. 读 `role.yaml` 的显式声明，路径相对角色目录解析；文件不存在的条目记一条日志后跳过。
3. 两个来源按绝对文件路径合并：同一路径以显式声明为准（名称与描述都取声明的），其余条目追加。
4. 结果按名称排序，保证每次加载的输出稳定。
5. 角色级引用与各技能的引用一起，渲染成系统提示中的 `<available_references>` 块。

```xml
<available_references>
  Reference documents provide deep knowledge. Use the Read tool to load full content when needed.
  <reference>
    <name>style-guide</name>
    <path>/home/you/rolebox/code-reviewer/references/style-guide.md</path>
    <description>团队的编码规范、命名约定与最佳实践</description>
  </reference>
  <reference>
    <name>security-guide</name>
    <path>/home/you/rolebox/code-reviewer/skills/review-checklist/references/security-guide.md</path>
    <description>Security review guidelines</description>
  </reference>
</available_references>
```

代理看到的只有这些元数据，正文由它自己决定何时读取。需要定位具体内容时，代理可以用 `reference_search` 在所有已加载角色与子代理的引用文档里做全文检索，不必逐个文件打开。

**子代理的引用**：子代理会继承父角色的引用，并自动发现自己目录 `subagents/{slug}/references/` 下的引用；子代理没有自己的 `references:` 声明字段，额外的引用随它的技能声明一起带入。

## 组织建议

| 实践 | 建议 | 理由 |
|---|---|---|
| 命名 | `kebab-case` | 自动推导出的描述可读：`code-style-guide` → `Code Style Guide` |
| 单文件体量 | 500 行以内 | 过长时代理可能只读一部分；按主题拆分 |
| 目录层级 | 不超过两层 | 名称会带上目录前缀，层级越深越难引用 |
| 目录组织 | 按主题分组 | `references/architecture/`、`references/standards/` |
| 描述 | 每个文件都写 frontmatter `description` | 显式、可检索，不依赖文件名推导 |

## 常见问题排查

### 引用没有出现在 `<available_references>` 里

1. **是不是在 `references/` 下** —— 自动发现只扫描这个目录；放在角色目录的其它位置不会被加载。
2. **显式声明的路径对不对** —— `path` 相对 `role.yaml`（技能级相对技能目录）解析；文件不存在时该条被跳过，日志里留下 `Skipping reference "…": file not found at "…"`。
3. **扩展名是不是 `.md`** —— 自动发现只匹配 Markdown；其它格式必须显式声明。
4. **有没有重新加载** —— 改过 `references/` 或 `role.yaml` 后，要重启宿主或触发热重载才会生效。

### 描述不是预期的文字

- 文件没有 frontmatter，或 frontmatter 不在文件开头（`---` 之前只允许空白字符）。
- YAML 语法有误（缩进、缺少闭合的 `---`）时按「无描述」处理，回退到文件名推导。
- 文件名推导结果不理想（`api-spec` → `Api Spec`）时，在文件里补 frontmatter `description`。

### 显式声明没有覆盖自动发现

- **覆盖按文件路径匹配，不看名称**：声明指向的文件必须与自动发现的是同一个；路径不同则两条并存。
- 只写路径、不写 `description` 时，描述仍来自文件 frontmatter 或文件名推导。
- 声明与自动发现指向同一文件时，最终名称取声明的 key——想让名称保持自动推导的结果，key 就写成 `api-spec` 这样的推导名，而不是 `references/api-spec`。

### 技能级引用没有被识别

- 技能必须在 `role.yaml` 的 `skills:` / `opencode_skills:` 中声明；未声明的技能不会被解析，它的引用也不会加载。
- 技能级引用的目录是 `{技能目录}/references/`；放在技能目录下但不在 `references/` 里的文件不会被自动发现。
- 单文件形式的技能没有自己的目录，解析基准退化为 `skills/` 目录本身。需要技能级引用时请改用目录形式。

### 改过文件，代理仍按旧内容工作

引用正文由代理按需读取，`<available_references>` 里只有名称与描述。代理在早前回合读过的内容可能留在它的上下文里：让它重新读取该文件，或开始一个新会话；重启宿主最彻底。

另外，文件 frontmatter 中的描述在同一进程内按绝对路径缓存——改完描述后不重启，可能仍显示旧值。

## 备注

> 自 v0.6.0 起，rolebox 支持 `references/` 自动发现、`role.yaml` 显式声明与技能级引用。

## 下一步

- [技能系统](/02-Guide/skills) —— 技能如何被加载、解析与排查
- [编写技能](/02-Guide/authoring-skills) —— SKILL.md 字段与技能级引用声明
- [创建角色](/02-Guide/create-a-role) —— role.yaml 的完整写法
