#!/usr/bin/env node
/**
 * docs-check.mjs — rolebox-docs 房子风格机械检查器（C1–C17）
 *
 * 契约来源：.rolebox/artifacts/restructure-strategy.txt §4（逐页重写规则）、
 * §9（验证方案 C1–C16，含 V1–V9 的延续映射），以及仓库根 HOUSE-STYLE.md。
 *
 * 用法
 *   node scripts/docs-check.mjs                          # 检查全站 docs/ 下的全部 markdown
 *   node scripts/docs-check.mjs --paths docs/index.md    # 只检查指定文件/目录/glob
 *   node scripts/docs-check.mjs --paths 'docs/02-Guide/**' docs/03-Reference/cli.md
 *   node scripts/docs-check.mjs --ref /path/to/rolebox   # 覆盖只读参考仓库位置
 *   node scripts/docs-check.mjs --print-registry         # 打印从参考仓库提取的事实清单
 *
 * 参考仓库位置解析顺序：--ref > $ROLEBOX_REF > 与本站并排检出的 ../rolebox。
 * 三者都不可用时，依赖参考仓库的检查项报 SKIP（见下），而不是 FAIL。
 *
 * 输出：逐项 PASS/FAIL/WARN/SKIP + 计数 + 前 10 个违规位置；任一 FAIL 时退出码 1。
 * 退出码：0 = 无 FAIL；1 = 至少一项 FAIL；2 = 用法/范围错误（如 --paths 指向不存在的文件）。
 *
 * 保证：只读（不写任何文件）、无第三方依赖（仅 Node 内置模块）、不访问网络。
 *
 * 需要参考仓库的检查项：C9（CLI 子命令）、C10（模块路径存在性）、C11（工具名对账）、
 * C12（版本备注）、C13（移除词汇白名单）、C15（role.yaml 键）、C16（extensions 键集）。
 * 参考仓库缺失时这些项报告 SKIP（不判 FAIL），并在汇总中说明。
 *
 * C11 的精确边界（避免误报）
 *   C11a  全站行内 `graph_*` / `lsp_*` 标识符 ∈ 注册集合（策略 §9.2 明确要求「含 8 个 graph_*」）
 *   C11b  全站标题（h2–h6）中的 snake_case 工具名 ∈ 注册集合 ∪ 已退役集合 ∪ 非工具标识符
 *   历史存档页（04-Advanced/design-decisions/**）豁免 C11b：它们记录的是当时的计划 API。
 *
 * C15 的精确边界：顶层键取自 docs/03-Reference/{role-yaml,dispatch-config}.md 的 yaml 围栏块；
 * dispatch 子键取自同一批文件中的 `dispatch:` 块，对照 loader 的 knownKeys 白名单。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// 真实 YAML 解析器（VitePress 自己在用；随 vitepress 安装，非新增依赖）。
// 缺失时 C17 报 SKIP，而不是静默放过。
const requireFromHere = createRequire(import.meta.url);
const YAML = (() => {
  for (const name of ["js-yaml", "yaml"]) {
    try { return requireFromHere(name); } catch { /* 尝试下一个 */ }
  }
  return null;
})();

// ── 常量 ─────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const VITEPRESS_CONFIG = path.join(DOCS_DIR, ".vitepress", "config.ts");
// 参考仓库位置不写死本机绝对路径；解析顺序 --ref > $ROLEBOX_REF > 并排检出的 ../rolebox。
const SIBLING_REF = path.resolve(ROOT, "..", "rolebox");

const SKIP_DIRS = new Set(["node_modules", ".git", ".vitepress", "public", "dist", ".rolebox", ".github"]);

const CLI_SUBCOMMANDS_FALLBACK = [
  "init", "install", "uninstall", "sync", "list", "search", "update",
  "registry", "status", "info", "config", "monitor", "memory", "checkpoint",
];

const GRAPH_TOOL_KEYS = [
  "graph_create", "graph_add_node", "graph_add_edge", "graph_add_loop",
  "graph_run", "graph_status", "graph_cancel", "graph_approve",
];

/** 非工具标识符：与工具同名形但语义上不是工具（逐条在参考仓库中核实）。 */
const NON_TOOL_IDENTIFIERS = new Map([
  ["graph_id", "工具参数（graph_status/graph_cancel 等的 graph_id 入参）"],
  ["graph_topologies", "ExtensionScope 值（src/extensions/types.ts）"],
  ["graph_v2", "角色级 graph.orchestration 唯一取值（src/types.graph.ts KNOWN_ORCHESTRATIONS）"],
  ["graph_state", "系统提示中的 graph_state 块（src/graph/engine/graph-state-block.ts）"],
  ["signal_observed", "函数条件表达式名，不是工具（src/function/conditions.ts）"],
]);

/** 已退役/已移除的工具名：迁移说明必须能提到它们（逐条见 CHANGELOG 1.0.0）。 */
const RETIRED_TOOL_KEYS = new Set([
  "dispatch", "dispatch_output", "dispatch_status", "dispatch_cancel", "dispatch_metrics",
  "dispatch_progress", "dispatch_stream", "dispatch_approve", "dispatch_reject",
  "dispatch_budget", "dispatch_checkpoint", "function_state",
]);

/** C13 白名单：允许出现已移除特性词汇的三页（策略 §9.1 C13）。 */
const REMOVED_VOCAB_WHITELIST = new Set([
  "docs/06-Appendix/migration.md",
  "docs/02-Guide/collaboration-graph.md",
  "docs/04-Advanced/termination-conditions.md",
]);

/** C14 非导航 allowlist（策略 §3.1、§9.1 C14）：允许不在侧边栏的页面。 */
const NON_NAV_ALLOWLIST = new Set([
  "docs/05-Contributing/architecture-overview.md",
]);

