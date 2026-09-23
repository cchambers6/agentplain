#!/usr/bin/env node
/**
 * Production build gate for Prisma migrations.
 *
 * WHAT CHANGED (2026-09-21) AND WHY
 * ---------------------------------
 * This script used to RUN `prisma migrate deploy` during the production build.
 * That coupling cost 96 days of production.
 *
 * The record: the last successful production deployment was `d5fcfad9` on
 * 2026-06-17. The 140 production deployments after it — every merge to main,
 * auto-deployed by Vercel exactly as configured — all failed. The one build log
 * Vercel still retains (2026-09-14, commit 2fe80b5) shows why:
 *
 *     [migrate-gate] VERCEL_ENV=production — running `prisma migrate deploy`.
 *     Error: P1001: Can't reach database server at
 *       ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech:5432
 *
 * 103ms from datasource-load to error: an instant rejection, not a cold-start
 * timeout. The first failure of the run was 2026-06-19 — the same day the
 * previous revision of this file records a P1001 incident. That fix made
 * PREVIEW builds DB-free, which turned every preview green and hid the fact
 * that PRODUCTION kept running `migrate deploy` into the same wall, 140 times.
 *
 * The defect was never the database. The Neon endpoint answers a TLS+SNI
 * handshake with an AuthenticationRequest today, and IPv4 connects in 56ms.
 * The defect was that "can the Vercel builder open a socket to Neon" was made a
 * precondition of "can we ship any code at all" — so one network-path problem
 * became a total, silent shipping freeze.
 *
 * THE FIX
 * -------
 * Applying migrations moves OFF the Vercel builder and into
 * `.github/workflows/production-deploy.yml`, which runs `prisma migrate deploy`
 * on a GitHub-hosted runner and only triggers the production deploy once that
 * succeeds. Ordering — migrate, then deploy — is what guarantees production
 * code never runs ahead of its schema. That guarantee used to live inside this
 * script; it now lives in the pipeline, which is a better place for it because
 * a failure there is attributable and alarmed instead of being one red line in
 * a build log nobody opens.
 *
 * This script therefore becomes a VERIFIER, not an applier:
 *
 *   - reached the DB, nothing pending      -> pass
 *   - reached the DB, migrations pending   -> FAIL the build
 *   - could not reach the DB               -> WARN and pass
 *
 * The middle case is the one that still earns its keep. The workflow is the
 * intended path, but a human can still click "Redeploy" in the Vercel dashboard
 * on a commit whose migrations were never applied. That bypasses the ordering,
 * and this check catches it — shipping code against an un-migrated database is
 * exactly the failure the original gate existed to prevent, and it is still
 * prevented whenever the builder can see the database.
 *
 * The last case is deliberate and is the whole point: builder-to-Neon
 * connectivity is no longer a shipping precondition. If the builder cannot
 * reach the database we say so loudly and continue, because the workflow —
 * not the builder — is responsible for the schema being current.
 *
 * NOTE ON THE IPv6 HYPOTHESIS
 * ---------------------------
 * The leading explanation for a 103ms P1001 is that the builder resolves the
 * Neon host to its AAAA record and gets an instant ENETUNREACH (from this
 * network, IPv4 connects in 56ms while IPv6 black-holes for 8s). That is a
 * hypothesis, not a finding, and NOTHING here depends on it being true. This
 * change is about removing the coupling; if the cause turns out to be a Neon IP
 * allowlist or a credential problem instead, the workflow surfaces it as a
 * named, attributable failure rather than a dead deploy pipeline. See the
 * workflow for how the first run falsifies it.
 *
 * ESCAPE HATCH
 * ------------
 * `MIGRATE_ON_BUILD=1` restores the old apply-in-build behaviour without a
 * revert, so this is reversible in one environment variable.
 */
import { spawnSync } from "node:child_process";

