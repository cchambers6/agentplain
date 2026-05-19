import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  NoopErrorReporter,
  TestErrorReporter,
  __setErrorReporterForTests,
  getErrorReporter,
  reportError,
  reportMessage,
} from "@/lib/observability";

describe("observability adapter", () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.OBSERVABILITY_PROVIDER;
    __setErrorReporterForTests(null);
  });

  it("falls back to noop when SENTRY_DSN unset", async () => {
    const { env } = await import("@/lib/env");
    assert.equal(env.observabilityProvider(), "noop");
    const reporter = getErrorReporter();
    assert.equal(reporter.providerName, "noop");
    assert.ok(reporter instanceof NoopErrorReporter);
  });

  it("selects sentry when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/12345";
    const { env } = await import("@/lib/env");
    assert.equal(env.observabilityProvider(), "sentry");
  });

  it("honors explicit OBSERVABILITY_PROVIDER=noop even when DSN set", async () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/12345";
    process.env.OBSERVABILITY_PROVIDER = "noop";
    const { env } = await import("@/lib/env");
    assert.equal(env.observabilityProvider(), "noop");
  });

  it("rejects unknown OBSERVABILITY_PROVIDER values", async () => {
    process.env.OBSERVABILITY_PROVIDER = "rogue";
    const { env } = await import("@/lib/env");
    assert.throws(() => env.observabilityProvider(), /OBSERVABILITY_PROVIDER/);
  });

  it("TestErrorReporter records exceptions + messages + flush count", async () => {
    const recorder = new TestErrorReporter();
    __setErrorReporterForTests(recorder);

    const err = new Error("boom");
    reportError(err, {
      tags: { boundary: "product" },
      extra: { digest: "abc123" },
    });
    reportMessage("heads up", { level: "warning" });
    await getErrorReporter().flush();

    assert.equal(recorder.exceptions.length, 1);
    assert.equal(recorder.exceptions[0]?.err, err);
    assert.equal(recorder.exceptions[0]?.ctx?.tags?.boundary, "product");
    assert.equal(recorder.exceptions[0]?.ctx?.extra?.digest, "abc123");
    assert.equal(recorder.messages.length, 1);
    assert.equal(recorder.messages[0]?.message, "heads up");
    assert.equal(recorder.messages[0]?.ctx?.level, "warning");
    assert.equal(recorder.flushed, 1);
  });

  it("noop reporter never throws and flush resolves true", async () => {
    const reporter = new NoopErrorReporter();
    reporter.captureException(new Error("ignored"));
    reporter.captureMessage("ignored");
    assert.equal(await reporter.flush(), true);
  });

  it("TestErrorReporter.reset clears state", async () => {
    const recorder = new TestErrorReporter();
    recorder.captureException(new Error("x"));
    recorder.captureMessage("y");
    await recorder.flush();
    recorder.reset();
    assert.equal(recorder.exceptions.length, 0);
    assert.equal(recorder.messages.length, 0);
    assert.equal(recorder.flushed, 0);
  });
});
