---
title: 编写技能
description: 从零写一个 SKILL.md —— frontmatter 字段、技能级引用、组合与去重、验证与排错
---

# 编写技能（Authoring Skills）

技能（Skill）是一份带 YAML frontmatter 的 Markdown：系统提示只取其中的名称与描述，正文在代理需要时才加载。本页面向技能作者，先走一遍「建目录 → 写 SKILL.md → 声明 → 验证」的最小流程，再逐个说明 frontmatter 字段、技能级引用、多技能的组合与去重，以及写错时怎么查；技能由谁加载、按什么顺序解析见[技能系统](/02-Guide/skills)。

> 相关：[技能系统](/02-Guide/skills)｜[引用文档](/02-Guide/references)｜[创建角色](/02-Guide/create-a-role)

## 最小示例：5 分钟做一个技能

下面的例子给 `code-reviewer` 角色加一个带引用文档的 `code-review-checklist` 技能。

### 1. 建目录

```bash
mkdir -p code-reviewer/skills/code-review-checklist/references
find code-reviewer/skills/code-review-checklist
```

```text
应看到：

code-reviewer/skills/code-review-checklist
code-reviewer/skills/code-review-checklist/references
```

### 2. 写 SKILL.md

`code-reviewer/skills/code-review-checklist/SKILL.md`：

```markdown
---
name: code-review-checklist
description: 代码审查清单 — 检查正确性、安全性、性能
references:
  security-guide: references/security-guide.md
---

# Code Review Checklist

## 正确性
- 是否处理了所有边界情况（空输入、极值、并发竞态）？
- 错误路径是否被妥善处理（重试、回退、降级）？

## 安全性
- 输入是否在服务端验证并清理？
- 是否存在注入漏洞（SQL / XSS / 命令注入）？
- 敏感信息是否被硬编码？

## 性能
- 是否存在 N+1 查询或冗余循环？
- 缓存策略是否合理？
```

### 3. 写引用文档

`code-reviewer/skills/code-review-checklist/references/security-guide.md`：

```markdown
---
description: OWASP 驱动的安全审查规则，覆盖认证、授权、输入验证与数据保护
---

# 安全审查指南

## 认证与授权
- 是否使用标准认证机制（OAuth 2.0 / OpenID Connect）？
- 权限检查是否在每个端点执行，而不只是前端隐藏？

## 输入验证
- 是否对文件上传做了类型与大小限制？
- 是否存在 SSRF 或路径遍历风险？

## 数据保护
- 敏感数据在传输与存储时是否加密？
- 日志中是否可能泄漏个人身份信息？
```

这个文件放在技能的 `references/` 目录里，会被自动发现；上一步在 frontmatter 中再次声明它，是为了给它一个更精确的描述（也可省略声明，效果只是描述不同）。

### 4. 在 role.yaml 中声明

```yaml
# code-reviewer/role.yaml
name: Code Reviewer
description: 代码审查专家
skills:
  - code-review-checklist
```

### 5. 验证

```bash
rolebox sync opencode
rolebox status
```

```text
应看到（示例输出，角色数量与路径随实际环境变化）：

Rolebox v1.9.0

Installed Roles
──────────────────────────────────────────────────
  ✓ code-reviewer             1.0.0    (oh-my-role)  → synced

OpenCode Integration
──────────────────────────────────────────────────
  Plugin       ✓ registered
  Sync target  ~/.config/opencode/rolebox
  Synced       1/1 roles
  Skill symlinks (2):
    ✓ all valid
```

验证要点：

1. **名称一致** —— 目录名、`role.yaml` 中声明的名称、frontmatter 的 `name` 三者写法一致（目录名与声明名必须逐字符相同，大小写敏感）。
2. **描述非空** —— `description` 会出现在系统提示的 `<available_skills>` 中，空描述等于让代理盲选。
3. **引用可达** —— `references:` 中的路径相对技能目录，写错时该条被静默跳过。
4. **组合无冲突** —— 用 `skill_compose` 跑一次组合分析（见下文）。

## SKILL.md 的 frontmatter

把所有字段都写上的样子：

```yaml
---
name: code-review-checklist
description: 代码审查清单 — 检查正确性、安全性、性能
model: gpt-4                       # 可选
license: MIT                       # 可选
compatibility: opencode            # 可选
allowed-tools: Read, Grep, Glob    # 可选
references:                        # 可选
  security-guide: references/security-guide.md
  team-standards:
    path: ../../references/standards.md
    description: 团队编码规范
---
```

