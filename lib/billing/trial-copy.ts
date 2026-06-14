// Single source of truth for customer-facing trial copy.
//
// The signup headline, the tier summary, and (transitively) any other trial
// mention must all tell the SAME truth about two facts that are actually
// configured, not assumed:
//   1. trial length — env.stripeTrialPeriodDays() (default 14, not 30)
//   2. whether a card is taken AT signup — only when billing is live AND the
//      Checkout-at-signup variant is on (STRIPE_CHECKOUT_ENABLED). The #241
//      scaffold default is trial-first / NO card.
//
// Before this helper, the copy was hardcoded ("30-day free trial, card
// captured at signup") and lied for the default config — a money-honesty bug
// at the top of the funnel. Centralizing it here means the two surfaces can
// never drift from each other or from the env config again. Pure + DB-free so
// it's unit-tested directly (tests/trial-copy.test.ts).

/** The card-timing sentence. Used standalone in the tier summary. */
export function trialCardPolicy(
  trialDays: number,
  cardAtSignup: boolean,
): string {
  return cardAtSignup
    ? "Card captured at signup so your fleet keeps running when the trial ends."
    : `No card needed to start — add one before day ${trialDays} to keep your fleet running.`;
}

/** The full headline sentence. Used in the signup page intro paragraph. */
export function trialHeadline(
  trialDays: number,
  cardAtSignup: boolean,
): string {
  return cardAtSignup
    ? `${trialDays}-day free trial, card captured at signup so your fleet keeps running when the trial ends. Cancel any time.`
    : `${trialDays}-day free trial — no card needed to start. Add a card before the trial ends to keep your fleet running. Cancel any time.`;
}
