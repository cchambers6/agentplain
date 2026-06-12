/**
 * lib/billing/workspace-paused-gate.ts
 *
 * Wave-3 phase 5 — workspace-paused gate. The /billing surface has
 * promised since wave-2 that "agents pause until billing is current",
 * but until this module shipped no code actually read
 * `Subscription.status` to enforce that. This is the single seam
 * every cron + Inngest function consults at fire time so the copy
 * matches the runtime.
 *
 * Statuses gated as PAUSED:
 *   - PAUSED           — explicit pause (the most-specific signal); also
 *                        the hard-gate state the dunning sweep flips a
 *                        PAST_DUE subscription into once its grace window
 *                        is exhausted (lib/billing/dunning.ts)
 *   - PAST_DUE *past grace* — payment failed AND the paid-through date
 *                        (currentPeriodEnd) has passed. While the period
 *                        the customer already paid for is still running,
 *                        PAST_DUE is NOT gated — the fleet keeps working
 *                        through the grace window, matching the
 *                        /settings/billing banner copy ("fleet keeps
 *                        running through <date>"). Before this seam the
 *                        gate paused PAST_DUE immediately, contradicting
 *                        that promise.
 *
 * Statuses NOT gated (the workspace stays "active for skills"):
 *   - TRIALING         — trial subscriptions run as full active
 *   - ACTIVE           — paying customer
 *   - INCOMPLETE       — first invoice not yet finalized — historically
 *                        we let them run; tightening this would block
 *                        signup onboarding
 *   - CANCELED         — workspace data is preserved but the closure
 *                        sweep tears it down on its own cadence
 *   - INCOMPLETE_EXPIRED / UNPAID — extreme states the closure cron
 *                                   handles independently
 *
 * Per `feedback_cold_start_safe_agents.md`: every caller reads the
 * subscription fresh per fire. No in-memory cache.
 *
 * Per `project_no_outbound_architecture.md`: this module reads state.
 * It writes nothing.
 */

import type { SubscriptionStatus } from '@prisma/client';
import type { DbTransactionClient } from '@/lib/db';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

/** Subscription statuses that cause skill fires to skip with the
 *  "paused for billing" reason. */
export const SKILL_PAUSED_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'PAUSED',
  'PAST_DUE',
];

export interface IsWorkspacePausedArgs {
  workspaceId: string;
  systemContext?: SystemContextRunner;
  /** Injected for deterministic tests; live callers omit it (→ now). The
   *  PAST_DUE grace check compares this against `currentPeriodEnd`. */
  now?: Date;
}

export interface WorkspacePauseState {
  isPaused: boolean;
  /** The status the gate read — surfaced for logs + tests. */
  status: SubscriptionStatus | null;
  /** Short, customer-safe reason string for audit logs / cron logs. */
  reason: string;
}

/**
 * Read the workspace's subscription status + the wave-4 abandoned-
 * signup `setupDeactivatedAt` column, then decide whether skill fires
 * should be skipped for billing reasons. Callers use this BEFORE any
 * LLM call so a paused workspace pays nothing.
 *
 * Workspaces with no Subscription row at all are treated as "active for
 * skills" UNLESS their `setupDeactivatedAt` is set (the wave-4
 * abandoned-signup sweep flips this when 7d have elapsed without
 * checkout). That closes the honesty gap PR #123 named — pre-wave-4 a
 * workspace that abandoned Stripe Checkout slipped through the gate
 * forever because it had no Subscription row at all.
 */
export async function isWorkspacePaused(
  args: IsWorkspacePausedArgs,
): Promise<WorkspacePauseState> {
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const now = args.now ?? new Date();
  const { sub, workspace } = await systemContext(async (tx) => {
    const [s, w] = await Promise.all([
      tx.subscription.findUnique({
        where: { workspaceId: args.workspaceId },
        select: { status: true, currentPeriodEnd: true },
      }),
      tx.workspace.findUnique({
        where: { id: args.workspaceId },
        select: { setupDeactivatedAt: true },
      }),
    ]);
    return { sub: s, workspace: w };
  });

  // Wave-4 — abandoned-signup workspaces gate FIRST. They typically have
  // no Subscription row at all (or one stuck in INCOMPLETE), so the
  // legacy null-sub branch below would have let them slip through.
  if (workspace?.setupDeactivatedAt) {
    return {
      isPaused: true,
      status: sub?.status ?? null,
      reason: `workspace.setupDeactivatedAt=${workspace.setupDeactivatedAt.toISOString()} — abandoned signup; skill fires paused until customer completes Stripe Checkout`,
    };
  }
  if (!sub) {
    return {
      isPaused: false,
      status: null,
      reason: 'no subscription row — treating as active',
    };
  }

  // PAST_DUE grace window. The customer paid for the current period; a
  // failed renewal does NOT cut service mid-period. We keep the fleet
  // running until `currentPeriodEnd` (the paid-through date), then pause.
  // A null/missing period anchor is treated as past-grace (fail-closed —
  // we cannot prove the customer is still inside a paid window).
  if (sub.status === 'PAST_DUE') {
    const periodEnd = sub.currentPeriodEnd ?? null;
    const withinGrace = periodEnd !== null && now < periodEnd;
    if (withinGrace) {
      return {
        isPaused: false,
        status: sub.status,
        reason: `subscription.status=PAST_DUE but within grace through ${periodEnd.toISOString()} — fleet keeps running until the paid period ends`,
      };
    }
    return {
      isPaused: true,
      status: sub.status,
      reason: periodEnd
        ? `subscription.status=PAST_DUE and grace window ended ${periodEnd.toISOString()} — skill fires paused until billing is current`
        : `subscription.status=PAST_DUE with no current-period anchor — skill fires paused (fail-closed) until billing is current`,
    };
  }

  const paused = SKILL_PAUSED_STATUSES.includes(sub.status);
  return {
    isPaused: paused,
    status: sub.status,
    reason: paused
      ? `subscription.status=${sub.status} — skill fires paused until billing is current`
      : `subscription.status=${sub.status} — active for skills`,
  };
}

/**
 * Convenience: returns just the boolean. Same back-end as
 * `isWorkspacePaused` — use when the caller does not need the reason
 * string.
 */
export async function isSkillExecutionPausedForWorkspace(
  args: IsWorkspacePausedArgs,
): Promise<boolean> {
  const state = await isWorkspacePaused(args);
  return state.isPaused;
}
