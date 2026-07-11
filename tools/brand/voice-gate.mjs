#!/usr/bin/env node
/**
 * voice-gate.mjs — agentplain de-AI-fication voice gate
 *
 * Zero external dependencies. Node 18+.
 *
 * Companion to brand-gate.mjs. Where brand-gate owns HYPE (rule R4: supercharge,
 * seamless, leverage, …), this gate owns LLM-ESE — the mechanical fingerprints of
 * machine-written prose that survive a hype scrub and still feel synthetic. The two
 * gates do NOT overlap: family E (hype) is brand-gate's; families A–D are this gate's.
 *
 * Source of truth for the catalog: docs/brand/voice-guidelines-2026-06-19.md §3.
 *
 * Usage:
 *   node tools/brand/voice-gate.mjs            # ratchet mode (fails only on NEW violations vs baseline)
 *   node tools/brand/voice-gate.mjs --all      # fail on ALL violations (no baseline filter)
 *   node tools/brand/voice-gate.mjs --baseline # freeze current violations to voice-gate-baseline.json, exit 0
 *   node tools/brand/voice-gate.mjs --json     # JSON output (ratchet mode)
 *   node tools/brand/voice-gate.mjs --help
 *
 * Rules checked (customer surfaces only):
 *   VA — LLM-ese vocabulary (delve, tapestry, realm, "navigate the landscape", …)
 *   VB — antithesis reflex ("not just X, it's Y", "more than just")
 *   VC — sycophantic / chatbot register ("Great question!", "dive in", "rest assured", …)
 *   VD — essay scaffolding & launch-ese (Moreover/Furthermore, "Introducing", "Gone are the days", …)
 *   VE — em-dash spam (3+ em-dashes in one rendered line)
 *
 * Comment stripping: JS/TS/JSX comments are stripped before matching on code files, so
 * documentation about a rule does not trip it. Markdown is matched raw (no comment syntax),
 * but the teaching/reference docs that intentionally contain bad examples are excluded by
 * name (see DOC_EXCLUDE).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const ALLOWLIST_PATH = join(__dirname, "voice-gate-allow.json");
const BASELINE_PATH = join(__dirname, "voice-gate-baseline.json");

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const FLAG_BASELINE = args.includes("--baseline");
const FLAG_ALL = args.includes("--all");
const FLAG_JSON = args.includes("--json");
const FLAG_HELP = args.includes("--help") || args.includes("-h");

if (FLAG_HELP) {
  console.log(
    [
      "voice-gate.mjs — agentplain de-AI-fication voice gate",
      "",
      "Lints customer surfaces for AI tics (families A–D + em-dash spam).",
      "Catalog: docs/brand/voice-guidelines-2026-06-19.md §3.",
      "",
      "  (no flags)   ratchet mode — fail only on NEW violations vs baseline",
      "  --all        fail on ALL violations (ignore baseline)",
      "  --baseline   freeze current violations as the baseline, then exit 0",
      "  --json       machine-readable output (ratchet mode unless --all)",
      "  --help       this message",
      "",
      "To suppress a legitimate, intentional usage: add an entry to",
      "tools/brand/voice-gate-allow.json ({ path, pattern }).",
    ].join("\n"),
  );
  process.exit(0);
}

// ─── Surface file lists ────────────────────────────────────────────────────────
// CODE surfaces mirror brand-gate's customer-facing set: the public marketing + product
// layers, shared components, per-vertical content, Plaino prompts, and customer email
// templates. DOC surfaces add the outbound copy that lives as markdown under
// docs/marketing — explicitly named by the de-AI-fication directive.

function buildCodeSurfaceFiles() {
  const dirs = [
    join(REPO_ROOT, "app", "(marketing)"),
    join(REPO_ROOT, "app", "(product)"),
    join(REPO_ROOT, "components"),
    join(REPO_ROOT, "lib", "verticals"),
    // Chiron philosophy packs surface verbatim in parent-facing reasoning traces.
    join(REPO_ROOT, "chiron", "lib", "philosophies"),
  ];
  const plaino = walk(join(REPO_ROOT, "lib", "plaino"), /^(?!.*\.test\.).*\.tsx?$/);
  const emailTemplates = [
    "lib/auth/resend-provider.ts",
    "lib/skills/briefing-generator/email.ts",
    "lib/measurement/weekly-digest-email.ts",
    "lib/inngest/functions/trial-expiration-warnings.ts",
    "lib/billing/abandoned-signup.ts",
    "lib/custom-inquiry/index.ts",
  ].map((p) => join(REPO_ROOT, p));
  const files = [
    ...dirs.flatMap((d) => walk(d, /\.(ts|tsx)$/)),
    ...plaino,
    ...emailTemplates,
  ].filter(existsSync);
  // Skip colocated tests (mirror brand-gate intent; tests carry deliberate bad strings).
  return [...new Set(files)].filter((f) => !/\.test\.(ts|tsx)$/.test(f));
}

// Teaching / reference docs that intentionally hold the bad examples + banned-word lists.
// Scanning these would bloat the baseline with non-copy. Matched by basename.
const DOC_EXCLUDE = new Set([
  "brand-voice-scenario-library.md",
  "CREATIVE_PACK_GROUND_TRUTH.md",
  "CLAIMS_GROUND_TRUTH.md",
]);

function buildDocSurfaceFiles() {
  return walk(join(REPO_ROOT, "docs", "marketing"), /\.md$/).filter(
    (f) => !DOC_EXCLUDE.has(basename(f)) && !/GROUND_TRUTH/i.test(basename(f)),
  );
}

// ─── Comment stripping (code only) ─────────────────────────────────────────────

// Block comments are blanked in place (newlines preserved) so line numbers stay accurate.
function stripComments(src) {
  const blankButKeepNewlines = (m) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blankButKeepNewlines) // {/* JSX block */}
    .replace(/\/\*[\s\S]*?\*\//g, blankButKeepNewlines) // /* block */
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comment
}

