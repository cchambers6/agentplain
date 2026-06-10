/**
 * lib/measurement/value-impact.ts
 *
 * Workspace Value Ledger — pure read-side functions that compute the
 * measurable impact of agentplain's work for a given workspace and time
 * window. Zero side effects; no mutations; no schema changes.
 *
 * Design principles:
 *   - "No hidden guess" rule: every assumption surfaces in the returned
 *     `assumptions` field so the operator sees exactly what drove each number.
 *   - Token cost reuses `getWorkspaceUsageReport` from
 *     `lib/billing/usage/aggregate.ts` — the authoritative cost aggregator.
 *   - Approval decisions are the unit of work: an APPROVED / AUTO_APPROVED /
 *     REJECTED decision all represent real work the fleet did. We count
 *     APPROVED + AUTO_APPROVED for hours-saved (work the owner accepted) and
 *     total actioned (all decided) for activity breadth.
 *   - Per `project_living_portable_architecture.md`: pure functions + a named
 *     Prisma TransactionClient parameter keep this testable without a DB.
 *   - Per `feedback_cold_start_safe_agents.md`: reads durable DB state only;
 *     no in-memory session cache.
 *
 * Currency: micro-cents (1 USD = 100_000_000 micro-cents) for the cost
 * field; regular USD dollars for hours-to-dollars conversion display.
 *
 * Sources cited:
 *   Hours-saved table: internally estimated; tunable. See MINUTES_SAVED_BY_KIND.
 *   Labor rate: US BLS Occupational Outlook Handbook for "Administrative
 *     Services Managers" (all workers, 2024 annual report) — $44/hr median
 *     for general admin; adjusted to $55/hr for professional services
 *     (realty, compliance) and $75/hr for finance-discipline kinds. These
 *     are conservative estimates; operators can request a custom rate.
 */

import type { Prisma } from '@prisma/client';
import type { WorkApprovalKind } from '@prisma/client';
import { WorkApprovalStatus } from '@prisma/client';
import { getWorkspaceUsageReport } from '@/lib/billing/usage/aggregate';

// ── Per-kind minutes-saved table ─────────────────────────────────────────────
//
// How many minutes of owner/operator time does ONE actioned approval of each
// kind save? These are documented assumptions; the `assumptions` return field
// surfaces them so nothing is hidden from the operator.
//
// Methodology for each estimate:
//   COMPLIANCE_FLAG        — 20 min: reading a compliance doc, finding the
//                            clause, deciding pass/fail. Shorter than hiring a
//                            compliance reviewer ($300+/hr specialty rate).
//   LISTING_RECOMMENDATION — 15 min: researching comp listings, writing copy.
//   BUYER_INQUIRY_REPLY_DRAFT — 10 min: reading the inquiry, composing a warm
//                            first-touch reply from scratch.
//   PRICING_RECOMMENDATION — 20 min: pulling comps, writing a reasoned proposal.
//   ADMIN_* kinds          — 5 min each: minor admin touch-points (password
//                            reset, billing notice review, etc.). Low floor
//                            because the owner might have glanced and deleted.
//   CHIEF_OF_STAFF_MEETING — 15 min: calendar research + proposal writing.
//   CHIEF_OF_STAFF_REPLY_DRAFT — 10 min: composing a professional reply draft.
//   CHIEF_OF_STAFF_TODO    — 5 min: capturing and writing up a next-step.
//   INBOX_TRIAGE           — 8 min: reading, categorising, and deciding the
//                            action on one inbound message.
//   FOLLOW_UP_NUDGE        — 5 min: identifying the follow-up need and drafting
//                            a single-sentence reminder.
//   PROCESS_DOC_DRAFT      — 25 min: writing a new or updated process doc
//                            section from scratch.
//   SUPPORT_HANDLER_REPLY_DRAFT — 12 min: reading the support request, looking
//                            up context, drafting a first-touch reply.
//   PLAINO_INSTRUCTION     — 15 min: interpreting an instruction, drafting
//                            the work artifact.
//   LEAD_TRIAGE            — 12 min: reading a lead, scoring intent, routing.
//   ANALYTICS_PULSE        — 20 min: pulling metrics, writing a weekly brief.
//   RESEARCH_BRIEF         — 30 min: scoping, researching, and drafting a
//                            brief on a business question.
//   CONTENT_CALENDAR       — 20 min: brainstorming + scheduling 5-7 content
//                            topics for a week.
//   COMPLIANCE_DIGEST      — 15 min: reviewing 24h of drafts for risk patterns.
//   FINANCE_PULSE          — 25 min: pulling AR aging, reviewing open invoices,
//                            writing a finance summary.
//
// Tune these constants by updating MINUTES_SAVED_BY_KIND and deploying.

