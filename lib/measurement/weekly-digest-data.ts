/**
 * lib/measurement/weekly-digest-data.ts
 *
 * Weekly "what Plaino did for you" proof-of-value digest — DATA layer.
 *
 * This is a NEW module (wave cv-x2). It only IMPORTS from the existing
 * value-ledger seam (`./value-impact`); it does NOT modify it. The seam
 * is being edited on a sibling branch (cv/cpa-close-live-data, PR #205),
 * so the proof loop is built entirely as additive siblings to avoid the
 * merge conflict.
 *
 * What it produces: the structured numbers behind the Monday digest the
 * owner reads to know agentplain earned its subscription this week —
 *   - hours saved (sum, from the validated ledger),
 *   - dollars influenced (sum + top-3 line items),
 *   - actions taken, split into staged-for-review vs auto-executed,
 *   - a per-skill breakdown,
 *   - an honest empty state when the workspace had no activity.
 *
 * Design principles (mirrors value-impact.ts + the briefing generator):
 *   - Pure read. Accepts a `Prisma.TransactionClient` so the caller owns
 *     the RLS context (`withSystemContext` / `withRls`). Never opens its
 *     own transaction.
 *   - Cold-start safe (`feedback_cold_start_safe_agents.md`): reads only
 *     durable DB rows; no in-memory session state.
 *   - "No hidden guess" (`feedback_no_guesses_no_estimates.md`): the
 *     hours/dollars baseline comes from the audited ledger seam, and the
 *     digest surfaces whether each dollar line item is a REAL invoice/
 *     estimate amount or a time-based model estimate.
 *
 * ── Real-dollars seam (cross-wave contract) ─────────────────────────────
 * Sibling waves (cv-general PR #203, cv-home-services) stage
 * FOLLOW_UP_NUDGE approvals whose ENCRYPTED payloads carry a real dollar
 * amount for the invoice/estimate the nudge chases:
 *   - `balanceUsd`         — outstanding AR balance on an invoice nudge.
 *   - `estimateAmountUsd`  — quoted amount on an estimate/quote nudge.
 * Those branches aren't in this tree, but the WorkApprovalQueueItem model
 * and the payload crypto ARE on main. We read these fields WHEN PRESENT
 * (tolerant: a missing/NaN field falls back to the ledger's time-based
 * dollar estimate for that kind). When those PRs merge, the digest shows
 * real AR dollars automatically — no edit here required.
 */

import type { Prisma, WorkApprovalKind } from '@prisma/client';
import { WorkApprovalStatus } from '@prisma/client';
import { decryptPayloadForRead } from '@/lib/security/payload-crypto';
import {
  computeWorkspaceValueLedger,
  LABOR_RATE_USD_PER_HOUR_BY_KIND,
  MINUTES_SAVED_BY_KIND,
  type WorkspaceValueLedger,
} from './value-impact';

// ── Cross-wave dollar-field contract ────────────────────────────────────────
//
// The encrypted approval-payload field names a sibling wave writes for a
// real dollar amount. Documented as code so the contract is greppable and
// survives a future refactor. ORDER MATTERS: the first present, finite,
// positive field wins (balance is the stronger signal — an unpaid invoice
// is money already owed; an estimate is money not yet committed).
export const REAL_DOLLAR_PAYLOAD_FIELDS = [
  'balanceUsd',
  'estimateAmountUsd',
] as const;

export type RealDollarField = (typeof REAL_DOLLAR_PAYLOAD_FIELDS)[number];

/** The audit action `persist-artifacts.ts#applyBoundedExecuteDecision`
 *  writes when the fleet auto-executes an approval on the owner's behalf.
 *  We count these to report "actions auto-executed" honestly — straight
 *  from the immutable AuditLog, not inferred. */
export const AUTO_EXECUTE_AUDIT_ACTION = 'work_approval.auto_executed';

// ── Public types ────────────────────────────────────────────────────────────

/** One dollar line item the digest spotlights. `real` distinguishes an
 *  actual invoice/estimate amount (read from the payload) from a
 *  time-based model estimate (hours × labor rate). */
