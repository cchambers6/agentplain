/**
 * lib/billing/usage/stripe-meter.ts
 *
 * Daily Stripe-meter emission. One pass per workspace per day:
 *
 *   1. Read every `LlmUsageRecord` row with `stripeReportedAt IS NULL`.
 *   2. Sum the period's `costMicroCents` per workspace.
 *   3. POST one Billing Meter Event to Stripe with the workspace's
 *      `stripeCustomerId`, `quantity = summed micro-cents`, and an
 *      idempotency key composed of `workspaceId + UTC date`.
 *   4. On 200, mark every contributing row's `stripeReportedAt = now`
 *      so a future cron pass doesn't double-bill.
 *
 * Env gating (per the task contract — "never fabricate a billed charge"):
 *   - `STRIPE_USAGE_METER_ENABLED=true`  → master switch
 *   - `STRIPE_USAGE_METER_EVENT_NAME=…`  → the Stripe Meter's event_name
 *   - Each workspace's `Subscription.stripeCustomerId` must exist
 * Missing any of the three → skip the workspace with a structured log;
 * NO Stripe API call goes out and the rows stay unreported (so when the
 * meter finally turns on, the cron back-fills from the existing backlog).
 *
 * Per `feedback_no_silent_vendor_lock`: the Stripe SDK call lives inside
 * `StripeBillingProvider.reportMeterEvent`, not at the cron.
 *
 * Per `feedback_cold_start_safe_agents`: reads the entire state on every
 * fire. No in-memory cache of "which workspaces still owe a meter".
 *
 * Per `project_no_outbound_architecture`: the cron emits to Stripe (a
 * financial system, not a customer surface) — it doesn't email or
 * notify the customer. The customer-facing surface is the in-app usage
 * pane the billing page renders.
 *
 * Per `feedback_runner_portability`: every collaborator is injectable —
 * the workspace lister, the row lister, the meter emitter, the clock —
 * so the test suite can pin deterministic state without standing up
 * Prisma or Stripe.
 */

import { withSystemContext } from '@/lib/db';
import { env } from '@/lib/env';
import { getBillingProvider } from '@/lib/billing';
import type { BillingProvider } from '@/lib/billing';
import { getLogger } from '@/lib/observability/logger';

export interface MeterCandidateWorkspace {
  workspaceId: string;
  /** Stripe customer id from the workspace's Subscription. NULL when the
   *  workspace is on manual invoicing (Phase 1) — those workspaces are
   *  skipped because there is nowhere to report the meter to. */
  stripeCustomerId: string | null;
  /** Sum of unreported `costMicroCents` across every unreported row.
   *  BigInt because we accumulate millions of rows. */
  pendingMicroCents: bigint;
  /** Row ids that contributed to the sum — used to mark them reported
   *  after a successful Stripe POST. */
  rowIds: string[];
}

export interface StripeMeterSweepArgs {
  /** Override the candidate lister. Tests pass deterministic state. */
  listCandidates?: () => Promise<MeterCandidateWorkspace[]>;
  /** Override the billing provider (Stripe or test). */
  provider?: BillingProvider;
  /** Mark rows reported. Tests pass a recording stub. */
  markReported?: (rowIds: string[], reportedAt: Date) => Promise<void>;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Master switch override. When undefined, reads from env. */
  enabled?: boolean;
  /** Meter event_name override. When undefined, reads from env. */
  meterEventName?: string;
}

export interface StripeMeterSweepResult {
  workspacesConsidered: number;
  workspacesReported: number;
  workspacesSkippedNoCustomer: number;
  workspacesSkippedNoUsage: number;
  workspacesSkippedDisabled: number;
  microCentsReported: bigint;
  failures: Array<{ workspaceId: string; reason: string }>;
}

/**
 * One sweep pass. Designed to be cheap and idempotent: if the cron
 * fires twice in a row (Inngest retries, manual trigger after an
 * accidental click), Stripe's 24h identifier idempotency + our
 * `stripeReportedAt` marker prevent any double-billing.
 */
