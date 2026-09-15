// Deliberate-failure tests for the deploy-state check. The canonical fixture
// is the 2026-08-11 real condition: last successful production deployment
// 2026-06-17, every production deployment since in state failure. The test is
// literally "would this have caught the eight-week outage" — on 2026-07-02
// (first ERROR) and on 2026-06-24 (7 days without success), both yes.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./deploy-state.mjs";

const NOW = "2026-08-11T12:00:00Z";

function report(overrides = {}) {
  return {
    generated: NOW,
    environment: "Production",
    latest_production_deployment: { sha: "a".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "success" },
    last_successful_production_deployment: { sha: "a".repeat(40), created_at: "2026-08-10T22:04:19Z", days_ago: 0.6 },
    consecutive_failed_deployments_since_success: 0,
    origin_main: { sha: "a".repeat(40), deployed_to_production: true, undeployed_since: null, commits_not_in_production: 0 },
    walk: { deployments_examined: 1, exhausted_without_success: false },
    ...overrides,
  };
}

test("healthy state produces zero actions and a green run", () => {
  const r = evaluate(report());
  assert.equal(r.red, false);
  assert.equal(r.actions.length, 0);
});

test("the 2026-08-11 real condition fires BOTH alarms", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "bcaccbe" + "0".repeat(33), created_at: "2026-08-10T22:04:19Z", state: "failure" },
      last_successful_production_deployment: { sha: "c".repeat(40), created_at: "2026-06-17T14:00:00Z", days_ago: 54.9 },
      consecutive_failed_deployments_since_success: 120,
      origin_main: { sha: "bcaccbe" + "0".repeat(33), deployed_to_production: false, undeployed_since: "2026-06-17T14:00:00Z", commits_not_in_production: 180 },
    })
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.length, 2);
  const slugs = r.actions.map((a) => a.slug).sort();
  assert.deepEqual(slugs, ["deploy:error", "deploy:stale"]);
  const stale = r.actions.find((a) => a.slug === "deploy:stale");
  assert.match(stale.body, /deployed_to_production: \*\*false\*\*|deployed to production: \*\*false\*\*/);
  assert.match(stale.body, /undeployed since 2026-06-17T14:00:00Z/);
});

test("no success found within the walk window still alarms (never silently green)", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "d".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "failure" },
      last_successful_production_deployment: null,
      consecutive_failed_deployments_since_success: 500,
      origin_main: { sha: "d".repeat(40), deployed_to_production: null, undeployed_since: "unknown", commits_not_in_production: null },
      walk: { deployments_examined: 500, exhausted_without_success: true },
    })
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.filter((a) => a.type === "create").length, 2);
});

test("existing open issues are not duplicated while the condition persists", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "e".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "error" },
      last_successful_production_deployment: { sha: "f".repeat(40), created_at: "2026-06-17T14:00:00Z", days_ago: 54.9 },
      origin_main: { sha: "e".repeat(40), deployed_to_production: false, undeployed_since: "2026-06-17T14:00:00Z", commits_not_in_production: 10 },
    }),
    { openErrorIssue: { number: 7 }, openStaleIssue: { number: 8 } }
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.length, 0);
});

test("recovery closes both open issues", () => {
  const r = evaluate(report(), { openErrorIssue: { number: 7 }, openStaleIssue: { number: 8 } });
  assert.equal(r.red, false);
  assert.deepEqual(
    r.actions.map((a) => [a.type, a.number]).sort((x, y) => x[1] - y[1]),
    [
      ["close", 7],
      ["close", 8],
    ]
  );
});

// ---------------------------------------------------------------------------
// Deliberate-failure tests for the THIRD outcome.
//
// Motivating incident: run 34846542924 (2026-09-14T12:59Z) died 29s into a
// 141-call walk with `deploy-state failed: fetch failed` and exit 1 — byte for
// byte the same red X as the 19 surrounding runs that had actually measured
// production and found it red. The crash was indistinguishable from a verdict.
// These tests exist to make that specific confusion impossible.
// ---------------------------------------------------------------------------

import { classifyThrown, EXIT_BROKEN, EXIT_HEALTHY, EXIT_UNDETERMINED } from "./deploy-state.mjs";
import { ghApi, UndeterminedError, isTransientError, RETRY_ATTEMPTS } from "./lib.mjs";

