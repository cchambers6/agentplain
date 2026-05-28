/**
 * lib/skills/follow-up-chaser-general/prisma-approval-sink.ts
 *
 * Production `FollowUpApprovalSink` — persists each `FollowUpProposal`
 * as one `WorkApprovalQueueItem` (kind=FOLLOW_UP_NUDGE, status=PENDING).
 *
 * Same shape as `lib/skills/chief-of-staff-scheduler/prisma-approval-
 * sink.ts`. Per `project_no_outbound_architecture.md`: RECORDS ONLY.
 * No mail send — the nudge body is a DRAFT.
 *
 * RLS + cold-start safety: identical pattern to the inbox-triage and
 * chief-of-staff sinks.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { FollowUpApprovalSink, FollowUpProposal } from './types';

export const FOLLOW_UP_CHASER_AGENT_SLUG = 'follow-up-chaser-general';
export const FOLLOW_UP_CHASER_REF_TABLE = 'FollowUpNudgeProposal';

export interface PrismaFollowUpApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaFollowUpApprovalSink implements FollowUpApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaFollowUpApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: FollowUpProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildFollowUpApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaFollowUpApprovalSink failed to persist proposal ${args.proposal.proposalId}: ${message}`,
      );
    }
  }
}

export function buildFollowUpApprovalRow(
  workspaceId: string,
  proposal: FollowUpProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: FOLLOW_UP_CHASER_AGENT_SLUG,
    kind: 'FOLLOW_UP_NUDGE',
    refTable: FOLLOW_UP_CHASER_REF_TABLE,
    refId: proposal.proposalId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[FOLLOW_UP_CHASER_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      sourceThreadId: proposal.sourceThreadId,
      ageDays: proposal.ageDays,
      stage: proposal.stage,
      toEmails: proposal.toEmails,
      subject: proposal.subject,
      body: proposal.body,
      confidence: proposal.confidence,
      reasoning: proposal.reasoning,
      noOutbound:
        'No nudge sent. Operator approves and the customer\'s own mailbox performs the send.',
    }),
  };
}
