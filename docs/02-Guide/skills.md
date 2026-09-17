---
title: 技能系统
description: 技能是什么、由谁加载、按什么顺序解析、与函数怎么分工，以及技能没有生效时如何排查
---

# 技能系统（Skill System）

技能（Skill）是按需加载的知识模块：系统提示只列出技能的名称与描述，代理需要时才通过 harness 的技能工具读取正文——这就是渐进式披露（progressive disclosure，只把当下需要的信息放进上下文）。本页面向技能的使用者，说明技能放在哪、由谁加载、按什么顺序解析、什么时候不该用；要动手写一个技能，见[编写技能](/02-Guide/authoring-skills)。

> 相关：[编写技能](/02-Guide/authoring-skills)｜[引用文档](/02-Guide/references)｜[函数系统](/02-Guide/functions)

## 最小示例：给角色加一个技能

技能放在角色目录的 `skills/` 下，可以是一个目录（`{name}/SKILL.md`，推荐），也可以是一个单文件（`{name}.md`）：

```text
code-reviewer/
├── role.yaml
└── skills/
    └── review-checklist/
        └── SKILL.md
```

`skills/review-checklist/SKILL.md` 的正文就是给代理的指令：

```markdown
---
name: review-checklist
description: 代码审查清单 — 检查正确性、安全性与性能
---

审查代码时逐项确认：
- 错误路径是否被处理
- 输入是否在入口处校验
- 是否存在 SQL 注入 / XSS 风险
```

在 `role.yaml` 里按名称声明它：

```yaml
skills:
  - review-checklist
```

把角色同步到 harness，再检查它的状态：

```bash
rolebox sync opencode
rolebox status
```

```text
应看到（示例输出，角色名、数量与路径随实际环境变化）：

Rolebox v1.9.0

Installed Roles
──────────────────────────────────────────────────
  ✓ code-reviewer             1.0.0    (oh-my-role)  → synced

OpenCode Integration
──────────────────────────────────────────────────
  Plugin       ✓ registered
  Sync target  ~/.config/opencode/rolebox
  Synced       1/1 roles
  Skill symlinks (1):
    ✓ all valid
```

`Synced` 与 `Skill symlinks` 确认的是 harness 侧能否发现技能；要在代理侧确认，直接在会话里提出一个需要该技能的问题，或让它加载 `review-checklist`。

## 技能由谁加载

技能正文不在系统提示里。系统提示中的 `<available_skills>` 块只给出名称、描述、作用域与文件位置，真正的加载动作发生在 harness 一侧，而三个 harness 的通道并不相同：

| harness | 加载通道 | 说明 |
|---|---|---|
| opencode | 原生 `skill` 工具 | rolebox 把角色技能镜像到 harness 的技能目录，条目名带 `rolebox--` 前缀，供 opencode 的原生技能机制发现 |
| Pi | `load_role_skill`（rolebox 提供，仅 Pi） | pi 0.84.2 不带 `skill` 工具，rolebox 因此补一个返回完整 SKILL.md 载荷与引用元数据的工具；宿主同时通过 `resources_discover` 获得技能路径 |
| dsh | 原生 `skill` 工具 + rolebox 的惰性 `SkillProvider` | rolebox 向 dsh 的技能注册表注册 Provider：`list()` 只广播元数据、`get()` 才读取正文；活跃角色切换时刷新目录 |

> 自 v1.8.0 起，全局技能目录跟随当前 harness 的配置目录，不再是固定的 `~/.config/opencode/skills/`。

三个通道的共同点：技能内容按需读取，不会在会话一开始就塞进上下文。

## 声明技能

`role.yaml` 里有两个声明技能的字段，写法相同：

