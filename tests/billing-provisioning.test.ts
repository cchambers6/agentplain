// Verifies the signup-time provisioning path: TestBillingProvider
// records a customer + a trialing subscription, and the helper persists
// them under the injected RLS context. The provisioning helper accepts
// an explicit `systemContext` so tests run against a fake-tx without
// needing Postgres.

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { TestBillingProvider, __setBillingProviderForTests } from "@/lib/billing";
import {
  provisionTrialSubscription,
  subscriptionStatusFromProvider,
  type SystemContextRunner,
} from "@/lib/billing/provisioning";
import { TRIAL_PERIOD_DAYS } from "@/lib/pricing/tiers";

interface PersistedSubscription {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: string;
  seatBand: string;
  status: string;
  seats: number;
}

interface PersistedWorkspaceUpdate {
  id: string;
  data: Record<string, unknown>;
}

interface PersistedAudit {
  workspaceId: string;
  action: string;
  payload?: unknown;
}

interface FakeTx {
  subscription: {
    create: (args: { data: PersistedSubscription }) => Promise<void>;
  };
  workspace: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  auditLog: {
    create: (args: { data: PersistedAudit }) => Promise<void>;
  };
}

const recorded = {
  subscriptions: [] as PersistedSubscription[],
  workspaceUpdates: [] as PersistedWorkspaceUpdate[],
  audits: [] as PersistedAudit[],
};

const buildFakeTx = (): FakeTx => ({
  subscription: {
    create: async ({ data }) => {
      recorded.subscriptions.push(data);
    },
  },
  workspace: {
    update: async ({ where, data }) => {
      recorded.workspaceUpdates.push({ id: where.id, data });
    },
  },
  auditLog: {
    create: async ({ data }) => {
      recorded.audits.push(data);
    },
  },
});

const fakeSystemContext: SystemContextRunner = async (fn) => {
  const fake = buildFakeTx();
  return fn(fake as unknown as Parameters<typeof fn>[0]);
};

describe("provisionTrialSubscription — signup-time path", () => {
  beforeEach(() => {
    recorded.subscriptions.length = 0;
    recorded.workspaceUpdates.length = 0;
    recorded.audits.length = 0;
  });

  afterEach(() => {
    __setBillingProviderForTests(null);
  });

  it("creates a Customer + trialing Subscription and persists both", async () => {
    const provider = new TestBillingProvider();
    const result = await provisionTrialSubscription({
      workspaceId: "ws_1",
      workspaceName: "Acme Realty",
      email: "owner@acme.test",
      verticalTier: "REGULAR",
      provider,
      systemContext: fakeSystemContext,
    });

    assert.equal(provider.customers.length, 1);
    assert.equal(provider.customers[0].workspaceId, "ws_1");
    assert.equal(provider.subscriptions.size, 1);

    assert.equal(recorded.subscriptions.length, 1);
    assert.equal(recorded.subscriptions[0].workspaceId, "ws_1");
    assert.equal(recorded.subscriptions[0].status, "TRIALING");
    assert.equal(recorded.subscriptions[0].tier, "REGULAR");
    assert.equal(recorded.subscriptions[0].seatBand, "SEATS_1");

    assert.equal(recorded.workspaceUpdates.length, 1);
    assert.equal(
      recorded.workspaceUpdates[0].data.billingMode,
      "STRIPE_SUBSCRIPTION",
    );
    assert.equal(
      recorded.workspaceUpdates[0].data.stripeSubscriptionId,
      result.providerSubscriptionId,
    );

    assert.equal(recorded.audits.length, 1);
    assert.equal(
      recorded.audits[0].action,
      "billing.trial_subscription_provisioned",
    );
    assert.equal(
      (recorded.audits[0].payload as { trialPeriodDays: number }).trialPeriodDays,
      TRIAL_PERIOD_DAYS,
    );
  });

  it("maps each verticalTier to the right pricing tier", async () => {
    const provider = new TestBillingProvider();
    await provisionTrialSubscription({
      workspaceId: "ws_max",
      workspaceName: "BigLaw",
      email: "owner@biglaw.test",
      verticalTier: "MAX",
      provider,
      systemContext: fakeSystemContext,
    });
    assert.equal(recorded.subscriptions[0].tier, "MAX");
  });
});

describe("subscriptionStatusFromProvider — mapping table", () => {
  it("maps trialing → TRIALING", () => {
    assert.equal(subscriptionStatusFromProvider("trialing"), "TRIALING");
  });
  it("maps past_due → PAST_DUE", () => {
    assert.equal(subscriptionStatusFromProvider("past_due"), "PAST_DUE");
  });
  it("maps incomplete_expired → INCOMPLETE_EXPIRED", () => {
    assert.equal(
      subscriptionStatusFromProvider("incomplete_expired"),
      "INCOMPLETE_EXPIRED",
    );
  });
  // Wave-2 CC-at-trial: Stripe emits status="paused" when a trial ends
  // with no payment method on a subscription configured with
  // trial_settings.end_behavior.missing_payment_method="pause". Pre-
  // wave-2 the dispatcher's STATUS_MAP returned undefined and the
  // upsert threw — Stripe retried for 72h, all failed, customer kept
  // using the fleet for free. Mapping is one-to-one to the new
  // SubscriptionStatus.PAUSED enum value.
  it("maps paused → PAUSED (wave-2 CC-at-trial enum fix)", () => {
    assert.equal(subscriptionStatusFromProvider("paused"), "PAUSED");
  });
});
