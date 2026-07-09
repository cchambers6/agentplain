# PriceTiers

`components/marketing/PriceTiers.tsx` · NEW 2026-07-08

The three-tier service-partnership grid (Regular / Partner / Max) as one reusable block. Composes the `TierCard` primitive from `HomeCards.tsx`.

## Truth wiring — the reason it exists

- Per-seat ladders: `tierLadderBands()` from `lib/pricing/tiers.ts` (canonical cents).
- Trial length + money-back window: `lib/billing/facts.ts` (`TRIAL_PERIOD_DAYS`, `MONEY_BACK_GUARANTEE_DAYS`).
- Partner support description: derived from `PARTNER_SUPPORT.description` so the retired "reserved hours" framing can't drift back.

No consumer of this component can render a pricing/trial number that disagrees with billing. The homepage previously hand-typed "7-day free trial" three times; those strings are now derived.

## Where

- Homepage pricing teaser (`app/(marketing)/page.tsx` #pricing section) — adopted 2026-07-08.
- Vertical pages when they want a teaser.
- `/pricing` keeps its own long-form layout (richer guidance blocks) but reads the same `tierLadderBands` — migrating it onto this component is a deferred follow-up, noted in the design-run PR.

## Rules

- Regular carries the page's one primary CTA; Partner + Max are secondary/sales-led.
- Never re-type a dollar figure near this block — link to `/pricing` or the calculator instead.
- "Pilot pricing" framing is banned (ratified tier model).
