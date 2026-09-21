// Tests for the production build's migration gate.
//
// The bug these guard against is specific and expensive: for 96 days the gate
// treated "cannot reach the database" as "do not ship". The classifier below is
// where that judgement now lives, so it is worth testing the boundary between
// the three outcomes directly — especially that an unreachable database is
// never silently read as a clean one.

import test from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  classifyStatus,
  OUTCOME,
} from "./prisma-migrate-gate.mjs";

test("local builds (no VERCEL_ENV) skip migration checks", () => {
  assert.equal(decide({}), OUTCOME.SKIP_LOCAL);
});

test("preview builds stay DB-free", () => {
  assert.equal(decide({ VERCEL_ENV: "preview" }), OUTCOME.SKIP_NON_PRODUCTION);
  assert.equal(
    decide({ VERCEL_ENV: "development" }),
    OUTCOME.SKIP_NON_PRODUCTION,
  );
});

test("production builds verify rather than apply", () => {
  assert.equal(decide({ VERCEL_ENV: "production" }), OUTCOME.VERIFY);
});

test("MIGRATE_ON_BUILD=1 restores the legacy apply-in-build path", () => {
  assert.equal(
    decide({ VERCEL_ENV: "production", MIGRATE_ON_BUILD: "1" }),
    OUTCOME.APPLY_LEGACY,
  );
  // The escape hatch works even outside Vercel, so it can be exercised locally.
  assert.equal(decide({ MIGRATE_ON_BUILD: "1" }), OUTCOME.APPLY_LEGACY);
});

test("a clean status passes", () => {
  const { verdict } = classifyStatus({
    status: 0,
    output: "Database schema is up to date!",
  });
  assert.equal(verdict, "clean");
});

test("P1001 is classified unreachable, never clean", () => {
  const { verdict } = classifyStatus({
    status: 1,
    output:
      "Error: P1001: Can't reach database server at `ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech:5432`",
  });
  assert.equal(verdict, "unreachable");
});

test("an unreachable database is never mistaken for a clean one even on exit 0", () => {
  // Defensive: if prisma ever exits 0 while reporting P1001, "unreachable"
  // must still win. Reading it as "clean" is how you ship against an unknown
  // schema.
  const { verdict } = classifyStatus({
    status: 0,
    output: "Can't reach database server",
  });
  assert.equal(verdict, "unreachable");
});

test("pending migrations fail the build", () => {
  const { verdict } = classifyStatus({
    status: 1,
    output:
      "1 migration found in prisma/migrations\n\nFollowing migrations have not yet been applied:\n20260830000000_portal_team_outreach_rls",
  });
  assert.equal(verdict, "pending");
});

test("a failed migration (P3009) is reported as such, not as pending", () => {
  const { verdict } = classifyStatus({
    status: 1,
    output:
      "Error: P3009: migrate found failed migrations in the target database",
  });
  assert.equal(verdict, "failed-migration");
});

test("unparseable non-zero output refuses to guess", () => {
  const { verdict } = classifyStatus({ status: 2, output: "something odd" });
  assert.equal(verdict, "unknown");
});