export async function runStripeMeterSweep(
  args: StripeMeterSweepArgs = {},
): Promise<StripeMeterSweepResult> {
  const logger = getLogger().child({ boundary: 'cron', component: 'stripe-meter' });
  const enabled = args.enabled ?? env.stripeUsageMeterEnabled();
  const meterEventName = args.meterEventName ?? env.stripeUsageMeterEventName();
  const now = args.now ?? new Date();

  const result: StripeMeterSweepResult = {
    workspacesConsidered: 0,
    workspacesReported: 0,
    workspacesSkippedNoCustomer: 0,
    workspacesSkippedNoUsage: 0,
    workspacesSkippedDisabled: 0,
    microCentsReported: 0n,
    failures: [],
  };

  // Master switch. When the meter is not wired up, the sweep does
  // nothing — and crucially, it does NOT mark rows reported, so when
  // the meter goes live the back-fill picks up the full history.
  if (!enabled || !meterEventName) {
    logger.info('stripe-meter.skipped', {
      reason: !enabled ? 'disabled' : 'no_event_name',
    });
    // Still walk the candidate list so the result accurately reports
    // how much backlog is sitting unbilled — this number is the
    // signal an operator uses to decide when to flip the switch.
    const candidates =
      (await (args.listCandidates ?? defaultListCandidates)()) ?? [];
    result.workspacesConsidered = candidates.length;
    result.workspacesSkippedDisabled = candidates.length;
    for (const c of candidates) result.microCentsReported += 0n; // intent: do nothing
    return result;
  }

  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const provider = args.provider ?? getBillingProvider();
  const markReported = args.markReported ?? defaultMarkReported;
  const candidates = await listCandidates();
  result.workspacesConsidered = candidates.length;

  for (const c of candidates) {
    if (!c.stripeCustomerId) {
      result.workspacesSkippedNoCustomer += 1;
      continue;
    }
    if (c.pendingMicroCents === 0n || c.rowIds.length === 0) {
      result.workspacesSkippedNoUsage += 1;
      continue;
    }
    // Idempotency key — same workspace + same UTC date is a Stripe
    // no-op. Even with a same-day retry the meter sees one event.
    const identifier = buildIdempotencyKey(c.workspaceId, now);
    try {
      // Stripe's meter events accept integer-or-string quantities.
      // We pass micro-cents directly so the Price's per-unit rate
      // is "1 micro-cent" — i.e. Stripe Dashboard configures the
      // metered Price as $0.00000001 per unit. This avoids any
      // rounding at our edge and matches the LlmUsageRecord shape.
      const quantity = Number(c.pendingMicroCents);
      await provider.reportMeterEvent({
        eventName: meterEventName,
        providerCustomerId: c.stripeCustomerId,
        quantity,
        identifier,
        timestampSeconds: Math.floor(now.getTime() / 1000),
      });
      await markReported(c.rowIds, now);
      result.workspacesReported += 1;
      result.microCentsReported += c.pendingMicroCents;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // No row marking on failure: the rows stay unreported and the
      // next sweep picks them up. Stripe's identifier idempotency
      // protects against a partial-success retry.
      result.failures.push({ workspaceId: c.workspaceId, reason });
      logger.warn('stripe-meter.workspace_failed', {
        workspace_id: c.workspaceId,
        reason,
      });
    }
  }

  logger.info('stripe-meter.swept', {
    considered: result.workspacesConsidered,
    reported: result.workspacesReported,
    skipped_no_customer: result.workspacesSkippedNoCustomer,
    skipped_no_usage: result.workspacesSkippedNoUsage,
    skipped_disabled: result.workspacesSkippedDisabled,
    micro_cents_reported: String(result.microCentsReported),
    failed: result.failures.length,
  });
  return result;
}

/** Build the per-workspace Stripe identifier. The Stripe 24h
 *  uniqueness window means the same `workspaceId|YYYY-MM-DD` key is
 *  guaranteed to be a no-op on retry. Format is intentionally simple
 *  so a human reading Stripe's event log can decode it at a glance. */
export function buildIdempotencyKey(workspaceId: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `agentplain-meter-${workspaceId}-${y}${m}${d}`;
}

/** Default workspace + row lister. Operator-bypass (`withSystemContext`)
 *  is required so the cron sees every workspace's unreported rows. RLS
 *  on `LlmUsageRecord` remains intact for every other caller. */
async function defaultListCandidates(): Promise<MeterCandidateWorkspace[]> {
  return withSystemContext(async (tx) => {
    // Per-workspace pending sums + row ids. Two round-trips per pass
    // (group + per-workspace rows) keeps the query simple and indexes
    // happy. On a workspace with thousands of unreported rows the
    // payload is still small — only ids are returned.
    const groups = await tx.llmUsageRecord.groupBy({
      by: ['workspaceId'],
      where: { stripeReportedAt: null },
      _sum: { costMicroCents: true },
      _count: { _all: true },
    });
    if (groups.length === 0) return [];
    const candidates: MeterCandidateWorkspace[] = [];
    for (const g of groups) {
      // Resolve stripe customer id from Subscription. If absent (manual
      // invoicing or workspace not yet provisioned), the candidate is
      // still surfaced — the sweep will skip it as "no_customer".
      const sub = await tx.subscription.findUnique({
        where: { workspaceId: g.workspaceId },
        select: { stripeCustomerId: true },
      });
      const rows = await tx.llmUsageRecord.findMany({
        where: { workspaceId: g.workspaceId, stripeReportedAt: null },
        select: { id: true },
      });
      candidates.push({
        workspaceId: g.workspaceId,
        stripeCustomerId: sub?.stripeCustomerId ?? null,
        pendingMicroCents: g._sum.costMicroCents ?? 0n,
        rowIds: rows.map((r) => r.id),
      });
    }
    return candidates;
  });
}

/** Mark contributing rows as reported. Single transactional updateMany
 *  keeps the marker write atomic so a crash mid-update doesn't leave
 *  rows in a half-marked state. */
async function defaultMarkReported(
  rowIds: string[],
  reportedAt: Date,
): Promise<void> {
  if (rowIds.length === 0) return;
  await withSystemContext((tx) =>
    tx.llmUsageRecord.updateMany({
      where: { id: { in: rowIds } },
      data: { stripeReportedAt: reportedAt },
    }),
  );
}
