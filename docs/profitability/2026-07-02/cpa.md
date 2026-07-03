# Profitability lens — cpa

**Run date:** 2026-07-02 · **Journey inputs:** docs/journeys/2026-07-02/cpa--partner-owner.md, cpa--staff-accountant.md · **Schema:** v1

Rows deduped by fix via `also_covers`. CPA is the Partner-tier vertical
($299/mo solo) — every row is judged against that price point. Universal
fixes that also appear in the real-estate file (trial truth, approval loop,
guarantee writers) are rowed here with CPA want ids so the heartbeat can
dedup on overlap.

## High-impact rows

### cpa.activation.practice-mgmt.1a — stop advertising TaxDome/Karbon as connectable (truth fix)

| Field | Value |
|---|---|
| Build effort | S — either wire `connectMode` + credential form to the existing api-key path, or flip both tiles to `coming-soon` with honest copy |
| Runtime cost | none |
| Support burden | none — removes a guaranteed support ticket per CPA signup |
| Tier | partner |
| Add-on viable | no |
| Differentiator | table-stakes (Truth Wave) |
| Margin @100/@1k/@10k | accretive ×3 — driver: every CPA who hits the dead Connect button today churns at the activation moment |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

The audit-05 P0-1 finding split in two: this row is the honest-today fix; the
next row is the real capability.

### cpa.activation.practice-mgmt.1b — live TaxDome/Karbon adapters (the real capability)

| Field | Value |
|---|---|
| Build effort | L — replace stubbed-JSON MCP endpoints with live adapters; month-end-close skill already consumes the JSON shape (docs/agent-interviews/01-runtime-skills.md) |
| Runtime cost | integration — API upkeep on two vendors; reads only (pass-through, BYO key) |
| Support burden | medium — credential setup help |
| Tier | partner |
| Add-on viable | no — it IS the Partner-tier CPA promise; all 6 rooting agents depend on it |
| Differentiator | differentiator — no incumbent runs a draft-and-approve loop inside TaxDome/Karbon |
| Margin @100/@1k/@10k | accretive / accretive / neutral — driver: integration upkeep; runtime stays deterministic-read + Haiku-triage drafting |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.daily-use.season-morning.1`,
`cpa-sa.activation.first-engagement.1`, `cpa-sa.activation.first-engagement.2`,
`cpa-sa.daily-use.grind.1`, `cpa.awareness.research.1` — the single
highest-leverage build in the vertical.

### cpa-sa.daily-use.grind.2 — books-reconciliation worker on the already-live QBO connector

| Field | Value |
|---|---|
| Build effort | M — `cpa-books-recon` agent exists as rooting config; QBO data path is live; build the worker, not the plumbing |
| Runtime cost | tokens-light — deterministic reads + Haiku triage for anomaly drafts; cacheable ledger context |
| Support burden | low |
| Tier | partner |
| Add-on viable | no |
| Differentiator | differentiator vs manual monthly recon |
| Margin @100/@1k/@10k | accretive ×3 — driver: no new integration upkeep (QBO already maintained); cheap tokens against a $299 seat |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

The cheapest path to a second live CPA agent — the only rooting agent whose
data dependency is already connected. Ship this before the L-effort adapters.

### cpa.daily-use.season-morning.3 — pre-file compliance flags (activate the CPA sentinel)

| Field | Value |
|---|---|
| Build effort | S — 7 rules already loaded in `lib/agents/sentinel/corpus/cpa`; the work is counsel verification + flipping verified flags (pattern proven by real-estate's live sentinel) |
| Runtime cost | none — deterministic rule evaluation |
| Support burden | none |
| Tier | partner |
| Add-on viable | no |
| Differentiator | differentiator — Circular 230 / AICPA-aware review no generalist competitor carries |
| Margin @100/@1k/@10k | accretive ×3 — driver: one-time counsel spend amortizes across every CPA customer forever |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.awareness.research.2`, `cpa-sa.daily-use.grind.6`,
`cpa.advocacy.state-society.1`. Human-blocked on counsel — the same counsel
engagement the legal-floor row needs; batch them.

### cpa.consideration.partner-tier.2 — make the 4 hrs/mo named-partner time real

| Field | Value |
|---|---|
| Build effort | S — booking link + a fulfillment ledger (even a YAML file); the promise already exists in the tier rationale |
| Runtime cost | human-time — 4 hrs/mo × Partner seats is real COGS |
| Support burden | none (it IS the support) |
| Tier | partner |
| Add-on viable | no — already priced in |
| Margin @100/@1k/@10k | accretive / neutral / dilutive — driver: human hours scale linearly; at volume this needs pooled office-hours productization or the promise must change before it's dishonest |
| Differentiator | differentiator — "named service partner" is the Plaino story made contractual |
| **Classification** | include-in-tier |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Today this is a paid promise with no delivery path — a tier-promise-integrity
problem in the same family as the guarantee undercount.

### cpa.consideration.partner-tier.3 — know my trial terms

