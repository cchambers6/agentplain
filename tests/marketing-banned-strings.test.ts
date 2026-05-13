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
//
// Vertical content files (`lib/verticals/*/content.ts`) are scanned too —
// they ship the customer-visible hero, ROI math, claims triad, integrations
// list, and value-loop example for every vertical page, and were the source
// of the 2026-05-12 banned-framing bleed (Plus/Max tier surfacing in
// hero.eyebrow and roi.inputCost). The vertical-content-polish PR
// (feat/agentplain-vertical-content-polish, 2026-05-12) extended this test
// to keep that regression from coming back.
const VERTICAL_CONTENT_FILES: string[] = walkVerticalContent(
  join(REPO_ROOT, "lib", "verticals"),
);

const SURFACE_FILES: string[] = [
  ...walk(join(REPO_ROOT, "app", "(marketing)")),
  join(REPO_ROOT, "components", "Header.tsx"),
  join(REPO_ROOT, "components", "Footer.tsx"),
  join(REPO_ROOT, "components", "FAQ.tsx"),
  join(REPO_ROOT, "components", "RoiCalculator.tsx"),
  join(REPO_ROOT, "components", "Section.tsx"),
  ...walk(join(REPO_ROOT, "components", "brand")),
  ...walk(join(REPO_ROOT, "components", "vertical")),
  ...VERTICAL_CONTENT_FILES,
];

// Banned literal substrings. The flagged stat block + the V0/MVP/pilot
// framings Conner banned 2026-05-11, plus the Plus/Max tier customer-surface
// ban locked 2026-05-12 per `project_stripe_both_surfaces.md` (simplified
// pricing model — Plus/Max stay schema-ready but are not surfaced).
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
  // Plus/Max tier customer-surface bans (simplified pricing 2026-05-12).
  // The literal "Plus tier" / "Max tier" is the call-out; bare "Plus" /
  // "Max" appear in unrelated copy ("plus mistakes avoided") so we use the
  // specific 2-word forms here.
  "Plus tier",
  "Max tier",
  "Plus: $299",
  "Max: $499",
  "$299 → $199",
  "$499 → $299",
  "three tiers",
  "Three tiers",
  "across every tier",
  "across all three tiers",
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

// Vertical-content-only bans. Scoped narrowly to `lib/verticals/*/content.ts`
// because the renderer (components/vertical/JtbdTables.tsx) legitimately
// contains the literal `[DRAFT — needs vertical-CEO review]` JSX as a
// rendering escape hatch for any future vertical that ships mid-bring-up.
// Locked 2026-05-12 alongside `feat/agentplain-vertical-jtbd-tables`, the
// PR that ratified all 9 non-real-estate verticals out of draft state. The
// rule: vertical content ships ratified, or it does not ship.
const VERTICAL_CONTENT_BANNED_REGEX: { description: string; pattern: RegExp }[] = [
  {
    description:
      "JTBD `draft: true` in vertical content (every role table must be ratified before merging — see vertical-routes.test.ts)",
    pattern: /\bdraft\s*:\s*true\b/,
  },
  {
    description:
      "literal `[DRAFT]` text in vertical content source (the renderer surfaces the badge from `draft: true`; pinning the literal in source bypasses ratification)",
    pattern: /\[\s*DRAFT[^\]]*\]/,
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

describe("vertical content — JTBD ratification guard", () => {
  for (const file of VERTICAL_CONTENT_FILES) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
    const stripped = stripComments(readFileSync(file, "utf8"));

    for (const { description, pattern } of VERTICAL_CONTENT_BANNED_REGEX) {
      it(`${rel} :: must not match ${description}`, () => {
        const match = stripped.match(pattern);
        assert.equal(
          match,
          null,
          match
            ? `JTBD ratification guard violated: ${description}. Found "${match[0]}" in ${rel}. Fix: populate the role with real workflows + set draft:false (see lib/verticals/real-estate/content.ts for the canonical shape).`
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

// Narrowly walk `lib/verticals/` and collect ONLY the per-vertical
// `content.ts` files. The registry (`index.ts`) and the `types.ts` schema
// definitions are excluded because their JS comments legitimately
// reference banned framings (e.g. "pilot SKUs deprecated", "Phase 0
// product_spec") as documentation of the rule itself — they don't render
// to customers and the comment-stripping in `stripComments` only handles
// JS comments inside the file, not file-level documentation.
function walkVerticalContent(dir: string): string[] {
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
      const contentFile = join(full, "content.ts");
      try {
        if (statSync(contentFile).isFile()) {
          out.push(contentFile);
        }
      } catch {
        // No content.ts in this subdirectory — skip silently.
      }
    }
  }
  return out;
}
