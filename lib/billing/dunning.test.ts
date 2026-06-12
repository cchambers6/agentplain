/**
 * lib/billing/dunning.test.ts
 *
 * Pins the PAST_DUE dunning state machine: the per-subscription decision
 * (which email, when, when to hard-gate) and the sweep runner's routing.
 * No real Stripe / email / DB — all dependencies injected.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SubscriptionStatus } from "@prisma/client";

import {
  decideDunningAction,
  emitDunningAction,
  renderDunningEmail,
  runDunningSweep,
  type DunningCandidate,
  type DunningStage,
} from "./dunning";
import type { EmailProvider, SendEmailRequest } from "@/lib/email";
import type { SystemContextRunner } from "@/lib/billing/provisioning";

const DAY = 24 * 60 * 60 * 1000;
const FAILED_AT = new Date("2026-06-01T00:00:00.000Z");

function candidate(overrides: Partial<DunningCandidate> = {}): DunningCandidate {
  return {
    workspaceId: "ws-1",
    workspaceName: "Acme Brokerage",
    workspaceSlug: "acme",
    brokerOwnerEmail: "owner@example.com",
    subscriptionId: "sub-row-1",
    status: "PAST_DUE" as SubscriptionStatus,
    // paid-through well into the future → grace open by default
    currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
    firstFailedAt: FAILED_AT,
    stagesSent: [],
    amountUsdCents: 19900,
    ...overrides,
  };
}

const at = (days: number): Date => new Date(FAILED_AT.getTime() + days * DAY);

describe("decideDunningAction", () => {
  it("sends FAIL on day 0 when nothing has been sent", () => {
    const action = decideDunningAction(candidate(), at(0));
    assert.deepEqual(action, { kind: "send", stage: "FAIL" });
  });

  it("does not resend FAIL on day 1 once it's been sent (within grace)", () => {
    const action = decideDunningAction(
      candidate({ stagesSent: ["FAIL"] }),
      at(1),
    );
    assert.equal(action.kind, "noop");
  });

  it("sends D7 at day 7 when only FAIL was sent", () => {
    const action = decideDunningAction(
      candidate({ stagesSent: ["FAIL"] }),
      at(7),
    );
    assert.deepEqual(action, { kind: "send", stage: "D7" });
  });

  it("sends D14 at day 14 when FAIL+D7 were sent", () => {
    const action = decideDunningAction(
      candidate({ stagesSent: ["FAIL", "D7"] }),
      at(14),
    );
    assert.deepEqual(action, { kind: "send", stage: "D14" });
  });

  it("sends only the most-urgent reached email if the sweep missed days", () => {
    // Nothing sent yet but we're already at day 10 → jump straight to D7
    const action = decideDunningAction(candidate({ stagesSent: [] }), at(10));
    assert.deepEqual(action, { kind: "send", stage: "D7" });
  });

  it("hard-gates once grace is exhausted and all reached stages are covered", () => {
    const action = decideDunningAction(
      candidate({
        stagesSent: ["FAIL", "D7", "D14"],
        currentPeriodEnd: new Date("2026-06-10T00:00:00.000Z"),
      }),
      at(20), // past the 2026-06-10 period end
    );
    assert.deepEqual(action, { kind: "hard_gate" });
  });

  it("sends the email FIRST, then hard-gates on a later run", () => {
    // Grace exhausted AND D14 reached but not yet sent → email wins this run
    const sendRun = decideDunningAction(
      candidate({
        stagesSent: ["FAIL", "D7"],
        currentPeriodEnd: new Date("2026-06-10T00:00:00.000Z"),
      }),
      at(20),
    );
    assert.deepEqual(sendRun, { kind: "send", stage: "D14" });
  });

  it("stays in grace (noop) when emails are done but period hasn't ended", () => {
    const action = decideDunningAction(
      candidate({ stagesSent: ["FAIL", "D7", "D14"] }),
      at(20), // currentPeriodEnd is 2026-07-01, still future
    );
    assert.equal(action.kind, "noop");
  });

  it("treats a null period anchor as past-grace (fail-closed) once emails done", () => {
    const action = decideDunningAction(
      candidate({ stagesSent: ["FAIL", "D7", "D14"], currentPeriodEnd: null }),
      at(20),
    );
    assert.deepEqual(action, { kind: "hard_gate" });
  });

  it("noops when the subscription is no longer PAST_DUE", () => {
    const action = decideDunningAction(
      candidate({ status: "ACTIVE" as SubscriptionStatus }),
      at(20),
    );
    assert.equal(action.kind, "noop");
  });
});

// ─── Email rendering ────────────────────────────────────────────────────

describe("renderDunningEmail", () => {
  it("names the amount, workspace, and grace date and links billing", () => {
    const out = renderDunningEmail({
      candidate: candidate(),
      stage: "FAIL",
      billingUrl: "https://app.agentplain.com/app/workspace/ws-1/settings/billing",
    });
    assert.match(out.subject, /didn't go through/i);
    assert.match(out.text, /\$199/);
    assert.match(out.text, /Acme Brokerage/);
    assert.match(out.text, /keeps running through/i);
    assert.match(out.html, /settings\/billing/);
  });

  it("uses a softer grace line when there's no period anchor", () => {
    const out = renderDunningEmail({
      candidate: candidate({ currentPeriodEnd: null }),
      stage: "D14",
      billingUrl: "https://x/billing",
    });
    assert.match(out.text, /keeps running for now/i);
  });
});

// ─── Sweep runner ────────────────────────────────────────────────────────

interface SentEmail {
  req: SendEmailRequest;
}

function recordingEmail(): { provider: EmailProvider; sent: SentEmail[] } {
  const sent: SentEmail[] = [];
  const provider: EmailProvider = {
    providerName: "test-recording",
    async send(req) {
      sent.push({ req });
      return { messageId: "msg-test" };
    },
  };
  return { provider, sent };
}

/** A systemContext stub that records subscription.update + auditLog.create
 *  calls so we can assert hard-gate + audit writes without a DB. */
