#!/usr/bin/env node
/**
 * brand-gate.mjs — agentplain brand regression gate
 *
 * Zero external dependencies. Node 18+.
 *
 * Usage:
 *   node tools/brand/brand-gate.mjs            # ratchet mode (fails only on NEW violations vs baseline)
 *   node tools/brand/brand-gate.mjs --all      # fail on ALL violations (no baseline filter)
 *   node tools/brand/brand-gate.mjs --baseline # write current violations to brand-gate-baseline.json and exit 0
 *   node tools/brand/brand-gate.mjs --json     # JSON output (ratchet mode)
 *   node tools/brand/brand-gate.mjs --all --json
 *
 * Rules checked:
 *   R1 — Vendor names (Claude/Anthropic/ChatGPT/OpenAI/GPT-N) in rendered customer copy
 *   R2 — PLACEHOLDER text in public brand assets and ap/ components
 *   R3 — Off-token hex colors in customer surfaces; rounded-* and shadow-* Tailwind drift
 *   R4 — Banned marketing words (SMB, seamless, leverage, etc.) in rendered copy
 *
 * Comment stripping: line comments (//...) and block comments (/* ... *\/) and
 * JSX comments ({/* ... *\/}) are stripped before matching, so documentation
 * about the rule itself does not trigger a violation.
 * LIMITATION: nested template-literal strings that contain comment-like sequences
 * are not handled — pragmatic for our source files which don't use that pattern.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const ALLOWLIST_PATH = join(__dirname, "brand-gate-allow.json");
const BASELINE_PATH = join(__dirname, "brand-gate-baseline.json");

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const FLAG_BASELINE = args.includes("--baseline");
const FLAG_ALL = args.includes("--all");
const FLAG_JSON = args.includes("--json");

// ─── Canonical hex token set ─────────────────────────────────────────────────
// Source: lib/brand/tokens.ts + app/globals.css derived values.
// Add new ratified tokens here when the design system grows.

const CANONICAL_HEX = new Set([
  // Spec tokens (lib/brand/tokens.ts)
  "#F7F4ED", // paper
  "#EDE9DE", // paper-deep
  "#1A1A1F", // ink
  "#2E2E33", // ink-soft
  "#B65D3A", // clay
  "#9A4D2F", // clay-deep
  "#3F5C3F", // moss
  "#B43A3A", // flag
  "#726A5E", // mute
  "#E0DAC9", // rule
  // Additional derived values ratified in globals.css / component usage
  "#F7F4ED",
  "#D9D5C7", // mid-rule
]);

// Deprecated tokens — always flagged even if in the canonical-adjacent zone.
// #8C8478 was the pre-WCAG mute; replaced by #726A5E (tokens.ts §4).
const DEPRECATED_HEX = new Set(["#8C8478", "#8c8478"]);

// ─── File lists ──────────────────────────────────────────────────────────────

// CUSTOMER_SURFACES: files scanned for all four rules.
// These directories are the public-facing product + marketing layers.
function buildSurfaceFiles() {
  const globs = [
    // Marketing + product app layers
    join(REPO_ROOT, "app", "(marketing)"),
    join(REPO_ROOT, "app", "(product)"),
    // All shared components (excluding operator shell)
    join(REPO_ROOT, "components"),
    // Plaino prompt files — operator instructions that shape customer-visible chat
    ...walkGlob(join(REPO_ROOT, "lib", "plaino"), /^(?!.*\.test\.).*\.ts$/),
    // Per-vertical content files
    ...walkVerticalContent(join(REPO_ROOT, "lib", "verticals")),
    // Email template files (customer-received HTML)
    "lib/auth/resend-provider.ts",
    "lib/skills/briefing-generator/email.ts",
    "lib/measurement/weekly-digest-email.ts",
    "lib/inngest/functions/trial-expiration-warnings.ts",
    "lib/billing/abandoned-signup.ts",
    "lib/custom-inquiry/index.ts",
    // Top-level app metadata
    "app/manifest.ts",
    "app/layout.tsx",
    "app/opengraph-image.tsx",
  ].flatMap((p) => {
    if (typeof p === "string" && !p.startsWith("/") && !p.match(/^[A-Z]:\\/i)) {
      return [join(REPO_ROOT, p)];
    }
    return existsSync(p) ? (statSync(p).isDirectory() ? walk(p, /\.(ts|tsx)$/) : [p]) : [];
  });
  return [...new Set(globs)];
}

// Files for R2 placeholder check: public brand SVGs + ap/ components
function buildPlaceholderFiles() {
  return [
    ...walk(join(REPO_ROOT, "public", "brand"), /\.(svg|png|jpg|webp)$/),
    ...walk(join(REPO_ROOT, "components", "ui", "ap"), /\.(ts|tsx)$/),
  ];
}

// Files for OG/public SVG vendor check
function buildOgFiles() {
  return [
    ...walk(join(REPO_ROOT, "public", "og"), /\.svg$/),
    ...walk(join(REPO_ROOT, "public", "brand"), /\.svg$/),
    join(REPO_ROOT, "app", "(marketing)", "[vertical]", "opengraph-image.tsx"),
  ].filter(existsSync);
}

// ─── Comment stripping ───────────────────────────────────────────────────────

/**
 * Strip JS/TS/JSX comments from source before matching.
 * - Block comments: /* ... *\/
 * - JSX block comments: {/* ... *\/}
 * - Line comments: //...
 *
 * LIMITATION: This is line-based. It does not handle comments embedded inside
 * template-literal strings (which are not rendered to customers in our codebase).
 */
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ") // {/* JSX block */}
    .replace(/\/\*[\s\S]*?\*\//g, " ") // /* block */
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comment
}