| 字段 | 类型 | rolebox 是否据此改变行为 | 说明 |
|---|---|---|---|
| `description` | string | 是 | 显示在系统提示的 `<available_skills>` 与组合分析输出中；缺失时为空字符串 |
| `references` | object | 是 | 技能级引用声明，见下一节 |
| `name` | string | 否 | 技能名以 `role.yaml` 的声明为准，文件按该名称命名即可 |
| `model` / `license` / `compatibility` | string | 否 | 按 SKILL.md 的通行约定保留的元数据 |
| `allowed-tools` | string \| array | 否 | 同上；是否生效取决于读取技能目录的 harness，rolebox 不解释它 |

frontmatter 必须从文件开头开始（允许前导空白），用一对 `---` 包裹。YAML 解析失败时不会报错：该技能按「没有 frontmatter」处理，描述为空，正文照常加载。

## 技能级引用

技能可以带自己的 `references/` 目录，并在 frontmatter 里声明额外的引用：

```yaml
---
references:
  security-guide: references/security-guide.md
  team-standards:
    path: ../../references/standards.md
    description: 团队编码规范
---
```

- `path` 相对于**技能目录**解析，可以指向目录外的共享文档。
- 简写形式只写路径；对象形式可以带 `description`，它会覆盖该文件自身 frontmatter 中的描述。
- `references/` 目录下的 `.md` 会被递归自动发现，不必声明——声明只用于补充描述或引用目录外的文件。
- 单文件形式的技能没有自己的目录，解析基准退化为 `skills/` 目录本身（引用要写成 `references/x.md`，实际指向 `skills/references/x.md`）。需要技能级引用时请用目录形式。

自动发现、描述推导与去重的完整规则见[引用文档](/02-Guide/references)。

## 组合与去重

### 一个角色可以有多个技能

```yaml
skills:
  - code-review-checklist    # 代码审查
  - security-audit           # 安全审计
  - performance-review       # 性能分析
```

代理按任务内容自行决定加载哪几个。技能之间的重叠由组合分析发现：

```text
skill_compose(skill_names=["code-review-checklist", "security-audit"], check_conflicts=true)
```

```text
应看到（示例输出，路径与来源随实际角色变化）：

## Skill Composition Analysis

**Requested:** code-review-checklist, security-audit

### Found Skills

| Skill | Source | References Count |
|-------|--------|-----------------|
| code-review-checklist | code-reviewer | 1 |
| security-audit | code-reviewer | 2 |

### Combined References (deduplicated)

| Name | Description | Source Skills |
|------|-------------|--------------|
| security-guide | OWASP 驱动的安全审查规则，覆盖认证、授权、输入验证与数据保护 | code-review-checklist |
| threat-model | 威胁建模模板 | security-audit |

### Conflicts

No conflicts detected.

**Summary:** 2 skills found, 2 unique references, 0 conflicts, 0 missing.
```

### 去重与冲突规则

- **按绝对路径去重**：多个技能引用同一份文件时，组合结果只保留一条，并把所有来源技能名列在一起。
- **同名不同路径 = 冲突**：两个技能都声明了名为 `guidelines` 的引用，但指向不同文件时，输出中出现以 `⚠️` 开头的冲突行，列出所有涉及的路径与来源技能。
- **缺失技能**：请求了但任何已加载角色都没有的技能，单独列在 `Missing Skills` 中（形如 `❌ security-audit not found in any loaded role`）；一个都没匹配上时，工具直接返回 `No matching skills found for: ...`。
- **跨角色复用**：每个角色独立解析自己的技能，互不影响。要让多个角色共享同一技能，把技能放到全局技能目录（各 harness 的取值见[技能系统](/02-Guide/skills)），再在各角色的 `skills:` 中声明同名技能。

### 子代理的技能

子代理可以在自己的 `subagents:` 条目里声明技能：

```yaml
subagents:
  - name: Researcher
    description: 资料调研
    prompt: You research topics and summarize findings.
    skills:
      - research-checklist
```

在组合分析里，这类技能的 `Source` 是技能所属代理的完整 id 路径（形如 `{roleId}/{subAgentId}`；子代理 id 自带父级前缀，例如 `emperor/emperor--jinyiwei`），便于定位技能来自哪个角色或子代理。技能文件从 `subagents/{slug}/skills/` 解析，该目录不存在时回退到角色目录的 `skills/`。

