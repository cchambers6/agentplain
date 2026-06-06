/**
 * tests/operator-support-actions.test.ts
 *
 * Unit-tests the operator-side support-reply resolution core
 * (lib/support/resolve-reply.ts) with recording fakes for the store,
 * email provider, and event sink — the two-implementation seam means we
 * exercise the exact production code path without Prisma / Inngest / Resend.
 *
 * Pins the contract the /operator/support page depends on:
 *   - APPROVE sends exactly one email to the customer, records RESOLVED
 *     with the operator stamp, and fires the resolved analytics event.
 *   - The operator's edited body overrides the stored draft body.
 *   - A non-PENDING draft is never re-sent (idempotent on double-fire).
 *   - A request with no recipient is never sent to.
 *   - A send failure leaves the request UN-resolved (no recordResolved).
 *   - REJECT never sends an email and records the rejection.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  approveAndSendSupportReply,
  rejectSupportReply,
  type SupportReplyDraftContext,
  type SupportReplyStore,
  type SupportResolvedEventSink,
  type SupportRequestResolvedEventData,
} from "@/lib/support/resolve-reply";
import { TestEmailProvider } from "@/lib/email/test-provider";
import type { EmailProvider, SendEmailRequest } from "@/lib/email/types";

const QUEUE_ID = "queue-item-1";
const REQUEST_ID = "support-req-1";
const WORKSPACE_ID = "ws-0001";
const OPERATOR_ID = "operator-0001";

function baseContext(
  overrides: Partial<SupportReplyDraftContext> = {},
): SupportReplyDraftContext {
  return {
    queueItemId: QUEUE_ID,
    queueItemStatus: "PENDING",
    workspaceId: WORKSPACE_ID,
    supportRequestId: REQUEST_ID,
    supportRequestStatus: "IN_REVIEW",
    customerEmail: "broker@acme.example",
    subject: "Re: How do I disconnect a Gmail account?",
    draftBody: "Hi Jamie,\n\nOpen Settings → Integrations and click Disconnect.\n\n— Plaino",
    confidence: "high",
    citationCount: 1,
    ...overrides,
  };
}

class RecordingStore implements SupportReplyStore {
  readonly name = "recording" as const;
  resolvedCalls: Array<Parameters<SupportReplyStore["recordResolved"]>[0]> = [];
  rejectedCalls: Array<Parameters<SupportReplyStore["recordRejected"]>[0]> = [];
  /** Force recordResolved to throw, to exercise the PERSIST_FAILED branch. */
  failResolve = false;

  constructor(private context: SupportReplyDraftContext | null) {}

  async loadDraftContext(): Promise<SupportReplyDraftContext | null> {
    return this.context;
  }
  async recordResolved(
    args: Parameters<SupportReplyStore["recordResolved"]>[0],
  ): Promise<void> {
    if (this.failResolve) throw new Error("db down");
    this.resolvedCalls.push(args);
  }
  async recordRejected(
    args: Parameters<SupportReplyStore["recordRejected"]>[0],
  ): Promise<void> {
    this.rejectedCalls.push(args);
  }
}

class RecordingEventSink implements SupportResolvedEventSink {
  readonly name = "recording" as const;
  emitted: SupportRequestResolvedEventData[] = [];
  async emitResolved(data: SupportRequestResolvedEventData): Promise<void> {
    this.emitted.push(data);
  }
}

class ThrowingEmailProvider implements EmailProvider {
  readonly providerName = "throwing";
  async send(): Promise<never> {
    throw new Error("resend 500");
  }
}

