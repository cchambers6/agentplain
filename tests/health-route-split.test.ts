// GUARD: /api/health must never touch the database.
//
// Background. `/api/health` is the path the runbooks tell the operator to
// point an external uptime monitor at, on a 1-5 minute cadence. It used
// to run `SELECT 1` on every request.
//
// On Neon Free that is not a small cost, it is the whole budget:
//   * autosuspend is 5 minutes, fixed, not configurable
//   * compute floor is 0.25 CU
//   * 0.25 CU x 730 h = 182.5 CU-hr for continuous uptime
//   * the Free allowance is 100 CU-hr/project/month
// A frequent DB-touching liveness probe never lets compute idle out, so
// it alone exceeds the monthly allowance while reporting "ok".
// Production exhausted at 110.08/100 CU-hr and the project was paused.
//
// This suite pins the split so the DB call cannot drift back onto the hot
// path. The liveness assertion is deliberately made against the route
// SOURCE: a behavioural test can only prove the DB was not hit on the
// paths it happens to exercise, whereas "this module does not import the
// database at all" is the property actually being protected.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const LIVENESS = path.join(process.cwd(), "app/api/health/route.ts");
const READINESS = path.join(process.cwd(), "app/api/health/ready/route.ts");

const read = (p: string): string => {
  assert.ok(fs.existsSync(p), `expected route file to exist: ${p}`);
  return fs.readFileSync(p, "utf8");
};

// Strip line comments so the prose ABOVE the code (which necessarily
// discusses prisma and SELECT 1) cannot satisfy or trip the checks.
// A guard that can be satisfied by a comment is not a guard.
const stripComments = (src: string): string =>
  src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");

// Tokens that all mean "this module can reach the database".
const DB_TOKENS = [
  "prisma",
  "@/lib/db",
  "$queryRaw",
  "$executeRaw",
  "withRls",
  "withSystemContext",
];

describe("/api/health split: liveness must not reach the database", () => {
  it("liveness route contains no database access whatsoever", () => {
    const code = stripComments(read(LIVENESS));
    let examined = 0;
    for (const token of DB_TOKENS) {
      assert.ok(
        !code.includes(token),
        `liveness route (/api/health) references "${token}". This route is ` +
          `probed every 60s by an external monitor; any DB access here holds ` +
          `Neon compute awake continuously (~182.5 CU-hr/mo vs a 100 CU-hr ` +
          `allowance). Move the dependency check to /api/health/ready.`,
      );
      examined++;
    }
    assert.equal(examined, DB_TOKENS.length);
    assert.ok(examined > 0, "examined 0 tokens — vacuous pass");
    console.log(`examined ${examined} of ${DB_TOKENS.length} db-access tokens`);
  });

  it("liveness route stays dynamic and uncacheable", () => {
    const code = stripComments(read(LIVENESS));
    // A cached 200 would mask a real outage.
    assert.ok(
      code.includes('dynamic = "force-dynamic"'),
      "liveness must stay force-dynamic",
    );
    assert.ok(code.includes("no-store"), "liveness must send no-store");
  });

  it("liveness responds 200 without any database available", async () => {
    // Imported lazily so a failure here is attributable to this test.
    const mod = await import("@/app/api/health/route");
    const res = await mod.GET(
      new Request("https://app.test/api/health") as never,
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.status, "ok");
    assert.equal(
      (body.checks as Record<string, unknown>).db,
      undefined,
      "liveness must not report a db check",
    );
    assert.equal(body.readiness_path, "/api/health/ready");
  });
});

describe("/api/health/ready: guarded and fails closed", () => {
  it("readiness route performs the dependency checks", () => {
    const code = stripComments(read(READINESS));
    assert.ok(code.includes("$queryRawUnsafe"), "readiness must check the db");
    assert.ok(code.includes("inngest"), "readiness must check inngest mount");
  });

  it("readiness is token-gated and the gate precedes any db call", () => {
    const code = stripComments(read(READINESS));
    assert.ok(
      code.includes("HEALTH_READY_TOKEN"),
      "readiness must be token-gated",
    );
    // Scope to the GET handler. Comparing against `checkDatabase(` in the
    // whole file would match its own DEFINITION, which necessarily appears
    // before the gate — an ordering assertion against a definition proves
    // nothing about execution order.
    const getAt = code.indexOf("export async function GET");
    assert.ok(getAt >= 0, "could not locate the GET handler");
    const handler = code.slice(getAt);

    const gateAt = handler.indexOf("HEALTH_READY_TOKEN");
    const dbCallAt = handler.indexOf("checkDatabase()");
    assert.ok(gateAt >= 0, "GET must read HEALTH_READY_TOKEN");
    assert.ok(dbCallAt >= 0, "GET must call checkDatabase()");
    // The unconfigured/unauthorized returns must be reachable before any
    // DB work, or an unauthenticated caller still wakes the database.
    assert.ok(
      gateAt < dbCallAt,
      "the token gate must execute before the database call",
    );
    const unauthorizedAt = handler.indexOf('status: "unauthorized"');
    assert.ok(
      unauthorizedAt >= 0 && unauthorizedAt < dbCallAt,
      "the unauthorized return must precede the database call",
    );
  });

  it("readiness fails CLOSED when unconfigured — no token means no db call", () => {
    const code = stripComments(read(READINESS));
    assert.ok(
      code.includes('status: "unconfigured"'),
      "an unset token must produce an explicit unconfigured response",
    );
    // Fail-open here is the exact defect that made the original route a
    // standing charge, so pin the direction of the default.
    assert.ok(
      !/expected\.length === 0[\s\S]{0,200}checkDatabase/.test(code),
      "unconfigured must return before checkDatabase, never fall through",
    );
  });
});
