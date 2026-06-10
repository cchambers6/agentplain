/**
 * tests/conner-dead-e2e-counsel-gate.test.ts
 *
 * GUARDS: pfd/compliance-counsel-gate (#218)
 *
 * FAILURE MODE: "If Conner died tomorrow, can unreviewed replacement legal
 * text EVER ship to a customer surface?"
 *
 * THE BAR:
 *   1. No signoff row → rewrites GATED (fail-closed; silence is never consent).
 *   2. Signed row → rewrites live (the ONLY path to live).
 *   3. Revoked → gated again immediately; re-signing restores live.
 *   4. DB unreachable (store throws) → gated (never assumes signed on error).
 *   5. Env kill-switch OFF for a vertical → gated even with a valid DB row.
 *   6. Unknown vertical slug → gated (no registry entry = no live path).
 *   7. Banner: shows "in counsel review" when corpus exists but not live;
 *      hides when live; hides when no corpus.
 *   8. Banner copy is the authoritative COUNSEL_GATED_BANNER_TEXT constant —
 *      never an internal error message or raw reason code.
 *
 * All assertions run OFFLINE — injectable InMemoryCounselSignoffStore, no DB.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCounselGate,
  isSignoffCurrentlyValid,
  envPermitsVertical,
  shouldShowCounselGatedBanner,
  COUNSEL_GATED_BANNER_TEXT,
  type CounselSignoff,
} from "@/lib/agents/sentinel/counsel-signoff";
import { InMemoryCounselSignoffStore } from "@/lib/agents/sentinel/counsel-signoff-store";

// ── Env management ───────────────────────────────────────────────────────────

const ENV_KEY = "COMPLIANCE_CORPUS_COUNSEL_REVIEWED";
const ORIGINAL_ENV = process.env[ENV_KEY];

// Before every test: permit real-estate + mortgage; all others blocked.
beforeEach(() => {
  process.env[ENV_KEY] = "real-estate,mortgage";
});
afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL_ENV;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-10T12:00:00.000Z");
const PAST = new Date("2026-06-01T00:00:00.000Z");
const FUTURE = new Date("2099-01-01T00:00:00.000Z");

function signedRow(over: Partial<CounselSignoff> = {}): CounselSignoff {
  return {
    verticalSlug: "real-estate",
    signedAt: PAST,
    revokedAt: null,
    artifactRef: "blob://counsel/real-estate-v1.pdf",
    signedByEmail: "counsel@example.com",
    signedByUserId: null,
    note: null,
    updatedAt: PAST,
    ...over,
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

// ── Suite 1: fail-closed on missing / invalid rows ───────────────────────────

describe("conner-dead / counsel-gate: fail-closed on missing/invalid sign-off", () => {
  it("no signoff row → gated (no-signoff-row) — silence is never consent", async () => {
    const store = new InMemoryCounselSignoffStore([]); // no rows
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false,
      "without a durable sign-off row, rewrites MUST be gated");
    assert.equal(r.reason, "no-signoff-row");
  });

  it("row present but signedAt is NULL → gated (not-signed)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ signedAt: null }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false);
    assert.equal(r.reason, "not-signed");
  });

  it("row present but signedAt is in the FUTURE → gated (future-dated)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ signedAt: FUTURE }),
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

  it("row revoked → gated immediately (revoked)", async () => {
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
});

// ── Suite 2: the one path to live ───────────────────────────────────────────

describe("conner-dead / counsel-gate: affirmative sign-off is the ONLY path to live", () => {
  it("valid row + env-permitted → live (the one happy path)", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, true,
      "an un-revoked, past-dated sign-off row + env flag = live");
    assert.equal(r.reason, "live");
  });

  it("signedAt = exactly NOW → live (boundary: present is valid)", async () => {
    const store = new InMemoryCounselSignoffStore([
      signedRow({ signedAt: NOW }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, true);
    assert.equal(r.reason, "live");
  });
});

// ── Suite 3: revoke ↔ re-sign lifecycle ─────────────────────────────────────

describe("conner-dead / counsel-gate: revoke → gated; re-sign → live again", () => {
  it("revoke gates immediately; re-recording sign-off restores live", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()]);

    // Confirmed live before revoke
    let r = await evaluateCounselGate({ verticalSlug: "real-estate", store, isKnownVertical, now: NOW });
    assert.equal(r.live, true, "pre-condition: live before revoke");

    // Revoke
    await store.revoke("real-estate", { email: "ops@example.com" });
    r = await evaluateCounselGate({ verticalSlug: "real-estate", store, isKnownVertical, now: NOW });
    assert.equal(r.live, false, "immediately gated after revoke");
    assert.equal(r.reason, "revoked");

    // Re-record (a new signed artifact — clears revokedAt)
    await store.record({
      verticalSlug: "real-estate",
      signedAt: new Date("2026-06-09T00:00:00Z"),
      artifactRef: "blob://counsel/real-estate-v2.pdf",
      signedByEmail: "counsel@example.com",
    });
    r = await evaluateCounselGate({ verticalSlug: "real-estate", store, isKnownVertical, now: NOW });
    assert.equal(r.live, true, "live again after re-sign");
    assert.equal(r.reason, "live");
  });
});

// ── Suite 4: env kill-switch sits ABOVE the DB rows ─────────────────────────

describe("conner-dead / counsel-gate: env kill-switch is layer-1 — wins over DB rows", () => {
  it("env OFF for a vertical → gated even with a perfect DB row (env wins)", async () => {
    // insurance is NOT in the env list (env = "real-estate,mortgage")
    const store = new InMemoryCounselSignoffStore([
      signedRow({ verticalSlug: "insurance" }),
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "insurance",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false,
      "env kill-switch blocks even a clean DB row — no bypass");
    assert.equal(r.reason, "env-killed");
  });

  it("env cleared entirely → ALL verticals gated", async () => {
    process.env[ENV_KEY] = ""; // empty list
    const store = new InMemoryCounselSignoffStore([signedRow()]);
    const r = await evaluateCounselGate({
      verticalSlug: "real-estate",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false,
      "empty env list gates every vertical globally");
    assert.equal(r.reason, "env-killed");
  });

  it("env permits vertical → only DB row decides (env not the blocker)", async () => {
    process.env[ENV_KEY] = "insurance"; // now insurance is permitted
    const store = new InMemoryCounselSignoffStore([]); // but no DB row
    const r = await evaluateCounselGate({
      verticalSlug: "insurance",
      store,
      isKnownVertical,
      now: NOW,
    });
    assert.equal(r.live, false,
      "env passes but missing DB row still gates");
    assert.equal(r.reason, "no-signoff-row");
  });
});

// ── Suite 5: fail-closed on store error ─────────────────────────────────────

describe("conner-dead / counsel-gate: DB unreachable → fail-closed, never throws", () => {
  it("store throws → gated (store-error), evaluateCounselGate never re-throws", async () => {
    const store = new InMemoryCounselSignoffStore([signedRow()], {
      throwOnGet: true,
    });
    let r: Awaited<ReturnType<typeof evaluateCounselGate>>;
    try {
      r = await evaluateCounselGate({
        verticalSlug: "real-estate",
        store,
        isKnownVertical,
        now: NOW,
      });
    } catch (err) {
      assert.fail(`evaluateCounselGate threw: ${err} — it must NEVER throw`);
      return;
    }
    assert.equal(r.live, false,
      "store-error → fail-closed (we never assume signed when the DB is down)");
    assert.equal(r.reason, "store-error");
  });
});

// ── Suite 6: unknown vertical slug ───────────────────────────────────────────

describe("conner-dead / counsel-gate: unknown vertical → gated", () => {
  it("unregistered slug → gated (unknown-vertical) regardless of env + rows", async () => {
    process.env[ENV_KEY] = "made-up-vertical"; // env would permit it
    const store = new InMemoryCounselSignoffStore([
      signedRow({ verticalSlug: "made-up-vertical" }), // row would pass
    ]);
    const r = await evaluateCounselGate({
      verticalSlug: "made-up-vertical",
      store,
      isKnownVertical, // but the vertical is NOT in the registry
      now: NOW,
    });
    assert.equal(r.live, false,
      "unknown vertical always gated — isKnownVertical is a required pre-check");
    assert.equal(r.reason, "unknown-vertical");
  });
});

// ── Suite 7: banner render conditions ────────────────────────────────────────

describe("conner-dead / counsel-gate: banner shows honest 'in counsel review' copy", () => {
  it("corpus exists + rewrite NOT live → show the banner", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: true, rewriteLive: false }),
      true,
      "customer should see the honest 'in review' message, not a blank panel",
    );
  });

  it("corpus exists + rewrite live → hide the banner (rewrite is available)", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: true, rewriteLive: true }),
      false,
    );
  });

  it("no corpus → hide the banner (auto-rewrite never applies to this vertical)", () => {
    assert.equal(
      shouldShowCounselGatedBanner({ hasCorpus: false, rewriteLive: false }),
      false,
    );
  });

  it("banner copy is honest, calm, and mentions sign-off — no internal error code exposed", () => {
    // The customer-facing copy must mention the review/sign-off concept
    // without leaking internal reason codes ("env-killed", "store-error", etc.)
    assert.ok(
      COUNSEL_GATED_BANNER_TEXT.includes("counsel"),
      "banner mentions counsel review so the customer understands the state",
    );
    assert.ok(
      COUNSEL_GATED_BANNER_TEXT.includes("compliance"),
      "banner mentions compliance context",
    );
    assert.ok(
      !COUNSEL_GATED_BANNER_TEXT.includes("env-killed"),
      "internal reason code 'env-killed' must NOT appear in customer copy",
    );
    assert.ok(
      !COUNSEL_GATED_BANNER_TEXT.includes("store-error"),
      "internal reason code 'store-error' must NOT appear in customer copy",
    );
    assert.ok(
      !COUNSEL_GATED_BANNER_TEXT.includes("401"),
      "HTTP status codes must NOT appear in customer copy",
    );
    assert.ok(
      COUNSEL_GATED_BANNER_TEXT.length > 40,
      "banner copy is substantive (not an empty placeholder)",
    );
  });
});

// ── Suite 8: isSignoffCurrentlyValid — pure predicate boundary conditions ────

describe("conner-dead / counsel-gate: isSignoffCurrentlyValid pure predicate", () => {
  it("null → false", () => assert.equal(isSignoffCurrentlyValid(null, NOW), false));
  it("signedAt null → false", () =>
    assert.equal(isSignoffCurrentlyValid(signedRow({ signedAt: null }), NOW), false));
  it("revokedAt set → false even if signedAt past", () =>
    assert.equal(isSignoffCurrentlyValid(signedRow({ revokedAt: NOW }), NOW), false));
  it("signedAt future → false", () =>
    assert.equal(isSignoffCurrentlyValid(signedRow({ signedAt: FUTURE }), NOW), false));
  it("signedAt = exactly NOW → true (boundary inclusive)", () =>
    assert.equal(isSignoffCurrentlyValid(signedRow({ signedAt: NOW }), NOW), true));
  it("signedAt past, not revoked → true", () =>
    assert.equal(isSignoffCurrentlyValid(signedRow(), NOW), true));
});