// ─── Allowlist ───────────────────────────────────────────────────────────────

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
}

function isAllowlisted(allowlist, filePath, matchedText) {
  const rel = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
  for (const entry of allowlist) {
    if (!rel.includes(entry.path)) continue;
    if (entry.pattern) {
      if (new RegExp(entry.pattern, "i").test(matchedText)) return true;
    } else {
      return true;
    }
  }
  return false;
}

// ─── Rules ─────────────────────────────────────────────────────────────────────
// Family E (hype) is intentionally ABSENT — brand-gate.mjs R4 owns it.

// VA — LLM-ese vocabulary
const VA_RULES = [
  { id: "VA", pattern: /\bdelve\b/i, message: "AI-ese 'delve' — say 'look into' / cut it" },
  { id: "VA", pattern: /\btapestry\b/i, message: "AI-ese 'tapestry' — name the actual thing" },
  { id: "VA", pattern: /\bin the realm of\b/i, message: "AI-ese 'in the realm of' — say 'in' / 'for'" },
  { id: "VA", pattern: /\ba testament to\b/i, message: "AI-ese 'a testament to' — state the fact instead" },
  { id: "VA", pattern: /\bunderscore(s|d)?\b/i, message: "AI-ese 'underscore(s)' as verb — say 'shows' / cut" },
  { id: "VA", pattern: /\bboast(s|ing)?\b/i, message: "AI-ese 'boasts' — say 'has' / 'includes'" },
  { id: "VA", pattern: /\btreasure trove\b/i, message: "AI-ese 'treasure trove' — cut" },
  { id: "VA", pattern: /\b(myriad|plethora)\b/i, message: "AI-ese 'myriad/plethora' — say 'many' or a number" },
  { id: "VA", pattern: /\bbustling\b/i, message: "AI-ese 'bustling' — cut" },
  { id: "VA", pattern: /navigat(e|ing) the (landscape|complexit\w+|world)/i, message: "AI-ese 'navigate the landscape/complexities' — say the specific thing" },
  { id: "VA", pattern: /in today'?s (fast-paced|digital|ever-changing|modern) world/i, message: "AI-ese 'in today's fast-paced world' — cut the framing, lead with the fact" },
  { id: "VA", pattern: /\bever-(evolving|changing)\b/i, message: "AI-ese 'ever-evolving/changing' — cut" },
  { id: "VA", pattern: /\bthe digital (age|landscape)\b/i, message: "AI-ese 'the digital age/landscape' — cut" },
  { id: "VA", pattern: /\bat the forefront\b/i, message: "AI-ese 'at the forefront' — say what you actually do" },
  { id: "VA", pattern: /\bstand out from the crowd\b/i, message: "AI-ese 'stand out from the crowd' — cut" },
  { id: "VA", pattern: /\blook no further\b/i, message: "AI-ese 'look no further' — cut" },
  { id: "VA", pattern: /\brest assured\b/i, message: "AI-ese 'rest assured' — state the fact that should reassure" },
  { id: "VA", pattern: /\bneedless to say\b/i, message: "AI-ese 'needless to say' — then don't say it, or say it plainly" },
  { id: "VA", pattern: /\bit goes without saying\b/i, message: "AI-ese 'it goes without saying' — cut" },
  { id: "VA", pattern: /\bit'?s worth noting\b/i, message: "AI-ese 'it's worth noting' — just note it" },
  { id: "VA", pattern: /\bwhen it comes to\b/i, message: "AI-ese 'when it comes to' — say 'for' / 'with' / rephrase" },
  { id: "VA", pattern: /\bembark on a journey\b/i, message: "AI-ese 'embark on a journey' — cut" },
  { id: "VA", pattern: /\btake it to the next level\b/i, message: "AI-ese 'take it to the next level' — say the concrete outcome" },
  { id: "VA", pattern: /\bharness the power of\b/i, message: "AI-ese 'harness the power of' — say what it does" },
];

// VB — antithesis reflex
const VB_RULES = [
  { id: "VB", pattern: /\bit'?s not (just |merely |only )?[a-z][a-z' ]{1,32}[,—][^.]{0,8}\bit'?s\b/i, message: "Antithesis reflex 'it's not just X, it's Y' — make the specific point instead" },
  { id: "VB", pattern: /\bit'?s not about [a-z][a-z' ]{1,32}[,—][^.]{0,8}\bit'?s about\b/i, message: "Antithesis reflex 'it's not about X, it's about Y' — state the point" },
  { id: "VB", pattern: /\bmore than just\b/i, message: "Antithesis reflex 'more than just' — say what it is, not what it's more than" },
];

// VC — sycophantic / chatbot register
const VC_RULES = [
  { id: "VC", pattern: /\bgreat (question|point)\b/i, message: "Chatbot tic 'Great question/point' — just answer" },
  { id: "VC", pattern: /^(\s*["'`>]*\s*)(absolutely|certainly|sure thing)[!,.]/im, message: "Chatbot opener 'Absolutely!/Certainly!/Sure thing' — answer plainly" },
  { id: "VC", pattern: /\bi'?d (be happy|love) to\b/i, message: "Chatbot tic \"I'd be happy/love to\" — just do it" },
  { id: "VC", pattern: /\bno problem at all\b/i, message: "Chatbot tic 'no problem at all' — cut" },
  { id: "VC", pattern: /\bi hope this (email|message|note) finds you well\b/i, message: "Filler opener 'hope this finds you well' — open on the reader or the fact" },
  { id: "VC", pattern: /\b(let'?s|let me) dive (in|into)\b/i, message: "Chatbot tic 'dive in/into' — just start" },
  { id: "VC", pattern: /\blet'?s get started\b/i, message: "Chatbot tic \"let's get started\" — cut" },
  { id: "VC", pattern: /\b(superstar|rockstar|rock star|champ)\b/i, message: "Don't call people 'superstar/rockstar' — owner-to-owner, not a hype coach" },
];

// VD — essay scaffolding & launch-ese
const VD_RULES = [
  { id: "VD", pattern: /^(\s*["'`>]*\s*)(moreover|furthermore|additionally)\b[,]/im, message: "Essay connective 'Moreover/Furthermore/Additionally' — start a new sentence" },
  { id: "VD", pattern: /^(\s*["'`>]*\s*)in conclusion\b/im, message: "Essay tic 'In conclusion' — cut" },
  { id: "VD", pattern: /^(\s*["'`>]*\s*)ultimately,\s/im, message: "Filler opener 'Ultimately,' — cut or make the point" },
  { id: "VD", pattern: /\bit'?s important to (note|remember|understand) that\b/i, message: "Hedge 'it's important to note that' — just state it" },
  { id: "VD", pattern: /\b(introducing|say hello to|meet)\s+plaino\b/i, message: "Launch-ese 'Introducing/Meet Plaino' — show what it does, don't announce" },
  { id: "VD", pattern: /\bsay goodbye to\b/i, message: "Launch-ese 'Say goodbye to' — cut" },
  { id: "VD", pattern: /\bgone are the days\b/i, message: "Launch-ese 'Gone are the days' — cut" },
  { id: "VD", pattern: /\bimagine a world where\b/i, message: "Rhetorical opener 'Imagine a world where' — cut" },
  { id: "VD", pattern: /\bwhether you'?re an? [a-z' ]{1,30}\bor an? [a-z' ]{1,30}\b/i, message: "Setup 'Whether you're a X or a Y' — address the reader directly" },
];

const WORD_RULES = [...VA_RULES, ...VB_RULES, ...VC_RULES, ...VD_RULES];

// ─── Scanners ────────────────────────────────────────────────────────────────

function scanWordRules(filePath, lines, allowlist) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { id, pattern, message } of WORD_RULES) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      let m;
      while ((m = re.exec(line)) !== null) {
        const matched = (m[2] || m[0]).trim() || m[0];
        if (isAllowlisted(allowlist, filePath, matched)) continue;
        violations.push({ rule: id, file: filePath, line: i + 1, col: m.index + 1, match: matched, message });
        if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width
      }
    }
  }
  return violations;
}

// VE — em-dash spam: 3+ U+2014 in one line. (One or two are fine per the guidelines.)
const EMDASH_THRESHOLD = 3;
function scanEmDashSpam(filePath, lines, allowlist) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const count = (lines[i].match(/—/g) || []).length;
    if (count >= EMDASH_THRESHOLD) {
      if (isAllowlisted(allowlist, filePath, "—")) continue;
      violations.push({
        rule: "VE",
        file: filePath,
        line: i + 1,
        col: lines[i].indexOf("—") + 1,
        match: `${count}×—`,
        message: `Em-dash spam — ${count} em-dashes on one line (max ${EMDASH_THRESHOLD - 1}); break into sentences`,
      });
    }
  }
  return violations;
}

// ─── Orchestration ──────────────────────────────────────────────────────────

function runGate() {
  const allowlist = loadAllowlist();
  const violations = [];

  for (const f of buildCodeSurfaceFiles()) {
    if (!existsSync(f)) continue;
    const lines = stripComments(readFileSync(f, "utf8")).split("\n");
    violations.push(...scanWordRules(f, lines, allowlist));
    violations.push(...scanEmDashSpam(f, lines, allowlist));
  }
  for (const f of buildDocSurfaceFiles()) {
    if (!existsSync(f)) continue;
    const lines = readFileSync(f, "utf8").split("\n"); // markdown: no comment strip
    violations.push(...scanWordRules(f, lines, allowlist));
    violations.push(...scanEmDashSpam(f, lines, allowlist));
  }

  const seen = new Set();
  const deduped = violations.filter((v) => {
    const key = `${v.rule}|${v.file}|${v.line}|${v.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
  return deduped;
}

// ─── Baseline ratchet ───────────────────────────────────────────────────────

function violationKey(v) {
  return `${v.rule}|${relative(REPO_ROOT, v.file).replace(/\\/g, "/")}|${v.line}|${v.match}`;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return new Set((data.violations || []).map(violationKey));
}

// ─── Output ────────────────────────────────────────────────────────────────

function formatViolations(violations, label) {
  if (violations.length === 0) return "";
  const grouped = {};
  for (const v of violations) (grouped[v.rule] = grouped[v.rule] || []).push(v);
  const lines = [`\n${label} — ${violations.length} violation(s):\n`];
  for (const rule of Object.keys(grouped).sort()) {
    lines.push(`  ${rule}:`);
    for (const v of grouped[rule]) {
      const rel = relative(REPO_ROOT, v.file).replace(/\\/g, "/");
      lines.push(`    ${rel}:${v.line}:${v.col}  ${JSON.stringify(v.match)}`);
      lines.push(`      → ${v.message}`);
    }
  }
  return lines.join("\n");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const allViolations = runGate();

if (FLAG_BASELINE) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    note: "Auto-generated by: node tools/brand/voice-gate.mjs --baseline. Shrinks as de-AI-fication fix waves land.",
    catalog: "docs/brand/voice-guidelines-2026-06-19.md §3",
    count: allViolations.length,
    byRule: countByRule(allViolations),
    violations: allViolations.map((v) => ({
      rule: v.rule,
      file: relative(REPO_ROOT, v.file).replace(/\\/g, "/"),
      line: v.line,
      match: v.match,
      message: v.message,
    })),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`voice-gate --baseline: wrote ${allViolations.length} violation(s) to tools/brand/voice-gate-baseline.json`);
  process.exit(0);
}

let activeViolations = allViolations;
let baselineCount = 0;
if (!FLAG_ALL) {
  const baseline = loadBaseline();
  baselineCount = baseline.size;
  activeViolations = allViolations.filter((v) => !baseline.has(violationKey(v)));
}

if (FLAG_JSON) {
  const out = {
    mode: FLAG_ALL ? "all" : "ratchet",
    totalFound: allViolations.length,
    baselineCount,
    newViolations: activeViolations.length,
    byRule: countByRule(activeViolations),
    violations: activeViolations.map((v) => ({
      rule: v.rule,
      file: relative(REPO_ROOT, v.file).replace(/\\/g, "/"),
      line: v.line,
      col: v.col,
      match: v.match,
      message: v.message,
    })),
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(activeViolations.length > 0 ? 1 : 0);
}

if (activeViolations.length === 0) {
  console.log(`voice-gate OK — ${allViolations.length} known baseline violation(s); 0 new.`);
  console.log(`  Baseline: ${baselineCount} | Found: ${allViolations.length} | New: 0`);
  process.exit(0);
}

const label = FLAG_ALL ? "VOICE GATE FAILED (--all mode)" : "VOICE GATE FAILED — new AI-tic(s) not in baseline";
console.error(formatViolations(activeViolations, label));
const rulesHit = [...new Set(activeViolations.map((v) => v.rule))].sort();
console.error(`\nSummary: ${activeViolations.length} new violation(s) across rules: ${rulesHit.join(", ")}`);
if (!FLAG_ALL) {
  console.error(`  (${allViolations.length - activeViolations.length} suppressed by baseline — run with --baseline after fixes land)`);
}
console.error(`\nCatalog + remediation: docs/brand/voice-guidelines-2026-06-19.md §3.`);
console.error(`Intentional usage? Add a { path, pattern } entry to tools/brand/voice-gate-allow.json.`);
process.exit(1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countByRule(violations) {
  const out = {};
  for (const v of violations) out[v.rule] = (out[v.rule] || 0) + 1;
  return out;
}

function walk(dir, pattern) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full, pattern));
    else if (pattern ? pattern.test(name) : true) out.push(full);
  }
  return out;
}
