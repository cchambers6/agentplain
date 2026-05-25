#!/usr/bin/env tsx
/**
 * scripts/check-schema-drift.ts
 *
 * CI gate: catch the case where `prisma/schema.prisma` and
 * `prisma/migrations/*` have drifted out of sync. The most common cause
 * is a developer editing the schema but forgetting to run
 * `prisma migrate dev` to generate the corresponding migration file —
 * which then ships green locally (the dev DB matches the schema) but
 * `prisma migrate deploy` in production has nothing to apply.
 *
 * ## Strategy: baseline-comparison
 *
 * We run `prisma migrate diff --from-migrations <dir> --to-schema-datamodel
 * <file> --script` to produce SQL that would reconcile the schema with the
 * migrations, then **compare** that SQL (normalized) against a checked-in
 * baseline at `prisma/schema-drift-baseline.sql`. The check is:
 *
 *   - GREEN when the current diff EQUALS the baseline (no new drift).
 *   - RED when the current diff DIFFERS from the baseline (a schema change
 *     was committed without a matching migration, OR a new piece of
 *     intentional-but-unrepresentable drift needs to be added to the
 *     baseline with a comment explaining why).
 *
 * Why a baseline (not a pure empty-diff check): the repo carries
 * pre-existing, load-bearing drift that we cannot fix without either
 * (a) regressing the pgvector ANN index `Embedding_vector_cosine_idx`
 * (Prisma's schema language has no representation for pgvector index
 * types), or (b) churning every table for cosmetic Prisma-version
 * differences (UUID id DROP DEFAULT × 20 tables, FK reformatting × 22).
 * See `prisma/schema-drift-baseline.README.md` for the full catalogue.
 *
 * The baseline approach keeps the gate genuinely strict — ANY new diff
 * beyond the documented baseline flips it red — while letting us land
 * the reconciliation migration as a sequenced follow-up after PR #68's
 * WebhookEvent migration merges (so the new dedupeKey/attemptCount/
 * nextAttemptAt/deadlettered columns don't collide with a bulk DROP
 * DEFAULT pass).
 *
 * ## Normalization
 *
 * `prisma migrate diff` emits SQL with consistent formatting, but minor
 * variations (trailing whitespace, CRLF vs LF on Windows, blank-line
 * count between statements) would create false positives. We normalize
 * by: trimming trailing whitespace on each line, collapsing any run of
 * blank lines to a single blank line, stripping leading + trailing
 * blank lines, and standardizing on LF. Comparison is byte-equal on
 * the normalized strings.
 *
 * ## Skip behavior
 *
 * When SHADOW_DATABASE_URL is not set and we're not in CI (no
 * `CI=true`), the script logs a "skipped" message and exits 0 so
 * developers running `npm run check:schema-drift` locally without
 * Postgres handy don't get a false failure. In CI the env var is
 * always set — see `.github/workflows/schema-drift.yml`.
 *
 * ## Update flow
 *
 * If you INTENTIONALLY introduce new drift (e.g. another index type
 * Prisma can't represent), regenerate the baseline:
 *
 *   SHADOW_DATABASE_URL=postgres://… \
 *     npm run check:schema-drift -- --update-baseline
 *
 * Then `git diff prisma/schema-drift-baseline.sql` and explain the
 * change in the PR description + the baseline README.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "prisma", "schema.prisma");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "prisma", "migrations");
const BASELINE_PATH = resolve(REPO_ROOT, "prisma", "schema-drift-baseline.sql");

function ensurePathExists(path: string, label: string): void {
  if (!existsSync(path)) {
    console.error(`schema-drift: ${label} not found at ${path}`);
    process.exit(1);
  }
}

/**
 * Normalize SQL output for byte-equal comparison.
 *
 * Discipline:
 *   - Trim trailing whitespace on every line (Prisma sometimes adds a
 *     trailing space after statement terminators).
 *   - Collapse any run of blank lines to a single blank line.
 *   - Strip leading + trailing blank lines so the file's outer
 *     boundaries don't matter.
 *   - Convert CRLF / CR to LF so Windows checkouts compare equal to the
 *     CI runner's Linux checkout.
 *
 * Comment lines (Prisma emits `-- DropForeignKey`, `-- AlterTable`,
 * etc.) are NOT stripped — those are the section markers that make the
 * comparison meaningful. If we stripped them, a refactor that removed
 * a DROP CONSTRAINT could be hidden by a re-ordering elsewhere.
 */
function normalizeSql(raw: string): string {
  const lf = raw.replace(/\r\n?/g, "\n");
  const trimmed = lf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n");
  // Collapse runs of >1 blank line to exactly one blank line.
  const collapsed = trimmed.replace(/\n{3,}/g, "\n\n");
  // Strip leading + trailing blank lines.
  return collapsed.replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
}

/** Run `prisma migrate diff` and capture stdout. Returns the raw SQL
 *  string (empty when migrations match schema exactly). Throws on any
 *  unexpected prisma exit code; status 0 (in sync) and 2 (non-empty
 *  diff) are both expected.
 */
