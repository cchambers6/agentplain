/**
 * lib/support/tickets/sla.ts
 *
 * The first-response SLA the support channel PROMISES the customer — and the
 * one staff are measured against. The promise is load-bearing: it is the
 * concrete commitment that turns "I filed a ticket into the void" into "a
 * human will reply within one business day." Conner staffs L1 triage against
 * these numbers, so they live in ONE place, not scattered across copy.
 *
 * Default first-response target: 24 hours (one business day). Higher-priority
 * tickets tighten it. Pure + cold-start safe — no clock state, the caller
 * passes `now`.
 */

import type { TicketPriority } from "./types";

/** The headline promise shown on every ticket + in the confirmation email. */
export const DEFAULT_FIRST_RESPONSE_HOURS = 24;

/** Per-priority first-response window, in hours. P2 (the default) is the
 *  headline 24h promise; the others scale around it. */
export const FIRST_RESPONSE_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  P0: 1,
  P1: 4,
  P2: 24,
  P3: 48,
};

/** Compute the first-response deadline for a ticket. */
export function computeFirstResponseDueAt(
  priority: TicketPriority,
  createdAt: Date,
): Date {
  const hours = FIRST_RESPONSE_HOURS_BY_PRIORITY[priority];
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

/** Human label for the window, e.g. "within 24 hours" / "within 1 hour". */
export function slaWindowLabel(priority: TicketPriority): string {
  const hours = FIRST_RESPONSE_HOURS_BY_PRIORITY[priority];
  if (hours === 1) return "within 1 hour";
  return `within ${hours} hours`;
}

/** The exact customer-facing acknowledgement line. Tested verbatim so the
 *  promise can't silently drift. */
export function firstResponsePromise(priority: TicketPriority): string {
  return `Got it. Expected first response: ${slaWindowLabel(priority)}.`;
}

/** Format the public ticket number, e.g. 1042 → "#1042". */
export function formatTicketNumber(n: number): string {
  return `#${n}`;
}

/** Is this ticket past its first-response SLA with no staff reply yet? */
export function isSlaBreached(
  firstResponseDueAt: Date | null,
  firstRespondedAt: Date | null,
  now: Date,
): boolean {
  if (firstRespondedAt) return false; // clock stopped — responded in time or not, it's answered
  if (!firstResponseDueAt) return false;
  return now.getTime() > firstResponseDueAt.getTime();
}
