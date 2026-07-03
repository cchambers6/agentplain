/**
 * lib/outreach/stages.ts
 *
 * Stage ladder for the design-partner outreach CRM-lite. The ladder, the
 * forecast weights, and the "every non-terminal row carries a next action"
 * rule are ratified in docs/sales/deep-dive-2026-07-02/06-pipeline-and-
 * forecasting.md — this module encodes them once so the operator UI, the
 * server actions, and the tests all read the same truth.
 *
 * PURE — no I/O, no Prisma. The Prisma enum (OutreachStage) mirrors
 * STAGE_ORDER; tests/outreach-stages.test.ts pins the two in lockstep.
 */

import type { OutreachStage, OutreachTouchKind } from "@prisma/client";

export interface StageMeta {
  /** Operator-facing label. */
  label: string;
  /** Doc-06 forecast weight (probability-to-convert), 0–1. */
  weight: number;
  /** Terminal stages don't require a next action; everything else does. */
  terminal: boolean;
  /** One-line entry criterion, straight from doc 06 §1. */
  entry: string;
}

/** Ladder order, doc 06 §1 — also the sort order for the pipeline board. */
export const STAGE_ORDER: readonly OutreachStage[] = [
  "LIST",
  "FIT",
  "DISCOVERY",
  "DP_TALK",
  "AGREEMENT",
  "ACTIVATION",
  "ACTIVE_PILOT",
  "NOT_YET",
  "LOST",
] as const;

export const STAGES: Record<OutreachStage, StageMeta> = {
  LIST: {
    label: "List",
    weight: 0,
    terminal: false,
    entry: "On the prospect list, enriched, lane open",
  },
  FIT: {
    label: "Fit",
    weight: 0.05,
    terminal: false,
    entry: "First touch sent; not disqualified",
  },
  DISCOVERY: {
    label: "Discovery",
    weight: 0.2,
    terminal: false,
    entry: "Discovery call booked or held",
  },
  DP_TALK: {
    label: "DP talk",
    weight: 0.4,
    terminal: false,
    entry: "Program terms presented; prospect engaging",
  },
  AGREEMENT: {
    label: "Agreement",
    weight: 0.75,
    terminal: false,
    entry: "Verbal yes; agreement out for signature",
  },
  ACTIVATION: {
    label: "Activation",
    weight: 0.9,
    terminal: false,
    entry: "Signed; stack check underway",
  },
  ACTIVE_PILOT: {
    label: "Active pilot",
    weight: 1,
    terminal: false,
    entry: "Drafts flowing, weekly cadence running",
  },
  NOT_YET: {
    label: "Not yet",
    weight: 0,
    terminal: true,
    entry: "Named blocker + revisit date; re-enters at Fit",
  },
  LOST: {
    label: "Lost",
    weight: 0,
    terminal: true,
    entry: "Clean no",
  },
};

export const TOUCH_KINDS: Record<OutreachTouchKind, string> = {
  EMAIL_SENT: "Email sent",
  REPLY_RECEIVED: "Reply received",
  CALL_HELD: "Call held",
  NOTE: "Note",
  STAGE_CHANGE: "Stage change",
};

export function isTerminal(stage: OutreachStage): boolean {
  return STAGES[stage].terminal;
}

/**
 * Doc 06's stuck rule: a non-terminal row without a next-action date is
 * stuck by definition. (NOT_YET rows use revisitDate instead; LOST needs
 * nothing.)
 */
export function isStuck(row: {
  stage: OutreachStage;
  nextActionDate: Date | null;
}): boolean {
  return !isTerminal(row.stage) && row.nextActionDate === null;
}

/** All stages are reachable from all stages (real pipelines skip and
 *  regress); this only rejects unknown values coming off a form post. */
export function isOutreachStage(value: string): value is OutreachStage {
  return (STAGE_ORDER as readonly string[]).includes(value);
}

export function isTouchKind(value: string): value is OutreachTouchKind {
  return value in TOUCH_KINDS;
}
