/**
 * lib/skills/chief-of-staff-scheduler/prisma-approval-sink.ts
 *
 * Production implementation of `ApprovalSink`. Persists each
 * `ChiefOfStaffProposal` the skill emits as one `WorkApprovalQueueItem`
 * row (status=PENDING) so the customer's `/approvals` page lists it for
 * human review.
 *
 * Per `project_no_outbound_architecture.md`: this sink RECORDS ONLY. It
 * does NOT book a calendar event, send an email, persist a Gmail draft,
 * call Twilio / SendGrid, or write into a third-party task system. The
 * `ApprovalSink` interface itself has no `execute` / `book` / `send`
 * method — a deliberate contract choice. Any "execute approved" step
 * lives in a separate, human-gated path.
 *
 * Per `feedback_runner_portability.md` two-implementation rule:
 * `RecordingApprovalSink` (in `./approval-sink.ts`) is the test impl;
 * this is the production impl. Both speak the same port.
 *
 * Per `feedback_cold_start_safe_agents.md`: the sink is stateless. Each
 * `record()` call opens its own RLS transaction and writes one row.
 * Re-running the skill is idempotent at the proposal-id level — the
 * skill rolls a fresh `proposalId` per run, so retries write new rows
 * rather than duplicating; the `refTable=ChiefOfStaffProposal` + `refId=
 * proposalId` pair is the audit handle.
 *
 * RLS: writes go through `withRls({ userId: null, workspaceId,
 * isOperator: true })` — the same operator-identity wrapper that
 * `persistSkillRunArtifacts` uses for webhook-driven writes. Provides
 * tenant isolation without requiring a session.
 */

import type { Prisma, PrismaClient, WorkApprovalKind } from '@prisma/client';
import { withRls } from '../../db/rls';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ApprovalSink,
  ChiefOfStaffProposal,
  MeetingProposal,
  ReplyDraftProposal,
  TodoProposal,
} from './types';

/** Agent slug attributed to chief-of-staff proposals in the approval
 *  queue. Matches the catalog `slug` in `lib/skills/registry.ts`. The
 *  `/agents` page groups by agentSlug; using one stable slug keeps the
 *  card resolution honest. */
export const CHIEF_OF_STAFF_AGENT_SLUG = 'chief-of-staff-scheduler';

/** Synthetic ref-table name for chief-of-staff proposals. The proposal
 *  does not live in another Prisma model — it's emitted in-memory by the
 *  skill — so we name the synthetic table here and use the proposal's
 *  own UUID as the `refId`. */
export const CHIEF_OF_STAFF_REF_TABLE = 'ChiefOfStaffProposal';

export interface PrismaApprovalSinkOptions {
  /** Override the default Prisma client (defaults to the singleton in
   *  lib/db/prisma.ts). Tests pass a stub here. */
  client?: PrismaClient;
  /** Override the transaction client directly — used by tests that want
   *  to assert against a stub `tx.workApprovalQueueItem.create` without
   *  going through `$transaction`. When set, the sink bypasses RLS
   *  wrapping and writes to `tx` directly. */
  tx?: Prisma.TransactionClient;
}

export class PrismaApprovalSink implements ApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: ChiefOfStaffProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildApprovalRow(args.workspaceId, args.proposal);
    try {
      if (this.options.tx) {
        const created = await this.options.tx.workApprovalQueueItem.create({
          data: row,
          select: { id: true },
        });
        return skillOk({ sinkId: created.id });
      }
      const ctx = {
        userId: null,
        workspaceId: args.workspaceId,
        isOperator: true,
      } as const;
      const id = await withRls(
        ctx,
        async (tx) => {
          const created = await tx.workApprovalQueueItem.create({
            data: row,
            select: { id: true },
          });
          return created.id;
        },
        this.options.client ? { client: this.options.client } : undefined,
      );
      return skillOk({ sinkId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaApprovalSink failed to persist proposal ${args.proposal.proposalId}: ${message}`,
      );
    }
  }
}

/**
 * Map a `ChiefOfStaffProposal` to a `WorkApprovalQueueItem` row. Exposed
 * for tests so they can assert the exact payload shape without standing
 * up a Prisma instance.
 */
export function buildApprovalRow(
  workspaceId: string,
  proposal: ChiefOfStaffProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: CHIEF_OF_STAFF_AGENT_SLUG,
    kind: kindFor(proposal),
    refTable: CHIEF_OF_STAFF_REF_TABLE,
    refId: proposal.proposalId,
    status: 'PENDING',
    payload: buildPayload(proposal) as Prisma.InputJsonValue,
  };
}

function kindFor(proposal: ChiefOfStaffProposal): WorkApprovalKind {
  switch (proposal.kind) {
    case 'meeting':
      return 'CHIEF_OF_STAFF_MEETING';
    case 'reply-draft':
      return 'CHIEF_OF_STAFF_REPLY_DRAFT';
    case 'todo':
      return 'CHIEF_OF_STAFF_TODO';
  }
}

/**
 * Render a payload shape the approvals UI's `renderApprovalPayload` can
 * consume. We preserve the full proposal under `proposal` so the audit
 * log shows what the skill emitted verbatim, plus surface the well-known
 * fields the renderer pulls out at the top level (subject, body,
 * confidence, etc.).
 */
function buildPayload(
  proposal: ChiefOfStaffProposal,
): Record<string, unknown> {
  switch (proposal.kind) {
    case 'meeting':
      return buildMeetingPayload(proposal);
    case 'reply-draft':
      return buildReplyDraftPayload(proposal);
    case 'todo':
      return buildTodoPayload(proposal);
  }
}

function buildMeetingPayload(p: MeetingProposal): Record<string, unknown> {
  return {
    proposalId: p.proposalId,
    kind: p.kind,
    subject: p.subject,
    inviteBody: p.inviteBody,
    confidence: p.confidence,
    reasoning: p.reasoning,
    attendees: p.attendees,
    candidateSlots: p.candidateSlots.map((s) => ({
      day: s.dayOfWeek,
      startLocal: s.startLocal,
      endLocal: s.endLocal,
      rationale: s.rationale,
    })),
    sourceMessageId: p.sourceMessageId,
    sourceThreadId: p.sourceThreadId,
    noOutbound: 'No calendar event booked. Operator confirms a slot; the customer\'s own calendar performs the booking.',
  };
}

function buildReplyDraftPayload(
  p: ReplyDraftProposal,
): Record<string, unknown> {
  return {
    proposalId: p.proposalId,
    kind: p.kind,
    subject: p.subject,
    body: p.body,
    tone: p.tone,
    confidence: p.confidence,
    reasoning: p.reasoning,
    toEmails: p.toEmails,
    sourceMessageId: p.sourceMessageId,
    sourceThreadId: p.sourceThreadId,
    persisted: false,
    noOutbound: 'No email sent. Operator approves; the customer\'s own mailbox performs the send.',
  };
}

function buildTodoPayload(p: TodoProposal): Record<string, unknown> {
  return {
    proposalId: p.proposalId,
    kind: p.kind,
    title: p.title,
    contextText: p.contextText,
    suggestedDueLocal: p.suggestedDueLocal,
    confidence: p.confidence,
    reasoning: p.reasoning,
    sourceMessageId: p.sourceMessageId,
    sourceThreadId: p.sourceThreadId,
    noOutbound: 'No to-do written to a third-party task system. Operator approves; the customer\'s own board performs the write.',
  };
}