/** 历史存档页：保留原文规模与历史 API，不参与页长/C10/C11b（策略 §6 行 32/33）。 */
const ARCHIVE_PATTERN = /^docs\/04-Advanced\/design-decisions\//;

/** 内部实现体裁页面：允许出现无行号模块路径（策略 §4.2 C-3、§6 行 26/27）。 */
const INTERNAL_STYLE_PAGES = [
  /^docs\/01-Overview\/architecture-overview\.md$/,
  /^docs\/01-Overview\/service-architecture\.md$/,
  /^docs\/01-Overview\/processing-pipeline\.md$/,
  /^docs\/04-Advanced\//,
  /^docs\/03-Reference\/plugin-interface\.md$/,
  /^docs\/03-Reference\/recovery-system\.md$/,
  /^docs\/05-Contributing\//,
  /^docs\/06-Appendix\/source-index\.md$/,
];

/** C2 用户面豁免：两页在目标 IA 中属「内部实现」，仅 URL 留在 03-Reference（策略 §6 行 26/27）。 */
const C2_EXEMPT_PAGES = new Set([
  "docs/03-Reference/plugin-interface.md",
  "docs/03-Reference/recovery-system.md",
]);

/** C7 页面长度上限：来自策略 §3.1/§6 的逐页约定（教程 250，其余按 §4.3 R10）。 */
const PAGE_LENGTH_OVERRIDES = new Map([
  ["docs/index.md", 60],
  ["docs/02-Guide/getting-started.md", 80],
  ["docs/01-Overview/quick-start.md", 120],
  ["docs/02-Guide/examples.md", 150],
  ["docs/02-Guide/collaboration-graph.md", 60],
  ["docs/04-Advanced/termination-conditions.md", 50],
]);

/** C12 页级版本备注计数豁免：已移除页、迁移页与历史存档页（策略 §4.3 R7）。 */
const VERSION_NOTE_EXEMPT = new Set([
  "docs/02-Guide/collaboration-graph.md",
  "docs/04-Advanced/termination-conditions.md",
  "docs/06-Appendix/migration.md",
]);

// ── CLI ──────────────────────────────────────────────────────────────────────

function usage() {
  return [
    "docs-check — rolebox-docs house-style verifier (C1–C16)",
    "",
    "Usage:",
    "  node scripts/docs-check.mjs [--paths <file|dir|glob> ...] [--ref <rolebox repo>] [--print-registry]",
    "",
    "  --paths            只检查给定文件/目录/glob（相对仓库根）；省略时检查 docs/**/*.md 全站。",
    "                     C14（导航完整性）始终扫描全站，因为它需要 config.ts 与全部页面。",
    "  --ref              只读参考仓库（rolebox）位置；默认取 $ROLEBOX_REF，",
    "                     其次取与本站并排检出的 ../rolebox。",
    "  --print-registry   打印从参考仓库提取的事实清单后退出（不执行检查）。",
    "  -h, --help         显示本帮助。",
    "",
    "Exit codes: 0 = 无 FAIL；1 = 至少一项 FAIL；2 = 用法或范围错误。",
  ].join("\n");
}

function die(message) {
  process.stderr.write("docs-check: " + message + "\n");
  process.exit(2);
}

function parseArgv(argv) {
  const opts = { paths: [], ref: process.env.ROLEBOX_REF || SIBLING_REF, printRegistry: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--paths") {
      let consumed = false;
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        opts.paths.push(argv[i + 1]);
        i += 1;
        consumed = true;
      }
      if (!consumed) die("--paths 需要一个或多个路径参数");
    } else if (arg.startsWith("--paths=")) {
      opts.paths.push(...arg.slice("--paths=".length).split(",").filter(Boolean));
    } else if (arg === "--ref") {
      if (i + 1 >= argv.length) die("--ref 需要一个路径参数");
      opts.ref = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--ref=")) {
      opts.ref = arg.slice("--ref=".length);
    } else if (arg === "--print-registry") {
      opts.printRegistry = true;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else {
      die("未知参数：" + arg + "（用 --help 查看用法）");
    }
  }
  return opts;
}

// ── 文件系统助手（只读） ─────────────────────────────────────────────────────

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}
function readText(p) {
  return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
}
function toPosix(p) {
  return p.split(path.sep).join("/");
}
function relFromRoot(p) {
  return toPosix(path.relative(ROOT, p));
}

function walkFiles(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, acc);
    else if (entry.isFile()) acc.push(p);
  }
  return acc;
}

function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i += 1;
        if (glob[i + 1] === "/") { i += 1; re += "(?:[^/]+/)*"; }
        else re += ".*";
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

