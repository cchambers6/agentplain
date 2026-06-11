/**
 * brand-gate.test.ts — unit tests for tools/brand/brand-gate.mjs
 *
 * Uses node:test (matching repo conventions from tests/brand.test.ts).
 * Run (Node 24 native TS, no tsx needed):
 *   node --experimental-strip-types --test tests/brand-gate.test.ts
 * Or via tsx when available:
 *   node --import tsx --test tests/brand-gate.test.ts
 *
 * The tests replicate the minimal scanning primitives from brand-gate.mjs so
 * tests stay fast and self-contained — no subprocess overhead for unit tests.
 * Integration/ratchet tests DO spawn the gate script to verify CLI behaviour.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// ESM-safe __dirname (works with --experimental-strip-types and tsx)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, "..");
const FIXTURES = join(__dirname, "fixtures", "brand-gate");
const GATE = join(REPO_ROOT, "tools", "brand", "brand-gate.mjs");
const ALLOWLIST_PATH = join(REPO_ROOT, "tools", "brand", "brand-gate-allow.json");
const BASELINE_PATH = join(REPO_ROOT, "tools", "brand", "brand-gate-baseline.json");

// ─── Minimal scanning helpers (mirrors brand-gate.mjs) ───────────────────────

function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Violation {
  rule: string;
  line: number;
  match: string;
  message: string;
}

function scanLines(
  src: string,
  rules: { id: string; pattern: RegExp; message: string }[],
): Violation[] {
  const stripped = stripComments(src);
  const lines = stripped.split("\n");
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { id, pattern, message } of rules) {
      const re = new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        violations.push({ rule: id, line: i + 1, match: m[0], message });
      }
    }
  }
  return violations;
}

const CANONICAL_HEX = new Set([
  "#F7F4ED", "#EDE9DE", "#1A1A1F", "#2E2E33",
  "#B65D3A", "#9A4D2F", "#3F5C3F", "#B43A3A",
  "#726A5E", "#E0DAC9", "#D9D5C7",
]);
const DEPRECATED_HEX = new Set(["#8C8478", "#8c8478"]);

function scanHexColors(src: string): Violation[] {
  const stripped = stripComments(src);
  const lines = stripped.split("\n");
  const violations: Violation[] = [];
  const HEX_RE = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  for (let i = 0; i < lines.length; i++) {
    let m: RegExpExecArray | null;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(lines[i])) !== null) {
      const raw = m[0];
      const upper = raw.toUpperCase();
      const sixDigit =
        upper.length === 4
          ? "#" +
            upper[1] +
            upper[1] +
            upper[2] +
            upper[2] +
            upper[3] +
            upper[3]
          : upper;
      if (DEPRECATED_HEX.has(raw) || DEPRECATED_HEX.has(upper)) {
        violations.push({
          rule: "R3",
          line: i + 1,
          match: raw,
          message: `Deprecated hex ${raw}`,
        });
        continue;
      }
      if (
        !CANONICAL_HEX.has(raw) &&
        !CANONICAL_HEX.has(upper) &&
        !CANONICAL_HEX.has(sixDigit)
      ) {
        violations.push({
          rule: "R3",
          line: i + 1,
          match: raw,
          message: `Off-token hex ${raw}`,
        });
      }
    }
  }
  return violations;
}

const R1_RULES = [
  {
    id: "R1",
    pattern: /\b(Claude|Anthropic|ChatGPT|OpenAI|GPT-?[0-9o])\b/,
    message: "vendor name",
  },
];
const R2_RULES = [
  { id: "R2", pattern: /PLACEHOLDER/i, message: "PLACEHOLDER text" },
  { id: "R2", pattern: /awaiting real asset/i, message: "awaiting real asset" },
];
const R3_TAILWIND = [
  {
    id: "R3",
    pattern: /\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/,
    message: "rounded-* drift",
  },
  {
    id: "R3",
    pattern: /\bshadow-(sm|md|lg|xl|2xl)\b/,
    message: "shadow-* drift",
  },
];
const R4_RULES = [
  { id: "R4", pattern: /\bSMB\b/, message: "banned: SMB" },
  { id: "R4", pattern: /\bknowledge workers?\b/i, message: "banned: knowledge workers" },
  { id: "R4", pattern: /\bleverage\b/i, message: "banned: leverage" },
  { id: "R4", pattern: /\bsynergy\b/i, message: "banned: synergy" },
  { id: "R4", pattern: /\bdisruptiv/i, message: "banned: disruptive" },
  { id: "R4", pattern: /\brevolutionar/i, message: "banned: revolutionary" },
  { id: "R4", pattern: /\bnext-gen\b/i, message: "banned: next-gen" },
  { id: "R4", pattern: /\bcutting-edge\b/i, message: "banned: cutting-edge" },
  { id: "R4", pattern: /\bsupercharge\b/i, message: "banned: supercharge" },
  { id: "R4", pattern: /\bseamless\b/i, message: "banned: seamless" },
];

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function spawnGate(flags: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${GATE}" ${flags}`, { stdio: "pipe" }).toString();
    return { stdout, stderr: "", exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return {
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
      exitCode: err.status ?? 1,
    };
  }
}

// ─── R1 — vendor names ───────────────────────────────────────────────────────

describe("R1 — vendor names in customer copy", () => {
  it("detects ChatGPT, Claude, Anthropic, OpenAI in rendered text", () => {
    const src = fixture("r1-vendor-violation.tsx");
    const v = scanLines(src, R1_RULES);
    assert.ok(v.length >= 4, `Expected ≥4 vendor violations, got ${v.length}`);
    const matches = v.map((x) => x.match);
    assert.ok(matches.includes("ChatGPT"), "ChatGPT not detected");
    assert.ok(matches.includes("Claude"), "Claude not detected");
    assert.ok(matches.includes("Anthropic"), "Anthropic not detected");
    assert.ok(matches.includes("OpenAI"), "OpenAI not detected");
  });

  it("clean file produces zero R1 violations", () => {
    const src = fixture("r1-vendor-clean.tsx");
    const v = scanLines(src, R1_RULES);
    assert.equal(v.length, 0, `Expected 0 violations, got: ${JSON.stringify(v)}`);
  });
});

// ─── R2 — placeholder text ───────────────────────────────────────────────────

describe("R2 — placeholder text in brand assets", () => {
  it("detects PLACEHOLDER and 'awaiting real asset' in SVG", () => {
    const src = fixture("r2-placeholder-violation.svg");
    const v = scanLines(src, R2_RULES);
    assert.ok(
      v.some((x) => /PLACEHOLDER/i.test(x.match)),
      "PLACEHOLDER not detected",
    );
    assert.ok(
      v.some((x) => /awaiting real asset/i.test(x.match)),
      "'awaiting real asset' not detected",
    );
  });

  it("clean SVG produces zero R2 violations", () => {
    const src = fixture("r2-placeholder-clean.svg");
    const v = scanLines(src, R2_RULES);
    assert.equal(v.length, 0, `Expected 0 violations, got: ${JSON.stringify(v)}`);
  });
});

// ─── R3 — hex token drift ────────────────────────────────────────────────────

describe("R3 — off-token hex colors", () => {
  it("flags deprecated #8C8478 as deprecated (not just off-token)", () => {
    const src = fixture("r3-hex-violation.tsx");
    const v = scanHexColors(src);
    const deprecated = v.filter((x) => x.message.startsWith("Deprecated hex"));
    assert.ok(
      deprecated.length > 0,
      "Expected at least one deprecated hex violation",
    );
    assert.ok(deprecated.some((x) => x.match.toUpperCase() === "#8C8478"));
  });

  it("flags off-token hex values not in canonical set", () => {
    const src = fixture("r3-hex-violation.tsx");
    const v = scanHexColors(src);
    const offToken = v.filter((x) => x.message.startsWith("Off-token hex"));
    assert.ok(offToken.length > 0, "Expected off-token hex violations");
  });

  it("canonical token colors produce no R3 hex violations", () => {
    const src = fixture("r3-hex-clean.tsx");
    const v = scanHexColors(src);
    assert.equal(
      v.length,
      0,
      `Expected 0 hex violations, got: ${JSON.stringify(v)}`,
    );
  });
});

describe("R3 — Tailwind corner/shadow drift", () => {
  it("detects rounded-md, rounded-full, and shadow-md in violation file", () => {
    const src = fixture("r3-tailwind-violation.tsx");
    const v = scanLines(src, R3_TAILWIND);
    assert.ok(
      v.some((x) => x.match.startsWith("rounded-")),
      "Expected rounded-* violation",
    );
    assert.ok(
      v.some((x) => x.match.startsWith("shadow-")),
      "Expected shadow-* violation",
    );
  });

  it("clean file with no rounded-*/shadow-* produces zero violations", () => {
    const src = fixture("r3-tailwind-clean.tsx");
    const v = scanLines(src, R3_TAILWIND);
    assert.equal(
      v.length,
      0,
      `Expected 0 tailwind violations, got: ${JSON.stringify(v)}`,
    );
  });
});

