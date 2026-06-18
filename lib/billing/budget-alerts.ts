/**
 * lib/billing/budget-alerts.ts
 *
 * Proactive budget alerts: email the workspace owner as spend crosses
 * 50% / 75% / 90% of a configured cap, so a budget is never a silent wall a
 * customer slams into. Pairs with the hard enforcement in `budget.ts`:
 *
 *   - `budget.ts` is the GATE — at 100% (`OVER`) the
 *     `BudgetEnforcingLlmProvider` blocks new calls (no tokens spent, the
 *     auto-pause is structural). That's the circuit breaker.
 *   - this file is the WARNING LIGHT — it watches the run-up to that wall and
 *     gives the owner (and us) advance notice at three thresholds so the
 *     conversation about the right plan happens BEFORE work pauses.
 *
 * Two dimensions, evaluated independently (a daily spike and a slow monthly
 * climb are different stories): each has its own cap (`budget.ts`), its own
 * period key, and its own fired-threshold watermark so an alert fires at most
 * ONCE per threshold per period. The watermark lives in `Workspace.settings`
 * JSON (same home as the caps themselves) — no migration, and it resets
 * naturally when the period key rolls over.
 *
 * Per `feedback_no_silent_vendor_lock` + `project_no_outbound_architecture`:
 * this is a product-side transactional notice to the owner's OWN inbox (the
 * same shape as the trial-end warning and the dunning notice). Email flows
 * through the `lib/email/` adapter, never a direct SDK call. agentplain agents
 * still never send outbound on a customer's behalf — this is agentplain
 * talking to its own customer about their account.
 *
 * Everything in the top half of this file is PURE (no IO) so the threshold
 * arithmetic and the dedup watermark are unit-testable without a DB, a clock,
 * or an email provider. The Inngest sweep
 * (`lib/inngest/functions/budget-alert-sweep.ts`) is the only IO caller.
 */

import type { WorkspaceBudgetStatus, WorkspaceDualBudget } from './budget';
import { microCentsToUsd } from './budget';

// ── Thresholds ─────────────────────────────────────────────────────────────

/** Fire an alert as spend crosses these fractions of the cap. Ascending so a
 *  single sweep that finds a workspace already at 92% fires the highest
 *  un-fired threshold (90%), not all three. The 100% mark is NOT here — that
 *  is the enforcement gate's job (`budget.ts`), and the 90% alert tells the
 *  owner what happens when it's reached. */
export const BUDGET_ALERT_THRESHOLDS = [0.5, 0.75, 0.9] as const;

export type BudgetDimension = 'daily' | 'monthly';

// ── Period keys ─────────────────────────────────────────────────────────────
//
// Watermarks reset when the period rolls. Monthly uses YYYY-MM, daily uses
// YYYY-MM-DD — both UTC, matching the UTC windows the usage aggregator and the
// daily Stripe cron already use (a locale-shifted boundary would double-fire
// at midnight).

