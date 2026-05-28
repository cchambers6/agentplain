/**
 * lib/skills/process-doc-drafter-general/prisma-approval-sink.ts
 *
 * Production `ProcessDocApprovalSink` — persists each
 * `ProcessDocProposal` as one `WorkApprovalQueueItem` (kind=
 * PROCESS_DOC_DRAFT, status=PENDING).
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only —
 * does not publish to Notion / Confluence / Drive / Google Docs. The
 * sink stores the drafted markdown body in the approval payload; the
 * operator copies it into their own SOP store once accurate.
 *
 * RLS + cold-start safety identical to the inbox-triage and
 * follow-up-chaser sinks.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { ProcessDocApprovalSink, ProcessDocProposal } from './types';

export const PROCESS_DOC_DRAFTER_AGENT_SLUG = 'process-doc-drafter-general';
export const PROCESS_DOC_DRAFTER_REF_TABLE = 'ProcessDocProposal';

export interface PrismaProcessDocApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaProcessDocApprovalSink implements ProcessDocApprovalSink {
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaProcessDocApprovalSinkOptions = {},
  ) {}

  async record(args: {
    workspaceId: string;
    proposal: ProcessDocProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildProcessDocApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaProcessDocApprovalSink failed to persist proposal ${args.proposal.proposalId}: ${message}`,
      );
    }
  }
}

export function buildProcessDocApprovalRow(
  workspaceId: string,
  proposal: ProcessDocProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: PROCESS_DOC_DRAFTER_AGENT_SLUG,
    kind: 'PROCESS_DOC_DRAFT',
    refTable: PROCESS_DOC_DRAFTER_REF_TABLE,
    refId: proposal.proposalId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[PROCESS_DOC_DRAFTER_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      patternKey: proposal.patternKey,
      title: proposal.title,
      body: proposal.body,
      occurrenceCount: proposal.occurrenceCount,
      lastObservedAt: proposal.lastObservedAt,
      sourceActionIds: proposal.sourceActionIds,
      confidence: proposal.confidence,
      reasoning: proposal.reasoning,
      noOutbound:
        'No SOP published. Operator approves the drafted markdown body and copies it into their own documentation system.',
    }),
  };
}
