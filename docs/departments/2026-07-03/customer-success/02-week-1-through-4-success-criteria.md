# Weeks 1–4 — what "the partner uses the product weekly" means, and what we do when they don't

**Scope:** the first design partner(s), weeks 1–4 post-onboarding. At n=1–3 there is no dashboard, no health score, no automation — **Conner (10 min/day) + Fable (the queries) ARE the health score.** The instrumented version waits until n≥5 (`05-what-CS-must-stop.md`).

**The one number that predicts everything:** approvals per week. The playbook calls zero-approvals-in-7-days "the strongest predictor" of churn (kaizen 06, gap 5). Everything below is built around keeping that number alive.

---

## Weekly definition of healthy

| Week | "Uses the product weekly" means | Evidence (queryable, not recollected) |
|---|---|---|
| 1 | Opens the queue ≥3 mornings; **≥5 approvals** (incl. edits/rejections — a rejection is engagement); attends weekly call #1 | Approval rows w/ timestamps; call held |
| 2 | ≥5 approvals; **≥1 edited draft** (they're correcting Plaino = teaching it); mentions one specific draft on the call unprompted | Approval rows; drift-sweep sees the edit; call notes |
| 3 | Approvals steady or rising; second workflow conversation happens naturally ("could it also…") or we prompt it; saved-time accruing on their calibrated actions | Approval rows; saved-time table non-zero |
| 4 | The habit test: **a week where we didn't nudge and the approvals happened anyway.** Friday report email gets opened; they say one sentence on the call we could imagine on the record | Approval rows w/o any nudge that week; call notes |

Rejections and edits count as usage. The only dead signal is *silence* — an untouched queue.

**Week-4 exit question (asked straight, on the call):** "If we turned this off Monday, what would you miss?" The answer is the case study's spine, the first honest retention datum, and — if it's "nothing" — the earliest possible save-motion trigger while 8 pilot weeks still remain to fix it.

## The rhythm that produces those numbers

- **Daily (Conner or Fable, silent, 10 min):** did drafts land? did any get approved? any connection showing "needs attention"? No customer touch unless a trigger below fires.
- **Weekly call (Conner, 30 min, the design-partner exception):** their stack, what's working, what's not — recorded with consent. Fable preps a one-page brief from the week's actual data (approvals, edits, anything that erred) so the call runs on evidence, not memory; case-study fields accrue every week.
- **Friday:** the automated Plaino weekly report goes to them; the Friday synthesis paragraph (kaizen 06, fix 3) goes to the memory inbox with one personal line back to the partner.

## When they DON'T — graduated response

Design partners are the one tier where Conner may initiate a call without an upsell pretext. Use that power in this order — cheapest touch first, and **diagnose from the data before touching them** (the failure is usually ours: skill erred, integration expired, drafts were bad — check before asking).

| Trigger | Response | Owner |
|---|---|---|
| No queue open by day 3 of any week | "Stuck?" nudge — one specific draft named in the email ("the Henderson lead reply is waiting on you"), not "just checking in" | Fable drafts, Conner sends |
| Zero approvals in 7 days | **Save-motion opens** (below) | Conner |
| Weekly call missed ×1 | Reschedule same week, no drama | Fable drafts |
| Weekly call missed ×2 consecutive | Save-motion opens — the call IS the program; a partner who stops showing up has already churned in their head | Conner |
| Integration "needs attention" >72h | We reach out with the fix in hand, not a request to debug | Fable diagnoses first |
| Any verbatim like "this isn't useful" / "I don't have time for this" | Save-motion opens immediately, skip the ladder | Conner, same day |
| Drafts erring / degraded mode on their workspace | **We tell them before they notice.** Honesty-first: "Plaino had a rough morning; here's what happened and when it's fixed" | Conner |

## The save-motion (n≤3 version)

A save-motion is one focused call plus one product change, inside 5 business days:

1. **Diagnose from data first** (30 min, Fable): approvals timeline, draft quality on their actual items, connection health, whether *we* broke something. Come to the call knowing.
2. **The save call (Conner, 30 min):** not "how can we do better" — instead: "Here's what we see: you approved 11 drafts in week 1 and none since the 14th. What changed?" Then **re-scope to exactly one workflow** — the single thing from discovery that made them answer the email. Kill every other skill from their queue if needed. A partner using one workflow weekly is a success; a partner ignoring five is a churn.
3. **One product change inside the week:** whatever the call surfaced, something visibly changes in their workspace within 5 business days, and we tell them it changed *because of them*. At the design-partner stage this is the whole value proposition ("your voice shapes the product") made tangible.
4. **The honest exit (if 1–3 fail by week 8 of the pilot):** part cleanly, ask for the on-record quote about what *did* work, keep the relationship. Design-partner doc §5: "a partner who declines to convert but gives an honest on-record quote is still a program success. Never trade honesty for retention." No guilt, no discount improvisation — "pilot pricing" is banned and the pilot is already free.

**What a save is worth in dollars:** see `06-profit-contribution.md`. Short version: a saved first partner is ~$2.2K of year-one contribution plus the reference asset that unblocks the entire funnel — the highest-leverage 60 minutes on Conner's calendar in any week it happens.

## Reporting up

One line to the Friday scoreboard (the CEO lever's "three numbers" gets a fourth once a partner exists): **approvals this week / last week, per partner.** That's the entire CS dashboard until n≥5.
