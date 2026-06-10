/**
 * lib/skills/invoice-chase-general/types.ts
 *
 * Provider-neutral types for the cross-vertical QuickBooks AR invoice-
 * chase skill. Reads the connected QuickBooks AR aging report, drafts
 * tier-escalating follow-up messages keyed on days-overdue, and stages
 * each as a FOLLOW_UP_NUDGE approval item.
 *
 * Three escalation tiers (mandate: "tone escalates with invoice age"):
 *   gentle  — < 15 days overdue. Warm check-in; no blame; easy reply.
 *   firm    — 15–45 days overdue. Direct ask; offer to help resolve.
 *   final   — 45+ days overdue. Explicit deadline + next step placeholder.
 *
 * Per `feedback_no_silent_vendor_lock.md`: QuickBooks / Prisma SDKs are
 * NOT imported here. The skill speaks the `ArAgingFetcher` port.
 *
 * Per `feedback_cold_start_safe_agents.md`: no in-memory state. Every
 * run reads the current AR snapshot fresh.
 *
 * Per `project_no_outbound_architecture.md`: every draft is staged as a
 * FOLLOW_UP_NUDGE approval item. The skill never sends mail.
 */

import type { SkillResult } from '../types';

// ── Escalation tier ───────────────────────────────────────────────────────────

/** Days-overdue thresholds — mandate: gentle < 15, firm 15-45, final 45+. */
export const AR_AGING_THRESHOLDS = {
  gentleMaxDays: 14,
  firmMaxDays: 45,
} as const;

export type ChaseEscalationTier = 'gentle' | 'firm' | 'final';

export function chaseEscalationTier(
  daysOverdue: number,
  thresholds: { gentleMaxDays?: number; firmMaxDays?: number } = {},
): ChaseEscalationTier {
  const gentleMax = thresholds.gentleMaxDays ?? AR_AGING_THRESHOLDS.gentleMaxDays;
  const firmMax = thresholds.firmMaxDays ?? AR_AGING_THRESHOLDS.firmMaxDays;
  if (daysOverdue <= gentleMax) return 'gentle';
  if (daysOverdue <= firmMax) return 'firm';
  return 'final';
}

// ── Domain records ────────────────────────────────────────────────────────────

/**
 * One open AR invoice to potentially chase. Amounts in USD (not cents) because
 * the QuickBooks MCP returns dollars. The approval payload carries the raw
 * USD balance for ROI tracking.
 */
export interface ArInvoiceRecord {
  /** QuickBooks Invoice id. */
  invoiceId: string;
  /** Doc number (e.g. "1042") — shown in the subject line. */
  docNumber: string | null;
  /** QuickBooks customer id — used to look up the customer name + email. */
  customerId: string;
  /** Customer display name. NULL when we couldn't look it up. */
  customerName: string | null;
  /** Customer email. NULL when QB has no email for this customer. */
  customerEmail: string | null;
  /** Total invoice amount in USD. */
  totalAmountUsd: number;
  /** Unpaid balance in USD — this is the "dollars influenced" figure. */
  balanceUsd: number;
  /** Transaction date (ISO YYYY-MM-DD). */
  txnDate: string;
  /** Due date (ISO YYYY-MM-DD). */
  dueDate: string;
  /** Days overdue as of the run's `now`. Zero means due today or earlier. */
  daysOverdue: number;
  /** Derived tier. */
  tier: ChaseEscalationTier;
}

// ── Fetcher port ──────────────────────────────────────────────────────────────

/**
 * Provider-neutral port for fetching open AR invoices with customer info.
 * Production wiring: `QuickBooksArFetcher`. Tests: inline fixture.
 *
 * Returns invoices that have a non-zero balance AND are past their due date
 * as of `asOf`. Already-paid and not-yet-due invoices are excluded by the
 * fetcher.
 *
 * Per `feedback_runner_portability.md` two-implementation rule: the port
 * ships alongside the QuickBooks impl + the in-test fixture impl.
 */
export interface ArAgingFetcher {
  readonly name: string;
  fetchOverdueInvoices(args: {
    workspaceId: string;
    asOf: Date;
    /** Upper cap — avoid unbounded QB queries. Defaults to 100. */
    count?: number;
  }): Promise<SkillResult<ArInvoiceRecord[]>>;
}

// ── Chase draft ───────────────────────────────────────────────────────────────

export interface InvoiceChaseDraft {
  /** UUID assigned at draft time; stable refId for the approval item. */
  draftId: string;
  invoiceId: string;
  docNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  /** Balance being chased — carried to the approval payload for ROI. */
  balanceUsd: number;
  daysOverdue: number;
  tier: ChaseEscalationTier;
  subject: string;
  /** Plain-text body with {{operator: ...}} merge fields. */
  body: string;
  /** 0-1 confidence. Gentle = high; final = lower (operator should verify). */
  confidence: number;
  reasoning: string;
}

// ── Approval sink ─────────────────────────────────────────────────────────────

export interface InvoiceChaseApprovalSink {
  readonly name: string;
  record(args: {
    workspaceId: string;
    draft: InvoiceChaseDraft;
  }): Promise<SkillResult<{ sinkId: string }>>;
}

// ── Skill I/O ─────────────────────────────────────────────────────────────────

export interface InvoiceChaseInput {
  workspaceId: string;
  fetcher: ArAgingFetcher;
  sink?: InvoiceChaseApprovalSink;
  now?: Date;
  /** Max drafts staged per run. Keeps the approval queue manageable. */
  maxDraftsPerRun?: number;
  /** Only stage drafts at or above this confidence threshold. */
  sinkThreshold?: number;
  /** Override escalation day-thresholds for testing. */
  thresholds?: {
    gentleMaxDays?: number;
    firmMaxDays?: number;
  };
}

export interface InvoiceChaseOutput {
  asOf: string;
  invoicesConsidered: number;
  draftsStaged: number;
  totalBalanceUsd: number;
  drafts: InvoiceChaseDraft[];
  noOutboundNote: string;
}

export const DEFAULT_MAX_DRAFTS_PER_RUN = 10;
export const DEFAULT_SINK_THRESHOLD = 0;
