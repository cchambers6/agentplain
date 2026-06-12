/**
 * lib/billing/sync-freshness.ts
 *
 * Stripe-sync freshness + the billing-sync FREEZE seam (Conner-dead P0 #5).
 *
 * THE FAILURE (the simulation): the Stripe webhook endpoint silently stops
 * processing for hours — a signature-secret rotation, a deploy that 500s on
 * dispatch, a DB blip — and Stripe's retries pile up undelivered. Our
 * subscription / billing state goes STALE while every surface keeps acting
 * as if it's current: we keep auto-executing billing-dependent work on data
 * we no longer trust. Nobody notices because "no webhook" looks exactly like
 * "a quiet, healthy account."
 *
 * THE FIX, two halves:
 *   1. The webhook route STAMPS a heartbeat on every successful dispatch
 *      (`stampWebhookOk`) and a marker on every failure (`stampWebhookError`).
 *      Freshness is then observable: "when did we last successfully process a
 *      Stripe event, and have we errored since?"
 *   2. An hourly cron (`fleet-freshness-sweep`) evaluates that heartbeat. When
 *      it's stale past the threshold, it FREEZES billing-dependent auto-exec
 *      (`setBillingSyncFrozen`) and pages an admin. Billing-dependent actions
 *      consult `isBillingSyncFrozen` (threaded into the bounded-execute gate)
 *      and fail closed to the approval queue until sync recovers.
 *
 * Why a heartbeat and not "gap since last event": a healthy subscription
 * legitimately emits no webhooks for days, so "no event in 1h" is NOT a
 * failure signal. The honest signal is "we ERRORED processing a webhook and
 * haven't succeeded since" — that is a real outage, not a quiet account. We
 * therefore key staleness off the relationship between last-OK and last-ERROR,
 * not off wall-clock silence.
 *
 * All state lives on `OpsFlag` rows — NO migration, reusing the same store
 * the Inngest disable-gate + fleet-health snapshot use. Cold-start safe:
 * every read hits the durable flag, no in-memory cache.
 *
 * FAIL_LOUD: every reader degrades toward "page someone / freeze" on doubt,
 * never toward "looks fine." A flag the cron can't read is itself a reason to
 * surface, not to assume healthy.
 */

import type { OpsFlagStore } from '../ops/flag-store';

/** ISO timestamp of the last SUCCESSFULLY processed Stripe webhook. */
export const STRIPE_WEBHOOK_LAST_OK_FLAG = 'BILLING_STRIPE_WEBHOOK_LAST_OK';
/** JSON {at, detail} of the last FAILED Stripe webhook (sig/dispatch). */
export const STRIPE_WEBHOOK_LAST_ERROR_FLAG = 'BILLING_STRIPE_WEBHOOK_LAST_ERROR';
/** 'true' when billing-dependent actions are frozen due to stale sync. */
export const BILLING_SYNC_FROZEN_FLAG = 'BILLING_SYNC_FROZEN';

/** Default staleness threshold: the simulation's "4 hours" failure is well
 *  past this. We freeze after 1h of an unresolved error condition so a
 *  customer's billing-keyed work never runs hours on stale data. */
export const DEFAULT_SYNC_STALE_AFTER_MS = 60 * 60 * 1000;

/** Stamp the success heartbeat. Best-effort: a stamp failure must never make
 *  the webhook itself fail (the event was processed; the heartbeat is
 *  observability). Returns whether the stamp landed. */
export async function stampWebhookOk(
  store: OpsFlagStore,
  now: Date,
): Promise<boolean> {
  const res = await store.set(STRIPE_WEBHOOK_LAST_OK_FLAG, now.toISOString(), {
    updatedBy: 'system:stripe-webhook',
    note: 'last successful Stripe webhook dispatch',
  });
  return res.ok;
}

/** Record a processing failure (signature or dispatch). Best-effort. */
export async function stampWebhookError(
  store: OpsFlagStore,
  now: Date,
  detail: string,
): Promise<boolean> {
  const res = await store.set(
    STRIPE_WEBHOOK_LAST_ERROR_FLAG,
    JSON.stringify({ at: now.toISOString(), detail: detail.slice(0, 500) }),
    {
      updatedBy: 'system:stripe-webhook',
      note: 'last failed Stripe webhook processing',
    },
  );
  return res.ok;
}

export interface SyncFreshnessVerdict {
  /** True when sync is stale enough to freeze billing-dependent actions. */
  stale: boolean;
  /** Human-readable reason for the page / audit. */
  reason: string;
  lastOkAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorDetail: string | null;
  /** True when a flag could not be read — surfaced, never assumed-healthy. */
  storeError: boolean;
}