function hasGlobMagic(s) {
  return /[*?[]/.test(s);
}

function resolveUserPath(p) {
  if (path.isAbsolute(p)) return p;
  const fromRoot = path.resolve(ROOT, p);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(process.cwd(), p);
}

function expandScope(patterns) {
  const md = new Set();
  const extra = new Set();
  const missing = [];
  if (patterns.length === 0) {
    for (const f of walkFiles(DOCS_DIR)) if (f.endsWith(".md")) md.add(f);
    return { md: [...md].sort(), extra: [], missing, scoped: false };
  }
  const repoFiles = walkFiles(ROOT);
  for (const raw of patterns) {
    if (hasGlobMagic(raw)) {
      const pattern = toPosix(raw).replace(/^\.\//, "");
      const re = globToRegExp(pattern);
      const matched = repoFiles.filter((f) => re.test(relFromRoot(f)));
      if (matched.length === 0) { missing.push(raw + "（glob 未匹配到任何文件）"); continue; }
      for (const f of matched) {
        if (f.endsWith(".md")) md.add(f); else extra.add(f);
      }
      continue;
    }
    const abs = resolveUserPath(raw);
    if (isDir(abs)) {
      const found = walkFiles(abs).filter((f) => f.endsWith(".md"));
      if (found.length === 0) { missing.push(raw + "（目录下没有 .md 文件）"); continue; }
      for (const f of found) md.add(f);
    } else if (isFile(abs)) {
      if (abs.endsWith(".md")) md.add(abs); else extra.add(abs);
    } else {
      missing.push(raw);
    }
  }
  return { md: [...md].sort(), extra: [...extra].sort(), missing, scoped: true };
}

// ── 文本分析 ─────────────────────────────────────────────────────────────────

const FENCE_RE = /^\s*`{3,}(.*)$/;

/** 收集围栏代码块，并返回「围栏内容被清空」的行数组（供标题/链接分析使用）。 */
function analyzeFences(text) {
  const lines = text.split("\n");
  const masked = lines.slice();
  const fences = [];
  let open = null;
  for (let i = 0; i < lines.length; i += 1) {
    const m = FENCE_RE.exec(lines[i]);
    if (m) {
      if (open === null) {
        open = { lang: (m[1] || "").trim().toLowerCase(), start: i + 1, body: [] };
      } else {
        open.end = i + 1;
        fences.push(open);
        open = null;
      }
      masked[i] = "";
      continue;
    }
    if (open !== null) { open.body.push(lines[i]); masked[i] = ""; }
  }
  if (open !== null) { open.end = lines.length; fences.push(open); }
  return { lines, masked, fences };
}

function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fm[kv[1]] = value;
  }
  return fm;
}

function headingList(maskedLines) {
  const out = [];
  for (let i = 0; i < maskedLines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(maskedLines[i]);
    if (!m) continue;
    out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
  }
  return out;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u;

function slugifyHeading(text) {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function inlineCodeSpans(line) {
  const out = [];
  const re = /`([^`\n]+)`/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1]);
  return out;
}

// ── 参考仓库事实提取 ─────────────────────────────────────────────────────────

function extractRefFacts(refDir) {
  const facts = {
    dir: refDir,
    available: isDir(refDir),
    versions: new Set(),
    subcommands: new Set(),
    tools: new Set(),
    extensions: new Set(),
    roleConfigKeys: new Set(),
    dispatchKeys: new Set(),
    notes: [],
  };
  if (!facts.available) {
    facts.notes.push("参考仓库不存在：" + refDir);
    for (const k of CLI_SUBCOMMANDS_FALLBACK) facts.subcommands.add(k);
    for (const k of GRAPH_TOOL_KEYS) facts.tools.add(k);
    return facts;
  }

  // CHANGELOG 版本标题（C12）
  const changelog = path.join(refDir, "CHANGELOG.md");
  if (isFile(changelog)) {
    for (const m of readText(changelog).matchAll(/^##\s+(\d+\.\d+\.\d+)\s*$/gm)) facts.versions.add(m[1]);
  } else {
    facts.notes.push("缺少 CHANGELOG.md");
  }

  // CLI 子命令（C9）— src/cli/main.ts 的 subCommands 键
  const cliMain = path.join(refDir, "src/cli/main.ts");
  if (isFile(cliMain)) {
    const text = readText(cliMain);
    const block = /subCommands:\s*\{([\s\S]*?)\n\s*\}/.exec(text);
    if (block) for (const m of block[1].matchAll(/^\s*([a-z][a-z0-9_]*)\s*:/gm)) facts.subcommands.add(m[1]);
  }
  if (facts.subcommands.size === 0) {
    facts.notes.push("未能从 src/cli/main.ts 解析 subCommands，回退到内置 14 子命令表");
    for (const k of CLI_SUBCOMMANDS_FALLBACK) facts.subcommands.add(k);
  }

  // 工具注册集合（C11）— 从注册/装配源码提取真实存在的工具键
  const toolSourceFiles = [
    "src/platform/tool-assembly.ts",
    "src/graph/tools/index.ts",
    "src/dispatch/query/task-tools.ts",
    "src/loop/loop-tools.ts",
    "src/lsp/index.ts",
    "src/core/services/tool-service.ts",
    "src/pi-extension.ts",
    "src/memory/tools.ts",
    "src/asset/skill-tool.ts",
    "src/terminal/interactive-terminal-tool.ts",
    "src/session/session-browse-tools.ts",
    "src/session/session-inspect-tools.ts",
    "src/hashline/hashline-read.ts",
    "src/hashline/hashline-edit.ts",
    "src/web/web-search.ts",
    "src/web/page-read.ts",
    "src/web/web-fetch.ts",
    "src/signal/signal-tool.ts",
    "src/asset/asset-search.ts",
    "src/asset/asset-inspect.ts",
    "src/asset/asset-validate.ts",
    "src/asset/hot-reload.ts",
    "src/asset/skill-compose.ts",
    "src/utils/reference-search.ts",
  ];
  let scanned = 0;
  for (const rel of toolSourceFiles) {
    const p = path.join(refDir, rel);
    if (!isFile(p)) continue;
    scanned += 1;
    const text = readText(p);
    for (const m of text.matchAll(/\btools\.([a-z][a-z0-9_]*)\s*=/g)) facts.tools.add(m[1]);
    for (const m of text.matchAll(/([a-z][a-z0-9_]*)\s*:\s*create[A-Z][A-Za-z0-9]*Tool\s*\(/g)) facts.tools.add(m[1]);
    for (const m of text.matchAll(/\["(lsp_[a-z0-9_]+)"\s*,/g)) facts.tools.add(m[1]);
  }
  if (scanned === 0) facts.notes.push("未能扫描到任何工具注册源码，C11 判据为空");
  for (const k of GRAPH_TOOL_KEYS) facts.tools.add(k);

  // ExtensionScope（C16）
  const extTypes = path.join(refDir, "src/extensions/types.ts");
  if (isFile(extTypes)) {
    const union = /export type ExtensionScope\s*=([\s\S]*?);/.exec(readText(extTypes));
    if (union) for (const m of union[1].matchAll(/"([a-z_]+)"/g)) facts.extensions.add(m[1]);
  }

  // RoleConfig 顶层键（C15）
  const coreTypes = path.join(refDir, "src/types.core.ts");
  if (isFile(coreTypes)) {
    const text = readText(coreTypes);
    const start = text.indexOf("export interface RoleConfig {");
    if (start >= 0) {
      const body = text.slice(start + "export interface RoleConfig {".length);
      const end = body.indexOf("\n}");
      const iface = end >= 0 ? body.slice(0, end) : body;
      for (const m of iface.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\??:/gm)) facts.roleConfigKeys.add(m[1]);
    }
  }
  if (facts.roleConfigKeys.size === 0) facts.notes.push("未能解析 RoleConfig 顶层键，C15 顶层键判据为空");

  // role.yaml dispatch: 白名单（C15）— loader 的 knownKeys
  const loader = path.join(refDir, "src/loader/role-loader.ts");
  if (isFile(loader)) {
    const m = /const knownKeys\s*=\s*\[([\s\S]*?)\]/.exec(readText(loader));
    if (m) for (const k of m[1].matchAll(/"([A-Za-z][A-Za-z0-9_]*)"/g)) facts.dispatchKeys.add(k[1]);
  }
  if (facts.dispatchKeys.size === 0) facts.notes.push("未能解析 loader dispatch 白名单，C15 dispatch 子检查跳过");

  return facts;
}

// ── 检查结果容器 ─────────────────────────────────────────────────────────────

const SAMPLE_LIMIT = 10;

function makeResult(id, title, detail) {
  return { id, title, detail, status: "PASS", count: 0, files: new Set(), samples: [], notes: [] };
}
function addViolation(result, location, label) {
  result.count += 1;
  if (label) result.files.add(label);
  if (result.samples.length < SAMPLE_LIMIT) result.samples.push(location);
}
function finalize(result) {
  // 任何真实违规（count > 0）都判 FAIL，即使此前因备注被标为 WARN。
  if (result.status !== "SKIP" && result.count > 0) result.status = "FAIL";
  return result;
}

// ── 各检查项 ─────────────────────────────────────────────────────────────────

function checkC1(ctx) {
  const r = makeResult("C1", "行号锚点", "src/…:NNN 与 CHANGELOG.md:NNN 计数 = 0");
  const patterns = [/\bsrc\/[A-Za-z0-9_./\-[\]]*:\d+/g, /CHANGELOG\.md:\d+/g];
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) addViolation(r, rel + ":" + (i + 1) + "  " + m[0], rel);
      }
    });
  }
  return finalize(r);
}

