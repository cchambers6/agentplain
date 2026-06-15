/**
 * tests/e2e/passkey-full-ceremony.spec.ts
 *
 * End-to-end WebAuthn ceremony tests with a CDP virtual authenticator.
 * Complements the DB-free unit guard in tests/auth-webauthn-config.test.ts:
 * the unit test pins the rpID/expectedOrigins derivation; THIS spec proves the
 * real browser → server ceremony actually completes against a running app.
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e          # rpId check
 *   E2E_BASE_URL=https://app.agentplain.com npm run test:e2e     # prod rpId check
 *   E2E_BASE_URL=... E2E_SESSION_COOKIE=<sealed-value> npm run test:e2e   # full ceremony
 *
 * The specs self-skip when E2E_BASE_URL is unset, so a bare run is a no-op.
 * The full register→signin→persist ceremony additionally needs a valid signed
 * -in session cookie (E2E_SESSION_COOKIE) because adding a passkey requires an
 * authenticated user; without it, that test skips and only the auth-side rpId
 * assertion (which needs no session) runs.
 */

import { test, expect, type CDPSession, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL;
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
const SESSION_COOKIE_NAME =
  process.env.E2E_SESSION_COOKIE_NAME ?? "agentplain_session";

// Mirrors lib/auth/webauthn/config.ts deriveRpId: strip a leading app./www.
// to reach the registrable apex; leave bare/preview hosts verbatim.
const registrableApex = (host: string): string => {
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const m = host.match(/^(?:app|www)\.(.+)$/i);
  return m ? m[1] : host;
};

test.describe("passkey WebAuthn ceremony", () => {
  test.skip(!BASE_URL, "set E2E_BASE_URL to run passkey e2e specs");

  test("authenticate/options serves rpId = registrable apex (the 2026 regression)", async ({
    request,
  }) => {
    const url = new URL(BASE_URL!);
    const res = await request.post(
      `${BASE_URL}/api/auth/passkey/authenticate/options`,
    );
    expect(res.ok()).toBeTruthy();
    const options = (await res.json()) as { rpId?: string };
    // The bug: rpId came back as the app subdomain ("app.agentplain.com") on
    // every host, which the browser rejects with SecurityError on apex/www.
    expect(options.rpId).toBe(registrableApex(url.hostname));
  });

  test("full register → sign-out → sign-in → session persists", async ({
    page,
    context,
  }) => {
    test.skip(
      !SESSION_COOKIE,
      "set E2E_SESSION_COOKIE (a valid signed-in session) to run the full ceremony",
    );

    const url = new URL(BASE_URL!);
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: SESSION_COOKIE!,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);

    const client = await context.newCDPSession(page);
    const authenticatorId = await installVirtualAuthenticator(client);

    await page.goto(`${BASE_URL}/app`);

    // 1. Register a new passkey via the real /register API + navigator.credentials.
    const registered = await runRegistrationCeremony(page);
    expect(registered.ok, `registration failed: ${registered.error}`).toBe(
      true,
    );

    // 2. Drop the session cookie to simulate a fresh sign-in.
    await context.clearCookies();
    await page.goto(`${BASE_URL}/app/sign-in`);

    // 3. Sign in with the registered passkey (discoverable credential).
    const signedIn = await runAuthenticationCeremony(page);
    expect(signedIn.ok, `authentication failed: ${signedIn.error}`).toBe(true);
    expect(signedIn.redirect ?? "").toContain("/app");

    // 4. Session persists across navigation (the 30-day "stay signed in" cookie).
    await page.goto(`${BASE_URL}/app`);
    await expect(page).not.toHaveURL(/\/app\/sign-in/);

    await client.send("WebAuthn.removeVirtualAuthenticator", {
      authenticatorId,
    });
  });
});

async function installVirtualAuthenticator(client: CDPSession): Promise<string> {
  await client.send("WebAuthn.enable");
  const { authenticatorId } = (await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  )) as { authenticatorId: string };
  return authenticatorId;
}

// Drives /register/options → navigator.credentials.create → /register/verify
// entirely in page context, so it exercises the real server routes + cookies
// without depending on any UI selector.
function runRegistrationCeremony(page: Page) {
  return page.evaluate(async () => {
    const dec = (s: string) => {
      const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
      const b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
      return Uint8Array.from(b, (c) => c.charCodeAt(0));
    };
    const enc = (buf: ArrayBuffer) => {
      const b = String.fromCharCode(...new Uint8Array(buf));
      return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    try {
      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (!optRes.ok) return { ok: false, error: `options ${optRes.status}` };
      const o = await optRes.json();
      const cred = (await navigator.credentials.create({
        publicKey: {
          ...o,
          challenge: dec(o.challenge),
          user: { ...o.user, id: dec(o.user.id) },
          excludeCredentials: (o.excludeCredentials ?? []).map(
            (c: { id: string; type: string; transports?: string[] }) => ({
              ...c,
              id: dec(c.id),
            }),
          ),
        },
      })) as PublicKeyCredential | null;
      if (!cred) return { ok: false, error: "no credential" };
      const r = cred.response as AuthenticatorAttestationResponse;
      const response = {
        id: cred.id,
        rawId: enc(cred.rawId),
        type: cred.type,
        clientExtensionResults: cred.getClientExtensionResults(),
        response: {
          clientDataJSON: enc(r.clientDataJSON),
          attestationObject: enc(r.attestationObject),
        },
      };
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const body = await verifyRes.json().catch(() => ({}));
      return { ok: verifyRes.ok && body.ok === true, error: body.error };
    } catch (e) {
      return { ok: false, error: (e as Error).name + ": " + (e as Error).message };
    }
  });
}

// Drives /authenticate/options → navigator.credentials.get → /authenticate/verify.
function runAuthenticationCeremony(page: Page) {
  return page.evaluate(async () => {
    const dec = (s: string) => {
      const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
      const b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
      return Uint8Array.from(b, (c) => c.charCodeAt(0));
    };
    const enc = (buf: ArrayBuffer) => {
      const b = String.fromCharCode(...new Uint8Array(buf));
      return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    try {
      const optRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
      });
      if (!optRes.ok) return { ok: false, error: `options ${optRes.status}` };
      const o = await optRes.json();
      const cred = (await navigator.credentials.get({
        publicKey: {
          ...o,
          challenge: dec(o.challenge),
          allowCredentials: (o.allowCredentials ?? []).map(
            (c: { id: string; type: string; transports?: string[] }) => ({
              ...c,
              id: dec(c.id),
            }),
          ),
        },
      })) as PublicKeyCredential | null;
      if (!cred) return { ok: false, error: "no assertion" };
      const r = cred.response as AuthenticatorAssertionResponse;
      const response = {
        id: cred.id,
        rawId: enc(cred.rawId),
        type: cred.type,
        clientExtensionResults: cred.getClientExtensionResults(),
        response: {
          clientDataJSON: enc(r.clientDataJSON),
          authenticatorData: enc(r.authenticatorData),
          signature: enc(r.signature),
          userHandle: r.userHandle ? enc(r.userHandle) : null,
        },
      };
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const body = await verifyRes.json().catch(() => ({}));
      return {
        ok: verifyRes.ok && body.ok === true,
        redirect: body.redirect,
        error: body.error,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).name + ": " + (e as Error).message };
    }
  });
}
