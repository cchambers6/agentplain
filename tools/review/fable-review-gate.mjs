#!/usr/bin/env node
/**
 * fable-review-gate.mjs — independent architectural review gate
 *
 * Zero external dependencies. Node 18+. (node:fs and node:child_process, plus
 * node:url for the main-module guard only.)
 *
 * WHY THIS EXISTS
 * ---------------
 * A sibling project shipped a change that passed 706/706 unit tests AND its
 * acceptance test, while its own validation report carried a load-bearing false
 * claim: it asserted that existing crons "cover the new models for free" when
 * the new models were in fact unreachable by the deletion machinery. Tests
 * passed because tests verify what they encode. Only an independent
 * architectural review caught it.
 *
 * Tests structurally cannot see three drift classes:
 *   1. claim-code divergence  — the PR says X, the code does Y
 *   2. coverage illusions     — "already handled by Z", where Z never
 *                               enumerates the new thing
 *   3. invariant erosion      — a ratified architectural rule quietly stops
 *                               holding
 *
 * This gate makes an independent Fable review session a merge requirement for
 * PRs that touch load-bearing surface. Norm doc:
 *   docs/engineering/pre-merge-review-gate.md
 *
 * WHAT IT DOES
 * ------------
 *   (a) Classifies the PR diff — does it touch gated paths or add gated content?
 *   (b) If gated, verifies a review artifact under docs/reviews/ exists in the
 *       diff, is fresh (no gated changes landed after the reviewed commit), is
 *       complete (every rubric section present), and carries a passing verdict
 *       from a named, independent reviewer.
 *
 * USAGE
 *   node tools/review/fable-review-gate.mjs      # or: npm run review-gate
 *
 * ENV
 *   REVIEW_GATE_BASE      diff base ref. Default "origin/main". CI passes
 *                         origin/<github.base_ref>.
 *   REVIEW_GATE_OVERRIDE  "true" => pass with a loud warning. CI sets this from
 *                         the PR label `review-gate:override`. Conner-only.
 *
 * The pure functions below are exported so tools/review/fable-review-gate.test.mjs
 * can exercise them without a git repo. All git/process orchestration runs only
 * under the main-module guard at the bottom of this file.
 *
 * SUBPROCESS NOTE: every git call goes through execFileSync with an argument
 * ARRAY and no shell. Nothing is interpolated into a shell string anywhere in
 * this file, so refs taken from the environment cannot inject.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ===========================================================================
// CONFIG — the source of truth for what triggers a review.
//
// Changing anything in this block is ITSELF a gated change (tools/review/** is
// a gated path), so the gate reviews its own configuration edits.
// ===========================================================================

/**
 * Gated paths. A PR touching ANY of these needs an independent review doc.
 * Glob syntax: `**` crosses directory separators, `*` does not, `?` is one
 * non-separator character. Matching happens on forward-slash paths.
 */
export const GATED_PATHS = [
  // -- Schema and migrations ------------------------------------------------
  { pattern: "prisma/schema.prisma", why: "the data model every other invariant rests on" },
  { pattern: "prisma/migrations/**", why: "migrations are irreversible in production" },

  // -- Deletion / retention machinery ---------------------------------------
  // This is the exact class that produced the incident: a new model that no
  // purge path enumerates looks fine to every test in the suite.
  { pattern: "lib/storage/**", why: "object store and category purge — deletion completeness" },
  { pattern: "lib/memory/**", why: "memory tiering and retention — deletion completeness" },
  { pattern: "lib/plaino/chat-retention.ts", why: "chat retention window — deletion completeness" },
  { pattern: "lib/plaino/conversation-cleanup.ts", why: "conversation purge cron — deletion completeness" },
  { pattern: "lib/customer-data/**", why: "customer data export and erase paths" },

  // -- Agent output that reaches customers ----------------------------------
  { pattern: "lib/agents/**", why: "agent behaviour reaches customers directly" },
  { pattern: "lib/skills/**", why: "skill definitions drive agent output" },
  { pattern: "lib/email/**", why: "outbound-shaped surface — the no-outbound invariant lives here" },
  { pattern: "lib/voice/**", why: "voice surface reaches customers live" },
  { pattern: "lib/plaino/**", why: "Plaino is the named customer-facing service partner" },
  { pattern: "lib/portal/**", why: "customer portal rendering and access" },

  // -- Security / tenancy enforcement ---------------------------------------
  { pattern: "lib/auth/**", why: "authentication and session handling" },
  { pattern: "lib/security/**", why: "security primitives and enforcement" },
  { pattern: "lib/abuse/**", why: "abuse limits and rate enforcement" },
  { pattern: "lib/db/**", why: "query layer — where tenancy scoping is enforced or lost" },
  { pattern: "middleware.ts", why: "edge request gating for the whole app" },

  // -- LLM provider seam ----------------------------------------------------
  { pattern: "lib/llm/**", why: "ratified compose order Logging(Budget(Sentinel(Caching(Anthropic))))" },

  // -- Money ----------------------------------------------------------------
  { pattern: "lib/billing/**", why: "money paths — charges, trials, guarantees" },
  { pattern: "lib/pricing/**", why: "ratified three-tier pricing" },

  // -- The gates themselves -------------------------------------------------
  { pattern: ".github/workflows/**", why: "CI is the enforcement point; weakening it is invisible to tests" },
  { pattern: "tools/review/**", why: "the review gate gates its own configuration" },
  { pattern: "tools/brand/**", why: "brand and voice gates protect ratified customer surface" },
];

