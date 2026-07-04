# What CS needs from the other heads — ranked, dated, with the failure it prevents

Everything below is scoped to **the first partner activating in 14 days**. If it doesn't serve that, I didn't ask for it. Items marked **[gate]** block the onboarding call itself.

---

## Engineering

1. **[gate] Per-workspace budget cap, wired and verified — by day 3.**
   The un-pause plan is "prod key live for the partner's workspace only." `lib/billing/budget.ts` (PR #146) is the seam, but it returns **NO_CAP when unset** — which means the day we un-pause, one misconfigured workspace can spend unbounded tokens. I need: cap set for the partner workspace (recommended $50/mo — `00-EXECUTIVE-PLAN.md`), a test that proves spend *stops* at the cap, and a defined behavior at cap (degrade to the honest resting banner, not a silent error).
   *Failure prevented:* the first partner's pilot becomes a five-figure token bill, or dies silently mid-week-1.

2. **[gate] The workspace-scoped un-pause mechanism itself — by day 3.**
   Whatever form it takes (env + workspace allowlist, flag table), I need to flip one workspace live without turning every dormant surface on. Smoke-tested on the dry-run workspace before the real call.

3. **Saved-time writers for the calibrated actions the RE partner will actually use — by week 2 of the pilot (not the call).**
   Audit 9's P0: 4/7 calibrated actions have no saved-time writer, so sweeps read 0 minutes. For the pilot this isn't (yet) about wrongful refunds — the partner is free for 3 months — it's that **hours-reclaimed is the case-study number** and the design-partner doc (§5) requires measurement running from week 1, "instrumentation, not recollection." Priority order: the writers for lead-scoring and inbox-draft actions first; the rest can follow. Until all land, auto-refund stays in human-review mode.

4. **Day-3 activation alert — cheap version, by week 1.**
   Not the health score. One cron: zero approvals in 72h on any active workspace → task/notification to Conner. The playbook's day-3 nudge currently relies on someone remembering to check (kaizen 06, gap 5). If a cron is more than a day of work, skip it — Conner's daily 10-minute check covers n≤3 — but say so, so the manual check stays on the calendar.

## Product

1. **[gate] Onboarding-path dashboard states, verified against the runbook — by day 4.**
   I will dry-run the exact click path (`01-…runbook.md`): wizard → connect → skill pick → first-fire watch → queue → Today. What I need from Product: every state the partner can see on that path shows **customer vocabulary** ("Setting up / Working / Watching / connected / needs attention" per PR #249 — no ROOTING/LIVE regressions), and the three moments that kill the call have honest states: first-fire timeout (say "first activity lands soon," don't spin), empty Today pre-first-fire (warm empty state, not a blank), connection failure mid-wizard (a retry path that doesn't strand them). I'll file whatever the dry-run finds; I need those fixes prioritized over everything else Product is doing.

2. **The Friday weekly report, sanity-checked with real content — by week 1.**
   The weekly "what Plaino did for you" email is the retention heartbeat and week-4's habit evidence. Before a partner gets one, run it against the dry-run workspace and read it as a broker would: numbers right, vocabulary right, nothing that reads as engineer-speak or vendor-speak.

3. **Confirmation the portal stays dark — standing.**
   Kill-list ratified; audit 6 found 5 P0s including silent edit-discard. I need it not-mentioned on any surface the partner sees (nav, marketing, onboarding), so I never have to explain a feature we won't let them touch.

## Data

1. **Activation-funnel timestamps, queryable per workspace — by day 7.**
   Four events: signup → first integration connected → first fire → first approval. One query answers "where is the partner stuck," which is the input to every save-motion (`02-…success-criteria.md`). No dashboards, no event pipeline — a SQL file in the repo is fine at n=1.
2. **Approvals-per-week per workspace — by day 7.**
   The single CS health number. Same deal: one query, run by Fable every Friday for the scoreboard.
3. **Spend-per-workspace visibility — by week 2.**
   Once the key is live under a cap, I need actual token spend per workspace weekly — both to police the cap and because the modeled $1.50–$10/seat COGS (kaizen 07) becomes a *measured* number the first week a real customer exercises the runtime. That measurement is a company-level asset (it prices every future tier); CS's pilot is the instrument. `stampSessionCost()` currently has zero call sites (kaizen 09) — at minimum, wire it for the partner workspace.

## Sales (the handoff)

1. **[gate] The discovery → onboarding handoff sheet — template by day 5, filled within 24h of any discovery call.**
   Five fields, verbatim from the playbook's qualifying questions: (1) the named repetitive task, (2) the system it lives in (Gmail/Outlook, QBO y/n), (3) the named daily operator, (4) team size → tier, (5) degraded-tolerance answer. Plus: any promise made on the call, in writing. **The handoff sheet is the onboarding config** — if it's complete, the 90-minute call needs no re-discovery; if a promise isn't on it, it wasn't made.
2. **The signed short letter before onboarding is booked — standing.**
   Standard ToS + the interim letter (case-study/testimonial/reference terms, design-partner doc §4). CS runs zero onboarding calls on a handshake; the on-record quote is the program's entire ROI and it must be consented to on day 0, not negotiated at month 3.
3. **Clean call-ownership split — standing.**
   Discovery and the convert-at-month-3 conversation are Sales (Conner in sales hat). The weekly pilot call and every support touch are CS (Conner in CS hat, Fable behind him). One person, two hats, one rule: **nobody sells on a support call.** The weekly call's agenda is their stack and their friction; conversion comes up when the calendar says so, not when the mood does.

---

## What I'm explicitly NOT asking for

No health-score implementation, no NPS tooling, no survey automation, no inbound-email ingestion, no support vendor, no portal fixes, no expansion-trigger detection. All real, all ranked in kaizen 06, all waiting behind "n≥5 customers" (`05-what-CS-must-stop.md`). The fastest way to fail the first partner is to build for the fiftieth.
