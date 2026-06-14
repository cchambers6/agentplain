/**
 * lib/support/tickets/routing.ts
 *
 * Resolve which staff member a new ticket is ASSIGNED to. Reuses the fleet's
 * single page-a-human recipient resolution (lib/ops/page-human →
 * resolveRecipients) so ticket assignment, credential pages, and every other
 * "a human needs this" path agree on exactly one routing source of truth:
 *   1. FLEET_TRUSTED_HUMAN_EMAIL (the designated trusted human),
 *   2. else the first OPERATOR_EMAIL_ALLOWLIST entry,
 *   3. else the baked-in last-resort admin inbox (#239 fallback) — so a
 *      ticket is NEVER born unassigned.
 *
 * Cold-start safe: reads env per call, no state.
 */

import { resolveRecipients } from "../../ops/page-human";

export interface TicketAssignment {
  /** The assignee email — ALWAYS non-empty. */
  email: string;
  /** True when assignment fell to the baked-in last-resort inbox because no
   *  operator routing is configured at all — the loud condition the staff
   *  inbox + create flow surface so "routing is missing" is never silent. */
  usedHardcodedFallback: boolean;
}

export function resolveTicketAssignee(
  env: NodeJS.ProcessEnv = process.env,
): TicketAssignment {
  const r = resolveRecipients(env);
  return {
    email: r.recipients[0],
    usedHardcodedFallback: r.usedHardcodedFallback,
  };
}
