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
import { recordSavedTime } from '../../guarantee/saved-time';
import { notifyApprovalQueued, type NotifyApprovalInput } from '../../push';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { TriagedLead } from './types';

/** Agent slug attributed to lead-triage proposals in the approval queue.
 *  Matches the catalog `slug` in `lib/skills/registry.ts`. */
export const LEAD_TRIAGE_AGENT_SLUG = 'lead-triage-realestate';

/** Synthetic ref-table — the triaged lead lives in-memory; we use the
 *  lead id as the refId so the audit can correlate triage runs. Also the
 *  saved-time ledger's sourceTable: together with the lead id (which
 *  carries the FUB person id, e.g. `fub-12345`) it is the idempotency
 *  key, so a webhook replay or re-sweep never double-counts minutes. */
export const LEAD_TRIAGE_REF_TABLE = 'LeadTriageProposal';

/** The sink is real-estate-specific — the calibration table resolves
 *  minutes per vertical through this slug. */
export const LEAD_TRIAGE_VERTICAL_SLUG = 'real-estate';

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
  /**
   * Approval-ready notifier (pilot dry-run 2026-07-11, P0-1 — this sink
   * never notified, so the after-hours "a reply is drafted and waiting"
   * promise was structurally undeliverable on the CRM path). Defaults to
   * `notifyApprovalQueued` on the committed (withRls) path. On the
   * caller-supplied-tx path the DEFAULT stays silent — the transaction
   * has not committed, and announcing uncommitted work could race a
   * rollback (same reasoning as persist-artifacts). Inject explicitly to
   * notify there or to record calls in tests; pass null to disable (the
   * demo seed does — a seed run must not email the demo owner).
   */
  notify?: ((input: NotifyApprovalInput) => Promise<unknown>) | null;
  /**
   * Saved-time ledger crediting (pilot dry-run 2026-07-11, P0-3 — the
   * production lead-triage path wrote ZERO ledger rows; only the inbox
   * chain and the demo seed's hand-credits did). Default true: each NEW
   * approval row credits `lead-enrichment`, plus `drafted-email` when a
   * first-touch draft exists — exactly what the demo seed credits by
   * hand. The seed passes false and keeps its hand-credits (it backdates
   * `occurredAt` across the demo week, which the sink cannot).
   */
  creditSavedTime?: boolean;
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
        // Same-tx saved-time credit so tests (and any future tx caller)
        // see the ledger rows land atomically with the approval row.
        await this.creditSavedTime(args, this.options.tx);
        // Default notify stays silent here — the caller's tx has not
        // committed. An injected notifier (tests) still fires.
        if (this.options.notify) {
          await Promise.resolve(
            this.options.notify({ workspaceId: args.workspaceId, count: 1 }),
          ).catch(() => undefined);
        }
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
      // The write has committed. Post-commit side effects, both
      // best-effort — a credit or notification failure must never
      // surface as a sink error for work that already landed:
      //   1. Saved-time ledger credit (P0-3) — idempotent via the
      //      (workspace, sourceTable, sourceId, actionType) unique key.
      //   2. Approval-ready notification (P0-1) — email + push, so the
      //      partner hears "a reply is drafted and waiting" without
      //      Conner bridging the gap by hand.
      await this.creditSavedTime(args).catch(() => undefined);
      const notify =
        this.options.notify === undefined
          ? notifyApprovalQueued
          : this.options.notify;
      if (notify) {
        await Promise.resolve(
          notify({ workspaceId: args.workspaceId, count: 1 }),
        ).catch(() => undefined);
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

  /**
   * Credit the trial-guarantee ledger for one NEWLY-staged lead: the
   * enrichment work always, the first-touch draft when one exists —
   * mirroring what the demo seed credits by hand (pilot dry-run
   * 2026-07-11, P0-3). The lead id (`fub-<personId>` on the FUB path) is
   * the dedupe source, so a webhook replay or hourly re-sweep never
   * double-counts. Skipped for duplicate approval rows (the credit
   * already happened when the row first landed) and when the caller
   * opted out via `creditSavedTime: false`.
   */
  private async creditSavedTime(
    args: LeadTriageSinkArgs,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (this.options.creditSavedTime === false) return;
    const source = {
      table: LEAD_TRIAGE_REF_TABLE,
      id: args.triaged.leadId,
    };
    const credit = async () => {
      await recordSavedTime({
        workspaceId: args.workspaceId,
        actionType: 'lead-enrichment',
        verticalSlug: LEAD_TRIAGE_VERTICAL_SLUG,
        source,
        client: tx,
      });
      if (args.triaged.firstTouchDraft) {
        await recordSavedTime({
          workspaceId: args.workspaceId,
          actionType: 'drafted-email',
          verticalSlug: LEAD_TRIAGE_VERTICAL_SLUG,
          source,
          client: tx,
        });
      }
    };
    if (tx) {
      // In-tx path: let a failure propagate to the caller's transaction —
      // the caller owns commit semantics.
      await credit();
      return;
    }
    await credit();
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
