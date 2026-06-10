/**
 * tests/e2e-mint-session.test.ts
 *
 * Offline unit tests for the harness session minting. Proves the minted seal
 * round-trips through the SAME unseal path the server uses — i.e. a session
 * minted by `mintSession` is a session the app will accept. NO database, NO
 * network. Requires SESSION_PASSWORD (a strong test value set below) since the
 * seal helpers read it from env, exactly as production does.
 *
 * The round-trip is the load-bearing assertion: if `unsealSessionToken`
 * (the function lib/auth/mobile-session.ts#readMobileSession + the cookie
 * path both call) returns our payload intact, the harness is authenticating
 * the way a real login does.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// Strong test password (32+ chars) so iron-session doesn't reject for entropy.
// Per feedback_no_prod_secrets_in_dev — a throwaway test value, never a real
// secret. Set BEFORE importing the modules that read it.
process.env.SESSION_PASSWORD =
  process.env.SESSION_PASSWORD ??
  "abcdefghijklmnopqrstuvwxyz012345-mint-session-test-password";

import { buildSessionPayload, mintSession } from "@/tests/fixtures/mint-session";
import { unsealSessionToken } from "@/lib/auth/session";

describe("buildSessionPayload", () => {
  it("mirrors the magic-link exchange payload shape", () => {
    const p = buildSessionPayload({
      userId: "u-1",
      email: "owner@e2e.test",
      activeWorkspaceId: "ws-1",
      issuedAtIso: "2026-06-09T00:00:00.000Z",
    });
    assert.deepEqual(p, {
      userId: "u-1",
      email: "owner@e2e.test",
      isOperator: false,
      activeWorkspaceId: "ws-1",
      issuedAt: "2026-06-09T00:00:00.000Z",
    });
  });

  it("defaults isOperator to false and stamps issuedAt", () => {
    const p = buildSessionPayload({
      userId: "u",
      email: "e@e.test",
      activeWorkspaceId: null,
    });
    assert.equal(p.isOperator, false);
    assert.ok(!Number.isNaN(Date.parse(p.issuedAt)));
  });
});

describe("mintSession — round-trips through the server's unseal path", () => {
  it("produces a seal that unseals to the same payload", async () => {
    const minted = await mintSession({
      userId: "user-abc",
      email: "owner@e2e.test",
      activeWorkspaceId: "ws-xyz",
      issuedAtIso: "2026-06-09T12:00:00.000Z",
    });
    const back = await unsealSessionToken(minted.token);
    assert.ok(back, "unseal returned null — secret mismatch?");
    assert.equal(back.userId, "user-abc");
    assert.equal(back.email, "owner@e2e.test");
    assert.equal(back.activeWorkspaceId, "ws-xyz");
    assert.equal(back.isOperator, false);
    assert.equal(back.issuedAt, "2026-06-09T12:00:00.000Z");
  });

  it("exposes both bearer (API) and cookie (HTML) headers carrying the seal", async () => {
    const minted = await mintSession({
      userId: "u",
      email: "e@e.test",
      activeWorkspaceId: "w",
    });
    assert.equal(minted.headers.bearer.Authorization, `Bearer ${minted.token}`);
    assert.equal(
      minted.headers.cookie.Cookie,
      `${minted.cookieName}=${minted.token}`,
    );
  });

  it("carries an operator flag through the seal when requested", async () => {
    const minted = await mintSession({
      userId: "op",
      email: "op@e2e.test",
      activeWorkspaceId: "w",
      isOperator: true,
    });
    const back = await unsealSessionToken(minted.token);
    assert.equal(back?.isOperator, true);
  });

  it("a garbage / tampered token does NOT yield a usable session (auth integrity)", async () => {
    // The empty string is rejected outright (null). NOTE: iron-session's
    // unsealData returns {} (not null) for a non-empty token that lacks the
    // sealed envelope — so the hard guarantee is "no usable userId", which is
    // what the membership gate keys on. (Byte-level tamper rejection of a
    // *valid* seal is covered exhaustively in tests/auth-session-seal.test.ts.)
    assert.equal(await unsealSessionToken(""), null);
    for (const garbage of ["not-a-real-seal", "Fe26.2**deadbeef"]) {
      const back = await unsealSessionToken(garbage);
      assert.ok(
        back == null || typeof back.userId !== "string" || back.userId.length === 0,
        `garbage token "${garbage}" yielded a usable userId`,
      );
    }
  });
});
