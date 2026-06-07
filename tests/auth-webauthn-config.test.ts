/**
 * tests/auth-webauthn-config.test.ts
 *
 * Pins the WebAuthn relying-party config resolver and the env list parsing
 * it depends on. The 2026-05-27 passkey regression on the apex
 * (`agentplain.com`) was: the server returned `rpId: app.agentplain.com`
 * to a user on the apex host because rpID was derived from a single
 * subdomain-scoped APP_PUBLIC_ORIGIN. The browser then rejected the call
 * with SecurityError (rpID is not a registrable-domain suffix of the
 * current host) and the client silently swallowed it as "user cancelled."
 *
 * The defenses pinned here:
 *   1. RP_ID overrides the host-from-origin derivation, so prod can scope
 *      passkeys to the registrable apex even while APP_PUBLIC_ORIGIN
 *      remains a subdomain.
 *   2. WEBAUTHN_ALLOWED_ORIGINS parses to a list of origins (trimmed,
 *      trailing-slash-stripped, comma-separated) and feeds expectedOrigins
 *      so verify*Response accepts assertions from any served host.
 *   3. When WEBAUTHN_ALLOWED_ORIGINS is unset, expectedOrigins falls back
 *      to [APP_PUBLIC_ORIGIN] — single-host dev/preview stays working.
 *
 * A regression in any of these silently breaks sign-in on a sibling host.
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

const freshMod = async () => {
  // Re-import the config + env modules under the current process.env so
  // each test gets a deterministic read (env.* accessors call optional()
  // on every invocation, but importing ensures the latest module body).
  delete require.cache[require.resolve("@/lib/auth/webauthn/config")];
  delete require.cache[require.resolve("@/lib/env")];
  return import("@/lib/auth/webauthn/config");
};

const freshConfig = async () => (await freshMod()).getWebAuthnConfig();

describe("getWebAuthnConfig — rpID resolution", () => {
  beforeEach(resetEnv);

  it("derives rpID from APP_PUBLIC_ORIGIN host when RP_ID is unset", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "app.agentplain.com");
  });

  it("uses RP_ID verbatim when set — apex scope overrides subdomain host", async () => {
    // The prod fix: APP_PUBLIC_ORIGIN stays the canonical app subdomain,
    // RP_ID is set to the registrable apex so credentials work across
    // every sibling subdomain.
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    process.env.RP_ID = "agentplain.com";
    const config = await freshConfig();
    assert.equal(config.rpID, "agentplain.com");
  });

  it("falls back to 'localhost' rpID when APP_PUBLIC_ORIGIN is not a URL", async () => {
    process.env.APP_PUBLIC_ORIGIN = "not-a-url";
    const config = await freshConfig();
    // Fail-closed: empty rpID would be silently rejected by the browser
    // with a confusing error; 'localhost' at least matches local dev.
    assert.equal(config.rpID, "localhost");
  });
});

describe("getWebAuthnConfig — expectedOrigins list", () => {
  beforeEach(resetEnv);

  it("falls back to [APP_PUBLIC_ORIGIN] when WEBAUTHN_ALLOWED_ORIGINS is unset", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const config = await freshConfig();
    assert.deepEqual(config.expectedOrigins, ["https://app.agentplain.com"]);
    assert.equal(config.canonicalOrigin, "https://app.agentplain.com");
  });

  it("strips a trailing slash from the canonical origin", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com/";
    const config = await freshConfig();
    assert.equal(config.canonicalOrigin, "https://app.agentplain.com");
    assert.deepEqual(config.expectedOrigins, ["https://app.agentplain.com"]);
  });

  it("parses WEBAUTHN_ALLOWED_ORIGINS as the full accept-list", async () => {
    // The prod fix: apex + www + app all in the accept-list so any host
    // can complete sign-in.
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

  it("ignores empty entries inside the comma-separated list", async () => {
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

describe("resolveRpId — host-aware rpID (the durable apex fix)", () => {
  beforeEach(resetEnv);

  it("collapses the apex itself to the registrable parent", async () => {
    const { resolveRpId } = await freshMod();
    assert.equal(resolveRpId("agentplain.com"), "agentplain.com");
  });

  it("collapses app + www subdomains to the same parent (one credential, all hosts)", async () => {
    const { resolveRpId } = await freshMod();
    assert.equal(resolveRpId("app.agentplain.com"), "agentplain.com");
    assert.equal(resolveRpId("www.agentplain.com"), "agentplain.com");
  });

  it("uses the full host for Vercel previews — passkeys testable on preview", async () => {
    const { resolveRpId } = await freshMod();
    // vercel.app is a public suffix; the registrable domain IS the full host,
    // so we must NOT strip a label here or the browser throws SecurityError.
    assert.equal(
      resolveRpId("agentplain-abc123-cchambers6s-projects.vercel.app"),
      "agentplain-abc123-cchambers6s-projects.vercel.app",
    );
  });

  it("uses localhost (sans port) for local dev", async () => {
    const { resolveRpId } = await freshMod();
    assert.equal(resolveRpId("localhost:3000"), "localhost");
  });

  it("RP_ID env still overrides the derivation (explicit pin)", async () => {
    process.env.RP_ID = "agentplain.com";
    const { resolveRpId } = await freshMod();
    // Even on a preview host, an explicit pin wins.
    assert.equal(resolveRpId("agentplain-abc.vercel.app"), "agentplain.com");
  });
});

describe("getWebAuthnConfigForRequest — per-request rpID + expectedOrigins", () => {
  beforeEach(resetEnv);

  it("apex request: rpID=agentplain.com and the apex origin is accepted", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const { getWebAuthnConfigForRequest } = await freshMod();
    const config = getWebAuthnConfigForRequest({
      host: "agentplain.com",
      origin: "https://agentplain.com",
    });
    assert.equal(config.rpID, "agentplain.com");
    // Both the request origin AND the canonical app origin verify, so a
    // credential created on the apex works when later used on the app host.
    assert.ok(config.expectedOrigins.includes("https://agentplain.com"));
    assert.ok(config.expectedOrigins.includes("https://app.agentplain.com"));
  });

  it("app request: rpID=agentplain.com, app origin accepted", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const { getWebAuthnConfigForRequest } = await freshMod();
    const config = getWebAuthnConfigForRequest({
      host: "app.agentplain.com",
      origin: "https://app.agentplain.com",
    });
    assert.equal(config.rpID, "agentplain.com");
    assert.ok(config.expectedOrigins.includes("https://app.agentplain.com"));
  });

  it("preview request: rpID + expectedOrigin both follow the preview host", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const { getWebAuthnConfigForRequest } = await freshMod();
    const host = "agentplain-abc.vercel.app";
    const config = getWebAuthnConfigForRequest({
      host,
      origin: `https://${host}`,
    });
    assert.equal(config.rpID, host);
    assert.ok(config.expectedOrigins.includes(`https://${host}`));
  });

  it("de-dupes when request origin equals the canonical origin", async () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.agentplain.com";
    const { getWebAuthnConfigForRequest } = await freshMod();
    const config = getWebAuthnConfigForRequest({
      host: "app.agentplain.com",
      origin: "https://app.agentplain.com",
    });
    const occurrences = config.expectedOrigins.filter(
      (o) => o === "https://app.agentplain.com",
    ).length;
    assert.equal(occurrences, 1);
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
