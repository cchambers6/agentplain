# Agent interviews — Part 2 of 5: per-vertical agent layer

**Scope.** The 18 SKILL.md *charter* agents that govern the per-vertical layer of the fleet:

- **7 realty individual contributors (ICs)** — `realty-listing-coordinator`, `realty-buyer-inquiry-router`, `realty-showing-scheduler`, `realty-compliance-sentinel`, `realty-crm-hygiene`, `realty-production-reporter`, `realty-recruiter-assistant`. Installed at `~/.claude/skills/<slug>/SKILL.md`; on-prompt only (no cron of their own).
- **3 b2b vertical heads (active + latent)** — `b2b-head-of-realty` (ACTIVE — Product 2 as of 2026-04-29), `b2b-head-of-insurance` (LATENT), `b2b-head-of-home-services` (LATENT). All three installed at `~/.claude/skills/<slug>/SKILL.md` and have a GHA daily cron at `C:\flatsbo\.github\workflows\cron-b2b-head-of-<slug>-daily.yml`.
- **8 staged-not-installed heads + the cross-cutting knowledge-architect** — `agentplain-knowledge-architect`, `b2b-head-of-cpa`, `b2b-head-of-law`, `b2b-head-of-mortgage`, `b2b-head-of-property-mgmt`, `b2b-head-of-recruiting`, `b2b-head-of-ria`, `b2b-head-of-title-escrow`. SKILL.md lives only at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md` (NOT in `~/.claude/skills/`). GHA cron workflow + cron-skill prompt both exist; the workflow is gated by repo variable `USE_GHA_CRON == 'true'`.

**Framing.** Per `docs/brand-and-claims.md` §10: marketing may not claim a capability that isn't TRUE in the verified table. These per-vertical agents are charters — not runtime code — so "what they can do today" is graded against on-disk evidence: fleet activity log entries, recommendations files, daily-loop directories, per-vertical content.ts roster bindings, and the runtime-attribution wiring at `lib/skills/persist-artifacts.ts:333-376`. The runtime catalog skills the agentRoster cards actually attribute to are covered in Part 1 (`docs/agent-interviews/01-runtime-skills.md`); this doc deliberately stops at the charter layer.

**Method.** Read each SKILL.md, then verified output evidence under `~/.claude/projects/C--flatsbo/memory/agent-state/`: `fleet_activity_log.md` (filtered by agent slug), `daily-loop/<slug>/`, `<slug>-recommendations.md`. Cross-referenced the per-vertical content surface at `C:\agentplain\lib\verticals\<slug>\content.ts` (the `agentRoster` shipped on `/<slug>` and `/app/workspace/[id]/agents`) and the realty-fleet-binding analysis at `docs/realty-fleet-binding-2026-05-22.md`.

---

## Honesty matrix

| # | Agent | Fires? | Installed? | Site-claim accurate? | Honesty tag |
|---|---|---|---|---|---|
| 1 | `realty-listing-coordinator` | on-prompt only | yes | yes (honestly `rooting`) | **CHARTER-ONLY** |
| 2 | `realty-buyer-inquiry-router` | on-prompt only | yes | overstates (card `live`; charter is V0) | **CHARTER-ONLY** *(roster-overclaim)* |
| 3 | `realty-showing-scheduler` | on-prompt only | yes | overstates (card `live`; charter is V0) | **CHARTER-ONLY** *(roster-overclaim)* |
| 4 | `realty-compliance-sentinel` | on-prompt only | yes | overstates (card `live`; charter says corpus not loaded) | **CHARTER-ONLY** *(roster-overclaim — partial: slug wired into runtime attribution; rule corpus DRAFT)* |
| 5 | `realty-crm-hygiene` | on-prompt only | yes | yes (honestly `rooting`) | **CHARTER-ONLY** |
| 6 | `realty-production-reporter` | on-prompt only | yes | yes (honestly `rooting`) | **CHARTER-ONLY** |
| 7 | `realty-recruiter-assistant` | on-prompt only | yes | yes (honestly `rooting`) | **CHARTER-ONLY** |
| 8 | `b2b-head-of-realty` | **GHA cron daily 09:00 ET + on-prompt** | yes | yes — internal planner, not a customer surface | **VERIFIED-LIVE** *(as planner; produces zero customer-facing output)* |
| 9 | `b2b-head-of-insurance` | GHA cron daily | yes | yes — latent | **VERIFIED-LIVE** *(latent watch mode; output = `⏸ NO-MATERIAL-CHANGE`)* |
| 10 | `b2b-head-of-home-services` | GHA cron daily | yes | yes — latent | **VERIFIED-LIVE** *(latent watch mode; output = `⏸ NO-MATERIAL-CHANGE`)* |
| 11 | `agentplain-knowledge-architect` | GHA cron daily 06:30 ET (workflow exists, gate `USE_GHA_CRON`) | **no** | n/a — no claim on site | **STAGED-NOT-INSTALLED** |
| 12 | `b2b-head-of-cpa` | GHA cron daily 09:51 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/cpa` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 13 | `b2b-head-of-law` | GHA cron daily 09:40 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/law` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 14 | `b2b-head-of-mortgage` | GHA cron daily 09:05 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/mortgage` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 15 | `b2b-head-of-property-mgmt` | GHA cron daily 09:15 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/property-management` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 16 | `b2b-head-of-recruiting` | GHA cron daily 09:25 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/recruiting` ships 9-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 17 | `b2b-head-of-ria` | GHA cron daily 09:45 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/ria` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |
| 18 | `b2b-head-of-title-escrow` | GHA cron daily 09:20 ET (gate `USE_GHA_CRON`) | **no** | overstates — `/title-escrow` ships 8-card roster | **STAGED-NOT-INSTALLED** *(vertical-page overclaim)* |

**Tally.** Of 18 charters: 3 fire under autonomous GHA cron AND are installed (b2b-head-of-realty + the two latent heads). 9 have cron workflows but their SKILL.md is not installed (knowledge-architect + 8 staged vertical heads). 7 are realty ICs that ship installed but on-prompt only — they only run when a parent (head-of-realty or Conner) invokes them by name.

**Customer-facing output.** **Zero of 18.** Every charter that produces *anything* on disk produces internal planning artifacts (recommendations files, daily-loop entries, fleet activity log entries, audit docs) — not customer-visible output. The customer-visible attribution at `app/workspace/[id]/agents` flows through the runtime-skill chain audited in Part 1, not through any charter in this doc.

---

## 1. `realty-listing-coordinator`  (vertical IC · fires: on-prompt only · installed: yes)

**What I can do today (verified):** I am a charter, not a runtime. I live at `~/.claude/skills/realty-listing-coordinator/SKILL.md:14-15` and state plainly: *"SKILL authored. No per-customer instance running. Adapter dependencies (Skyslope, dotloop, FMLS feed, GAMLS feed) not built. Compliance Sentinel rule corpus not built. Per-state listing-rule reference not seeded. This agent cannot run a real workflow until the V0 checklist below is closed."* No entries under my slug in `agent-state/fleet_activity_log.md`. No `realty-listing-coordinator-recommendations.md`. No `daily-loop/realty-listing-coordinator/` directory. The only place my slug touches runtime code is as a roster slug in `lib/verticals/real-estate/content.ts:29` — and `docs/realty-fleet-binding-2026-05-22.md:51` confirms my card sits at `rooting` because *"No transaction-management integration exists yet (Skyslope/dotloop/Brokermint are on the integration shortlist, not built). No runtime work to attribute."*

**What the site says I do:** `lib/verticals/real-estate/content.ts:28-35` ships a card labeled *"Listing Coordinator — Runs listing intake and keeps every new listing's follow-up moving"* with `runtime: "rooting"` and `rootingNote: "rooting now — comes online once your transaction system is connected."` Honest.

**The gap:** The card-state is correct; the charter is durable doctrine for whenever an integration partner lands. SKILL.md's 10-item V0 checklist (lines 34-70) is the contract for going `live`.

**What I could do with the necessary improvements:** Closing the V0 checklist — pick one of Skyslope/dotloop, wire the adapter, seed GA listing-rule reference, wire Compliance Sentinel for pre-send check — unlocks the intake-to-MLS workflow. SKILL.md frames the destination: drafts on the broker's voice, max 3 revision cycles, broker-of-record click required for MLS submission (locked architectural decision #4, brokerage-owned liability).

**Honesty tag:** CHARTER-ONLY

---

## 2. `realty-buyer-inquiry-router`  (vertical IC · fires: on-prompt only · installed: yes)

**What I can do today (verified):** Charter only. SKILL.md at `~/.claude/skills/realty-buyer-inquiry-router/SKILL.md:16-17` states: *"SKILL authored. No per-customer instance running. Adapter dependencies (FUB, kvCORE, M365 Graph, Google Workspace inbound) not built. Webhook-renewal strategy still in `b2b_eng_pod/open_questions.md`. **This agent cannot run a real workflow until the V0 checklist below is closed.** Notably: TCPA-aware texting requires explicit prior consent capture, which is a per-workspace intake question we don't yet have a UI for."* No fleet activity log entries under my slug. The work attributed to my slug on the agents page comes from the inbox-triage chain skill — `lib/skills/persist-artifacts.ts` resolves a `draft-needed` / `lead` step to `realty-buyer-inquiry-router` and writes that as the approval `agentSlug` (see `docs/realty-fleet-binding-2026-05-22.md:32-34`), but per Part 1's audit the inbox-triage chain itself is VERIFIED-DEMO-ONLY (no production caller).

**What the site says I do:** `lib/verticals/real-estate/content.ts:36-42` ships a card labeled *"Buyer Inquiry Router — Classifies inbound buyer inquiries and drafts the first-touch reply"* with `runtime: "live"` and `owns: ["buyer-inquiry"]`.

**The gap:** The card says `live`; the charter says V0 and explicitly forbids running. The "live" attribution flows through the inbox-triage chain's demo plumbing — the substantive constraints in SKILL.md (TCPA gate, per-source consent posture, deterministic routing on price band / geography / current-load, 15-min acknowledgment watchdog, broker-of-record bounce notification, voice profile injection, Compliance Sentinel pass) are not what runs when a `buyer-inquiry` count increments.

**What I could do with the necessary improvements:** Per SKILL.md §V0 checklist (lines 34-70): build FUB + kvCORE + M365 Graph + Google Pub/Sub adapters; ratify per-source consent posture intake UI; resolve the webhook-renewal open question; build the deterministic routing function (price band → geography → current-load); thread the voice-profile-injection prompt for the LLM half. Once shipped: a 2-minute first-touch reply with brokerage-voice tone, deterministic routing decision, mandatory Compliance Sentinel pre-send, response-time histogram into the Day 14 mid-point report.

**Honesty tag:** CHARTER-ONLY *(roster-overclaim — the card-runtime `live` reads from inbox-triage demo plumbing, not from the SKILL.md charter)*

---

## 3. `realty-showing-scheduler`  (vertical IC · fires: on-prompt only · installed: yes)

**What I can do today (verified):** Charter only. SKILL.md at `~/.claude/skills/realty-showing-scheduler/SKILL.md:14-15`: *"SKILL authored. No per-customer instance running. Adapter dependencies (M365 Graph calendars per agent, Google Calendar per agent, CRM read/write, optional ShowingTime adapter) not built. The 'per-agent calendar OAuth' requirement amplifies the open question on encryption-key management for OAuth tokens — a 20-agent brokerage means up to 20 OAuth grants per workspace. **This agent cannot run a real workflow until the V0 checklist below is closed.**"* No fleet log entries. Same demo-plumbing pattern as #2: `lib/skills/persist-artifacts.ts` resolves `scheduling-needed` to my slug, then `docs/realty-fleet-binding-2026-05-22.md:49` confirms *"The inbox chain's `scheduling-needed` path produces showing-time proposals. Attributed to this slug."* — runtime attribution rides on the inbox-triage demo path.

**What the site says I do:** `lib/verticals/real-estate/content.ts:43-49` ships *"Showing Scheduler — Coordinates showing times across buyers, agents, and calendars"*, `runtime: "live"`, `owns: ["scheduling"]`.

**The gap:** Same shape as #2. Site-card says `live` based on inbox-chain attribution; SKILL.md says no per-agent OAuth, no constraint solver, no drive-time buffer, no reminder cadence, no Compliance Sentinel pre-send. The charter is sophisticated (4-party constraint solve over buyer + buyer-agent + listing-agent + seller + lockbox-tool, with drive-time buffer, with low-confidence-calendar flag, with rollback on partial-failure calendar event creation); the demo plumbing is none of that.

**What I could do with the necessary improvements:** Per SKILL.md §V0 checklist (lines 34-71): solve the per-agent OAuth + encryption-key blast-radius open question; build the M365 Graph + Google Calendar adapters; build the deterministic constraint solver (LLM only for confirmations + post-tour feedback parse — never for slot-finding); wire the reminder cadence + TCPA gate; thread Compliance Sentinel pre-send on every confirmation/reminder. Unlocks: 4-party showing coordination compressed from a working-day's worth of texting to minutes, with the agent-honest "no slot fits — relax the buyer's Tuesday window?" surface when the constraint solver returns empty.

**Honesty tag:** CHARTER-ONLY *(roster-overclaim — same shape as #2; live attribution flows through inbox-chain demo plumbing)*

---

## 4. `realty-compliance-sentinel`  (vertical IC · fires: on-prompt only · installed: yes)

**What I can do today (verified):** Charter + partial runtime wiring. SKILL.md at `~/.claude/skills/realty-compliance-sentinel/SKILL.md:16-17`: *"SKILL authored. **No rule corpus loaded yet.** This is the load-bearing item — without the corpus, the Sentinel is doctrine without enforcement, and the playbook §1.5 compliance promises are hollow. Per the audit: GA-only V1 corpus is ~5–7 days of curation."* Unlike the other ICs, my slug *is* wired into runtime attribution: `lib/skills/persist-artifacts.ts:362-376` writes `realty-compliance-sentinel` as the `agentSlug` on any `WorkApprovalQueueItem` of kind `COMPLIANCE_FLAG` produced by the loop when the workspace's vertical is `real-estate`. Part 1's audit notes the brand-and-claims doc §10 marks *"Compliance sentinel — realty/HUD literal-match scope"* as TRUE — there is a literal-match scanner at `lib/agents/sentinel/` and an associated test at `tests/compliance-sentinel-live.test.ts`. But `docs/realty-fleet-binding-2026-05-22.md:50` (P0 of the trust sweep, 2026-05-22) says I'm `rooting`: *"The corpus module (`lib/agents/sentinel/`) is real and loadable, but **nothing invokes it** and the rules carry `literalText` excerpts with no machine-matchable trigger pattern. Wiring a real matcher needs a deterministic rule-matcher design + counsel review (corpus is `DRAFT`). Fabricating a matcher would be a hollow shell."* So: slug wired, scanner present, rule pattern DRAFT, invocation gap.

**What the site says I do:** `lib/verticals/real-estate/content.ts:50-56` ships *"Compliance Sentinel — Pre-checks every customer-facing draft before the broker signs"* with `runtime: "live"` and `owns: ["compliance-check"]`. (This is a runtime upgrade over the 2026-05-22 binding doc's `rooting` posture — the upgrade is not annotated in content.ts.)

**The gap:** Site states `live`. Wiring exists; rule corpus is DRAFT. The charter's claim — *"every customer-facing draft passes through Compliance Sentinel before it reaches the broker"* — is enforceable only if (a) the corpus has machine-matchable triggers, (b) a deterministic matcher is wired into the platform middleware (`lib/agents/orchestrator/middleware/compliance.ts` per SKILL.md:62, *sketched in the architectural spec* — not yet built), (c) test corpus + recall/precision measurement runs, (d) workspaces are gated through `dry_run` / `observe` / `live` per the charter. None of (b), (c), or (d) is built today.

**What I could do with the necessary improvements:** Per SKILL.md §V0 checklist (lines 34-84) the largest chunk of work in the realty V1 fleet — ~11–16 days for GA-only: load the rule corpus (federal Fair Housing + GA Fair Housing + NAR Article 12/16 + GREC + FMLS + GAMLS + CAN-SPAM + TCPA + RESPA + TILA), seed the test corpus (≥50 cases), wire the platform-layer middleware (mandatory pre-send check, no opt-out by any other agent), audit log schema + 5-year retention, three-tier flag system (HARD-BLOCK / WARN-AND-ROUTE / PASS-WITH-NOTE) enforced. Unlocks: the architectural seam that lets the broker-of-record stop being the bottleneck on every draft, without the brokerage giving up its licensed responsibility.

**Honesty tag:** CHARTER-ONLY *(roster-overclaim — partial: slug wired, scanner module present, but rule corpus DRAFT and middleware not built; card `live` runs ahead of charter's V0 state)*

---

## 5. `realty-crm-hygiene`  (vertical IC · fires: on-prompt only · installed: yes — V0)

**What I can do today (verified):** Charter only. SKILL.md at `~/.claude/skills/realty-crm-hygiene/SKILL.md:6-8` self-tags `status: V0` and `default_mode: dry_run`, and at line 13: *"V0 is read-only. It drafts the queue. A human (or, later, an automated runner with explicit ratification) clears it."* No FUB or dotloop adapter is wired (charter lines 55-59 list both as "TBC"). No `daily-loop/realty-crm-hygiene/` dir. No fleet-activity-log entries. No `realty-crm-hygiene-recommendations.md`. Cron schedule named in SKILL.md (*"weekly Monday 06:00 ET"*) has no GHA workflow file at `C:\flatsbo\.github\workflows\`.

**What the site says I do:** `lib/verticals/real-estate/content.ts:57-64` ships *"CRM Hygiene — Dedupes, normalizes, and surfaces stale records in the CRM"* with `runtime: "rooting"`, `rootingNote: "rooting now — comes online once your CRM is connected."` Honest.

**The gap:** Card-state correct; charter is durable doctrine. Three open TBCs in SKILL.md (dotloop API tier, FUB custom-field naming, owner-routing farm-territory map) need first-design-partner discovery to close.

**What I could do with the necessary improvements:** Wire FUB + dotloop REST (charter lines 55-59), seed the seven hygiene-detector rules (duplicate / stale-lead / stage-mismatch / contact-drift / lost-revivable / owner-routing / tag-drift) with severity scoring, run the weekly Monday cron, render the prioritized queue at `~/agentplain/queues/crm_hygiene_<YYYY-MM-DD>.md` (50-row cap), keep `auto_apply` off until Conner ratifies + audit-log table lands.

**Honesty tag:** CHARTER-ONLY

---

## 6. `realty-production-reporter`  (vertical IC · fires: on-prompt only · installed: yes — V0)

**What I can do today (verified):** Charter only. SKILL.md `status: V0`, `default_mode: dry_run` (lines 6-8). Charter at line 13 names the destination: *"4–8 hours every month, and it's where attribution disputes start. This SKILL drafts all three versions automatically and leaves a paper trail of how each number was computed."* — three audience variants (owner / agent / recruit) with strict redaction guarantees. None of the source dependencies are wired: FMLS RESO Web API, GAMLS, FUB, dotloop, QuickBooks Online / Xero / Brokermint (lines 60-63 all "TBC"). No fleet-activity-log entries. No `daily-loop/realty-production-reporter/` dir. No `realty-production-reporter-recommendations.md`. Charter names monthly + quarterly crons (lines 31-32) — no GHA workflow file exists.

**What the site says I do:** `lib/verticals/real-estate/content.ts:65-72` ships *"Production Reporter — Drafts the production read against MLS and the workspace median"* with `runtime: "rooting"`, `rootingNote: "rooting now — comes online once your MLS feed is connected."` Honest.

**The gap:** Card-state correct; charter is durable doctrine. Per `b2b-head-of-realty` SKILL.md:34, the production-reporter is one of three V1 ICs *deferred* on 2026-05-03 in favor of building the four head-of-pilot agents (listing-coordinator, buyer-inquiry-router, showing-scheduler, compliance-sentinel) deeply rather than seven mediocrely.

**What I could do with the necessary improvements:** Wire the RESO Web API client for FMLS + GAMLS, the FUB + dotloop linkage for lead-source attribution, the QBO/Xero reconciliation, the three-way tie-out (MLS price × split → expected GCI → dotloop disbursement → accounting deposit). Render the three audience variants with zero-leakage guarantee (no individual GCI in agent view, no individual agent comp in recruit view). Charter's success metric: reconciliation flags trend down quarter-over-quarter (feedback loop into CRM Hygiene).

**Honesty tag:** CHARTER-ONLY

---

## 7. `realty-recruiter-assistant`  (vertical IC · fires: on-prompt only · installed: yes — V0)

**What I can do today (verified):** Charter only. SKILL.md `status: V0`, `default_mode: dry_run` (lines 6-8). Critical V0 constraint at lines 27: *"`auto_send` (V2+, DO NOT ENABLE) — would actually send. Off-limits in V0 — agent recruiting messages are too high-stakes to automate without explicit per-message ratification."* Dependencies depend on Production Reporter: SKILL.md:21 *"Consumes the recruit-facing version"* of the production report — and the production reporter is itself rooting. No fleet-activity-log entries. No `daily-loop/realty-recruiter-assistant/`. No `realty-recruiter-assistant-recommendations.md`. Charter names weekly Tuesday cron (line 31) — no GHA workflow file.

**What the site says I do:** `lib/verticals/real-estate/content.ts:73-80` ships *"Recruiter Assistant — Drafts recruiting outreach with one substantiated production reference"* with `runtime: "rooting"`, `rootingNote: "rooting now — comes online alongside the Production Reporter's data."` Honest *and* correctly tied to its upstream dependency.

**The gap:** Card-state correct; charter is durable doctrine. Open TBCs (SKILL.md:92-97): LinkedIn integration is restricted-API; offer-package economics need each design partner's split/cap/fee structure as JSON; no-poach (existing-exclusive-agreement) compliance angle needs Sentinel rule corpus.

**What I could do with the necessary improvements:** After Production Reporter ships (its `ledger.json` is my substantiation source), wire MLS top-producer query, referral-graph from FUB-tagged `internal-referral-source`, brokerage-voice draft generator with rule that *every production claim* maps to a ledger row, side-by-side offer-package render with prospect's last-12-mo production from MLS. Charter success metrics: sourced→touched ≥80%, touched→meeting-set ≥15%, zero compliance flags on sent outreach in first 90 days.

**Honesty tag:** CHARTER-ONLY

---

## 8. `b2b-head-of-realty`  (vertical head, tier 1.5 · fires: GHA cron daily 09:00 ET + on-prompt · installed: yes)

**What I can do today (verified):** I fire. Real evidence on disk: **22 entries under my slug** in `~/.claude/projects/C--flatsbo/memory/agent-state/fleet_activity_log.md` between 2026-04-29 (org-structure install) and 2026-05-12 (eleventh deep-dive firing — Replay note). Real planning artifacts:

- I shipped the four deep V0 SKILL.md files for the realty ICs (#1, #2, #3, #4 in this audit) on 2026-05-03 — see fleet-log entry naming `realty_v1_punch_list_progress_2026-05-03.md`.
- I authored `~/.claude/projects/C--flatsbo/memory/realty_vertical_spec_v1_2026-05-03.md` (the per-vertical reference spec with ICP reconciled to 5–25 agents, 7-agent fleet specced).
- My recommendations file at `agent-state/b2b-head-of-realty-recommendations.md` (136 lines) carries five tracked PENDING proposals (pilot-readiness gauge default response shape, compliance pre-launch decision matrix, persistent state mirror, Constraint section, operational NSM "Pilot Velocity" — fleet-log entry 2026-05-10 details all five).
- GHA cron workflow at `C:\flatsbo\.github\workflows\cron-b2b-head-of-realty-daily.yml` fires daily 09:00 ET (cron expr `0 13 * * *` UTC during DST).

**Caveat: zero customer-facing output.** My `daily-loop/b2b-head-of-realty/` dir exists but is empty (0 files). Everything I produce is internal planning — recommendations files, audit docs, ratification notes, ICP refinements, vertical-spec docs. Not one byte of my output reaches a brokerage customer.

**What the site says I do:** The b2b-head-of-realty SKILL.md does NOT correspond to a customer-facing card in any `agentRoster`. I'm an internal owner. My charter is reflected in the `/real-estate` vertical page existing at all — its `agentRoster` (the 7 realty ICs + chief-of-staff) is the surface I'm supposed to drive toward `live`. Content surface I steer: `lib/verticals/real-estate/content.ts` end-to-end (hero, jtbdTables, agentRoster, integration shortlist).

**The gap:** I produce thoughtful planning for a vertical with zero paying customers and zero design partners signed. My twelve stale-state callouts from 2026-05-10 (see fleet-log entry) name the unbridged distance: 10 phase-1 open questions still blocking pilot Day 2; KMS + webhook-renewal pilot decisions due "THIS WEEK"; 16 of 21 desktop crons still on desktop runner; brand-clarification needed; lazy-create gaps across recommendations + skills-updates files.

**What I could do with the necessary improvements:** The first paying brokerage. Until then, my output ceiling is "audit my own dormancy in increasingly sophisticated rubrics." The unblock is in `b2b-ceo`'s court (outreach greenlight) and `b2b-eng-tech-lead`'s court (KMS + webhook-renewal decisions). When a pilot lands, my output becomes pilot-state snapshots (Day-7 / Day-14 / Day-30), V1 sub-vertical refinements (rural vs. metro brokerage motion deltas), and the cross-vertical pattern intake that propagates the realty pilot playbook to the other 9 verticals.

**Honesty tag:** VERIFIED-LIVE *(as a planner; produces real on-disk planning artifacts and recommendations, but zero customer-facing output)*

---

## 9. `b2b-head-of-insurance`  (vertical head, tier 1.5 · fires: GHA cron daily · installed: yes — LATENT)

**What I can do today (verified):** I fire. I'm latent. Fleet-log entry 2026-05-10 (linked under b2b-head-of-realty's deep-dive) explicitly documents my last firing — *"position 13 — LATENT, light pass per queue Notes... ⏸ NO-MATERIAL-CHANGE. ZERO new primers, ZERO catalog adds, ZERO principle-log observation entries."* Reactivation criteria not met: no Vertafore acquisition, no EZLynx agentic-feature shipment, no small-brokerage-friendly carrier ecosystem materializing, no `b2b-ceo` reactivation greenlight in `decisions_log.md`. SKILL.md at `~/.claude/skills/b2b-head-of-insurance/SKILL.md:40-46` defines latent-mode hard limits: *"Do nothing else. No product specs. No ICP refinements. No sales narratives. No outreach."* I obey.

**What the site says I do:** `/insurance` ships an 8-card `agentRoster` (`lib/verticals/insurance/content.ts:26-92`): Inbound Triage (`runtime: live`), COI Generator (`live`), Renewal Coordinator (`rooting`), Claims Status (`rooting`), Endorsement Coordinator (`rooting`), Billing Reconciler (`rooting`), Carrier Intel (`rooting`), Chief of Staff (`live`). The `live` cards are runtime-skill bindings audited in Part 1 — not anything I drive.

**The gap:** The vertical page exists. The roster is rendered. I am latent. The implicit claim "agentplain has an insurance vertical that's being actively driven" is overstated: it's being passively monitored, with explicit do-nothing-without-greenlight discipline. The 15-prospect prospect-research methodology (`insurance_brokerage_prospect_research_2026-04-27.md`) is preserved as reference and is real, but pre-pivot.

**What I could do with the necessary improvements:** A reactivation case (one-page) lands with `b2b-client-service-director` + `b2b-ceo` when carrier-consolidation reverses OR an AMS-vendor partnership opens (e.g., EZLynx ships an agentic surface that changes the competitive landscape) OR realty Product 2 reaches paying-pilot stage AND founder bandwidth allows a second vertical. On reactivation greenlight: the pre-pivot V1 shortlist (Quote Bot / Renewal Sentinel / Intake Sweep / COI Agent) and AMS adapter shortlist (EZLynx / HawkSoft / NowCerts) are pre-drafted in SKILL.md:74-86. The 15-prospect research methodology is template for an updated cold-research sweep.

**Honesty tag:** VERIFIED-LIVE *(latent watch mode; output = `⏸ NO-MATERIAL-CHANGE` is the correct output)*

---

## 10. `b2b-head-of-home-services`  (vertical head, tier 1.5 · fires: GHA cron daily · installed: yes — LATENT)

**What I can do today (verified):** I fire. I'm latent. Same 2026-05-10 deep-dive entry confirms: *"⏸ NO-MATERIAL-CHANGE. ServiceTitan/Avoca AI/Housecall Pro/Jobber/JobNimbus/AccuLynx/Arch/ServiceAgent watchlist clean. Activation gate (realty Product 2 design-partner stage) NOT YET TRIGGERED."* One internal-consistency stale-state callout filed in `b2b_heads_skills_updates.md` (line 17 of my SKILL.md still names peers in pre-2026-04-29 order — `b2b-head-of-insurance (active), b2b-head-of-realty (latent)` is the pre-pivot framing; lines 13 + 42 already operate on the corrected post-pivot framing). SKILL.md `~/.claude/skills/b2b-head-of-home-services/SKILL.md:38-39` activation gate: *"Real estate Product 2 reaching design-partner stage (≥1 paying pilot or LOI signed) AND `b2b-ceo` explicit greenlight."*

**What the site says I do:** `/home-services` ships a 9-card `agentRoster` (`lib/verticals/home-services/content.ts:37-115`): Lead Router (`live`), Estimate (`rooting`), Estimate Followup (`live`), Supplement (`rooting`), Dispatch (`rooting`), ETA Updater (`rooting`), Project Coordinator (`rooting`), Reviews (`rooting`), Chief of Staff (`live`). Live cards = Part 1 runtime-skill bindings.

**The gap:** Vertical page renders an active product. I am latent until realty hits paying-pilot — which hasn't happened. Working V1 sub-vertical (roofing — per `b2b_vertical_opportunity_analysis_2026-04-27.md`, highest deal size + insurance-supplement workflow + lower competitive density) is pre-drafted in SKILL.md:71-76 but not ratified.

**What I could do with the necessary improvements:** On `b2b-ceo` greenlight: re-test roofing-as-V1 (does competitive density still favor it?), define ICP precisely (10-crew shops, owner-operator, insurance-supplement-heavy revenue mix), define V1 trades-specific agents (Storm-Lead Bot / Claims Packet Agent / Job-Sequencing Agent / Customer-Followup Agent), trades-specific brand voice (jobsite-aware, work-focused — not the agency-owner voice we tune for realty/insurance), coordinate door-knock + ride-along GTM with `flatsbo-b2b-sales-director` (different motion from owner-broker outreach).

**Honesty tag:** VERIFIED-LIVE *(latent watch mode; one minor internal-consistency stale-state callout pending Conner ratification)*

---

## 11. `agentplain-knowledge-architect`  (Class C org shared service · fires: GHA cron daily 06:30 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing as a Claude Code agent — my SKILL.md is staged at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\agentplain-knowledge-architect\SKILL.md`, not at `~/.claude/skills/agentplain-knowledge-architect/`. GHA workflow at `C:\flatsbo\.github\workflows\cron-agentplain-knowledge-architect-daily.yml` exists, gated by `USE_GHA_CRON == 'true'`; the inngest cron-skill prompt at `C:\flatsbo\scripts\cron-skills\agentplain-knowledge-architect-daily.md` is the inngest-runtime prompt the GHA handler invokes — it explicitly states *"you do NOT have direct file-system access — work only from the `<memory>` blocks above this prompt"* (i.e., cron-runtime, not Claude Code session). No fleet-activity-log entries under my slug. No `agentplain-knowledge-architect-recommendations.md`. No `daily-loop/agentplain-knowledge-architect/` dir. The substrate I'd own — pgvector tables — IS shipped (`prisma/schema.prisma` declares `KnowledgeDocument` + `Embedding` tables; `lib/knowledge/` contains `pgvector-store.ts`, `openai-embedding.ts`, `seed-data.ts`, `types.ts`); the *governance agent* over that substrate is what's not installed.

