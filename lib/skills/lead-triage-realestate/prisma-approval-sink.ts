/**
 * lib/skills/lead-triage-realestate/prisma-approval-sink.ts
 *
 * Production sink for the wave-1 vertical router — persists one
 * `WorkApprovalQueueItem(kind=LEAD_TRIAGE, status=PENDING)` per
 * triaged lead. The skill itself stays Prisma-free; this thin wrapper
 * is the only place lead-triage output enters the customer-facing
 * approvals table.
 *
 * Per `project_no_outbound_architecture.md`: the sink RECORDS ONLY.
 * No mail send, no CRM write. The first-touch draft (when present) is
 * a DRAFT the operator reviews + sends from their own mailbox.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Each `record()`
 * call opens its own RLS-scoped transaction.
 *
 * Idempotency: `record()` skips the insert when a PENDING row for the
 * same (workspaceId, kind=LEAD_TRIAGE, refId=leadId) already exists.
 * This prevents duplicate cards on re-sweep — the hourly FUB/HubSpot/
 * Salesforce sweeps process the same leads each run until a watermark
 * advances, so without this guard every sweep would double-stage. The
 * guard uses a pre-flight SELECT inside the same RLS context; no new
 * schema migration required.
 *
 * RLS: writes go through `withRls({ userId: null, workspaceId,
 * isOperator: true })` — same operator-identity wrapper that the rest
 * of the email-loop sinks use. The vertical router runs from the cron
 * sweep, which has no session.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '../../disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { TriagedLead } from './types';

/** Agent slug attributed to lead-triage proposals in the approval queue.
 *  Matches the catalog `slug` in `lib/skills/registry.ts`. */
export const LEAD_TRIAGE_AGENT_SLUG = 'lead-triage-realestate';

/** Synthetic ref-table — the triaged lead lives in-memory; we use the
 *  lead id as the refId so the audit can correlate triage runs. */
export const LEAD_TRIAGE_REF_TABLE = 'LeadTriageProposal';

export interface LeadTriageSinkArgs {
  workspaceId: string;
  triaged: TriagedLead;
}

export interface LeadTriageApprovalSink {
  readonly name: string;
  record(args: LeadTriageSinkArgs): Promise<SkillResult<{ sinkId: string; skippedDuplicate?: boolean }>>;
}

export interface PrismaLeadTriageApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaLeadTriageApprovalSink implements LeadTriageApprovalSink {
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaLeadTriageApprovalSinkOptions = {},
  ) {}

  async record(
    args: LeadTriageSinkArgs,
  ): Promise<SkillResult<{ sinkId: string; skippedDuplicate?: boolean }>> {
    let row: Prisma.WorkApprovalQueueItemUncheckedCreateInput;
    try {
      row = buildLeadTriageApprovalRow(args.workspaceId, args.triaged);
    } catch (err) {
      // Most commonly this is the encryption envelope refusing to write
      // because ENCRYPTION_KEY is missing (test env without prisma) —
      // surface as a skill error so the router records "errored" but
      // doesn't crash the whole webhook drain.
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaLeadTriageApprovalSink failed to build approval row for lead ${args.triaged.leadId}: ${message}`,
      );
    }
    try {
      if (this.options.tx) {
        // In a caller-provided transaction we cannot open another nested
        // transaction for the dedup check — do the check in the same tx.
        const existing = await this.options.tx.workApprovalQueueItem.findFirst({
          where: {
            workspaceId: args.workspaceId,
            kind: 'LEAD_TRIAGE',
            refId: args.triaged.leadId,
            status: 'PENDING',
          },
          select: { id: true },
        });
        if (existing) return skillOk({ sinkId: existing.id, skippedDuplicate: true });
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
          // Idempotency guard: skip insert when a PENDING row for this lead
          // already exists. The hourly sweep can re-present the same lead
          // multiple times before the watermark advances — without this guard
          // each sweep would double-stage the same first-touch draft.
          const existing = await tx.workApprovalQueueItem.findFirst({
            where: {
              workspaceId: args.workspaceId,
              kind: 'LEAD_TRIAGE',
              refId: args.triaged.leadId,
              status: 'PENDING',
            },
            select: { id: true },
          });
          if (existing) return `skip:${existing.id}`;
          const created = await tx.workApprovalQueueItem.create({
            data: row,
            select: { id: true },
          });
          return created.id;
        },
        this.options.client ? { client: this.options.client } : undefined,
      );
      if (id.startsWith('skip:')) {
        return skillOk({ sinkId: id.slice('skip:'.length), skippedDuplicate: true });
      }
      return skillOk({ sinkId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaLeadTriageApprovalSink failed to persist lead ${args.triaged.leadId}: ${message}`,
      );
    }
  }
}

/** Exposed for tests so they can assert the payload shape without a
 *  Prisma instance. */
export function buildLeadTriageApprovalRow(
  workspaceId: string,
  triaged: TriagedLead,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: LEAD_TRIAGE_AGENT_SLUG,
    kind: 'LEAD_TRIAGE',
    refTable: LEAD_TRIAGE_REF_TABLE,
    refId: triaged.leadId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[LEAD_TRIAGE_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      leadId: triaged.leadId,
      leadName: triaged.leadName,
      scores: triaged.scores,
      category: triaged.category,
      routing: triaged.routing,
      firstTouchDraft: triaged.firstTouchDraft,
      draftSkippedReason: triaged.draftSkippedReason,
      noOutbound:
        "No email sent. Operator reviews the routing + first-touch draft; the broker's existing CRM / email path performs any send.",
    }),
  };
}
