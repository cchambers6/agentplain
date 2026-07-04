# Head of Customer Success — 14-day executive plan

**Date:** 2026-07-03 · **Author:** Head of CS (Fable) · **Mandate:** design FOR profitable (loop v3)
**Customer count today: 0.** This plan has exactly one job: **the first design partner activates within 14 days of Conner's Monday sends, and nothing CS does burns founder hours on anything else.**

**Ratified frame this plan operates inside (2026-07-03):**
- CEO lever: 5 Georgia RE design-partner emails Monday → target 2+ replies → 1 discovery call → partner activated within 2 weeks (`docs/ceo/2026-07-02/02-biggest-lever-this-week.md`, PR #348).
- Kill list: no support surface for non-RE; client portal off (5 P0s, 0%-activatable — audit 6, PR #327).
- flatsbo stays live but is not a CS priority.
- Conner-time is Max/Custom only, with **one sanctioned exception**: the design-partner weekly 30-min call during the pilot (`docs/customer-success/playbook.md` §0; `docs/sales/deep-dive-2026-07-02/02-design-partner-program.md` §1).

---

## The shape of CS at zero customers

CS at n=0 is not a department; it is a **rehearsed first hour**. Everything the company has pre-built for retention (SLA code, ticket lifecycle, briefings, weekly reports, drift-sweep feedback loop — kaizen 06 "10 things") is worthless if the first partner's first session doesn't land a real draft in their approvals queue. So this plan is ordered strictly by proximity to that hour:

1. **Days 1–3: verify the runway** (the things that make the onboarding call physically possible).
2. **Days 4–7: rehearse** (dry-run the 90-min call on a seeded workspace; fix what breaks).
3. **Days 8–14: execute on demand** (discovery call happens → onboarding within 48h of a signed letter).

## Day-by-day

| Day | Owner | Action | Exit test |
|---|---|---|---|
| 1 (Mon) | Conner | Sends the 5 emails (CEO lever — not CS work, but CS's clock starts here) | 5 sends logged in /operator/outreach |
| 1–2 | Conner (decision) | **Ratify the prod-key un-pause trigger + per-workspace budget cap** — see "The one decision" below | A number and a trigger, in writing |
| 1–3 | Engineering | Per-workspace budget cap wired and verified against the cap number; `lib/billing/budget.ts` currently returns NO_CAP when unset — that default is unacceptable for the un-pause (see `04-what-i-need-from-other-heads.md`) | A test proves a capped workspace stops spending at the cap |
| 2–4 | CS (Fable) | Dry-run the onboarding runbook (`01-…runbook.md`) end-to-end on a seeded RE workspace: wizard → connect → skill pick → first-fire watch → approve one draft. File every breakage as a P0 to Engineering | One approved draft produced on the dry-run workspace, screen-recorded |
| 2–4 | CS (Fable) | Stand up the hello@ folder discipline + triage ritual (`03-support-playbook…`) so the first prospect *reply* already lands in a system, not a pile | Folders exist; ritual on Conner's calendar (10 min, 2×/day) |
| 4–7 | CS + Sales | Pre-write the partner handoff template (the 5 discovery answers → onboarding config) so the discovery call output IS the onboarding input | Template in the runbook, Sales confirms it matches their call script |
| 5–7 | Data | Activation timestamps queryable: signup → integration connected → first fire → first approval, per workspace | One SQL/one query answers "where is partner X stuck" |
| 8–14 | Conner + CS | Discovery call → signed short letter (standard ToS + letter, per design-partner doc §4) → **onboarding call booked within 48h** → run the runbook | **Partner approves their first draft live on the call** |
| 14 | CS | First Friday synthesis: what the partner said, what broke, what we're fixing (kaizen 06, process fix 3) | One paragraph to the memory inbox + one personal line to the partner |

## What CS explicitly does NOT do in these 14 days

See `05-what-CS-must-stop.md`. Headlines: no non-RE support surface, no portal, no knowledge base, no health-score/NPS automation, no support tooling purchases. Every one of those consumes fleet or founder capacity that the activation path needs.

## Success criteria for the 14 days

- **Primary (the whole game):** 1 design partner activated — meaning *one approved draft, on the onboarding call, with the weekly call scheduled*. This is deliberately stronger than the playbook's "one approved draft in 48h": at n=1, with the founder in the room, there is no excuse for the approval to happen off-call.
- **Secondary:** zero inbound (reply, question, ticket) unanswered past one business day; every one logged.
- **Anti-goal:** zero hours spent on CS infrastructure that a fifth customer would need but a first customer won't.

## The one decision Conner must make before the first onboarding call

**Ratify the prod-key un-pause: trigger, scope, and cap number.** Recommended (aligned with CEO doc 04, question 3): un-pause **on first booked discovery call**, scoped to **the partner's workspace only**, behind a **hard per-workspace budget cap of $50/month** (modeled token cost is $1.50–$10/seat/month — kaizen 07 / path-to-profitable §1 — so $50 is 5–30× headroom while bounding the worst case at pocket change). Without this, the 90-minute onboarding call is a demo of a resting product, and the entire runbook in `01` is fiction. Everything else in this plan can proceed on defaults; this cannot.
