# Agent interviews — Master consolidation (00) — 2026-05-27

**Scope.** Single executive deliverable consolidating the three section docs that interview every named agent in the agentplain fleet against on-disk evidence. ~50 agents in total — 16 runtime catalog skills + 18 per-vertical agents + 16 org/eng/insights/shared.

**Source docs (per-agent profiles live here):**

- Part 1 — runtime catalog skills (16) — `docs/agent-interviews/01-runtime-skills.md`
- Part 2 — per-vertical agent layer (18) — `docs/agent-interviews/02-vertical-agents.md`
- Part 3 — b2b org leadership + eng + insights + shared (16) — `docs/agent-interviews/03-org-agents.md`
- Fleet roster reference — `docs/fleet-roster-2026-05-27.md`

**Framing.** Every claim below is anchored to a file:line cite or a verifiable on-disk artifact path (recommendations file, fleet-activity-log entry, daily-loop directory, GHA workflow). The honesty grading is graded against `docs/brand-and-claims.md` §10 (the claims-vs-reality discipline locked 2026-05-15) and against `feedback_no_guesses_no_estimates.md` (every claim cites the artifact).

---

## 1. Executive synthesis

**Headline truth.** Across all ~50 agents in the agentplain fleet, **exactly ONE** (`office-admin`) fires on a production caller against real customer mailbox data today. Every other named agent is built-but-not-wired, charter-only, staged-not-installed, or dormant. The fleet is largely a *catalog of capabilities and charters* — not a *running operating system* — and several site surfaces overstate that gap.

### Counts (50 agents in scope)

