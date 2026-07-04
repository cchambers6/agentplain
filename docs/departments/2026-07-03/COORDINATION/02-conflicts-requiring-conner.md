# Conflicts Requiring Conner — 2026-07-03

Where two or more heads disagree on strategy, sequencing, a number, or an owner. Each carries a recommendation and, where safe, a default that fires on silence. C1 and C2 are the two that can stall the critical path; the rest are batchable.

---

## C1 — Prod-key un-pause: three trigger formulations, two cap numbers, three readiness dates

**The disagreement.**
- **CEO Pass 1 (Q3)** offers two options: (A) telemetry un-pause now on a small workspace set, or (B) un-pause on first booked discovery call, pre-verified. CEO recommends B.
- **Customer Success** wants the ratification Mon–Tue Jul 6–7, recommends trigger = first booked discovery call, scope = partner workspace only, cap = **$50/month**, and needs the cap wired by **day 3** — because `lib/billing/budget.ts` returns NO_CAP when unset, which makes silence unsafe.
- **Finance-Ops** states the ratified condition as "a design partner in **active pilot**" plus the standing two-condition test (market-ready AND active prospecting), proposes **$40/mo + $4/day** per workspace, needs the number ratified by **Jul 8** (Engineering's ask), and schedules cap implementation **days 8–14**.
- **Engineering** targets an un-pause go/no-go one-pager on **Jul 11**.
- **Sales** endorses B and asks only that verification be done by Jul 10 so the switch is instant.

So: trigger is variously "now," "first booked call," and "active pilot"; the cap is $50/mo (CS) vs $40/mo + $4/day (Fin-Ops); readiness is day 3 (CS) vs Jul 11 (Eng) vs day 14 (Fin-Ops).

**Why it matters.** This is the only critical-path item where silence-executes-defaults does not work: no ratified cap means NO_CAP, and an early booked call would force either an unsafe un-pause or a partner told to wait.

**Recommendation (one ruling, four parts):**
1. **Trigger = B: first booked discovery call** (CEO, CS, and Sales already align; Fin-Ops' "active pilot" reads as the condition for *sustained* key-on, satisfied the moment onboarding starts).
2. **Scope = the partner's workspace only**, via the workspace-scoped mechanism Engineering smoke-tests on the dry-run workspace.
3. **Cap = the Finance-Ops two-dimension number, $40/mo + $4/day.** It is the finance-owned spec and the daily dimension bounds a runaway day, which a monthly-only $50 cap does not. CS's $50 intent (5–30× headroom over the $1.50–$10/seat modeled COGS) is preserved.
4. **Readiness = Jul 11** (Engineering's go/no-go), with Finance-Ops' full preflight certification by Jul 14 as the backstop. CS's day-3 date applies to *starting* the wiring, not finishing certification; a discovery call realistically books week 2, after Jul 11.

**Deadline for the ruling: Tue Jul 7.** One line back ratifies all four parts.

---

## C2 — Entity timing: "this month" vs. the 48-hour signature promise

**The disagreement.**
- **CEO Pass 1 (Q2)** and the CoS queue put entity + counsel as "start this month," item 3 of 5 — behind the send motion.
- **Legal** promises "yes-to-signature in under 48 hours" and simultaneously states the hard constraint: "the day the entity exists, the fill is mechanical" — party name, notice address, CAN-SPAM footer, signature block all wait on the entity, and "no document invents an entity name."
- **CS** runs zero onboarding calls without a signed short letter.

If Monday's sends convert on plan — reply by mid-week, call booked week 2 — a prospect could be ready to sign around **Jul 13–15**. On the "this month" pace, the entity doesn't exist yet, the short-form can't be filled, the 48-hour promise breaks, and the first yes in company history sits in placeholder limbo.

**Why it matters.** This is the only Conner item that can silently invalidate a downstream department's core promise. The CoS pass itself noted: "becomes #1 the day a partner asks to sign" — the coordination view is that on the success path, that day is inside this window.

**Recommendation:** Pull the entity decision forward to **decided by Fri Jul 10** (decision, not necessarily formation-complete — counsel can confirm what's signable during formation). If Conner cannot decide by Jul 10, ask counsel this week for the fallback ruling: can the design-partner short-form be signed pre-formation (e.g., founder as individual with assignment on formation), yes or no. Either answer keeps the 48-hour promise honest; not asking is the only losing move.

**Deadline: counsel session this week (already CEO Q2); entity ruling by Jul 10.**

---

## C3 — The $2,900–$10,600/mo ROI card: three different fixes on the exact send path

**The disagreement.**
- **Marketing** offers three options: (a) publish a derivation and cite it, (b) fall back to the calculator's labeled default (~$4,300/mo), (c) cut the numbers. Decision needed by Monday.
- **Product** wants it replaced with the calibrated 27-min/lead derivation from its killer-workflow doc — "the only ROI math we can defend line by line."
- **Design** frames the stakes: "one untraceable number poisons the credibility of every traceable one" and will execute whatever is ruled.

**Why it matters.** The card sits on the surface the five Monday emails land on, and the design-partner buyer is "the one who checks." It's the last Truth-Wave violation on the send path.

**Recommendation:** Option (a) implemented as Product proposes — publish the 27-min/lead derivation and make the card cite it. If the derivation page can't be live and gate-clean before Monday 8am, apply (c) — cut the numbers for send week and restore them with the derivation when it lands. Never (b) alone: an unlabeled fallback number is the same defect smaller.

**Deadline: ruling by Fri Jul 4 EOD** so Design/Marketing can execute inside the Day-1 PR.

---

## C4 — Three event schemas for one funnel

**The disagreement.** Marketing specs 4 goal events (sign-up reached, sign-up completed, lead-capture submitted, guarantee-page view) behind an analytics adapter by Jul 11. Data specs 5 events (`outbound.sent`, `discovery.booked`, `signup.attributed`, connector-connect success, first save-motion) in `lib/analytics/track.ts` by day 10, three of them must-fire before Monday. Product asks Data for a different 5 (signup, workspace-created, demo-viewed, connect-started, first-draft-queued) to measure TTFDV. Three overlapping lists, two implied storage layers, one funnel.

**Why it matters.** Data's own warning governs: renaming the funnel later invalidates trend history. Building two tracking layers in the same fortnight is the redundant-work pattern the CoS pass just closed.

**Recommendation.** This one the heads can settle without Conner *if* they accept the assignment: **Data owns the event registry as owner-of-record; one merged contract (~8–10 events superset), one `track.ts` build by Engineering; Marketing's goal events and Product's TTFDV events become names in that registry, not separate systems.** Contract ratified in writing by **Sun Jul 5** (the three must-fire events are unaffected and land regardless). Conner is only needed as tie-break if Product and Data disagree on which event defines "activation" — Data's plan already asks Product to ratify exactly that this week.

---

## C5 — Marketing's article surface vs. the new-surface freeze

**The disagreement.** Marketing needs a thin long-form route by Jul 9 (three entries in the `/compare/[alt]` registry) for the comparison pieces. Engineering's plan and the ratified kill list say no new surface area this fortnight.

**Recommendation:** Allow it. Registry entries on an existing route are content, not surface — no new layout, no new nav, no new component family. The freeze exists to stop scope, and Marketing's fallback (publish as sections on `/real-estate`) is strictly worse for AEO with zero scope saved. If Engineering disputes the reading, Marketing's fallback executes and nothing blocks.

**Default on silence: allow (registry entries only, nothing beyond the three named).**

---

## C6 — Demo-first-render timing: Product's send-week vs. Design's days 10–14

**The disagreement.** Product wants the demo-mode first impression polished during send week (a Monday-send broker who starts a trial never sees an empty first render — Design's own stated contract). Design schedules the dashboard first-render work days 10–14, after the editorial-rhythm pass (days 6–9).

**Recommendation:** Split the item. The *default-flip* (demo ON for fresh RE workspaces — Product's item 4, a decision not a build) and the *demo label + closing Connect card* pass pull forward to days 3–5; the full first-render composition stays days 10–14. Rationale: trial signups from cold emails are possible from Jul 6 but improbable before week 2; the cheap half covers the risk window. Heads can adopt this without Conner; listed because both plans currently claim their own sequence is the contract.

**Default on silence: the split above.**

---

## Not conflicts (checked and cleared — do not reopen)

- **Saved-time writers timing:** four different dates across five plans, but Engineering's own date (Jul 3–4) is the earliest — everyone else's deadline is satisfied automatically.
- **Email link destination:** Design and Marketing independently recommend `/real-estate`. Agreement, not conflict — it rides the batch ruling in the Conner queue as a confirmation, with `/real-estate` as the default.
- **LinkedIn banner deadline:** Jul 4 (Marketing) vs Jul 13 (Sales) — earliest wins, deduped.
- **flatsbo dark-vs-live:** CEO Pass 1 Q4 recommends dark, but Conner's override (PR #354, KILL #3 OVERRIDDEN) already ruled: flatsbo stays live with Legal's hygiene minimum and Engineering's PII lock. Ruled; not re-litigated here.
- **Merge train (Jul 3–4) vs pre-send verification (Jul 5):** sequential by design, not competing.