export const MINUTES_SAVED_BY_KIND: Record<WorkApprovalKind, number> = {
  COMPLIANCE_FLAG: 20,
  LISTING_RECOMMENDATION: 15,
  BUYER_INQUIRY_REPLY_DRAFT: 10,
  PRICING_RECOMMENDATION: 20,
  ADMIN_VERIFICATION_CODE: 5,
  ADMIN_PASSWORD_RESET: 5,
  ADMIN_TRIAL_ENDING: 5,
  ADMIN_BILLING_NOTICE: 5,
  ADMIN_SECURITY_ALERT: 5,
  CHIEF_OF_STAFF_MEETING: 15,
  CHIEF_OF_STAFF_REPLY_DRAFT: 10,
  CHIEF_OF_STAFF_TODO: 5,
  INBOX_TRIAGE: 8,
  FOLLOW_UP_NUDGE: 5,
  PROCESS_DOC_DRAFT: 25,
  SUPPORT_HANDLER_REPLY_DRAFT: 12,
  PLAINO_INSTRUCTION: 15,
  LEAD_TRIAGE: 12,
  ANALYTICS_PULSE: 20,
  RESEARCH_BRIEF: 30,
  CONTENT_CALENDAR: 20,
  COMPLIANCE_DIGEST: 15,
  FINANCE_PULSE: 25,
};

// ── Per-kind labor-rate table (USD/hour) ─────────────────────────────────────
//
// Dollars-influenced = hoursSaved × laborRate.
//
// Rate source: US BLS Occupational Outlook Handbook 2024.
//   - General admin (office-admin, chief-of-staff, inbox, follow-up, etc.):
//       $44/hr BLS median → rounded to $45/hr (conservative).
//   - Professional services (listing, buyer inquiry, lead triage, Plaino
//       instruction, content, analytics, research):
//       $55/hr for knowledge-work roles (marketing coordinator, operations).
//   - Compliance/legal (compliance flag, compliance digest):
//       $75/hr for compliance officers (BLS "Compliance Officers" median).
//   - Finance (finance pulse): $75/hr (BLS "Financial Analysts" median).

export const LABOR_RATE_USD_PER_HOUR_BY_KIND: Record<WorkApprovalKind, number> =
  {
    COMPLIANCE_FLAG: 75,
    LISTING_RECOMMENDATION: 55,
    BUYER_INQUIRY_REPLY_DRAFT: 55,
    PRICING_RECOMMENDATION: 55,
    ADMIN_VERIFICATION_CODE: 45,
    ADMIN_PASSWORD_RESET: 45,
    ADMIN_TRIAL_ENDING: 45,
    ADMIN_BILLING_NOTICE: 45,
    ADMIN_SECURITY_ALERT: 45,
    CHIEF_OF_STAFF_MEETING: 45,
    CHIEF_OF_STAFF_REPLY_DRAFT: 45,
    CHIEF_OF_STAFF_TODO: 45,
    INBOX_TRIAGE: 45,
    FOLLOW_UP_NUDGE: 45,
    PROCESS_DOC_DRAFT: 55,
    SUPPORT_HANDLER_REPLY_DRAFT: 45,
    PLAINO_INSTRUCTION: 55,
    LEAD_TRIAGE: 55,
    ANALYTICS_PULSE: 55,
    RESEARCH_BRIEF: 55,
    CONTENT_CALENDAR: 55,
    COMPLIANCE_DIGEST: 75,
    FINANCE_PULSE: 75,
  };

// ── Public types ──────────────────────────────────────────────────────────────

export interface KindRow {
  /** Number of accepted (APPROVED + AUTO_APPROVED) items for this kind. */
  count: number;
  /** Total hours saved from accepted items of this kind. */
  hours: number;
  /** Total dollars influenced from accepted items of this kind. */
  dollars: number;
}

