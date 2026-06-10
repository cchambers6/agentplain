/**
 * lib/agents/sentinel/counsel-signoff.test.ts
 *
 * pfd-5 — pins the per-vertical counsel sign-off gate. The bar: unreviewed
 * legal text can NEVER ship. These tests prove the gate is FAIL-CLOSED on
 * every ambiguity and that the env kill-switch sits ABOVE the durable rows.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCounselGate,
  isSignoffCurrentlyValid,
  envPermitsVertical,
  shouldShowCounselGatedBanner,
  type CounselSignoff,
} from "./counsel-signoff";
import { InMemoryCounselSignoffStore } from "./counsel-signoff-store";

const ENV_KEY = "COMPLIANCE_CORPUS_COUNSEL_REVIEWED";
const ORIGINAL = process.env[ENV_KEY];

beforeEach(() => {
  process.env[ENV_KEY] = "real-estate,mortgage";
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL;
});

const NOW = new Date("2026-06-10T12:00:00Z");

function signedRow(overrides: Partial<CounselSignoff> = {}): CounselSignoff {
  return {
    verticalSlug: "real-estate",
    signedAt: new Date("2026-06-01T00:00:00Z"),
    revokedAt: null,
    artifactRef: "blob://counsel/real-estate.pdf",
    signedByEmail: "counsel@example.com",
    signedByUserId: null,
    note: null,
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

const knownVerticals = new Set([
  "real-estate",
  "mortgage",
  "insurance",
  "cpa",
  "law",
  "ria",
  "title-escrow",
]);
const isKnownVertical = (s: string) => knownVerticals.has(s);

// ── isSignoffCurrentlyValid — the pure predicate ────────────────────────────

describe("isSignoffCurrentlyValid (pure, fail-closed)", () => {
  it("null row → invalid", () => {
    assert.equal(isSignoffCurrentlyValid(null, NOW), false);
  });
  it("never signed (signedAt null) → invalid", () => {
    assert.equal(
      isSignoffCurrentlyValid(signedRow({ signedAt: null }), NOW),
      false,
    );
  });
  it("revoked → invalid even if signed", () => {
    assert.equal(
      isSignoffCurrentlyValid(signedRow({ revokedAt: NOW }), NOW),
      false,
    );
  });
  it("future-dated signedAt → invalid (not yet effective)", () => {
    assert.equal(
      isSignoffCurrentlyValid(
        signedRow({ signedAt: new Date("2099-01-01T00:00:00Z") }),
        NOW,
      ),
      false,
    );
  });
  it("signed in the past, not revoked → valid", () => {
    assert.equal(isSignoffCurrentlyValid(signedRow(), NOW), true);
  });
});

// ── envPermitsVertical — layer 1 ────────────────────────────────────────────

describe("envPermitsVertical (env kill-switch)", () => {
  it("listed slug → true; unlisted → false; case-insensitive", () => {
    assert.equal(envPermitsVertical("real-estate"), true);
    assert.equal(envPermitsVertical("MORTGAGE"), true);
    assert.equal(envPermitsVertical("insurance"), false);
  });
});

// ── shouldShowCounselGatedBanner — customer surface render condition ────────

describe("shouldShowCounselGatedBanner", () => {
  it("shows when there is a corpus but rewrite is not live", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: true, rewriteLive: false }),
      true,
    );
  });
  it("hides when rewrite is live", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: true, rewriteLive: true }),
      false,
    );
  });
  it("hides when there is no corpus (rewrite never applies)", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: false, rewriteLive: false }),
      false,
    );
  });
});

// ── evaluateCounselGate — the full gate ─────────────────────────────────────

describe("evaluateCounselGate — full gate, fail-closed", () => {
  it("signed AND env-permitted → live", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, true);
    assert.equal(r.reason, "live");
  });

  it("no sign-off row → gated (no-signoff-row)", async () => {
    const store = new InMemoryCounselSignoffStore([]); // empty
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "no-signoff-row");
  });

  it("env-OFF for the vertical → gated even with a valid row (env wins)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ verticalSlug: "insurance" }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "insurance", // not in env list
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "env-killed");
  });

  it("revoked row → gated (revoked)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ revokedAt: new Date("2026-06-05T00:00:00Z") }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "revoked");
  });

  it("future-dated sign-off → gated (future-dated)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ signedAt: new Date("2099-01-01T00:00:00Z") }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "future-dated");
  });

  it("DB unreachable (store throws) → gated (store-error), never throws", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()], {
      throwOnGet: true,
    });
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "store-error");
  });

  it("unknown vertical → gated (unknown-vertical), store never consulted", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()]);
    const r = await evaluateCounselGate({
      verticalSlug: "totally-made-up",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "unknown-vertical");
  });

  it("revoke then re-sign restores live (reversible)", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()]);
    // revoke
    await store.revoke("real-estate", { email: "ops@example.com" });
    let r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "revoked");

    // re-record (clears revokedAt)
    await store.record({
      verticalSlug: "real-estate",
      signedAt: new Date("2026-06-09T00:00:00Z"),
      artifactRef: "blob://counsel/real-estate-v2.pdf",
      signedByEmail: "counsel@example.com",
    });
    r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, true);
    assert.equal(r.reason, "live");
  });
});
