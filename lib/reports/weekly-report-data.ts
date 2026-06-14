/**
 * lib/reports/weekly-report-data.ts
 *
 * Weekly customer report email — DATA layer.
 *
 * Produces the structured numbers behind the Friday 8am ET "here's what
 * Plaino did for you this week" email. It COMPOSES the existing weekly
 * proof-of-value digest (`lib/measurement/weekly-digest-data`) — reusing
 * its audited hours/dollars/auto-execute math — and adds the email-specific
 * dimensions the in-app digest never needed:
 *
 *   - drafts created (count + per-discipline breakdown),
 *   - approvals the customer made (count + median time-to-approve),
 *   - approvals rejected (count + reasons),
 *   - workflows that fired (count per agent slug),
 *   - per-vertical OUTCOME lines in the language of the trade,
 *   - a "next week look-ahead" derived from durable state.
 *
 * Design (mirrors the measurement seam it extends):
 *   - Pure read. Accepts a `Prisma.TransactionClient`; the caller owns the
 *     RLS context (`withSystemContext`). Never opens its own transaction.
 *   - Cold-start safe (`feedback_cold_start_safe_agents.md`): durable rows
 *     only, no session state.
 *   - No hidden guess (`feedback_no_guesses_no_estimates.md`): every dollar
 *     figure traces to a real payload amount or the labelled ledger
 *     estimate; the look-ahead is derived from real pending rows, not
 *     invented promises.
 *   - Same Mon–Sun PRIOR-completed-week window as the in-app digest, via the
 *     shared `resolveReportedWeek` — a Friday cron reports last week.
 */

import type { Prisma, Vertical, WorkApprovalKind } from '@prisma/client';
import { WorkApprovalStatus } from '@prisma/client';
import { getDiscipline } from '@/lib/disciplines';
import { extractRealDollars } from '@/lib/measurement/weekly-digest-data';
import {
  computeWeeklyDigestData,
  resolveReportedWeek,
} from '@/lib/measurement/weekly-digest-data';
import {
  buildVerticalOutcomes,
  type KindAggregate,
  type VerticalOutcome,
} from './vertical-outcomes';

// ── Public types ────────────────────────────────────────────────────────────

export interface DraftDisciplineRow {
  /** Discipline slug, or 'other' for items with no discipline tag. */
  discipline: string;
  /** Display label ("Finance", "Customer success", "Other"). */
  label: string;
  count: number;
}

export interface WorkflowRow {
  agentSlug: string;
  /** Humanized label for the owner ("Follow-up chaser"). */
  label: string;
  count: number;
}

export interface RejectionReasonRow {
  /** The reason text, or "No reason given". */
  reason: string;
  count: number;
}

export interface WeeklyReportLookAhead {
  /** Approval drafts sitting PENDING right now — the clearest "needs you". */
  pendingReviewCount: number;
  /** One vertical-specific sentence on the recurring work Plaino keeps
   *  doing next week. */
  recurringPlan: string;
  /** Short list of things genuinely needing the owner's input, derived from
   *  durable state (pending reviews, repeated rejections). Empty when
   *  nothing needs them. */
  needsInput: string[];
}

export interface WeeklyReportData {
  workspaceId: string;
  workspaceName: string;
  vertical: Vertical;

  /** ISO week boundaries (Monday 00:00 UTC, inclusive → next Monday, excl). */
  weekStart: string;
  weekEnd: string;
  /** Sunday Y-M-D anchor (shared with the in-app digest's forDate). */
  forDate: string;
  /** Human week label, e.g. "Jun 2 – Jun 8". */
  weekLabel: string;

  // Headline (from the audited ledger via the digest).
  hoursSaved: number;
  dollarsInfluenced: number;
  hasRealDollars: boolean;
  tokenCostUsd: number;
  netValueUsd: number;

  // Draft + approval lifecycle.
  draftsCreated: number;
  draftsByDiscipline: DraftDisciplineRow[];
  /** APPROVED (the customer said yes by hand) decided this week. */
  approvalsApproved: number;
  /** Median minutes between draft and the customer's approval. Null when no
   *  manual approvals happened this week. */
  medianTimeToApproveMinutes: number | null;
  /** REJECTED decided this week. */
  approvalsRejected: number;
  rejectionReasons: RejectionReasonRow[];
  /** Items the fleet auto-executed under the limits the owner set. */
  actionsAutoExecuted: number;

  // Workflows + outcomes.
  workflowsFired: WorkflowRow[];
  verticalOutcomes: VerticalOutcome[];

  // Look-ahead.
  lookAhead: WeeklyReportLookAhead;

  /** True when the week had ZERO drafts and ZERO decisions — the email
   *  renders the honest "quiet week" state. */
  isEmpty: boolean;
}