export interface DollarLineItem {
  kind: WorkApprovalKind;
  /** Human label for the line (e.g. "Invoice follow-up · $1,240 owed"). */
  label: string;
  /** USD value of this single line item. */
  dollars: number;
  /** True when `dollars` is a real invoice/estimate amount from the
   *  payload; false when it's the ledger's time-based estimate. */
  real: boolean;
  /** Which payload field carried the real amount, when `real` is true. */
  realField?: RealDollarField;
}

/** Per-skill (per agentSlug) breakdown row. */
export interface SkillBreakdownRow {
  agentSlug: string;
  /** Total accepted actions attributed to this skill in the week. */
  actions: number;
  /** Of those, how many were auto-executed by the fleet. */
  autoExecuted: number;
  /** Hours saved attributed to this skill (time-based, from the ledger
   *  table — NOT the real-dollar override; hours is always modeled). */
  hours: number;
  /** Dollars influenced attributed to this skill (real where available,
   *  else time-based). */
  dollars: number;
}

export interface WeeklyDigestData {
  workspaceId: string;
  workspaceName: string;
  /** ISO datetime of the inclusive week start (Monday 00:00 UTC). */
  weekStart: string;
  /** ISO datetime of the exclusive week end (following Monday 00:00 UTC). */
  weekEnd: string;
  /** Y-M-D (UTC) anchor used as the digest's `forDate`. Anchored to the
   *  reported week's SUNDAY so it never collides with a Mon–Fri daily
   *  briefing's `forDate` on the shared WorkspaceBriefing table. */
  forDate: string;

  /** Total hours saved this week (from the validated ledger). */
  hoursSaved: number;
  /** Total dollars influenced — real invoice/estimate amounts where the
   *  payload carried them, time-based estimate otherwise. */
  dollarsInfluenced: number;
  /** True iff at least one line item used a real payload dollar amount. */
  hasRealDollars: boolean;

  /** Total accepted actions (APPROVED + AUTO_APPROVED) this week. */
  actionsTaken: number;
  /** Of `actionsTaken`, how many the owner reviewed-and-approved. */
  actionsStaged: number;
  /** Of `actionsTaken`, how many the fleet auto-executed (from AuditLog). */
  actionsAutoExecuted: number;

  /** Top 3 dollar line items, descending by value. */
  topDollarLineItems: DollarLineItem[];
  /** Per-skill breakdown, descending by dollars then actions. */
  bySkill: SkillBreakdownRow[];

  /** LLM token cost for the week (USD), from the ledger seam. */
  tokenCostUsd: number;
  /** dollarsInfluenced − tokenCostUsd. Can be negative (a tuning signal). */
  netValueUsd: number;

  /** True when the workspace had ZERO accepted actions this week — the
   *  digest renders the honest "still learning your business" state. */
  isEmpty: boolean;

  /** The full validated ledger, surfaced so the renderer can cite the
   *  assumptions footer without re-querying. */
  ledger: WorkspaceValueLedger;
}

export interface ComputeWeeklyDigestArgs {
  workspaceId: string;
  workspaceName: string;
  /** Any instant within (or at the end of) the week to report. The window
   *  is the Monday 00:00 UTC ≤ t < next-Monday 00:00 UTC that contains
   *  `now − 7d` … but we compute it relative to the PRIOR completed week
   *  (see `resolveReportedWeek`). Defaults to the current time. */
  now?: Date;
}

// ── Week-window math ─────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Resolve the PRIOR completed Mon–Sun week relative to `now`.
 *
 * The Monday cron fires at the start of a new week; the digest reports the
 * week that JUST ended (the previous Monday 00:00 UTC up to this Monday
 * 00:00 UTC). Anchoring to a completed week keeps the numbers stable on a
 * same-week retry and gives the owner a full 7 days of activity.
 *
 * Returns UTC boundaries + the Sunday Y-M-D anchor.
 */
