import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setLoggerWriterForTests,
  getLogger,
  type LogLevel,
} from "@/lib/observability";

interface Recorded {
  level: LogLevel;
  payload: Record<string, unknown>;
}

describe("JSON logger", () => {
  let recorded: Recorded[];

  beforeEach(() => {
    recorded = [];
    __setLoggerWriterForTests((level, payload) => {
      recorded.push({ level, payload });
    });
  });

  afterEach(() => {
    __setLoggerWriterForTests(null);
  });

  it("emits a structured record with level/msg/time/service/env", () => {
    getLogger().info("cron sweep started", { function_id: "agentplain-x" });
    assert.equal(recorded.length, 1);
    const { level, payload } = recorded[0]!;
    assert.equal(level, "info");
    assert.equal(payload.level, "info");
    assert.equal(payload.msg, "cron sweep started");
    assert.equal(typeof payload.time, "string");
    assert.equal(payload.service, "agentplain");
    assert.equal(typeof payload.env, "string");
    assert.deepEqual(payload.ctx, { function_id: "agentplain-x" });
  });

  it("warn + error route to stderr level so they're greppable on Vercel", () => {
    const logger = getLogger();
    logger.debug("dbg");
    logger.info("inf");
    logger.warn("wrn");
    logger.error("err");
    assert.deepEqual(
      recorded.map((r) => r.level),
      ["debug", "info", "warn", "error"],
    );
  });

  it("error(msg, Error) flattens error name/message/stack", () => {
    const err = new Error("oh no");
    getLogger().error("inngest threw", err, { function_id: "fn-x" });
    const { payload } = recorded[0]!;
    const ctx = payload.ctx as Record<string, unknown>;
    assert.equal(ctx.error_name, "Error");
    assert.equal(ctx.error_message, "oh no");
    assert.equal(typeof ctx.error_stack, "string");
    assert.equal(ctx.function_id, "fn-x");
  });

  it("error(msg, ctx) without an Error treats arg as context", () => {
    getLogger().error("validation failed", { reason: "bad_signature" });
    const ctx = recorded[0]!.payload.ctx as Record<string, unknown>;
    assert.equal(ctx.reason, "bad_signature");
    assert.ok(!("error_message" in ctx));
  });

  it("child loggers merge base context onto every emit", () => {
    const child = getLogger().child({ function_id: "agentplain-y", run: 1 });
    child.info("starting");
    child.warn("slow", { items: 99 });
    assert.deepEqual(recorded[0]!.payload.ctx, {
      function_id: "agentplain-y",
      run: 1,
    });
    assert.deepEqual(recorded[1]!.payload.ctx, {
      function_id: "agentplain-y",
      run: 1,
      items: 99,
    });
  });

  it("per-call ctx overrides base ctx of same key", () => {
    const child = getLogger().child({ phase: "start" });
    child.info("done", { phase: "end" });
    const ctx = recorded[0]!.payload.ctx as Record<string, unknown>;
    assert.equal(ctx.phase, "end");
  });

  it("stringified line is valid JSON (machine-parseable on Vercel/Datadog)", () => {
    getLogger().info("ok", { n: 1, deep: { a: [1, 2] } });
    const json = JSON.stringify(recorded[0]!.payload);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    assert.equal(parsed.msg, "ok");
    assert.deepEqual(
      (parsed.ctx as Record<string, unknown>).deep,
      { a: [1, 2] },
    );
  });
});