| Status | Count | What it means |
|---|---|---|
| **VERIFIED-LIVE on real customer data** | **1** | `office-admin` — fires on every workspace via `lib/inngest/functions/process-webhook-event.ts:130-153` cron `*/5 * * * *`; writes real `WorkApprovalQueueItem` rows; `defaultEnabled: true` per `registry.ts:173`. The only agent in the fleet meeting the `feedback_integration_acceptance_is_functional.md` bar today. |
| **VERIFIED-DEMO-ONLY** *(runtime catalog skills)* | **15** | The other 15 catalog skills in `lib/skills/<slug>/`: full implementations + tests + JSON-stub fetchers, but no production caller, and connector MCPs are `stubbed-json`. |
| **VERIFIED-LIVE as internal planner** *(no customer-facing output)* | **3** | `b2b-head-of-realty` (22 fleet-log entries between 2026-04-29 and 2026-05-12), `b2b-head-of-insurance` + `b2b-head-of-home-services` (latent watch mode — output is `⏸ NO-MATERIAL-CHANGE`, which is correct). |
| **FIRES-INTERNAL-ONLY then went dormant** | **3** | `b2b-client-service-director` (1 fleet-log entry 2026-05-02, 25 days stale), `insights-head-of-department` (1 entry 2026-05-02), `platform-eng` (10 entries 2026-05-01→2026-05-03, then dormant 24 days; load-bearing Anthropic prompt-caching wrapper still missing 27 days after SKILL named it as item #1). |
| **CHARTER-ONLY** *(7 realty ICs + 13 org/insights/eng silent)* | **20** | SKILL.md installed, zero own-author fleet-log entries. Includes the 7 realty ICs (V0 status, on-prompt only) + 13 org/insights/eng agents whose silence is documented verbatim in capability-builder-authored voice blocks (e.g., `b2b-eng-frontend`: *"I have never fired"*). |
| **STAGED-NOT-INSTALLED** *(SKILL.md not in `~/.claude/skills/`)* | **8** | The 8 staged b2b heads + the cross-cutting `agentplain-knowledge-architect`. GHA cron workflow exists, gated by repo var `USE_GHA_CRON == 'true'`; SKILL.md lives only at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md`. *(Note: this audit covers 8 of these in Part 2 — the knowledge-architect is counted there; the 7 staged vertical heads plus knowledge-architect = 8 total.)* |
| **DORMANT / LATENT** *(charter exists, activation gated)* | **2** | `b2b-head-of-insurance` (LATENT since 2026-04-29), `b2b-head-of-home-services` (gated on realty Product 2 design-partner stage). *(Already counted under VERIFIED-LIVE-as-planner above; called out separately here because their "live" is the correct ⏸ output, not real work.)* |
| **SITE-SILENT workflow skill** | **1** | `gtm-outreach` — FlatSBO-scoped context-load skill. No agentplain claim depends on it. Misplaced in this audit cohort. |

**Reconciliation:** 1 (live) + 15 (demo) + 3 (planner-live, internal-only) + 3 (dormant-after-burst) + 20 (charter-only) + 8 (staged) + 1 (workflow skill) = **51** (the 50-headline rounds because `gtm-outreach` is a workflow skill, not a tracked agent — see Part 3 §9).

**Customer-facing output across all 50:** **1 agent** (`office-admin`). Every other customer-visible artifact the site implies comes from a named agent is either (a) backed by the runner's generic chain attributing to a charter that doesn't run, (b) backed by demo plumbing the connectors aren't wired into, or (c) not produced at all.

### Systemic site overclaims (named)

Three patterns surface again and again across the three section docs:

**(a) In-product agent cards badged `runtime: "live"` riding a skill with no production caller.**
The agentRoster type-definition at `lib/verticals/types.ts:196-211` defines `live`-via-`boundSkill` semantically as *"declared capability whose runtime skill is not wired into the live loop yet [if boundSkill is set]; the agents page surfaces these as 'ready — capability tested' until handoff activity accrues."* That semantic is honest if a visitor reads the type comment. **No visitor does.** A logged-in customer who sees "Chief of Staff — runtime: live" on 11 verticals reasonably expects it to be running on their calendar today. It is not — `chief-of-staff-scheduler` has no production caller (Part 1 §`chief-of-staff-scheduler`). Same shape repeats on 7 other `live`-via-`boundSkill` cards (law-intake-onboarding, ria-performance-reporter, insurance-coi-generator, mortgage-document-chase, home-services-estimate-followup, recruiting-candidate-status-update, pm-collections, title-doc-chase). The marketing `/[vertical]` pages do NOT render the agentRoster (`app/(marketing)/[vertical]/page.tsx:48-83` consumes only JTBD + claims + integrations), so the overclaim is **in-product, surfaced on `/app/workspace/[id]/agents` to logged-in customers**, not on the public marketing surface.

**(b) 8 vertical pages shipping full agent rosters whose owner-charters don't run.**
`/cpa`, `/law`, `/mortgage`, `/property-management`, `/recruiting`, `/ria`, `/title-escrow` each ship an 8–9 card `agentRoster` AND each is owned by a STAGED-NOT-INSTALLED b2b vertical head (`b2b-head-of-cpa`, `-of-law`, `-of-mortgage`, `-of-property-mgmt`, `-of-recruiting`, `-of-ria`, `-of-title-escrow`). The vertical heads' SKILL.md drafts live at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md` — not in `~/.claude/skills/<slug>/`. Each has a GHA cron workflow gated by `USE_GHA_CRON == 'true'`. Each has zero own-author fleet-log entries, zero recommendations files, zero daily-loop output. The implicit claim *"agentplain has these verticals under active development by named owners"* is paper. The `/insurance` and `/home-services` heads ARE installed but LATENT (correct ⏸ output). Of the 10 vertical pages live on the site, **only `/real-estate` has an actually-firing installed head (`b2b-head-of-realty`)** — and even that head produces zero customer-facing output (Part 2 §8).

**(c) About-page dogfood claim mis-attributes the work to silent org agents.**
The About page at `app/(marketing)/about/page.tsx:118-125` says: *"agentplain itself is built BY the same fleet model we sell. The service team — the same shape we sell to customers — proposes capabilities, decomposes them into work, runs the tests, decides what's ready to ship, and surfaces the calls that need a human."* The CORE claim (*"agentplain itself is built by the same fleet model we sell"*) is **TRUE** — the entire B2B build cadence (PR-A → PR-B → PR-C, MEMORY.md governance, recommendations-inbox-driven SKILL evolution) runs through `flatsbo-capability-builder` per `feedback_agentplain_built_by_agents.md`. The fix is **not** to walk this claim back to "built by humans" — the dogfood IS real, just via a different mechanism than the named verbs imply. The named verbs ("proposes / decomposes / runs tests / decides what's ready to ship") map to silent org agents: **proposes** → capability-builder (TRUE — fires every 3 hours, 5 lazy-creates this month); **decomposes** → `b2b-eng-tech-lead` (silent — zero own-author entries, SKILL points at ghost `C:\b2b\` repo); **runs tests** → `b2b-eng-qa` (silent — never fired, no recommendations file); **decides ready to ship** → `b2b-ceo` (silent — zero own-author entries, empty daily-loop dir). The honest fix is to **credit the real mechanism** (capability-builder + Conner + the FlatSBO eng-pod specialists acting against `C:\agentplain\`), not to overstate a named active b2b-org agent layer that hasn't fired.

---

## 2. Combined master matrix (all ~50 agents)

| # | Agent | Tier / group | Fires? | Status | Site-claim accurate? | Honesty tag |
|---|---|---|---|---|---|---|
| 1 | `office-admin` | runtime · all | Inngest cron `*/5 * * * *` | **live (real data)** | yes (under-claimed) | **VERIFIED-LIVE** |
| 2 | `chief-of-staff-scheduler` | runtime · all | no caller | demo-only | overstates (11 verticals "live") | VERIFIED-DEMO-ONLY *(roster-overclaim ×11)* |
| 3 | `inbox-triage-general` | runtime · all | no caller | demo-only | overstates (`/general` "live") | VERIFIED-DEMO-ONLY |
| 4 | `follow-up-chaser-general` | runtime · all | no caller | demo-only | overstates (`/general` "live") | VERIFIED-DEMO-ONLY |
| 5 | `process-doc-drafter-general` | runtime · all | no caller | demo-only | overstates (`/general` "live") | VERIFIED-DEMO-ONLY |
| 6 | `invoice-chasing-realestate` | runtime · realty | no caller | demo-only | site silent (orphan) | VERIFIED-DEMO-ONLY *(under-claimed)* |
| 7 | `lead-triage-realestate` | runtime · realty | no caller | demo-only | site silent (orphan) | VERIFIED-DEMO-ONLY *(under-claimed)* |
| 8 | `month-end-close-cpa` | runtime · cpa | no caller | demo-only | yes (honestly `rooting`) | VERIFIED-DEMO-ONLY *(honest counter-example)* |
| 9 | `law-intake-conflict-screen` | runtime · law | no caller | demo-only | overstates (engagement-letter clause unbuilt) | VERIFIED-DEMO-ONLY |
| 10 | `ria-client-update-draft` | runtime · ria | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 11 | `insurance-coi-request` | runtime · insurance | no caller | demo-only | overstates ("one-click issue" + "live") | VERIFIED-DEMO-ONLY |
| 12 | `mortgage-document-chase` | runtime · mortgage | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 13 | `home-services-estimate-followup` | runtime · home-services | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 14 | `recruiting-candidate-status-update` | runtime · recruiting | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 15 | `property-management-rent-collection-chase` | runtime · pm | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 16 | `title-escrow-closing-doc-chase` | runtime · title-escrow | no caller | demo-only | overstates (`live`) | VERIFIED-DEMO-ONLY |
| 17 | `realty-listing-coordinator` | vertical IC · realty | on-prompt | charter-only | yes (`rooting`) | CHARTER-ONLY |
| 18 | `realty-buyer-inquiry-router` | vertical IC · realty | on-prompt | charter-only | overstates (`live` rides inbox-triage demo) | CHARTER-ONLY *(roster-overclaim)* |
| 19 | `realty-showing-scheduler` | vertical IC · realty | on-prompt | charter-only | overstates (`live` rides inbox-triage demo) | CHARTER-ONLY *(roster-overclaim)* |
| 20 | `realty-compliance-sentinel` | vertical IC · realty | on-prompt (slug wired) | charter-only (corpus DRAFT) | overstates (corpus + middleware unbuilt) | CHARTER-ONLY *(roster-overclaim, partial wiring)* |
| 21 | `realty-crm-hygiene` | vertical IC · realty | on-prompt | charter-only | yes (`rooting`) | CHARTER-ONLY |
| 22 | `realty-production-reporter` | vertical IC · realty | on-prompt | charter-only | yes (`rooting`) | CHARTER-ONLY |
| 23 | `realty-recruiter-assistant` | vertical IC · realty | on-prompt | charter-only | yes (`rooting`) | CHARTER-ONLY |
| 24 | `b2b-head-of-realty` | T1.5 · vertical head | GHA cron 09:00 ET + 22 entries | **planner-live** (zero customer-facing) | yes (internal planner) | VERIFIED-LIVE *(as planner)* |
| 25 | `b2b-head-of-insurance` | T1.5 · vertical head | GHA cron daily | latent (correct ⏸ output) | yes (latent) | VERIFIED-LIVE *(latent watch)* |
| 26 | `b2b-head-of-home-services` | T1.5 · vertical head | GHA cron daily | latent (correct ⏸ output) | yes (latent) | VERIFIED-LIVE *(latent watch)* |
| 27 | `agentplain-knowledge-architect` | T0 · shared | GHA cron 06:30 ET (gated) | **staged-not-installed** | n/a (no site claim) | STAGED-NOT-INSTALLED |
| 28 | `b2b-head-of-cpa` | T1.5 · vertical head | GHA cron 09:51 ET (gated) | **staged-not-installed** | overstates (`/cpa` 8-card roster, no firing owner) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 29 | `b2b-head-of-law` | T1.5 · vertical head | GHA cron 09:40 ET (gated) | **staged-not-installed** | overstates (`/law` 8-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 30 | `b2b-head-of-mortgage` | T1.5 · vertical head | GHA cron 09:05 ET (gated) | **staged-not-installed** | overstates (`/mortgage` 8-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 31 | `b2b-head-of-property-mgmt` | T1.5 · vertical head | GHA cron 09:15 ET (gated) | **staged-not-installed** | overstates (`/property-management` 8-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 32 | `b2b-head-of-recruiting` | T1.5 · vertical head | GHA cron 09:25 ET (gated) | **staged-not-installed** | overstates (`/recruiting` 9-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 33 | `b2b-head-of-ria` | T1.5 · vertical head | GHA cron 09:45 ET (gated) | **staged-not-installed** | overstates (`/ria` 8-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 34 | `b2b-head-of-title-escrow` | T1.5 · vertical head | GHA cron 09:20 ET (gated) | **staged-not-installed** | overstates (`/title-escrow` 8-card roster) | STAGED-NOT-INSTALLED *(vertical-page overclaim)* |
| 35 | `b2b-ceo` | T1 · org | GHA cron 06:00 ET (gated) | **charter-only** (zero own entries) | overstates (about-page "decides what's ready to ship") | CHARTER-ONLY *(dogfood overclaim)* |
| 36 | `b2b-client-service-director` | T1-D · org | GHA cron 11:00 ET (gated) | fired once 2026-05-02; dormant 25 days | overstates (4 service-partnership deliverables don't exist on disk) | FIRES-INTERNAL-ONLY *(one-shot stale)* |
| 37 | `b2b-eng-tech-lead` | T1-D · org | GHA cron (gated) | **charter-only** (zero own entries) | overstates (ghost-repo SKILL drift) | CHARTER-ONLY *(dogfood overclaim + ghost-repo)* |
| 38 | `b2b-eng-backend` | T2 · eng | on-prompt | **charter-only** (29 days dormant) | overstates (ghost-repo SKILL drift) | CHARTER-ONLY *(ghost-repo)* |
| 39 | `b2b-eng-frontend` | T2 · eng | on-prompt | **charter-only** (verbatim *"I have never fired"*) | overstates (brand mandate stale) | CHARTER-ONLY *(never fired)* |
| 40 | `b2b-eng-integrations` | T2 · eng (Opus, load-bearing) | on-prompt | **charter-only** (no recs file, no daily-loop) | overstates (MCP-first migration silent in SKILL) | CHARTER-ONLY *(never fired)* |
| 41 | `b2b-eng-qa` | T2 · eng | on-prompt | **charter-only** (most invisible — zero mentions) | overstates (live-fixture protocol unverified) | CHARTER-ONLY *(safety-critical never-fired)* |
| 42 | `platform-eng` | T2 · shared | GHA cron (gated) | fired 10× 2026-05-01→05-03; dormant 24 days | overstates (Anthropic prompt-caching wrapper missing 27 days) | FIRES-INTERNAL-ONLY *(load-bearing primitive missing)* |
| 43 | `gtm-outreach` | shared workflow | on-prompt | workflow context skill (not tracked) | n/a (FlatSBO-scoped) | SITE-SILENT |
| 44 | `insights-head-of-department` | dept head | on-prompt | fired once 2026-05-02; dormant 25 days | site silent | FIRES-INTERNAL-ONLY *(one-shot stale)* |
| 45 | `insights-adhoc` | T3 · insights (Opus) | on-prompt | **charter-only** (0 of 6 V0 files exist) | site silent | CHARTER-ONLY *(Phase 0 unstarted)* |
| 46 | `insights-advanced-analytics` | T3 · insights (Opus) | on-prompt | **charter-only** (0 of 8 V0 files exist) | site silent | CHARTER-ONLY *(Phase 0 unstarted)* |
| 47 | `insights-agent-measurement` | T3 · insights (Opus) | on-prompt | **charter-only** (0 of 7 V0 files; boundary doc unsigned) | site silent | CHARTER-ONLY *(EvolveR loop unmeasured)* |
| 48 | `insights-product-analytics` | T3 · insights | on-prompt | **charter-only** (0 of 9 V0 files exist) | site silent | CHARTER-ONLY *(Phase 0 unstarted)* |
| 49 | `insights-reporting` | T3 · insights | on-prompt | **charter-only** (0 of 7 V0 files exist) | site silent | CHARTER-ONLY *(Phase 0 unstarted)* |
| 50 | `insights-survey-research` | T3 · insights (Opus, "highest pre-revenue value") | on-prompt | **charter-only** (0 of 6 V0 files; head wrote v0 survey on its behalf) | site silent | CHARTER-ONLY *(highest-value sub-agent has produced nothing)* |

**Honesty-tag legend.**

- **VERIFIED-LIVE** — fires on a production caller, produces real customer-facing artifacts (`office-admin`) OR produces real on-disk planning artifacts in name (heads-of-vertical).
- **VERIFIED-DEMO-ONLY** — full implementation + tests + JSON-stub fetcher; no production caller, connector MCPs `stubbed-json`.
- **CHARTER-ONLY** — SKILL.md installed, zero own-author entries in `fleet_activity_log.md`. Recommendations file (if any) was authored by `flatsbo-capability-builder` on the agent's behalf during deep-dive rotation.
- **FIRES-INTERNAL-ONLY** — one or more own-author fleet-log entries exist; entire scope is internal planning; no customer-facing artifact ever produced.
- **STAGED-NOT-INSTALLED** — SKILL.md drafted at `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md`; not present in `~/.claude/skills/<slug>/`. GHA cron workflow exists, gated by repo var `USE_GHA_CRON`.
- **SITE-SILENT** — no site claim depends on this agent.

---

## 3. Prioritized build roadmap — closing the biggest gaps, in leverage order

Three tiers, ordered by speed-to-truth × value-unlocked.

### Tier (i) — Make the site TRUE (small edits, fastest path to honest)

The lowest-cost wedge: change what the site says to match what the fleet actually does today. Cross-references PR #102 (`fix(marketing): honest INTEGRATES claims`) which already closed the integration-vendor-naming subset of this work — same pattern, extended.

| # | Action | What it unlocks | Files |
|---|---|---|---|
| 1 | **Re-grade the 11 `runtime: "live"` agentRoster cards backed by `chief-of-staff-scheduler`.** Change to `runtime: "rooting"` with explicit `rootingNote: "rooting now — comes online once your calendar is connected and the daily cron is wired."` Same fix for the 7 other vertical-specific `live`-via-`boundSkill` cards (law-intake-onboarding, ria-performance-reporter, insurance-coi-generator, mortgage-document-chase, home-services-estimate-followup, recruiting-candidate-status-update, pm-collections, title-doc-chase). | Removes the single most-replicated in-product overclaim. Logged-in customers see the correct firing status. | `lib/verticals/<slug>/content.ts` (11 files) — agentRoster `runtime` field |
| 2 | **Add a `rootingNote` line to every staged-vertical-page roster card whose owner-head is STAGED-NOT-INSTALLED** (`/cpa`, `/law`, `/mortgage`, `/property-management`, `/recruiting`, `/ria`, `/title-escrow`). Each card already reads `rooting`; what's missing is the dependency-acknowledged note. CPA is the template — its `cpa-doc-chase` rootingNote *"rooting now — comes online once your tax-software client portal is connected"* is exactly right. | Honors `feedback_no_guesses_no_estimates.md` (cites the actual blocker, not a fake date). The vertical pages stop reading as actively-driven. | `lib/verticals/<slug>/content.ts` × 7 |
| 3 | **Fix the about-page dogfood claim to credit the REAL mechanism.** Keep the core claim *"agentplain itself is built BY the same fleet model we sell"* — that's TRUE via capability-builder. Strike the 4 verbs (`proposes / decomposes / runs tests / decides what's ready to ship`) that name silent org agents. Replace with the verifiable mechanism: capability-builder's deep-dive rotation, recommendations-inbox-driven SKILL evolution, MEMORY.md ratification gates, the FlatSBO eng-pod specialists who actually ship code against `C:\agentplain\`. | The dogfood claim becomes defendable. No walk-back of the core; only the named-verb attributions get corrected. | `app/(marketing)/about/page.tsx:99-125` |
| 4 | **Re-check the "~35 cron-fired agents" brag (`app/(marketing)/about/page.tsx:99-106`).** That count refers to FlatSBO consumer fleet, not agentplain B2B — readers who infer the active-cron headcount belongs to agentplain are misled. Either (a) split into "agentplain B2B: X cron-fired agents today" + "FlatSBO consumer: ~35", or (b) move the number to a FlatSBO-specific page. The verifiable agentplain B2B active-cron count today is **1** (`office-admin`); 8 b2b-head crons exist but are gated by `USE_GHA_CRON`. | Stops the implicit transfer of FlatSBO's operational maturity onto agentplain. | `app/(marketing)/about/page.tsx:99-106` |
| 5 | **Annotate the `realty-compliance-sentinel` runtime upgrade** at `lib/verticals/real-estate/content.ts:50-56` (card `runtime: "live"`). Today: card is live, the scanner module is present, but the rule corpus is DRAFT and the platform-layer middleware isn't wired. Either downgrade to `rooting` with the corpus-state note, OR add the `live` semantic disclosure (capability tested) inline so the card is self-explanatory. Cross-reference `docs/realty-fleet-binding-2026-05-22.md:50`. | Closes the runtime-card-vs-corpus-state gap that the 2026-05-22 binding doc flagged as P0. | `lib/verticals/real-estate/content.ts:50-56` |
| 6 | **Fix the `insurance-coi-generator` card overclaim** at `lib/verticals/insurance/content.ts:35-44`. Job text says *"drafts the certificate for one-click issue"*; code drafts the structured issuance PAYLOAD for the CSR to open in the AMS/carrier portal — the carrier system generates the certificate. Re-word to *"drafts the structured issuance payload + acknowledgement back to the requester"*. Same review pass on the `valueLoopExample` rerate scenario (present-tense fictionalization of a `rooting` capability). | Removes a small but precise capability-vs-reality mis-state. | `lib/verticals/insurance/content.ts:35-44` + valueLoopExample |
| 7 | **De-stale `gtm-outreach` SKILL line 67** (*"current AI is just listing copy via Anthropic; not a full agent"*). FlatSBO now runs the 5-phase value loop through the runtime catalog skills. Replace with the actual current capability surface. | Stops a context-load skill from actively mis-directing future outreach drafters. | `~/.claude/skills/gtm-outreach/SKILL.md:67` |

**Tier (i) total: ~7 doc-only edits, no code surface area beyond `content.ts` + one marketing page.** All are reversible. None requires a single new connector, new caller, or new cron.

### Tier (ii) — Make the value loop REAL per vertical (wire the 15 demo-only catalog skills to production)

Each of the 15 demo-only catalog skills follows the same pattern: full implementation + JSON-stub fetcher + passing tests; missing only (a) a production caller (cron or API route or webhook listener) AND (b) a real connector adapter where its provider MCP is `stubbed-json`. This tier depends on **the connect-in-a-click prod credentials from the self-serve readiness work** — without real OAuth tokens + real connector creds, the connector adapter halves can't ship.

| # | Action | What it unlocks | Dependency |
|---|---|---|---|
| 8 | **Wire `chief-of-staff-scheduler` to a daily Inngest cron.** The wrapper `runChiefOfStaffForWorkspace` already binds `PrismaApprovalSink`; the moment a caller exists, real meeting/reply/to-do approvals land. Replace `stubbed-json` Google + M365 Calendar fetchers with real adapters built on the existing OAuth token store (Gmail proves the OAuth shape). | Flips the most-replicated overclaim (11 verticals) to TRUE. Single highest-leverage runtime wedge in the fleet. | Real Google + M365 calendar OAuth creds (self-serve readiness) |
| 9 | **Wire the 3 `/general` skills** (`inbox-triage-general`, `follow-up-chaser-general`, `process-doc-drafter-general`) **to Prisma approval sinks + production callers.** Triage = on-demand API route (operator dashboard) or daily cron. Follow-up = daily cron (stale-thread sweep). Process-doc = weekly cron (patterns emerge over weeks). Process-doc also needs the `PastAction[]` adapter that materializes from approved `WorkApprovalQueueItem` rows + sent messages. | `/general` becomes truly live for any workspace that connects Gmail/M365 today. | Existing Gmail + M365 adapters (already `status: 'built'`); pgvector-backed `PastAction[]` source for process-doc |
| 10 | **Build the realty connector triad** (`invoice-chasing-realestate` + `lead-triage-realestate` + the existing `buyer-inquiry-router` chain): QuickBooks Online (commission AR), Follow Up Boss (lead/CRM), Skyslope or dotloop (transaction). Wire daily crons. Add `boundSkill` entries to the real-estate `agentRoster` for invoice-chase + lead-triage (currently orphans; under-claimed). | Realty becomes the first vertical with a real working value loop on real brokerage data. Unblocks `b2b-head-of-realty`'s pilot pursuit. | QBO MCP (in flight per `lib/integrations/quickbooks-mcp/`); FUB adapter; Skyslope or dotloop pick |
| 11 | **Build the remaining 11 vertical adapter sets** in the per-vertical "biggest market share" order specified in each Part 1 profile: CPA (QBO + Karbon or Canopy), law (Clio), RIA (Orion + Redtail), insurance (EZLynx), mortgage (Encompass), home-services (AccuLynx for roofing), recruiting (Greenhouse), property-mgmt (AppFolio), title-escrow (SoftPro). Each unlocks its vertical's `live` claim honestly. | One vertical at a time graduates from "rooting" to "live" with the site copy + the runtime backing the same claim. | Per-vertical OAuth/API creds; the live-fixture protocol (Tier iii item 18) |
| 12 | **Activate the `realty-compliance-sentinel` middleware** at `lib/agents/orchestrator/middleware/compliance.ts`. Load the GA-only V1 rule corpus (federal Fair Housing + GA Fair Housing + NAR Article 12/16 + GREC + FMLS + GAMLS + CAN-SPAM + TCPA + RESPA + TILA); seed the test corpus (≥50 cases); wire dry_run → observe → live gating. ~11–16 days per `realty-compliance-sentinel` V0 checklist. | Becomes the architectural seam that lets the broker-of-record stop being the bottleneck on every draft — without giving up licensed responsibility. The single largest unlock for the realty pilot. | Counsel review on corpus; rule-matcher design |

**Tier (ii) total:** 15 demo-only skills + 1 corpus build. Hard dependency on the self-serve readiness work for connect-in-a-click prod creds. Without that, the connector adapter halves can't ship; with it, every demo-only skill is 1–2 weeks of focused integration work away from real-data firing.

### Tier (iii) — Activate the dormant org/vertical charters (install staged heads + close realty V0 checklists)

The expensive but highest-truth-conversion tier: turn paper into firing agents.

| # | Action | What it unlocks | Dependency |
|---|---|---|---|
| 13 | **Install the 8 STAGED-NOT-INSTALLED heads** (`b2b-head-of-{cpa,law,mortgage,property-mgmt,recruiting,ria,title-escrow}` + `agentplain-knowledge-architect`) to `~/.claude/skills/<slug>/SKILL.md`. Enable `USE_GHA_CRON == 'true'` in the repo variable layer. Verify each fires by checking own-author entries in `fleet_activity_log.md` within 7 days. | Removes the 7-vertical overclaim where pages exist but no owner drives them. `agentplain-knowledge-architect` starts governing the pgvector substrate (re-embeds, retrieval-relevance, MCP health). | None — install is a copy + a repo-var flip |
| 14 | **Rebuild the 4 b2b-eng SKILL.md files** (`b2b-eng-tech-lead`, `-backend`, `-frontend`, `-integrations`, `-qa`) anchored to `C:\agentplain\` (not `C:\b2b\`). Each agent's recommendations-inbox already carries the paste-ready proposal from capability-builder's deep-dive cycle. Strip the b2b-eng-frontend brand mandate (lines 33-40 forbid editorial paper/ink palette; that brand was locked 2026-05-10). Add MCP-first migration + WebhookEvent idempotency + Inngest renewal sweep to b2b-eng-integrations. | The 4 eng-pod agents start firing usefully. The B2B build cadence stops depending on Conner + capability-builder doing the decompose/review/gate work directly. | None |
| 15 | **Activate the b2b-org chain**: `b2b-ceo` weekly summary write-up at `agent-state/b2b-ceo/weekly-summary-<YYYY-WW>.md`; `b2b-client-service-director` builds the four service-partnership deliverables (`memory/service_partnership/onboarding_playbook.md` + per-vertical + `monthly_business_review.md` + `custom_skill_intake.md` + `raci.md`); `b2b-eng-tech-lead` runs the Friday 3pm ET state-of-the-pod write-up; `b2b-eng-tech-lead` activates the customer-surface PR check (banned-framings review). | The dogfood claim becomes defendable at every layer the about-page names. The 4 service-partnership playbooks are the operational backbone of the "we run it for you" Partner-tier positioning. | None — gate is `USE_GHA_CRON` |
| 16 | **Close the realty V0 checklists** for the 7 realty ICs in priority order: (a) `realty-compliance-sentinel` (load-bearing — see Tier ii item 12), (b) `realty-buyer-inquiry-router` (FUB + kvCORE + M365 Graph adapters; TCPA gate; deterministic routing function), (c) `realty-showing-scheduler` (per-agent OAuth + encryption-key blast-radius; M365 Graph + Google Calendar; constraint solver), (d) `realty-listing-coordinator` (Skyslope or dotloop adapter; GA listing-rule reference; broker-of-record sign-off flow). Defer the 3 V0-dry-run agents (`realty-crm-hygiene`, `realty-production-reporter`, `realty-recruiter-assistant`) per `b2b-head-of-realty`'s 2026-05-03 deferral decision. | First paying brokerage becomes accept-able. Realty pilot Day-7/14/30 metrics start landing in `b2b-head-of-realty`'s daily-loop dir. | Counsel review on Compliance Sentinel corpus (item 12); first paying-brokerage prod creds (item 8/11 self-serve readiness) |
| 17 | **Activate the insights department** in dependency order: (a) `insights-survey-research` ships the 6 V0 methodology files + the B2B brokerage-owner JTBD interview guide (highest pre-revenue value — surveys produce data from scratch); (b) `insights-agent-measurement` co-signs the boundary doc with capability-builder + head-of-insights, ships the V0 fleet baseline + first monthly fleet-quality report (closes the EvolveR loop currently running unmeasured); (c) `insights-product-analytics` ships the 3 FlatSBO funnel reference files + the instrumentation-gap list to `flatsbo-tech-lead`; (d) `insights-reporting` ships the V0 dashboard mockup + convenes the NSM lock; (e) `insights-adhoc` ships the 6 diagnostic methodology files; (f) `insights-advanced-analytics` ships the toolkit-readiness files (honestly data-dependent — won't produce until ≥12 weekly observations etc.). | 0-of-40 V0 files → 40-of-40. The EvolveR loop on capability-builder's largest proposal volume in the fleet stops running unmeasured. Survey research starts producing JTBD instruments the realty pilot pursuit needs. | None |
| 18 | **Ship `platform-eng`'s missing primitives**: (a) Anthropic prompt-caching wrapper at `lib/platform/anthropic.ts` (27 days overdue per its own recommendations file; 9 direct-SDK call sites realizing 0% of 90% cost reduction); (b) Sentry SDK install in both repos with `before_send` PII redaction; (c) per-workspace derived-key encryption proposal landed with Conner for the OAuth token store; (d) live-fixture allowlist guard (`b2b-eng-qa`'s safety-critical contract — the file that prevents an integration test from ever hitting a customer's real OAuth-connected account). | 90% LLM cost reduction across the fleet; observability becomes real (current `docs/brand-and-claims.md:215` reads *"Observability — HALF"*); OAuth token store graduates from designed → shipped; pre-pilot safety baseline lands before the first design-partner connects a live mailbox. | None — all are paste-ready proposals in `platform-eng-recommendations.md` |

**Tier (iii) total:** 6 work streams that turn 28 charter-only/staged agents into firing ones. Order matters: install + repo-var flip (item 13) is a copy; item 18 unblocks all live-fixture-touching work; items 14–17 each unblock a downstream cohort.

### Top 5 (executive single-screen)

1. **Re-grade the 11 + 7 + 8 in-product/vertical-page overclaims** (Tier i items 1–2, 5–6) — 7 doc-only edits; flips the largest single source of "this agent reads live but isn't" mismatch.
2. **Wire `chief-of-staff-scheduler` to a daily Inngest cron + real Google/M365 Calendar adapters** (Tier ii item 8) — single highest-leverage runtime wedge; flips 11 vertical claims to TRUE at once. Depends on self-serve readiness prod creds.
3. **Install the 8 staged b2b heads + flip `USE_GHA_CRON`** (Tier iii item 13) — a copy + a repo-var flip; removes the 7-vertical "page exists, owner doesn't run" gap.
4. **Rebuild the 5 b2b-eng SKILL.md files anchored to `C:\agentplain\`** (Tier iii item 14) — paste-ready proposals already in each recommendations inbox; activates the dogfood claim's named verbs at the eng-pod layer.
5. **Ship `platform-eng`'s 4 missing primitives** (Tier iii item 18) — prompt-caching wrapper (27 days overdue), Sentry, KMS, live-fixture allowlist guard. 90% LLM cost reduction + observability + pre-pilot safety baseline.

---

## 4. Pointers to the section docs

Full per-agent interview profiles — the load-bearing "what I can do today / what the site says I do / the gap / what I could do with the necessary improvements / honesty tag" record for every agent — live in the three section docs:

- **Part 1 — runtime catalog skills** (`docs/agent-interviews/01-runtime-skills.md`) — the 16 code-defined skills in `lib/skills/<slug>/`. The honesty tag here covers the in-product agentRoster overclaim pattern.
- **Part 2 — per-vertical agent layer** (`docs/agent-interviews/02-vertical-agents.md`) — the 18 SKILL.md *charter* agents (7 realty ICs + 3 active b2b heads + 8 staged b2b heads). The honesty tag here covers the staged-not-installed vertical-page overclaim.
- **Part 3 — b2b org leadership + eng + insights + shared** (`docs/agent-interviews/03-org-agents.md`) — the 16 internal agents that build and run agentplain itself. The honesty tag here covers the about-page dogfood overclaim.
- **Fleet roster reference** (`docs/fleet-roster-2026-05-27.md`) — the authoritative enumeration that scoped this audit (101 agent-tier entries; 50 in scope for the per-agent interview series).