```yaml
skills:
  - review-checklist        # 角色本地技能
opencode_skills:
  - humanizer               # 沿用「全局技能目录」命名的共享技能
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `skills` | string[] | 要加载的技能名列表，通常是角色目录下的技能 |
| `opencode_skills` | string[] | 要加载的技能名列表，命名保留了「来自全局技能目录」的历史约定 |

两个字段会合并成同一个技能名集合，随后每个名称都走同一套四段优先级——**`skills` 与 `opencode_skills` 在解析行为上没有区别**。子代理在自己的 `subagents:` 条目里同样支持这两个字段：技能文件优先从子代理自己的目录 `subagents/{slug}/skills/` 解析，该目录不存在时回退到角色目录。

## 解析顺序

声明 `review-checklist` 之后，解析器按下面的优先级查找文件，第一个命中的胜出：

| 优先级 | 候选位置 | 归属 |
|---|---|---|
| 1 | `{roleDir}/skills/{name}/SKILL.md` | 角色本地，目录形式 |
| 2 | `{roleDir}/skills/{name}.md` | 角色本地，单文件形式 |
| 3 | `{globalSkillsDir}/{name}/SKILL.md` | 全局，目录形式 |
| 4 | `{globalSkillsDir}/{name}.md` | 全局，单文件形式 |

`{globalSkillsDir}` 跟随当前 harness：

| harness | 全局技能目录 |
|---|---|
| opencode | `$XDG_CONFIG_HOME/opencode/skills`，未设置时为 `~/.config/opencode/skills` |
| Pi | `$PI_CODING_AGENT_DIR/skills`，未设置时为 `~/.pi/agent/skills` |
| dsh | `$DSH_HOME/skills`，未设置时为 `~/.dsh/skills` |

四个候选都没有命中时，解析器记一条日志并静默跳过这个技能名，不抛错，角色的其它技能照常加载。因此 `rolebox info` 的 `Skills (N)` 一节列出的是**声明**而不是解析结果：声明了但没有对应文件时，那一行仍然会出现。

## 技能与函数的分工

| | 技能（Skill） | 函数（Function） |
|---|---|---|
| 由谁触发 | 代理自行判断当前任务是否需要 | 用户在消息开头用 `\|名称\|` 显式激活 |
| 生效范围 | 一次加载，影响当前上下文 | 激活后持续生效，直到停用或会话结束 |
| 内容性质 | 参考知识、检查清单、操作指南 | 行为指令：阶段、门禁、状态流转 |
| 声明位置 | `role.yaml` 的 `skills:` / `opencode_skills:` | `role.yaml` 的 `functions:` |
| 参数 | 不支持 | 支持 `\|名称:参数\|` 与键值对 |

一句话概括：**技能是代理自己决定要不要读的知识，函数是用户显式激活、持续生效的行为。** 函数详见[函数系统](/02-Guide/functions)。

## 什么时候不要用技能

### 技能过多会稀释提示

`<available_skills>` 只放名称与描述，但技能一多，描述本身就构成噪声，代理也更容易选错。经验上单个角色声明的技能控制在 5–6 个以内；要判断多个技能是否重复或冲突，用 `skill_compose` 工具做一次组合分析（用法见[编写技能](/02-Guide/authoring-skills)）。面向同一领域的多个技能应合并成一个。

### 过程逻辑交给函数

技能注入的是静态文本，没有状态、没有分支、没有执行顺序。下面这些需求应该写成函数：

| 需求 | 应该用 | 不应该用技能 |
|---|---|---|
| 发现诊断错误后重试 | 函数（条件与转移） | 在 SKILL.md 里描述重试流程 |
| 先 plan 再 execute | 函数（阶段机） | 在技能里编排多个步骤 |
| 用户输入 `\|review\|` 触发审查 | 函数（激活语法） | 在技能里定义激活语法 |

### 频繁变化的数据交给引用或记忆

技能文件是静态文本，不适合存放会话状态或频繁变化的数据。按生命周期选择载体：

- 相对静态、篇幅较长的领域知识 → 引用文档（见[引用文档](/02-Guide/references)）
- 需要跨会话保留的决策与偏好 → `memory_write` / `memory_recall`（见[记忆系统](/04-Advanced/memory-system)）

函数运行期的状态由函数机制自己维护，不需要你手工管理。

## 排查：技能没有生效

按下面的顺序检查，每一步排除一类原因：

1. **声明是否存在** —— `rolebox info <role>` 的 `Skills (N)` 一节列出 `skills:` 与 `opencode_skills:` 的声明值。名称必须与目录名或文件名完全一致，大小写敏感。
2. **文件是否在候选位置** —— 目录形式必须叫 `SKILL.md`（大小写敏感），单文件形式必须叫 `{name}.md`；两者都先查角色本地，再查全局技能目录。
3. **harness 是否看到** —— 用 `rolebox status` 看对应 target 的 `Skill symlinks`：`all valid` 表示链接目标都在；出现 `(broken)` 说明技能文件被删除或改名。
4. **解析是否失败** —— 文件存在但读取失败、或 frontmatter 格式错误时，技能仍会被列出，只是描述为空。解析日志不打印到终端，而是写入日志文件：`ROLEBOX_LOG_FILE` 指定路径，否则依次尝试项目内 `.rolebox/logs/rolebox.log` 与 `~/.config/rolebox/logs/rolebox.log`；`ROLEBOX_LOG_LEVEL=debug` 提高详细度。
5. **是不是 Pi** —— Pi 上的加载工具是 `load_role_skill`，不是 `skill`；让代理改用前者。

```bash
grep -i 'skill-resolver' .rolebox/logs/rolebox.log | tail -5
```

```text
应看到（仅在解析器记录过日志时有输出；示例）：

{"0":"Skill \"review-checklist\" not found. Searched:","1":{"candidates":[".../skills/review-checklist/SKILL.md",".../skills/review-checklist.md"]},"_meta":{"name":"skill-resolver","logLevelName":"INFO"}}
```

## 下一步

- [编写技能](/02-Guide/authoring-skills) —— SKILL.md 的字段、技能级引用、组合与测试
- [引用文档](/02-Guide/references) —— 自动发现与显式声明
- [函数系统](/02-Guide/functions) —— 用函数改变代理行为