const USER_FACING_PATTERNS = [
  /^docs\/index\.md$/,
  /^docs\/02-Guide\//,
  /^docs\/03-Reference\//,
  /^docs\/06-Appendix\/glossary\.md$/,
];

function checkC2(ctx) {
  const r = makeResult("C2", "用户面零代码路径", "用户面页面 src/ 计数 = 0");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (!USER_FACING_PATTERNS.some((re) => re.test(rel))) continue;
    if (C2_EXEMPT_PAGES.has(rel)) continue;
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      let idx = -1;
      while ((idx = line.indexOf("src/", idx + 1)) >= 0) {
        addViolation(r, rel + ":" + (i + 1) + "  " + line.trim().slice(0, 100), rel);
      }
    });
  }
  return finalize(r);
}

function checkC3(ctx) {
  const relics = ["源码位置", "引用索引", "核心术语速览"];
  const r = makeResult("C3", "实现管道遗迹", relics.join(" / ") + " 计数 = 0");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      for (const token of relics) {
        if (line.includes(token)) addViolation(r, rel + ":" + (i + 1) + "  " + token, rel);
      }
    });
  }
  return finalize(r);
}

function checkC4(ctx) {
  const r = makeResult("C4", "标题 emoji", "标题中 emoji 码点 = 0");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const { masked } = analyzeFences(readText(file));
    for (const h of headingList(masked)) {
      if (EMOJI_RE.test(h.text)) addViolation(r, rel + ":" + h.line + "  " + h.text.slice(0, 80), rel);
    }
  }
  return finalize(r);
}

function checkC5(ctx) {
  const r = makeResult("C5", "frontmatter 完整", "每页含 title + 单行 description（≤120 字）");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const fm = parseFrontmatter(readText(file));
    if (!fm) { addViolation(r, rel + "  缺少 frontmatter", rel); continue; }
    if (!fm.title) addViolation(r, rel + "  缺少 title", rel);
    if (!fm.description) {
      addViolation(r, rel + "  缺少 description", rel);
    } else if ([...fm.description].length > 120) {
      addViolation(r, rel + "  description 超过 120 字（" + [...fm.description].length + "）", rel);
    }
  }
  return finalize(r);
}

function checkC6(ctx) {
  const r = makeResult("C6", "标题层级", "恰好 1 个 h1（layout: home 豁免）；层级不跳级");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const text = readText(file);
    const fm = parseFrontmatter(text);
    const isHome = Boolean(fm && fm.layout === "home");
    const heads = headingList(analyzeFences(text).masked);
    const h1 = heads.filter((h) => h.level === 1);
    if (!isHome && h1.length !== 1) addViolation(r, rel + "  h1 数量 = " + h1.length, rel);
    if (isHome && h1.length > 1) addViolation(r, rel + "  home 页 h1 数量 = " + h1.length, rel);
    let prev = 0;
    for (const h of heads) {
      if (prev > 0 && h.level > prev + 1) {
        addViolation(r, rel + ":" + h.line + "  层级跳级 h" + prev + " → h" + h.level + "  " + h.text.slice(0, 60), rel);
      }
      prev = h.level;
    }
  }
  return finalize(r);
}

