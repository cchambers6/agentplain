/**
 * lib/skills/property-management-rent-collection-chase/prisma-approval-sink.ts
 *
 * Production `RentChaseApprovalSink` — persists each `TenantChaseDraft` as one
 * `WorkApprovalQueueItem` (kind=FOLLOW_UP_NUDGE, status=PENDING).
 *
 * Pattern: mirrors `lib/skills/home-services-estimate-followup/
 * prisma-approval-sink.ts` exactly. Same no-outbound contract, same RLS
 * pattern, same cold-start safety.
 *
 * Value-impact payload: `outstandingBalanceUsd` is embedded in the encrypted
 * payload so the PM console can display "you have $X,XXX in unpaid rent" and
 * the value ledger can surface at-risk revenue per chase. When the PM approves
 * a FOLLOW_UP_NUDGE item, `computeWorkspaceValueLedger` credits the labour
 * saved; `outstandingBalanceUsd` supplements that with the rent at stake.
 *
 * No schema change: `outstandingBalanceUsd` lives inside the encrypted
 * `payload` JSON blob — zero new columns or migrations. Reuses the existing
 * FOLLOW_UP_NUDGE enum value (no new WorkApprovalKind).
 *
 * Per `project_no_outbound_architecture.md`: RECORDS ONLY.
 * Per `feedback_cold_start_safe_agents.md`: stateless — every call constructs
 * fresh Prisma context via `withRls`.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { RentChaseApproval, RentChaseApprovalSink, TenantChaseDraft } from './types';

export const RENT_COLLECTION_CHASE_AGENT_SLUG =
  'property-management-rent-collection-chase';
export const RENT_COLLECTION_CHASE_REF_TABLE = 'RentCollectionChaseDraft';

export interface PrismaRentChaseApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaRentChaseApprovalSink implements RentChaseApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaRentChaseApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    approval: RentChaseApproval;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildRentChaseApprovalRow(args.workspaceId, args.approval.draft);
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
        `PrismaRentChaseApprovalSink failed to persist draft ${args.approval.draft.draftId}: ${message}`,
      );
    }
  }
}

export function buildRentChaseApprovalRow(
  workspaceId: string,
  draft: TenantChaseDraft,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: RENT_COLLECTION_CHASE_AGENT_SLUG,
    kind: 'FOLLOW_UP_NUDGE',
    refTable: RENT_COLLECTION_CHASE_REF_TABLE,
    refId: draft.draftId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[RENT_COLLECTION_CHASE_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      draftId: draft.draftId,
      leaseId: draft.leaseId,
      /** At-risk rent at the time the chase was drafted. A $4,200 unpaid
       *  balance is $4,200 the owner is out until it's collected. The PM
       *  console surfaces this so the owner understands the stakes before
       *  approving/skipping the chase. Never rendered in the body. */
      outstandingBalanceUsd: draft.outstandingBalanceUsd,
      bucket: draft.bucket,
      daysPastDue: draft.daysPastDue,
      toEmails: draft.toEmails,
      ccEmails: draft.ccEmails,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
      noOutbound:
        "No chase sent. The PM approves and the customer's own mailbox performs the send.",
    }),
  };
}
