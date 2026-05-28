/**
 * lib/skills/inbox-triage-general/prisma-approval-sink.ts
 *
 * Production `TriageApprovalSink` — persists each `TriageProposal` the
 * triage skill emits as one `WorkApprovalQueueItem` (kind=INBOX_TRIAGE,
 * status=PENDING) so the operator's `/approvals` page surfaces it.
 *
 * Same shape as `lib/skills/chief-of-staff-scheduler/prisma-approval-
 * sink.ts` — the skill itself stays Prisma-free; this thin wrapper is
 * the only place that writes the triage proposal into the customer-
 * facing approvals table.
 *
 * Per `project_no_outbound_architecture.md`: the sink RECORDS ONLY.
 * No mail send, no inbox label change. The `ackDraft` (when populated)
 * is a DRAFT for the operator to review + send from their own mailbox.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless; each call opens
 * its own RLS-scoped transaction.
 *
 * RLS: writes go through `withRls({ userId: null, workspaceId,
 * isOperator: true })` — same operator-identity wrapper that
 * `persistSkillRunArtifacts` + `chief-of-staff-scheduler` use.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { TriageApprovalSink, TriageProposal } from './types';

/** Agent slug attributed to inbox-triage proposals in the approval
 *  queue. Matches the catalog `slug` in `lib/skills/registry.ts`. */
export const INBOX_TRIAGE_AGENT_SLUG = 'inbox-triage-general';

/** Synthetic ref-table name — the proposal lives in-memory; we use the
 *  proposalId as the refId so the audit can correlate runs. */
export const INBOX_TRIAGE_REF_TABLE = 'InboxTriageProposal';

export interface PrismaTriageApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaTriageApprovalSink implements TriageApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaTriageApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: TriageProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildTriageApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaTriageApprovalSink failed to persist proposal ${args.proposal.proposalId}: ${message}`,
      );
    }
  }
}

/** Exposed for tests. */
export function buildTriageApprovalRow(
  workspaceId: string,
  proposal: TriageProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: INBOX_TRIAGE_AGENT_SLUG,
    kind: 'INBOX_TRIAGE',
    refTable: INBOX_TRIAGE_REF_TABLE,
    refId: proposal.proposalId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[INBOX_TRIAGE_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      priority: proposal.priority,
      confidence: proposal.confidence,
      reasoning: proposal.reasoning,
      sourceMessageId: proposal.sourceMessageId,
      sourceThreadId: proposal.sourceThreadId,
      ackDraft: proposal.ackDraft,
      noOutbound:
        'No reply sent, no inbox label changed. Operator approves the drafted ack (when one was generated) and the customer\'s own mailbox performs the send.',
    }),
  };
}