test("the three outcomes have three distinct exit codes", () => {
  const codes = [EXIT_HEALTHY, EXIT_BROKEN, EXIT_UNDETERMINED];
  assert.equal(new Set(codes).size, 3, "outcomes must not share an exit code");
});

test("the real `fetch failed` crash classifies as UNDETERMINED, never as a verdict", () => {
  // Exactly what undici throws, reproduced rather than described.
  const real = new TypeError("fetch failed");
  real.cause = { code: "ECONNRESET" };
  const c = classifyThrown(real);
  assert.equal(c.label, "UNDETERMINED");
  assert.equal(c.code, EXIT_UNDETERMINED);
  assert.notEqual(c.code, EXIT_BROKEN, "a crash must never exit as BROKEN");
  assert.notEqual(c.code, EXIT_HEALTHY, "a crash must never exit as HEALTHY");
});

test("an exhausted-retry UndeterminedError classifies as UNDETERMINED", () => {
  assert.equal(classifyThrown(new UndeterminedError("no answer after 4 attempts")).code, EXIT_UNDETERMINED);
});

test("KNOWN-POSITIVE CONTROL: a genuine programming error is NOT laundered into UNDETERMINED", () => {
  // If this ever flips, the classifier has become a catch-all and the
  // UNDETERMINED signal is worthless — the failure mode this file guards.
  const bug = new ReferenceError("x is not defined");
  assert.equal(classifyThrown(bug).label, "ERROR");
  assert.notEqual(classifyThrown(bug).code, EXIT_UNDETERMINED);
});

test("isTransientError does not treat an authoritative 4xx Error as transient", () => {
  assert.equal(isTransientError(new Error("GET https://api.github.com/x -> 404: Not Found")), false);
});

// --- ghApi retry behaviour: stub fetch, count calls -------------------------

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

const json = (body, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

test("ghApi RETRIES a transient fetch failure and then succeeds", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      if (calls < 3) {
        const e = new TypeError("fetch failed");
        e.cause = { code: "ECONNRESET" };
        throw e;
      }
      return json({ ok: true });
    },
    async () => {
      const out = await ghApi("/x", { sleepFn: async () => {} });
      assert.deepEqual(out, { ok: true });
      assert.equal(calls, 3, "should have retried twice before succeeding");
    }
  );
});

test("ghApi gives up as UndeterminedError — the alarm says 'I do not know', not 'it is broken'", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      const e = new TypeError("fetch failed");
      e.cause = { code: "ENOTFOUND" };
      throw e;
    },
    async () => {
      await assert.rejects(
        () => ghApi("/x", { sleepFn: async () => {} }),
        (err) => {
          assert.ok(err instanceof UndeterminedError, "must be UndeterminedError");
          assert.equal(classifyThrown(err).code, EXIT_UNDETERMINED);
          return true;
        }
      );
      assert.equal(calls, RETRY_ATTEMPTS, `should have tried exactly ${RETRY_ATTEMPTS} times`);
    }
  );
});

test("ghApi retries a 500 but NOT a 404 — a 4xx is an authoritative answer", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      return json({ message: "server error" }, 500);
    },
    async () => {
      await assert.rejects(() => ghApi("/x", { sleepFn: async () => {} }), (e) => e instanceof UndeterminedError);
      assert.equal(calls, RETRY_ATTEMPTS);
    }
  );

  let calls404 = 0;
  await withFetch(
    async () => {
      calls404++;
      return json({ message: "Not Found" }, 404);
    },
    async () => {
      await assert.rejects(
        () => ghApi("/x", { sleepFn: async () => {} }),
        (e) => !(e instanceof UndeterminedError)
      );
      assert.equal(calls404, 1, "a 404 must be answered once, never retried");
    }
  );
});

test("no token in any thrown message, including the give-up path", async () => {
  const SECRET = "ghs_THISMUSTNEVERAPPEAR";
  await withFetch(
    async () => {
      const e = new TypeError("fetch failed");
      e.cause = { code: "ECONNRESET" };
      throw e;
    },
    async () => {
      await assert.rejects(
        () => ghApi("/repos/o/r/x", { token: SECRET, sleepFn: async () => {} }),
        (err) => {
          assert.ok(!err.message.includes(SECRET), "token leaked into error message");
          assert.ok(!String(err.stack).includes(SECRET), "token leaked into stack");
          return true;
        }
      );
    }
  );
});