**What the site says I do:** Nothing — no `/knowledge` page, no agentRoster card. I'm a cross-cutting internal service. My implicit promise lives in the verified-claims table at `docs/brand-and-claims.md:209` — *"Per-customer file ingestion + retrieval — HALF — Google OAuth client ID/secret + `ENCRYPTION_KEY` (Drive ingestion)"* — and my charter would govern freshness, retrieval relevance, schema evolution, MCP-server health, compliance-corpus governance.

**The gap:** Substrate code exists; substrate governor does not. Whatever drift the substrate accumulates (stale corpus, retrieval-relevance regression, embedding-cost overrun) has no on-call owner. The 5-context-kind model (skill / customer / vertical / cross-customer / compliance) declared in SKILL.md:11-17 is doctrine, not enforced state.

**What I could do with the necessary improvements:** Install at `~/.claude/skills/agentplain-knowledge-architect/SKILL.md`; enable `USE_GHA_CRON`. Cycle: read substrate freshness metrics (last successful re-sync per kind), sample 24h of agent queries for relevance scores, scan `decisions_log.md` for new context-kind ratifications, scan `fleet_activity_log.md` for retrieval-quality complaints, identify the one most impactful improvement (re-embed a stale corpus / propose a new context kind / fix a relevance regression / propose chunking refinement), execute or escalate to `b2b-ceo` for budget. Compounds with `feedback_no_silent_vendor_lock.md` (every embedding API stays behind `lib/knowledge/`) and `feedback_runner_portability.md` (two-implementation rule on embeddings).