// ─── R4 — banned marketing words ─────────────────────────────────────────────

describe("R4 — banned marketing words", () => {
  it("detects SMB, seamless, leverage, cutting-edge, next-gen, supercharge, revolutionary, disruptive", () => {
    const src = fixture("r4-banned-words-violation.tsx");
    const v = scanLines(src, R4_RULES);
    assert.ok(
      v.length >= 5,
      `Expected ≥5 banned-word violations, got ${v.length}`,
    );
    const matches = v.map((x) => x.match.toLowerCase());
    assert.ok(matches.some((m) => m === "smb"), "SMB not detected");
    assert.ok(matches.some((m) => m === "seamless"), "seamless not detected");
    assert.ok(matches.some((m) => m === "leverage"), "leverage not detected");
  });

  it("voice-compliant copy produces zero R4 violations", () => {
    const src = fixture("r4-banned-words-clean.tsx");
    const v = scanLines(src, R4_RULES);
    assert.equal(
      v.length,
      0,
      `Expected 0 violations, got: ${JSON.stringify(v)}`,
    );
  });
});

// ─── Comment stripping behavior ──────────────────────────────────────────────

describe("comment stripping", () => {
  it("strips line comments — vendor names in // comments do not trigger R1", () => {
    const src = fixture("comment-stripping.tsx");
    const stripped = stripComments(src);
    const v = scanLines(stripped, R1_RULES);
    assert.equal(
      v.length,
      0,
      `R1 triggered on comment content. Violations: ${JSON.stringify(v)}`,
    );
  });

  it("strips block comments — /* */ vendor names do not trigger R1", () => {
    const src = fixture("comment-stripping.tsx");
    const stripped = stripComments(src);
    assert.ok(!stripped.includes("Anthropic"), "Anthropic survived comment strip");
    assert.ok(!stripped.includes("ChatGPT"), "ChatGPT survived comment strip");
    assert.ok(!stripped.includes("OpenAI"), "OpenAI survived comment strip");
  });

  it("strips JSX block comments — {/* */} content suppressed", () => {
    const src = fixture("comment-stripping.tsx");
    const stripped = stripComments(src);
    assert.ok(
      !stripped.includes("seamless"),
      "seamless survived JSX comment strip",
    );
  });

  it("strips PLACEHOLDER mention in a line comment — R2 not triggered on doc comments", () => {
    const src = fixture("comment-stripping.tsx");
    const stripped = stripComments(src);
    assert.ok(
      !stripped.includes("PLACEHOLDER"),
      "PLACEHOLDER survived comment strip — R2 would false-positive on documentation",
    );
  });

  it("preserves non-comment JSX text content after stripping", () => {
    const src = fixture("comment-stripping.tsx");
    const stripped = stripComments(src);
    assert.ok(
      stripped.includes("Intelligence rooted in reality."),
      "Real JSX text was accidentally stripped",
    );
  });
});

