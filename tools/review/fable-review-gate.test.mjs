#!/usr/bin/env node
/**
 * fable-review-gate.test.mjs — tests for the pure half of the review gate.
 *
 * Run:  node --test tools/review/fable-review-gate.test.mjs
 *
 * Only the pure functions are covered here — glob matching, diff parsing,
 * classification, frontmatter parsing, verdict/reviewer rules and rubric
 * completeness. The git orchestration lives behind the main-module guard in
 * fable-review-gate.mjs and is exercised by CI running the gate for real on
 * every pull request.
 *
 * Node's built-in runner only; no npm dependency, same as the gate itself.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_VERDICTS,
  REQUIRED_SECTIONS,
  branchSlug,
  classifyChange,
  isReviewDoc,
  isUnderReviewDir,
  matchesGlob,
  missingSections,
  normalizePath,
  parseAddedLines,
  parseFrontmatter,
  validateReviewer,
  validateVerdict,
} from "./fable-review-gate.mjs";

// ---------------------------------------------------------------------------
// glob matching
// ---------------------------------------------------------------------------

test("glob: ** crosses directory separators", () => {
  assert.equal(matchesGlob("lib/agents/office-manager.ts", "lib/agents/**"), true);
  assert.equal(matchesGlob("lib/agents/sentinel/corpus/rules.ts", "lib/agents/**"), true);
  assert.equal(matchesGlob("lib/agentsx/thing.ts", "lib/agents/**"), false);
  assert.equal(matchesGlob("lib/billing/index.ts", "lib/agents/**"), false);
});

test("glob: single * does not cross a separator", () => {
  assert.equal(matchesGlob("docs/reviews/2026-08-01-thing.md", "docs/reviews/*.md"), true);
  assert.equal(matchesGlob("docs/reviews/nested/thing.md", "docs/reviews/*.md"), false);
});

test("glob: exact file patterns do not match same-named files elsewhere", () => {
  assert.equal(matchesGlob("middleware.ts", "middleware.ts"), true);
  assert.equal(matchesGlob("app/middleware.ts", "middleware.ts"), false);
  assert.equal(matchesGlob("prisma/schema.prisma", "prisma/schema.prisma"), true);
});

test("glob: a/**/b matches both a/b and a/x/y/b", () => {
  assert.equal(matchesGlob("a/b", "a/**/b"), true);
  assert.equal(matchesGlob("a/x/y/b", "a/**/b"), true);
  assert.equal(matchesGlob("a/x/y/c", "a/**/b"), false);
});

test("glob: backslash paths are normalized before matching", () => {
  assert.equal(matchesGlob("lib\\storage\\object-store.ts", "lib/storage/**"), true);
  assert.equal(matchesGlob(".github\\workflows\\deploy.yml", ".github/workflows/**"), true);
  assert.equal(normalizePath("./lib\\db\\client.ts"), "lib/db/client.ts");
});

test("glob: regex metacharacters in a pattern are literal", () => {
  // The dot in schema.prisma must not act as "any character".
  assert.equal(matchesGlob("prisma/schemaXprisma", "prisma/schema.prisma"), false);
});

// ---------------------------------------------------------------------------
// review-doc identification
// ---------------------------------------------------------------------------

test("review docs: TEMPLATE.md and README.md are not review artifacts", () => {
  assert.equal(isReviewDoc("docs/reviews/2026-08-01-my-branch.md"), true);
  assert.equal(isReviewDoc("docs/reviews/TEMPLATE.md"), false);
  assert.equal(isReviewDoc("docs/reviews/README.md"), false);
  assert.equal(isReviewDoc("docs/engineering/pre-merge-review-gate.md"), false);
});

test("review docs: isUnderReviewDir covers the whole directory", () => {
  assert.equal(isUnderReviewDir("docs/reviews/TEMPLATE.md"), true);
  assert.equal(isUnderReviewDir("docs\\reviews\\2026-08-01-x.md"), true);
  assert.equal(isUnderReviewDir("docs/engineering/x.md"), false);
});

// ---------------------------------------------------------------------------
// classification — paths
// ---------------------------------------------------------------------------

test("classify: gated path triggers review", () => {
  const r = classifyChange({ files: ["lib/billing/charge.ts"], addedLines: "" });
  assert.equal(r.gated, true);
  assert.equal(r.pathMatches.length, 1);
  assert.equal(r.pathMatches[0].pattern, "lib/billing/**");
  assert.ok(r.pathMatches[0].why.length > 0, "every gated path carries a why");
});

test("classify: several gated families are all recognised", () => {
  const files = [
    "prisma/schema.prisma",
    "prisma/migrations/20260801000000_x/migration.sql",
    "lib/memory/tiering.ts",
    "lib/plaino/chat-retention.ts",
    "lib/customer-data/erase.ts",
    "lib/llm/compose.ts",
    "middleware.ts",
    ".github/workflows/fable-review-gate.yml",
    "tools/review/fable-review-gate.mjs",
  ];
  const r = classifyChange({ files, addedLines: "" });
  assert.equal(r.gated, true);
  assert.equal(r.pathMatches.length, files.length, "every file above is gated");
});

