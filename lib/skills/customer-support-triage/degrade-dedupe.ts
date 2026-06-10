/**
 * lib/skills/customer-support-triage/degrade-dedupe.ts
 *
 * "Page ONCE, not per-ticket" for the LLM-degraded path. When the model is
 * down, every inbound support message degrades to escalate-everything. The
 * customer on each ticket still gets an honest human-escalation reply and
 * is marked escalated — but the OPERATOR should be paged once per outage
 * window, not flooded with one page per ticket.
 *
 * Mechanism: a fleet-wide OpsFlag holds the last degrade-page timestamp.
 * The first degraded fire after the cooldown window pages + stamps the
 * flag; subsequent degraded fires inside the window skip the page (the
 * customer reply + escalation mark + metrics still happen). Cold-start
 * safe — the dedupe state is durable in the store, not in-memory, so it
 * survives across the stateless Inngest fires that actually carry the
 * tickets.
 *
 * Fail-OPEN on a store error: if we can't read the dedupe flag we PAGE
 * (better a duplicate page than a silent outage). This is the one place we
 * prefer noise to silence.
 */

import type { OpsFlagStore } from '../../ops/flag-store';

/** Fleet-wide OpsFlag holding the last degrade-page ISO timestamp. */
export const DEGRADE_PAGE_FLAG = 'SUPPORT_TRIAGE_DEGRADE_LAST_PAGE_AT';

/** Cooldown window (ms) — at most one degrade page per hour. */
export const DEGRADE_PAGE_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Should this degraded fire page the operator? True for the first fire
 * after the cooldown; false while inside the window. Stamps the flag when
 * it returns true. Fail-open (returns true) on any store error.
 */
export async function shouldPageForDegrade(args: {
  store: OpsFlagStore;
  now: Date;
  cooldownMs?: number;
}): Promise<boolean> {
  const cooldown = args.cooldownMs ?? DEGRADE_PAGE_COOLDOWN_MS;
  let last: number | null = null;
  try {
    const read = await args.store.get(DEGRADE_PAGE_FLAG);
    if (!read.ok) return true; // fail-open: page rather than go silent
    if (read.value && read.value.value) {
      const t = Date.parse(read.value.value);
      if (Number.isFinite(t)) last = t;
    }
  } catch {
    return true; // fail-open
  }

  if (last !== null && args.now.getTime() - last < cooldown) {
    return false; // inside the cooldown window — skip the page
  }

  // First page (or window elapsed): stamp + page.
  try {
    await args.store.set(DEGRADE_PAGE_FLAG, args.now.toISOString(), {
      updatedBy: 'customer-support-triage',
      note: 'last operator page for LLM-degraded support triage',
    });
  } catch {
    // stamping failed — still page; worst case we page again next ticket.
  }
  return true;
}