export function monthlyPeriodKey(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function dailyPeriodKey(now: Date): string {
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${monthlyPeriodKey(now)}-${d}`;
}

// ── Dedup watermark (persisted in Workspace.settings JSON) ──────────────────

export const BUDGET_ALERT_SETTINGS_KEY = 'budgetAlertState';

/** Last-fired watermark for one dimension. `firedPct` is the highest threshold
 *  already announced for `periodKey`; when the live period key differs, the
 *  watermark is stale and treated as 0 (nothing fired yet this period). */
export interface AlertDimensionState {
  periodKey: string;
  firedPct: number;
}

export interface BudgetAlertState {
  monthly?: AlertDimensionState;
  daily?: AlertDimensionState;
}

export function readBudgetAlertState(settings: unknown): BudgetAlertState {
  if (!settings || typeof settings !== 'object') return {};
  const raw = (settings as Record<string, unknown>)[BUDGET_ALERT_SETTINGS_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const blob = raw as Record<string, unknown>;
  const dim = (v: unknown): AlertDimensionState | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o.periodKey === 'string' && typeof o.firedPct === 'number') {
      return { periodKey: o.periodKey, firedPct: o.firedPct };
    }
    return undefined;
  };
  const out: BudgetAlertState = {};
  const monthly = dim(blob.monthly);
  const daily = dim(blob.daily);
  if (monthly) out.monthly = monthly;
  if (daily) out.daily = daily;
  return out;
}

/** Merge a new alert watermark into a settings JSON blob without dropping
 *  other keys (the caps live in the same blob). Never mutates the input. */
export function withBudgetAlertState(
  settings: unknown,
  state: BudgetAlertState,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    settings && typeof settings === 'object'
      ? { ...(settings as Record<string, unknown>) }
      : {};
  base[BUDGET_ALERT_SETTINGS_KEY] = state;
  return base;
}

// ── Pure decision ───────────────────────────────────────────────────────────

export interface DimensionAlertDecision {
  shouldFire: boolean;
  /** The threshold fraction to announce (0.5 / 0.75 / 0.9), or null. */
  threshold: number | null;
  /** The watermark to persist when fired (caller writes it only on success). */
  nextState: AlertDimensionState;
}

/**
 * Decide whether one dimension crossed a new threshold. Resets the watermark
 * when the period key rolled. Returns the HIGHEST un-fired threshold the
 * spend has reached, so a workspace found at 92% fires 90% once (not 50→75→90
 * in three sweeps).
 */
export function decideDimensionAlert(args: {
  percentUsed: number | null;
  periodKey: string;
  prior: AlertDimensionState | undefined;
}): DimensionAlertDecision {
  const priorFired =
    args.prior && args.prior.periodKey === args.periodKey
      ? args.prior.firedPct
      : 0;
  const noFire: DimensionAlertDecision = {
    shouldFire: false,
    threshold: null,
    nextState: { periodKey: args.periodKey, firedPct: priorFired },
  };
  if (args.percentUsed === null) return noFire;
  // Highest threshold the spend has reached that hasn't fired yet this period.
  let crossed: number | null = null;
  for (const t of BUDGET_ALERT_THRESHOLDS) {
    if (args.percentUsed >= t && t > priorFired) crossed = t;
  }
  if (crossed === null) return noFire;
  return {
    shouldFire: true,
    threshold: crossed,
    nextState: { periodKey: args.periodKey, firedPct: crossed },
  };
}

export interface BudgetAlertFire {
  dimension: BudgetDimension;
  threshold: number;
  status: WorkspaceBudgetStatus;
}

export interface WorkspaceAlertEvaluation {
  fires: BudgetAlertFire[];
  nextState: BudgetAlertState;
}

/**
 * Evaluate both dimensions for a workspace. Returns the list of dimensions
 * that crossed a new threshold (0, 1, or 2) plus the merged watermark to
 * persist. The caller sends ONE email covering all `fires` and writes
 * `nextState` only after a successful send — so a send failure simply retries
 * next sweep instead of silently swallowing the alert.
 */
export function evaluateWorkspaceAlerts(
  dual: WorkspaceDualBudget,
  prior: BudgetAlertState,
  now: Date,
): WorkspaceAlertEvaluation {
  const monthly = decideDimensionAlert({
    percentUsed: dual.monthly.percentUsed,
    periodKey: monthlyPeriodKey(now),
    prior: prior.monthly,
  });
  const daily = decideDimensionAlert({
    percentUsed: dual.daily.percentUsed,
    periodKey: dailyPeriodKey(now),
    prior: prior.daily,
  });
  const fires: BudgetAlertFire[] = [];
  if (monthly.shouldFire && monthly.threshold !== null) {
    fires.push({ dimension: 'monthly', threshold: monthly.threshold, status: dual.monthly });
  }
  if (daily.shouldFire && daily.threshold !== null) {
    fires.push({ dimension: 'daily', threshold: daily.threshold, status: dual.daily });
  }
  return {
    fires,
    nextState: { monthly: monthly.nextState, daily: daily.nextState },
  };
}

// ── Email composition (pure: produces subject/html/text) ────────────────────

export interface BudgetAlertEmail {
  subject: string;
  html: string;
  text: string;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function usd(status: WorkspaceBudgetStatus): string {
  return `$${microCentsToUsd(status.consumedMicroCents).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function dimensionLabel(d: BudgetDimension): string {
  return d === 'daily' ? "today's" : "this month's";
}

/** Compose the owner-facing alert email. Highest threshold across the fires
 *  drives the subject; the body lists each dimension that crossed. Calm,
 *  service-partnership voice — "heads up", never "you're expensive". */
export function composeBudgetAlertEmail(args: {
  workspaceName: string;
  fires: BudgetAlertFire[];
  usageUrl: string;
}): BudgetAlertEmail {
  const { workspaceName, fires, usageUrl } = args;
  const top = fires.reduce((a, b) => (b.threshold > a.threshold ? b : a));
  const atCap = top.threshold >= 0.9;
  const subject = `Heads up: ${workspaceName} is at ${pct(top.threshold)} of ${dimensionLabel(top.dimension)} budget`;

  const lines = fires.map((f) => {
    const cap = f.status.capUsdMonthly;
    const capLabel = cap !== null ? `$${cap.toLocaleString('en-US')}` : '—';
    return `${dimensionLabel(f.dimension)} budget: ${usd(f.status)} of ${capLabel} (${pct(f.threshold)})`;
  });

  const closing = atCap
    ? `If usage reaches the cap, new agent work pauses for the rest of the period rather than running up a surprise — and your service partner will reach out about the right plan. Nothing is lost: queued work resumes the moment the period resets or the budget is raised.`
    : `Nothing changes right now — your fleet keeps running. We send these so a budget is never a surprise. If usage keeps climbing, your service partner will talk through the right plan with you.`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1A1F; background:#F7F4ED; padding:32px;">
  <h2 style="font-weight:500; color:#1A1A1F;">A heads-up on ${escapeHtml(workspaceName)}&rsquo;s budget.</h2>
  <p>Your fleet has reached:</p>
  <ul style="line-height:1.7;">
    ${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('\n    ')}
  </ul>
  <p>${escapeHtml(closing)}</p>
  <p><a href="${usageUrl}" style="display:inline-block; padding:12px 20px; background:#1A1A1F; color:#F7F4ED; text-decoration:none; font-weight:500;">See your usage</a></p>
  <p style="font-size:13px; color:#726A5E;">Plaino, your service partner at agentplain</p>
  <p style="font-size:12px; color:#726A5E; margin-top:24px;">You&rsquo;re receiving this because you own an agentplain workspace with a budget set.</p>
</body></html>`;

  const text = `A heads-up on ${workspaceName}'s budget.

Your fleet has reached:
${lines.map((l) => `  - ${l}`).join('\n')}

${closing}

See your usage: ${usageUrl}

Plaino, your service partner at agentplain

You're receiving this because you own an agentplain workspace with a budget set.`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