function checkC7(ctx) {
  const r = makeResult("C7", "页长", "教程 ≤250 行；普通页 >500 FAIL / 400–500 WARN");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (ARCHIVE_PATTERN.test(rel)) continue;
    const lineCount = readText(file).split("\n").length;
    let limit = PAGE_LENGTH_OVERRIDES.get(rel);
    if (limit === undefined && /^docs\/02-Guide\/tutorial\//.test(rel)) limit = 250;
    if (limit !== undefined) {
      if (lineCount > limit) addViolation(r, rel + "  " + lineCount + " 行 > " + limit + "（策略页长约定）", rel);
      continue;
    }
    if (lineCount > 500) addViolation(r, rel + "  " + lineCount + " 行 > 500", rel);
    else if (lineCount > 400) {
      r.notes.push(rel + "  " + lineCount + " 行（400–500，建议拆分）");
      if (r.status === "PASS") r.status = "WARN";
    }
  }
  return finalize(r);
}

function checkC8(ctx) {
  const r = makeResult("C8", "示例闭环", "教程与 getting-started 的每个 bash 块后 4 行内有 text/console 块");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (!/^docs\/02-Guide\/tutorial\//.test(rel) && rel !== "docs/02-Guide/getting-started.md") continue;
    const { lines, fences } = analyzeFences(readText(file));
    for (const fence of fences) {
      if (!["bash", "sh", "shell"].includes(fence.lang)) continue;
      const closeLine = fence.end;
      let paired = false;
      for (let i = closeLine; i < Math.min(closeLine + 4, lines.length); i += 1) {
        const m = FENCE_RE.exec(lines[i]);
        if (m && /^(text|console|output)\b/i.test((m[1] || "").trim())) { paired = true; break; }
      }
      if (!paired) {
        addViolation(r, rel + ":" + fence.start + "  bash 块后 4 行内缺 text/console 预期输出块", rel);
        continue;
      }
      const firstText = lines.slice(fence.end, Math.min(fence.end + 6, lines.length))
        .find((l) => l.trim().length > 0 && !FENCE_RE.test(l));
      if (firstText && !/应看到|示例输出|预期输出/.test(firstText)) {
        r.notes.push(rel + ":" + (fence.end + 1) + "  预期输出块首行建议写「应看到：」（R3）");
        if (r.status === "PASS") r.status = "WARN";
      }
    }
  }
  return finalize(r);
}

/** 只在「命令上下文」（围栏块内 / 行内代码 / $ 提示行）中提取 rolebox <sub>。 */
function collectRoleboxInvocations(text) {
  const { lines, fences } = analyzeFences(text);
  const inFence = new Set();
  for (const f of fences) for (let i = f.start; i <= f.end; i += 1) inFence.add(i);
  const out = [];
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const contexts = [];
    if (inFence.has(lineNo)) contexts.push(line);
    else {
      for (const span of inlineCodeSpans(line)) contexts.push(span);
      // 只把 "@ " 提示符行当作命令上下文；行首 ">" 是引用块、"#" 是标题，
      // 它们会命中 "rolebox v1.9.0" 这类散文（见 C9 基线误报修复）。
      const cmd = /^\s*\$\s+(.*)$/.exec(line);
      if (cmd) contexts.push(cmd[1]);
    }
    for (const c of contexts) {
      for (const m of c.matchAll(/\brolebox\s+([a-z][a-z0-9-]*)/g)) {
        out.push({ sub: m[1], line: lineNo, text: line.trim() });
      }
    }
  });
  return out;
}

const NEGATION_MARKERS = /不存在|未提供|没有该|已移除|已删除|不再支持|does not exist|not available|removed/;

function checkC9(ctx) {
  const r = makeResult("C9", "CLI 真实性", "每个 rolebox <sub> ∈ " + ctx.ref.subcommands.size + " 个子命令");
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    for (const inv of collectRoleboxInvocations(readText(file))) {
      if (ctx.ref.subcommands.has(inv.sub)) continue;
      if (NEGATION_MARKERS.test(inv.text)) {
        r.notes.push(rel + ":" + inv.line + "  rolebox " + inv.sub + "（同行有否定标记，视为刻意说明）");
        continue;
      }
      addViolation(r, rel + ":" + inv.line + "  rolebox " + inv.sub, rel);
    }
  }
  return finalize(r);
}

function checkC10(ctx) {
  const r = makeResult("C10", "模块路径真实性", "内部实现/贡献/源码索引中的每个 src/… 存在于参考仓库");
  if (!ctx.ref.available) { r.status = "SKIP"; r.notes.push("参考仓库不存在"); return r; }
  const tokenRe = /src\/[A-Za-z0-9_./\-[\]]+/g;
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (ARCHIVE_PATTERN.test(rel)) continue;
    if (!INTERNAL_STYLE_PAGES.some((re) => re.test(rel))) continue;
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      for (const m of line.matchAll(tokenRe)) {
        let p = m[0].replace(/[.,;:、。，；：)）】"']+$/, "");
        p = p.replace(/:\d+$/, "");
        if (/[[\]*<>{}]/.test(p) || p.endsWith("/")) {
          const dir = p.replace(/[[\]*<>{}]/g, "").replace(/\/+$/, "");
          if (dir && !fs.existsSync(path.join(ctx.ref.dir, dir))) {
            addViolation(r, rel + ":" + (i + 1) + "  " + p + "（目录不存在）", rel);
          }
          continue;
        }
        const abs = path.join(ctx.ref.dir, p);
        if (fs.existsSync(abs) || fs.existsSync(abs + ".ts") || fs.existsSync(abs + ".md") || fs.existsSync(abs + "/index.ts")) continue;
        addViolation(r, rel + ":" + (i + 1) + "  " + p + "（不存在）", rel);
      }
    });
  }
  return finalize(r);
}