describe("approveAndSendSupportReply — happy path", () => {
  let store: RecordingStore;
  let email: TestEmailProvider;
  let events: RecordingEventSink;

  beforeEach(() => {
    store = new RecordingStore(baseContext());
    email = new TestEmailProvider();
    events = new RecordingEventSink();
  });

  it("sends one email to the customer, records RESOLVED, and emits the event", async () => {
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      replyTo: "hello@agentplain.com",
      store,
      email,
      events,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.sentTo, "broker@acme.example");

    // Exactly one email, to the customer, with the draft body.
    assert.equal(email.sent.length, 1);
    const sent: SendEmailRequest = email.sent[0];
    assert.equal(sent.to, "broker@acme.example");
    assert.equal(sent.replyTo, "hello@agentplain.com");
    assert.match(sent.subject, /disconnect a Gmail account/);
    assert.match(sent.text, /Settings → Integrations/);
    assert.match(sent.html, /<p/); // rendered to HTML
    assert.equal(sent.tags?.surface, "support-reply");

    // Resolution recorded with the operator stamp.
    assert.equal(store.resolvedCalls.length, 1);
    assert.equal(store.resolvedCalls[0].operatorUserId, OPERATOR_ID);
    assert.equal(store.resolvedCalls[0].supportRequestId, REQUEST_ID);
    assert.equal(store.resolvedCalls[0].emailMessageId, "email_test_1");

    // Analytics event fired with the right shape.
    assert.equal(events.emitted.length, 1);
    assert.deepEqual(events.emitted[0], {
      supportRequestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
      resolvedByUserId: OPERATOR_ID,
    });
  });

  it("sends the operator's edited body, not the stored draft", async () => {
    const edited = "Hi Jamie — quick update, here's the exact path…";
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      editedBody: edited,
      store,
      email,
      events,
    });
    assert.equal(res.ok, true);
    assert.equal(email.sent[0].text, edited);
    assert.equal(store.resolvedCalls[0].sentBody, edited);
  });

  it("falls back to the stored draft when the edited body is blank", async () => {
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      editedBody: "   ",
      store,
      email,
      events,
    });
    assert.equal(res.ok, true);
    assert.match(email.sent[0].text, /Settings → Integrations/);
  });
});

describe("approveAndSendSupportReply — guardrails", () => {
  it("never re-sends an already-decided draft", async () => {
    const store = new RecordingStore(baseContext({ queueItemStatus: "APPROVED" }));
    const email = new TestEmailProvider();
    const events = new RecordingEventSink();
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      store,
      email,
      events,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "ALREADY_DECIDED");
    assert.equal(email.sent.length, 0);
    assert.equal(store.resolvedCalls.length, 0);
  });

  it("blocks send when the request has no recipient", async () => {
    const store = new RecordingStore(baseContext({ customerEmail: null }));
    const email = new TestEmailProvider();
    const events = new RecordingEventSink();
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      store,
      email,
      events,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "NO_RECIPIENT");
    assert.equal(email.sent.length, 0);
    assert.equal(store.resolvedCalls.length, 0);
  });

  it("leaves the request un-resolved when the send fails", async () => {
    const store = new RecordingStore(baseContext());
    const events = new RecordingEventSink();
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      store,
      email: new ThrowingEmailProvider(),
      events,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "SEND_FAILED");
    assert.equal(store.resolvedCalls.length, 0); // NOT marked resolved
    assert.equal(events.emitted.length, 0);
  });

  it("surfaces PERSIST_FAILED when the reply sent but recording failed", async () => {
    const store = new RecordingStore(baseContext());
    store.failResolve = true;
    const email = new TestEmailProvider();
    const events = new RecordingEventSink();
    const res = await approveAndSendSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      store,
      email,
      events,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "PERSIST_FAILED");
    assert.equal(email.sent.length, 1); // the email DID go out
  });

  it("returns NOT_FOUND when the draft is missing", async () => {
    const store = new RecordingStore(null);
    const res = await approveAndSendSupportReply({
      queueItemId: "missing",
      operatorUserId: OPERATOR_ID,
      store,
      email: new TestEmailProvider(),
      events: new RecordingEventSink(),
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "NOT_FOUND");
  });
});

describe("rejectSupportReply", () => {
  it("records the rejection and never sends an email", async () => {
    const store = new RecordingStore(baseContext());
    const res = await rejectSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      reason: "billing dispute — needs a human",
      store,
    });
    assert.equal(res.ok, true);
    assert.equal(store.rejectedCalls.length, 1);
    assert.equal(store.rejectedCalls[0].reason, "billing dispute — needs a human");
    assert.equal(store.resolvedCalls.length, 0);
  });

  it("refuses to re-decide an already-decided draft", async () => {
    const store = new RecordingStore(baseContext({ queueItemStatus: "REJECTED" }));
    const res = await rejectSupportReply({
      queueItemId: QUEUE_ID,
      operatorUserId: OPERATOR_ID,
      store,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "ALREADY_DECIDED");
    assert.equal(store.rejectedCalls.length, 0);
  });
});
