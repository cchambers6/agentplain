/**
 * tests/support-draft-into-review.test.ts
 *
 * Integration acceptance for the support draft-into-review loop, per
 * feedback_integration_acceptance_is_functional: the bar is a real walk
 * of the value loop, not a sync-diff subtest. This test walks:
 *
 *   1. A customer's support request runs through the support-handler skill
 *      against a seeded knowledge substrate → a grounded, cited draft is
 *      produced and LANDS in the approval queue (the recording sink stands
 *      in for the WorkApprovalQueueItem write).
 *   2. The operator opens that draft and APPROVES it → the reply is SENT
 *      to the customer (test email provider), the request is recorded
 *      RESOLVED, and the resolved analytics event fires.
 *
 * The whole loop runs through the production code paths with the vendor
 * seams (LLM / substrate / approval sink / email / events) swapped for
 * recording fakes — no Prisma, Inngest, Anthropic, or Resend. The fleet
 * drafts; the operator's approval is the ONLY thing that sends.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runSkill } from "@/lib/skills/support-handler/skill";
import { RecordingApprovalSink } from "@/lib/skills/support-handler/approval-sink";
import { RecordingKnowledgeSubstrate } from "@/lib/skills/support-handler/knowledge-substrate";
import type {
  SupportContextSnippet,
  SupportRequestSnapshot,
} from "@/lib/skills/support-handler/types";
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from "@/lib/llm/types";
import { llmOk } from "@/lib/llm/types";

import {
  approveAndSendSupportReply,
  type SupportReplyDraftContext,
  type SupportReplyStore,
  type SupportResolvedEventSink,
  type SupportRequestResolvedEventData,
} from "@/lib/support/resolve-reply";
import { TestEmailProvider } from "@/lib/email/test-provider";

const WORKSPACE_ID = "ws-loop-0001";
const REQUEST_ID = "support-req-loop-1";
const OPERATOR_ID = "operator-loop-1";
const CUSTOMER_EMAIL = "broker@acme.example";

class StubLlm implements LlmProvider {
  readonly name = "test" as const;
  readonly calls: LlmCompletionRequest[] = [];
  constructor(private readonly response: string) {}
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    return llmOk({
      text: this.response,
      stopReason: "end_turn",
      usage: { inputTokens: 100, outputTokens: 50 },
      model: "test-stub",
    });
  }
}

const DRAFT_JSON = JSON.stringify({
  subject: "Re: How do I disconnect a Gmail account?",
  body: [
    "Hi Jamie,",
    "",
    'Open Settings → Integrations, find the connected mailbox row, and click "Disconnect." Your AMS data is stored separately and is not affected.',
    "",
    "— Plaino",
    "   agentplain · your service partner",
  ].join("\n"),
  citedTitles: ["Integrations: disconnecting an email account"],
  reasoning: "Workspace doc directly answers the disconnect question.",
});

function makeRequest(): SupportRequestSnapshot {
  return {
    id: REQUEST_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "Acme Brokerage",
    verticalSlug: "real-estate",
    fromEmail: CUSTOMER_EMAIL,
    fromName: "Jamie Broker",
    subject: "How do I disconnect a Gmail account?",
    body: "I connected the wrong Gmail mailbox and need to disconnect it without losing my AMS data.",
    partnerName: "Plaino",
    receivedAt: new Date("2026-06-03T12:00:00.000Z"),
  };
}

function snippet(): SupportContextSnippet {
  return {
    title: "Integrations: disconnecting an email account",
    bodyExcerpt:
      'To disconnect a Gmail or Microsoft 365 account, open Settings → Integrations and click "Disconnect." Your AMS data is stored separately.',
    sourceUrl: "https://docs.agentplain.example/integrations/disconnect",
    similarity: 0.82,
  };
}

/** Stand-in for PrismaSupportReplyStore: seeded from the queued draft, it
 *  returns the same context the production store would read back from the
 *  persisted WorkApprovalQueueItem + SupportRequest rows. */
class LoopStore implements SupportReplyStore {
  readonly name = "loop" as const;
  resolved: Array<Parameters<SupportReplyStore["recordResolved"]>[0]> = [];
  rejected: Array<Parameters<SupportReplyStore["recordRejected"]>[0]> = [];
  constructor(private context: SupportReplyDraftContext) {}
  async loadDraftContext(): Promise<SupportReplyDraftContext | null> {
    return this.context;
  }
  async recordResolved(
    args: Parameters<SupportReplyStore["recordResolved"]>[0],
  ): Promise<void> {
    this.resolved.push(args);
    this.context = { ...this.context, queueItemStatus: "APPROVED" };
  }
  async recordRejected(
    args: Parameters<SupportReplyStore["recordRejected"]>[0],
  ): Promise<void> {
    this.rejected.push(args);
  }
}

class LoopEventSink implements SupportResolvedEventSink {
  readonly name = "loop" as const;
  emitted: SupportRequestResolvedEventData[] = [];
  async emitResolved(d: SupportRequestResolvedEventData): Promise<void> {
    this.emitted.push(d);
  }
}

describe("support draft-into-review — full loop", () => {
  it("drafts into the queue, then the operator's approval sends the reply", async () => {
    // ── 1. Fleet drafts. ────────────────────────────────────────────
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet()],
    });
    const llm = new StubLlm(DRAFT_JSON);

    const drafted = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
    });

    assert.equal(drafted.ok, true);
    if (!drafted.ok) return;
    // The draft landed in the approval queue — nothing sent yet.
    assert.equal(sink.calls.length, 1);
    const proposal = sink.calls[0].proposal;
    assert.equal(proposal.confidence, "high");
    assert.equal(proposal.citations.length, 1);

    // ── 2. Operator reviews + approves → reply sends. ────────────────
    const store = new LoopStore({
      queueItemId: sink.calls[0].sinkId,
      queueItemStatus: "PENDING",
      workspaceId: WORKSPACE_ID,
      supportRequestId: proposal.supportRequestId,
      supportRequestStatus: "IN_REVIEW",
      customerEmail: CUSTOMER_EMAIL,
      subject: proposal.subject,
      draftBody: proposal.body,
      confidence: proposal.confidence,
      citationCount: proposal.citations.length,
    });
    const email = new TestEmailProvider();
    const events = new LoopEventSink();

    const approved = await approveAndSendSupportReply({
      queueItemId: sink.calls[0].sinkId,
      operatorUserId: OPERATOR_ID,
      replyTo: "hello@agentplain.com",
      store,
      email,
      events,
    });

    assert.equal(approved.ok, true);
    if (!approved.ok) return;

    // The reply went to the customer, carrying the drafted answer.
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0].to, CUSTOMER_EMAIL);
    assert.match(email.sent[0].text, /Settings → Integrations/);
    assert.match(email.sent[0].subject, /disconnect a Gmail account/);

    // The request was recorded RESOLVED by this operator + the event fired.
    assert.equal(store.resolved.length, 1);
    assert.equal(store.resolved[0].operatorUserId, OPERATOR_ID);
    assert.equal(events.emitted.length, 1);
    assert.equal(events.emitted[0].supportRequestId, proposal.supportRequestId);

    // ── 3. Idempotency: a double-approve does not re-send. ───────────
    const again = await approveAndSendSupportReply({
      queueItemId: sink.calls[0].sinkId,
      operatorUserId: OPERATOR_ID,
      store,
      email,
      events,
    });
    assert.equal(again.ok, false);
    assert.equal(email.sent.length, 1); // still one — no re-send
  });
});