/**
 * Gated content. Matched against ADDED lines only — a diff that merely deletes
 * or moves these is caught by the path rules above where it matters.
 */
export const GATED_CONTENT = [
  { name: "workspaceId", regex: /workspaceId/, why: "tenancy scoping — any diff touching it is load-bearing" },
  { name: "deleteMany(", regex: /deleteMany\(/, why: "bulk deletion — scope and completeness must be reviewed" },
  { name: "DROP TABLE", regex: /DROP\s+TABLE/i, why: "destructive migration" },
  { name: "DROP COLUMN", regex: /DROP\s+COLUMN/i, why: "destructive migration" },
];

/** Required rubric headings. These mirror docs/reviews/TEMPLATE.md exactly. */
export const REQUIRED_SECTIONS = [
  "## Independence",
  "## Claim–code trace",
  "## Tenancy & isolation",
  "## Deletion & retention completeness",
  "## Outbound invariant",
  "## LLM seam invariants",
  "## Customer-surface invariants",
  "## Migration safety",
  "## Cold-start safety",
  "## Test blind spots",
  "## Verdict",
];

/** Verdicts that let a PR through. Anything else (including `fail`) blocks. */
export const ALLOWED_VERDICTS = ["pass", "pass-with-notes"];

/** Where review artifacts live, and which files in there are not artifacts. */
export const REVIEW_DOC_GLOB = "docs/reviews/*.md";
export const REVIEW_DOC_DIR = "docs/reviews/";
export const REVIEW_DOC_EXCLUDED = ["docs/reviews/TEMPLATE.md", "docs/reviews/README.md"];

/** The template a reviewer copies, the norm doc, and this file. Quoted in failures. */
export const TEMPLATE_PATH = "docs/reviews/TEMPLATE.md";
export const NORM_DOC_PATH = "docs/engineering/pre-merge-review-gate.md";
export const SELF_PATH = "tools/review/fable-review-gate.mjs";

// ===========================================================================
// PURE HELPERS — exported for the test suite. No git, no process state.
// ===========================================================================

/** Windows checkouts and `git diff` disagree on separators. Normalize to `/`. */
export function normalizePath(p) {
  return String(p ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
}

const globCache = new Map();

/**
 * Minimal glob -> RegExp. Deliberately hand-rolled: this script must run in CI
 * with no `npm install`, so pulling in minimatch is not an option.
 *   `**`        any characters, including `/`   ("lib/agents/**")
 *   `**` + `/`  optional directory span, so "a/**' + '/b" matches "a/b" too
 *   `*`         any characters except `/`
 *   `?`         one character except `/`
 */
export function globToRegExp(pattern) {
  const p = normalizePath(pattern);
  const cached = globCache.get(p);
  if (cached) return cached;

  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        i++; // consume the second '*'
        if (p[i + 1] === "/") {
          i++; // consume the '/' so "a/**/b" also matches "a/b"
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
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

  const compiled = new RegExp("^" + re + "$");
  globCache.set(p, compiled);
  return compiled;
}

/** True when `filePath` matches the glob `pattern` (separators normalized). */
export function matchesGlob(filePath, pattern) {
  return globToRegExp(pattern).test(normalizePath(filePath));
}

/** True when the path is a review artifact (not the template, not the README). */
export function isReviewDoc(filePath) {
  const f = normalizePath(filePath);
  if (REVIEW_DOC_EXCLUDED.includes(f)) return false;
  return matchesGlob(f, REVIEW_DOC_GLOB);
}

/** True for anything under docs/reviews/, template and README included. */
export function isUnderReviewDir(filePath) {
  return normalizePath(filePath).startsWith(REVIEW_DOC_DIR);
}

/**
 * Files whose ADDED LINES are exempt from the content rules: the whole docs/
 * tree. Prose legitimately quotes `workspaceId`, `deleteMany(` and `DROP TABLE`
 * when describing the system (audit reports, this gate's own norm doc, review
 * docs). Documentation cannot erode an invariant — content rules target code.
 * Path rules are unaffected: docs/ is not a gated path, and gated paths are
 * matched on the file list, not through this predicate.
 */
export function isContentExempt(filePath) {
  return normalizePath(filePath).startsWith("docs/");
}

/**
 * Parse a unified diff into added lines, per file.
 * Returns { byFile: Map<file, string[]>, text } where `text` is every added
 * line joined by newlines, EXCLUDING files matched by `exclude`.
 *
 * Why per-file: docs/reviews/** legitimately quotes `workspaceId` and
 * `deleteMany(` in prose. Attributing added lines to their file lets us drop
 * the review docs before content matching instead of self-triggering.
 */
export function parseAddedLines(diffText, { exclude = () => false } = {}) {
  const byFile = new Map();
  let current = null;
  for (const raw of String(diffText ?? "").split("\n")) {
    if (raw.startsWith("+++ ")) {
      // "+++ b/path/to/file" — or "+++ /dev/null" for deletions.
      const target = raw.slice(4).trim();
      current = target === "/dev/null" ? null : normalizePath(target.replace(/^[ab]\//, ""));
      continue;
    }
    if (raw.startsWith("--- ") || raw.startsWith("diff --git") || raw.startsWith("@@")) continue;
    if (!raw.startsWith("+")) continue;
    if (current === null) continue;
    if (!byFile.has(current)) byFile.set(current, []);
    byFile.get(current).push(raw.slice(1));
  }

  const kept = [];
  for (const [file, fileLines] of byFile) {
    if (exclude(file)) continue;
    kept.push(...fileLines);
  }
  return { byFile, text: kept.join("\n") };
}

/**
 * Classify a change set. Pure: takes a file list and the added-lines text.
 * Returns { gated, pathMatches, contentMatches }.
 */
export function classifyChange({ files = [], addedLines = "" } = {}) {
  const pathMatches = [];
  for (const file of files) {
    const f = normalizePath(file);
    for (const rule of GATED_PATHS) {
      if (matchesGlob(f, rule.pattern)) {
        pathMatches.push({ file: f, pattern: rule.pattern, why: rule.why });
        break; // one reason per file is enough for the log
      }
    }
  }

  const contentMatches = [];
  const added = String(addedLines ?? "");
  if (added.length > 0) {
    const addedList = added.split("\n");
    for (const rule of GATED_CONTENT) {
      const hit = addedList.find((l) => rule.regex.test(l));
      if (hit !== undefined) {
        contentMatches.push({ name: rule.name, why: rule.why, sample: hit.trim().slice(0, 120) });
      }
    }
  }

  return {
    gated: pathMatches.length > 0 || contentMatches.length > 0,
    pathMatches,
    contentMatches,
  };
}

/**
 * Hand-rolled frontmatter parse. No yaml dependency by design.
 * Accepts a leading `---` fence (preferred) or a bare run of `key: value`
 * lines at the top of the file. Keys are lowercased; values are trimmed and
 * unwrapped from surrounding quotes or backticks.
 */
export function parseFrontmatter(text) {
  const allLines = String(text ?? "").split(/\r?\n/);
  let i = 0;
  let fenced = false;

  while (i < allLines.length && allLines[i].trim() === "") i++;
  if (allLines[i] !== undefined && allLines[i].trim() === "---") {
    fenced = true;
    i++;
  }

  const out = {};
  for (; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    if (fenced && trimmed === "---") break;
    if (trimmed === "") {
      if (fenced) continue; // blank lines inside the fence are fine
      break; // unfenced frontmatter ends at the first blank line
    }
    const m = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) {
      if (fenced) continue; // tolerate stray prose inside the fence
      break;
    }
    const value = m[2].trim().replace(/^["'`](.*)["'`]$/, "$1").trim();
    out[m[1].toLowerCase()] = value;
  }
  return out;
}

/** Verdict rule: pass | pass-with-notes. Everything else blocks. */
export function validateVerdict(verdict) {
  const v = String(verdict ?? "").trim().toLowerCase();
  if (v === "") return { ok: false, reason: "frontmatter `verdict:` is missing" };
  if (!ALLOWED_VERDICTS.includes(v)) {
    return { ok: false, reason: `verdict "${verdict}" is not one of: ${ALLOWED_VERDICTS.join(" | ")}` };
  }
  return { ok: true, verdict: v };
}

/** Reviewer rule: non-empty, and not the literal `self`. */
export function validateReviewer(reviewer) {
  const r = String(reviewer ?? "").trim();
  if (r === "") return { ok: false, reason: "frontmatter `reviewer:` is missing or empty" };
  if (r.toLowerCase() === "self") {
    return {
      ok: false,
      reason: 'reviewer "self" is not accepted — name the independent session that reviewed this change',
    };
  }
  return { ok: true, reviewer: r };
}

/** Normalize a heading for comparison: dash variants, whitespace, case. */
function normalizeHeading(s) {
  return String(s ?? "")
    .replace(/[‐-―−]/g, "-") // en/em/figure dashes and minus -> hyphen
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Which REQUIRED_SECTIONS headings are absent from the markdown body. */
export function missingSections(markdown, required = REQUIRED_SECTIONS) {
  const present = new Set(
    String(markdown ?? "")
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith("#"))
      .map((l) => normalizeHeading(l))
  );
  return required.filter((h) => !present.has(normalizeHeading(h)));
}

/** Slugify a branch name for the `<yyyy-mm-dd>-<branch-slug>.md` convention. */
export function branchSlug(branch) {
  return String(branch ?? "")
    .replace(/^refs\/heads\//, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

// ===========================================================================
// GIT ORCHESTRATION — impure. Runs only under the main-module guard.
// ===========================================================================

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")} failed: ${err.message}`);
  }
}

/** Boolean-valued git predicates (`merge-base --is-ancestor`). */
function gitOk(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function toLines(out) {
  return String(out ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// --- Output helpers --------------------------------------------------------

const BAR = "-".repeat(74);

function header(title) {
  console.log(BAR);
  console.log(title);
  console.log(BAR);
}

function fail(title, fixLines) {
  console.error("");
  console.error(BAR);
  console.error(`FABLE REVIEW GATE — FAIL: ${title}`);
  console.error(BAR);
  for (const l of fixLines) console.error(l);
  console.error("");
  process.exit(1);
}

/** Every failure ends with the same actionable recipe. Agents read these. */
function howToFix(extra = []) {
  return [
    "",
    "HOW TO FIX",
    "  1. Ask for an INDEPENDENT review session — a fresh Fable session that did",
    "     not build this change and does not share the builder's context.",
    `  2. That session copies ${TEMPLATE_PATH} to`,
    "     docs/reviews/<yyyy-mm-dd>-<branch-slug>.md",
    "  3. It fills EVERY section. No section may be dropped; if one does not",
    '     apply, keep the heading and write "checked, not applicable because X".',
    "  4. It sets the frontmatter: reviewed-commit (a commit created on THIS",
    "     branch), reviewer (its own session identity, never `self`), date, and",
    "     verdict (pass | pass-with-notes).",
    "  5. It commits the doc to this branch. CI re-runs and verifies it.",
    "",
    `  Norm doc:      ${NORM_DOC_PATH}`,
    `  Gated surface: CONFIG block of ${SELF_PATH}`,
    ...extra,
  ];
}

// --- Step 1: classify the PR ----------------------------------------------

function classifyPr(base) {
  // Changed files across the PR range. `...` means "changes on HEAD since the
  // merge base", so commits that landed on the base branch meanwhile are
  // correctly ignored.
  const files = toLines(git(["diff", "--name-only", `${base}...HEAD`]));

  // Added lines only, attributed to their file so that docs/** prose (which
  // quotes `workspaceId`, `deleteMany(` and friends when describing the
  // system) cannot self-trigger the content rules.
  const diff = git(["diff", "-U0", `${base}...HEAD`]);
  const { text: addedLines } = parseAddedLines(diff, { exclude: isContentExempt });

  return { files, result: classifyChange({ files, addedLines }) };
}

// --- Step 2: locate the review artifact in this PR's diff ------------------

function findReviewDocs(files) {
  return files.filter((f) => isReviewDoc(f)).filter((f) => existsSync(f));
}

// --- Step 3: validate one review doc ---------------------------------------

function validateReviewDoc(path, base) {
  const errors = [];
  const body = readFileSync(path, "utf8");
  const fm = parseFrontmatter(body);

  // 3a. reviewed-commit — must resolve, be an ancestor of HEAD, and live INSIDE
  //     the PR range (not already reachable from the base). A review pointing at
  //     a base-branch commit reviewed nothing in this PR.
  const reviewedRaw = fm["reviewed-commit"] ?? "";
  let reviewed = null;
  if (!reviewedRaw) {
    errors.push("frontmatter `reviewed-commit:` is missing");
  } else {
    const resolved = git(["rev-parse", "--verify", `${reviewedRaw}^{commit}`], { allowFail: true });
    if (!resolved) {
      errors.push(`reviewed-commit "${reviewedRaw}" does not resolve to a commit in this repo`);
    } else {
      reviewed = resolved.trim();
      if (!gitOk(["merge-base", "--is-ancestor", reviewed, "HEAD"])) {
        errors.push(
          `reviewed-commit ${reviewedRaw} is not an ancestor of HEAD — it is not part of this branch`
        );
      } else if (gitOk(["merge-base", "--is-ancestor", reviewed, base])) {
        errors.push(
          `reviewed-commit ${reviewedRaw} is already reachable from ${base}, so it is a base-branch ` +
            "commit and reviewed nothing in this PR. Point it at a commit created on this branch."
        );
      }
    }
  }

  // 3b. reviewer — named, and not `self`. The doc's Independence section carries
  //     the real attestation; this field just names who to go ask.
  const reviewerCheck = validateReviewer(fm["reviewer"]);
  if (!reviewerCheck.ok) errors.push(reviewerCheck.reason);

  // 3c. verdict — pass | pass-with-notes.
  const verdictCheck = validateVerdict(fm["verdict"]);
  if (!verdictCheck.ok) errors.push(verdictCheck.reason);

  // 3d. rubric completeness — every required heading present.
  const missing = missingSections(body);
  if (missing.length > 0) {
    errors.push(`missing required section heading(s): ${missing.join(", ")}`);
  }

  // 3e. staleness — nothing gated may land after the reviewed commit. Changes
  //     under docs/reviews/** are always allowed after it, because the review
  //     doc itself lands after the commit it reviews, by construction.
  if (reviewed && errors.length === 0) {
    const after = toLines(git(["rev-list", `${reviewed}..HEAD`])).reverse();
    for (const sha of after) {
      // "<sha>^ <sha>" diffs a merge against its FIRST parent, which is what we
      // want: work brought onto this branch counts as landing after the review.
      const changed = toLines(git(["diff", "--name-only", `${sha}^`, sha], { allowFail: true })).filter(
        (f) => !isUnderReviewDir(f)
      );
      const diff = git(["diff", "-U0", `${sha}^`, sha], { allowFail: true }) ?? "";
      const { text: added } = parseAddedLines(diff, { exclude: isContentExempt });
      const c = classifyChange({ files: changed, addedLines: added });
      if (c.gated) {
        const subject = (git(["log", "-1", "--format=%s", sha], { allowFail: true }) ?? "").trim();
        errors.push(
          [
            "gated changes landed after the review — re-review required",
            `        commit ${sha.slice(0, 12)}  ${subject}`,
            ...c.pathMatches.slice(0, 5).map((m) => `        path: ${m.file}  (${m.pattern})`),
            ...c.contentMatches.slice(0, 5).map((m) => `        content: ${m.name}  (${m.why})`),
          ].join("\n")
        );
        break;
      }
    }
  }

  return { path, errors, frontmatter: fm };
}

// --- main ------------------------------------------------------------------

function main() {
  const base = process.env.REVIEW_GATE_BASE || "origin/main";
  const override = String(process.env.REVIEW_GATE_OVERRIDE ?? "").trim().toLowerCase() === "true";

  header("Fable review gate — independent architectural review");
  console.log(`base: ${base}`);

  // The override short-circuits everything, including git resolution, so a
  // broken base ref can never trap a PR that Conner has explicitly waved through.
  if (override) {
    console.log("");
    console.log("!".repeat(74));
    console.log("!!  FABLE REVIEW GATE HUMAN-OVERRIDDEN");
    console.log("!!");
    console.log("!!  This PR carries the label `review-gate:override`.");
    console.log("!!  No independent architectural review was verified for this merge.");
    console.log("!!  The drift classes this gate exists to catch — claim-code divergence,");
    console.log("!!  coverage illusions, invariant erosion — are UNCHECKED on this change.");
    console.log("!!");
    console.log("!!  Only Conner applies this label. If you are an agent and you think you");
    console.log("!!  need it, what you actually need is a review.");
    console.log(`!!  Norm doc: ${NORM_DOC_PATH}`);
    console.log("!".repeat(74));
    console.log("");
    process.exit(0);
  }

  // -- Step 1: classify -----------------------------------------------------
  const { files, result } = classifyPr(base);
  console.log(`changed files: ${files.length}`);

  if (!result.gated) {
    console.log("");
    console.log("PASS — no review required.");
    console.log("  This diff touches no gated path and adds no gated content.");
    console.log(`  Gated surface is defined in the CONFIG block of ${SELF_PATH}.`);
    console.log("");
    process.exit(0);
  }

  console.log("");
  console.log("This PR is GATED. Reasons:");
  for (const m of result.pathMatches.slice(0, 25)) {
    console.log(`  path     ${m.file}`);
    console.log(`           -> ${m.pattern} — ${m.why}`);
  }
  if (result.pathMatches.length > 25) {
    console.log(`  ... and ${result.pathMatches.length - 25} more gated file(s)`);
  }
  for (const m of result.contentMatches) {
    console.log(`  content  ${m.name} — ${m.why}`);
    console.log(`           -> ${m.sample}`);
  }
  console.log("");

  // -- Step 2: find the review artifact -------------------------------------
  const docs = findReviewDocs(files);
  if (docs.length === 0) {
    fail("no independent review doc in this PR", [
      "This PR touches load-bearing surface, so it needs an independent",
      "architectural review committed to the branch. None was found.",
      "",
      `Expected: a file matching ${REVIEW_DOC_GLOB} (not TEMPLATE.md, not README.md)`,
      "added or modified in this PR's diff.",
      ...howToFix(),
    ]);
  }
  console.log(`review doc(s) found in diff: ${docs.join(", ")}`);

  // -- Step 3: validate. At least one doc must be fully valid. --------------
  // More than one is legitimate: a re-review after gated changes lands a second
  // doc, and only the newest one satisfies the staleness rule.
  const results = docs.map((d) => validateReviewDoc(d, base));
  const good = results.find((r) => r.errors.length === 0);
  if (!good) {
    const detail = [];
    for (const r of results) {
      detail.push(`  ${r.path}`);
      for (const e of r.errors) detail.push(`    - ${e}`);
    }
    fail("the review doc(s) in this PR did not satisfy the gate", [
      "Every problem found:",
      ...detail,
      ...howToFix([
        "",
        "  If a gated commit landed AFTER the review, the fix is a re-review: a",
        "  fresh independent session re-reads the change, updates reviewed-commit:",
        "  to the current HEAD of the branch, and commits the updated doc.",
      ]),
    ]);
  }

  console.log("");
  console.log("PASS — independent architectural review verified.");
  console.log(`  doc:             ${good.path}`);
  console.log(`  reviewer:        ${good.frontmatter["reviewer"]}`);
  console.log(`  reviewed-commit: ${good.frontmatter["reviewed-commit"]}`);
  console.log(`  verdict:         ${good.frontmatter["verdict"]}`);
  console.log("");
  process.exit(0);
}

// Main-module guard: importing this file (the test suite does) must not run git.
const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error("");
    console.error(`FABLE REVIEW GATE — ERROR: ${err.message}`);
    console.error("");
    console.error("This is a gate malfunction, not a review failure. Check that the base ref");
    console.error("exists locally (CI runs `git fetch origin <base>` first) and that the");
    console.error("checkout has full history (actions/checkout with fetch-depth: 0).");
    process.exit(1);
  }
}