export interface ComputeWeeklyReportArgs {
  workspaceId: string;
  workspaceName: string;
  vertical: Vertical;
  /** Any instant in/after the week to report. Defaults to now. */
  now?: Date;
}

// ── Core computation ──────────────────────────────────────────────────────────

const PROPOSED_IN_WEEK_SELECT = {
  kind: true,
  discipline: true,
  agentSlug: true,
  status: true,
  payload: true,
} as const;

export async function computeWeeklyReportData(
  tx: Prisma.TransactionClient,
  args: ComputeWeeklyReportArgs,
): Promise<WeeklyReportData> {
  const now = args.now ?? new Date();
  const { weekStart, weekEnd, forDate } = resolveReportedWeek(now);

  const [
    digest,
    proposedRows,
    approvedRows,
    rejectedRows,
    pendingReviewCount,
  ] = await Promise.all([
    // Reuse the audited hours/dollars/auto-execute math.
    computeWeeklyDigestData(tx, {
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      now,
    }),
    // Everything Plaino DRAFTED this week (any status) — drives drafts-
    // created, workflows-fired, and the per-vertical outcome aggregates.
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        proposedAt: { gte: weekStart, lt: weekEnd },
      },
      select: PROPOSED_IN_WEEK_SELECT,
    }),
    // Manual approvals DECIDED this week — for count + time-to-approve.
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: WorkApprovalStatus.APPROVED,
        decidedAt: { gte: weekStart, lt: weekEnd },
      },
      select: { proposedAt: true, decidedAt: true },
    }),
    // Rejections DECIDED this week — for count + reasons.
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: WorkApprovalStatus.REJECTED,
        decidedAt: { gte: weekStart, lt: weekEnd },
      },
      select: { decisionReason: true },
    }),
    // Pending RIGHT NOW (as of `now`) — the look-ahead "needs you" signal.
    tx.workApprovalQueueItem.count({
      where: { workspaceId: args.workspaceId, status: WorkApprovalStatus.PENDING },
    }),
  ]);

  // ── Drafts created + per-discipline + per-workflow + per-kind aggregates. ──
  const draftsCreated = proposedRows.length;
  const byDiscipline = new Map<string, number>();
  const byWorkflow = new Map<string, number>();
  const byKind = new Map<WorkApprovalKind, KindAggregate>();

  for (const row of proposedRows) {
    const disc = row.discipline ?? 'other';
    byDiscipline.set(disc, (byDiscipline.get(disc) ?? 0) + 1);

    const slug = row.agentSlug || 'fleet';
    byWorkflow.set(slug, (byWorkflow.get(slug) ?? 0) + 1);

    const kind = row.kind as WorkApprovalKind;
    const real = extractRealDollars(row.payload);
    const agg = byKind.get(kind);
    if (agg) {
      agg.drafted += 1;
      agg.realDollarsSum += real ? real.amount : 0;
    } else {
      byKind.set(kind, {
        kind,
        drafted: 1,
        realDollarsSum: real ? real.amount : 0,
      });
    }
  }

  const draftsByDiscipline: DraftDisciplineRow[] = [...byDiscipline.entries()]
    .map(([discipline, count]) => ({
      discipline,
      label: disciplineLabel(discipline),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const workflowsFired: WorkflowRow[] = [...byWorkflow.entries()]
    .map(([agentSlug, count]) => ({
      agentSlug,
      label: humanizeSlug(agentSlug),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const verticalOutcomes = buildVerticalOutcomes(args.vertical, byKind);

  // ── Approvals made + median time-to-approve. ────────────────────────────────
  const approvalsApproved = approvedRows.length;
  const approveMinutes = approvedRows
    .map((r) =>
      r.decidedAt
        ? (r.decidedAt.getTime() - r.proposedAt.getTime()) / 60000
        : null,
    )
    .filter((m): m is number => m !== null && Number.isFinite(m) && m >= 0);
  const medianTimeToApproveMinutes =
    approveMinutes.length > 0 ? Math.round(median(approveMinutes)) : null;

  // ── Rejections + reasons. ───────────────────────────────────────────────────
  const approvalsRejected = rejectedRows.length;
  const reasonCounts = new Map<string, number>();
  for (const r of rejectedRows) {
    const reason = (r.decisionReason ?? '').trim() || 'No reason given';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const rejectionReasons: RejectionReasonRow[] = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Look-ahead. ─────────────────────────────────────────────────────────────
  const lookAhead = buildLookAhead({
    vertical: args.vertical,
    pendingReviewCount,
    approvalsRejected,
    rejectionReasons,
  });

  const isEmpty =
    draftsCreated === 0 &&
    approvalsApproved === 0 &&
    approvalsRejected === 0 &&
    digest.actionsAutoExecuted === 0;

  return {
    workspaceId: args.workspaceId,
    workspaceName: args.workspaceName,
    vertical: args.vertical,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    forDate,
    weekLabel: buildWeekLabel(weekStart, weekEnd),
    hoursSaved: digest.hoursSaved,
    dollarsInfluenced: digest.dollarsInfluenced,
    hasRealDollars: digest.hasRealDollars,
    tokenCostUsd: digest.tokenCostUsd,
    netValueUsd: digest.netValueUsd,
    draftsCreated,
    draftsByDiscipline,
    approvalsApproved,
    medianTimeToApproveMinutes,
    approvalsRejected,
    rejectionReasons,
    actionsAutoExecuted: digest.actionsAutoExecuted,
    workflowsFired,
    verticalOutcomes,
    lookAhead,
    isEmpty,
  };
}

// ── Look-ahead builder ────────────────────────────────────────────────────────

/** Vertical-specific sentence describing the recurring work Plaino keeps
 *  doing — grounded in what the fleet actually drafts, never an overpromise. */
const RECURRING_PLAN_BY_VERTICAL: Partial<Record<Vertical, string>> = {
  REAL_ESTATE:
    'Plaino will keep watching your inbox for new leads and buyer inquiries, drafting a first-touch reply for each so none go cold.',
  PROPERTY_MANAGEMENT:
    'Plaino will keep an eye on rent due dates and draft a reminder the moment a balance goes past due.',
  CPA: 'Plaino will keep chasing open receivables and prepping your month-end picture as the close approaches.',
  HOME_SERVICES:
    'Plaino will keep following up on open estimates so a quote never sits unanswered.',
  LAW: 'Plaino will keep screening new matters for conflicts and drafting the research you ask for.',
};

const RECURRING_PLAN_DEFAULT =
  'Plaino will keep watching your inbox and systems, drafting the work that needs doing as it comes in.';

interface LookAheadArgs {
  vertical: Vertical;
  pendingReviewCount: number;
  approvalsRejected: number;
  rejectionReasons: RejectionReasonRow[];
}

function buildLookAhead(args: LookAheadArgs): WeeklyReportLookAhead {
  const needsInput: string[] = [];
  if (args.pendingReviewCount > 0) {
    needsInput.push(
      `${args.pendingReviewCount} ${
        args.pendingReviewCount === 1 ? 'draft is' : 'drafts are'
      } waiting for your review in your approvals queue.`,
    );
  }
  if (args.approvalsRejected > 0) {
    needsInput.push(
      `Plaino noted the ${
        args.approvalsRejected === 1 ? 'correction' : 'corrections'
      } you made this week and is folding them into next week's drafts.`,
    );
  }
  return {
    pendingReviewCount: args.pendingReviewCount,
    recurringPlan:
      RECURRING_PLAN_BY_VERTICAL[args.vertical] ?? RECURRING_PLAN_DEFAULT,
    needsInput,
  };
}

// ── Label + math helpers ──────────────────────────────────────────────────────

function disciplineLabel(slug: string): string {
  if (slug === 'other') return 'Other';
  return getDiscipline(slug)?.name ?? humanizeSlug(slug);
}

/** Known agent-slug → friendly label overrides, for the slugs an owner sees
 *  most. Anything not here falls back to a humanized slug. */
const SLUG_LABELS: Record<string, string> = {
  fleet: 'Plaino',
  'follow-up-chaser-general': 'Follow-up chaser',
  'inbox-triage-general': 'Inbox triage',
  'process-doc-drafter-general': 'Process docs',
  'lead-triage-realestate': 'Lead triage',
  'finance-pulse-general': 'Finance pulse',
  'compliance-watch-general': 'Compliance watch',
  'analytics-weekly-pulse-general': 'Weekly analytics',
  'content-calendar-drafter-general': 'Content calendar',
  'chief-of-staff-scheduler': 'Chief of staff',
  'support-handler': 'Support handler',
};

export function humanizeSlug(slug: string): string {
  const known = SLUG_LABELS[slug];
  if (known) return known;
  const cleaned = slug
    .replace(/-(general|realestate|cpa|law|home-services|property-management)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!cleaned) return slug;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Jun 2 – Jun 8" — inclusive last day (weekEnd is exclusive next Monday). */
function buildWeekLabel(weekStart: Date, weekEnd: Date): string {
  const lastDay = new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000);
  const start = `${MONTHS[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()}`;
  const end = `${MONTHS[lastDay.getUTCMonth()]} ${lastDay.getUTCDate()}`;
  return `${start} – ${end}`;
}
