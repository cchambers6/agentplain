// CreatorBrief status machine.
//
// A brief moves DRAFT → BRIEFED → DELIVERED → ACCEPTED, with REJECTED and
// CANCELLED as side exits. The transitions are enforced here as a pure
// function so both the operator actions and any future agent caller share one
// definition of "what's allowed" — matching the dependency-inverted style of
// lib/billing/budget.ts.

import type { CreatorBriefStatus } from "@prisma/client";

/** The legal next-states from each status. ACCEPTED is terminal-success;
 *  CANCELLED is terminal. REJECTED can be re-briefed (back to BRIEFED) or
 *  cancelled. */
const TRANSITIONS: Record<CreatorBriefStatus, CreatorBriefStatus[]> = {
  DRAFT: ["BRIEFED", "CANCELLED"],
  BRIEFED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: ["BRIEFED", "CANCELLED"],
  CANCELLED: [],
};

/** True if `to` is a legal transition from `from`. Pure. */
export function canTransition(
  from: CreatorBriefStatus,
  to: CreatorBriefStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The legal next-states from `from`. Pure. */
export function nextStatuses(from: CreatorBriefStatus): CreatorBriefStatus[] {
  return TRANSITIONS[from];
}

/** True for the two terminal states — no further transition allowed. */
export function isTerminal(status: CreatorBriefStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** The acceptance decision is the only transition that requires a human
 *  operator's eyes (DELIVERED → ACCEPTED/REJECTED). Used to gate the
 *  decided-by stamp. */
export function isAcceptanceDecision(
  from: CreatorBriefStatus,
  to: CreatorBriefStatus,
): boolean {
  return from === "DELIVERED" && (to === "ACCEPTED" || to === "REJECTED");
}
