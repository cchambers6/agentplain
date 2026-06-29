# Next 5 Phases of Development — agentplain + flatsbo

**Date:** 2026-06-28
**Author:** Strategy synthesis (1-hour bounded read across memory + repo state for both products)
**Status:** For Conner's review — a real, actionable plan, not a wishlist

---

## Executive summary

**The binding constraint is the trust gap: zero paying customers and zero social proof on either product, on top of a margin model that confirms compute is never the limiter — the human "we run it for you" promise is.** Memory is blunt about it: *"~2 customers covers infrastructure; ~25–40 covers the first full-time service hire… Compute will never be the constraint; staffing the 'we run it for you' promise will be"* (`unit-economics.md §4`), and the signup-to-go verdict is *"Would a real SMB owner sign up today and have an autonomous fleet running within the first hour? **NO**"* (`SIGNUP_TO_GO_AUDIT_2026_06_10.md`). The single highest-leverage move across both sites is **to manufacture the first real proof — 3–5 real-estate design partners running a killer workflow weekly with a customer-visible dollar figure — using the deterministic killer workflows that already run with zero LLM calls and therefore do not depend on the paused production API key.** Everything else (paid media, new verticals, flatsbo's transactional relaunch, a service hire) is downstream of that first proof. For the next **90 days**, "ship" means: (1) agentplain has a clean merged brand, a verifiably-safe cost meter, a customer-visible value ledger, and **at least one design partner converted trial→paid**; (2) flatsbo is taken to a legally-clean waitlist posture and its product bugs fixed *behind the wall* so it is transaction-ready the instant the legal predicate closes — without ever crossing the GA license boundary. agentplain leads; flatsbo gets only low-Conner-time, counsel-free work in parallel, per the load-bearing `project_agentplain_is_priority` rule.

**Standing constraints honored throughout this plan:** no new verticals (finish the locked set); no recommendation to restore the production `ANTHROPIC_API_KEY` (policy — the plan is explicitly engineered to deliver first value and first proof *without* it); no flatsbo action that crosses the GA real-estate license boundary; every quantified claim traces to a memory file or current repo state.

---

## Per-site current-state snapshot

### agentplain — snapshot

**Where it is:** A multi-vertical "service layer on top of Claude for Small Business" (load-bearing positioning — *not* a competitor to Claude; `project_sbm_wrapper_positioning_2026_06_06`). `origin/main` is well ahead of the planning branch, with merges through **#312/#313**: the production-growth wave (#295–#306) and the de-AI / brand wave (#307–#313) are all landed.

**What's been built:**
- **5 killer workflows that fire now**, and — critically — they are **deterministic templates with ~0 LLM calls per run** (`unit-economics.md`): general (invoice-chase on live QuickBooks), realty (5-minute first-touch on FUB), CPA (month-end close off TaxDome/Karbon read), home-services (estimate → follow-up cadence), law (intake conflict screen + engagement letter). 5 more are **ready-on-unlock** pending a connector credential (insurance/EZLynx, mortgage/Encompass, PM/Buildium, title/Qualia, RIA/key).
- Platform: marketing surface (~19 brand-clean pages), magic-link + passkey auth (iOS rpId fix landed), Stripe billing + webhooks, approvals surface (web + mobile parity — the strongest surface), workspace RLS isolation (#298), connector MCP dispatch (#277), DocuSign approval gate (#280), degraded-mode banner (#276), knowledge RAG corpus (#295), ToS/AUP/Privacy (#296), two-bucket data positioning + storage surface (#306), Twilio *receiver* layer (#304, env-gated), visible killer-workflow runtime on synthetic data (#303), workspace IA collapsed 13→5 tabs (#288), Kaizen weekly retro (#273), Day-7 walk-away guarantee + auto-refund (#300), per-customer client portal (#299), multi-employee roles (#301), per-workspace token budgets + tiered routing (#302).
- **Design:** the 5-way design bake-off is **decided** — Conner picked **Heritage Plains Editorial** (#316), rolled out full-surface as **#320** (`project_heritage_rollout_2026_06_22`). #320 is a system retune (~85% already shipped via #310/#312), **still OPEN/unmerged**, with 4 review sessions returning a near-unanimous "the system is sound."

**What's NOT done / blocking:**
- **#1: production cannot serve LLM work — `ANTHROPIC_API_KEY` is paused (policy).** Every LLM first-fire writes a FAILED row as the customer's first experience. *(This plan does not propose unpausing it; it routes around it.)*
- **Production Vercel is RED** — Neon compute `ep-aged-snow-aq0e4b6k` is suspended; build coupled `migrate deploy` to every build. #307 made *previews* DB-free/green; **prod stays red until Conner resumes Neon compute** (`project_vercel_red_neon_outage_fix_2026_06_19`).
- **The cost meter is unverified live** — per-tier token budgets (Regular $60/mo, Partner $90, Max $150) are built (`BudgetEnforcingLlmProvider`, graceful auto-pause) but **not applied to any workspace** until Conner signs the caps (`TODOS-FOR-CONNER.md` Item A). Margin risk is *future* (if drafts upgrade from templates to per-item Opus), not present.
- **The customer never sees a dollar value** — the value ledger is operator-only; the renewal-evidence surface (ValueSummaryCard) is unbuilt.
- **First-fire UX leaks raw error codes**; registry gaps were flagged that can silently skip a killer workflow (general / home-services).
- **The operating system is "activating," not active** — the OS spec (`AGENTPLAIN_OPERATING_SYSTEM_2026_06_15`) is greenlit, but the live data layer (`conner-queue.yaml`, `WORKING_STATE.md`) was never populated by the Librarian.
- **Zero design partners on record; zero outbound activity; zero paying customers.**

### flatsbo — snapshot

**Where it is:** A flat-fee Georgia-only FSBO marketplace ($499 charged on close; owner-listed homes; direct buyer offers). **Frozen since ~2026-05-25** — every commit since is fleet/infra plumbing, consistent with `project_agentplain_is_priority` (flatsbo waits on the RE license + counsel). The architecture is state-agnostic by design (`lib/states/` adapter, #39) but operating scope is GA-V1.

**What's been built:** Marketing home (editorial v3), sell pitch + wizard, search/browse (map+filters), listing detail, seller dashboard, full auth scaffold, Stripe checkout + webhook (**correctly secured** — raw-body verify, `markListingPaid` sole-writer), AI copy surfaces, state-portability adapter, cron/fleet infra.

**What's NOT done / blocking:**
- **The legal predicate is fully open — this is the gating constraint.** Quoted from the 9-lens audit (`project_flatsbo_audit_legal_gap_unlicensed_activity`): *"no LLC, no GA license held, no broker partnership signed, no closing-attorney relationship, zero closed transactions"* — yet the site is *"LIVE and transactionally armed (Stripe card capture works) while every legal predicate is open."* The site also carries **two false claims**: "© Flatsbo, Inc." (no entity formed) and `/about`'s "Georgia broker partnership is in place" (none signed). **No ToS, no Privacy Policy exist.**
- **The GA license boundary** (`O.C.G.A. § 43-40`): without a licensed broker in the loop, the product may not, for a fee, do brokerage acts. The audit names the offending features: AI counter-offer coaching with suggested amounts, AI valuation bands/CMA, promised "contract reading," and operating the offer dashboard as the paid intermediary. **Only listing-advertising + lead-capture are safe pre-broker.**
- **The buyer loop is completely dead** (passwordless buyers can't log in; `PATCH /offers` needs a session they can't get; counter hits seller ownership check → 403; `OfferForm` shows "submitted" on API failure). **A "Year built" wizard bug hard-blocks all listing creation → 0 homes in prod.** ~14 P0 / ~40 P1 bugs (`docs/audits/flatsbo-synthesis-2026-06-16.md`), plus unauthenticated PII endpoints and a "SOLD-before-charge" revenue hole. **All fixable now, no counsel needed.**

**Conner/cash actions before flatsbo can transact (all overdue, set ~2026-04-26):** form FlatSBO LLC (~$100, GA SoS); sign a GA broker-of-record partnership (the single unblock — same broker can sponsor Conner's salesperson license); enroll in the 75-hr GA pre-license course (3–6 mo); engage counsel to write/sign ToS, Privacy, and every claim. Cash is modest (~$100 LLC + ~$300–2,500/yr insurance/MLS/agent + counsel fees); the blocker is Conner-time and the broker relationship.

---

## The 5-phase plan

> **Cost convention.** Build cost is expressed in agentplain operating-system tiers and weeks, anchored to the OS spec's published envelopes — **steady-state ~$3–5k/week, burst ~$5–8k/week** (`AGENTPLAIN_OPERATING_SYSTEM_2026_06_15` §Tiers). These are agent-token fleet-run costs, not customer COGS (which is ~95% gross margin). Conner-time and cash are called out separately. No figures are invented; where a number has no memory source, the field says "unmetered — no source."

---

### Phase 1 — Merge the brand, prove the meter, make value visible
**One-line goal:** Land the decided design, verify the cost guardrail is real, and make a customer *see a dollar figure* — all without the paused production key.

- **Site(s):** agentplain only.
- **Duration:** ~1.5–2 weeks (1 burst-eligible week).
- **Scope:**
  - Merge **#320 Heritage Plains** with the **one P0 fix** the a11y review found (primary clay CTA fails WCAG AA at 4.19:1 → `text-white`, the fix the portal already uses). Then the P1 fast-follow cluster (foil contrast, small clay labels, footer micro-copy, forest focus-ring) — all color-value, no layout rework.
  - **Widen the brand-gate scan list** to cover the off-page surfaces the consistency review found still hardcoding the old palette (weekly/dunning emails, `global-error.tsx`, unsubscribe, portal, `lib/**` email generators). This is the structurally important fix — it's why the gate reported "0 violations" while surfaces drifted.
  - **Fix registry-truth** so all 5 firing killer workflows actually reach a customer (close the general / home-services silent-skip gaps the audit flagged).
  - **Build the customer-visible value surface (ValueSummaryCard / ROI ledger)** — surface the saved-time/saved-$ figure that today lives only in the operator's Monday brief. This is the renewal engine.
  - **Replace raw-error first-fire UX** with customer-vocab states ("Setting up / Working / Needs a connector"), per the load-bearing `feedback_customer_vocab_not_engineer`.
  - **Verify the cost meter live** on a seeded workspace (auto-pause at cap, 50/75/90% warnings) so Conner can sign the per-tier caps with evidence.
- **Dependencies:** Conner signs the per-tier budget caps (`TODOS-FOR-CONNER` Item A) so the meter can be verified end-to-end. **No dependency on the paused key** — the 5 killer workflows and the value ledger are deterministic. (Prod Vercel red / Neon is *not* a blocker for this phase since the work is verifiable on previews + seeded local DB.)
- **Success criteria:** #320 merged with brand-gate green *including the newly-scanned off-page surfaces*; all 5 killer workflows fire green on synthetic + seeded data with no raw error strings; a seeded demo workspace renders a real dollar figure in the customer UI; the budget enforcer demonstrably auto-pauses a workspace at its cap in a recorded run.
- **Estimated cost:** Build ≈ **1 burst week (~$5–8k fleet)**, mostly the value-surface + first-fire UX. Conner-time ≈ **~1–2 hrs** (merge approval + sign budget caps + watch the meter demo). Cash/infra ≈ **$0** (no new infra; prod key stays paused).
- **Biggest risk + mitigation:** *Risk:* the value figure looks fabricated and erodes trust instead of building it. *Mitigation:* source every number from the deterministic workflow's own actions (e.g., "chased 4 invoices worth $X"), label provenance, and never show an estimate without the action behind it (`feedback_no_guesses_no_estimates`).

---

### Phase 2 — Manufacture the first proof: real-estate design partners
**One-line goal:** Get 3–5 real RE design partners running the realty killer workflow weekly, and turn that into the first published, permission-signed social proof.

- **Site(s):** agentplain only.
- **Duration:** ~3–4 weeks (founder-paced, not fleet-paced).
- **Scope:**
  - **Founder-led, hand-to-hand outreach** to recruit ~10 RE design partners (the #1 channel per `project_money_gtm_pack`; beachhead = real estate, the only counsel-ready compliance corpus). The outreach packets already exist (`wt-dp-outreach`, PR #293 "design-partner outreach packets — 5 verticals ready-to-send").
  - **Onboard partners onto the deterministic realty workflow** (5-minute first-touch via FUB) — runs without the paused key.
  - **Capture proof:** signed-permission testimonials, logos, and a real ROI figure (rides on the Phase-1 ValueSummaryCard). Build the public proof surface (case study / evidence block) — close the "zero social proof" gap.
  - **Best self-serve connector unlock:** stand up **Buildium** for any PM-adjacent partner (~15-min self-serve, highest ROI of the locked unlocks).
- **Dependencies:** Phase 1 done (value visible + workflows fire clean). Conner greenlights and *personally runs* the outreach (founder-led is load-bearing — this is not a fleet task). Prod Vercel red **must be resolved** before a partner touches the live app → **Conner resumes Neon compute** (the one infra unblock; the key stays paused because the realty workflow is deterministic).
- **Success criteria:** ≥3 RE design partners actively running the workflow weekly; ≥1 signed testimonial + a published ROI figure live on the marketing surface; a repeatable onboarding runbook captured (so partner #6 is faster than partner #1).
- **Estimated cost:** Build ≈ **~1 steady week (~$3–5k fleet)** for the proof surface + onboarding polish. Conner-time ≈ **the dominant cost — est. 8–15 hrs over the phase** (outreach, calls, onboarding; unmetered — no memory source for exact hours). Cash ≈ **$0–minimal** (no paid media until a trial→paid reading exists, per `project_money_gtm_pack`).
- **Biggest risk + mitigation:** *Risk:* design partners sign up, hit the empty-trial "nothing happened for me" experience Conner himself has had, and churn before proof. *Mitigation:* the Phase-1 deterministic-value-on-day-1 surface is the antidote — onboard each partner live (founder-assisted) so the first session produces a visible saved-$ figure, not a blank workspace.

---

### Phase 3 — Prove the money path: trial → paid, and turn the OS on
**One-line goal:** Convert at least one design partner to paid through a working Stripe path, and activate the operating system's measurement loop so the fleet starts compounding.

- **Site(s):** agentplain only.
- **Duration:** ~2–3 weeks.
- **Scope:**
  - **Resolve the Stripe-at-signup ambiguity** (signup completes with zero Stripe calls while copy says "card captured at signup"). Conner decides trial-first vs card-at-signup + 7-day/14-day mechanics (`project_truth_wave_trial_policy`); wire `STRIPE_CHECKOUT_ENABLED` + price IDs; make copy and behavior match.
  - **Close the renewal loop:** value ledger (Phase 1) → Day-7 walk-away offer + auto-refund (already built, #300) → first paid conversion.
  - **Activate the operating system Tiers 1–3** (`AGENTPLAIN_OPERATING_SYSTEM_2026_06_15` §9 first-week plan): populate the dormant YAML data layer, stand up the Librarian roll-up + morning brief + the calibration loop so cv-bar scores and budget-state start accumulating. This is what makes week-4 prompts better than week-1.
  - **Pricing ladder ratification** (Option C; Conner-time isolated to Max/Custom only) so the paid offer is coherent.
- **Dependencies:** Phase 2 produced ≥1 partner willing to pay. Conner decides trial + pricing mechanics (decision, not build). Budget caps signed in Phase 1 (the OS data layer reads `budget-state.yaml`).
- **Success criteria:** ≥1 design partner converts trial→paid through the live Stripe path; signup copy and Stripe behavior provably match; the OS data layer is *live* (cv-bar-scores + session-costs + budget-state populating from real runs) — i.e., the OS moves from "activating" to "active" by its own §9 acceptance bar.
- **Estimated cost:** Build ≈ **~1 steady week (~$3–5k fleet)**. Conner-time ≈ **~2–4 hrs** (trial/pricing decisions + sign-off). Cash/infra ≈ **Stripe fees on first real charge** (~3.5% of revenue — the largest COGS line, per `unit-economics.md`; trivial in absolute terms at this volume).
- **Biggest risk + mitigation:** *Risk:* the first paid conversion is a favor, not a signal — it doesn't prove a repeatable motion. *Mitigation:* treat Phase 3 as *instrumentation*, not a milestone to celebrate; the real read is whether the OS calibration data shows the *second* onboarding was cheaper/better than the first. Don't authorize paid media until that repeatability shows.

---

### Phase 4 — flatsbo: legal-clean posture + transaction-ready behind the wall
**One-line goal:** Make flatsbo legally honest today (waitlist, no false claims) and fix every counsel-free product bug so it's transaction-ready the *instant* the legal predicate closes — without crossing the GA license line.

- **Site(s):** flatsbo only (runs **in parallel** with agentplain Phases 2–3; low Conner-time).
- **Duration:** ~2–3 weeks of fleet work; the *legal predicate* itself is Conner/counsel-paced and may run longer (tracked, not gated by fleet velocity).
- **Scope (two independent tracks):**
  - **Track A — legal-safe posture (do immediately, no counsel needed to *remove* a false claim):** take the transactional path dark → **waitlist / "coming to Georgia" mode**; remove the false "© Flatsbo, Inc." and "Georgia broker partnership is in place" claims; gate the AI valuation/negotiation/contract-reading features (the ones the audit names as crossing `§ 43-40`) behind the predicate. Per the audit's verbatim posture: *"Take the transactional path dark (waitlist mode) until all legal predicates close."*
  - **Track B — counsel-free bug fixes (batchable now, ~18 fixes):** repair the dead buyer loop, fix the "Year built" listing-creation blocker, close the unauthenticated-PII endpoints + dashboard IDOR, fix the "SOLD-before-charge" revenue hole, add marketplace transactional email + rate-limiting. These make the product *work* in staging behind the waitlist.
  - **Track C — Conner/counsel (tracked, not fleet-buildable):** form FlatSBO LLC; sign a GA broker-of-record partnership; engage counsel to ship ToS/Privacy + claim sign-off; (long-pole) start the GA salesperson pre-license course.
- **Dependencies:** **Track A + B have no dependencies — start immediately.** Flipping flatsbo from waitlist back to *live transactional* depends on **all four legal predicates being true** (entity formed, broker signed, counsel-signed legal pages live, claims true) — a hard gate the fleet must not cross. **Do not deepen transactional depth until the broker is signed and the entity is formed** (load-bearing audit rule).
- **Success criteria:** *(near-term, fleet-controlled)* site shows no false legal claims; transactional path is dark/waitlist; all P0 bugs fixed and the buyer loop works end-to-end in staging; ToS/Privacy pages exist (placeholder pending counsel). *(predicate-gated)* broker partnership signed + entity formed + counsel-signed pages live → flip to live.
- **Estimated cost:** Build ≈ **~1–1.5 steady weeks (~$3–5k fleet)** for Tracks A+B. Conner-time ≈ **moderate but spread** (LLC filing ~30 min; broker outreach + signing is the real time sink — unmetered). Cash ≈ **~$100 LLC + ~$300–2,500/yr insurance/MLS/registered-agent + counsel fees** (`conner_personal_tasks.md`).
- **Biggest risk + mitigation:** *Risk:* the legal predicate never closes (broker partnership has been overdue since ~2026-04-26), so the bug-fix work sits unused. *Mitigation:* Track A (legal-safe waitlist + claim removal) delivers value *regardless* of the predicate — it removes live legal exposure today; Track B is cheap and makes the product genuinely ready, so the predicate becomes the *only* remaining gate. Keep flatsbo investment proportional to agentplain priority (don't over-invest fleet weeks here while the broker is unsigned).

---

### Phase 5 — Replicate the proven motion (depth, not breadth)
**One-line goal:** Take the proven RE trial→paid runbook and replicate it on the next 1–2 *already-firing* verticals, unlock ready-on-unlock verticals as credentials land, and reach the first flatsbo close or a clear date for it.

- **Site(s):** both (agentplain-led).
- **Duration:** ~4–6 weeks (ongoing motion, not a fixed sprint).
- **Scope:**
  - **agentplain:** replicate the Phase-2/3 runbook on **CPA and law** (next-strongest firing verticals; depth on the locked set — explicitly *no new verticals*, per `feedback_no_new_verticals_finish_locked`). Recruit design partners, prove value, convert.
  - **Unlock ready-on-unlock verticals as connector credentials arrive** (insurance/EZLynx, mortgage/Encompass, title/Qualia) — these are partner-gated, so they land opportunistically, not on a fixed schedule.
  - **Document the service-hire trigger** — memory says ~25–40 customers funds the first full-time service hire (`unit-economics.md`); make the criteria explicit so Conner knows the exact threshold to hire against (the real scaling constraint is the human service layer, not compute).
  - **flatsbo:** if the legal predicate closed in Phase 4, flip to live → first GA listings → first $499 close. If not, hold at waitlist and report the gating date.
- **Dependencies:** Phase 3 proved a *repeatable* trial→paid motion on RE (not just one favor conversion). Connector unlocks depend on partner credentials (Conner/partner-gated). flatsbo go-live depends on Phase-4 predicate closure.
- **Success criteria:** trial→paid proven on **≥2 verticals** (RE + one of CPA/law); the service-hire trigger is documented with a customer-count threshold; ≥1 ready-on-unlock vertical activated *if* a credential landed; flatsbo has either its first close or a dated go-live plan.
- **Estimated cost:** Build ≈ **~2–3 steady weeks (~$3–5k/week fleet)** spread across replication + unlocks. Conner-time ≈ **the dominant cost again** (per-vertical founder outreach; unmetered). Cash ≈ **first paid-media test is *conditional* on a repeatable trial→paid reading** (per `project_money_gtm_pack` — no paid spend before then); flatsbo MLS dues (~$1,500–2,500/yr) if it goes live.
- **Biggest risk + mitigation:** *Risk:* spreading to vertical #2/#3 before RE is genuinely repeatable re-creates the "wide but shallow" failure the no-new-verticals rule exists to prevent. *Mitigation:* gate Phase 5 hard on Phase-3 *repeatability evidence* (OS calibration data), not on a single conversion. One vertical proven deep beats three proven shallow.

---

## Cross-cutting recommendations

1. **Sequence around the paused key, not against it.** The single most important structural fact in this plan: the 5 firing killer workflows are *deterministic* and need no LLM key. That means first value, first proof, and first paid conversion can all be reached with prod LLM paused. Treat LLM-dependent depth (conversational Plaino, Opus draft upgrades) as a *later* bet, behind whatever Conner decides about the key — never as a blocker to the proof motion.

2. **Conner-time is the real budget line, not tokens.** Fleet weeks are cheap ($3–8k/wk) and margin is 92–94%. The scarce resource across every phase is founder-led outreach and the broker relationship. Allocate Conner-time deliberately: Phases 2/5 (outreach) and flatsbo Track C (broker) are where his hours actually move the plan; the build phases need only hours of his decision-time.

3. **Manufacture proof before spending on distribution.** Memory is explicit: no paid media until a repeatable trial→paid reading exists. Every phase before Phase 5's conditional paid-media test is about *making the first proof real*, by hand. Resist the urge to scale a motion that isn't yet proven.

4. **Depth over breadth, enforced.** No new verticals; replicate only onto *already-firing* locked verticals; unlock ready-on-unlock verticals opportunistically as credentials land. The discipline is to make one vertical genuinely repeatable before touching the next.

5. **Keep flatsbo proportional and parallel.** flatsbo runs as a low-Conner-time parallel track (Tracks A+B are fleet-cheap and counsel-free), but it must never pull founder hours away from agentplain's proof motion or cross the GA license line. Its legal predicate is Conner/counsel-paced; the fleet's job is to make the product *ready*, not to wait.

---

## Phase 0 — what to do THIS WEEK (un-skippable, before any phase starts)

**Conner-actions (decisions + the one infra unblock):**
- **Approve the #320 merge** (Heritage Plains) — the direction is already decided; this is a merge approval, not a design decision.
- **Sign the per-tier budget caps** (Regular $60 / Partner $90 / Max $150 — `TODOS-FOR-CONNER` Item A) so the cost meter can be verified and Phase 1 can prove the guardrail.
- **Resume Neon compute** (`ep-aged-snow-aq0e4b6k`) to clear the prod Vercel red — required before any design partner touches the live app in Phase 2. *(This is the Neon unblock only; the LLM key stays paused.)*
- **Greenlight the RE design-partner outreach list** so Phase 2 can begin founder outreach the moment Phase 1 lands.
- **flatsbo:** authorize taking the transactional path **dark → waitlist** and removing the two false claims ("© Flatsbo, Inc.", "broker partnership in place") — this removes live legal exposure today and needs no counsel.

**Agent-actions (start immediately, no Conner dependency):**
- Open the Phase-1 work: #320 merge prep with the P0 CTA contrast fix + P1 a11y cluster + **brand-gate scope widening** (the structural fix).
- Begin the **ValueSummaryCard / customer-visible ROI** build (the renewal engine).
- Begin flatsbo **Track A (legal-safe posture)** + **Track B (counsel-free P0 bug fixes)** — both are dependency-free and remove exposure / unblock the product.
- Scaffold the **OS data layer** (`conner-queue`, `WORKING_STATE`, `budget-state`, `cv-bar-scores`) so the calibration loop has somewhere to write once Phase 3 activates it.

---

## Honest unknowns / where the plan could be wrong

1. **Whether the production key stays paused for the whole 90 days.** The plan is engineered to not need it, but if the deterministic workflows prove too thin to retain partners (i.e., customers want the conversational Plaino layer), the proof motion may stall and the key decision becomes load-bearing earlier than this plan assumes. *I cannot tell from current state how much of the perceived value depends on the LLM layer vs. the deterministic workflows.*

2. **Design-partner conversion velocity is entirely unmetered.** There is zero outreach history, so the 3–5-partners-in-4-weeks and ≥1-paid-in-Phase-3 targets are *structural placeholders*, not forecasts. If outreach is slower than hoped, Phases 2–3 stretch and Phase 5 slips. No memory source gives a conversion rate.

3. **The flatsbo broker partnership is the wildest variable.** It's been overdue since ~2026-04-26 with no signed broker. If it never closes, Phase 4's Track C and Phase 5's flatsbo go-live simply don't happen — the bug-fix work (Tracks A/B) still pays off as exposure-removal, but flatsbo generates no revenue in this horizon. The plan deliberately keeps flatsbo investment proportional for exactly this reason.

4. **The OS live-data activation may be heavier than its §9 plan suggests.** It was greenlit and scaffolded but never actually populated by the Librarian — "activating, not active." Whether Phase 3's activation is a few days or a multi-week effort is unverified from current state (the dormancy could be a thin wiring gap or a deeper integration problem).

5. **Two memory-vs-mission discrepancies I surfaced but did not resolve** (per the 1-hour bound):
   - The mission framed "5 locked verticals"; memory consistently names **10 locked verticals** (the "5" = the 5 with killer workflows *firing now*). This plan uses the firing-5 as the depth target, which is consistent either way — but the count should be reconciled.
   - The mission referenced a `feedback_no_ceiling_budget_2026_06_20` memory file and a `project_*operating_system*greenlight*` / `project_click_path_triage*` / `project_business_plan_ceo_10_lenses*` set that **do not exist by those names** in the mirrored agentplain memory dir. The budget posture I used comes from the OS spec's Tier-5 Burst envelope + `unit-economics.md` + `project_money_gtm_pack` instead. If those mission-referenced files exist in a different session's memory, they could shift the budget framing or the binding-constraint articulation — I could not read them in this checkout.

6. **Prod margin risk is correctly *future*, but the trigger is undefined.** Memory says COGS stays ~95% while workflows are deterministic, and jumps to 70–75% if drafts upgrade to per-item Opus. The plan never crosses that line, but *if* a design partner's retention turns out to require the richer LLM drafts, the margin model and the key decision both change at once — and I can't tell from current state how likely that is.
