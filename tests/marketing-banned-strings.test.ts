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
//
// Note (2026-05-15 ratification): three customer-facing tiers are now in
// scope (Regular / Partner / Max). The bans below were trimmed accordingly
// — copy may legitimately mention "Partner tier", "Max tier", or "three
// tiers"; what stays banned is the on-disk schema name "Plus" leaking to
// the customer surface (it should always render via `tierDisplayName()`
// as "Partner") and the deprecated 2026-05-09 productized Max prices.
const VERTICAL_CONTENT_FILES: string[] = walkVerticalContent(
  join(REPO_ROOT, "lib", "verticals"),
);

// Files that carry customer-visible copy but sat OUTSIDE this guard until
// 2026-09-09. Every one of them states or shapes a price, and none of them
// was scanned — which is why the retired per-seat ladder survived in this
// repo after the pricing engine had already collapsed to a flat price.
//
// `seed-data.ts` is the sharpest case: its rows are seeded into the knowledge
// substrate as `VERTICAL` / `CROSS_CUSTOMER` kinds, and `VERTICAL` is in the
// customer chat's retrieval set — so a dead price there is quotable back to a
// paying customer inside a product answer while rendering on no page at all.
// `structured-data.ts` is the inverse: emitted into <head>, invisible to a
// human reading the page, read by crawlers.
const EXTRA_SURFACE_FILES: string[] = [
  join(REPO_ROOT, "lib", "marketing", "home-content.ts"),
  join(REPO_ROOT, "lib", "marketing", "comparisons.ts"),
  join(REPO_ROOT, "components", "faq-items.ts"),
  join(REPO_ROOT, "components", "marketing", "PriceTiers.tsx"),
  join(REPO_ROOT, "components", "marketing", "HomeCards.tsx"),
  join(REPO_ROOT, "lib", "plaino", "marketing-prompt.ts"),
  join(REPO_ROOT, "lib", "knowledge", "seed-data.ts"),
  join(REPO_ROOT, "lib", "seo", "structured-data.ts"),
];

// Walked directory roots, each with the minimum number of files it MUST
// contribute.
//
// A single global floor is not enough, and a probe proved it: renaming
// `app/(marketing)` away dropped 25 files and 1,075 test cases, and the run
// still passed a global floor of 40 because the remaining roots covered it.
// Per-root minimums make the loss of ANY ONE directory a failure, which is the
// actual defect being defended against — `walk()` returns [] on a missing
// directory via its `catch`, so a rename is silent by construction.
const WALK_ROOTS: { label: string; dir: string; min: number }[] = [
  { label: "app/(marketing)", dir: join(REPO_ROOT, "app", "(marketing)"), min: 15 },
  { label: "components/brand", dir: join(REPO_ROOT, "components", "brand"), min: 1 },
  { label: "components/vertical", dir: join(REPO_ROOT, "components", "vertical"), min: 5 },
];

const WALKED: Record<string, string[]> = Object.fromEntries(
  WALK_ROOTS.map((r) => [r.label, walk(r.dir)]),
);

const SURFACE_FILES: string[] = [
  ...WALK_ROOTS.flatMap((r) => WALKED[r.label]),
  join(REPO_ROOT, "components", "Header.tsx"),
  join(REPO_ROOT, "components", "Footer.tsx"),
  join(REPO_ROOT, "components", "FAQ.tsx"),
  join(REPO_ROOT, "components", "RoiCalculator.tsx"),
  join(REPO_ROOT, "components", "Section.tsx"),
  ...EXTRA_SURFACE_FILES.filter(existsOrThrow),
  ...VERTICAL_CONTENT_FILES,
];

// Global floor, kept as a second net beneath the per-root minimums.
const MIN_EXPECTED_SURFACE_FILES = 60;
const MIN_EXPECTED_VERTICAL_CONTENT_FILES = 11;