function checkC11(ctx) {
  const r = makeResult("C11", "工具名对账", "graph_*/lsp_* 行内引用与标题工具名 ∈ 注册集合");
  // 注册集合来自参考仓库；缺失时只剩 graph_* 兜底清单，会把全部 lsp_* 判成违规，
  // 因此这里与 C9/C10 一致地报 SKIP，而不是误报 FAIL。
  if (!ctx.ref.available) { r.status = "SKIP"; r.notes.push("参考仓库不存在"); return r; }
  const tools = ctx.ref.tools;
  const prefixes = new Set();
  for (const t of tools) {
    const idx = t.indexOf("_");
    if (idx > 0) prefixes.add(t.slice(0, idx));
  }
  const known = (t) => tools.has(t) || RETIRED_TOOL_KEYS.has(t) || NON_TOOL_IDENTIFIERS.has(t);
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const { masked } = analyzeFences(readText(file));
    masked.forEach((line, i) => {
      for (const span of inlineCodeSpans(line)) {
        const token = span.trim();
        if (!/^(graph|lsp)_[a-z0-9_]+$/.test(token)) continue;
        if (tools.has(token) || NON_TOOL_IDENTIFIERS.has(token)) continue;
        addViolation(r, rel + ":" + (i + 1) + "  行内 " + token + " 不在注册集合内", rel);
      }
    });
    if (ARCHIVE_PATTERN.test(rel)) continue;
    for (const h of headingList(masked)) {
      const tokens = new Set([
        ...inlineCodeSpans(h.text).map((s) => s.trim()),
        ...[...h.text.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)].map((m) => m[1]),
      ]);
      for (const token of tokens) {
        if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(token)) continue;
        if (!prefixes.has(token.slice(0, token.indexOf("_")))) continue;
        if (known(token)) continue;
        addViolation(r, rel + ":" + h.line + "  标题 " + token + " 不在注册集合内", rel);
      }
    }
  }
  return finalize(r);
}

function checkC12(ctx) {
  const r = makeResult("C12", "版本备注真实性", "每条版本备注对应 CHANGELOG 的 ## X.Y.Z；页级备注 ≤1");
  if (!ctx.ref.available || ctx.ref.versions.size === 0) { r.status = "SKIP"; r.notes.push("参考仓库或 CHANGELOG 不可用"); return r; }
  const versionRe = /\bv?(\d+\.\d+\.\d+)\b/g;
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const { masked } = analyzeFences(readText(file));
    let noteCount = 0;
    masked.forEach((line, i) => {
      if (!/^\s*>/.test(line)) return;
      const versions = [...line.matchAll(versionRe)].map((m) => m[1]);
      if (versions.length === 0) return;
      noteCount += 1;
      for (const v of versions) {
        if (!ctx.ref.versions.has(v)) addViolation(r, rel + ":" + (i + 1) + "  v" + v + " 不是 CHANGELOG 中的版本标题", rel);
      }
      if (!/自\s*v?\d+\.\d+\.\d+\s*起/.test(line) && !VERSION_NOTE_EXEMPT.has(rel) && !ARCHIVE_PATTERN.test(rel)) {
        r.notes.push(rel + ":" + (i + 1) + "  版本备注建议写成「> 自 vX.Y.Z 起，…」（R7）");
        if (r.status === "PASS") r.status = "WARN";
      }
    });
    if (noteCount > 1 && !VERSION_NOTE_EXEMPT.has(rel) && !ARCHIVE_PATTERN.test(rel)) {
      addViolation(r, rel + "  页级版本备注 " + noteCount + " 条 > 1（P4/R7）", rel);
    }
  }
  return finalize(r);
}

function checkC13(ctx) {
  const r = makeResult("C13", "移除词汇白名单", "collaboration: / termination_conditions / Termination* 仅允许 3 页");
  const patterns = [/collaboration:/g, /termination_conditions/g, /\bTermination[A-Za-z]*/g];
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (REMOVED_VOCAB_WHITELIST.has(rel)) continue;
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) addViolation(r, rel + ":" + (i + 1) + "  " + m[0], rel);
      }
    });
  }
  return finalize(r);
}