| Field | Value |
|---|---|
| Build effort | S — same fix as real-estate row (one policy decision + surfaces consume `trialPeriodDaysForVertical`) |
| Runtime cost | none · Support | none · Tier | all · Add-on | no · Differentiator | table-stakes |
| Margin @100/@1k/@10k | accretive ×3 — driver: buy-moment trust |
| **Classification** | include-in-tier · **Impact** | high · Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.signup.firm-workspace.1`.

### cpa.consideration.partner-tier.5 — engagement-letter-grade legal posture

| Field | Value |
|---|---|
| Build effort | M — entity confirmation, counsel sign-off on published docs, DPA route, clickwrap record (kaizen 08 names all four); mostly Conner/counsel time, not code |
| Runtime cost | human-time (one-time) · Support | none · Tier | all · Add-on | no · Differentiator | table-stakes for professional-services buyers |
| Margin @100/@1k/@10k | accretive ×3 — driver: unblocks the two highest-ARPU verticals (CPA, law) |
| **Classification** | include-in-tier · **Impact** | high · Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.signup.firm-workspace.3`.

### cpa.renewal.after-season.1 — see hours reclaimed vs the 12x claim

| Field | Value |
|---|---|
| Build effort | S — same guarantee saved-time writers as the real-estate row, plus CPA actions in the calibration table |
| Runtime cost | none · Support | none · Tier | all · Add-on | no · Differentiator | table-stakes |
| Margin @100/@1k/@10k | accretive ×3 — driver: margin defense (wrongful refunds) + renewal evidence |
| **Classification** | include-in-tier · **Impact** | high · Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.renewal.after-season.2`, `cpa-sa.renewal.defend-seat.1`.

### cpa.consideration.partner-tier.4 — confidence about client-data handling

| Field | Value |
|---|---|
| Build effort | M — same two-bucket merge + disclosure wiring as real-estate; CPA copy must speak confidentiality vocabulary |
| Runtime cost | none · Support | low · Tier | all · Add-on | no · Differentiator | differentiator |
| Margin @100/@1k/@10k | accretive ×3 — driver: positioning asset |
| **Classification** | include-in-tier · **Impact** | high · Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa.activation.practice-mgmt.3`.

### cpa.expansion.rollout.2 — a client portal for document exchange

| Field | Value |
|---|---|
| Build effort | L — audit-06 P0s (PORTAL-5 bytes-discarded is the CPA-killing one) + activation path |
| Runtime cost | tokens-light + storage · Support | medium (end-client tickets) · Tier | partner · Add-on | yes |
| Differentiator | parity with TaxDome's own portal — for CPAs this must exist but won't win alone |
| Margin @100/@1k/@10k | accretive / accretive / neutral — driver: storage + end-client support |
| **Classification** | sell-as-add-on |
| **Impact** | high |
| Rule check | ✓ ✓ ✓ ✓ |

Also covers `cpa-sa.expansion.depend.1`.

## Medium/low rows (summary — full detail in machine block)

| want_id | Fix | Effort | Class | Impact |
|---|---|---|---|---|
| cpa.daily-use.season-morning.4 (+sa.4/.5) | approval loop: notify all paths, web reason field, 50-cap | M | include-in-tier | medium |
| cpa.daily-use.season-morning.5 | collections worker on QBO AR feed (after books-recon) | M | include-in-tier | medium |
| cpa.expansion.rollout.3 | engagement-letter + 8879 routing on gated DocuSign | M | include-in-tier | medium |
| cpa-sa.awareness.invited.1 (+.2) | invited-seat onboarding (shared build with real-estate) | S | include-in-tier | medium |
| cpa-sa.signup.accept.1 | magic-link POST-confirm (shared) | S | include-in-tier | medium |
| cpa-sa.signup.accept.3 | server-side session revocation (confidentiality-weighted) | M | include-in-tier | medium |
| cpa.consideration.partner-tier.1 | surface Partner-tier rationale in product/pricing page | S | include-in-tier | medium |
| cpa.awareness.research.3 (+sa advocacy) | founder design-partner motion (shared row with real-estate) | S | include-in-tier | medium |
| cpa.renewal.after-season.3 | seasonal pause/downgrade — needs real customer signal first | M | do-not-build | low |

## Machine block