// Banned literal substrings. The flagged stat block + the V0/MVP/pilot
// framings Conner banned 2026-05-11. The Plus/Max tier customer-surface
// ban from 2026-05-12 was REPLACED on 2026-05-15 with a narrower rule:
// only the schema name "Plus" is banned from customer copy (it should
// render as "Partner" via `tierDisplayName()`); the deprecated 2026-05-09
// productized Max prices are also still banned because Max is now AD-HOC
// quote-based and a literal "$499 → $299" would lie to the customer.
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
  // Schema-name-leak ban — customer copy must render `plus` as "Partner"
  // via `tierDisplayName()` (locked 2026-05-15 per
  // `memory/project_stripe_both_surfaces.md`). The 2-word forms below
  // catch the leak without flagging unrelated "plus mistakes avoided"
  // copy. "Partner tier" / "Max tier" / "three tiers" are LEGITIMATE
  // post-2026-05-15 and intentionally NOT banned.
  "Plus tier",
  "Plus: $299",
  // Deprecated 2026-05-09 productized Max prices — Max is now AD-HOC
  // quote-based per the 2026-05-15 ratification, so any literal price
  // ladder for Max would be wrong. Customer copy must say "quote-based"
  // for Max, never a fixed price.
  "Max: $499",
  "$499 → $299",

  // ── Retired per-seat ladder (flat-price collapse, 2026-09-09) ──────────
  //
  // Pricing is ONE FLAT PRICE (`MONTHLY_PRICE_USD_CENTS`, lib/billing/facts.ts).
  // Every rung below was a real published price and is now false. They are
  // banned as LITERALS rather than as a regex on "$\d+" because customer copy
  // legitimately contains other dollar figures — ROI values, regulatory
  // penalties, and the /custom bespoke range ($5K–$15K + maintenance), which
  // is a DIFFERENT PRODUCT and deliberately survives.
  //
  // NOTE: "$99" is NOT banned — it is the live price.
  "$199",
  "$299",
  "$499",
  "$449",
  "$399",
  "$349",
  "$279",
  "$249",
  "$219",
  "$179",
  "$149",
  "$119",
];

// Banned regex for the per-seat FRAMING itself, independent of any number.
// A price can be scrubbed while the shape of the retired model survives in
// prose ("billed per seat", "sliding by team size"), which is how a reader
// still comes away believing the bill scales with headcount.
const BANNED_PRICING_REGEX: { description: string; pattern: RegExp }[] = [
  {
    description: "per-seat pricing framing (pricing is flat, not per seat)",
    pattern: /\bper[-\s]seat\b/i,
  },
  {
    description: "`/seat` price suffix (pricing is flat, not per seat)",
    pattern: /\$\s?\d[\d,]*\s*\/\s*seat\b/i,
  },
  {
    description: "`sliding to` volume-ladder framing (the ladder is retired)",
    pattern: /\bsliding\s+(to|by)\b/i,
  },
  {
    description: "seat-band label from the retired volume ladder",
    pattern: /\b(2\s*[–-]\s*9|10\s*[–-]\s*24|25\s*[–-]\s*49|50\s*[–-]\s*99)\s*seats\b/i,
  },
  {
    description:
      'dead billing mechanic "first month free" (the on-ramp is a trial; a card IS captured at signup)',
    pattern: /\bfirst\s+month\s+free\b/i,
  },
  {
    description:
      'dead Partner claim "reserved time/hours" (PARTNER_SUPPORT.includesConnerTime === false)',
    pattern: /\breserved\s+(time|hours)\b/i,
  },
  {
    description:
      'dead Partner claim "N hrs/mo" of named-partner time (no reserved hours exist)',
    pattern: /\b\d+\s*hrs?\s*\/\s*mo\b/i,
  },
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

// Files whose RENDERED STRING CONTENT is doctrine: it must NAME a retired
// framing in order to forbid it. `seed-data.ts` seeds rows that literally
// read 'BANNED FRAMINGS: ... "$199 → $99" ...', and the marketing prompt
// instructs the model 'do NOT quote a rate that multiplies by headcount'.
// Those are the mechanism that keeps the ban alive, not violations of it.
//
// This exemption is deliberately NARROW: it drops only whole lines carrying an
// explicit prohibition marker, and only for the files listed here. Such a line
// is by construction a statement that something is forbidden, so a banned
// literal on it is being CITED, not asserted to a customer.
//
// RISK, stated plainly: a genuine violation sharing a line with the word
// "BANNED" would be masked. Accepted, because the alternative — leaving these
// two files out of the corpus, as they were until 2026-09-09 — is precisely
// what let the retired ladder survive inside them.
//
// NOTE ON PLACEMENT: these MUST be declared above the `describe` blocks. A
// `describe` callback runs during collection, so a `const` declared below it
// is still in the temporal dead zone when the callback reads it. Declaring
// them at the bottom threw a ReferenceError that aborted collection and
// dropped 2,795 of 2,819 cases — and the runner reported `fail 0`
// (`cancelled 1`). The coverage assertion below is what caught it.
const DECLARATION_FILES: ReadonlySet<string> = new Set([
  join(REPO_ROOT, "lib", "knowledge", "seed-data.ts"),
  join(REPO_ROOT, "lib", "plaino", "marketing-prompt.ts"),
]);

const PROHIBITION_MARKER =
  /\b(BANNED|RETIRED|Banned phrases|Banned variants|Banned framings|Wrong reads|do NOT|must never|is DEAD|never a)\b/;

function stripDeclarationLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !PROHIBITION_MARKER.test(line))
    .join("\n");
}

