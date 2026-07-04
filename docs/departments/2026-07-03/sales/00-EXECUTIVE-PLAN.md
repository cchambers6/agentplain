# Head of Sales — 14-day executive plan (2026-07-06 → 2026-07-17)

**Date:** 2026-07-03 · **Author:** Head of Sales (fleet) · **Reports to:** Conner
**Ratified frame:** CEO lever = Conner sends 5 Georgia RE design-partner emails Monday (`docs/ceo/2026-07-02/02-biggest-lever-this-week.md`). Kill list: GTM = real estate only; CPA/law closed until 2 RE pilots live. Loop mandate: design for profitable.
**Sources:** sales deep-dive (`docs/sales/deep-dive-2026-07-02/`), outreach kit (`docs/outreach/2026-07-03-design-partner-kit/`), kaizen 05-sales, CEO pass 1. Where this plan and those docs disagree, this plan wins for the next 14 days only; the deep-dive remains the 90-day operating plan.

---

## The named goal

By **Friday 2026-07-17** (end of week 2):

| Metric | Target | Counts only if |
|---|---|---|
| First-touch sends | **5** | Sent by Conner, from his own inbox, logged in the CRM same sitting |
| Replies | **2+** | Any human reply from a prospect — including a "no" (a no with a reason is market data) |
| Discovery calls booked | **1** | On the calendar with a date, briefing doc prepped |

Three numbers. Nothing else is on the scoreboard for these 14 days. Not pipeline value, not new assets, not fix counts. If the three numbers land, everything else in the 90-day plan starts on schedule; if the send doesn't happen Monday, nothing downstream matters (the deep-dive's own words: "nothing else in this plan matters if this rhythm doesn't start").

## Why this is the whole plan

Three planning cycles converged on the same conclusion: the binding constraint is the trust gap, the only cure is design partners, and the only input is founder-sent outreach that has never fired. Zero sends in ~3 weeks since the packet library merged. The job of the Head of Sales for the next 14 days is therefore not strategy — strategy is ratified — it is **making one 60–90 minute founder block succeed and protecting it from everything else**.

## The 14 days

### Before Monday (Fri 07-03 → Sun 07-05) — remove every excuse

Owner: fleet, except the two items only Conner can do.

1. **Prospect rows entered.** The five named prospects (document 01) go into the CRM of record (`/operator/outreach`, stages per deep-dive doc 06) at stage FIRST-TOUCH-PLANNED with variant, hook, and expected objection filled. *(Fleet drafts the rows; Conner confirms the five names — they become the company's first market signal.)*
2. **Booking link resolved — Conner, 10 minutes.** `NEXT_PUBLIC_BOOKING_URL` shipped in the send-path wave but the value has never been set (open item from PR #355). Create the Calendly/Cal.com account, set the env var in Vercel, confirm `/contact` renders the CTA. Without this, a warm reply has nowhere to land.
3. **Verification sweep — fleet.** Confirm on production: `/how-it-works` resolves (redirect fix landed), `/contact` live, CRM-lite loads, the five first-touch email variants (outreach kit doc 01) open clean with no drifted claims. Report pass/fail to Conner Sunday night. **The block never blocks:** if any of this fails, the block still runs Monday — outreach links point at `/` and `/pricing`, replies get a manually proposed time instead of a booking link.
4. **Calendar — Conner, 2 minutes.** Recurring Monday 60–90 min block + Friday 15-min review, on the calendar before Sunday ends.

### Week 1 (Mon 07-06 → Fri 07-10)

- **Mon:** the Monday block (document 02 — the exact script). Output: 5 sends, 5 CRM rows at FIRST-TOUCH-SENT.
- **Tue–Fri:** reply handling only. Target: any warm reply gets the booking reply (outreach kit doc 03) within 4 business hours. No new outreach, no new assets. Fleet monitors nothing sends itself — Conner's inbox is the only channel.
- **Fri:** 15-minute review — the six numbers from deep-dive doc 06 §3, plus one learning logged. Fleet drafts the review sheet; Conner reads it.

### Week 2 (Mon 07-13 → Fri 07-17)

- **Mon:** block #2. Priority order per the cadence doc: replies first, then the day-5/12/21 follow-up chain (touch 2 to week-1 non-repliers lands here, day 7), then new first touches **only if** the follow-up load leaves room — five touches total is still the cap.
- **Any day:** if a discovery call books, the 20-minute playbook (document 03) is the script and the briefing template (outreach kit doc 04) is prepped the day before. The synthetic-data demo runtime (PR #303) is *the* demo — no improvising.
- **Fri:** review #2 against the named goal. Three outcomes, each with a pre-decided next step:
  - **Goal met:** week 3 continues the cadence unchanged; fleet starts researching prospects 6–15 to keep the top of funnel fed.
  - **Sends happened, zero replies:** normal at n=5 — do not rewrite anything yet; week 3 sends the follow-up chain plus 5 fresh names. Copy changes only after ~15 sends of silence.
  - **Sends did not happen:** the plan has failed at its only job. The Friday review becomes a direct conversation with Conner about whether the founder-led motion is real — per the planning direction check, execution-stall is the named failure mode of the whole loop, and pretending otherwise burns another week.

## Founder cost (the whole ask)

~2 hrs/week: Monday block 60–90 min + Friday review 15 min + same-day warm-reply handling (minutes, most days zero). Plus two one-time items before Monday: confirm five names (~15 min), provision the booking link (~10 min). That is the entire founder budget this plan spends.

## What the Head of Sales does NOT do these 14 days

Document 05 is the full stop-list. Headline: no CPA/law prep, no outreach at scale, no paid spend, no new decks or scripts, no second vertical, no re-auditing the product. The department's only deliverable is the three numbers above.

## Standing risks, named

1. **Execution stall** — the risk that has held for 3 weeks. Mitigation: everything pre-staged so Monday costs 60–90 min; the block moves to Tuesday if it slips, never to "later."
2. **Booking-url never set** (open since PR #355). Mitigation: fallback is proposing times manually in the reply; ugly but functional.
3. **A fast yes hits a paused prod key.** A partner can't activate until the key un-pauses (CEO open question #3, recommendation B: un-pause on first booked discovery call, pre-verified). The 2–4 week lag from send to pilot covers us for these 14 days, but engineering must have the governor verification done before a kickoff is booked (document 04).
4. **Prospect data goes stale.** Every fact in document 01 was gathered 07-03 from public sources; the Monday block re-verifies hooks before send (a passed event or changed brokerage = swap the hook, not the send).