**Honesty tag:** STAGED-NOT-INSTALLED

---

## 12. `b2b-head-of-cpa`  (vertical head, tier 1.5 Plus · fires: GHA cron daily 09:51 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md lives at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\b2b-head-of-cpa\SKILL.md`, not in `~/.claude/skills/`. GHA workflow + cron-skill prompt both exist (`cron-b2b-head-of-cpa-daily.yml` + `scripts/cron-skills/b2b-head-of-cpa-daily.md`); workflow gated by `USE_GHA_CRON`. Zero fleet-activity-log entries under my slug. No `b2b-head-of-cpa-recommendations.md`. No `daily-loop/b2b-head-of-cpa/`. No outputs in `C:\flatsbo\outputs\`. Charter at SKILL.md:12 self-tags *"ACTIVE (newly adopted 2026-05-12)"* — adoption is paper.

**What the site says I do:** `/cpa` (`lib/verticals/cpa/content.ts:27, 36`) ships an 8-card `agentRoster`: Engagement Onboarding (`rooting`), Document Chase (`rooting`), Compliance Sentinel (`rooting`), Books Reconciler (`rooting`), Collections (`rooting`), Milestone Billing (`rooting`), Client Inbound (`live`), Chief of Staff (`live`). Live cards = Part 1 runtime-skill bindings. The page exists; the integration list (TaxDome, Karbon, Canopy, Lacerte, UltraTax, Drake, ProSeries, CCH ProSystem fx Engagement, CaseWare, QuickBooks Online, Xero, SmartVault / Box) is rendered as positioning. The page presents a CPA vertical actively under construction.