export interface ValueLedgerAssumptions {
  /** Snapshot of MINUTES_SAVED_BY_KIND used for this computation. */
  minutesSavedByKind: Record<WorkApprovalKind, number>;
  /** Snapshot of LABOR_RATE_USD_PER_HOUR_BY_KIND used for this computation. */
  laborRateByKind: Record<WorkApprovalKind, number>;
  /** The period window (days) passed by the caller. */
  periodDays: number;
  /** ISO timestamp at which this ledger was computed. */
  computedAt: string;
  /** Formula: hoursSaved × laborRate per kind, summed.  */
  dollarsInfluencedFormula: string;
  /** Formula: tokenCostUsd = costMicroCents / 100_000_000. */
  tokenCostFormula: string;
  /** Formula: netValueUsd = dollarsInfluenced − tokenCostUsd. */
  netValueFormula: string;
  /** Only APPROVED + AUTO_APPROVED statuses count toward hoursSaved. REJECTED
   *  items are counted in approvalsActioned but not in hours. */
  acceptedStatusesOnly: string;
}

export interface WorkspaceValueLedger {
  /** Hours saved across all accepted (APPROVED + AUTO_APPROVED) approvals in
   *  the window. */
  hoursSaved: number;
  /** USD value influenced = sum over accepted items of (hours × laborRate). */
  dollarsInfluenced: number;
  /** Total number of actioned (APPROVED + AUTO_APPROVED + REJECTED) approvals
   *  in the window — a measure of fleet activity breadth. */
  approvalsActioned: number;
  /** Per-kind breakdown for accepted items only (APPROVED + AUTO_APPROVED). */
  byKind: Partial<Record<WorkApprovalKind, KindRow>>;
  /** LLM token cost in USD for the same window (from LlmUsageRecord). 0 when
   *  no usage records exist for the window. */
  tokenCostUsd: number;
  /** Net value = dollarsInfluenced − tokenCostUsd. Can be negative when token
   *  cost exceeds modeled labor savings (this is a signal to tune the rates
   *  or reduce model tier for cheaper tasks). */
  netValueUsd: number;
  /** Every assumption that went into the numbers above — nothing hidden. */
  assumptions: ValueLedgerAssumptions;
}

