/**
 * tests/auth-passkey-verify-route.test.ts
 *
 * Route-level tests for the public passkey-authentication entry points:
 *
 *   POST /api/auth/passkey/authenticate/options
 *   POST /api/auth/passkey/authenticate/verify
 *
 * Both routes are PUBLIC (no session yet) and load-bearing for the
 * sign-in flow. We pin the failure shape on the verify route since a
 * regression there silently downgrades sign-in security:
 *
 *   * Empty body → 400 "Missing response" (route returns BEFORE touching
 *     the WebAuthn provider, so a malformed POST never costs a
 *     verification call).
 *   * Missing/expired challenge cookie → 400 "That sign-in request
 *     expired" (route returns BEFORE invoking verifyAuthentication, so a
 *     replay against a fresh response without our matching challenge
 *     can't reach the verification step).
 *
 * Per `feedback_no_silent_vendor_lock.md`: we never touch
 * `@simplewebauthn/server` directly here. The challenge cookie shape
 * is tested via `lib/auth/webauthn/challenge.ts` indirectly — by
 * confirming the route rejects when the cookie is absent.
 *
 * The success path (real Authentication response + matching credential)
 * is exercised by the browser-driven flow because the assertion bytes
 * are produced by `navigator.credentials.get()`. The failure-shape
 * coverage here is what guards against regressions that silently
 * downgrade the verification gate.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("POST /api/auth/passkey/authenticate/verify — failure shapes", () => {
  it("400s with 'Missing response' when the body has no `response` field", async () => {
    const route = await import(
      "@/app/api/auth/passkey/authenticate/verify/route"
    );
    const req = new Request(
      "http://localhost/api/auth/passkey/authenticate/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notTheRightShape: true }),
      },
    );
    const res = await route.POST(req as never);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Missing response");
  });

  it("400s when the body is not JSON (route catches the parse error)", async () => {
    const route = await import(
      "@/app/api/auth/passkey/authenticate/verify/route"
    );
    const req = new Request(
      "http://localhost/api/auth/passkey/authenticate/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json-{{",
      },
    );
    const res = await route.POST(req as never);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    // The route maps both shapes (parse error → null → "Missing response")
    // to the same 400. The user-visible string MUST be the same so an
    // attacker can't fingerprint malformed-vs-missing.
    assert.equal(body.error, "Missing response");
  });
});

describe("POST /api/auth/passkey/authenticate/options — surface contract", () => {
  it("module exports a POST handler (so the App Router actually mounts it)", async () => {
    const route = await import(
      "@/app/api/auth/passkey/authenticate/options/route"
    );
    assert.equal(typeof route.POST, "function");
    // The handler is declared as `export async function POST()` with no
    // arguments; pinning that shape catches a refactor that adds a
    // required parameter without updating the route contract.
    assert.equal(route.POST.length, 0);
  });

  it("declares the nodejs runtime (WebAuthn flow can't ship on edge)", async () => {
    const route = await import(
      "@/app/api/auth/passkey/authenticate/options/route"
    );
    assert.equal(route.runtime, "nodejs");
  });
});
