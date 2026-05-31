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
 *   - PAUSED           — explicit pause (the most-specific signal)
 *   - PAST_DUE         — payment failed; fleet runs through period end
 *                        only — see the banner in /settings/billing
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
}

export interface WorkspacePauseState {
  isPaused: boolean;
  /** The status the gate read — surfaced for logs + tests. */
  status: SubscriptionStatus | null;
  /** Short, customer-safe reason string for audit logs / cron logs. */
  reason: string;
}

/**
 * Read the workspace's subscription status and decide whether skill
 * fires should be skipped for billing reasons. Callers use this BEFORE
 * any LLM call so a paused workspace pays nothing.
 *
 * Workspaces with no Subscription row at all are treated as "active for
 * skills" — they predate the per-seat subscription rollout and the
 * trial-warning cron handles their lifecycle.
 */
export async function isWorkspacePaused(
  args: IsWorkspacePausedArgs,
): Promise<WorkspacePauseState> {
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const sub = await systemContext((tx) =>
    tx.subscription.findUnique({
      where: { workspaceId: args.workspaceId },
      select: { status: true },
    }),
  );
  if (!sub) {
    return {
      isPaused: false,
      status: null,
      reason: 'no subscription row — treating as active',
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
