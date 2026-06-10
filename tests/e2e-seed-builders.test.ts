/**
 * tests/e2e-seed-builders.test.ts
 *
 * Offline unit tests for the seeded-login harness seed builders + the
 * idempotent apply/teardown logic. NO database, NO env beyond what's passed
 * in — the apply runs against an in-memory FakeSeedClient and a deterministic
 * crypto stand-in. Proves:
 *
 *   - buildSeedPlan is deterministic (same key → identical ids/markers).
 *   - the plan shape carries everything the surfaces need (owner membership,
 *     completed onboarding, 3 approvals of on-main kinds, credentials,
 *     briefing), and every approval marker is embedded in its payload.
 *   - the production guard refuses without opt-in / on a prod-looking DB.
 *   - the apply is idempotent: a second seed re-run produces ZERO new inserts.
 *   - teardown targets exactly the seeded workspace + user.
 *   - payloads are encrypted (never written plaintext).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSeedPlan,
  evaluateSeedGuard,
  seedTestWorkspace,
  teardownTestWorkspace,
  deterministicUuid,
  E2E_SLUG_PREFIX,
  type SeedGuardEnv,
} from "@/tests/fixtures/seed-test-workspace";
import { FakeSeedClient, FAKE_CRYPTO } from "@/tests/fixtures/_fake-seed-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ALLOW: SeedGuardEnv = { ALLOW_E2E_SEED: "yes" };

describe("buildSeedPlan — shape + determinism", () => {
  it("is deterministic for a given key", () => {
    const a = buildSeedPlan({ key: "alpha" });
    const b = buildSeedPlan({ key: "alpha" });
    assert.deepEqual(a, b);
  });

  it("derives distinct ids/slugs for distinct keys", () => {
    const a = buildSeedPlan({ key: "alpha" });
    const b = buildSeedPlan({ key: "beta" });
    assert.notEqual(a.workspace.id, b.workspace.id);
    assert.notEqual(a.user.id, b.user.id);
    assert.notEqual(a.workspace.slug, b.workspace.slug);
  });

  it("emits valid v5 UUIDs for every primary id", () => {
    const p = buildSeedPlan({ key: "uuidcheck" });
    for (const id of [
      p.user.id,
      p.workspace.id,
      p.membership.id,
      p.onboarding.id,
      p.preference.id,
      p.briefing.id,
      ...p.credentials.map((c) => c.id),
      ...p.approvals.map((a) => a.id),
    ]) {
      assert.match(id, UUID_RE, `expected valid v5 uuid, got ${id}`);
    }
  });

  it("marks the workspace as harness-owned via the slug prefix", () => {
    const p = buildSeedPlan({ key: "marked" });
    assert.ok(p.workspace.slug.startsWith(E2E_SLUG_PREFIX));
  });

  it("seeds the owner as an ACTIVE BROKER_OWNER member", () => {
    const p = buildSeedPlan();
    assert.equal(p.membership.role, "BROKER_OWNER");
    assert.equal(p.membership.status, "ACTIVE");
    assert.equal(p.membership.userId, p.user.id);
    assert.equal(p.membership.workspaceId, p.workspace.id);
  });

  it("completes onboarding so the wizard renders the rooted state", () => {
    const p = buildSeedPlan();
    assert.equal(p.onboarding.currentStep, "done");
    assert.ok(p.onboarding.completedAt instanceof Date);
    assert.ok(p.onboarding.completedSteps.includes("set_preferences"));
  });

  it("stages 3 approvals across the on-main kinds", () => {
    const p = buildSeedPlan();
    const kinds = p.approvals.map((a) => a.kind).sort();
    assert.deepEqual(kinds, [
      "FOLLOW_UP_NUDGE",
      "LEAD_TRIAGE",
      "SUPPORT_HANDLER_REPLY_DRAFT",
    ]);
    for (const a of p.approvals) assert.equal(a.status, "PENDING");
  });

  it("embeds each approval marker in the payload the renderer reads", () => {
    const p = buildSeedPlan({ key: "markers" });
    const serialized = p.approvals.map((a) => JSON.stringify(a.payload));
    for (const marker of p.markers.approvals) {
      assert.ok(
        serialized.some((s) => s.includes(marker)),
        `approval marker ${marker} not embedded in any payload`,
      );
    }
  });

  it("embeds the briefing marker in the briefing body", () => {
    const p = buildSeedPlan({ key: "brief" });
    assert.ok(p.briefing.bodyPlaintext.includes(p.markers.briefing));
  });

  it("provisions two integration credentials", () => {
    const p = buildSeedPlan();
    const providers = p.credentials.map((c) => c.provider).sort();
    assert.deepEqual(providers, ["FOLLOW_UP_BOSS", "GOOGLE"]);
  });
});

describe("deterministicUuid", () => {
  it("is stable + collision-free across slots", () => {
    assert.equal(deterministicUuid("x:y"), deterministicUuid("x:y"));
    assert.notEqual(deterministicUuid("x:y"), deterministicUuid("x:z"));
  });
});

describe("evaluateSeedGuard — production refusal", () => {
  it("refuses without ALLOW_E2E_SEED=yes", () => {
    const v = evaluateSeedGuard({}, 0);
    assert.equal(v.allowed, false);
    assert.match(v.reason, /ALLOW_E2E_SEED/);
  });

  it("refuses when E2E_SEED_FORBID=1 (prod brake)", () => {
    const v = evaluateSeedGuard({ ...ALLOW, E2E_SEED_FORBID: "1" }, 0);
    assert.equal(v.allowed, false);
    assert.match(v.reason, /E2E_SEED_FORBID/);
  });

  it("refuses when the DB has more than the threshold of real workspaces", () => {
    const v = evaluateSeedGuard(ALLOW, 999);
    assert.equal(v.allowed, false);
    assert.match(v.reason, /looks like production/);
  });

  it("honors a raised threshold via env", () => {
    const v = evaluateSeedGuard(
      { ...ALLOW, E2E_SEED_MAX_EXISTING_WORKSPACES: "2000" },
      999,
    );
    assert.equal(v.allowed, true);
  });

  it("allows on a small dev/preview DB with opt-in", () => {
    assert.equal(evaluateSeedGuard(ALLOW, 3).allowed, true);
  });
});

describe("seedTestWorkspace — apply + idempotency", () => {
  it("refuses to run when the guard denies", async () => {
    const client = new FakeSeedClient();
    await assert.rejects(
      () => seedTestWorkspace({ client, env: {}, crypto: FAKE_CRYPTO }),
      /refused/,
    );
    // Nothing written.
    assert.equal(client.workspace.inserts, 0);
  });

  it("writes every table on first run", async () => {
    const client = new FakeSeedClient();
    client.setExistingWorkspaceCount(2);
    const res = await seedTestWorkspace({
      client,
      env: ALLOW,
      crypto: FAKE_CRYPTO,
      key: "apply",
    });
    assert.equal(client.user.inserts, 1);
    assert.equal(client.workspace.inserts, 1);
    assert.equal(client.membership.inserts, 1);
    assert.equal(client.onboardingState.inserts, 1);
    assert.equal(client.workspacePreference.inserts, 1);
    assert.equal(client.integrationCredential.inserts, 2);
    assert.equal(client.workApprovalQueueItem.inserts, 3);
    assert.equal(client.workspaceBriefing.inserts, 1);
    assert.equal(res.slug, `${E2E_SLUG_PREFIX}apply`);
  });

  it("is idempotent — a second run inserts nothing new", async () => {
    const client = new FakeSeedClient();
    client.setExistingWorkspaceCount(2);
    await seedTestWorkspace({ client, env: ALLOW, crypto: FAKE_CRYPTO, key: "idem" });
    const insertsAfterFirst = {
      ws: client.workspace.inserts,
      appr: client.workApprovalQueueItem.inserts,
    };
    await seedTestWorkspace({ client, env: ALLOW, crypto: FAKE_CRYPTO, key: "idem" });
    // Same identities → updates, not inserts.
    assert.equal(client.workspace.inserts, insertsAfterFirst.ws);
    assert.equal(client.workApprovalQueueItem.inserts, insertsAfterFirst.appr);
    assert.ok(client.workApprovalQueueItem.updates >= 3);
  });

  it("encrypts approval payloads + briefing body before writing", async () => {
    const client = new FakeSeedClient();
    client.setExistingWorkspaceCount(2);
    await seedTestWorkspace({ client, env: ALLOW, crypto: FAKE_CRYPTO, key: "enc" });
    // The fake crypto wraps values in `fake:` / `{enc:'fake:...'}`. Confirm no
    // approval row carries a raw plaintext marker at the top level.
    for (const row of client.workApprovalQueueItem.rows()) {
      const payload = row.payload as { enc?: string };
      assert.ok(payload && typeof payload.enc === "string", "payload not enveloped");
      assert.match(payload.enc, /^fake:/);
    }
    for (const row of client.workspaceBriefing.rows()) {
      assert.match(String(row.body), /^fake:/);
    }
  });
});

describe("teardownTestWorkspace", () => {
  it("deletes exactly the seeded workspace + user", async () => {
    const client = new FakeSeedClient();
    client.setExistingWorkspaceCount(2);
    await seedTestWorkspace({ client, env: ALLOW, crypto: FAKE_CRYPTO, key: "td" });
    await teardownTestWorkspace(client, { key: "td" });
    assert.equal(client.workspace.deleteManyCalls, 1);
    assert.equal(client.user.deleteManyCalls, 1);
    // The seeded workspace row is gone.
    assert.equal(client.workspace.store.size, 0);
    assert.equal(client.user.store.size, 0);
  });
});