function recordingContext(): {
  context: SystemContextRunner;
  updates: Array<{ id: string; data: Record<string, unknown> }>;
  audits: Array<{ action: string; payload: unknown }>;
} {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const audits: Array<{ action: string; payload: unknown }> = [];
  const context: SystemContextRunner = async <T>(
    fn: (tx: never) => Promise<T>,
  ): Promise<T> => {
    const tx = {
      subscription: {
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: args.where.id, data: args.data });
          return {};
        },
      },
      auditLog: {
        create: async (args: { data: { action: string; payload: unknown } }) => {
          audits.push({ action: args.data.action, payload: args.data.payload });
          return {};
        },
      },
    } as unknown as never;
    return fn(tx);
  };
  return { context, updates, audits };
}

describe("emitDunningAction", () => {
  it("sends the email and records a dunning_email_sent audit on `send`", async () => {
    const { provider, sent } = recordingEmail();
    const { context, audits } = recordingContext();
    await emitDunningAction(
      candidate(),
      { kind: "send", stage: "FAIL" },
      { email: provider, systemContext: context, appOrigin: "https://app.agentplain.com" },
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].req.to, "owner@example.com");
    assert.equal(sent[0].req.tags?.stage, "FAIL");
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "billing.dunning_email_sent");
  });

  it("flips the subscription to PAUSED and audits on `hard_gate`", async () => {
    const { provider, sent } = recordingEmail();
    const { context, updates, audits } = recordingContext();
    await emitDunningAction(
      candidate({ currentPeriodEnd: new Date("2026-06-10T00:00:00.000Z") }),
      { kind: "hard_gate" },
      { email: provider, systemContext: context },
    );
    assert.equal(sent.length, 0); // no email on hard-gate
    assert.equal(updates.length, 1);
    assert.equal(updates[0].id, "sub-row-1");
    assert.equal(updates[0].data.status, "PAUSED");
    assert.equal(audits[0].action, "billing.subscription.suspended_past_due");
  });
});

describe("runDunningSweep", () => {
  it("routes each candidate through decide+emit and tallies the result", async () => {
    const { provider, sent } = recordingEmail();
    const { context } = recordingContext();
    const candidates: DunningCandidate[] = [
      candidate({ subscriptionId: "a", stagesSent: [] }), // → send FAIL
      candidate({
        subscriptionId: "b",
        stagesSent: ["FAIL", "D7", "D14"],
        currentPeriodEnd: new Date("2026-06-10T00:00:00.000Z"),
      }), // → hard_gate (past grace)
      candidate({
        subscriptionId: "c",
        stagesSent: ["FAIL", "D7", "D14"],
      }), // → noop (still in grace)
    ];

    const result = await runDunningSweep({
      now: at(20),
      email: provider,
      systemContext: context,
      appOrigin: "https://app.agentplain.com",
      findCandidates: async () => candidates,
    });

    assert.equal(result.candidates, 3);
    assert.equal(result.emailsSent, 1);
    assert.equal(result.hardGated, 1);
    assert.equal(result.noops, 1);
    assert.equal(sent.length, 1);
  });

  it("isolates a per-candidate failure via onItemError without aborting", async () => {
    const failing: EmailProvider = {
      providerName: "boom",
      async send() {
        throw new Error("resend down");
      },
    };
    const { context } = recordingContext();
    const errors: string[] = [];
    const result = await runDunningSweep({
      now: at(0),
      email: failing,
      systemContext: context,
      findCandidates: async () => [candidate({ subscriptionId: "a" })],
      onItemError: (c) => errors.push(c.subscriptionId),
    });
    assert.equal(result.candidates, 1);
    assert.equal(result.emailsSent, 0);
    assert.deepEqual(errors, ["a"]);
  });
});