export const OUTCOME = {
  SKIP_NON_PRODUCTION: "skip-non-production",
  SKIP_LOCAL: "skip-local",
  APPLY_LEGACY: "apply-legacy",
  VERIFY: "verify",
};

/**
 * Pure decision function: what should this build do?
 * Split out from the side-effecting main() so it can be tested directly.
 */
export function decide(env = process.env) {
  if (env.MIGRATE_ON_BUILD === "1") return OUTCOME.APPLY_LEGACY;
  const vercelEnv = env.VERCEL_ENV;
  if (!vercelEnv) return OUTCOME.SKIP_LOCAL;
  if (vercelEnv !== "production") return OUTCOME.SKIP_NON_PRODUCTION;
  return OUTCOME.VERIFY;
}

/**
 * Classify the result of `prisma migrate status` WITHOUT re-running it.
 *
 * Prisma exits non-zero both when it cannot reach the database and when there
 * are migrations to apply. Those two mean opposite things here, so we read the
 * output rather than trusting the exit code alone. Unreachable is checked
 * first: a P1001 run tells us nothing about pending state, so it must never be
 * mistaken for "clean".
 */
export function classifyStatus({ status, output }) {
  const text = String(output ?? "");
  if (/\bP1001\b|Can't reach database server/i.test(text)) {
    return { verdict: "unreachable" };
  }
  if (/\bP3009\b|failed migrations|migrate resolve/i.test(text)) {
    return { verdict: "failed-migration" };
  }
  if (
    /not yet been applied|following migrations? have not yet been applied|pending/i.test(
      text,
    )
  ) {
    return { verdict: "pending" };
  }
  if (status === 0) return { verdict: "clean" };
  return { verdict: "unknown" };
}

/**
 * What to do when the builder cannot see the database at all.
 *
 * The first cut of this file warned and continued unconditionally, which was
 * wrong in a way worth recording. With the database unreachable the build has
 * NO evidence about schema state, so "continue" means shipping code that may be
 * ahead of its schema — and Vercel would mark that deploy Ready, which closes
 * the deploy-state alarms while the app's database-backed routes 500. That is
 * the same green-while-broken shape this whole change set exists to remove, and
 * it would have been introduced by the fix for it.
 *
 * So unverifiable now FAILS unless something explicitly vouches for the schema:
 *
 *   workflow  - production-deploy.yml already ran `migrate deploy` successfully
 *               moments ago and passes SCHEMA_VERIFIED_BY_WORKFLOW=1 as a build
 *               env. The ordering guarantee holds; continue.
 *   override  - a human deliberately shipping without verified migrations
 *               (ALLOW_UNVERIFIED_SCHEMA=1), e.g. to get static pages live while
 *               the database path is still blocked. Allowed, but loud, and never
 *               the default.
 *   block     - nobody vouched. Fail, and say exactly what to do.
 */
export function unreachablePolicy(env = process.env) {
  if (env.SCHEMA_VERIFIED_BY_WORKFLOW === "1") return "workflow";
  if (env.ALLOW_UNVERIFIED_SCHEMA === "1") return "override";
  return "block";
}

function handleUnreachable() {
  switch (unreachablePolicy()) {
    case "workflow":
      console.warn(
        "[migrate-gate] Could not reach the database from the builder (P1001), but " +
          "SCHEMA_VERIFIED_BY_WORKFLOW=1 — production-deploy.yml applied migrations " +
          "before triggering this deploy. Builder connectivity is deliberately not a " +
          "shipping precondition. Continuing.",
      );
      return 0;

    case "override":
      console.warn(
        "[migrate-gate] ALLOW_UNVERIFIED_SCHEMA=1 — shipping WITHOUT confirming the " +
          "database schema is current. This is a deliberate override.\n" +
          "[migrate-gate] Expect any route that touches an unapplied table or column " +
          "to fail at runtime. Static and marketing pages are unaffected.\n" +
          "[migrate-gate] The deploy will be marked Ready, which will CLOSE the " +
          "deploy-state alarms. Do not mistake that for a healthy application.",
      );
      return 0;

    default:
      console.error(
        "[migrate-gate] FAIL: cannot reach the database (P1001), so this build has no " +
          "evidence that the schema is current, and nothing vouched for it.\n" +
          "[migrate-gate] Shipping anyway would mark the deploy Ready and close the " +
          "deploy-state alarms while database-backed routes fail — green while broken.\n" +
          "[migrate-gate] Choose one:\n" +
          "[migrate-gate]   - run the `production-deploy` workflow, which applies " +
          "migrations first and sets SCHEMA_VERIFIED_BY_WORKFLOW=1; or\n" +
          "[migrate-gate]   - deploy deliberately without verified migrations:\n" +
          "[migrate-gate]       vercel deploy --prod --build-env ALLOW_UNVERIFIED_SCHEMA=1",
      );
      return 1;
  }
}