// ─── Allowlist ───────────────────────────────────────────────────────────────

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
}

/**
 * Returns true if this violation is allowlisted.
 * An allowlist entry matches when the file path contains entry.path
 * AND the matched text matches entry.pattern (string substring or regex string).
 */
function isAllowlisted(allowlist, filePath, matchedText) {
  const rel = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
  for (const entry of allowlist) {
    const pathMatch = rel.includes(entry.path);
    if (!pathMatch) continue;
    if (entry.pattern) {
      const re = new RegExp(entry.pattern);
      if (re.test(matchedText)) return true;
    } else {
      return true;
    }
  }
  return false;
}

// ─── Rule engine ─────────────────────────────────────────────────────────────

/**
 * A violation:
 * { rule, file (abs), line, col, match, message }
 */

function scanLines(filePath, src, rules, allowlist) {
  const stripped = stripComments(src);
  const lines = stripped.split("\n");
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { id, pattern, message } of rules) {
      let m;
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      while ((m = re.exec(line)) !== null) {
        if (isAllowlisted(allowlist, filePath, m[0])) continue;
        violations.push({
          rule: id,
          file: filePath,
          line: i + 1,
          col: m.index + 1,
          match: m[0],
          message,
        });
      }
    }
  }
  return violations;
}

// Rule R1 — vendor names in customer copy
const R1_RULES = [
  {
    id: "R1",
    pattern: /\b(Claude|Anthropic|ChatGPT|OpenAI|GPT-?[0-9o])\b/,
    message: "LLM vendor name leaked into customer-rendered surface",
  },
];

// Rule R2 — placeholder text (checked against raw source, no comment strip needed)
const R2_RULES = [
  {
    id: "R2",
    pattern: /PLACEHOLDER/i,
    message: "PLACEHOLDER text found in brand asset or ap/ component",
  },
  {
    id: "R2",
    pattern: /awaiting real asset/i,
    message: "Placeholder sentinel 'awaiting real asset' found in brand asset",
  },
];

