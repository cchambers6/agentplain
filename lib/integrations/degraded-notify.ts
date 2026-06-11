/**
 * lib/integrations/degraded-notify.ts
 *
 * Degraded-mode hold-and-flush for NON-critical integration side-effects
 * (pfd-2). The rule: if a non-critical integration (Slack notifications,
 * Notion mirrors) is down, the PRIMARY action still happens — only the
 * notification is held in the retry queue and flushed on reconnect.
 *
 * A producer that wants to fire a non-critical Slack notification calls
 * `notifyOrHold` AFTER its primary action has already succeeded. The helper:
 *   1. tries the notify executor;
 *   2. on success, returns `{ delivered: true }`;
 *   3. on failure (or when the integration is known-broken), HOLDS the
 *      notification in the retry queue (status HELD) keyed on an idempotency
 *      key, and returns `{ delivered: false, held: true }`.
 *
 * The held row flushes on reconnect via the retry-queue resume sweep, which
 * runs the registered `slack.notify` handler. Because the primary action
 * already ran, a non-critical integration being down can NEVER block customer
 * work — it only delays a ping.
 *
 * Per feedback_no_silent_vendor_lock: the Slack post itself stays behind the
 * Slack MCP adapter; this helper only orchestrates try-then-hold.
 */

import type { IntegrationProvider, Prisma } from '@prisma/client';
import { holdRetryableAction } from './retry-queue';
import { ACTION_SLACK_NOTIFY } from './retry-handlers';
import type { RetryStore } from './retry-store';

export interface NotifyOrHoldArgs {
  workspaceId: string;
  /** Non-critical integration the notification rides on (e.g. 'SLACK'). */
  provider: IntegrationProvider;
  /** actionKind the resume handler dispatches on. Defaults to 'slack.notify'. */
  actionKind?: string;
  /** Stable idempotency key — the resume handler keys the post on this so a
   *  flush racing a retry never double-posts. */
  idempotencyKey: string;
  /** The notification payload, persisted so the resume can re-fire it. */
  payload: Prisma.InputJsonValue;
  /** The actual notify executor (the Slack post). Returns ok/false. Injected so
   *  the Slack MCP adapter stays the single vendor seam + tests stay offline. */
  notify: () => Promise<{ ok: boolean; detail?: string }>;
  /** Retry-queue store for the hold. Defaults to Prisma; tests inject in-memory. */
  store?: RetryStore;
  now?: Date;
}

export interface NotifyOrHoldResult {
  delivered: boolean;
  held: boolean;
  detail?: string;
}

/**
 * Try to deliver a non-critical notification; hold it in the retry queue on
 * failure. NEVER throws — a degraded notification path must never bubble an
 * error up into the primary action that already succeeded.
 */
export async function notifyOrHold(
  args: NotifyOrHoldArgs,
): Promise<NotifyOrHoldResult> {
  let outcome: { ok: boolean; detail?: string };
  try {
    outcome = await args.notify();
  } catch (err) {
    outcome = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  if (outcome.ok) {
    return { delivered: true, held: false };
  }

  // Hold for flush-on-reconnect. Best-effort: if even the hold fails we still
  // return cleanly — the primary action already happened, so the worst case is
  // a lost ping, never lost customer work.
  try {
    await holdRetryableAction({
      workspaceId: args.workspaceId,
      provider: args.provider,
      actionKind: args.actionKind ?? ACTION_SLACK_NOTIFY,
      payload: args.payload,
      idempotencyKey: args.idempotencyKey,
      store: args.store,
      now: args.now,
    });
    return { delivered: false, held: true, detail: outcome.detail };
  } catch (err) {
    return {
      delivered: false,
      held: false,
      detail: `notify failed (${outcome.detail}) and hold failed (${
        err instanceof Error ? err.message : String(err)
      })`,
    };
  }
}
