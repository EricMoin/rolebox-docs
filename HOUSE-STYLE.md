# rolebox-docs 重写规范（HOUSE-STYLE）

> **本文件是所有重写任务的唯一共享契约。**
> 24 个子任务中的每一个，动笔前必须先读它，交付前必须用它自检。
> 本文件与权威策略文件 `.rolebox/artifacts/restructure-strategy.txt` 冲突时，以策略文件为准，并在报告中显式指出冲突。
>
> 本文件位于仓库根目录，**不进站点**（VitePress 只发布 `docs/`）。
> 因此本文件自身可以出现 `src/…:NNN`、`源码位置` 等被禁止的字样——它们在这里只是被引述的缺陷名。

---

## 0. 这份契约解决什么问题

文档的**事实是对的**，体裁是错的：现有 48 页读起来像代码审计报告。
本契约把这六个缺陷（P1–P6）替换为文档体裁，**同时不允许削弱任何一条事实断言**（准确率红线）。

重写不是删内容，是换体裁：同一句话，去掉行号锚点、去掉源码位置列、把参数表挪到示例之后。

---

## 1. 六个 prose 缺陷与替代方案（策略 §4.1）

| # | 现状 | 处置 | 理由 |
|---|---|---|---|
| **P1** | 1880 条 `src/file.ts:NNN` + 237 条 `CHANGELOG.md:NNN` | **行号锚点全站清零**（含 CHANGELOG）。事实用陈述句直说；出处集中到 `/06-Appendix/source-index`（概念→模块，**无行号**）；版本事实改为 R7 的版本备注 | 行号是代码库里最易腐烂的标识符；引用本身在制造缺陷，而读者要的是语义不是文件 |
| **P2** | 60 个 `源码位置` 表列 | **删列**。若该行列的是「模块」而非「用户要配的字段」，则整行移入 source-index；若表格是工具/参数表，此列无读者价值 | 实现管道不属于读者面向表格 |
| **P3** | 25 个 `引用索引` 页尾表 | **整表删除**，内容去重后并入 `/06-Appendix/source-index` | 同一事实分散在 25 处以行号重复登记，是漂移的温床 |
| **P4** | 78 行栈叠版本横幅（41 页） | **页头横幅清零**；站点级版本唯一一处（sidebar/footer）。页面级最多 1 条版本备注，写成 `> 自 vX.Y.Z 起，…`；已移除页与历史存档页例外 | 用一条 stable/since 标记承载版本，不堆 changelog |
| **P5** | 15 个 `核心术语速览` 前置块 | **删除前置术语块**；术语在第 X 页首次出现处就地定义（`**图（graph，由 graph_create 创建并返回 graph_id 的编排容器）**`）；全站唯一定义表为 `/06-Appendix/glossary` | 术语当场解释、后章详述，而不是先背单词表 |
| **P6** | 8 个 emoji 标题；`index.md` 200 行营销落地页 | **标题去 emoji**；`index.md` 重写为 ≤60 行的文档首页：hero 保留 3 行，正文为「是什么 / 给谁 / 文档地图 / 三步跑通」四段。删掉 8 张特性卡、14 行 harness 对比表、项目统计、精选角色库 | 首页是导言 + 读者分类，不是营销页 |

---

## 2. 出处策略（策略 §4.2，C-1 – C-7）

- **C-1** 全站 `.md` 中 `src/[^)\s]*:\d+` 与 `CHANGELOG\.md:\d+` 计数必须为 **0**。
- **C-2** `docs/index.md`、`docs/02-Guide/**`（含教程）、`docs/03-Reference/**`、`docs/06-Appendix/glossary.md` 中 `src/` 字符串计数必须为 **0**（教程 / 指南 / 参考 / 首页 / 术语表 = 用户面）。
  *实现例外（策略 §6 行 26/27）*：`03-Reference/plugin-interface.md` 与 `03-Reference/recovery-system.md` 在目标 IA 中属「内部实现」，只是 URL 留在 03-Reference，检查器已为这两页设豁免。
