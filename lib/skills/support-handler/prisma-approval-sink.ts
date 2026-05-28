/**
 * lib/skills/support-handler/prisma-approval-sink.ts
 *
 * Production impl of `ApprovalSink`. Persists a SupportDraftProposal
 * as one WorkApprovalQueueItem row (status=PENDING,
 * kind=SUPPORT_HANDLER_REPLY_DRAFT, discipline=customer-success,
 * refTable=SupportRequest, refId=<supportRequestId>) so the
 * discipline-grouped /approvals page renders it cleanly for operator
 * review.
 *
 * Per project_no_outbound_architecture.md: this sink RECORDS ONLY. It
 * does NOT send an email, persist a Gmail draft, or call any external
 * messaging service. Any "approve-to-send" step lives in a separate
 * operator-gated path that routes through the existing operator email
 * flow (the SUPPORT_EMAIL inbox the SupportRequest already notified).
 *
 * Per feedback_runner_portability.md two-implementation rule:
 * `RecordingApprovalSink` (test) + this (production) speak the same
 * port. Skills never see Prisma; they see ApprovalSink.
 *
 * Per feedback_cold_start_safe_agents.md: stateless. Each `record()`
 * call opens its own RLS transaction. Re-runs write fresh rows tagged
 * with a fresh proposalId — idempotency is enforced at the audit-log
 * level (refTable+refId pair), not at the sink.
 *
 * RLS: writes go through withRls({ userId: null, workspaceId,
 * isOperator: true }) — the same wrapper used by the chief-of-staff
 * sink. The cron / event-driven fire has no session, so an
 * operator-tier write context is the right grant.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '../../disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { ApprovalSink, SupportDraftProposal } from './types';

/** Agent slug attributed to support-handler proposals in the approval
 *  queue. Matches the catalog `slug` in `lib/skills/registry.ts`. */
export const SUPPORT_HANDLER_AGENT_SLUG = 'support-handler';

/** Ref-table name on the WorkApprovalQueueItem row. The proposal lives
 *  in-memory; the SOURCE row is the SupportRequest, which is the right
 *  target for the operator's "approve / edit / escalate" actions. */
export const SUPPORT_HANDLER_REF_TABLE = 'SupportRequest';

export interface PrismaApprovalSinkOptions {
  /** Override the default Prisma client. Tests pass a stub. */
  client?: PrismaClient;
  /** Bypass RLS wrapping and write directly. Used by tests that want
   *  to assert against a stub `tx.workApprovalQueueItem.create`. */
  tx?: Prisma.TransactionClient;
}

export class PrismaApprovalSink implements ApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: SupportDraftProposal;
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
        `PrismaApprovalSink failed to persist support-handler proposal ${args.proposal.proposalId}: ${message}`,
      );
    }
  }
}

/**
 * Map a SupportDraftProposal to a WorkApprovalQueueItem row. Exposed so
 * tests can assert the exact payload shape without a Prisma instance.
 */
export function buildApprovalRow(
  workspaceId: string,
  proposal: SupportDraftProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: SUPPORT_HANDLER_AGENT_SLUG,
    kind: 'SUPPORT_HANDLER_REPLY_DRAFT',
    refTable: SUPPORT_HANDLER_REF_TABLE,
    refId: proposal.supportRequestId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[SUPPORT_HANDLER_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite(buildPayload(proposal)),
  };
}

function buildPayload(proposal: SupportDraftProposal): Record<string, unknown> {
  return {
    proposalId: proposal.proposalId,
    supportRequestId: proposal.supportRequestId,
    kind: 'support-handler-reply-draft',
    subject: proposal.subject,
    body: proposal.body,
    confidence: proposal.confidence,
    suggestedAction: proposal.suggestedAction,
    reasoning: proposal.reasoning,
    citations: proposal.citations.map((c) => ({
      title: c.title,
      bodyExcerpt: c.bodyExcerpt,
      sourceUrl: c.sourceUrl,
      similarity: Number(c.similarity.toFixed(3)),
    })),
    noOutbound:
      "No email sent. Operator approves; the workspace's existing operator " +
      'email path performs the send.',
  };
}