```yaml
rows:
  - {want_id: cpa.activation.practice-mgmt.1a, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: wire connectMode or flip to coming-soon, support_burden: none}, price_capture: {tier: partner, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: activation-moment churn prevention}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.activation.practice-mgmt.1b, also_covers: [cpa.daily-use.season-morning.1, cpa-sa.activation.first-engagement.1, cpa-sa.activation.first-engagement.2, cpa-sa.daily-use.grind.1, cpa.awareness.research.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: L, runtime_cost: integration, runtime_notes: live adapters replacing stub MCP; reads pass-through BYO, support_burden: medium}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: manual practice-mgmt work}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: neutral, driver: two-vendor integration upkeep}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa-sa.daily-use.grind.2, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: tokens-light, runtime_notes: deterministic QBO reads + Haiku anomaly drafts; cacheable, support_burden: low}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: manual monthly recon}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: no new integration upkeep; cheap tokens vs $299 seat}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.daily-use.season-morning.3, also_covers: [cpa.awareness.research.2, cpa-sa.daily-use.grind.6, cpa.advocacy.state-society.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: counsel-verify 7 loaded rules; deterministic eval, support_burden: none}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: one-time counsel spend amortizes forever}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.consideration.partner-tier.2, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: human-time, runtime_notes: booking + fulfillment ledger; 4h/mo per Partner seat is real COGS, support_burden: none}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: neutral, at_10000_customers: dilutive, driver: linear human hours; needs pooled productization at scale or the promise changes}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.consideration.partner-tier.3, also_covers: [cpa.signup.firm-workspace.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: shared fix with real-estate trial row, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: buy-moment trust}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.consideration.partner-tier.5, also_covers: [cpa.signup.firm-workspace.3], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: human-time, runtime_notes: entity + counsel + DPA + clickwrap; kaizen-08 map, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: unblocks high-ARPU professional verticals}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.renewal.after-season.1, also_covers: [cpa.renewal.after-season.2, cpa-sa.renewal.defend-seat.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: guarantee writers + CPA calibration entries, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: margin defense + renewal evidence}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.consideration.partner-tier.4, also_covers: [cpa.activation.practice-mgmt.3], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: two-bucket merge + disclosure wiring in confidentiality vocabulary, support_burden: low}, price_capture: {tier: all, addon_viable: false, differentiator: differentiator, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: positioning asset}, classification: include-in-tier, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.expansion.rollout.2, also_covers: [cpa-sa.expansion.depend.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: L, runtime_cost: tokens-light, runtime_notes: audit-06 P0s first; storage + Haiku drafts, support_burden: medium}, price_capture: {tier: partner, addon_viable: true, differentiator: parity, incumbent: TaxDome portal}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: neutral, driver: storage + end-client support}, classification: sell-as-add-on, impact: high, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.daily-use.season-morning.4, also_covers: [cpa-sa.daily-use.grind.4, cpa-sa.daily-use.grind.5], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: shared approval-loop fixes with real-estate, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: engagement + learning loop}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.daily-use.season-morning.5, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: tokens-light, runtime_notes: collections worker on QBO AR after books-recon lands, support_burden: low}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: manual AR chasing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: reuses QBO plumbing}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.expansion.rollout.3, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: routing flow on already-gated DocuSign (PR280), support_burden: low}, price_capture: {tier: partner, addon_viable: false, differentiator: parity, incumbent: manual routing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: reuses gate seam}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa-sa.awareness.invited.1, also_covers: [cpa-sa.awareness.invited.2], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: shared invited-seat onboarding build, support_burden: low}, price_capture: {tier: all, addon_viable: false, differentiator: parity, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: seat utilization}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa-sa.signup.accept.1, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: shared magic-link POST-confirm, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: first-touch reliability}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa-sa.signup.accept.3, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: server-side revocation; confidentiality-weighted for CPA, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: security floor}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.consideration.partner-tier.1, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: none, runtime_notes: surface tier rationale on pricing page; voice-gate applies, support_burden: none}, price_capture: {tier: partner, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: accretive, at_10000_customers: accretive, driver: conversion}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.awareness.research.3, also_covers: [cpa-sa.advocacy.classmates.1], vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: S, runtime_cost: human-time, runtime_notes: shared founder design-partner motion, support_burden: none}, price_capture: {tier: all, addon_viable: false, differentiator: table-stakes, incumbent: nothing}, margin_band: {at_100_customers: accretive, at_1000_customers: neutral, at_10000_customers: dilutive, driver: founder hours}, classification: include-in-tier, impact: medium, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
  - {want_id: cpa.renewal.after-season.3, vertical: cpa, run_date: 2026-07-02, cost_to_deliver: {build_effort: M, runtime_cost: none, runtime_notes: billing pause/downgrade concept; zero real signal on seasonal WTP, support_burden: low}, price_capture: {tier: partner, addon_viable: false, differentiator: differentiator, incumbent: nothing}, margin_band: {at_100_customers: neutral, at_1000_customers: neutral, at_10000_customers: neutral, driver: revenue deferral by design}, classification: do-not-build, impact: low, rule_check: {no_outbound: true, byo_key: true, degraded_mode_safe: true, cost_architecture: true}}
```

## Roll-up

- **Counts:** 19 rows (covering 33 wants): include-in-tier 17 · sell-as-add-on 1 ·
  partner-referral 0 · do-not-build 1 (seasonal pause — revisit only with real
  customer signal). Effort: S 8 · M 8 · L 2. Impact: high 10 · medium 8 · low 1.
- **Best include-in-tier candidate:** `cpa-sa.daily-use.grind.2`
  (books-reconciliation worker) — the only rooting CPA agent whose data
  dependency (QBO) is already live; M effort, tokens-light, no new integration
  upkeep, and it gives the Partner tier a second visible agent while the
  L-effort TaxDome/Karbon adapters are built.
- **Best add-on candidate:** `cpa.expansion.rollout.2` (client document
  portal) — but for CPA it competes with TaxDome's own portal, so it's
  parity-priced, not premium; the byte-discarding P0 must die first either way.