**The gap:** SKILL.md is paper. The Plus-tier pricing claim (per-seat $150–500/hr CPA-rate substitution math, lines 9-10 of charter) is undefended by any pilot data, recommendations file, or daily-loop entry. The V1 agent shortlist (Client Intake / Doc Chaser / Tax-Season Stand-up / Advisory Sentinel / Compliance Sentinel) is undrafted. The PM-adapter sequencing decision (Karbon vs. Canopy first) is unmade. The Circular 230 + AICPA Code + state-board CPE + SOX § 404 compliance corpus is uncurated.

**What I could do with the necessary improvements:** Install at `~/.claude/skills/`; enable `USE_GHA_CRON`. First daily fire: read `MEMORY.md` + `b2b_agent_product_strategy.md` + `b2b_vertical_opportunity_analysis_2026-04-27.md` + `project_vertical_tier_mapping.md` (Plus tier confirmation), ratify the V1 shortlist with Plus-tier per-seat ROI math attached, propose first PM adapter (Karbon vs. Canopy rationale), file ICP refinement (advisory-mix minimum), surface a Circular 230 amendment if one landed. Cross-vertical leverage: title/escrow (M&A/business-sale work), law (tax-controversy referrals), RIA (joint-client financial-planning).

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim — the `/cpa` roster surface suggests an active vertical owner; there isn't one)*