function checkC14(ctx) {
  const r = makeResult("C14", "导航完整性", "nav/sidebar 链接可达 + docs/**/*.md ∈ 侧边栏 ∪ allowlist");
  if (!isFile(VITEPRESS_CONFIG)) { r.status = "SKIP"; r.notes.push("缺少 " + relFromRoot(VITEPRESS_CONFIG)); return r; }
  const cfg = readText(VITEPRESS_CONFIG);
  const links = [...cfg.matchAll(/link:\s*"([^"]+)"/g)].map((m) => m[1]);
  const internal = new Set();
  for (const l of links) {
    if (!l.startsWith("/") || l.startsWith("//")) continue;
    internal.add(l.split("#")[0].replace(/\/+$/, "") || "/");
  }
  const resolveLink = (url) => {
    if (url === "/" || url === "") return path.join(DOCS_DIR, "index.md");
    const p = path.join(DOCS_DIR, url.replace(/^\//, ""));
    if (fs.existsSync(p + ".md")) return p + ".md";
    if (fs.existsSync(path.join(p, "index.md"))) return path.join(p, "index.md");
    return null;
  };
  for (const url of internal) {
    if (!resolveLink(url)) addViolation(r, relFromRoot(VITEPRESS_CONFIG) + "  link " + url + " 无对应页面", relFromRoot(VITEPRESS_CONFIG));
  }

  const allMd = walkFiles(DOCS_DIR).filter((f) => f.endsWith(".md"));
  const pageUrl = (file) => {
    const rel = relFromRoot(file).replace(/^docs\//, "").replace(/\.md$/, "");
    return rel === "index" ? "/" : "/" + rel;
  };
  // 锚点索引：exact = VitePress 风格的 slug；loose = 去掉全部标点后的小写形式，
  // 用于吸收中英文括号/标点差异，避免把正常锚点误报为断链。
  const looseSlug = (s) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const anchorIndex = new Map();
  for (const f of allMd) {
    const { masked } = analyzeFences(readText(f));
    const heads = headingList(masked);
    anchorIndex.set(pageUrl(f), {
      exact: new Set(heads.map((h) => slugifyHeading(h.text))),
      loose: new Set(heads.map((h) => looseSlug(h.text))),
    });
  }
  for (const file of allMd) {
    const rel = relFromRoot(file);
    const { lines } = analyzeFences(readText(file));
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\[[^\]]*\]\((\/[^)\s]*)\)/g)) {
        const rawLink = m[1];
        if (rawLink.startsWith("//")) continue;
        const hashIdx = rawLink.indexOf("#");
        const pathPart = hashIdx >= 0 ? rawLink.slice(0, hashIdx) : rawLink;
        const anchor = hashIdx >= 0 ? rawLink.slice(hashIdx + 1) : "";
        const target = resolveLink(pathPart.replace(/\/+$/, "") || "/");
        if (!target) { addViolation(r, rel + ":" + (i + 1) + "  链接 " + rawLink + " 无对应页面", rel); continue; }
        if (anchor) {
          const slugs = anchorIndex.get(pageUrl(target));
          const decoded = decodeURIComponent(anchor);
          const hit = slugs && (slugs.exact.has(decoded.toLowerCase()) || slugs.loose.has(looseSlug(decoded)));
          if (slugs && !hit) {
            r.notes.push(rel + ":" + (i + 1) + "  跨页锚点 #" + anchor + " 未在目标页找到（R12 建议只链接页面路径）");
            if (r.status === "PASS") r.status = "WARN";
          }
        }
      }
    });
  }
  for (const f of allMd) {
    const rel = relFromRoot(f);
    if (NON_NAV_ALLOWLIST.has(rel)) continue;
    const normalized = pageUrl(f) === "/" ? "/" : pageUrl(f).replace(/\/+$/, "");
    if (internal.has(normalized)) continue;
    addViolation(r, rel + "  不在侧边栏（且不在非导航 allowlist 中）", rel);
  }
  return finalize(r);
}

const C15_PAGES = new Set(["docs/03-Reference/role-yaml.md", "docs/03-Reference/dispatch-config.md"]);

function yamlBlocks(text) {
  return analyzeFences(text).fences.filter((f) => f.lang === "yaml" || f.lang === "yml");
}

function checkC15(ctx) {
  const r = makeResult("C15", "role.yaml 键真实性", "role.yaml 顶层键 ∈ RoleConfig；dispatch: 子键 ∈ loader 白名单");
  if (!ctx.ref.available || ctx.ref.roleConfigKeys.size === 0) { r.status = "SKIP"; r.notes.push("参考仓库或 RoleConfig 不可用"); return r; }
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    if (!C15_PAGES.has(rel)) continue;
    const text = readText(file);
    const lines = text.split("\n");
    for (const block of yamlBlocks(text)) {
      if (/model_aliases\s*:/.test(block.body.join("\n"))) continue;
      const contextBefore = lines.slice(Math.max(0, block.start - 5), block.start - 1).join("\n");
      if (/错误|无效|不支持|不要|❌/.test(contextBefore)) continue;
      block.body.forEach((line, idx) => {
        const top = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
        if (!top) return;
        const key = top[1];
        if (!ctx.ref.roleConfigKeys.has(key)) {
          addViolation(r, rel + ":" + (block.start + 1 + idx) + "  顶层键 " + key + " 不在 RoleConfig 中", rel);
        }
        if (key !== "dispatch" || ctx.ref.dispatchKeys.size === 0) return;
        for (let j = idx + 1; j < block.body.length; j += 1) {
          const child = block.body[j];
          if (!/^\s+\S/.test(child)) break;
          const m = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(child);
          if (m && !ctx.ref.dispatchKeys.has(m[1])) {
            addViolation(r, rel + ":" + (block.start + 1 + j) + "  dispatch." + m[1] + " 不在 loader 白名单内", rel);
          }
        }
      });
    }
  }
  return finalize(r);
}

function checkC16(ctx) {
  const r = makeResult("C16", "extensions 键集", "extensions: 块键集 == " + ctx.ref.extensions.size + " 个 ExtensionScope");
  if (!ctx.ref.available || ctx.ref.extensions.size === 0) { r.status = "SKIP"; r.notes.push("参考仓库或 ExtensionScope 不可用"); return r; }
  const seen = new Set();
  let blocks = 0;
  for (const file of ctx.mdFiles) {
    const text = readText(file);
    for (const block of yamlBlocks(text)) {
      block.body.forEach((line, idx) => {
        if (!/^extensions\s*:\s*$/.test(line)) return;
        blocks += 1;
        for (let j = idx + 1; j < block.body.length; j += 1) {
          const child = block.body[j];
          if (!/^\s+\S/.test(child)) break;
          const m = /^  ([a-z_][a-z0-9_]*)\s*:/.exec(child);
          if (m) seen.add(m[1]);
        }
      });
    }
  }
  if (blocks === 0) { r.status = "SKIP"; r.notes.push("所选文件中没有 extensions: 块"); return r; }
  for (const key of seen) if (!ctx.ref.extensions.has(key)) addViolation(r, "extensions: 块中的未知作用域 " + key, "(site)");
  for (const key of ctx.ref.extensions) if (!seen.has(key)) addViolation(r, "extensions: 块缺少作用域 " + key, "(site)");
  return finalize(r);
}

// ── 输出 ─────────────────────────────────────────────────────────────────────