## 测试技能

技能写完到确认可用，中间有几步可以分别验证：

| 手段 | 能证明什么 |
|---|---|
| `rolebox info <role>` | 技能名已在 `skills:` / `opencode_skills:` 中声明 |
| `rolebox status` | harness 技能目录中的链接都指向真实文件（`all valid`，出现 `(broken)` 即为断链） |
| `skill_compose` | 组合内引用可去重、无同名不同路径冲突、无缺失技能 |
| `asset_validate` | 已加载角色的引用路径都存在——引用文件被删或改名时会报出来 |
| `asset_inspect` | 按名称与类型读回某个资产解析出的 frontmatter，例如 `asset_inspect(name="code-review-checklist", type="skill")` |
| 会话内实测 | 代理真的会为某个任务加载这个技能，并遵循其中的指令 |

前两项用 CLI 跑（见上面的最小示例），后四项由代理在会话中调用。

`rolebox info <role> --check` 会把角色目录的完整性哈希与安装时记录的指纹比对，用于确认文件没有被意外改动；本地改过角色（新增技能、改过 PROMPT.md 等）之后它必然报 `Integrity check FAILED`，这是预期结果，不代表技能写错了。

## 排错

### 技能未找到

```text
日志中的一条记录（JSON 行，节选）：

{"0":"Skill \"code-review-checklist\" not found. Searched:","1":{"candidates":[".../skills/code-review-checklist/SKILL.md",".../skills/code-review-checklist.md"]},"_meta":{"name":"skill-resolver","logLevelName":"INFO"}}
```

- **目录名不符**：目录形式要求目录名与声明名逐字符相同（大小写敏感）。
- **文件名不对**：目录形式必须包含 `SKILL.md`，单文件形式必须是 `{name}.md`。
- **放错位置**：先查角色本地 `{roleDir}/skills/`，再查全局技能目录；两者都没有就跳过。

### 文件读取失败

```text
日志中的一条记录（节选）：

{"0":"Failed to read skill file","1":{"filePath":".../skills/code-review-checklist/SKILL.md","error":{...}},"_meta":{"name":"skill-resolver","logLevelName":"DEBUG"}}
```

- **YAML 语法错误**：frontmatter 不是合法 YAML 时按无 frontmatter 处理，描述为空；用 `asset_inspect` 读回可见。
- **编码问题**：文件不是 UTF-8。

### 引用文件不存在

```text
日志中的一条记录（节选）：

{"0":"Skipping reference \"security-guide\": file not found at \"references/security-guide.md\"","_meta":{"name":"reference-resolver","logLevelName":"INFO"}}
```

- **路径基准错**：`path` 相对技能目录，不是相对角色目录。
- **声明了但没建文件**：该条被静默跳过，技能正文照常加载；用 `asset_validate` 可以把这类断链一次性列出来。

### 引用路径冲突

组合分析出现 `⚠️ Reference "guidelines" exists at different paths` 时，说明两个技能各自维护了同名但不同文件的引用：

- **合并**：把两份文档合成一份放在共享位置（例如角色级 `references/`，或一个两处都能用显式声明指向的公共目录），两边都改成同一条路径。
- **改名**：如果两份文档确实不同，改掉其中一个引用名（例如 `frontend-guidelines` / `backend-guidelines`），消除歧义。

## 快速排查清单

1. 技能目录名与 `role.yaml` 声明名逐字符一致（大小写敏感）。
2. 目录形式有 `SKILL.md`；单文件形式叫 `{name}.md`。
3. frontmatter 以 `---` 起止，YAML 合法。
4. `description` 非空，能说明「什么时候该加载它」。
5. `references:` 的路径相对技能目录，文件真实存在。
6. `skill_compose` 无冲突、无缺失。
7. `rolebox status` 中对应 target 的 `Skill symlinks` 为 `all valid`。
8. 仍然不对时把 `ROLEBOX_LOG_LEVEL` 设为 `debug`，查看日志文件里的 `skill-resolver` / `reference-resolver` 记录。

## 下一步

- [技能系统](/02-Guide/skills) —— 技能的加载通道、声明与解析顺序
- [引用文档](/02-Guide/references) —— 自动发现、显式声明与描述推导
- [创建角色](/02-Guide/create-a-role) —— 完整的角色创建流程