export function resolveReportedWeek(now: Date): {
  weekStart: Date;
  weekEnd: Date;
  forDate: string;
} {
  // UTC midnight of `now`'s day.
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // JS getUTCDay: 0=Sun..6=Sat. Days since the most recent Monday.
  const dow = midnight.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7; // Mon→0, Sun→6
  // This week's Monday 00:00 UTC.
  const thisMonday = new Date(midnight.getTime() - daysSinceMonday * DAY_MS);
  // The week we report is the one that just ended: prior Mon → this Mon.
  const weekStart = new Date(thisMonday.getTime() - WEEK_MS);
  const weekEnd = thisMonday;
  // Anchor `forDate` to the reported week's Sunday (weekEnd − 1 day). The
  // daily briefing cron only runs Mon–Fri, so a Sunday anchor can never
  // collide with a daily briefing's `forDate` on the shared table.
  const sunday = new Date(weekEnd.getTime() - DAY_MS);
  const forDate = sunday.toISOString().slice(0, 10);
  return { weekStart, weekEnd, forDate };
}

// ── Core computation ─────────────────────────────────────────────────────────

/**
 * Compute the structured weekly proof-of-value digest for one workspace.
 *
 * Reads (all under the caller's tx / RLS context):
 *   1. Accepted approvals (APPROVED + AUTO_APPROVED) decided in the week,
 *      with their encrypted payload (for real dollar fields) and status
 *      (to split staged vs auto-executed).
 *   2. The auto-executed AuditLog count for the week (the immutable record
 *      of what the fleet did on the owner's behalf).
 *   3. The validated value ledger over the same 7-day window — the
 *      authoritative hours-saved + token-cost numbers.
 *
 * Never throws on a single bad payload: a row whose payload fails to
 * decrypt simply contributes its time-based estimate (no real-dollar
 * override) — the digest degrades gracefully, exactly like the approvals
 * page does.
 */