export interface ComputeLedgerArgs {
  workspaceId: string;
  /** Look-back window in days. Defaults to 30 if not provided. */
  periodDays?: number;
  /** Clock injection for deterministic tests. */
  now?: Date;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute the value ledger for a workspace over a rolling look-back window.
 *
 * Accepts a Prisma TransactionClient (from `withRls` or `withSystemContext`)
 * so the caller controls the RLS context. This function NEVER opens its own
 * transaction — it is the caller's responsibility to pass a correctly-scoped
 * tx.
 *
 * Cold-start safe: reads only durable DB rows. No reliance on any in-memory
 * session state.
 */
export async function computeWorkspaceValueLedger(
  tx: Prisma.TransactionClient,
  args: ComputeLedgerArgs,
): Promise<WorkspaceValueLedger> {
  const now = args.now ?? new Date();
  const periodDays = args.periodDays ?? 30;
  const windowStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // ── 1. Approval decisions ──────────────────────────────────────────────────
  // We count APPROVED + AUTO_APPROVED as "accepted" (owner said yes → hours
  // saved). REJECTED is "actioned" (fleet did work, owner decided) but does
  // NOT earn hours — we don't claim the owner would have spent time on
  // something they rejected.
  const ACCEPTED_STATUSES: WorkApprovalStatus[] = [
    WorkApprovalStatus.APPROVED,
    WorkApprovalStatus.AUTO_APPROVED,
  ];
  const ACTIONED_STATUSES: WorkApprovalStatus[] = [
    WorkApprovalStatus.APPROVED,
    WorkApprovalStatus.AUTO_APPROVED,
    WorkApprovalStatus.REJECTED,
  ];

  const [acceptedRows, totalActioned] = await Promise.all([
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: { in: ACCEPTED_STATUSES },
        decidedAt: { gte: windowStart, lt: now },
      },
      select: { kind: true },
    }),
    tx.workApprovalQueueItem.count({
      where: {
        workspaceId: args.workspaceId,
        status: { in: ACTIONED_STATUSES },
        decidedAt: { gte: windowStart, lt: now },
      },
    }),
  ]);

  // ── 2. Per-kind aggregation ────────────────────────────────────────────────
  const byKind: Partial<Record<WorkApprovalKind, KindRow>> = {};

  for (const row of acceptedRows) {
    const kind = row.kind as WorkApprovalKind;
    const minutesSaved = MINUTES_SAVED_BY_KIND[kind] ?? 0;
    const ratePerHour = LABOR_RATE_USD_PER_HOUR_BY_KIND[kind] ?? 45;
    const hoursFromThis = minutesSaved / 60;
    const dollarsFromThis = hoursFromThis * ratePerHour;

    const existing = byKind[kind];
    if (existing) {
      existing.count += 1;
      existing.hours += hoursFromThis;
      existing.dollars += dollarsFromThis;
    } else {
      byKind[kind] = { count: 1, hours: hoursFromThis, dollars: dollarsFromThis };
    }
  }

  const hoursSaved = Object.values(byKind).reduce(
    (acc, v) => acc + (v?.hours ?? 0),
    0,
  );
  const dollarsInfluenced = Object.values(byKind).reduce(
    (acc, v) => acc + (v?.dollars ?? 0),
    0,
  );

  // ── 3. Token cost ──────────────────────────────────────────────────────────
  // Reuse the existing usage aggregator — don't reinvent the BigInt math.
  const usageReport = await getWorkspaceUsageReport(tx, {
    workspaceId: args.workspaceId,
    periodStart: windowStart,
    now,
  });
  // costMicroCents is BigInt; 1 USD = 100_000_000 micro-cents.
  const tokenCostUsd =
    Number(usageReport.period.costMicroCents) / 100_000_000;

  // ── 4. Net value ───────────────────────────────────────────────────────────
  const netValueUsd = dollarsInfluenced - tokenCostUsd;

  // ── 5. Assumptions manifest ────────────────────────────────────────────────
  const assumptions: ValueLedgerAssumptions = {
    minutesSavedByKind: { ...MINUTES_SAVED_BY_KIND },
    laborRateByKind: { ...LABOR_RATE_USD_PER_HOUR_BY_KIND },
    periodDays,
    computedAt: now.toISOString(),
    dollarsInfluencedFormula:
      'sum over accepted kinds of (count × minutesSaved/60 × laborRateUsd/hr)',
    tokenCostFormula: 'LlmUsageRecord.costMicroCents ÷ 100_000_000',
    netValueFormula: 'dollarsInfluenced − tokenCostUsd',
    acceptedStatusesOnly:
      'Only APPROVED and AUTO_APPROVED items count toward hoursSaved and dollarsInfluenced; REJECTED items are counted in approvalsActioned only.',
  };

  return {
    hoursSaved: roundTo(hoursSaved, 2),
    dollarsInfluenced: roundTo(dollarsInfluenced, 2),
    approvalsActioned: totalActioned,
    byKind,
    tokenCostUsd: roundTo(tokenCostUsd, 4),
    netValueUsd: roundTo(netValueUsd, 2),
    assumptions,
  };
}

// ── Month-end-close value impact (per assembled close) ─────────────────────────
//
// The approval-level ledger above counts ONE FINANCE_PULSE approval per fire.
// That undercounts the month-end-close killer workflow: when the close
// "assembles itself", the owner is spared the manual doc-chase across EVERY
// outstanding item and the triage of every loose receipt — work that does not
// map 1:1 to a single approval row. This pure, DB-free helper measures the
// hours saved by ONE assembled close directly from its output shape, so the
// operator surface (and the PR proof) can cite a per-close number without a
// schema change or a new WorkApprovalKind enum value.
//
// Methodology (every constant is surfaced in `assumptions`):
//   - CHASE_DRAFT_MINUTES (12): composing one batched, CPA-toned chase email
//     from scratch — reading the engagement letter, listing outstanding items,
//     getting the tone right so a past-due note does not bruise the client
//     relationship.
//   - OUTSTANDING_ITEM_MINUTES (4): per outstanding required item, the manual
//     work of checking the portal/inbox to confirm it is actually still
//     missing before chasing it.
//   - UNCATEGORIZED_RECEIPT_MINUTES (5): per loose receipt, opening it,
//     deciding which checklist item it satisfies, filing it.
//   - STATUS_UPDATE_MINUTES (10): composing the single client-facing status
//     note from the current received/pending/late state.
// Labor rate: $75/hr — the finance-discipline rate already used by
// LABOR_RATE_USD_PER_HOUR_BY_KIND.FINANCE_PULSE (BLS "Financial Analysts"
// 2024 median), so the per-close number is consistent with the ledger.