/**
 * Evaluate Stripe-sync freshness. STALE when there has been a processing
 * ERROR that is more recent than the last SUCCESS and is itself older than
 * the threshold (i.e. an unresolved error condition has persisted past the
 * grace window). A fresh success after the last error clears the condition.
 *
 * Pure over its injected store + clock; never throws.
 */
export async function evaluateStripeSyncFreshness(args: {
  store: OpsFlagStore;
  now: Date;
  staleAfterMs?: number;
}): Promise<SyncFreshnessVerdict> {
  const staleAfterMs = args.staleAfterMs ?? DEFAULT_SYNC_STALE_AFTER_MS;
  const okRead = await args.store.get(STRIPE_WEBHOOK_LAST_OK_FLAG);
  const errRead = await args.store.get(STRIPE_WEBHOOK_LAST_ERROR_FLAG);

  const lastOkAt =
    okRead.ok && okRead.value ? parseDate(okRead.value.value) : null;
  const parsedErr =
    errRead.ok && errRead.value ? parseErrorFlag(errRead.value.value) : null;
  const lastErrorAt = parsedErr?.at ?? null;
  const lastErrorDetail = parsedErr?.detail ?? null;

  // FAIL_LOUD: a store read failure is itself a surfaced condition — we
  // cannot conclude sync is healthy, so we flag it for the cron to page on.
  if (!okRead.ok || !errRead.ok) {
    return {
      stale: true,
      reason:
        'Cannot read Stripe-sync heartbeat flags — flag store unreachable. Treating as stale (cannot confirm billing sync is current).',
      lastOkAt,
      lastErrorAt,
      lastErrorDetail,
      storeError: true,
    };
  }

  // No error on record → nothing to freeze. (A quiet, healthy account emits
  // no webhooks for days; silence is not a failure.)
  if (!lastErrorAt) {
    return {
      stale: false,
      reason: 'No Stripe webhook processing errors on record.',
      lastOkAt,
      lastErrorAt,
      lastErrorDetail,
      storeError: false,
    };
  }

  // An error exists. If a SUCCESS landed after it, the condition recovered.
  if (lastOkAt && lastOkAt.getTime() >= lastErrorAt.getTime()) {
    return {
      stale: false,
      reason: 'Last Stripe webhook succeeded after the last error — recovered.',
      lastOkAt,
      lastErrorAt,
      lastErrorDetail,
      storeError: false,
    };
  }

  // Unresolved error. Stale once it has persisted past the grace window.
  const errorAgeMs = args.now.getTime() - lastErrorAt.getTime();
  if (errorAgeMs >= staleAfterMs) {
    const hours = (errorAgeMs / (60 * 60 * 1000)).toFixed(1);
    return {
      stale: true,
      reason: `Stripe webhook processing has been failing for ${hours}h with no success since (last error: ${lastErrorDetail ?? 'unknown'}). Billing state is stale.`,
      lastOkAt,
      lastErrorAt,
      lastErrorDetail,
      storeError: false,
    };
  }

  return {
    stale: false,
    reason: `A recent Stripe webhook error exists but is within the ${(staleAfterMs / 60000).toFixed(0)}m grace window.`,
    lastOkAt,
    lastErrorAt,
    lastErrorDetail,
    storeError: false,
  };
}

/** Read the freeze flag. Returns false on read error — the freeze is an
 *  EXTRA safety on top of the (already fail-closed) enable/ceiling reads, so
 *  a transient flag-store blip should not freeze ALL billing work fleet-wide.
 *  The cron is the durable enforcement; this is the per-decision consult. */
export async function isBillingSyncFrozen(store: OpsFlagStore): Promise<boolean> {
  const res = await store.get(BILLING_SYNC_FROZEN_FLAG);
  if (!res.ok || !res.value) return false;
  return res.value.value === 'true';
}

/** Set/clear the freeze flag. Idempotent. */
export async function setBillingSyncFrozen(
  store: OpsFlagStore,
  frozen: boolean,
  note: string,
): Promise<void> {
  await store.set(BILLING_SYNC_FROZEN_FLAG, frozen ? 'true' : 'false', {
    updatedBy: 'system:fleet-freshness-sweep',
    note,
  });
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseErrorFlag(raw: string): { at: Date | null; detail: string | null } | null {
  try {
    const obj = JSON.parse(raw) as { at?: string; detail?: string };
    return {
      at: obj.at ? parseDate(obj.at) : null,
      detail: obj.detail ?? null,
    };
  } catch {
    return null;
  }
}