function captureDiffSql(shadowUrl: string): string {
  const args = [
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    MIGRATIONS_DIR,
    "--to-schema-datamodel",
    SCHEMA_PATH,
    "--shadow-database-url",
    shadowUrl,
    "--script",
    // NOTE: NO --exit-code here. We want stdout regardless of whether the
    // diff is empty (exit 0) or non-empty (exit 0 without --exit-code).
    // The comparison-against-baseline below is what gates the build.
  ];
  const result = spawnSync("npx", args, {
    cwd: REPO_ROOT,
    shell: process.platform === "win32",
    encoding: "utf8",
    // `migrate diff` can produce a large diff — bump the default 1MB
    // buffer so a future schema doesn't truncate.
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(
      `schema-drift: failed to invoke npx prisma — ${result.error.message}`,
    );
  }
  if (result.status !== 0 && result.status !== 2) {
    // Prisma also prints to stderr; surface it for the operator.
    if (result.stderr) {
      console.error(result.stderr);
    }
    throw new Error(
      `schema-drift: unexpected prisma migrate diff exit code ${result.status ?? "<null>"}`,
    );
  }
  return result.stdout ?? "";
}

function readBaseline(): string {
  if (!existsSync(BASELINE_PATH)) {
    // Treat a missing baseline as "expected empty diff" — the strictest
    // possible gate. The repo ships with a non-empty baseline today, so
    // this branch is for future cleanup where the reconciliation
    // migration has shrunk the baseline to zero and someone removed
    // the file entirely.
    return normalizeSql("");
  }
  return normalizeSql(readFileSync(BASELINE_PATH, "utf8"));
}

function writeBaseline(content: string): void {
  writeFileSync(BASELINE_PATH, content, { encoding: "utf8" });
}

function main(): void {
  ensurePathExists(SCHEMA_PATH, "Prisma schema");
  ensurePathExists(MIGRATIONS_DIR, "Migrations directory");

  const updateBaseline = process.argv.includes("--update-baseline");

  const shadowUrl = process.env.SHADOW_DATABASE_URL;
  if (!shadowUrl) {
    if (process.env.CI === "true") {
      console.error(
        "schema-drift: SHADOW_DATABASE_URL is required in CI. " +
          "Set it on the workflow step (see .github/workflows/schema-drift.yml).",
      );
      process.exit(1);
    }
    console.log(
      "schema-drift: skipped (no SHADOW_DATABASE_URL set locally).\n" +
        "             To run locally, start a throwaway Postgres (with pgvector) and export\n" +
        "             SHADOW_DATABASE_URL=postgres://user:pass@localhost:5432/shadow",
    );
    return;
  }

  console.log(
    "schema-drift: capturing `prisma migrate diff` against the migrations directory",
  );

  let currentSql: string;
  try {
    currentSql = captureDiffSql(shadowUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }

  const currentNorm = normalizeSql(currentSql);

  if (updateBaseline) {
    writeBaseline(currentNorm);
    console.log(
      `schema-drift: ✓ baseline updated → ${BASELINE_PATH}\n` +
        "             Review the diff and explain it in the PR description +\n" +
        "             prisma/schema-drift-baseline.README.md.",
    );
    return;
  }

  const baselineNorm = readBaseline();

  if (currentNorm === baselineNorm) {
    if (currentNorm.trim().length === 0) {
      console.log("schema-drift: ✓ schema and migrations are in sync");
    } else {
      console.log(
        "schema-drift: ✓ current diff matches the checked-in baseline " +
          "(prisma/schema-drift-baseline.sql)",
      );
    }
    return;
  }

  // Diverged from baseline — print the current diff so the CI log shows
  // what changed, plus instructions for the developer to resolve.
  console.error("");
  console.error(
    "schema-drift: ✗ NEW DRIFT detected (current diff differs from " +
      "prisma/schema-drift-baseline.sql).",
  );
  console.error("");
  console.error("── current `prisma migrate diff` output ──");
  console.error(currentNorm);
  console.error("── expected (baseline) ──");
  console.error(baselineNorm);
  console.error("──────────────────────────────────────────");
  console.error("");
  console.error("Two ways forward:");
  console.error(
    "  1. If the change is a SCHEMA edit you forgot to migrate, run:",
  );
  console.error("       npx prisma migrate dev --name <short-description>");
  console.error("     and commit the generated prisma/migrations/* folder.");
  console.error(
    "  2. If the change is INTENTIONAL drift Prisma can't represent",
  );
  console.error(
    "     (e.g. another pgvector index type), update the baseline:",
  );
  console.error(
    "       SHADOW_DATABASE_URL=… npm run check:schema-drift -- --update-baseline",
  );
  console.error(
    "     and document the new entry in prisma/schema-drift-baseline.README.md.",
  );
  process.exit(2);
}

main();
