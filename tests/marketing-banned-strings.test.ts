import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Pin the cleaned-up state of every customer-facing marketing surface so a
// future PR cannot reintroduce the banned framings Conner flagged
// 2026-05-11 on the live homepage stat block
// ("AGENTS IN THE FLEET: 7 / PILOT LENGTH: 30 days / VERTICALS AT V0: Realty").
//
// Source-of-truth rules:
//   - ~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md
//   - ~/.claude/projects/C--agentplain/memory/project_agentplain_mission_and_positioning.md
//
// We check the RENDERED copy, not the source comments. Comments documenting
// the rule itself (e.g. "// no AI assistant framing") would otherwise trip
// the test, so we strip JS/TS line and block comments before assertion.

const REPO_ROOT = join(__dirname, "..");

// Customer-facing surfaces only. The (product) and (operator) layers are
// behind auth and have their own rules; we don't gate them here.
const SURFACE_FILES: string[] = [
  ...walk(join(REPO_ROOT, "app", "(marketing)")),
  join(REPO_ROOT, "components", "Header.tsx"),
  join(REPO_ROOT, "components", "Footer.tsx"),
  join(REPO_ROOT, "components", "FAQ.tsx"),
  join(REPO_ROOT, "components", "RoiCalculator.tsx"),
  join(REPO_ROOT, "components", "Section.tsx"),
  ...walk(join(REPO_ROOT, "components", "brand")),
  ...walk(join(REPO_ROOT, "components", "vertical")),
];

// Banned literal substrings. The flagged stat block + the V0/MVP/pilot
// framings Conner banned 2026-05-11.
const BANNED_LITERALS: string[] = [
  "AGENTS IN THE FLEET",
  "PILOT LENGTH",
  "VERTICALS AT V0",
  "30-day pilot",
  "See the pilot",
  "Book a call",
  "brokerages keep deferring",
  "A small fleet, doing the work brokerages",
  "AI assistant",
  "AI magic",
  "intelligent automation",
  "smart insights",
  "AI-powered",
  "machine learning",
];

// Banned regex patterns. Case-insensitive, word-boundary anchored.
// Each pattern's `description` is what the test failure reports back.
const BANNED_REGEX: { description: string; pattern: RegExp }[] = [
  {
    description: "internal version literal V0/v0 (banned on customer surfaces)",
    pattern: /\bv0\b/i,
  },
  {
    description: "internal product-stage literal MVP",
    pattern: /\bMVP\b/,
  },
  {
    description: "internal product-stage literal Phase 0",
    pattern: /\bphase\s+0\b/i,
  },
  {
    description: "internal product-stage literals pre-pilot / beta-pilot",
    pattern: /\b(pre|beta)-pilot\b/i,
  },
  {
    description: "agent-count literal (`N agents` / `N-M agents`)",
    pattern: /\b\d+(\s*[–-]\s*\d+)?\s+agents?\b/i,
  },
  {
    description: "`all 7` / `all seven` agent-count framings",
    pattern: /\ball\s+(7|seven)\s+(agents|of\s+(them|the\s+fleet))\b/i,
  },
];

describe("marketing surfaces — banned framings (story-arc enforcement)", () => {
  for (const file of SURFACE_FILES) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
    const stripped = stripComments(readFileSync(file, "utf8"));

    for (const literal of BANNED_LITERALS) {
      it(`${rel} :: must not contain "${literal}"`, () => {
        assert.equal(
          stripped.includes(literal),
          false,
          `Banned literal "${literal}" found in ${rel} (story-arc rule violation; see ~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md).`,
        );
      });
    }

    for (const { description, pattern } of BANNED_REGEX) {
      it(`${rel} :: must not match ${description}`, () => {
        const match = stripped.match(pattern);
        assert.equal(
          match,
          null,
          match
            ? `Banned pattern (${description}) matched "${match[0]}" in ${rel} — see ~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md.`
            : "",
        );
      });
    }
  }
});

// Strip JS/TS line and block comments so source-code documentation that
// references the banned strings (e.g. "// no AI assistant framing") doesn't
// trip the test. Naive but adequate for our source files — none of them
// contain `//` or `/* */` inside string literals, so the regex is safe.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}