---

## 13. `b2b-head-of-law`  (vertical head, tier 1.5 Max · fires: GHA cron daily 09:40 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. Same shape as #12 — SKILL.md staged at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\b2b-head-of-law\SKILL.md`, not installed. Workflow + cron-prompt exist, gated. Zero on-disk evidence (no fleet log entries, no recommendations, no daily-loop, no outputs). Max-tier framing (charter line 9: highest billable-hour substitution leverage, lawyers $250–800/hr) plus *highest compliance gravity* (line 10: privilege + confidentiality + conflicts) is unmet by any artifact.

**What the site says I do:** `/law` (`lib/verticals/law/content.ts:30, 44`) ships an 8-card `agentRoster`: Intake & Onboarding (`live`), Drafting (`rooting`), Document Chase (`rooting`), Compliance Sentinel (`rooting`), Discovery Review (`rooting`), Status Updater (`rooting`), Milestone Billing (`rooting`), Chief of Staff (`live`). Live cards = Part 1 runtime-skill bindings. Integration list (Clio Manage, MyCase, Smokeball, PracticePanther, NetDocuments, iManage Work, Westlaw + Lexis, court e-filing portals, Outlook + M365 Graph) is rendered.

**The gap:** Same structural overclaim as #12, with the higher stakes of legal practice. The Max-tier pricing claim is undefended. ABA Formal Opinion 512 (2024 AI in legal practice) ingestion is undone. UPL framing (the boundary that says agentplain operates "paralegal-equivalent" with attorney-final-review per Model Rule 5.3, lines 24-26 of charter) is unanchored to a Compliance Sentinel rule corpus. Charter line 50 calls this *"the highest-stakes compliance corpus in the fleet"* — and it's not built. Peer dependency on `flatsbo-attorney-firstpass` (first-pass legal review on fleet build-time outputs) is named but unwired into any review path for the law-vertical SKILL changes.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist with attorney-final-review framing baked into every Drafting Assist + Compliance Sentinel agent design, propose first PM adapter (Clio vs. MyCase rationale), surface the latest state-bar AI ethics opinions (NY DR-2, CA Rules, etc.), file ICP refinement (rule-out pure-criminal-defense, BigLaw, pure-PI). Routes any privilege/UPL-touching proposal through `flatsbo-attorney-firstpass` before filing to `b2b-ceo` per charter line 84.

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim — and the Max-tier compliance-gravity framing puts a heavier weight on the unbuilt corpus than the other staged heads)*