/** Comment-stripped, declaration-aware view of a file's rendered copy. */
function scannableText(file: string): string {
  const stripped = stripComments(readFileSync(file, "utf8"));
  return DECLARATION_FILES.has(file)
    ? stripDeclarationLines(stripped)
    : stripped;
}

describe("marketing surfaces — banned framings (story-arc enforcement)", () => {
  // COVERAGE REPORT — must come first.
  //
  // Two structural defects this closes:
  //   1. `walk()` swallows a missing directory via `catch { return []; }`. A
  //      directory rename therefore turns the entire brand-safety standard
  //      into a silent no-op rather than a failure.
  //   2. The `for (const f of corpus) { it(...) }` shape generates ZERO test
  //      cases on an empty corpus, and a suite with zero cases reports GREEN.
  //      "Found nothing" and "examined nothing" were indistinguishable.
  // An assertion that cannot fail is not a check. Report N, and fail at zero.
  it(`examined ${SURFACE_FILES.length} of >=${MIN_EXPECTED_SURFACE_FILES} expected surface files`, () => {
    assert.notEqual(
      SURFACE_FILES.length,
      0,
      "examined ZERO marketing surfaces — the corpus is empty, so every " +
        "banned-string assertion below silently passed by not existing. " +
        "Check that app/(marketing) and components/vertical still exist.",
    );
    assert.ok(
      SURFACE_FILES.length >= MIN_EXPECTED_SURFACE_FILES,
      `examined only ${SURFACE_FILES.length} surface files, expected at least ` +
        `${MIN_EXPECTED_SURFACE_FILES}. A directory was renamed or removed and ` +
        `walk() swallowed it, shrinking the guard's corpus without failing.`,
    );
    // Every explicitly-listed extra surface must actually be present.
    for (const f of EXTRA_SURFACE_FILES) {
      assert.ok(
        SURFACE_FILES.includes(f),
        `explicitly-listed surface missing from the corpus: ${relative(REPO_ROOT, f)}`,
      );
    }
    // Every walked ROOT must contribute. Without this, losing one whole
    // directory is absorbed by the others under a global floor.
    for (const r of WALK_ROOTS) {
      const got = WALKED[r.label].length;
      assert.ok(
        got >= r.min,
        `walk root "${r.label}" contributed ${got} files, expected at least ` +
          `${r.min}. The directory was renamed, moved, or emptied and walk() ` +
          `swallowed it — every banned-string case for those files silently ` +
          `stopped being generated.`,
      );
    }
  });

  for (const file of SURFACE_FILES) {
    const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
    const stripped = scannableText(file);

    for (const literal of BANNED_LITERALS) {
      it(`${rel} :: must not contain "${literal}"`, () => {
        assert.equal(
          stripped.includes(literal),
          false,
          `Banned literal "${literal}" found in ${rel} (story-arc rule violation; see ~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md).`,
        );
      });
    }

    for (const { description, pattern } of [
      ...BANNED_REGEX,
      ...BANNED_PRICING_REGEX,
    ]) {
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
  it(`examined ${VERTICAL_CONTENT_FILES.length} of >=${MIN_EXPECTED_VERTICAL_CONTENT_FILES} expected vertical content files`, () => {
    assert.notEqual(
      VERTICAL_CONTENT_FILES.length,
      0,
      "examined ZERO vertical content files — walkVerticalContent() returned " +
        "an empty corpus, so the ratification guard below generated no cases " +
        "and reported green without looking at anything.",
    );
    assert.ok(
      VERTICAL_CONTENT_FILES.length >= MIN_EXPECTED_VERTICAL_CONTENT_FILES,
      `examined only ${VERTICAL_CONTENT_FILES.length} vertical content files, ` +
        `expected at least ${MIN_EXPECTED_VERTICAL_CONTENT_FILES}.`,
    );
  });

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

// Explicitly-listed surfaces must EXIST. `walk()` is allowed to return [] for
// a missing directory (the coverage assertion catches that), but a named file
// that has moved must fail loudly and immediately rather than quietly dropping
// out of the corpus — a silently-unscanned pricing surface is the exact defect
// this guard exists to prevent.
function existsOrThrow(file: string): boolean {
  try {
    statSync(file);
    return true;
  } catch {
    throw new Error(
      `marketing-banned-strings: listed surface does not exist: ${file}. ` +
        `It was moved or renamed — update EXTRA_SURFACE_FILES. Dropping it ` +
        `silently would leave a customer-facing price surface unscanned.`,
    );
  }
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
