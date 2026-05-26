/**
 * Tests for `lib/inngest/run-with-disable-gate.ts` after the P0-4 cutover.
 *
 * The disable flag is now DB-backed (source of truth) with the env-var
 * path retained as a cold-start cache / fallback. The contract pinned
 * here:
 *
 *   1. DB row `value === 'true'` short-circuits — handler does NOT run,
 *      `source === 'db'`. This is the case that fixes the 5-min lag:
 *      the gate sees the row on the NEXT invocation without waiting for
 *      a cold start.
 *   2. DB row `value === 'false'` (any non-'true' string) explicitly
 *      releases the function and SKIPS the env fallback. An operator
 *      who wrote "false" in the DB must not be silently overridden by a
 *      stale env entry from a prior pause.
 *   3. DB has no row + env says "true" → env fallback engages, the
 *      function is treated as paused, and `source === 'env'`. This is
 *      the bootstrap-time / pre-DB state.
 *   4. DB read FAILS (store returns UPSTREAM_ERROR — simulating a DB
 *      outage) + env says "true" → env fallback engages. This is the
 *      defense-in-depth case: an unreachable flag store does NOT take
 *      every cron in the system down with it.
 *   5. DB has no row, env unset → function runs, `source === 'env'`,
 *      `disabled === false`. Default operating mode.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runWithDisableGate,
  __resetDefaultFlagStoreForTests,
} from "@/lib/inngest/run-with-disable-gate";
import { disableFlagEnvName } from "@/lib/inngest/disable-flag";
import { InMemoryOpsFlagStore } from "@/lib/ops/flag-store";

const FN_ID = "test-fn";
const FLAG_NAME = disableFlagEnvName(FN_ID);

describe("runWithDisableGate — DB-first path (P0-4)", () => {
  it("DB row value='true' short-circuits with source='db'", async () => {
    const store = new InMemoryOpsFlagStore({ [FLAG_NAME]: "true" });
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
        return 42;
      },
      { flagStore: store, env: {} as NodeJS.ProcessEnv },
    );
    assert.equal(ran, false);
    assert.equal(r.disabled, true);
    assert.equal(r.source, "db");
    assert.equal(r.result, null);
  });

  it("DB row value='true' wins even when env says 'false' — DB is source of truth", async () => {
    const store = new InMemoryOpsFlagStore({ [FLAG_NAME]: "true" });
    const env = { [FLAG_NAME]: "false" } as NodeJS.ProcessEnv;
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
      },
      { flagStore: store, env },
    );
    assert.equal(ran, false);
    assert.equal(r.disabled, true);
    assert.equal(r.source, "db");
  });

  it("DB row value='false' explicitly releases and skips env (no override by stale env)", async () => {
    const store = new InMemoryOpsFlagStore({ [FLAG_NAME]: "false" });
    // Env says paused, DB says active — DB wins, function runs.
    const env = { [FLAG_NAME]: "true" } as NodeJS.ProcessEnv;
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
        return 7;
      },
      { flagStore: store, env },
    );
    assert.equal(ran, true);
    assert.equal(r.disabled, false);
    assert.equal(r.source, "db");
    assert.equal(r.result, 7);
  });

  it("pause-then-resume sequence takes effect on the very next invocation (no 5-min wait)", async () => {
    // This is the spec-level assertion for P0-4: a single tick suffices.
    const store = new InMemoryOpsFlagStore();
    let invocations = 0;
    const fn = async () => {
      invocations += 1;
    };

    // Tick 1: no flag yet → runs.
    const t1 = await runWithDisableGate(FN_ID, fn, {
      flagStore: store,
      env: {} as NodeJS.ProcessEnv,
    });
    assert.equal(t1.disabled, false);

    // Operator pauses.
    await store.set(FLAG_NAME, "true", { updatedBy: "cli:throttle.ts" });

    // Tick 2: paused row now visible → does NOT run.
    const t2 = await runWithDisableGate(FN_ID, fn, {
      flagStore: store,
      env: {} as NodeJS.ProcessEnv,
    });
    assert.equal(t2.disabled, true);
    assert.equal(t2.source, "db");

    // Operator resumes.
    await store.set(FLAG_NAME, "false", { updatedBy: "cli:throttle.ts" });

    // Tick 3: resumed → runs again.
    const t3 = await runWithDisableGate(FN_ID, fn, {
      flagStore: store,
      env: {} as NodeJS.ProcessEnv,
    });
    assert.equal(t3.disabled, false);
    assert.equal(t3.source, "db");

    // Exactly the runs we expect — no leakage of state across ticks.
    assert.equal(invocations, 2);
  });
});

describe("runWithDisableGate — env fallback (cold-start cache / DB outage)", () => {
  it("DB has no row, env says 'true' → falls back, source='env'", async () => {
    const store = new InMemoryOpsFlagStore();
    const env = { [FLAG_NAME]: "true" } as NodeJS.ProcessEnv;
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
      },
      { flagStore: store, env },
    );
    assert.equal(ran, false);
    assert.equal(r.disabled, true);
    assert.equal(r.source, "env");
  });

  it("DB has no row, env unset → runs, source='env', disabled=false (default mode)", async () => {
    const store = new InMemoryOpsFlagStore();
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
        return "ok";
      },
      { flagStore: store, env: {} as NodeJS.ProcessEnv },
    );
    assert.equal(ran, true);
    assert.equal(r.disabled, false);
    assert.equal(r.source, "env");
    assert.equal(r.result, "ok");
  });

  it("DB read FAILS (store outage) → env fallback engages cleanly", async () => {
    // Simulate "store reachable on the second call, but the first read
    // failed." The gate must not propagate the OpsResult error — it
    // must degrade to the env cache instead.
    const store = new InMemoryOpsFlagStore({ [FLAG_NAME]: "true" });
    store.failNextRead = true; // first .get() returns UPSTREAM_ERROR
    const env = { [FLAG_NAME]: "true" } as NodeJS.ProcessEnv;
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
      },
      { flagStore: store, env },
    );
    // env said "true" → still paused, but the SIGNAL is env (not db).
    assert.equal(ran, false);
    assert.equal(r.disabled, true);
    assert.equal(r.source, "env");
  });

  it("DB outage + env unset → function runs (defaults to active, not paused — fail-open on missing flag)", async () => {
    // The cron has to be runnable when nothing tells it otherwise.
    // Strict-equality semantic: anything not literally "true" means active.
    const store = new InMemoryOpsFlagStore();
    store.failNextRead = true;
    let ran = false;
    const r = await runWithDisableGate(
      FN_ID,
      async () => {
        ran = true;
      },
      { flagStore: store, env: {} as NodeJS.ProcessEnv },
    );
    assert.equal(ran, true);
    assert.equal(r.disabled, false);
    assert.equal(r.source, "env");
  });

  it("typoed truthy env values default to active — strict equality preserved from disable-flag.ts", async () => {
    const store = new InMemoryOpsFlagStore();
    for (const v of ["True", "TRUE", "1", "yes", "on"]) {
      let ran = false;
      const env = { [FLAG_NAME]: v } as NodeJS.ProcessEnv;
      const r = await runWithDisableGate(
        FN_ID,
        async () => {
          ran = true;
        },
        { flagStore: store, env },
      );
      assert.equal(
        ran,
        true,
        `expected handler to run when env value is ${JSON.stringify(v)}`,
      );
      assert.equal(r.disabled, false);
    }
  });
});

// Lazy-default isolation: each test in this file passes its own store,
// so resetting the lazily-constructed module-scoped default keeps the
// rest of the test runner clean if any prior test happened to materialize
// it (e.g. by calling runWithDisableGate with no `flagStore`).
__resetDefaultFlagStoreForTests();