- **C-3** 模块路径（**无行号**）仅允许出现在三类页面：**内部实现**、**贡献**、`06-Appendix/source-index.md`。且只在「模块本身是句子主语」时出现，不作为证据附件。
- **C-4** `06-Appendix/source-index.md` 是**唯一出处页**：约 30–40 行表——概念 → 模块路径 → 该模块负责什么 → 相关页面。它取代 60 个单元格 + 25 张表 + 1880 条行内引用。
- **C-5** **删引用 ≠ 删事实（准确率红线）**：每条被删的引用，其承载的论断必须有一条落点——① 原句保留（去掉括号引用）；② 若论断是实现级细节，整句**移入**对应内部实现页；③ 若论断已被同一页别处覆盖，删除重复。执行方的报告必须能回答「这条引用承载的论断去哪了」。
- **C-6** 防御性审计叙述（如 `grep -rln collaboration src/ 在 1.9.0 源码中返回 0 个文件`）一律删除；若结论与读者相关（旧配置块已不存在），在迁移页陈述一次。
- **C-7** 模块路径的**存在性**校验继续执行（原 V2 → 现 C10）：内部实现 / 贡献 / 源码索引里出现的每个 `src/...` 必须在 rolebox 仓库真实存在。

> **一句话记住**：删除的是「出处标记」，不是「事实」；出处集中到 source-index 一张表。

---

## 3. 房子风格（策略 §4.3，R1 – R14）

| # | 规则 | 机械可检 |
|---|---|---|
| **R1** | 摘要先行：标题后第一段 ≤3 句，说明「这一页回答什么问题」；不得以术语表 / 版本横幅 / 警告块开篇 | 人工 + C3/C12 |
| **R2** | 示例先行：任何讲「怎么做」的二级章节，必须在参数表**之前**给出可运行示例 | 人工（报告须给证据） |
| **R3** | 每个 bash 围栏块后 4 行内必须有 text 围栏块，首行标注「应看到」；无法实证的输出必须注明「示例输出，随环境略有差异」 | **C8** |
| **R4** | 教程 / 指南 / 参考 / 首页 / 术语表：`src/` 出现次数 = 0 | **C2** |
| **R5** | 模块路径（无行号）仅限内部实现 / 贡献 / 源码索引 | **C2 + C10** |
| **R6** | 不得出现 `源码位置`、`引用索引`、`核心术语速览` 三个字符串 | **C3** |
| **R7** | 版本信息：站点级 1 处；页面级 ≤1 条，格式 `> 自 vX.Y.Z 起，…`，且必须对应 CHANGELOG 中真实版本标题；已移除页与历史存档页例外 | **C12** |
| **R8** | 术语首次出现处定义：`中文（English，一句话解释）`；后续直接使用；不得前置术语块 | 人工 + 术语表抽查 |
| **R9** | 标题无 emoji；h1 每页恰好 1 个；层级不跳级（#→##→###） | **C4 + C6** |
| **R10** | 页面长度：普通页 ≤400 行；教程页 ≤250 行；超出即拆 | **C7**（>500 FAIL，400–500 WARN） |
| **R11** | 正文中文，保留英文技术术语；中英文 / 数字之间留空格（沿用现有约定） | 人工 |
| **R12** | 站内链接一律用 VitePress 绝对路径（`/02-Guide/...`）；**不得链接到本 subtask 不拥有的页面的锚点**（避免并行改写的锚点漂移） | C14（链接可达；跨页锚点缺失记 WARN） |
| **R13** | 表格只用于「字段 / 参数 / 矩阵」；不得用表格承载叙述 | 人工 |
| **R14** | 一个论断只在一处定义，其它处链接过去（消除 graph-engine / runtime-behavior / workflow-patterns 之间的三重复述） | 人工 |

### 3.1 逐页长度上限（C7 的实际判据）