---

## 14. `b2b-head-of-mortgage`  (vertical head, tier 1.5 Regular · fires: GHA cron daily 09:05 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md staged at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\b2b-head-of-mortgage\SKILL.md`. Workflow + cron-prompt exist, gated. Zero fleet log entries, no recommendations, no daily-loop, no outputs. Charter line 12 *"ACTIVE (newly adopted 2026-05-12)"*; the *active* claim is paper.

**What the site says I do:** `/mortgage` (`lib/verticals/mortgage/content.ts:18, 30`) ships an 8-card `agentRoster`: Borrower Triage (`live`), Document Chase (`live`), Status Updater (`rooting`), Pre-Qual Assistant (`rooting`), Conditions Coordinator (`rooting`), Vendor Coordination (`rooting`), Production Reporter (`rooting`), Chief of Staff (`live`). Live cards = Part 1 runtime-skill bindings. Integration list (Encompass, Calyx Point, LendingPad, Optimal Blue, DU / LP, wholesale lender portals, Outlook + M365 Graph, Total Expert) renders.

**The gap:** Same structural overclaim. The RESPA + TRID + ECOA/HMDA + state DRE/DBO + Reg Z compliance corpus is uncurated. The LOS adapter sequencing (Encompass vs. BytePro per the two-implementation rule, line 43 of charter) is unmade. Sub-vertical sequence (residential purchase first, HELOC/refi adjacent, commercial mortgage later — line 33) is undrafted.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist (Lead Triage / Doc Chaser / Compliance Sentinel / Pipeline Stand-up / Renewal/Refinance Sentinel), propose first LOS adapter (Encompass vs. BytePro rationale), surface any RESPA/TRID rule change affecting Compliance Sentinel spec, file ICP refinement (1–25 LOs, wholesale or correspondent, multi-investor). Cross-vertical leverage: realty (same brokerage often refers to the same mortgage broker) — surface co-customer overlap to `b2b-client-service-director`.

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim)*

