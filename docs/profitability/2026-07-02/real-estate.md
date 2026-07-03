# Profitability lens — real-estate

**Run date:** 2026-07-02 · **Journey inputs:** docs/journeys/2026-07-02/real-estate--broker-owner.md, real-estate--individual-agent.md · **Schema:** v1

Rows cover every want with `delivering: partial|no`, deduped by fix via
`also_covers`. Full field detail below for high-impact rows; medium/low rows
are summarized in one table and fully specified in the machine block. Margin
bands are directional per the template — no fabricated dollars.

## High-impact rows

### real-estate.activation.connect.1 — connect Follow Up Boss and see triage in 5 minutes

| Field | Value |
|---|---|
| Build effort | S — wire the tile CTA to the api-key credential form; the killer-workflow runtime (PR #303) and FUB provider key already exist |
| Runtime cost | none — deterministic triage, ~0 LLM calls |
| Support burden | low |
| Tier | regular |
| Add-on viable | no — this IS the tier promise |
| Differentiator | differentiator vs manual FUB triage (incumbent: the broker themselves) |
| Margin @100/@1k/@10k | accretive / accretive / accretive — driver: zero marginal runtime; fix unblocks the whole activation funnel |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | outbound ✓ · byo ✓ (customer's own FUB key) · degraded ✓ · cost-arch ✓ |

Also covers `real-estate.activation.connect.4` (first drafted reply) — same
blocker. The advertised 5-minute first-value path fails at the Connect button
(05-connectors.md P1-5); everything downstream is already built.

### real-estate.renewal.worth-it.1 — see the time actually saved

| Field | Value |
|---|---|
| Build effort | S — add saved-time writers to the 4 uncovered calibrated actions + sweep paths (audit 09 names them); calibration table exists |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes for a guarantee-backed service |
| Margin @100/@1k/@10k | accretive ×3 — driver: directly prevents wrongful walk-away refunds (09 P0-1); this is margin defense, not feature spend |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate.renewal.worth-it.2`,
`real-estate-ia.renewal.defend-seat.1`. Highest ratio of margin protected to
effort in either vertical.

### real-estate.consideration.evaluate.2 — know exactly what trial I get

| Field | Value |
|---|---|
| Build effort | S — one decision (which trial policy is ratified) + make every surface consume `lib/billing/facts.ts` / `trialPeriodDaysForVertical` |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes |
| Margin @100/@1k/@10k | accretive ×3 — driver: trust at the buy moment; also removes a Truth-Wave RED |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate.signup.create-account.3` (card-required copy). Needs
one human decision (30d vs 7d) — flag to Conner, then pure copy/consumption fix.

### real-estate.awareness.first-contact.1 — understand the service before committing time

| Field | Value |
|---|---|
| Build effort | S — delete/fix the stale 308 in `next.config.mjs:22-25` |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes |
| Margin @100/@1k/@10k | accretive ×3 — driver: top-of-funnel unblock, one-line change |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

### real-estate.awareness.first-contact.2 — believe the ROI numbers

| Field | Value |
|---|---|
| Build effort | S — replace the unsubstantiated $2,900–$10,600/mo card with the derivation already in `lib/verticals/real-estate/content.ts` (26x math) or remove |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes (Truth Wave) |
| Margin @100/@1k/@10k | accretive ×3 — driver: claim integrity |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Pure docs/copy + voice-gate — the canonical L3 direct-PR candidate.

### real-estate.daily-use.morning.9 — know where my data lives, in my vocabulary

| Field | Value |
|---|---|
| Build effort | M — merge the stranded `feat/data-minimization-positioning-2026-06-18` branch, wire the #306 disclosure into the tile Connect path, add two-bucket framing to approvals/chat |
| Runtime cost | none |
| Support burden | low — reduces "what do you store" tickets |
| Tier | all |
| Add-on viable | no |
| Differentiator | differentiator — pass-through + account-lifetime-memory story no incumbent tells |
| Margin @100/@1k/@10k | accretive ×3 — driver: positioning asset, zero runtime |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate.activation.connect.2`, `real-estate.renewal.worth-it.3`
(deletion-claim honesty is the same story's other half — the deletion
*implementation* gaps are audit 10 P0 work, tracked there).

### real-estate.consideration.evaluate.6 — talk to a human before buying

| Field | Value |
|---|---|
| Build effort | S — provision scheduling link, resolve `{{CALENDLY_LINK}}`, wire the shipped demo runtime (PR #303) into the discovery agenda |
| Runtime cost | human-time — founder calls; the scarcest input, but pre-revenue it IS the job |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes for design-partner motion |
| Margin @100/@1k/@10k | accretive / neutral / dilutive — driver: founder hours don't scale; fine now, productize later |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate.awareness.first-contact.3`,
`real-estate.advocacy.refer.1`, `real-estate-ia.advocacy.word-of-mouth.1`,
`real-estate.awareness.persona-research` — proof, referral, and persona
validation all start with the same five design-partner conversations
(kaizen 05-sales: packets ready, zero sends).

### real-estate.daily-use.morning.4 — reject with a reason so it learns

| Field | Value |
|---|---|
| Build effort | S — mobile already accepts `{reason}`; add the textarea + pass-through on web |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | parity with mobile surface |
| Margin @100/@1k/@10k | accretive ×3 — driver: feeds the learning loop that justifies the subscription |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate-ia.daily-use.working.5`.

### real-estate.signup.create-account.4 — have what I agreed to on record

| Field | Value |
|---|---|
| Build effort | M — versioned clickwrap at signup + acceptance record; depends on entity + counsel (kaizen 08), which are human-blocked |
| Runtime cost | none |
| Support burden | none |
| Tier | all |
| Add-on viable | no |
| Differentiator | table-stakes (legal floor) |
| Margin @100/@1k/@10k | accretive ×3 — driver: risk removal; blocks professional-buyer verticals until done |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

### real-estate.expansion.roster.2 — a portal my clients can use

| Field | Value |
|---|---|
| Build effort | L — five P0s + activation path + CI coverage (audit 06); real subsystem work |
| Runtime cost | tokens-light (drafted replies via Haiku triage) + storage |
| Support burden | medium — end-client surface means end-client tickets |
| Tier | partner |
| Add-on viable | yes — client-facing portal is a natural paid add-on for Regular-tier workspaces |
| Differentiator | differentiator vs email-thread status quo |
| Margin @100/@1k/@10k | accretive / accretive / neutral — driver: storage + support scale with end-clients, not seats |
| **Classification** | sell-as-add-on |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `real-estate-ia` portal-cluster wants. Do not market it again until
the P0s are dead — it is currently a Truth-Wave liability, not an asset.

## Medium/low rows (summary — full detail in machine block)

| want_id | Fix | Effort | Class | Impact |
|---|---|---|---|---|
| real-estate.daily-use.morning.2 (+ia.4) | notify on all 8 approval-creation paths via shared seam | M | include-in-tier | medium |
| real-estate.daily-use.morning.5 (+ia.6) | queue count + pagination past 50 | S | include-in-tier | medium |
| real-estate.daily-use.morning.3 (+ia activation.2) | 44px touch targets in shell | S | include-in-tier | medium |
| real-estate.signup.create-account.1 (+ia.1) | magic-link POST-confirm interstitial | S | include-in-tier | medium |
| real-estate.consideration.evaluate.3 | reconcile the two guarantees; de-orphan /guarantee | S | include-in-tier | medium |
| real-estate.consideration.evaluate.5 | fix /security single-person + absolutes | S | include-in-tier | medium |
| real-estate-ia.signup.accept-invite.3 | server-side session revocation | M | include-in-tier | medium |
| real-estate-ia.awareness.invited.1/.2 | invited-seat onboarding screen (shared with cpa) | S | include-in-tier | medium |
| real-estate.activation.connect.5 | last-owner guard excludes INVITED | S | include-in-tier | medium |
| real-estate.expansion.roster.1 (+ia rooting wants) | CRM/MLS connectors (kvCORE, BoldTrail, FMLS/GAMLS) | XL | include-in-tier | medium — partner-program dependencies make timing external |
| real-estate-ia.expansion.champion.2 | minimal product analytics (activation funnel, approval latency) | M | include-in-tier | medium |
| real-estate.activation.connect.6 | loading.tsx for Connections/Reports | S | include-in-tier | low |
| real-estate-ia.daily-use.working.2 | per-listing approval grouping | M | include-in-tier | low |

## Machine block

```yaml
rows:
  - {want_id: real-estate.activation.connect.1, also_covers: [real-estate.activation.connect.4], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: deterministic 0-LLM runtime already shipped PR303, support_burden: low}, price_capture: {tier: regular, addon_viable: false, differentiator: differentiator, incumbent: broker doing it manually}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: zero marginal runtime; unblocks activation funnel}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.renewal.worth-it.1, also_covers: [real-estate.renewal.worth-it.2, real-estate-ia.renewal.defend-seat.1], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: writers on existing calibrated actions, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: prevents wrongful walk-away refunds — margin defense}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.consideration.evaluate.2, also_covers: [real-estate.signup.create-account.3], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: one policy decision + surfaces consume facts.ts, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: buy-moment trust; Truth-Wave RED removal}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.awareness.first-contact.1, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: one-line next.config.mjs fix, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: funnel unblock}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.awareness.first-contact.2, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: copy fix; voice-gate applies, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: claim integrity}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.daily-use.morning.9, also_covers: [real-estate.activation.connect.2, real-estate.renewal.worth-it.3], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: merge stranded branch + wire disclosure, support_burden: low}, price_capture: {tier: all, addon_viable: false, differentiator: differentiator, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: positioning asset zero runtime}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.consideration.evaluate.6, also_covers: [real-estate.awareness.first-contact.3, real-estate.advocacy.refer.1, real-estate-ia.advocacy.word-of-mouth.1, real-estate.awareness.persona-research], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: human-time, runtime_notes: founder design-partner calls; packets ready zero sends, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: neutral, at_10000_customers: dilutive, driver: founder hours; correct spend pre-revenue}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.daily-use.morning.4, also_covers: [real-estate-ia.daily-use.working.5], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: mobile already accepts reason; add web textarea, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: parity, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: feeds learning loop}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.signup.create-account.4, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: clickwrap + record; human-blocked on entity/counsel, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: risk removal}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.expansion.roster.2, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: L, runtime_cost: tokens-light, runtime_notes: Haiku-drafted portal replies + storage, support_burden: medium}, price_capture: {tier: partner, addon_viable: true, differentiator: differentiator, incumbent: email threads}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: neutral, driver: storage + end-client support scale with clients not seats}, classification: sell-as-add-on, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.daily-use.morning.2, also_covers: [real-estate-ia.daily-use.working.4], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: notify seam across 8 creation paths, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: engagement}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.daily-use.morning.5, also_covers: [real-estate-ia.daily-use.working.6], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: count + pagination, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: trust}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.daily-use.morning.3, also_covers: [real-estate-ia.activation.first-week.2], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: CSS touch targets, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: mobile-first personas}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.signup.create-account.1, also_covers: [real-estate-ia.signup.accept-invite.1], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: POST-confirm interstitial for magic links, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: first-touch reliability}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.consideration.evaluate.3, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: one policy decision + copy + sitemap link, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: trust}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.consideration.evaluate.5, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: copy fix flagged for Conner since Truth Wave, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: trust}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate-ia.signup.accept-invite.3, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: server-side session store/denylist, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: security floor}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate-ia.awareness.invited.1, also_covers: [real-estate-ia.awareness.invited.2], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: one onboarding screen shared with cpa invited seats, support_burden: low}, price_capture: {tier: all, addon_viable: false, differentiator: parity, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: seat utilization drives renewal}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.activation.connect.5, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: guard excludes INVITED owners, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: lockout prevention}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.expansion.roster.1, also_covers: [real-estate-ia.daily-use.working.1, real-estate-ia.daily-use.working.7, real-estate-ia.expansion.champion.1], vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: XL, runtime_cost: integration, runtime_notes: kvCORE/BoldTrail partner programs + MLS (RESO) plumbing; external timing, support_burden: medium}, price_capture: {tier: regular, addon_viable: false, differentiator: differentiator, incumbent: manual MLS + CRM}, margin_band: {at_100_customers: accretive, at_1000_customers: neutral, at_10000_customers: neutral, driver: integration upkeep scales with connector count}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate-ia.expansion.champion.2, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: activation funnel + approval-latency events from existing exhaust, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: renewal evidence}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate.activation.connect.6, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: two loading.tsx files, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: polish}, classification: include-in-tier, impact: low, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate-ia.daily-use.working.2, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: per-listing approval grouping view, support_burden: none}, price_capture: {tier: regular, addon_viable: false, differentiator: parity, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: usability}, classification: include-in-tier, impact: low, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: real-estate-ia.activation.first-week.1, vertical: real-estate, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: verify per-agent scoping of Today tab — audit task not build task, support_burden: none}, price_capture: {tier: regular, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: verdict needed}, classification: include-in-tier, impact: low, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
```

## Roll-up

- **Counts:** 23 rows (covering 35 wants via `also_covers`): include-in-tier 22 ·
  sell-as-add-on 1 · partner-referral 0 · do-not-build 0. Effort: S 14 · M 6 ·
  L 1 · XL 1. Impact: high 10 · medium 10 · low 3.
- **Best include-in-tier candidate:** `real-estate.activation.connect.1` — an
  S-effort UI fix that unblocks the entire advertised first-5-minutes value
  path with zero runtime cost.
- **Best add-on candidate:** `real-estate.expansion.roster.2` (client portal)
  — real willingness-to-pay and a differentiator, but only after the audit-06
  P0s are dead; today it is a liability.