| 页面 | 上限 | 来源 |
|---|---|---|
| `docs/index.md` | 60 | 策略 §3.1 |
| `02-Guide/getting-started.md` | 80 | ST3 |
| `01-Overview/quick-start.md` | 120 | ST3 |
| `02-Guide/examples.md` | 150 | ST12 |
| `02-Guide/collaboration-graph.md` | 60 | ST24 |
| `04-Advanced/termination-conditions.md` | 50 | ST24 |
| `02-Guide/tutorial/*.md`（7 章） | 250 | 策略 §5 |
| 其它普通页 | 400（>500 FAIL） | 策略 §4.3 R10 |
| `04-Advanced/design-decisions/*` | 豁免 | 策略 `6 行 32/33：保留原文结构与规模 |

---

## 4. 页面骨架模板（策略 §4.4）

````markdown
---
title: <页面标题>
description: <一句话，≤120 字，说明本页解决什么问题>
---

# <标题>（<English Term>）

<摘要行：一句话说明这一页是什么。>

> 前置：[教程 05 用图引擎编排团队](/02-Guide/tutorial/05-graph)｜相关：[图引擎模型](/04-Advanced/graph-engine)

## 最小示例            ← 先给能跑起来的东西（指南/教程页必填）
```bash
…
```
```text
应看到：
…
```

## 用法 / 字段          ← 表格在后：字段｜类型｜默认值｜说明
## 示例：<场景>         ← ≥2 个；第二个覆盖边界或错误分支
## 常见错误
## 备注                ← 版本备注最多一条，形如「> 自 v1.8.0 起，…」
````

- **参考页**可省略「最小示例」，但每个条目必须有**一行摘要 + 参数 + 至少一个示例**（rustdoc 模式）。
- **frontmatter 只有 `title` 与 `description` 两个必需键**（C5）；`description` 单行、≤120 字。
- 历史存档页额外加 `search: false`（策略 §3.3）。

---

## 5. 教程主线规格摘要（策略 §5）

**它构建什么**：一个真正能用的**代码评审团队** —— 1 个父角色 `code-reviewer`（PROMPT + 1 技能 + 1 引用文档 + 1 自定义函数）+ 3 个子代理（`coder` / `reviewer` / `doc-writer`），最后用 graph 工具把它们编排成「实现 → 评审 → 定稿」的带审批门流水线。
选它的理由：rolebox 仓库 `examples/review-team/role.yaml` 就是同一形状的真实样例，教程每一步都对着 v1.9.0 真实可运行的东西写。

| 章 | 读者输入 | 应看到（text 块） |
|---|---|---|
| **01 安装并跑通** | `npm install rolebox`（pi/dsh 各一行附注）→ `rolebox init code-reviewer -y` → `rolebox sync opencode` → `rolebox list` | 初始化成功行、`PROMPT.md functions references role.yaml skills`、`Installed roles:` 列表 |
| **02 让角色懂你的项目** | 改写 `PROMPT.md`；新建 `skills/review-checklist/SKILL.md`；改 `role.yaml` 的 `skills:`；新建 `references/style-guide.md`；`rolebox sync opencode` | 角色按需调用技能（opencode/dsh 用 `skill`，pi 用 `load_role_skill`） |
| **03 用函数改变行为** | `|review|` 前缀激活内置函数；写 `functions/security-scan.md` 并声明 `functions:` | 函数激活后系统提示出现该指令；说明 `functions:` 是**合并**语义，移除需 `disable_functions` |
| **04 把角色变成团队** | 在 `role.yaml` 粘贴 `subagents:` 三段（name/description/prompt）→ `rolebox sync opencode` | 父角色把任务派给三个子代理并汇总 |
| **05 用图引擎编排团队** | `graph_create` → `graph_add_node`×3 → `graph_add_edge`×2 → `graph_run` | `graph_run` 立即返回 phase / active_nodes / pending_nodes（**非阻塞**）；回合结束后注入 `[GRAPH COMPLETE]`；下一回合 `graph_status(graph_id, include_output: true)` 读回结果 |
| **06 审批门与有界循环** | `needs_approval: true`；`graph_add_loop`（nodes + max_traversals） | `[GRAPH BLOCKED]`；`graph_status(pending_approvals: true)`；`graph_approve(action: "approve")` 后图继续至 phase=complete；`max_traversals` 是**硬上限** |
| **07 让代理记住你**（第二教程） | `rolebox memory list/stats/search`；触发 `|memory|` | 跨会话记忆自动注入为 `<available_memory>`；搜索返回上一次会话落盘的决策 |

**硬性要求**

1. 每章结尾一段「你现在拥有什么」+ 指向下一章；每章开头一行前置（上一章产物）。
2. 01 章给出**三个 harness 各一行**安装命令，主线只走 opencode，细节链接 `/01-Overview/platform-harnesses`。
3. 教程中每一个 `rolebox <cmd>` 必须是 14 个子命令之一（**C9**）；每一个 graph 工具名必须是那 8 个（**C11**）。
4. 每个 bash 块后 4 行内必须有 text 预期输出块（**C8 / R3**）；无法实证的输出显式标注。
5. 教程总览页（`/02-Guide/getting-started`）改为：4 条学习路径表 + 教程地图 + 前置条件；原「贡献者指南」段落移交 `/05-Contributing/development-setup`。

---

## 6. 文件所有权与并行安全（策略 §7 / §8）

1. **每个文件恰好一个内容所有者**（策略 §6 的「执行」列 + 各子任务的 files 字段）。24 个子任务两两文件集不相交。
2. **ST2 的存根例外**：ST2 为 14 个新页面创建 ≤15 行最小存根（保证构建始终绿灯），随后内容所有权移交给 ST3–ST6/ST13/ST23/ST24。这是**顺序依赖**，不是并发写：任何时刻只有一个执行者在写某个文件。
3. **跨文件内容搬运（拆 / 并类）**：源任务只删自己文件里的段落，目标任务只往自己文件里加；两者都从**当前（未重写）版本**取证，因此可并行。执行方必须在报告里写明「从哪个文件搬运了哪个段落」。
4. `docs/.vitepress/config.ts` **只由 ST2 写**，全程唯一作者。后续侧边栏修正走 Validator→修订回路，不新增作者。
5. **R12**：不得链接自己并不拥有的页面的**锚点**，只链接页面路径——否则并行改写会互相打断。
6. **不要写别人的文件。**需要别页配合时，改成链接到页面路径，并在报告里写明依赖。

---

## 7. 机械检查器：`scripts/docs-check.mjs`

```bash
node scripts/docs-check.mjs                              # 全站 docs/ 下的全部 markdown
node scripts/docs-check.mjs --paths docs/index.md        # 只检查指定文件
node scripts/docs-check.mjs --paths 'docs/02-Guide/**'   # 目录 / glob
node scripts/docs-check.mjs --print-registry             # 打印从只读参考仓库提取的事实清单
```

- 只读、无第三方依赖、不访问网络。任一 **FAIL** 时退出码 1；**WARN / SKIP** 不影响退出码。
- **C14（导航完整性）始终扫描全站**，因为它需要 `config.ts` 与全部页面；其余检查只作用于 `--paths` 指定的文件。
- `--paths` 指向不存在的文件 / 未匹配的 glob → 退出码 2（不会静默跳过）。

### 7.1 检查项一览（策略 §9.2）

| 项 | 检查 | 判据 | 需参考仓库 |
|---|---|---|---|
| **C1** | 全站无行号锚点 | `src/…:\d+` 与 `CHANGELOG\.md:\d+` 计数 = 0 | — |
| **C2** | 用户面零代码路径 | index.md、02-Guide/**、03-Reference/**、06-Appendix/glossary.md 中 `src/` 计数 = 0（两页实现例外见 C-2） | — |
| **C3** | 无实现管道遗迹 | `源码位置` / `引用索引` / `核心术语速览` 计数 = 0 | — |
| **C4** | 无 emoji 标题 | 标题中 emoji 码点 = 0 | — |
| **C5** | frontmatter 完整 | 每页有 `title`、单行 `description` ≤120 字 | — |
| **C6** | 标题层级 | 每页恰好 1 个 h1（`layout: home` 豁免）；层级不跳级 | — |
| **C7** | 页长 | 教程 ≤250 行；普通页 >500 FAIL、400–500 WARN；逐页约定见 §3.1 | — |
| **C8** | 可运行示例闭环 | 教程与 getting-started 的每个 bash 块后 4 行内有 text / console 块 | — |
| **C9** | CLI 真实性 | 每个 `rolebox <sub>` ∈ 14 子命令（命令上下文：围栏块 / 行内代码 / $ 提示行；同行有否定标记的「该命令不存在」说明除外） | 是 |
| **C10** | 模块路径真实性 | 内部实现 / 贡献 / 源码索引中的每个 `src/...` 真实存在 | 是 |
| **C11** | 工具名对账 | ①全站行内 `graph_*` / `lsp_*` ∈ 注册集合；②全站标题中的工具名 ∈ 注册集合 ∪ 已退役集合 ∪ 非工具标识符（历史存档页豁免②） | 是 |
| **C12** | 版本备注真实性 | 每条 vX.Y.Z 备注对应 CHANGELOG 的版本标题；页级备注 ≤1（迁移页 / 已移除页 / 存档页豁免计数） | 是 |
| **C13** | 移除词汇白名单 | `collaboration:` / `termination_conditions` / `Termination*` 只允许出现在 3 页 | 是（白名单在脚本内） |
| **C14** | 导航完整性 | sidebar/nav 链接可达；docs 下每个 md ∈ 侧边栏 ∪ allowlist（恰为 `05-Contributing/architecture-overview.md`）；页面内链接可达；跨页锚点缺失记 WARN | — |
| **C15** | role.yaml 键真实性 | `role-yaml.md` / `dispatch-config.md` 中顶层键 ∈ RoleConfig；`dispatch:` 子键 ∈ loader 白名单 | 是 |
| **C16** | extensions 键集 | `extensions:` 块键集 == 7 个 ExtensionScope | 是 |

### 7.2 不许编造的事实清单（v1.9.0）

- **14 个 CLI 子命令**：`init`、`install`、`uninstall`、`sync`、`list`、`search`、`update`、`registry`、`status`、`info`、`config`、`monitor`、`memory`、`checkpoint`。**没有** `rolebox migrate`。
- **8 个图工具**：`graph_create`、`graph_add_node`、`graph_add_edge`、`graph_add_loop`、`graph_run`、`graph_status`、`graph_cancel`、`graph_approve`。
- **7 个 ExtensionScope**：`conditions`、`graph_topologies`、`recovery_strategies`、`recovery_patterns`、`notification_channels`、`notification_events`、`observe_events`。
- **完整 78 个工具键**与 **RoleConfig 的 31 个顶层键**用 `node scripts/docs-check.mjs --print-registry` 现场打印，**不要凭记忆写**。
- **版本事实**只能引用 CHANGELOG 中真实存在的版本标题；`--print-registry` 会列出全部 39 个。

---

## 8. 交付前自检清单

1. `node scripts/docs-check.mjs --paths <你的文件>` 全项 PASS（WARN 可接受，须在报告中解释）。
2. 人工判据（策略 §9.3）在报告中给证据：
   - 每条被删引用承载的**论断落点**（抽样 ≥5 条：原句保留 / 移入内部实现 / 删除重复）；
   - **R2 示例先行**：每个讲操作的二级章节，示例在参数表之前；
   - **R14 无三重复述**：与相邻页面各有一句边界声明；
   - 教程命令**逐条对照源码**（有环境则实跑；无环境在报告标注「未实跑」）。
3. `bun run docs:build` 退出 0（V1 延续；`ignoreDeadLinks` 保持未设置）。
4. 报告格式：Status / Files Modified / Changes（每文件：旧文 → 新文 + 你据以核实的来源）/ Verification（原始输出）/ Cross-file moves / Unverified。

---

## 9. 禁止事项速查

- ❌ 写行号（`src/x.ts:12`、`CHANGELOG.md:12`）
- ❌ 在用户面页面写 `src/` 路径
- ❌ `源码位置` 列、`引用索引` 表、`核心术语速览` 块
- ❌ 标题 emoji、页头堆叠版本横幅
- ❌ 参数表先于示例
- ❌ 教程里的 bash 块没有预期输出
- ❌ 编造 CLI 子命令 / 工具名 / extensions 作用域 / 版本号
- ❌ 链接别的页面的锚点（只链接页面路径）
- ❌ 修改别的 subtask 拥有的文件；修改只读参考仓库（`$ROLEBOX_REF`，或与本站并排检出的 `../rolebox`）
- ❌ `git commit` / `git checkout` / `git reset`：编辑留在工作区

---

*本文件由 ST1 建立，是所有重写任务的唯一共享契约；如需变更，先改本文件再改页面。*
