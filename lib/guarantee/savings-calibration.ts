/**
 * lib/guarantee/savings-calibration.ts
 *
 * The trial guarantee turned into a product feature: every action the
 * fleet completes for a customer is worth some number of minutes of the
 * owner's time saved. This file is the single, auditable source of those
 * estimates.
 *
 * THESE NUMBERS ARE CUSTOMER-VISIBLE. The workspace counter renders them
 * ("Plaino saved you 47 min this week") and the Day-7 guarantee evaluates
 * against their sum. Inflate them and you lose the customer's trust the
 * moment they do the math — so every estimate here is deliberately
 * CONSERVATIVE: the low end of how long the task takes a person doing it
 * by hand, not the high end. When unsure, round DOWN.
 *
 * Conner signs off on these before launch (see
 * docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md). Changing a number
 * here changes a number a customer sees — treat it like pricing copy.
 *
 * Per feedback_no_guesses_no_estimates: each base figure is a defensible
 * "by hand" floor, not a vibe. Rationale is inline per action.
 */

/**
 * The actions the fleet performs that save the owner real time. Kept
 * deliberately small and concrete — each maps to a thing the runtime
 * actually produces (a draft, a proposed meeting, a chased document),
 * never an abstraction. Adding one means there's a real workflow step
 * that emits it AND a defensible minute floor below.
 */
export type GuaranteeActionType =
  | 'drafted-email'
  | 'lead-enrichment'
  | 'document-chased'
  | 'meeting-scheduled'
  | 'invoice-sent'
  | 'tenant-notice-posted'
  | 'admin-task-handled';

export const GUARANTEE_ACTION_TYPES: readonly GuaranteeActionType[] = [
  'drafted-email',
  'lead-enrichment',
  'document-chased',
  'meeting-scheduled',
  'invoice-sent',
  'tenant-notice-posted',
  'admin-task-handled',
] as const;

/**
 * Base minutes saved per action — the cross-vertical default. Each is the
 * conservative "if the owner did this themselves" floor:
 *
 *   - drafted-email (10): read the thread, recall context, write a
 *     considered reply. Ten minutes is the low end for a non-trivial
 *     business email; trivial ones are filtered out as noise upstream.
 *   - lead-enrichment (5): pull who the lead is, what they asked, prior
 *     thread — the legwork before you can even reply.
 *   - document-chased (3): notice a doc is missing, find who owes it,
 *     write the nudge. Small but relentless; it's the count that adds up.
 *   - meeting-scheduled (8): check the calendar, propose times inside
 *     hours, write the offer. The back-and-forth is the expensive part.
 *   - invoice-sent (6): assemble the line items, confirm the amount,
 *     send. Conservative — assumes the data was already to hand.
 *   - tenant-notice-posted (12): a compliant notice (entry, late rent,
 *     renewal) has required language and a paper trail; doing it right
 *     by hand is slow.
 *   - admin-task-handled (4): the office-admin one-offs (verification
 *     codes, password resets, routine billing notes) — quick each, but
 *     real interruptions.
 */
const BASE_MINUTES: Record<GuaranteeActionType, number> = {
  'drafted-email': 10,
  'lead-enrichment': 5,
  'document-chased': 3,
  'meeting-scheduled': 8,
  'invoice-sent': 6,
  'tenant-notice-posted': 12,
  'admin-task-handled': 4,
};

/**
 * Per-vertical overrides, keyed by vertical slug (lib/auth/vertical-enum
 * SLUG_TO_ENUM). Only present where the work genuinely takes a different
 * amount of time in that trade. Absent verticals/actions fall through to
 * BASE_MINUTES. Overrides are also conservative — they exist to be
 * truthful, not to flatter the number.
 */
const VERTICAL_OVERRIDES: Partial<
  Record<string, Partial<Record<GuaranteeActionType, number>>>
> = {
  // Receipt/source-doc chasing at a CPA shop is a back-and-forth with a
  // client, not a one-line nudge — a touch longer than the default.
  cpa: { 'document-chased': 4 },
  // Intake + conflict documents in a law office carry more care per item.
  law: { 'document-chased': 5 },
  // Property managers post compliant tenant notices constantly; the
  // default already reflects that trade, kept explicit here for clarity.
  'property-management': { 'tenant-notice-posted': 12 },
};

/**
 * Minutes saved for one completed action in a given vertical. The single
 * function the rest of the feature calls — recording, the counter, and
 * the Day-7 evaluation all resolve minutes through here so there is one
 * place the numbers live.
 */
export function minutesSavedFor(
  action: GuaranteeActionType,
  verticalSlug: string,
): number {
  const override = VERTICAL_OVERRIDES[verticalSlug]?.[action];
  return override ?? BASE_MINUTES[action];
}

/** Human-readable label for an action — used in audit payloads, the
 *  counter's per-action breakdown, and the walk-away receipt. */
export function actionLabel(action: GuaranteeActionType): string {
  switch (action) {
    case 'drafted-email':
      return 'Email drafted';
    case 'lead-enrichment':
      return 'Lead enriched';
    case 'document-chased':
      return 'Document chased';
    case 'meeting-scheduled':
      return 'Meeting scheduled';
    case 'invoice-sent':
      return 'Invoice prepared';
    case 'tenant-notice-posted':
      return 'Tenant notice prepared';
    case 'admin-task-handled':
      return 'Admin task handled';
  }
}

/** Type guard so callers reading a string column (TimeSavingsEntry.actionType)
 *  can narrow safely before using it as a key. */
export function isGuaranteeActionType(
  value: string,
): value is GuaranteeActionType {
  return (GUARANTEE_ACTION_TYPES as readonly string[]).includes(value);
}
