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
 * Strategy: use `prisma migrate diff` to compute the SQL delta between
 *   (a) the schema as built up by replaying every migration into a
 *       shadow database (`--from-migrations <dir>`); and
 *   (b) the current schema.prisma (`--to-schema-datamodel <file>`).
 * When they match, the diff is empty and prisma exits 0. When they
 * diverge, the diff is non-empty and prisma exits 2 (per
 * https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-diff
 * read 2026-05-24). We pass `--exit-code` so the process exit signal
 * matches that contract, and we print the SQL so the CI log shows
 * exactly what migration is missing.
 *
 * Why a shadow DB at all: `--from-migrations` doesn't know what the
 * schema would look like without actually applying the migrations
 * somewhere. Postgres-specific features (uuid, gin, partial indexes)
 * mean we can't substitute SQLite. CI provides a Postgres service
 * container; locally you can point at any throwaway Postgres database
 * via SHADOW_DATABASE_URL.
 *
 * Skip behavior: when SHADOW_DATABASE_URL is not set and we're not in
 * CI (no `CI=true`), the script logs a "skipped" message and exits 0
 * so developers running `npm run check:schema-drift` locally without
 * Postgres handy don't get a false failure. In CI the env var is
 * always set — see `.github/workflows/schema-drift.yml`.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "prisma", "schema.prisma");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "prisma", "migrations");

function ensurePathExists(path: string, label: string): void {
  if (!existsSync(path)) {
    console.error(`schema-drift: ${label} not found at ${path}`);
    process.exit(1);
  }
}

function main(): void {
  ensurePathExists(SCHEMA_PATH, "Prisma schema");
  ensurePathExists(MIGRATIONS_DIR, "Migrations directory");

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
        "             To run locally, start a throwaway Postgres and export\n" +
        "             SHADOW_DATABASE_URL=postgres://user:pass@localhost:5432/shadow",
    );
    return;
  }

  // `prisma migrate diff` arguments per the CLI docs:
  //   --from-migrations <dir>   apply every migration in <dir> to a
  //                             shadow DB and use the resulting state
  //                             as the source.
  //   --to-schema-datamodel <p> use the schema.prisma file as the
  //                             target state.
  //   --shadow-database-url     Postgres URL Prisma can clone for the
  //                             ephemeral apply.
  //   --exit-code               exit 2 when the diff is non-empty
  //                             (otherwise 0 + prints SQL).
  //   --script                  emit raw SQL (not human prose) — gives
  //                             us a copy-paste artifact for the
  //                             developer to drop into a new migration.
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
    "--exit-code",
    "--script",
  ];

  console.log(
    "schema-drift: comparing prisma/migrations/** against prisma/schema.prisma",
  );
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    cwd: REPO_ROOT,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`schema-drift: failed to invoke npx prisma — ${result.error.message}`);
    process.exit(1);
  }

  if (result.status === 0) {
    console.log("schema-drift: ✓ schema and migrations are in sync");
    return;
  }

  if (result.status === 2) {
    // Non-empty diff — drift detected. Prisma already printed the SQL
    // above. Make the resolution explicit.
    console.error("");
    console.error(
      "schema-drift: ✗ DRIFT DETECTED. The schema.prisma above includes",
    );
    console.error(
      "             changes that no migration applies. Fix this locally:",
    );
    console.error("");
    console.error("    npx prisma migrate dev --name <short-description>");
    console.error("");
    console.error(
      "             …then commit the generated prisma/migrations/* folder.",
    );
    process.exit(2);
  }

  console.error(
    `schema-drift: ✗ unexpected exit code ${result.status ?? "<null>"} from prisma migrate diff`,
  );
  process.exit(result.status ?? 1);
}

main();
