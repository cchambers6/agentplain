/**
 * lib/plaino/chat-retention.ts
 *
 * Retention policy for Plaino chat history.
 *
 * **Default: the lifetime of the account.** Plaino is a service partner — the
 * whole point is that he gets smarter about *your* business over time, so his
 * conversation history is kept for as long as the account is active and is
 * hard-deleted only when the account is closed (and exportable any time before
 * that). Forgetting the business every day would defeat the product.
 *
 * A privacy-conscious customer may **opt in** to a finite auto-purge window
 * (workspace-wide via `WorkspacePreference.chatRetentionDays`, or per-thread
 * via `ChatThread.retentionDays`). That is the customer's explicit choice — we
 * never shorten retention on their behalf.
 *
 * Resolution (most specific wins):
 *   thread.retentionDays → workspacePreference.chatRetentionDays → null (keep)
 *
 * A `null` result means "keep for the account lifetime" — the cleanup sweep
 * never touches it. A finite value means the customer opted into auto-purge.
 */

/** Floor for an opt-in finite window — never below one day, so the sweep
 *  can't race a live conversation. */
export const MIN_RETENTION_DAYS = 1;

export interface ResolveRetentionArgs {
  /** Workspace-wide opt-in window (WorkspacePreference.chatRetentionDays). */
  workspaceOverrideDays?: number | null;
  /** Per-thread opt-in window (ChatThread.retentionDays). */
  threadOverrideDays?: number | null;
}

/**
 * The effective retention window in days, or `null` for "keep for the account
 * lifetime" (the default). Finite values are floored at MIN_RETENTION_DAYS.
 */
export function resolveChatRetentionDays(
  args: ResolveRetentionArgs,
): number | null {
  const clamp = (n: number) => Math.max(MIN_RETENTION_DAYS, Math.round(n));
  if (typeof args.threadOverrideDays === 'number') return clamp(args.threadOverrideDays);
  if (typeof args.workspaceOverrideDays === 'number') return clamp(args.workspaceOverrideDays);
  return null; // lifetime — the default
}

/**
 * A thread is expired only when the customer opted into a finite window AND
 * the last activity is older than it. With the default (null) window a thread
 * is NEVER expired — it's kept for the account lifetime.
 */
export function isThreadExpired(args: {
  updatedAt: Date;
  effectiveRetentionDays: number | null;
  now: Date;
}): boolean {
  if (args.effectiveRetentionDays === null) return false; // kept for lifetime
  const cutoff = new Date(
    args.now.getTime() - args.effectiveRetentionDays * 24 * 60 * 60 * 1000,
  );
  return args.updatedAt.getTime() < cutoff.getTime();
}

/**
 * Validate a customer-submitted retention choice. `null` means "keep for the
 * account lifetime" (the default / recommended); a finite value is floored.
 */
export function validateRetentionChoice(args: {
  requestedDays: number | null;
}): { days: number | null } {
  if (args.requestedDays === null) return { days: null };
  return { days: Math.max(MIN_RETENTION_DAYS, Math.round(args.requestedDays)) };
}