function runLegacyApply() {
  console.log(
    "[migrate-gate] MIGRATE_ON_BUILD=1 — running `prisma migrate deploy` in the build " +
      "(legacy path; the production-deploy workflow normally owns this).",
  );
  const result = spawnSync("prisma", ["migrate", "deploy"], {
    stdio: "inherit",
    shell: true,
  });
  if (result.error) {
    console.error("[migrate-gate] Failed to spawn prisma:", result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function runVerify() {
  console.log(
    "[migrate-gate] VERCEL_ENV=production — verifying migration state " +
      "(read-only; `prisma migrate deploy` runs in .github/workflows/production-deploy.yml).",
  );
  const result = spawnSync("prisma", ["migrate", "status"], {
    encoding: "utf8",
    shell: true,
  });
  if (result.error) {
    console.warn(
      "[migrate-gate] Could not spawn prisma to verify migration state:",
      result.error.message,
      "— continuing; the deploy workflow owns schema state.",
    );
    return 0;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  process.stdout.write(output);
  const { verdict } = classifyStatus({ status: result.status, output });

  switch (verdict) {
    case "clean":
      console.log("[migrate-gate] Schema is current. Proceeding with the build.");
      return 0;

    case "unreachable":
      return handleUnreachable();

    case "pending":
      console.error(
        "[migrate-gate] FAIL: the database is reachable and has migrations that have " +
          "not been applied. This build would ship code ahead of its schema.\n" +
          "[migrate-gate] This usually means the deploy was started outside " +
          "production-deploy.yml (for example a manual Redeploy in the Vercel " +
          "dashboard), which skips the migrate-then-deploy ordering.\n" +
          "[migrate-gate] Fix: run the `production-deploy` workflow, which applies " +
          "migrations first and then deploys.",
      );
      return 1;

    case "failed-migration":
      console.error(
        "[migrate-gate] FAIL: the migration history contains a failed or unresolved " +
          "migration (P3009). Resolve it with `prisma migrate resolve` before " +
          "deploying. This is a schema-history problem, not a build problem.",
      );
      return 1;

    default:
      console.error(
        `[migrate-gate] FAIL: could not interpret \`prisma migrate status\` ` +
          `(exit ${result.status}). Refusing to guess about schema state.`,
      );
      return 1;
  }
}

export function main() {
  switch (decide()) {
    case OUTCOME.SKIP_NON_PRODUCTION:
      console.log(
        `[migrate-gate] VERCEL_ENV="${process.env.VERCEL_ENV}" — skipping migration checks ` +
          `(non-production build stays DB-free).`,
      );
      return 0;
    case OUTCOME.SKIP_LOCAL:
      console.log(
        "[migrate-gate] No VERCEL_ENV (local build) — skipping migration checks. " +
          "Run `npm run migrate:status` to inspect, `npm run migrate:deploy` to apply.",
      );
      return 0;
    case OUTCOME.APPLY_LEGACY:
      return runLegacyApply();
    default:
      return runVerify();
  }
}

// Only act when executed directly, so the test can import the helpers.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  process.exit(main());
}