// Rule R3a — off-token hex colors
// We match 3-digit and 6-digit hex colors (#RGB, #RRGGBB). Normalise to uppercase for set lookup.
function scanHexColors(filePath, src, allowlist) {
  const stripped = stripComments(src);
  const lines = stripped.split("\n");
  const violations = [];
  // Match hex colors: #RRGGBB or #RGB (not inside a word)
  const HEX_RE = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  for (let i = 0; i < lines.length; i++) {
    let m;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(lines[i])) !== null) {
      const raw = m[0];
      const upper = raw.toUpperCase();
      // Expand 3-digit to 6-digit for comparison
      const sixDigit = upper.length === 4
        ? "#" + upper[1] + upper[1] + upper[2] + upper[2] + upper[3] + upper[3]
        : upper;
      // Always flag deprecated hex regardless of allowlist for hex
      if (DEPRECATED_HEX.has(raw) || DEPRECATED_HEX.has(upper)) {
        if (!isAllowlisted(allowlist, filePath, raw)) {
          violations.push({
            rule: "R3",
            file: filePath,
            line: i + 1,
            col: m.index + 1,
            match: raw,
            message: `Deprecated hex ${raw} (replaced by #726A5E mute — WCAG AA; update to brand token)`,
          });
        }
        continue;
      }
      // Check against canonical set (both raw and upper normalised)
      if (!CANONICAL_HEX.has(raw) && !CANONICAL_HEX.has(upper) && !CANONICAL_HEX.has(sixDigit)) {
        if (!isAllowlisted(allowlist, filePath, raw)) {
          violations.push({
            rule: "R3",
            file: filePath,
            line: i + 1,
            col: m.index + 1,
            match: raw,
            message: `Off-token hex ${raw} — not in canonical brand token set (lib/brand/tokens.ts)`,
          });
        }
      }
    }
  }
  return violations;
}

// Rule R3b — rounded-* and shadow-* Tailwind drift
const R3_TAILWIND_RULES = [
  {
    id: "R3",
    pattern: /\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/,
    message: "Tailwind rounded-* class — agentplain uses square corners (remove or allowlist if intentional)",
  },
  {
    id: "R3",
    pattern: /\bshadow-(sm|md|lg|xl|2xl)\b/,
    message: "Tailwind shadow-* class — use brand shadow tokens or custom shadow-[ values",
  },
];

// Rule R4 — banned marketing words
const R4_RULES = [
  {
    id: "R4",
    // SMB is case-sensitive; others are case-insensitive (handled below)
    pattern: /\bSMB\b/,
    message: "Banned word 'SMB' in customer copy — use 'local businesses' or 'local business owner'",
  },
  {
    id: "R4",
    pattern: /\bknowledge workers?\b/i,
    message: "Banned phrase 'knowledge workers' — agentplain serves local businesses, not knowledge workers",
  },
  {
    id: "R4",
    pattern: /\bleverage\b/i,
    message: "Banned buzzword 'leverage' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bsynergy\b/i,
    message: "Banned buzzword 'synergy' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bdisruptiv/i,
    message: "Banned buzzword 'disruptive/disruption' in customer copy",
  },
  {
    id: "R4",
    pattern: /\brevolutionar/i,
    message: "Banned buzzword 'revolutionary/revolutionize' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bnext-gen\b/i,
    message: "Banned buzzword 'next-gen' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bcutting-edge\b/i,
    message: "Banned buzzword 'cutting-edge' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bsupercharge\b/i,
    message: "Banned buzzword 'supercharge' in customer copy",
  },
  {
    id: "R4",
    pattern: /\bseamless\b/i,
    message: "Banned buzzword 'seamless' in customer copy",
  },
];

// ─── Orchestration ────────────────────────────────────────────────────────────