test("classify: ungated diff requires no review", () => {
  const r = classifyChange({
    files: ["README.md", "app/(marketing)/page.tsx", "docs/outreach/wave-4.md", "tailwind.config.ts"],
    addedLines: "const headline = 'Local businesses, handled.';\n<p>Copy change only</p>",
  });
  assert.equal(r.gated, false);
  assert.deepEqual(r.pathMatches, []);
  assert.deepEqual(r.contentMatches, []);
});

// ---------------------------------------------------------------------------
// classification — content (added lines only)
// ---------------------------------------------------------------------------

test("classify: workspaceId in added lines triggers review from an ungated path", () => {
  const r = classifyChange({
    files: ["app/api/report/route.ts"],
    addedLines: "  const rows = await prisma.report.findMany({ where: { workspaceId } });",
  });
  assert.equal(r.gated, true);
  assert.deepEqual(r.pathMatches, []);
  assert.equal(r.contentMatches[0].name, "workspaceId");
});

test("classify: deleteMany( triggers review", () => {
  const r = classifyChange({
    files: ["scripts/cleanup.ts"],
    addedLines: "await prisma.conversationTurn.deleteMany({ where: { createdAt: { lt: cutoff } } });",
  });
  assert.equal(r.gated, true);
  assert.equal(r.contentMatches.some((m) => m.name === "deleteMany("), true);
});

test("classify: DROP TABLE / DROP COLUMN match case-insensitively", () => {
  const upper = classifyChange({ files: ["x.sql"], addedLines: "DROP TABLE legacy_leads;" });
  const lower = classifyChange({ files: ["x.sql"], addedLines: "alter table leads drop column ssn;" });
  assert.equal(upper.gated, true);
  assert.equal(upper.contentMatches[0].name, "DROP TABLE");
  assert.equal(lower.gated, true);
  assert.equal(lower.contentMatches[0].name, "DROP COLUMN");
});

test("classify: content rules are matched against the supplied added lines only", () => {
  // Callers pass added lines; removed lines never reach the classifier.
  const r = classifyChange({ files: ["app/page.tsx"], addedLines: "" });
  assert.equal(r.gated, false);
});

// ---------------------------------------------------------------------------
// diff parsing
// ---------------------------------------------------------------------------

const SAMPLE_DIFF = [
  "diff --git a/lib/db/client.ts b/lib/db/client.ts",
  "--- a/lib/db/client.ts",
  "+++ b/lib/db/client.ts",
  "@@ -10,0 +11 @@",
  "+  where: { workspaceId },",
  "diff --git a/docs/reviews/2026-08-01-x.md b/docs/reviews/2026-08-01-x.md",
  "--- /dev/null",
  "+++ b/docs/reviews/2026-08-01-x.md",
  "@@ -0,0 +1 @@",
  "+Every query is workspaceId-scoped and no deleteMany( was added.",
].join("\n");

test("parseAddedLines: attributes added lines to their file", () => {
  const { byFile } = parseAddedLines(SAMPLE_DIFF);
  assert.deepEqual(byFile.get("lib/db/client.ts"), ["  where: { workspaceId },"]);
  assert.equal(byFile.get("docs/reviews/2026-08-01-x.md").length, 1);
});

test("parseAddedLines: excluded files are dropped from the matched text", () => {
  const { text } = parseAddedLines(SAMPLE_DIFF, { exclude: isUnderReviewDir });
  assert.ok(text.includes("where: { workspaceId }"));
  assert.ok(!text.includes("Every query is workspaceId-scoped"));
});

test("parseAddedLines: review-doc prose alone cannot self-trigger the gate", () => {
  const docOnly = [
    "diff --git a/docs/reviews/2026-08-01-x.md b/docs/reviews/2026-08-01-x.md",
    "--- /dev/null",
    "+++ b/docs/reviews/2026-08-01-x.md",
    "@@ -0,0 +2 @@",
    "+Checked: workspaceId scoping holds.",
    "+No new deleteMany( call. No DROP TABLE.",
  ].join("\n");
  const { text } = parseAddedLines(docOnly, { exclude: isUnderReviewDir });
  const r = classifyChange({ files: ["docs/reviews/2026-08-01-x.md"], addedLines: text });
  assert.equal(r.gated, false);
});

test("parseAddedLines: the +++ header line is not counted as content", () => {
  const { text } = parseAddedLines(SAMPLE_DIFF, { exclude: isUnderReviewDir });
  assert.ok(!text.includes("b/lib/db/client.ts"));
});

// ---------------------------------------------------------------------------
// frontmatter
// ---------------------------------------------------------------------------