---

## 15. `b2b-head-of-property-mgmt`  (vertical head, tier 1.5 Regular · fires: GHA cron daily 09:15 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md staged. Same evidence shape as the others: workflow + cron-prompt exist, gated, no on-disk output anywhere. Charter line 12 *"ACTIVE (newly adopted 2026-05-12)"* — paper.

**What the site says I do:** `/property-management` (`lib/verticals/property-management/content.ts:17, 24`) ships an 8-card `agentRoster`: Tenant Inbound (`live`), Work-Order Router (`rooting`), Renewal Coordinator (`rooting`), Collections (`live`), Owner Reporter (`rooting`), Application Screening (`rooting`), Books Reconciler (`rooting`), Chief of Staff (`live`). Integration list (Buildium, AppFolio, Propertyware, Yardi Breeze, QuickBooks Online, Outlook + M365 Graph, Twilio Voice inbound-triage receiver) renders.

**The gap:** Same structural overclaim. State landlord-tenant law + fair-housing + security-deposit handling + notice-of-entry corpus is uncurated. PMS adapter sequencing (AppFolio vs. Buildium per two-implementation rule, line 38 of charter) is unmade. The V1 monthly-recurring rhythm (which differentiates PM from realty's deal-cycle) is named but undesigned.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist (Tenant Onboarding / Maintenance Triage / Rent Collection Sentinel / Renewal Coordinator / Compliance Sentinel), propose first PMS adapter (AppFolio vs. Buildium rationale), surface state landlord-tenant rule changes (eviction notice timing, deposit holding period, return timeline), file ICP refinement (50-unit minimum vs. lower).

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim)*

---

## 16. `b2b-head-of-recruiting`  (vertical head, tier 1.5 Regular · fires: GHA cron daily 09:25 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md staged. Same evidence pattern. Charter line 12 *"ACTIVE (newly adopted 2026-05-12)"* — paper.

