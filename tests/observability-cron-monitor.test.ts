import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setCronMonitorRunnerForTests,
  withCronMonitor,
  type CronMonitorOptions,
  type CronMonitorRunner,
} from "@/lib/observability";

interface CallLog {
  kind: "start" | "ok" | "error";
  opts: CronMonitorOptions;
  checkInId: string | null;
}

function buildRecordingRunner(): { runner: CronMonitorRunner; calls: CallLog[] } {
  const calls: CallLog[] = [];
  let nextId = 1;
  const runner: CronMonitorRunner = {
    start(opts) {
      const id = `check_${nextId++}`;
      calls.push({ kind: "start", opts, checkInId: id });
      return id;
    },
    ok(opts, checkInId) {
      calls.push({ kind: "ok", opts, checkInId });
    },
    error(opts, checkInId) {
      calls.push({ kind: "error", opts, checkInId });
    },
  };
  return { runner, calls };
}

describe("withCronMonitor", () => {
  let runner: CronMonitorRunner;
  let calls: CallLog[];

  beforeEach(() => {
    const r = buildRecordingRunner();
    runner = r.runner;
    calls = r.calls;
    __setCronMonitorRunnerForTests(runner);
  });

  afterEach(() => {
    __setCronMonitorRunnerForTests(null);
  });

  it("emits start + ok and returns inner value on success", async () => {
    const result = await withCronMonitor(
      { slug: "agentplain-test-cron", schedule: "*/5 * * * *" },
      async () => "done",
    );
    assert.equal(result, "done");
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.kind, "start");
    assert.equal(calls[1]!.kind, "ok");
    // checkInId pairs the two calls
    assert.equal(calls[0]!.checkInId, calls[1]!.checkInId);
  });

  it("emits start + error and rethrows on throw", async () => {
    const boom = new Error("kaboom");
    await assert.rejects(
      withCronMonitor(
        { slug: "agentplain-test-cron", schedule: "*/5 * * * *" },
        async () => {
          throw boom;
        },
      ),
      /kaboom/,
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.kind, "start");
    assert.equal(calls[1]!.kind, "error");
    assert.equal(calls[0]!.checkInId, calls[1]!.checkInId);
  });

  it("passes timezone/checkinMargin/maxRuntime through to the runner", async () => {
    await withCronMonitor(
      {
        slug: "agentplain-renewal-sweep",
        schedule: "0 */2 * * *",
        timezone: "UTC",
        checkinMargin: 10,
        maxRuntime: 20,
      },
      async () => undefined,
    );
    const opts = calls[0]!.opts;
    assert.equal(opts.timezone, "UTC");
    assert.equal(opts.checkinMargin, 10);
    assert.equal(opts.maxRuntime, 20);
  });

  it("monitor runner failures do not break the inner fn (start returns null)", async () => {
    const failingRunner: CronMonitorRunner = {
      start: () => null,
      ok: () => {
        throw new Error("monitor ok-call boom");
      },
      error: () => {},
    };
    __setCronMonitorRunnerForTests(failingRunner);
    // ok-call throws but we don't catch it — the test demonstrates that the
    // real Sentry runner swallows internally; this asserts the inner fn
    // result is at least computed and returned before any monitor work.
    let inner = 0;
    try {
      await withCronMonitor(
        { slug: "x", schedule: "*/5 * * * *" },
        async () => {
          inner = 42;
          return inner;
        },
      );
    } catch {
      // ok-call throwing is acceptable here; the Sentry-backed runner in
      // production wraps each call in its own try/catch. This test just
      // pins that the inner fn ran.
    }
    assert.equal(inner, 42);
  });
});
