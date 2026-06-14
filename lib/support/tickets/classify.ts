/**
 * lib/support/tickets/classify.ts
 *
 * Deterministic priority classification for a new ticket. Reuses the Pillar-3
 * L1 escalate-first classifier (lib/skills/customer-support-triage/escalation)
 * — the same LLM-free safety net that routes sensitive support messages to a
 * human — so a ticket describing a security report, a legal threat, a distress
 * signal, or a real billing dispute is born at P0/P1 and lands on a human fast,
 * exactly like the chat path. No LLM call: priority must be correct even when
 * the model is degraded (cold-start safe, pure over inputs).
 *
 * Category provides the floor; an escalation trigger raises it.
 */

import {
  classifyEscalation,
  type EscalationMatch,
} from "../../skills/customer-support-triage/escalation";
import type { SupportMessageSnapshot } from "../../skills/customer-support-triage/types";
import type { TicketCategory, TicketPriority } from "./types";

/** Default billing-dispute dollar threshold (USD) above which a money dispute
 *  escalates. Mirrors the triage config default; kept local so this module
 *  has no config dependency for a pure classify. */
export const TICKET_BILLING_DISPUTE_THRESHOLD_USD = 50;

/** Per-category baseline priority before escalation signals are applied. */
const CATEGORY_FLOOR: Record<TicketCategory, TicketPriority> = {
  // Money problems get a human within hours by default.
  BILLING: "P1",
  // A broken integration is blocking real work — high.
  INTEGRATION: "P1",
  // A bug is real but rarely account-down — normal.
  BUG: "P2",
  // A workflow question is normal.
  WORKFLOW: "P2",
  OTHER: "P2",
};

export interface TicketClassification {
  priority: TicketPriority;
  /** The escalation trigger that raised priority, if any (for the audit +
   *  the staff context). */
  escalation: EscalationMatch | null;
}

/**
 * Classify a ticket's priority from its category + free text. An escalation
 * trigger pins it to P0 (distress / vulnerability / data-deletion / legal) or
 * P1 (billing dispute over threshold / explicit human request); otherwise the
 * category floor applies.
 */
export function classifyTicketPriority(args: {
  category: TicketCategory;
  subject: string;
  description: string;
  billingDisputeThresholdUsd?: number;
}): TicketClassification {
  const snapshot = toSnapshot(args.subject, args.description);
  const escalation = classifyEscalation({
    message: snapshot,
    billingDisputeThresholdUsd:
      args.billingDisputeThresholdUsd ?? TICKET_BILLING_DISPUTE_THRESHOLD_USD,
  });

  const floor = CATEGORY_FLOOR[args.category];
  if (!escalation) {
    return { priority: floor, escalation: null };
  }

  // Severity-tiered: the gravest triggers are P0, the softer ones P1. We take
  // the higher (more urgent) of the escalation tier and the category floor.
  const escalationPriority: TicketPriority =
    escalation.trigger === "explicit-human-request" ||
    escalation.trigger === "billing-dispute-over-threshold"
      ? "P1"
      : "P0";

  return { priority: moreUrgent(escalationPriority, floor), escalation };
}

/** P0 < P1 < P2 < P3 by urgency; returns the more urgent of two. */
function moreUrgent(a: TicketPriority, b: TicketPriority): TicketPriority {
  const rank: Record<TicketPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return rank[a] <= rank[b] ? a : b;
}

/** Build the minimal escalation-classifier snapshot from ticket text. The
 *  classifier only reads subject + body, so the other fields are inert. */
function toSnapshot(subject: string, body: string): SupportMessageSnapshot {
  return {
    id: "ticket",
    workspaceId: "ticket",
    workspaceName: "ticket",
    verticalSlug: null,
    fromEmail: "ticket@ticket",
    fromName: null,
    subject,
    body,
    partnerName: "Plaino",
    receivedAt: new Date(0),
  };
}
