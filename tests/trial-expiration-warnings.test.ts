// Verifies the trial-expiration cron logic:
//   * findTrialWarningCandidates respects 7/3/1 thresholds.
//   * lastTrialWarningDays prevents double-fire for the same or larger threshold.
//   * emitTrialWarning routes through the EmailProvider seam.
//
// The cron helpers take explicit `systemContext` + `email` injections so
// the test runs without a database or Resend account.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { TestEmailProvider } from "@/lib/email";
import type { SystemContextRunner } from "@/lib/billing/provisioning";
import {
  emitTrialWarning,
  findTrialWarningCandidates,
} from "@/lib/inngest/functions/trial-expiration-warnings";

interface FakeSubRow {
  id: string;
  tier: "REGULAR" | "PLUS" | "MAX";
  seats: number;
  status: "TRIALING" | "ACTIVE";
  trialEndsAt: Date | null;
  lastTrialWarningDays: number | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    memberships: { user: { email: string } }[];
  };
}

const state: {
  subs: FakeSubRow[];
  audits: { action: string; workspaceId: string }[];
  updates: { id: string; lastTrialWarningDays?: number }[];
} = {
  subs: [],
  audits: [],
  updates: [],
};

const buildFakeTx = () => ({
  subscription: {
    findMany: async (_args: unknown) => state.subs,
    update: async ({ where, data }: {
      where: { id: string };
      data: { lastTrialWarningDays?: number };
    }) => {
      state.updates.push({ id: where.id, ...data });
      const row = state.subs.find((s) => s.id === where.id);
      if (row && typeof data.lastTrialWarningDays === "number") {
        row.lastTrialWarningDays = data.lastTrialWarningDays;
      }
    },
  },
  auditLog: {
    create: async ({ data }: { data: { action: string; workspaceId: string } }) => {
      state.audits.push(data);
    },
  },
});

const fakeSystemContext: SystemContextRunner = async (fn) =>
  fn(buildFakeTx() as unknown as Parameters<typeof fn>[0]);

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

describe("trial-expiration-warnings — candidate selection", () => {
  beforeEach(() => {
    state.subs = [
      {
        id: "sub-row-1",
        tier: "REGULAR",
        seats: 1,
        status: "TRIALING",
        trialEndsAt: daysFromNow(2.4), // ⇒ ceil to 3-day bucket
        lastTrialWarningDays: 7,
        workspace: {
          id: "ws_1",
          name: "Acme",
          slug: "acme",
          memberships: [{ user: { email: "owner@acme.test" } }],
        },
      },
      {
        id: "sub-row-2",
        tier: "PLUS",
        seats: 5,
        status: "TRIALING",
        trialEndsAt: daysFromNow(10), // outside all thresholds
        lastTrialWarningDays: null,
        workspace: {
          id: "ws_2",
          name: "BigPlumb",
          slug: "bigplumb",
          memberships: [{ user: { email: "owner@bp.test" } }],
        },
      },
      {
        id: "sub-row-3",
        tier: "MAX",
        seats: 30,
        status: "TRIALING",
        trialEndsAt: daysFromNow(0.4), // ⇒ ceil to 1-day bucket
        lastTrialWarningDays: 3,
        workspace: {
          id: "ws_3",
          name: "BigLaw",
          slug: "biglaw",
          memberships: [{ user: { email: "owner@biglaw.test" } }],
        },
      },
      {
        id: "sub-row-4",
        tier: "REGULAR",
        seats: 1,
        status: "TRIALING",
        trialEndsAt: daysFromNow(2.5),
        lastTrialWarningDays: 3, // already warned at this threshold
        workspace: {
          id: "ws_4",
          name: "AlreadyWarned",
          slug: "aw",
          memberships: [{ user: { email: "aw@x.test" } }],
        },
      },
    ];
    state.audits = [];
    state.updates = [];
  });

  it("picks subscriptions inside a threshold whose last warning is larger", async () => {
    const cands = await findTrialWarningCandidates(
      new Date(),
      fakeSystemContext,
    );
    const ids = cands.map((c) => c.subscriptionId).sort();
    // Expected: sub-row-1 (3-day threshold > last 7), sub-row-3 (1-day > last 3).
    // Skipped: sub-row-2 (outside thresholds), sub-row-4 (already warned at 3).
    assert.deepEqual(ids, ["sub-row-1", "sub-row-3"]);
  });

  it("threshold is the smallest threshold the row is inside", async () => {
    const cands = await findTrialWarningCandidates(
      new Date(),
      fakeSystemContext,
    );
    const sub1 = cands.find((c) => c.subscriptionId === "sub-row-1");
    const sub3 = cands.find((c) => c.subscriptionId === "sub-row-3");
    assert.equal(sub1?.threshold, 3);
    assert.equal(sub3?.threshold, 1);
  });

  it("emitTrialWarning sends through the email provider and bumps lastTrialWarningDays", async () => {
    const email = new TestEmailProvider();
    const cands = await findTrialWarningCandidates(
      new Date(),
      fakeSystemContext,
    );
    for (const c of cands) {
      await emitTrialWarning(c, "https://app.test", {
        email,
        systemContext: fakeSystemContext,
      });
    }
    assert.equal(email.sent.length, 2);
    assert.ok(email.sent.every((m) => m.subject.includes("trial ends")));
    assert.ok(email.sent[0].html.includes("/settings/billing"));
    assert.equal(state.audits.length, 2);
    assert.ok(
      state.audits.every((a) => a.action === "billing.trial_warning_sent"),
    );
    assert.equal(state.updates.length, 2);
  });
});