function runGate() {
  const allowlist = loadAllowlist();
  const violations = [];

  // R1 + R4: customer surfaces (comment-stripped)
  const surfaceFiles = buildSurfaceFiles();
  for (const f of surfaceFiles) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    violations.push(...scanLines(f, src, R1_RULES, allowlist));
    violations.push(...scanLines(f, src, R4_RULES, allowlist));
    // R3 hex + tailwind on customer surfaces
    violations.push(...scanHexColors(f, src, allowlist));
    violations.push(...scanLines(f, src, R3_TAILWIND_RULES, allowlist));
  }

  // R1 on OG/SVG files
  for (const f of buildOgFiles()) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    violations.push(...scanLines(f, src, R1_RULES, allowlist));
  }

  // R2: placeholder files (no comment stripping — we want PLACEHOLDER in SVG text nodes)
  for (const f of buildPlaceholderFiles()) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    violations.push(...scanLines(f, src, R2_RULES, allowlist));
  }

  // Deduplicate (same file+line+rule+match)
  const seen = new Set();
  const deduped = violations.filter((v) => {
    const key = `${v.rule}|${v.file}|${v.line}|${v.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: rule → file → line
  deduped.sort((a, b) => {
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  return deduped;
}

// ─── Baseline ratchet ─────────────────────────────────────────────────────────

function violationKey(v) {
  return `${v.rule}|${relative(REPO_ROOT, v.file).replace(/\\/g, "/")}|${v.line}|${v.match}`;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return new Set((data.violations || []).map(violationKey));
}

// ─── Output ───────────────────────────────────────────────────────────────────

function formatViolations(violations, label) {
  if (violations.length === 0) return "";
  const grouped = {};
  for (const v of violations) {
    (grouped[v.rule] = grouped[v.rule] || []).push(v);
  }
  const lines = [`\n${label} — ${violations.length} violation(s):\n`];
  for (const rule of Object.keys(grouped).sort()) {
    lines.push(`  ${rule}:`);
    for (const v of grouped[rule]) {
      const rel = relative(REPO_ROOT, v.file).replace(/\\/g, "/");
      lines.push(`    ${rel}:${v.line}:${v.col}  ${v.match}`);
      lines.push(`      → ${v.message}`);
    }
  }
  return lines.join("\n");
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const allViolations = runGate();

if (FLAG_BASELINE) {
  // Write current state as the new baseline
  const baseline = {
    generatedAt: new Date().toISOString(),
    note: "Auto-generated by: node tools/brand/brand-gate.mjs --baseline. Shrinks as fix waves land.",
    count: allViolations.length,
    violations: allViolations.map((v) => ({
      rule: v.rule,
      file: relative(REPO_ROOT, v.file).replace(/\\/g, "/"),
      line: v.line,
      match: v.match,
      message: v.message,
    })),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`brand-gate --baseline: wrote ${allViolations.length} violation(s) to tools/brand/brand-gate-baseline.json`);
  process.exit(0);
}

// Ratchet: filter to only NEW violations (not in baseline) unless --all
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

// Human-readable output
const byCounts = {};
for (const v of allViolations) byCounts[v.rule] = (byCounts[v.rule] || 0) + 1;

if (activeViolations.length === 0) {
  console.log(`brand-gate OK — ${allViolations.length} known baseline violation(s); 0 new.`);
  console.log(`  Baseline: ${baselineCount} | Found: ${allViolations.length} | New: 0`);
  process.exit(0);
}

const label = FLAG_ALL
  ? "BRAND GATE FAILED (--all mode)"
  : "BRAND GATE FAILED — new violation(s) not in baseline";
console.error(formatViolations(activeViolations, label));

// Summary
const rulesHit = [...new Set(activeViolations.map((v) => v.rule))].sort();
console.error(`\nSummary: ${activeViolations.length} new violation(s) across rules: ${rulesHit.join(", ")}`);
if (!FLAG_ALL) {
  console.error(`  (${allViolations.length - activeViolations.length} violation(s) suppressed by baseline — run with --baseline to reset after fixes land)`);
}
console.error(`\nSee docs/brand/brand-gate.md for remediation + allowlist workflow.`);
process.exit(1);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function walk(dir, pattern) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const out = [];
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full, pattern));
    } else if (pattern ? pattern.test(name) : true) {
      out.push(full);
    }
  }
  return out;
}

function walkGlob(dir, namePattern) {
  if (!existsSync(dir)) return [];
  return walk(dir, namePattern);
}

function walkVerticalContent(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const content = join(full, "content.ts");
      if (existsSync(content)) out.push(content);
    }
  }
  return out;
}