**What the site says I do:** `/recruiting` (`lib/verticals/recruiting/content.ts:18, 28`) ships a 9-card `agentRoster`: Sourcing (`rooting`), Outreach (`live`), Cadence (`rooting`), Candidate Status (`live`), Intake Brief (`rooting`), Pipeline Recap (`rooting`), Scheduler (`live`), ATS Hygiene (`rooting`), Chief of Staff (`live`). Integration list (Bullhorn, Greenhouse, Lever, JobAdder, Recruiterflow, Workable, LinkedIn Recruiter read-only, Apollo, Outlook + M365 Graph) renders.

**The gap:** Same structural overclaim, with a vertical-specific elevated stake: per charter line 48 *"The AI-bias-in-hiring sub-corpus is high-priority — recruiting is the vertical where agentplain's AI assistance has the most regulatory scrutiny."* NYC Local Law 144 (automated employment decision tools audit requirement), Illinois AI Video Interview Act, EU AI Act high-risk classification for hiring algorithms — none of this corpus is ingested. ATS adapter sequencing (Bullhorn vs. Crelate per two-implementation rule, line 39 of charter) is unmade.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist (Candidate Sourcer / Reachout Drafter / Pipeline Stand-up / Submittal Coordinator / Compliance Sentinel), propose first ATS adapter (Bullhorn vs. Crelate rationale), surface the AI-bias-in-hiring corpus (LL144 audit requirements, EU AI Act high-risk system guidance), file ICP refinement (niche specialization filter — tech, finance, healthcare, manufacturing, legal, biotech — not generalist).

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim — and the AI-bias-in-hiring regulatory exposure puts an extra weight on the uncurated corpus)*

---

## 17. `b2b-head-of-ria`  (vertical head, tier 1.5 Max · fires: GHA cron daily 09:45 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md staged. Same evidence pattern. Charter line 12 *"ACTIVE (newly adopted 2026-05-12)"* — paper.

**What the site says I do:** `/ria` (`lib/verticals/ria/content.ts:29, 43`) ships an 8-card `agentRoster`: Meeting Prep (`rooting`), Meeting Notes (`rooting`), Compliance Sentinel (`rooting`), Planning Refresh (`rooting`), Rebalance (`rooting`), Performance Reporter (`live`), AUM Billing (`rooting`), Chief of Staff (`live`). Integration list (Wealthbox, Redtail, Salesforce FSC, eMoney Advisor, RightCapital, MoneyGuidePro, Orion, Black Diamond, Envestnet Tamarac, Schwab / Fidelity / Pershing custodian read-only, Outlook + M365 Graph) renders.

**The gap:** Same structural overclaim. Max-tier compliance-gravity framing (charter line 10: SEC + state-securities-administrator exam risk, Form ADV inaccuracy is a top SEC enforcement target). SEC Advisers Act + Form ADV-2A/2B + Form CRS + Marketing Rule (SEC 206(4)-1 December 2022 effective) + Custody Rule + Books and Records Rule + Code of Ethics Rule + Reg BI + DOL Fiduciary Rule corpus — uncurated. PM adapter sequencing (Orion vs. Tamarac), CRM (Redtail vs. Wealthbox), planning (RightCapital vs. MoneyGuide), custodian (Schwab vs. Fidelity read-only) — all per two-implementation rule (line 56 of charter), all unmade. Cross-vertical leverage with CPA + law (small-business-advisor cluster — joint clients on estate planning, tax-advantaged accounts, business-succession) is named but unbuilt.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist with Form-ADV-accuracy framing baked into every disclosure-touching agent, propose first PM adapter (Orion vs. Tamarac), surface SEC Marketing Rule guidance affecting the Quarterly Review Prep agent, file ICP refinement (AUM band tuning: $25M–500M sweet spot — below: too small for Max-tier; above: enterprise stack already), draft positioning emphasizing Max-tier value + SEC-exam-defense-by-default.

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim — and the Max-tier regulatory gravity matches `/law` for unbuilt-but-load-bearing corpus weight)*

---

## 18. `b2b-head-of-title-escrow`  (vertical head, tier 1.5 Regular · fires: GHA cron daily 09:20 ET, gate `USE_GHA_CRON` · installed: **no**)

**What I can do today (verified):** Nothing. SKILL.md staged. Same evidence pattern. Charter line 12 *"ACTIVE (newly adopted 2026-05-12)"* — paper.

**What the site says I do:** `/title-escrow` (`lib/verticals/title-escrow/content.ts:17, 29`) ships an 8-card `agentRoster`: File Intake (`rooting`), Document Chase (`live`), Title Search (`rooting`), Closing Prep (`rooting`), Recording Coordinator (`rooting`), Trust Reconciler (`rooting`), Compliance Sentinel (`rooting`), Chief of Staff (`live`). Note: `lib/skills/persist-artifacts.ts:365` does have `'title-escrow': 'title-compliance-sentinel'` in the sentinel-slug override map — the slug is wired into runtime attribution even though the card is `rooting`. Integration list (SoftPro, RamQuest, Qualia, ResWare, underwriter portals top 4, Outlook + M365 Graph, county recording portals) renders.

**The gap:** Same structural overclaim. The vertical's wire-fraud-prevention positioning (charter line 78: *"draft positioning emphasizing wire-fraud prevention + RESPA-clean automation"*) is undrafted. ALTA Best Practices 7-pillar framework + CFPB closing-disclosure 3-day rule + state title-insurance law + RESPA Section 8 anti-kickback (especially the referral-chain seam with realty/mortgage) — uncurated. Title-production adapter sequencing (SoftPro + Qualia per two-implementation rule, line 37 of charter) is unmade.

**What I could do with the necessary improvements:** Install + enable. First daily fire: ratify V1 shortlist (Order Triage / Doc Chaser / Title Exam Assist / Closing Coordinator / Post-Close Sentinel), propose first title-production adapter (SoftPro vs. Qualia rationale — legacy + modern slices), surface a CFPB closing-disclosure rule change if one landed, file ICP refinement (2–15 staff, single-state or 2–3 state operators, independent — not underwriter-owned captive). Cross-vertical leverage with realty + mortgage is the highest in the staged-head set (same brokerage refers to the same title shop; same lender refers to the same title shop).

**Honesty tag:** STAGED-NOT-INSTALLED *(vertical-page overclaim — but the sentinel-slug attribution at `lib/skills/persist-artifacts.ts:365` is the one mechanical hook already in place for when the head activates)*
