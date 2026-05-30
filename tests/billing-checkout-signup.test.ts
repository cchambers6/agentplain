// Wave-2 CC-at-trial signup-time Checkout helper.
//
// Covers `lib/billing/checkout.ts#createTrialCheckoutForSignup`:
//   1. Creates a Stripe Customer on the BillingProvider (records the
//      workspace + signup-flow metadata).
//   2. Persists `Workspace.stripeCustomerId` + audit log entry in the
//      same system-context tx so the inbound webhook can resolve the
//      workspace by stripeCustomerId before subscription.created races
//      ahead of checkout.session.completed.
//   3. Opens a subscription-mode Checkout session with
//      `trial_period_days=30`, `payment_method_collection="always"`, and
//      `client_reference_id=workspaceId`.
//   4. Returns the Stripe-hosted Checkout URL.
//
// Per `feedback_runner_portability.md` rule of two: we exercise the
// helper against `TestBillingProvider` here; `tests/billing-stripe-
// provider.test.ts` covers the Stripe-shape translation on the live
// adapter so the two layers don't drift.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { TestBillingProvider } from "@/lib/billing";
import { createTrialCheckoutForSignup } from "@/lib/billing/checkout";
import { TRIAL_PERIOD_DAYS } from "@/lib/pricing/tiers";
import type { SystemContextRunner } from "@/lib/billing/provisioning";

interface RecordedWorkspaceUpdate {
  id: string;
  data: Record<string, unknown>;
}
interface RecordedAudit {
  workspaceId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
}

interface FakeTx {
  workspace: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  auditLog: {
    create: (args: { data: RecordedAudit }) => Promise<void>;
  };
}

const recorded = {
  workspaceUpdates: [] as RecordedWorkspaceUpdate[],
  audits: [] as RecordedAudit[],
};

const buildFakeTx = (): FakeTx => ({
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

describe("createTrialCheckoutForSignup — wave-2 CC-at-trial happy path", () => {
  beforeEach(() => {
    recorded.workspaceUpdates.length = 0;
    recorded.audits.length = 0;
  });

  it("creates customer, persists stripeCustomerId, opens Checkout with trial + ref + always-collect-card", async () => {
    const provider = new TestBillingProvider();
    const result = await createTrialCheckoutForSignup({
      workspaceId: "ws_signup_1",
      workspaceName: "Acme Realty",
      email: "owner@acme.test",
      tier: "regular",
      appOrigin: "https://app.test",
      provider,
      systemContext: fakeSystemContext,
    });

    // 1. Customer created with workspace metadata
    assert.equal(provider.customers.length, 1);
    assert.equal(provider.customers[0].workspaceId, "ws_signup_1");
    assert.equal(
      provider.customers[0].metadata?.agentplain_signup_flow,
      "checkout_at_signup",
    );

    // 2. Workspace.stripeCustomerId persisted BEFORE the Checkout session
    //    opens — so the inbound subscription.created webhook can resolve
    //    the workspace even if it races ahead of checkout.session.completed.
    const wsUpdate = recorded.workspaceUpdates[0];
    assert.equal(wsUpdate.id, "ws_signup_1");
    assert.equal(wsUpdate.data.stripeCustomerId, result.providerCustomerId);
    assert.equal(wsUpdate.data.billingMode, "STRIPE_SUBSCRIPTION");

    // 3. Checkout session with trial + payment_method_collection +
    //    client_reference_id pointed at the workspace
    assert.equal(provider.checkoutSessions.length, 1);
    const session = provider.checkoutSessions[0];
    assert.equal(session.mode, "subscription");
    assert.equal(session.tier, "regular");
    assert.equal(session.seats, 1);
    assert.equal(session.seatBand, "SEATS_1");
    assert.equal(session.trialPeriodDays, TRIAL_PERIOD_DAYS);
    assert.equal(session.paymentMethodCollection, "always");
    assert.equal(session.clientReferenceId, "ws_signup_1");
    assert.equal(
      session.metadata?.agentplain_workspace_id,
      "ws_signup_1",
    );

    // 4. Return shape — caller uses checkoutUrl + sessionId
    assert.ok(result.checkoutUrl.startsWith("https://"));
    assert.equal(result.sessionId, session.id);

    // 5. Audit trail — customer-created + checkout-session-created rows
    const actions = recorded.audits.map((a) => a.action);
    assert.ok(actions.includes("billing.signup_customer_created"));
    assert.ok(actions.includes("billing.signup_checkout_session_created"));
  });

  it("threads success_url + cancel_url through to Checkout (Stripe placeholder + workspace echo)", async () => {
    const provider = new TestBillingProvider();
    await createTrialCheckoutForSignup({
      workspaceId: "ws_42",
      workspaceName: "BigLaw",
      email: "owner@biglaw.test",
      tier: "plus",
      appOrigin: "https://app.test/",
      provider,
      systemContext: fakeSystemContext,
    });

    const session = provider.checkoutSessions[0];
    // success_url includes Stripe's {CHECKOUT_SESSION_ID} placeholder
    // so the success page can read the session id on landing.
    assert.ok(
      session.successUrl.includes("{CHECKOUT_SESSION_ID}"),
      "success_url must carry Stripe's session-id placeholder",
    );
    assert.ok(session.successUrl.includes("workspace=ws_42"));
    assert.ok(session.cancelUrl.includes("cancelled=1"));
    assert.ok(session.cancelUrl.includes("workspace=ws_42"));
  });

  it("supports non-regular tiers (plus → uses plus pricing line)", async () => {
    const provider = new TestBillingProvider();
    await createTrialCheckoutForSignup({
      workspaceId: "ws_plus",
      workspaceName: "Plus Brokerage",
      email: "owner@plus.test",
      tier: "plus",
      appOrigin: "https://app.test",
      provider,
      systemContext: fakeSystemContext,
    });
    const session = provider.checkoutSessions[0];
    assert.equal(session.tier, "plus");
  });
});

describe("createTrialCheckoutForSignup — Stripe outage propagation", () => {
  it("propagates a customer-create failure so the signup action can degrade", async () => {
    const provider = new TestBillingProvider();
    const original = provider.createCustomer.bind(provider);
    provider.createCustomer = async () => {
      throw new Error("Stripe is down");
    };
    await assert.rejects(
      () =>
        createTrialCheckoutForSignup({
          workspaceId: "ws_outage",
          workspaceName: "Outage Inc",
          email: "owner@outage.test",
          tier: "regular",
          appOrigin: "https://app.test",
          provider,
          systemContext: fakeSystemContext,
        }),
      /Stripe is down/,
    );
    // Restore in case the suite reuses the provider; the test runner
    // doesn't depend on it but cleanup is cheap.
    provider.createCustomer = original;
  });
});
