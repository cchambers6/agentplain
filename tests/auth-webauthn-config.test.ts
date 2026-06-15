/**
 * tests/auth-webauthn-config.test.ts
 *
 * Pins the WebAuthn relying-party config resolver and the env list parsing
 * it depends on.
 *
 * THE REGRESSION THIS GUARDS (returned twice — 2026-05-27 and 2026-06-15):
 * production served `rpId: app.agentplain.com` to users on the apex
 * (`agentplain.com`) and www. The browser rejects that with SecurityError,
 * because an rpID must equal, or be a PARENT of, the current host — a child
 * subdomain is never valid. Passkey sign-in then fails on every host except
 * app.* (and the client UI surfaced a generic "blocked" message).
 *
 * Root cause both times: correctness was offloaded to env vars (RP_ID,
 * WEBAUTHN_ALLOWED_ORIGINS) that were not set in Vercel, and the code's
 * DEFAULT derived the literal host (`app.agentplain.com`) instead of the
 * registrable apex. The earlier version of this test pinned that broken
 * default as "correct" (asserting rpID === "app.agentplain.com"), so it
 * stayed green while prod was broken.
 *
 * The invariant now pinned — and the reason this is a durable guard:
 *   1. With ONLY APP_PUBLIC_ORIGIN set (the actual prod env shape), rpID is
 *      the registrable apex and expectedOrigins covers apex + www + app.
 *      Correctness lives in code, not in env that can drift.
 *   2. RP_ID / WEBAUTHN_ALLOWED_ORIGINS still override for topologies the
 *      derivation can't infer.
 *   3. localhost / preview hosts stay single-host and self-consistent.
 *
 * A regression in (1) silently breaks sign-in on a sibling host.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

const WEBAUTHN_ENV = [
  "APP_PUBLIC_ORIGIN",
  "RP_ID",
  "RP_NAME",
  "WEBAUTHN_ALLOWED_ORIGINS",
] as const;

const resetEnv = () => {
  for (const key of WEBAUTHN_ENV) {
    delete process.env[key];
  }
};

const freshConfig = async () => {
  // Re-import the config + env modules under the current process.env so
  // each test gets a deterministic read (env.* accessors call optional()
  // on every invocation, but importing ensures the latest module body).
  delete require.cache[require.resolve("@/lib/auth/webauthn/config")];
  delete require.cache[require.resolve("@/lib/env")];
  const { getWebAuthnConfig } = await import("@/lib/auth/webauthn/config");
  return getWebAuthnConfig();
};

describe("getWebAuthnConfig — rpID resolution (correct-by-default)", () => {
  beforeEach(resetEnv);

  it("derives the registrable APEX from an app.* canonical host with NO env override", async () => {
    // This is the exact production env shape. The default MUST be the apex,
    // not the literal host — otherwise sign-in breaks on apex + www.
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "agentplain.com");
  });

  it("collapses a www.* canonical host to the apex too", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://www.agentplain.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "agentplain.com");
  });

  it("leaves an apex canonical host unchanged", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://agentplain.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "agentplain.com");
  });

  it("uses RP_ID verbatim when set — explicit override wins", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    process.env.RP_ID = "custom.example.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "custom.example.com");
  });

  it("keeps a preview *.vercel.app host verbatim (NOT collapsed to the public suffix)", async () => {
    // A preview deploy is its own self-consistent RP — collapsing to
    // "vercel.app" (a public suffix) would be rejected by the browser.
    process.env.APP_PUBLIC_ORIGIN =
      "https://agentplain-git-feature-team.vercel.app";
    const config = await freshConfig();
    assert.equal(config.rpID, "agentplain-git-feature-team.vercel.app");
  });

  it("keeps localhost as the rpID for local dev", async () => {
    process.env.APP_PUBLIC_ORIGIN = "http://localhost:3000";
    const config = await freshConfig();
    assert.equal(config.rpID, "localhost");
  });

  it("falls back to 'localhost' rpID when APP_PUBLIC_ORIGIN is not a URL", async () => {
    process.env.APP_PUBLIC_ORIGIN = "not-a-url";
    const config = await freshConfig();
    // Fail-closed: empty rpID would be silently rejected by the browser.
    assert.equal(config.rpID, "localhost");
  });
});

describe("getWebAuthnConfig — expectedOrigins list (correct-by-default)", () => {
  beforeEach(resetEnv);

  it("derives apex + www + app from an app.* canonical host with NO env override", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const config = await freshConfig();
    assert.deepEqual(config.expectedOrigins, [
      "https://agentplain.com",
      "https://www.agentplain.com",
      "https://app.agentplain.com",
    ]);
    assert.equal(config.canonicalOrigin, "https://app.agentplain.com");
  });

  it("strips a trailing slash from the canonical origin before deriving", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com/";
    const config = await freshConfig();
    assert.equal(config.canonicalOrigin, "https://app.agentplain.com");
    assert.deepEqual(config.expectedOrigins, [
      "https://agentplain.com",
      "https://www.agentplain.com",
      "https://app.agentplain.com",
    ]);
  });

  it("stays single-host for localhost / preview (no sibling hosts to accept)", async () => {
    process.env.APP_PUBLIC_ORIGIN = "http://localhost:3000";
    const local = await freshConfig();
    assert.deepEqual(local.expectedOrigins, ["http://localhost:3000"]);

    resetEnv();
    process.env.APP_PUBLIC_ORIGIN =
      "https://agentplain-git-feature-team.vercel.app";
    const preview = await freshConfig();
    assert.deepEqual(preview.expectedOrigins, [
      "https://agentplain-git-feature-team.vercel.app",
    ]);
  });

  it("uses WEBAUTHN_ALLOWED_ORIGINS verbatim when set — explicit override wins", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    process.env.WEBAUTHN_ALLOWED_ORIGINS =
      "https://agentplain.com, https://www.agentplain.com ,https://app.agentplain.com/";
    const config = await freshConfig();
    assert.deepEqual(config.expectedOrigins, [
      "https://agentplain.com",
      "https://www.agentplain.com",
      "https://app.agentplain.com",
    ]);
    // Canonical stays APP_PUBLIC_ORIGIN — list is purely for verify.
    assert.equal(config.canonicalOrigin, "https://app.agentplain.com");
  });

  it("ignores empty entries inside the comma-separated override list", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    process.env.WEBAUTHN_ALLOWED_ORIGINS =
      "https://agentplain.com,,  ,https://app.agentplain.com";
    const config = await freshConfig();
    assert.deepEqual(config.expectedOrigins, [
      "https://agentplain.com",
      "https://app.agentplain.com",
    ]);
  });
});

describe("env.webauthnAllowedOrigins — list parsing", () => {
  beforeEach(resetEnv);

  it("returns an empty array when unset (config layer applies the fallback)", async () => {
    delete require.cache[require.resolve("@/lib/env")];
    const { env } = await import("@/lib/env");
    assert.deepEqual(env.webauthnAllowedOrigins(), []);
  });

  it("trims whitespace and strips trailing slashes per entry", async () => {
    process.env.WEBAUTHN_ALLOWED_ORIGINS =
      " https://a.example/ ,https://b.example,  https://c.example/  ";
    delete require.cache[require.resolve("@/lib/env")];
    const { env } = await import("@/lib/env");
    assert.deepEqual(env.webauthnAllowedOrigins(), [
      "https://a.example",
      "https://b.example",
      "https://c.example",
    ]);
  });
});
