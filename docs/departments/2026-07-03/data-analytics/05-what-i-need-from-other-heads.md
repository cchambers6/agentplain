# What I need from other heads

Ranked within each department; sized honestly. Everything here is wiring existing designs, not new surface area — consistent with the kill list.

## Engineering (instrumentation code)

1. **`lib/analytics/track.ts` + the `AnalyticsEvent` table + the five product-event call sites** (S–M, by day 10). Call sites are enumerated with file paths in `01-instrumentation-plan.md`; the pattern for four of the five is one line inside an existing success path (`signUpBrokerOwner`, connector connect success, post-`gateSkillFire` completion, `recordSavedTime`). Non-negotiables: fire-and-forget (never block or fail a user transaction), event-name registry enforced at build time, no third-party script anywhere.
2. **Wire `stampSessionCost` at every dispatch completion call site + register the Librarian roll-up executor** (S, by day 14 — the kaizen retro's #1+#2, which only close the loop together). The spec called this "a one-line follow-up per call site" on 2026-06-15; it is now 18 days unwired and every fleet-spend number is null because of it. Acceptance: the 2026-07-12 kaizen run reports `sessions analyzed > 0`.
3. **Close the saved-time writer gap** — 4 of 7 calibrated guarantee actions have no `recordSavedTime` call (audit 9/10, P0 there for refund-correctness reasons). For me it's the last funnel step undercounting. One fix, two departments' numbers come true.
4. **Booking-link `ref` parameter pass-through** (XS, before Monday): whatever page/flow sits behind `NEXT_PUBLIC_BOOKING_URL` must not strip the ref, and the booked-call record must retain it.

## Product (event surface)

1. **Ratify the five events + property schema as the activation contract** (decision, this week). If Product believes activation is a different moment than first save-motion, say so now — renaming the funnel later invalidates trend history.
2. **"How did you hear about us?" field on sign-up** (XS): one optional select, 6 options + free text, "assistant/AI search" included. Copy through the voice gate; customer vocab, not engineer labels.
3. **A `dataGaps`-style honesty convention for any customer-facing number** (standing): any usage or savings figure surfaced to customers must trace to an event or a guarantee-ledger row. The Truth Wave cleaned copy claims; this keeps measured claims clean as they appear.

## Finance-Ops (spend rollup)

1. **One monthly spend rollup, one owner** (by day 14): Anthropic invoice + Vercel/Neon/infra + GTM stack (~$100–160/mo) in a committed table, so the spend dashboard reconciles token *estimates* against billed *fact* monthly. The estimates-only discipline (I-11) survives exactly as long as an invoice checks it.
2. **Confirm the fixed-cost line** for the contribution math (S): cash-breakeven of 3/9/25 seats is currently modeled on unmeasured fixed costs (CEO doc 01 says so itself). One measured month replaces the model.
3. **Migrate-resolve note stands:** prod P3009 fix is migrate resolve, not resume-Neon (kaizen 7) — flagging only because spend telemetry reads production and inherits any prod-red confusion.

## Sales/GTM (the funnel's front end)

1. **CRM rows before sends** (before Monday): all 5 prospects entered in `/operator/outreach` with template variant + booking-link ref. The funnel dashboard reads what the CRM holds; an empty CRM on Monday means Dashboard 1 ships blind on its first and most important week.
2. **Reply logging discipline** (standing): replies marked within 24h with disposition. Five rows a week; the habit costs a minute and buys the whole funnel's truthfulness.

## Conner (founder)

1. **Send the five** (Monday). Every instrument in this pack measures a motion only you can start; the scoreboard's top row is yours.
2. **Self-report answer options blessed** (XS, async): the 6 "how did you hear" options shape attribution categories for the life of the funnel.