// ─── Allowlist behavior ───────────────────────────────────────────────────────

describe("allowlist behavior", () => {
  it("allowlist file exists and is valid JSON with path+reason entries", () => {
    assert.ok(existsSync(ALLOWLIST_PATH), "brand-gate-allow.json does not exist");
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as unknown[];
    assert.ok(Array.isArray(allowlist), "Allowlist must be an array");
    for (const entry of allowlist) {
      const e = entry as Record<string, unknown>;
      assert.ok(typeof e.path === "string", "Each entry must have a string path");
      assert.ok(typeof e.reason === "string", "Each entry must have a string reason");
    }
  });

  it("privacy/security pages are allowlisted for Anthropic vendor name", () => {
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as Array<{ path: string }>;
    const entry = allowlist.find(
      (e) => e.path.includes("privacy") || e.path.includes("security"),
    );
    assert.ok(entry, "No allowlist entry for privacy/security Anthropic disclosure");
  });

  it("marketing-prompt.ts is allowlisted for Claude/Anthropic in operator instructions", () => {
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as Array<{ path: string }>;
    const entry = allowlist.find((e) => e.path.includes("marketing-prompt"));
    assert.ok(entry, "No allowlist entry for marketing-prompt.ts vendor names");
  });
});

// ─── Baseline ratchet behavior (CLI integration) ─────────────────────────────