const FENCED = `---
pr-branch: fable/prereview-gate-2026-08-01
reviewed-commit: a1b2c3d
reviewer: Fable review session (independent)
date: 2026-08-01
verdict: pass-with-notes
---

# Review
`;

test("parseFrontmatter: fenced block, lowercased keys, trimmed values", () => {
  const fm = parseFrontmatter(FENCED);
  assert.equal(fm["reviewed-commit"], "a1b2c3d");
  assert.equal(fm["reviewer"], "Fable review session (independent)");
  assert.equal(fm["verdict"], "pass-with-notes");
  assert.equal(fm["pr-branch"], "fable/prereview-gate-2026-08-01");
});

test("parseFrontmatter: mixed-case keys normalize, quotes are stripped", () => {
  const fm = parseFrontmatter('---\nVerdict: "pass"\nReviewer: `session-b`\n---\n');
  assert.equal(fm["verdict"], "pass");
  assert.equal(fm["reviewer"], "session-b");
});

test("parseFrontmatter: unfenced key/value header stops at the first blank line", () => {
  const fm = parseFrontmatter("reviewer: session-b\nverdict: pass\n\n## Independence\nfoo: bar\n");
  assert.equal(fm["reviewer"], "session-b");
  assert.equal(fm["verdict"], "pass");
  assert.equal(fm["foo"], undefined, "body content must not leak into frontmatter");
});

test("parseFrontmatter: missing frontmatter yields an empty object", () => {
  assert.deepEqual(parseFrontmatter("# Just a heading\n\nProse.\n"), {});
  assert.deepEqual(parseFrontmatter(""), {});
});

// ---------------------------------------------------------------------------
// verdict + reviewer rules
// ---------------------------------------------------------------------------

test("verdict: only pass and pass-with-notes are accepted", () => {
  assert.deepEqual(ALLOWED_VERDICTS, ["pass", "pass-with-notes"]);
  assert.equal(validateVerdict("pass").ok, true);
  assert.equal(validateVerdict("pass-with-notes").ok, true);
  assert.equal(validateVerdict("PASS").ok, true, "case-insensitive");
  assert.equal(validateVerdict("  pass  ").ok, true, "whitespace-tolerant");
});

test("verdict: fail, unknown and missing all block", () => {
  assert.equal(validateVerdict("fail").ok, false);
  assert.equal(validateVerdict("pass-ish").ok, false);
  assert.equal(validateVerdict("").ok, false);
  assert.equal(validateVerdict(undefined).ok, false);
  assert.match(validateVerdict(undefined).reason, /verdict/);
});

test("reviewer: must be named, and never `self`", () => {
  assert.equal(validateReviewer("Fable session 7f3a").ok, true);
  assert.equal(validateReviewer("self").ok, false);
  assert.equal(validateReviewer("SELF").ok, false);
  assert.equal(validateReviewer("  ").ok, false);
  assert.equal(validateReviewer(undefined).ok, false);
});

// ---------------------------------------------------------------------------
// rubric completeness
// ---------------------------------------------------------------------------

function docWith(sections) {
  return ["---", "verdict: pass", "---", "", ...sections.map((s) => `${s}\n\nprose\n`)].join("\n");
}

test("sections: a doc carrying every required heading has nothing missing", () => {
  assert.deepEqual(missingSections(docWith(REQUIRED_SECTIONS)), []);
});

test("sections: dropped headings are reported by name", () => {
  const kept = REQUIRED_SECTIONS.filter(
    (s) => s !== "## Test blind spots" && s !== "## Deletion & retention completeness"
  );
  const missing = missingSections(docWith(kept));
  assert.deepEqual(missing.sort(), ["## Deletion & retention completeness", "## Test blind spots"].sort());
});

test("sections: dash variants and casing in a heading still count as present", () => {
  const body = docWith(REQUIRED_SECTIONS).replace("## Claim–code trace", "## claim-code trace");
  assert.deepEqual(missingSections(body), []);
});

test("sections: the heading must be a heading, not a mention in prose", () => {
  const body = docWith(REQUIRED_SECTIONS).replace(
    "## Test blind spots",
    "See the Test blind spots discussion above."
  );
  assert.deepEqual(missingSections(body), ["## Test blind spots"]);
});

test("sections: the rubric is the eleven ratified headings", () => {
  assert.equal(REQUIRED_SECTIONS.length, 11);
  assert.ok(REQUIRED_SECTIONS.includes("## Independence"));
  assert.ok(REQUIRED_SECTIONS.includes("## Verdict"));
});

// ---------------------------------------------------------------------------
// naming convention helper
// ---------------------------------------------------------------------------

test("branchSlug: branch names become filename-safe slugs", () => {
  assert.equal(branchSlug("fable/prereview-gate-2026-08-01"), "fable-prereview-gate-2026-08-01");
  assert.equal(branchSlug("refs/heads/feat/Billing_Fix"), "feat-billing-fix");
  assert.equal(branchSlug("--weird--"), "weird");
});
