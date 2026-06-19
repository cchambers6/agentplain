#!/usr/bin/env node
/**
 * Production-only `prisma migrate deploy` gate for the Vercel build.
 *
 * WHY THIS EXISTS
 * ---------------
 * The build command used to be:
 *     prisma generate && prisma migrate deploy && next build
 * which ran `migrate deploy` on EVERY Vercel build — preview and production
 * alike. Two problems followed from that:
 *
 *   1. Fragility. Preview deploys (including docs-only PRs) failed whenever
 *      Neon was unreachable or cold-starting, because `migrate deploy` opens a
 *      DIRECT (non-pooled) connection to Neon at build time. A transient DB
 *      blip reddened every open PR's "Vercel" check even though the diff never
 *      touched the schema. (Root-caused 2026-06-19: P1001 "Can't reach database
 *      server" killed main + all open PR builds for hours.)
 *
 *   2. Preview builds mutated PRODUCTION schema. DATABASE_URL is a single
 *      environment value shared by preview and production, so every preview
 *      build's `migrate deploy` applied pending migrations to the live prod
 *      database — a side effect no PR author intends.
 *
 * THE FIX
 * -------
 * Run `prisma migrate deploy` ONLY for production builds (VERCEL_ENV ===
 * "production"). Preview and local builds skip it and stay DB-free, so a Neon
 * blip can no longer redden a preview, and previews never touch prod schema.
 * Production builds still apply migrations exactly as before — no silent drift,
 * and prod never deploys a schema-dependent app against an un-migrated DB.
 *
 * A production build that genuinely cannot reach the database will still fail
 * here, which is correct: do not ship a prod deploy when its migrations can't
 * be applied. That failure is a real signal (DB down / unreachable), not noise.
 */
import { spawnSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined (local)

if (vercelEnv && vercelEnv !== "production") {
  console.log(
    `[migrate-gate] VERCEL_ENV="${vercelEnv}" — skipping \`prisma migrate deploy\` ` +
      `(non-production build stays DB-free; migrations apply only on production deploys).`,
  );
  process.exit(0);
}

if (!vercelEnv) {
  console.log(
    "[migrate-gate] No VERCEL_ENV (local build) — skipping `prisma migrate deploy`. " +
      "Run `npm run migrate:deploy` explicitly to apply migrations locally.",
  );
  process.exit(0);
}

console.log("[migrate-gate] VERCEL_ENV=production — running `prisma migrate deploy`.");
const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("[migrate-gate] Failed to spawn prisma:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