describe("baseline ratchet", () => {
  it("baseline file exists and has the expected shape", () => {
    assert.ok(
      existsSync(BASELINE_PATH),
      "brand-gate-baseline.json does not exist — run: node tools/brand/brand-gate.mjs --baseline",
    );
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
      generatedAt: string;
      count: number;
      violations: unknown[];
    };
    assert.ok(
      typeof baseline.generatedAt === "string",
      "baseline.generatedAt missing",
    );
    assert.ok(typeof baseline.count === "number", "baseline.count missing");
    assert.ok(
      Array.isArray(baseline.violations),
      "baseline.violations must be array",
    );
    assert.equal(
      baseline.violations.length,
      baseline.count,
      "baseline.count does not match violations array length",
    );
  });

  it("baseline violation entries have rule, file, line, match fields", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
      violations: Array<{ rule?: unknown; file?: unknown; line?: unknown; match?: unknown }>;
    };
    if (baseline.violations.length === 0) return;
    const first = baseline.violations[0];
    assert.ok(typeof first.rule === "string", "baseline entry missing rule");
    assert.ok(typeof first.file === "string", "baseline entry missing file");
    assert.ok(typeof first.line === "number", "baseline entry missing line");
    assert.ok(typeof first.match === "string", "baseline entry missing match");
  });

  it("default (ratchet) mode exits 0 when no new violations exist", () => {
    const result = spawnGate("");
    assert.equal(
      result.exitCode,
      0,
      `brand-gate ratchet mode failed — new violations introduced:\n${result.stderr}`,
    );
  });

  it("--baseline flag exits 0 regardless of violation count", () => {
    const result = spawnGate("--baseline");
    assert.equal(result.exitCode, 0, "--baseline flag should exit 0");
  });

  it("--all flag exits 1 when baseline violations exist", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { count: number };
    if (baseline.count === 0) return; // Nothing to assert; baseline is clean
    const result = spawnGate("--all");
    assert.equal(result.exitCode, 1, "--all should exit 1 when violations exist");
  });

  it("--json flag emits valid JSON with violations array, totalFound, newViolations", () => {
    const result = spawnGate("--json");
    // --json writes to stdout even on exit 1
    const output = result.stdout || result.stderr;
    let parsed: Record<string, unknown>;
    assert.doesNotThrow(
      () => { parsed = JSON.parse(output); },
      `Expected valid JSON from --json flag. Got: ${output.slice(0, 200)}`,
    );
    assert.ok(Array.isArray(parsed!.violations), "JSON output must have violations array");
    assert.ok(typeof parsed!.totalFound === "number", "JSON output must have totalFound");
    assert.ok(typeof parsed!.newViolations === "number", "JSON output must have newViolations");
  });
});

// ─── Integration: the live tree holds the gate at zero ───────────────────────
// The seed baseline carried 270 violations when the gate first landed; the
// 2026-06-11 design-remediation waves (PRs #227-#234) drove it to zero and the
// gate moved from ratchet-only to a hard pre-push layer. These tests pin the
// clean state: the baseline stays empty and a live run reports no violations.

describe("integration — live tree is brand-gate clean", () => {
  it("baseline is empty (zero ratified-debt violations)", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
      violations: Array<{ rule: string }>;
    };
    assert.equal(
      baseline.violations.length,
      0,
      "Baseline must stay empty — fix new violations or allowlist with a ratified reason, never re-baseline debt",
    );
  });

  it("live run finds zero violations across all rules", () => {
    const result = spawnGate("--json --all");
    const parsed = JSON.parse(result.stdout || result.stderr) as {
      totalFound: number;
      violations: Array<{ rule: string; file: string; line: number; match: string }>;
    };
    const summary = parsed.violations
      .map((v) => `${v.rule} ${v.file}:${v.line} ${v.match}`)
      .join("\n");
    assert.equal(
      parsed.totalFound,
      0,
      `Expected zero brand-gate violations in the live tree, found:\n${summary}`,
    );
  });
});