export async function computeWeeklyDigestData(
  tx: Prisma.TransactionClient,
  args: ComputeWeeklyDigestArgs,
): Promise<WeeklyDigestData> {
  const now = args.now ?? new Date();
  const { weekStart, weekEnd, forDate } = resolveReportedWeek(now);

  // ── 1. Accepted approvals decided in the week (with payload + status). ──
  const ACCEPTED_STATUSES: WorkApprovalStatus[] = [
    WorkApprovalStatus.APPROVED,
    WorkApprovalStatus.AUTO_APPROVED,
  ];

  const [acceptedRows, autoExecutedAuditCount, ledger] = await Promise.all([
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: { in: ACCEPTED_STATUSES },
        decidedAt: { gte: weekStart, lt: weekEnd },
      },
      select: {
        kind: true,
        status: true,
        agentSlug: true,
        payload: true,
      },
    }),
    tx.auditLog.count({
      where: {
        workspaceId: args.workspaceId,
        action: AUTO_EXECUTE_AUDIT_ACTION,
        occurredAt: { gte: weekStart, lt: weekEnd },
      },
    }),
    // The validated ledger over the SAME 7-day window. value-impact uses a
    // rolling `now − periodDays` window, so we pass the week-end as `now`
    // and 7 days back — landing exactly on [weekStart, weekEnd).
    computeWorkspaceValueLedger(tx, {
      workspaceId: args.workspaceId,
      periodDays: 7,
      now: weekEnd,
    }),
  ]);

  // ── 2. Per-row dollar resolution + per-skill aggregation. ───────────────
  // Each accepted row contributes either a REAL dollar amount (from its
  // payload) or the ledger's time-based estimate for its kind. Hours are
  // always the time-based model number (we never claim an invoice amount
  // is "hours saved").
  const bySkillMap = new Map<string, SkillBreakdownRow>();
  const lineItems: DollarLineItem[] = [];
  let dollarsInfluenced = 0;
  let hasRealDollars = false;
  let actionsAutoApproved = 0;

  for (const row of acceptedRows) {
    const kind = row.kind as WorkApprovalKind;
    const minutes = MINUTES_SAVED_BY_KIND[kind] ?? 0;
    const rate = LABOR_RATE_USD_PER_HOUR_BY_KIND[kind] ?? 45;
    const hours = minutes / 60;
    const estimatedDollars = hours * rate;

    const real = extractRealDollars(row.payload);
    const dollars = real ? real.amount : estimatedDollars;
    if (real) hasRealDollars = true;
    dollarsInfluenced += dollars;

    const isAuto = row.status === WorkApprovalStatus.AUTO_APPROVED;
    if (isAuto) actionsAutoApproved += 1;

    // Per-skill rollup.
    const slug = row.agentSlug || 'fleet';
    const existing = bySkillMap.get(slug);
    if (existing) {
      existing.actions += 1;
      existing.autoExecuted += isAuto ? 1 : 0;
      existing.hours += hours;
      existing.dollars += dollars;
    } else {
      bySkillMap.set(slug, {
        agentSlug: slug,
        actions: 1,
        autoExecuted: isAuto ? 1 : 0,
        hours,
        dollars,
      });
    }

    lineItems.push({
      kind,
      label: lineItemLabel(kind, real),
      dollars,
      real: Boolean(real),
      realField: real?.field,
    });
  }

  const actionsTaken = acceptedRows.length;
  // Prefer the immutable AuditLog count for "auto-executed". It is the
  // record of truth (persist-artifacts writes one per auto-execute). We
  // clamp to the AUTO_APPROVED status count as a sanity floor so the
  // headline never claims MORE auto-executions than there were accepted
  // auto-approved rows this week (audit rows could include older targets
  // re-touched; the status count is the honest in-window denominator).
  const actionsAutoExecuted = Math.min(
    autoExecutedAuditCount,
    actionsAutoApproved,
  );
  const actionsStaged = actionsTaken - actionsAutoExecuted;

  // ── 3. Top-3 dollar line items + sorted per-skill breakdown. ────────────
  const topDollarLineItems = [...lineItems]
    .sort((a, b) => {
      // Real amounts rank above estimates at equal dollar value so the
      // owner sees provable money first.
      if (b.dollars !== a.dollars) return b.dollars - a.dollars;
      return Number(b.real) - Number(a.real);
    })
    .slice(0, 3)
    .map(roundLineItem);

  const bySkill = [...bySkillMap.values()]
    .map((s) => ({
      ...s,
      hours: roundTo(s.hours, 2),
      dollars: roundTo(s.dollars, 2),
    }))
    .sort((a, b) => b.dollars - a.dollars || b.actions - a.actions);

  return {
    workspaceId: args.workspaceId,
    workspaceName: args.workspaceName,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    forDate,
    hoursSaved: ledger.hoursSaved,
    dollarsInfluenced: roundTo(dollarsInfluenced, 2),
    hasRealDollars,
    actionsTaken,
    actionsStaged,
    actionsAutoExecuted,
    topDollarLineItems,
    bySkill,
    tokenCostUsd: ledger.tokenCostUsd,
    netValueUsd: roundTo(dollarsInfluenced - ledger.tokenCostUsd, 2),
    isEmpty: actionsTaken === 0,
    ledger,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RealDollars {
  amount: number;
  field: RealDollarField;
}

/**
 * Pull a real invoice/estimate dollar amount off an approval payload, when
 * present. Tolerant by contract: decrypts the envelope, narrows to a plain
 * object, and returns the first finite, positive value among the documented
 * fields (`balanceUsd`, then `estimateAmountUsd`). Any failure → null (the
 * caller falls back to the time-based estimate). Never throws.
 */
export function extractRealDollars(payload: unknown): RealDollars | null {
  let decoded: unknown;
  try {
    decoded = decryptPayloadForRead(payload);
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return null;
  }
  const obj = decoded as Record<string, unknown>;
  for (const field of REAL_DOLLAR_PAYLOAD_FIELDS) {
    const raw = obj[field];
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return { amount: num, field };
    }
  }
  return null;
}

function lineItemLabel(
  kind: WorkApprovalKind,
  real: RealDollars | null,
): string {
  const kindLabel = kind.toLowerCase().replace(/_/g, ' ');
  if (real) {
    const noun = real.field === 'balanceUsd' ? 'owed' : 'quoted';
    return `${kindLabel} · ${formatUsd(real.amount)} ${noun}`;
  }
  return kindLabel;
}

function roundLineItem(item: DollarLineItem): DollarLineItem {
  return { ...item, dollars: roundTo(item.dollars, 2) };
}

/** Compact USD formatter for labels — no cents on whole dollars. */
export function formatUsd(n: number): string {
  const rounded = Math.round(n);
  return `$${rounded.toLocaleString('en-US')}`;
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