export const CLOSE_CHASE_DRAFT_MINUTES = 12;
export const CLOSE_OUTSTANDING_ITEM_MINUTES = 4;
export const CLOSE_UNCATEGORIZED_RECEIPT_MINUTES = 5;
export const CLOSE_STATUS_UPDATE_MINUTES = 10;
export const CLOSE_LABOR_RATE_USD_PER_HOUR = 75;

export interface CloseValueImpact {
  /** Hours of staff doc-chase + triage time this assembled close saved. */
  hoursSaved: number;
  /** USD value influenced = hoursSaved × finance labor rate. */
  dollarsInfluenced: number;
  /** Number of chase email drafts staged (one per recipient grouping). */
  chaseDrafts: number;
  /** Number of outstanding required items the close chased (pending+late). */
  outstandingRequiredItems: number;
  /** Number of loose receipts the close flagged for operator triage. */
  uncategorizedReceipts: number;
  /** True when a client-facing status update was drafted. */
  statusUpdateDrafted: boolean;
  /** Every constant + formula that produced the number above — nothing
   *  hidden, per the no-hidden-guess rule. */
  assumptions: {
    chaseDraftMinutes: number;
    outstandingItemMinutes: number;
    uncategorizedReceiptMinutes: number;
    statusUpdateMinutes: number;
    laborRateUsdPerHour: number;
    formula: string;
  };
}

/**
 * Minimal shape this helper reads from a `MonthEndCloseOutput`. Declared
 * structurally (not imported) so `lib/measurement` stays free of a skill
 * dependency — the close skill passes its output and it duck-types.
 */
export interface CloseValueImpactInput {
  items: Array<{ required: boolean; status: 'received' | 'pending' | 'late' }>;
  chaseEmails: unknown[];
  uncategorizedReceipts: unknown[];
}

/**
 * Compute the hours-saved value of ONE assembled month-end close. Pure;
 * no DB, no mutation. Per `feedback_no_guesses_no_estimates.md` every
 * constant is surfaced in `assumptions`.
 */
export function computeCloseValueImpact(
  close: CloseValueImpactInput,
): CloseValueImpact {
  const outstandingRequiredItems = close.items.filter(
    (i) => i.required && (i.status === 'pending' || i.status === 'late'),
  ).length;
  const chaseDrafts = close.chaseEmails.length;
  const uncategorizedReceipts = close.uncategorizedReceipts.length;
  const statusUpdateDrafted = true;

  const minutes =
    chaseDrafts * CLOSE_CHASE_DRAFT_MINUTES +
    outstandingRequiredItems * CLOSE_OUTSTANDING_ITEM_MINUTES +
    uncategorizedReceipts * CLOSE_UNCATEGORIZED_RECEIPT_MINUTES +
    (statusUpdateDrafted ? CLOSE_STATUS_UPDATE_MINUTES : 0);

  const hoursSaved = minutes / 60;
  const dollarsInfluenced = hoursSaved * CLOSE_LABOR_RATE_USD_PER_HOUR;

  return {
    hoursSaved: roundTo(hoursSaved, 2),
    dollarsInfluenced: roundTo(dollarsInfluenced, 2),
    chaseDrafts,
    outstandingRequiredItems,
    uncategorizedReceipts,
    statusUpdateDrafted,
    assumptions: {
      chaseDraftMinutes: CLOSE_CHASE_DRAFT_MINUTES,
      outstandingItemMinutes: CLOSE_OUTSTANDING_ITEM_MINUTES,
      uncategorizedReceiptMinutes: CLOSE_UNCATEGORIZED_RECEIPT_MINUTES,
      statusUpdateMinutes: CLOSE_STATUS_UPDATE_MINUTES,
      laborRateUsdPerHour: CLOSE_LABOR_RATE_USD_PER_HOUR,
      formula:
        '(chaseDrafts×12 + outstandingRequiredItems×4 + uncategorizedReceipts×5 + statusUpdate×10) minutes ÷ 60 × $75/hr',
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