function printResult(r) {
  const bits = [];
  if (r.status !== "SKIP") bits.push("计数 " + r.count);
  if (r.files.size > 0) bits.push(r.files.size + " 文件");
  if (r.status === "WARN") bits.push("见备注");
  process.stdout.write([r.id.padEnd(3), r.status.padEnd(4), r.title.padEnd(16), bits.join(" · ")].join(" ").trimEnd() + "\n");
  if (r.detail) process.stdout.write("     判据：" + r.detail + "\n");
  for (const s of r.samples) process.stdout.write("     · " + s + "\n");
  if (r.count > r.samples.length) process.stdout.write("     · …（其余 " + (r.count - r.samples.length) + " 处省略）\n");
  for (const n of r.notes.slice(0, 5)) process.stdout.write("     ~ " + n + "\n");
  if (r.notes.length > 5) process.stdout.write("     ~ …（其余 " + (r.notes.length - 5) + " 条备注省略）\n");
}

function printRegistry(facts) {
  const line = (label, value) => process.stdout.write(label.padEnd(22) + value + "\n");
  process.stdout.write("参考仓库：" + facts.dir + (facts.available ? "" : "（不可用）") + "\n");
  line("CHANGELOG 版本", [...facts.versions].join(", ") || "(无)");
  line("CLI 子命令", [...facts.subcommands].sort().join(", ") || "(无)");
  line("工具键（" + facts.tools.size + "）", [...facts.tools].sort().join(", "));
  line("ExtensionScope", [...facts.extensions].sort().join(", ") || "(无)");
  line("RoleConfig 顶层键", [...facts.roleConfigKeys].sort().join(", ") || "(无)");
  line("dispatch 白名单", [...facts.dispatchKeys].join(", ") || "(无)");
  for (const n of facts.notes) process.stdout.write("备注：" + n + "\n");
}

/**
 * C17 —— frontmatter 必须能被真实 YAML 解析器解析。
 *
 * 动机（这是一次真实事故的回归防护）：parseFrontmatter() 是逐行正则读取器，
 * 会把未加引号、值里含 ": " 的标量当成普通字符串照单全收。VitePress 用的是
 * 真正的 YAML 解析器，遇到同样的输入会直接抛
 *   "incomplete explicit mapping pair; a key node is missed; ..."
 * 并让整站红屏。docs/04-Advanced/graph-declaration.md 的 description 曾出现
 * `...规范——graph: 信封、version...` 且未加引号，C5 判 PASS 而站点是坏的。
 * 因此这里改用真实解析器复核：任何 YAML 语法错误都判 FAIL。
 */
function checkC17(ctx) {
  const r = makeResult("C17", "frontmatter 可被 YAML 解析", "每页 frontmatter 能被真实 YAML 解析器解析，且 top-level 为映射");
  if (!YAML) {
    r.status = "SKIP";
    r.notes.push("未找到 js-yaml / yaml，跳过（运行 npm install 后重试）");
    return finalize(r);
  }
  const load = typeof YAML.load === "function" ? YAML.load.bind(YAML) : YAML.parse.bind(YAML);
  for (const file of ctx.mdFiles) {
    const rel = relFromRoot(file);
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readText(file));
    if (!m) continue; // 缺少 frontmatter 由 C5 负责
    try {
      const doc = load(m[1]);
      if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
        addViolation(r, rel + "  frontmatter 解析结果不是映射", rel);
      }
    } catch (err) {
      const raw = String((err && err.message) || err);
      const first = raw.split("\n")[0];
      const line = err && err.mark && typeof err.mark.line === "number" ? err.mark.line + 1 : "?";
      addViolation(r, rel + "  frontmatter 第 " + line + " 行 YAML 语法错误：" + first, rel);
    }
  }
  return finalize(r);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgv(process.argv.slice(2));
  if (opts.help) { process.stdout.write(usage() + "\n"); process.exit(0); }

  const facts = extractRefFacts(opts.ref);
  if (opts.printRegistry) { printRegistry(facts); process.exit(0); }

  const scope = expandScope(opts.paths);
  if (scope.missing.length > 0) die("--paths 指向不存在的路径：\n  " + scope.missing.join("\n  "));
  if (scope.md.length === 0) die("检查范围为空（没有 .md 文件）");

  const ctx = { ref: facts, mdFiles: scope.md, extraFiles: scope.extra };

  process.stdout.write("rolebox-docs house-style check\n");
  process.stdout.write("  范围：" + (scope.scoped ? "--paths（" + scope.md.length + " 个 markdown 文件）" : "全站 docs/**/*.md（" + scope.md.length + " 个文件）") + "\n");
  process.stdout.write("  参考：" + facts.dir + (facts.available ? "" : "（不可用，相关检查 SKIP）") + "\n");
  process.stdout.write("  契约：HOUSE-STYLE.md / restructure-strategy.txt §4、§9\n\n");

  const results = [
    checkC1(ctx), checkC2(ctx), checkC3(ctx), checkC4(ctx),
    checkC5(ctx), checkC6(ctx), checkC7(ctx), checkC8(ctx),
    checkC9(ctx), checkC10(ctx), checkC11(ctx), checkC12(ctx),
    checkC13(ctx), checkC14(ctx), checkC15(ctx), checkC16(ctx),
    checkC17(ctx),
  ];

  for (const r of results) printResult(r);

  const tally = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
  for (const r of results) tally[r.status] += 1;

  process.stdout.write("\n" + "-".repeat(64) + "\n");
  process.stdout.write("合计 " + results.length + " 项：PASS " + tally.PASS + "，FAIL " + tally.FAIL + "，WARN " + tally.WARN + "，SKIP " + tally.SKIP + "\n");
  if (tally.FAIL > 0) {
    process.stdout.write("结果：FAIL（" + results.filter((r) => r.status === "FAIL").map((r) => r.id).join(", ") + "）— 退出码 1\n");
    process.exit(1);
  }
  process.stdout.write("结果：通过（无 FAIL）— 退出码 0\n");
  process.exit(0);
}

main();
