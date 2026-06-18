/**
 * lib/plaino/chat-retention.ts
 *
 * Retention policy for Plaino chat history — the data-minimization stance:
 * chat is SESSION-SCOPED by default and only kept longer if the customer
 * explicitly opts in.
 *
 *   • Default: every workspace keeps chat for `DEFAULT_RETENTION_DAYS` (2
 *     days). After that the daily cleanup sweep deletes the thread + its
 *     messages. This is the "we don't hoard your conversations" default.
 *
 *   • Customer extension: the owner can raise the window on the storage
 *     surface, up to a per-tier ceiling. This is opt-in — we never extend
 *     retention on the customer's behalf.
 *
 *   • Per-thread override: a thread may carry its own `retentionDays` (e.g.
 *     a thread the customer pinned for reference). It overrides the
 *     workspace setting but is still clamped to the tier ceiling.
 *
 * Resolution order (most specific wins), all clamped to [MIN, tier ceiling]:
 *   thread.retentionDays  →  workspacePreference.chatRetentionDays  →  default
 *
 * Pinned memory entries Plaino extracted from a thread are NOT deleted by
 * retention — they live on `WorkspaceMemoryEntry` with `onDelete: SetNull`
 * on the source-message FK, so clearing a thread leaves learned memory
 * intact (that's the customer's curated knowledge, a separate opt-in
 * category) while the raw conversation evaporates.
 *
 * NB: the per-tier ceilings below are DEFAULTS PENDING CONNER SIGNOFF — see
 * docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md. They are deliberately
 * conservative (short default, generous ceiling) so the commitment is
 * deliverable today and can be tightened/loosened by changing this one block.
 */

import type { TierName } from '../pricing/tiers';

/** Session-scoped default — applies to every workspace until the customer
 *  opts into a longer window. 2 days ≈ "this session + yesterday's". */
export const DEFAULT_RETENTION_DAYS = 2;

/** Floor — a customer can shorten retention but never below one day (so the
 *  sweep can't race a live conversation). */
export const MIN_RETENTION_DAYS = 1;

/**
 * Per-tier maximum retention a customer may opt into. DEFAULTS PENDING
 * CONNER SIGNOFF. `plus` is the on-disk identity for the "Partner" tier.
 */
export const TIER_MAX_RETENTION_DAYS: Record<TierName, number> = {
  regular: 30,
  plus: 90,
  max: 365,
};

/** Fallback tier when a workspace has no subscription row yet (trial /
 *  unprovisioned). The most conservative ceiling. */
export const FALLBACK_TIER: TierName = 'regular';

function normalizeTier(tier: string | null | undefined): TierName {
  if (tier === 'regular' || tier === 'plus' || tier === 'max') return tier;
  return FALLBACK_TIER;
}

export function maxRetentionDaysForTier(tier: string | null | undefined): number {
  return TIER_MAX_RETENTION_DAYS[normalizeTier(tier)];
}

export interface ResolveRetentionArgs {
  /** Subscription tier string ("regular" | "plus" | "max") or null. */
  tier: string | null | undefined;
  /** Workspace-wide opt-in override (WorkspacePreference.chatRetentionDays). */
  workspaceOverrideDays?: number | null;
  /** Per-thread override (ChatThread.retentionDays). */
  threadOverrideDays?: number | null;
}

/**
 * The effective retention window in days for a thread. Always within
 * [MIN_RETENTION_DAYS, tier ceiling].
 */
export function resolveChatRetentionDays(args: ResolveRetentionArgs): number {
  const ceiling = maxRetentionDaysForTier(args.tier);
  const clamp = (n: number) => Math.max(MIN_RETENTION_DAYS, Math.min(n, ceiling));

  if (typeof args.threadOverrideDays === 'number') {
    return clamp(args.threadOverrideDays);
  }
  if (typeof args.workspaceOverrideDays === 'number') {
    return clamp(args.workspaceOverrideDays);
  }
  // Default is session-scoped, but never exceeds the tier ceiling.
  return clamp(DEFAULT_RETENTION_DAYS);
}

/**
 * A thread is expired when its last activity (`updatedAt`) is older than its
 * effective retention window.
 */
export function isThreadExpired(args: {
  updatedAt: Date;
  effectiveRetentionDays: number;
  now: Date;
}): boolean {
  const cutoff = new Date(
    args.now.getTime() - args.effectiveRetentionDays * 24 * 60 * 60 * 1000,
  );
  return args.updatedAt.getTime() < cutoff.getTime();
}

/**
 * Validate a customer-submitted retention value against the tier ceiling.
 * Returns the clamped value + whether it was adjusted (for UI feedback).
 */
export function validateRetentionChoice(args: {
  requestedDays: number;
  tier: string | null | undefined;
}): { days: number; clamped: boolean } {
  const ceiling = maxRetentionDaysForTier(args.tier);
  const days = Math.max(MIN_RETENTION_DAYS, Math.min(Math.round(args.requestedDays), ceiling));
  return { days, clamped: days !== Math.round(args.requestedDays) };
}
