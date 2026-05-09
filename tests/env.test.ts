import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("env tier discipline", () => {
  beforeEach(() => {
    delete process.env.AUTH_PROVIDER;
    delete process.env.BILLING_PROVIDER;
    delete process.env.BRIEFINGS_PROVIDER;
    delete process.env.OPERATOR_EMAIL_ALLOWLIST;
    delete process.env.SESSION_PASSWORD;
  });

  it("falls back to default adapter selection when env unset", async () => {
    const { env } = await import("@/lib/env");
    assert.equal(env.authProvider(), "resend");
    assert.equal(env.billingProvider(), "stripe");
    assert.equal(env.briefingsProvider(), "notion");
  });

  it("honors AUTH_PROVIDER=test", async () => {
    process.env.AUTH_PROVIDER = "test";
    const { env } = await import("@/lib/env");
    assert.equal(env.authProvider(), "test");
  });

  it("rejects unknown provider values", async () => {
    process.env.AUTH_PROVIDER = "rogue";
    const { env } = await import("@/lib/env");
    assert.throws(() => env.authProvider(), /AUTH_PROVIDER/);
  });

  it("operator allowlist parses and lowercases", async () => {
    process.env.OPERATOR_EMAIL_ALLOWLIST =
      "Conner@example.com, second@x.test , ";
    const { env } = await import("@/lib/env");
    assert.deepEqual(env.operatorEmailAllowlist(), [
      "conner@example.com",
      "second@x.test",
    ]);
  });

  it("required throws on missing", async () => {
    const { env } = await import("@/lib/env");
    assert.throws(() => env.sessionPassword(), /SESSION_PASSWORD/);
  });
});
