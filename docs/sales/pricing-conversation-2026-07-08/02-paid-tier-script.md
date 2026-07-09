# 02 — Paid-tier pricing conversation (standard prospects)

**Use when:** qualified but not a design-partner fit, the cohort is full, or they declined the proof asks. Also the reference for the design-partner conversion moment (01 §4).

**The order is the script:** their numbers first, our modeled math second, the price last. A price named before value is established is just a cost.

---

## 1. Anchor at value BEFORE naming a price

**Step 1 — their own numbers (strongest anchor; costs nothing; always available).** By minute 22 you have their answer to playbook Q1 ("walk me through last Tuesday") and Q8 ("if drafting and chasing were handled, what would you spend the hours on?"). Use those:

> "Before I give you a number, let's price the problem, because you already told me what it is. You said [their words: 'I lose most of Tuesday to follow-ups', 'my admin spends half her day on tenant email']. Put your own hourly value on that — you know it better than I do. What does a week of it cost you?"

Let *them* say a number. Their number beats any number we publish, and it is customer-attested by construction.

**Step 2 — our modeled math (when they won't self-anchor, or to confirm theirs).** Say it as a model, never as a customer result:

> "Here's the math we model — and I'll flag plainly that it's a model, not a customer-attested result, because we're early and I don't dress numbers up. For a broker-owner: eight to twelve hours a week of coordination work, priced at a blended $120 an hour, is $4,100 to $6,200 a month of your time going to work someone with your judgment shouldn't be doing. Our published modeled range across the businesses we serve runs roughly $2,900 to $10,600 a month. Run your own numbers against it — there's a calculator on our pricing page with every input editable."

Sources, and an honesty note for Conner:
- RE broker-owner math: 8–12 hrs/wk × $120/hr × 4.3 wks = $4,128–$6,192/mo, midpoint ~$5,160 (`lib/verticals/real-estate/content.ts:240-243`; claims spine §6: ~$5,300/mo, ~26× ROI, ~$61,920/yr).
- The $2,900–$10,600/mo range is published on the home page ("ROI math, not vibes", `lib/marketing/home-content.ts:106-108`) but audit 01 (full-audit-2026-07-02, finding 3, P1) flags its derivation as untraced in code. **Until that P1 closes, lead with the per-vertical math above (traceable) and use the range only as "our published modeled range" — never as the load-bearing number.**
- The calculator's own labeled defaults compute ~$4,300/mo (10 hr/wk × $100/hr × 4.3 — `RoiCalculator.tsx:63-78`).

**Step 3 — the bridge sentence.** Only now does a price mean anything:

> "So the question is what it's worth to get most of those hours back while you keep final say on every single thing that goes out. Here's the price."

## 2. Naming the number

For a solo operator (most first calls):

> "Regular is $199 a month for one seat. That's the whole service — the setup, the drafting on a schedule, the compliance pass, the approval queue, a monthly review. Not software you figure out; a service that runs. Against the hours we just talked about, it pays for itself in the first week it works — and you'll be able to see whether it did, in the saved-time numbers, rather than take my word."

Then stop talking. The silence after a price is where the prospect tells you what they heard. (Trap #3 in `06-common-mistakes.md`.)

## 3. The three tiers, explained in one breath each

Tiers are **Regular / Partner / Max** (`lib/pricing/tiers.ts:256-260`). Explain the one that fits what you heard; mention the others only if asked (trap #2: over-explaining tiers). Prices are per seat per month, and slide down with seat count:

| Seats | Regular | Partner | Max* |
|---|---|---|---|
| Solo (1 seat) | $199 | $299 | $499 |
| 2–9 | $179 | $279 | $449 |
| 10–24 | $149 | $249 | $399 |
| 25–49 | $119 | $219 | $349 |
| 50–99 | $99 | $199 | $299 |

Source: `PER_SEAT_MONTHLY_USD_CENTS`, `lib/pricing/tiers.ts:106-131`. *Max is quote-based, not self-serve (`isSelfServeTier`, `tiers.ts:46-50`); its ladder exists for contract continuity, not for you to close against on a call. 100+ seats is a custom build engagement, outside the ladder entirely (`tiers.ts:204-209`).

**Regular** — the default; say it like this:

> "Regular is the full service: we set it up, the drafting runs on your cadence, everything waits in your approval queue, and we do a monthly review together. $199 for a single seat, and the per-seat price steps down as seats grow — at 2 to 9 seats it's $179 a seat."

**Partner** — name it only on a real signal (bigger team, support-sensitivity, asked "what's above this?"):

> "Partner is everything in Regular plus priority support — email and chat with priority handling — and a quarterly async check-in with your service team. $299 for the solo seat, sliding the same way. I'll be straight with you: what it is *not* is standing calls with me or reserved founder hours. If you need named human hours ongoing, that's a different conversation."

*(Exact support definition: `PARTNER_SUPPORT`, `lib/billing/facts.ts:78-85`. Never promise Conner-time at Partner — `facts.ts:15-17,65`. The tagline in code: `TIER_TAGLINE`, `tiers.ts:277-281`.)*

**Max** — never quote a closing number on a discovery call:

> "Max is for multi-office, multi-state, white-label, or a dedicated-team setup — and it includes named human service hours, which the other tiers don't. It's quoted, because the scope is the price. If that's you, the next step is a separate scoping conversation, not a number from me today."

*(Route through `/custom` → inquiry → operator triage, per `tiers.ts:20-24`. Improvising a Max price on a call is a NEVER — see 04.)*

## 4. When to name a number vs when to defer

**Name it, plainly and unprompted, when:** they're Regular- or Partner-shaped and qualified; you've done the value anchor; or they asked. The prices are on the public pricing page — hiding a published number reads as either games or shame, and it's neither.

**Defer when — and say why you're deferring:**
- **Max-shaped scope:** "It's quoted because the scope is the price — let me scope it properly rather than guess high or low today."
- **Unqualified / disqualifier surfaced:** don't price what you shouldn't sell. "Before we talk price, I'm honestly not sure we're the right fit yet, because [PMS-only books / locked stack / wants auto-send]. Price only matters if this works for you."
- **Seat count is genuinely unclear:** "The price depends on seats and the ladder rewards volume, so tell me who'd actually touch this — you only, or staff too? — and I'll give you the exact number, not a range."

Deferring is never coyness. Every deferral carries a stated reason and a concrete next step with a date (playbook §1, minute 27–30 rule).

## 5. Trial, card, guarantee — the mechanics, verbatim

All four facts, from `lib/billing/facts.ts` (never restate from memory of an old page — the ratified policy: `facts.ts:9-17`):

> "Signing up works like this: seven-day free trial — fourteen if you're a CPA or law firm, because your work cycle is slower and we want you to see a full cadence before billing starts. We do take a card at signup — I'd rather tell you that than have the form surprise you — and here's why it's fair: the trial converts only after you've had the week to watch it work, there's a fourteen-day money-back guarantee measured from your first charge, on top of the trial, and you can cancel any time, effective end of the period. So the real risk window is: a free week, then two more weeks where your money comes back if you ask. If we can't show you value in that window, we don't deserve the subscription."

- 7-day trial default, 14 for CPA/Law: `TRIAL_PERIOD_DAYS`, `TRIAL_PERIOD_DAYS_EXTENDED`, `facts.ts:27-39`
- Card at signup: `CARD_REQUIRED_AT_SIGNUP`, `facts.ts:54`
- 14-day money-back from first charge, independent of trial length: `MONEY_BACK_GUARANTEE_DAYS`, `facts.ts:51`
- Cancel anytime, effective end of period: `CANCEL_ANYTIME`, `facts.ts:57`

If they bristle at the card: the card is the seriousness filter in both directions — "it means our trial slots go to businesses actually deciding, which is also why the trial gets real setup attention instead of being a demo sandbox." Do not waive it; you can't — it's architecture, not policy discretion.

## 6. Closing the pricing block

> "That's the whole commercial picture — no annual contract, no setup fee, no tiers I haven't told you about. What does your gut say the sticking point is, if there is one?"

Their answer routes you: price push-back → `03-response-to-cheap-comparison.md`; terms push-back → `04-discount-and-concession-limits.md`; "let me think" → playbook objection #20.
