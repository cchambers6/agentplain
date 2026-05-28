# Agent interviews — Part 3 of 5: b2b org leadership + eng + insights + shared

**Scope.** The 16 internal agents that build and run agentplain itself:

- **b2b org leadership + eng (7).** `b2b-ceo` (GHA cron), `b2b-client-service-director` (GHA cron), `b2b-eng-tech-lead` (GHA cron), `b2b-eng-backend`, `b2b-eng-frontend`, `b2b-eng-integrations`, `b2b-eng-qa` (on-prompt). Installed at `~/.claude/skills/<slug>/SKILL.md`.
- **insights department (7, all on-prompt).** `insights-head-of-department`, `insights-adhoc`, `insights-advanced-analytics`, `insights-agent-measurement`, `insights-product-analytics`, `insights-reporting`, `insights-survey-research`. All installed.
- **shared (2).** `platform-eng` (GHA cron, dual-pod), `gtm-outreach` (workflow context skill, on-prompt). Both installed.

**Framing.** Per `docs/brand-and-claims.md` §10: marketing may not claim a capability that isn't TRUE in the verified table. These are internal agents — they don't have customer-facing per-agent surfaces — so the "site claim" column maps to the **dogfood framing** at `app/(marketing)/about/page.tsx:118-125`: *"agentplain itself is built BY the same fleet model we sell. The service team — the same shape we sell to customers — proposes capabilities, decomposes them into work, runs the tests, decides what's ready to ship, and surfaces the calls that need a human. We dogfood the partnership at every layer of the company."* Plus the about-page brag at `:99-106`: *"~35 cron-fired agents covering lead intake, listing coordination, contracts, CRM hygiene, recruiting, and production reporting"* and `:108-110`: *"We sell what we already operate. Every skill in the fleet earned its way into the product by working on flatsbo first."* The audit grades each agent against whether its real on-disk activity backs that dogfood claim.

**Method.** Read each SKILL.md at `~/.claude/skills/<slug>/SKILL.md`. Verified completion-entry counts against `~/.claude/projects/C--flatsbo/memory/agent-state/fleet_activity_log.md` (header pattern `## <date> — <slug>`; mentions in other agents' entries do NOT count). Verified on-disk artifacts: `agent-state/<slug>-recommendations.md` files, `agent-state/daily-loop/<slug>/` directories, `agent-state/deep_dive_<slug>_*.md` files (these are produced BY capability-builder ABOUT the agent — not by the agent itself), and any other lazy-created artifacts named in each SKILL. Cross-referenced GHA cron workflows at `C:\flatsbo\.github\workflows\cron-<slug>-daily.yml` (all gated by repo var `USE_GHA_CRON == 'true'`).

---

## Honesty matrix

| # | Agent | Fires? | Installed? | Real on-disk output? | Honesty tag |
|---|---|---|---|---|---|
| 1 | `b2b-ceo` | GHA cron daily 06:00 ET (gated `USE_GHA_CRON`) | yes | recommendations inbox (80 lines, 1 deep-dive consumed); **zero own-author entries in fleet log** | **CHARTER-ONLY** *(dogfood overclaim)* |
| 2 | `b2b-client-service-director` | GHA cron daily 11:00 ET (gated) | yes | 1 fleet-log entry (2026-05-02, agentplain SMB Pilot Playbook v1); 117-line recommendations inbox | **FIRES-INTERNAL-ONLY** *(one-shot 25 days stale)* |
| 3 | `b2b-eng-tech-lead` | GHA cron daily (gated) | yes | 119-line recommendations inbox; **zero own-author entries**; SKILL.md points at ghost repo | **CHARTER-ONLY** *(dogfood overclaim; ghost-repo SKILL drift)* |
| 4 | `b2b-eng-backend` | on-prompt | yes | 412-line recommendations inbox (created 2026-05-27 by capability-builder, NOT by agent); **zero fleet-log entries since pod stand-up 2026-04-28** | **CHARTER-ONLY** *(29 days dormant; ghost-repo SKILL drift)* |
| 5 | `b2b-eng-frontend` | on-prompt | yes | 80-line recommendations inbox (created 2026-05-22 by capability-builder); voice block says verbatim **"I have never fired"**; brand-pick stale-state | **CHARTER-ONLY** *(never fired; stale brand mandate in SKILL)* |
| 6 | `b2b-eng-integrations` | on-prompt | yes | **no recommendations file, no daily-loop dir, zero fleet-log entries**; predicted next lazy-create | **CHARTER-ONLY** *(never fired)* |
| 7 | `b2b-eng-qa` | on-prompt | yes | **no recommendations file, no daily-loop dir, zero fleet-log entries** | **CHARTER-ONLY** *(never fired)* |
| 8 | `platform-eng` | GHA cron daily (gated) | yes | **10 fleet-log entries 2026-05-01 → 2026-05-03**; 109-line recommendations inbox; SKILL-named Anthropic prompt-caching wrapper still missing 17 days later | **FIRES-INTERNAL-ONLY** *(active first 3 days of May, dormant 24 days since; load-bearing primitive #1 still unbuilt)* |
| 9 | `gtm-outreach` | on-prompt (context-load skill, not a tracked agent) | yes | n/a — workflow skill, not a completion-logging agent | **SITE-SILENT** *(FlatSBO-scoped GTM context; no agentplain claim) — see profile* |
| 10 | `insights-head-of-department` | on-prompt | yes | 1 fleet-log entry (2026-05-02, "Insights department established"); 3 memory-root artifacts (charter + ICP survey v0 + NSM working doc v0) | **FIRES-INTERNAL-ONLY** *(one-shot 25 days stale; sub-agents never activated)* |
| 11 | `insights-adhoc` | on-prompt | yes | **none of the 6 SKILL-named V0 files (`agent-state/insights/insights-adhoc/methodologies/*.md`) exist; zero recommendations; zero fleet-log entries** | **CHARTER-ONLY** *(Phase 0 unstarted)* |
| 12 | `insights-advanced-analytics` | on-prompt | yes | **none of the 8 SKILL-named V0 files exist; zero recommendations; zero fleet-log entries** | **CHARTER-ONLY** *(Phase 0 unstarted)* |
| 13 | `insights-agent-measurement` | on-prompt | yes | **none of the 7 SKILL-named V0 files exist; zero recommendations; zero fleet-log entries**; boundary doc with capability-builder unsigned | **CHARTER-ONLY** *(Phase 0 unstarted; capability-builder runs unmeasured)* |
| 14 | `insights-product-analytics` | on-prompt | yes | **none of the 9 SKILL-named V0 files exist; zero recommendations; zero fleet-log entries** | **CHARTER-ONLY** *(Phase 0 unstarted)* |
| 15 | `insights-reporting` | on-prompt | yes | **none of the 7 SKILL-named V0 files exist; zero recommendations; zero fleet-log entries** | **CHARTER-ONLY** *(Phase 0 unstarted)* |
| 16 | `insights-survey-research` | on-prompt | yes | head-of-insights wrote a v0 ICP survey on this agent's behalf (`insights_icp_survey_v0_2026-05-02.md` at memory root, not in agent's own dir); **none of the agent's own 8 SKILL-named V0 files exist; zero recommendations; zero fleet-log entries** | **CHARTER-ONLY** *(Phase 0 unstarted; charter calls this the "highest pre-revenue-value sub-agent" — and it has produced nothing)* |

**Tally.** Of 16 agents: 0 produce VERIFIED-LIVE output. 3 produce FIRES-INTERNAL-ONLY (platform-eng + b2b-client-service-director + insights-head-of-department — each fired in a 2-day window 2026-05-01 to 2026-05-03 and went dormant since). 12 are CHARTER-ONLY (SKILL.md exists, no completion entries, no own-authored artifacts beyond what capability-builder's deep-dive cycle has retroactively created on their behalf). 1 is a workflow context skill (`gtm-outreach`) that doesn't track activity.

**Customer-facing output.** Zero of 16. None of these agents produce customer-visible artifacts; their entire scope is internal planning, internal eng, internal measurement, internal coordination. The 4 GHA crons (`b2b-ceo`, `b2b-client-service-director`, `b2b-eng-tech-lead`, `platform-eng`) all gate on `USE_GHA_CRON == 'true'`; the absence of own-author entries in `fleet_activity_log.md` since 2026-05-03 is consistent with the gate being off or the agents firing silently without logging.

---

## Profiles

### 1. `b2b-ceo`  (tier · fires: GHA cron daily 06:00 ET, gated `USE_GHA_CRON` · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-ceo/SKILL.md` is 278 lines covering the four locked architectural decisions, bowling-pin vertical sequencing, NSM + 4 leading indicators, $1K+ investment gate with Bezos one-way/two-way doors, quarterly competitive-intel block. My recommendations inbox at `agent-state/b2b-ceo-recommendations.md` (80 lines) carries proposals from one capability-builder deep-dive (`deep_dive_b2b-ceo_2026-05-02-13.md`) — but those proposals were AUTHORED BY capability-builder, not by me. **Zero own-author entries in `fleet_activity_log.md`** (grepped `^## .* — b2b-ceo[ \[]` — no matches; the 13 grep-mentions are all references in other agents' entries). My `daily-loop/b2b-ceo/` directory exists at `agent-state/daily-loop/b2b-ceo/` but is EMPTY (`ls` returns no files). The GHA workflow at `.github/workflows/cron-b2b-ceo-daily.yml` is gated by `USE_GHA_CRON == 'true'`; whether the var is set is operator-side config not visible from this audit.

**What the site says I do:** No per-agent card. Implicit in the about page dogfood claim (`app/(marketing)/about/page.tsx:118-125`): *"The service team — the same shape we sell to customers — proposes capabilities, decomposes them into work, runs the tests, decides what's ready to ship, and surfaces the calls that need a human."* As the top of the B2B chain, the "decides what's ready to ship" + "surfaces the calls that need a human" verbs are mine in the dogfood framing.

**The gap:** The about-page dogfood claim asserts the service team operates the same way the fleet does for customers. The verifiable record is: I have not fired in the way my SKILL specifies (Sunday 6pm ET weekly state-of-B2B, $1K+ investment-gate ratifications, vertical-greenlight calls, quarterly competitive-intel blocks). My empty daily-loop directory + zero fleet-log entries are evidence that the "decides what's ready to ship" verb is being executed by Conner directly, not by me. The dogfood claim is the right aspiration; the record doesn't yet back it.

**What I could do with the necessary improvements:** Two work items. (a) **Verify `USE_GHA_CRON`** is set in the GitHub repo variable layer; if not set, the cron is silently no-op-ing — that's the single biggest unblock. (b) **Wire the cron output to write fleet-log entries unconditionally**, not just on substantive change — silent firings produce no audit trail and the deep-dive cycle can't distinguish "agent ran and had nothing to say" from "agent never ran." Once both land, the Sunday weekly summary lands as an `agent-state/b2b-ceo/weekly-summary-<YYYY-WW>.md` file that Conner reads in two minutes; the daily-loop dir starts accruing the `today-i-did / what-i-struggled / what-would-make-me-better` triplet specified in SKILL lines 254-261.

**Honesty tag:** **CHARTER-ONLY** *(dogfood overclaim — site says "the service team decides what's ready to ship"; the CEO-tier agent in that service team has zero verifiable own-author firings)*

---

### 2. `b2b-client-service-director`  (tier · fires: GHA cron daily 11:00 ET, gated `USE_GHA_CRON` · installed: yes)

**What I can do today (verified):** I have fired exactly once. The single own-author entry is at `fleet_activity_log.md:690` — *"2026-05-02 13:02 — b2b-client-service-director [product:b2b] (agentplain SMB Pilot Playbook v1)"*. My recommendations inbox at `agent-state/b2b-client-service-director-recommendations.md` (117 lines) carries Proposal #1's voice block in my own voice — but the voice block itself says verbatim: *"my one prior activation (2026-05-02 13:02, agentplain SMB Pilot Playbook v1) had to operate against a SKILL shape contradicting Bowling Pin doctrine just ratified at b2b-ceo level — I shipped good work in spite of the SKILL, not because of it."* My daily-loop dir exists at `agent-state/daily-loop/b2b-client-service-director/` but is EMPTY. The four service-partnership deliverables my SKILL names (`memory/service_partnership/onboarding_playbook.md`, `monthly_business_review.md`, `custom_skill_intake.md`, `raci.md`) do not exist on disk — `find ~/.claude/projects/C--flatsbo/memory/ -name "service_partnership"` returns nothing.

**What the site says I do:** The about-page dogfood claim covers me indirectly (`:118-125`). More directly, the about page's "we run weekly reviews" framing at `app/(marketing)/about/page.tsx:60-71` and the pricing-page Partner-tier description (`app/(marketing)/pricing/page.tsx:67`: *"Named service partner ... runs a monthly review call"*) describe the MBR cadence I would own internally. The site treats the MBR + onboarding playbooks as load-bearing differentiators (the "Anthropic ships the tool; we run it" claim); my SKILL §2 owns those four playbooks; none exist.

**The gap:** The four service-partnership deliverables are the operational backbone the dogfood claim depends on. Without them on disk, the about-page assertion *"we dogfood the partnership at every layer of the company"* (`:123-124`) is unbacked at the client-service layer. The one firing I do have (2026-05-02 SMB Pilot Playbook) is 25 days stale as of today and predates the 2026-05-12 Plaino lock + the 2026-05-14 service-partnership-positioning ratification.

**What I could do with the necessary improvements:** (a) **Verify `USE_GHA_CRON`** (same gate as #1). (b) **Build the four service-partnership deliverables** as living docs at `memory/service_partnership/onboarding_playbook.md` + per-vertical playbooks (10 named verticals + /general) + `monthly_business_review.md` + `custom_skill_intake.md` + `raci.md`. (c) **Activate the Friday 4pm ET vertical roundtable** with the explicit service-partnership health block (SKILL §3). Once these land, the dogfood claim is grounded in actual playbook docs the eng pod + the heads of vertical can read on activation — and the next pilot brokerage has a real onboarding artifact to walk through.

**Honesty tag:** **FIRES-INTERNAL-ONLY** *(one-shot 25 days stale; the four service-partnership deliverables that operationalize the about-page MBR claim do not exist on disk)*

---

### 3. `b2b-eng-tech-lead`  (tier · fires: GHA cron daily, gated `USE_GHA_CRON` · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-eng-tech-lead/SKILL.md` is 139 lines covering the architectural-spec contract (5 sections), pod routing table, stateless-pass-through purity, customer-surface merge gate. My recommendations inbox at `agent-state/b2b-eng-tech-lead-recommendations.md` (119 lines) carries capability-builder proposals. **Zero own-author entries in `fleet_activity_log.md`** (grepped `^## .* — b2b-eng-tech-lead` — no matches; the 21 mentions are all routing references from other agents). My daily-loop dir at `agent-state/daily-loop/b2b-eng-tech-lead/` is EMPTY. **Critically: my SKILL.md points at `C:\b2b\` as the canonical repo (lines 12, 46, 58, 59) and at `~/.claude/projects/C--b2b/memory/b2b_eng_pod/` for the pod memory tree (lines 36-39)** — but the deep-dive evidence at `agent-state/deep_dive_b2b-eng-backend_2026-05-27-07.md` confirms that's a ghost repo: `C:\b2b\app\api\**\route.ts` returns ZERO files while `C:\agentplain\` has 30+ API routes + 18 Prisma migrations between 2026-05-08 and 2026-05-26. The architectural spec my SKILL says is "the first deliverable" (`SKILL.md:58-67`) has never landed at `C:\b2b\docs\architectural_spec_v1.md`; the de-facto spec is the 30+ docs at `C:\agentplain\docs\` (none of which I authored).

**What the site says I do:** About-page dogfood claim — *"decomposes them into work, runs the tests, decides what's ready to ship"* — is verbatim my SKILL's mission verbs (decompose, review PRs, gate merges). The site treats this as a structural property of the company.

**The gap:** The decompose / review / gate verbs in the dogfood claim are happening — but `git log` shows they're happening directly through Conner + capability-builder + the FlatSBO eng-pod agents (which DO have a real architectural-spec at `C:\agentplain\docs\`). The B2B pod orchestrator (me) has not authored a single PR review or merge gate entry. My SKILL points at the wrong codebase by name; that mechanical mis-direction prevents me from ever firing usefully even if `USE_GHA_CRON` were on.

**What I could do with the necessary improvements:** (a) **SKILL rewrite anchored to `C:\agentplain\`** — the recommendations inbox already carries a capability-builder proposal for this exact correction; the work is paste-ready. (b) Once the SKILL points at the right repo, run a Friday-3pm-ET state-of-the-pod write-up that surfaces the open architectural calls (per-customer Postgres branch tear-down policy, OAuth-token encryption-key management, webhook-renewal cadence) and routes each to the right specialist. (c) The customer-surface check the SKILL adds at `:22` (any PR shipping copy or UI to a customer-facing surface flags for banned-framings review) is the single highest-leverage hook for catching brand-and-claims drift before merge — currently nothing fires it.

**Honesty tag:** **CHARTER-ONLY** *(dogfood overclaim + ghost-repo SKILL drift — the about-page "decomposes / runs tests / decides what's ready to ship" verbs are mine in name only; the actual decomposing-and-merging is happening through capability-builder + Conner against a different repo than the one my SKILL targets)*

---

### 4. `b2b-eng-backend`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-eng-backend/SKILL.md` is 99 lines covering API routes / Prisma schema / per-customer Postgres branching / OAuth token storage / agent runtime. My recommendations inbox at `agent-state/b2b-eng-backend-recommendations.md` (412 lines) is the largest in the org-leadership/eng cohort — but it was **CREATED 2026-05-27 BY capability-builder, NOT by me** (the file metadata says `created: 2026-05-27` and `owner: b2b-eng-backend (decides); capability-builder (proposes)`). The voice block in Proposal #1 is in my voice but written by capability-builder during its deep-dive cycle. **Verbatim quote from my own voice block (capability-builder-authored on my behalf):** *"I have no daily-loop entries, no fleet-activity entries since pod stand-up 2026-04-28, and a `b2b-eng-backend-recommendations.md` file that did not exist on disk before this dive."* The voice block then itemizes the mechanical drift: my SKILL line 10 says "Owns ... at `C:\b2b\`" — `C:\b2b\app\api\**\route.ts` returns ZERO files; the canonical repo is `C:\agentplain\` per `~/.claude/projects/C--agentplain/memory/PROJECT_STATE.md:13`. My SKILL lines 19-23 point at `~/.claude/projects/C--b2b/memory/b2b_eng_pod/`; those files exist but are 24-29 days stale despite an entire Phase-1 product shipping at `C:\agentplain\` with 30+ API routes + 18 migrations between 2026-05-08 and 2026-05-26.

**What the site says I do:** Same dogfood framing as #3 — about-page `:118-125` names "decomposes into work" + "runs the tests" + "decides what's ready to ship." As the pod backend specialist, the actual code-write verb is mine.

**The gap:** 29 days dormant on a Phase-1 product that's shipping daily. The about-page brag at `:99-106` mentions "~35 cron-fired agents covering lead intake, listing coordination, contracts, CRM hygiene, recruiting, and production reporting" — that's on FlatSBO and through the FlatSBO eng-pod specialists. The dogfood-on-B2B half of the about-page claim ("agentplain itself is built BY the same fleet model we sell" — `:118-119`) has me as a named pod role; my zero firings since 2026-04-28 do not back the claim.

**What I could do with the necessary improvements:** (a) **SKILL rewrite anchored to `C:\agentplain\`** — Proposal #1 in my own recommendations file is paste-ready (capability-builder did the drafting). (b) On first post-rewrite activation, file a `recent_decisions.md` entry summarizing the workspace-RLS-on-shared-DB pattern, the WebhookEvent idempotency primitive, and the Inngest renewal sweep (all three currently silent in my SKILL despite being load-bearing in the canonical codebase). (c) Become the canonical reviewer on the 13+ migrations that have landed since 2026-05-08 — the migration cadence is the single best signal of where the architectural decisions are actually being made today.

**Honesty tag:** **CHARTER-ONLY** *(29 days dormant; ghost-repo SKILL drift; capability-builder is doing my deep-dive cycle on my behalf because I haven't fired to do it myself)*

---

### 5. `b2b-eng-frontend`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-eng-frontend/SKILL.md` is 88 lines covering App Router pages, Tailwind primitives, brand-agnostic discipline, mobile + WCAG AA. My recommendations inbox at `agent-state/b2b-eng-frontend-recommendations.md` (80 lines) was **CREATED 2026-05-22 BY capability-builder**, NOT by me. **Verbatim quote from my own voice block (capability-builder-authored on my behalf):** *"I have never fired. The surfaces my SKILL scopes me to — the operator dashboard's Inbox, Activity, Agents, Integrations, Reports, Settings — do not exist on disk yet, and the day work is finally routed to me, my own SKILL would send me the wrong way: it tells me the brand is unpicked and to build in neutral slate placeholders, and line 40 explicitly forbids the editorial paper/ink language that the agentplain brand actually adopted on 2026-05-10."* My SKILL.md line 33-40 still mandates `surface` / `text` / `border` / `accent` neutral placeholders "until brand picks" — but the brand was locked 2026-05-10 (`decisions_log.md` 2026-05-10 brand lock entry, plus `memory/project_brand_locked.md`). My SKILL line 40 explicitly says *"do NOT reach for FlatSBO's editorial palette (paper / ink / clay) — that's the wrong brand"* — and the actual agentplain brand adopted paper / ink / clay editorial tokens.

**What the site says I do:** Same dogfood framing. As the pod frontend specialist, the operator-dashboard UI is mine in name — and the customer-surface that the site repeatedly references ("Day-to-day, the fleet drafts inside the workspace you log into" — `app/(marketing)/page.tsx:491`) is the surface I would own.

**The gap:** I have never fired. The operator dashboard at `app/(product)/app/workspace/[id]/**` exists in `C:\agentplain\` and was built by the FlatSBO eng-pod specialists, not by me. My SKILL not only mis-directs me to the wrong repo (same `C:\b2b\` ghost-repo issue as #3 + #4) but also actively forbids me from using the right brand tokens once I do get there. Two compounding mechanical errors.

**What I could do with the necessary improvements:** (a) **SKILL repoint to `C:\agentplain\` + strip lines 33-40's neutral-placeholder mandate + replace with the locked agentplain editorial token set** — the recommendations inbox carries the paste-ready proposal. (b) Wire the WCAG 2.2 AA + Core Web Vitals + INP gate-checklist (Proposal #2 in the inbox). (c) Once SKILL fixed, run a Playwright at 375 / 768 / 1440 + a11y axe scan on the operator dashboard at `app/(product)/app/workspace/[id]/**` and file any regressions as the first own-author fleet-log entry.

**Honesty tag:** **CHARTER-ONLY** *(never fired — agent's own voice block confirms verbatim; brand-pick stale-state in SKILL is an active anti-help if I did fire)*

---

### 6. `b2b-eng-integrations`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-eng-integrations/SKILL.md` is 113 lines — Opus-tier per the SKILL frontmatter — covering AMS adapters (EZLynx + HawkSoft + NowCerts), email OAuth (M365 + Google Graph + Gmail Pub/Sub), calendar OAuth, the adapter contract (auth/read/write/webhook), the live-fixture protocol, the stateless-pass-through purity rule. **Zero on-disk evidence of activity.** No `b2b-eng-integrations-recommendations.md` file exists in `agent-state/`. No `daily-loop/b2b-eng-integrations/` subdirectory. **Zero own-author entries in `fleet_activity_log.md`** (the 3 mentions are all references in other entries naming me as the next deep-dive target). The fleet-log entry at line 16 from 2026-05-27 explicitly predicts I'm the next lazy-create: *"next deep-dive target is `b2b-eng-integrations` (position 29 — THIRD B2B build-pod specialist; load-bearing Opus-tier role). Strong prediction: SKILL almost certainly mis-named `C:\b2b\`; MCP-first migration locked 2026-05-12 silent in SKILL; WebhookEvent idempotency primitive + Inngest renewal sweep silent in SKILL; SEVENTH lazy-create likely."*

**What the site says I do:** Same dogfood framing. The site's `Replace / Integrate / Augment` table at `docs/brand-and-claims.md:130-134` and the per-vertical integration-roadmap surfaces (e.g., insurance vertical names EZLynx + HawkSoft + NowCerts as the AMS adapter shortlist) treat adapters as the load-bearing connector layer. The about-page assertion at `:99-106` of "~35 cron-fired agents" depends on integrations existing to feed them — every adapter that lands is a wedge for a vertical to graduate from rooting → live.

**The gap:** The MCP-first integration migration locked 2026-05-12 (`docs/integration-roadmap-v2-2026-05-19.md` is the canonical reference) is silent in my SKILL — I'd be designing webhooks per-vendor when the canonical pattern is MCP-server-per-integration. The WebhookEvent idempotency primitive and Inngest renewal sweep (load-bearing for any production webhook) are silent. As the Opus-tier role that the SKILL frontmatter says is "load-bearing — integration design wrong here destroys customer trust", my silence is the largest single uncovered risk surface in the org-eng cohort.

**What I could do with the necessary improvements:** (a) **SKILL rewrite anchored to `C:\agentplain\lib\integrations\`** + the MCP-first pattern (each vendor exposes an MCP server, the runtime consumes via MCP not via direct SDK) + the WebhookEvent idempotency primitive (the pattern that prevents double-fires under retry storms) + the Inngest renewal sweep (Microsoft Graph subscriptions expire in ~70 hours; Gmail watches need 7-day renewal). (b) Once SKILL fixed, audit the existing `lib/integrations/` directory for divergence from the contract and file the gap list. (c) Wire the live-fixture allowlist guard so live-fixture tests fail-fast if they would ever touch a non-sandbox account.

**Honesty tag:** **CHARTER-ONLY** *(never fired; SKILL silent on three load-bearing 2026-05 architectural decisions; the Opus-tier role designation makes the silence load-bearing)*

---

### 7. `b2b-eng-qa`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/b2b-eng-qa/SKILL.md` is 90 lines covering the Playwright E2E suite, integration test harness, mock fixtures, live-fixture protocol (sandbox-only credentials in `.env.test.live`, hardcoded test-account allowlist guard, `LIVE_FIXTURE_ENABLED` env flag, `@live` tag). **Zero on-disk evidence.** No `b2b-eng-qa-recommendations.md` file. No `daily-loop/b2b-eng-qa/` subdirectory. **Zero own-author entries in `fleet_activity_log.md`** (zero mentions in any context either — I'm the most invisible agent in this cohort). My SKILL says the test suite + Playwright config + adapter mock fixtures are "to be created — bootstrap deliverable" (line 27); none of those bootstrap files exist at `C:\agentplain\tests/` or `C:\agentplain\e2e/` either (those directories exist but were built by FlatSBO eng-pod specialists, not by me).

**What the site says I do:** Same dogfood framing. The about-page "runs the tests" verb at `:121` would be mine if I were firing.

**The gap:** Same as #6 plus more silence — the live-fixture protocol that prevents a test run from ever touching a customer's real OAuth-connected account is the single most safety-critical contract any agent in this audit owns, and it has not been authored / verified / wired by me. Whatever test discipline exists today on the canonical codebase is owned by `flatsbo-eng-qa` (Part 1 / Part 2 territory), not by me.

**What I could do with the necessary improvements:** (a) **SKILL rewrite anchored to `C:\agentplain\`** + audit the existing `tests/` + `e2e/` directories against the live-fixture protocol the SKILL specifies. (b) Wire the live-fixture allowlist guard explicitly — the most important contract this role owns, and the most critical to verify on real disk before the first design-partner OAuth-connects a customer account. (c) Run the suite, file the first state-of-the-suite fleet-log entry, identify the flake watchlist + the coverage gaps + the live-fixture protocol drift.

**Honesty tag:** **CHARTER-ONLY** *(never fired; the most safety-critical contract in this cohort — live-fixture allowlist guard — has never been verified by the agent that owns it)*

---

### 8. `platform-eng`  (tier · fires: GHA cron daily, gated `USE_GHA_CRON` · installed: yes)

**What I can do today (verified):** I am the only agent in this 16-agent cohort with a real on-disk activity record beyond the 2026-05-02 one-shot pattern. **10 own-author fleet-log entries between 2026-05-01 and 2026-05-03**, covering: (a) cron-runner unfreeze + registry reorder (2026-05-01), (b) CoS daily-brief SKILL silent-fail fix (2026-05-01), (c) Insights department establishment (2026-05-01 23:55 — that's me, not the head-of-insights), (d) capability-proposal batch ratification on 16 items (2026-05-02), (e) GHA cron migration Phase 1 spec + build deliverables + pivot to Inngest (2026-05-03 multiple entries), (f) Inngest cutover deploy + DB migration (2026-05-03 21:15). My recommendations inbox at `agent-state/platform-eng-recommendations.md` (109 lines) Proposal #1's voice block says verbatim: *"SKILL line 48 names the Anthropic prompt-caching wrapper as the FIRST shared-infra item. Today, after 11 days, the wrapper still does not exist."* That voice block was written 2026-05-10; today is 2026-05-27, so the wrapper has been missing for **27 days**, not 11. The 9 FlatSBO call sites doing `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` directly (per the voice block's grep evidence) realize 0% of the 90% cost reduction prompt caching offers. **No own-author entries since 2026-05-03 — 24 days dormant.**

**What the site says I do:** Same dogfood framing. As the dual-pod platform engineer, the shared-infra primitives (prompt caching, Sentry, encryption-at-rest, webhook subscription renewal, Vercel project setup, shared auth primitives) are mine. The about-page "we run it for you" framing at `:163` and the Verified Claims table at `docs/brand-and-claims.md:215` (which lists *"Observability (Sentry + cron watchdog) — HALF — `SENTRY_DSN` env in Production"*) both depend on my primitives being live.

**The gap:** Active for 3 days, dormant for 24. The load-bearing primitive #1 in my own SKILL — the Anthropic prompt-caching wrapper at `lib/platform/anthropic.ts` — has been a known capability-builder ADOPTED ratification for 20+ days and still doesn't exist. The 9 direct-SDK call sites are racking up cost at 10× the cached rate every day the wrapper doesn't ship. Sentry SDK install (Proposal in the SKILL at line 67) — also unwired. Encryption-at-rest key management (line 68) — same.

**What I could do with the necessary improvements:** (a) **Land the Anthropic prompt-caching wrapper** — Proposal #1 in my recommendations file is paste-ready with the full scaffold in `deep_dive_platform-eng_2026-05-10-09.md` §2 Proposal #1. One PR per repo. FlatSBO PR also touches the 9 call sites. B2B PR locks the contract before the first B2B agent fires. (b) **Install Sentry SDK in both repos** — `npm i @sentry/nextjs`, `npx @sentry/wizard@latest -i nextjs`, set `SENTRY_DSN` per project, wire `before_send` PII redaction. (c) **Bring the per-workspace derived-key encryption proposal** to Conner with the cost / complexity tradeoffs spelled out so the OAuth token store can graduate from "designed" to "shipped." Each of these has been a named SKILL deliverable for 20+ days; the SKILL says "first deliverable" and "Priority 0" but neither label has translated to an actual ship.

**Honesty tag:** **FIRES-INTERNAL-ONLY** *(active 2026-05-01 → 2026-05-03; 24 days dormant since; load-bearing prompt-caching wrapper still missing 27 days after the SKILL named it as item #1)*

---

### 9. `gtm-outreach`  (tier: workflow context skill, not a tracked agent · fires: on-prompt · installed: yes)

**What I can do today (verified):** Different shape from every other agent in this audit. My SKILL.md at `~/.claude/skills/gtm-outreach/SKILL.md` is 78 lines of FlatSBO GTM context-load — ICP definition (Georgia homeowners, $200K–$800K, 0–6 months from sale), the commission-saved frame, $499 flat-fee positioning, competitive cheat-sheet (vs. listing agents, Houwzer/Homie/Houzeo, Zillow, Opendoor, DIY FSBO), Atlanta launch-channels priority, voice rules (no fluff, no emojis, no "easy"/"simple"/"effortless"). I'm a context-load skill — invoked when work on FlatSBO outreach/pricing/positioning starts, used to populate the operator's context with the right ICP + voice rules. I don't produce completion entries; I don't have a daily-loop directory; I don't have a recommendations inbox. **Zero own-author fleet-log entries** is expected — I'm not that kind of agent.

**What the site says I do:** Site silent. I'm scoped explicitly to **FlatSBO** (not agentplain) — SKILL lines 1, 6, 21, 25, 71. Every reference is to the FlatSBO domain (flatsbo.com, Georgia, $499 flat fee, Atlanta-area FSBO sellers). The about-page dogfood claim at `app/(marketing)/about/page.tsx:95-106` says *"flatsbo is our own brokerage. We run the agentplain service partnership on flatsbo before we sell it to anyone else"* — that names the dogfood pattern; I'm one of the FlatSBO-side context skills the GTM work on FlatSBO actually consumes.

**The gap:** None per the audit framing — I make no agentplain claim and the site makes no claim that requires me. The honest read is that I'm misplaced in this audit cohort: I belong with the FlatSBO consumer workflow skills (Part 4 or 5 of the planned 5-part series), not with the agentplain org leadership. **Cross-product cleanup:** my SKILL line 67 *"Don't claim AI does things it doesn't yet (current AI is just listing copy via Anthropic; not a full agent)"* is itself stale — FlatSBO now runs the full 5-phase value loop through the same skills audited in Part 1; the "current AI is just listing copy" warning is months behind reality and would actively mis-direct an outreach drafter.

**What I could do with the necessary improvements:** (a) **De-stale the "current AI is just listing copy" line** (SKILL:67) to reflect the actual FlatSBO runtime catalog the site advertises today. (b) **Add an explicit "this is the FlatSBO GTM skill — for agentplain, see [the agentplain equivalent that doesn't exist yet]"** boundary line so future activations don't accidentally apply Georgia/$499/FSBO-seller framing to B2B agentplain prospects. (c) Surface to capability-builder that the FlatSBO/agentplain GTM context-skill boundary is unspecified — agentplain has no equivalent workflow context skill, and the B2B sales department (`flatsbo-b2b-sales-*`) lives in the flatsbo orchestrator memory tree, not as a context-load skill on disk.

**Honesty tag:** **SITE-SILENT** *(FlatSBO-scoped, no agentplain claim depends on me; SKILL contains its own internal stale-state about FlatSBO's AI capability)*

---

### 10. `insights-head-of-department`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** I have fired exactly once. The single own-author entry is at `fleet_activity_log.md:731` — *"2026-05-02 10:01 — insights-head-of-department [product:flatsbo]"*. On that firing I produced three artifacts at the memory ROOT (not in the SKILL-specified `agent-state/insights/` subdirectory): `insights_department_charter_2026-05-01.md`, `insights_icp_survey_v0_2026-05-02.md`, `insights_nsm_working_doc_v0_2026-05-02.md`. **The SKILL-named V0 capability-building files I'm supposed to own** — `agent-state/insights/methodology_library.md`, `agent-state/insights/data_source_map.md`, `agent-state/insights/department_questions.md`, `agent-state/insights/cross_cutting_decisions.md` (SKILL lines 68-77) — **do not exist on disk** (the `agent-state/insights/` subdirectory itself doesn't exist; `ls agent-state/ | grep insights` returns nothing). No recommendations inbox. No daily-loop directory.

**What the site says I do:** Site silent. The Insights department surfaces nothing customer-facing — its scope is internal coordination, methodology library, NSM selection, agent-quality measurement boundary with capability-builder. The about-page "we measure what matters" framing is absent; the site does not reference an internal analytics capability at all.

**The gap:** One-shot 25 days stale. The V0 capability-building rubric in the SKILL (the gate for Phase 1 transition) requires all six sub-agents' methodology files + my four shared files + the cross-cutting decisions log + a sub-agent activity review — none of which has progressed since 2026-05-02. The two cross-cutting decisions the SKILL highlights as the head-convenes-the-team work (NSM selection at line 84, capability-builder boundary at line 98) are partially started (the NSM working doc exists at memory root, the boundary doc is mentioned in `insights-agent-measurement` SKILL §7 as "co-authored with capability-builder via `cross_cutting_decisions.md`" — but that file doesn't exist).

**What I could do with the necessary improvements:** (a) Build the four V0 shared files at `agent-state/insights/` (lazy-create the subdirectory). (b) Co-sign the boundary doc with capability-builder so `insights-agent-measurement` has the formal Outcome-field state machine to operate against — currently capability-builder ships proposals + lazy-creates recommendations inboxes on every agent's behalf, and no one is closing the EvolveR loop with quantitative outcome measurement. (c) Activate the six sub-agents on a first-firing rotation so each builds its own Phase 0 methodology library + data-source map. Today the department is 1/7 active by activation count.

**Honesty tag:** **FIRES-INTERNAL-ONLY** *(one-shot 25 days stale; the V0 capability-building rubric for Phase 1 transition is unmet at every sub-agent layer)*

---

### 11. `insights-adhoc`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. My SKILL at `~/.claude/skills/insights-adhoc/SKILL.md` is 119 lines specifying the 6 V0 Phase-0 capability-building files (`scoping_a_question.md`, `diagnostic_frameworks.md`, `answer_structure.md`, `data_source_navigation.md`, `common_patterns.md`, `anti_patterns.md`). **None of these files exist on disk** — the `agent-state/insights/insights-adhoc/` subdirectory doesn't exist. **Zero own-author fleet-log entries** (the 3 grep mentions are all listings in the head's establishment entry). No recommendations inbox. No daily-loop directory. My SKILL frontmatter says `recommended_model: opus` — Opus-tier diagnostic role with zero activity.

**What the site says I do:** Site silent.

**The gap:** Phase 0 unstarted. None of the diagnostic methodology files exist; without them I have no methodology to apply when Conner asks "why did X drop." The capability is fully unbuilt despite the SKILL providing a 6-file paste-ready blueprint.

**What I could do with the necessary improvements:** (a) Build the six V0 methodology files in one cycle — the SKILL spells out exactly what each contains. (b) Hand off to product-analytics + survey-research + advanced-analytics + market-research per the routing rubric in the SKILL — but those sub-agents are also unactivated, so the routing chain has no destination today. The unblock is sequential: head-of-insights activates → I activate → my routing destinations activate.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; Opus-tier role unbuilt)*

---

### 12. `insights-advanced-analytics`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. SKILL is 122 lines specifying 8 V0 Phase-0 files (forecasting, segmentation, regression_attribution, propensity_scoring, anomaly_detection, data_dependency_thresholds, notebook_templates, model_card_template). **None exist.** No recommendations inbox. No daily-loop. **Zero own-author fleet-log entries.** SKILL frontmatter `recommended_model: opus`. SKILL line 11 self-tags as **"Strictly data-dependent"** — cannot do useful predictive work pre-revenue. Phase 0 deliverable is toolkit-readiness so when data lands I ship within one cycle.

**What the site says I do:** Site silent.

**The gap:** Phase 0 unstarted AND honestly data-dependent. Even if I did build the 8 V0 files today, I couldn't produce useful forecasts (≥12 weekly observations needed), segments (≥200 paying customers needed), conversion models (≥500 conversions needed), LTV models (≥6 months of close data needed), churn models (≥30 churn events needed), or anomaly detection (≥6 weeks of stable baseline needed). None of those thresholds is met today.

**What I could do with the necessary improvements:** (a) Build the 8 V0 methodology files now — even pre-data, the toolkit + thresholds + notebook scaffolds let me ship within one cycle of the first paying customer cohort crossing threshold. (b) Wire the data-dependency-thresholds file as the load-bearing gate that protects against premature modeling — that's the single most important file to ship first, because it stops every other insights sub-agent from asking me for predictions on insufficient data.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; honestly data-dependent; even toolkit-readiness phase unbuilt)*

---

### 13. `insights-agent-measurement`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. SKILL is 153 lines specifying 7 V0 Phase-0 files (agent_eval_frameworks, telemetry_schema, drift_detection, the_metrics_that_matter, data_source_map, v0_fleet_baseline, boundary_with_capability_builder). **None exist.** No recommendations inbox. No daily-loop. **Zero own-author fleet-log entries.** SKILL frontmatter `recommended_model: opus`. The strict capability-builder boundary in SKILL §"Strict collaboration boundary" (lines 14-22) defines a formal Outcome-field state machine (`PENDING → ADOPTED-AND-WORKED | ADOPTED-BUT-FLAT | ADOPTED-BUT-REGRESSED | DECLINED | STALLED-NO-DECISION-14D`) — that state machine has never been authored at `boundary_with_capability_builder.md` on disk.

**What the site says I do:** Site silent.

**The gap:** Phase 0 unstarted, AND the EvolveR feedback loop the SKILL exists to close runs unmeasured. Capability-builder fires daily, lazy-creates recommendations files on every agent's behalf (5 lazy-creates in the build-pod cohort alone; predicted 7th this week), authors voice blocks in every silent agent's voice. No one measures whether those proposals worked. The `capability_principles.md` scoring rule (`s(p) = (csucc + 1) / (cuse + 2)`) is jointly understood — capability-builder uses it to gate proposals; I'm supposed to update it from observed outcomes; I don't, because I haven't fired.

**What I could do with the necessary improvements:** (a) Co-sign the boundary doc with capability-builder + head-of-insights — the single highest-leverage move because every other insights sub-agent waits on the boundary being formal. (b) Compute the V0 fleet baseline from existing logs (no new instrumentation needed — the SKILL §"Phase 0" item 5 spells out the data sources, all of which are on-disk today). (c) Ship the first monthly fleet-quality report — even if data-thin, it's a one-pager Conner reads in two minutes and it starts the drift-detection clock.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; the EvolveR feedback loop runs unmeasured at the very moment capability-builder is producing the largest volume of proposals across the fleet)*

---

### 14. `insights-product-analytics`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. SKILL is 117 lines specifying 9 V0 Phase-0 files (funnel_analysis, cohort_retention, feature_engagement, north_star_scoring, flatsbo_wizard_funnel, flatsbo_signup_funnel, flatsbo_buyer_funnel, b2b_funnels_planned, instrumentation_gaps). **None exist.** No recommendations inbox. No daily-loop. **Zero own-author fleet-log entries.** SKILL frontmatter `recommended_model: sonnet`.

**What the site says I do:** Site silent.

**The gap:** Phase 0 unstarted. The three FlatSBO funnel reference files the SKILL names (wizard, signup, buyer) would be the right starting point — they're DATA-DEPENDENT only in the sense that the drop-off-rate column is empty pre-traffic; the funnel-structure mapping itself + the instrumentation-gap list is buildable today. The `instrumentation_gaps.md` file is load-bearing per CEO #12's leading-indicator ask (per the head-of-insights routing rubric) — it's the input that tells `flatsbo-tech-lead` what to instrument next.

**What I could do with the necessary improvements:** (a) Build the 4 methodology files + 3 FlatSBO funnel reference files in one cycle — the SKILL specifies exact step-mapping for the wizard funnel against Prisma + UI events. (b) File the instrumentation-gap list to `flatsbo-tech-lead` — this is the load-bearing handoff that lets the leading-indicator scoreboard exist downstream.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; the load-bearing instrumentation-gap handoff to tech-lead has never been filed)*

---

### 15. `insights-reporting`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only. SKILL is 106 lines specifying 7 V0 Phase-0 files (kpi_selection, leading_vs_lagging, dashboard_layout, variance_attribution, data_source_map, proposed_nsm_candidates, dashboard_v0_mockup). **None exist** under `agent-state/insights/insights-reporting/`. No recommendations inbox. No daily-loop. **Zero own-author fleet-log entries.** SKILL frontmatter `recommended_model: sonnet`. The Phase 0 transition gate (all 7 files + head sign-off + at least one dashboard mockup validated against test-mode-seeded data + cron schedule proposed) is unmet at every checkpoint.

**What the site says I do:** Site silent.

**The gap:** Phase 0 unstarted. The NSM working doc that exists at memory root (`insights_nsm_working_doc_v0_2026-05-02.md`) was authored by head-of-insights, not by me. The SKILL says my `proposed_nsm_candidates.md` deliverable is convened with head + product-analytics + survey-research before locking — the convene has never happened because the other sub-agents are unactivated.

**What I could do with the necessary improvements:** (a) Build the 7 V0 methodology files + a markdown dashboard mockup (V0 in markdown is the SKILL spec — production wiring needs tech-lead). (b) Convene with head + product-analytics + survey-research on NSM lock. (c) Surface the Plausible / Vercel Analytics / Stripe-events instrumentation gaps to tech-lead.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; NSM convene blocked on sibling sub-agent activation)*

---

### 16. `insights-survey-research`  (tier · fires: on-prompt · installed: yes)

**What I can do today (verified):** Charter only — with one twist. SKILL is 122 lines specifying 8 V0 Phase-0 files. **None of the 6 methodology files exist** at `agent-state/insights/insights-survey-research/methodologies/`. **The v0 FlatSBO ICP validation survey DOES exist** — at `~/.claude/projects/C--flatsbo/memory/insights_icp_survey_v0_2026-05-02.md` — but it was authored by `insights-head-of-department` on 2026-05-02 (the head's single fleet-log entry references *"first usable survey for ICP validation"*), not by me. I have no fleet-log entries of my own. No recommendations inbox. No daily-loop. SKILL frontmatter `recommended_model: opus`. **SKILL line 13 self-flags as "the highest pre-revenue-value sub-agent in the department"** — and the agent with that designation has produced zero on-disk artifacts in its own name.

**What the site says I do:** Site silent.

**The gap:** The SKILL's own framing — "the only insights sub-agent that produces useful output today, because surveys + interviews don't require historical product data" — makes my dormancy the largest single missed-opportunity in the insights cohort. The head wrote a v0 survey on my behalf 25 days ago; nothing has happened since. The 8 V0 deliverables include the JTBD interview guide for B2B brokerage-owner ICP validation (line 43, n=5–8 per cohort, ~45-minute switch-interview methodology) — which is exactly the instrument the `b2b-head-of-realty` pilot pursuit needs to score 5-criterion gate item #1 ("≥3 design partners ACTIVE >90 days at any paid tier").

**What I could do with the necessary improvements:** (a) Build the 6 V0 methodology files + ratify the existing v0 FlatSBO ICP survey + ship the B2B brokerage-owner JTBD interview guide. (b) Field-test the FlatSBO survey at n=10 before broad send. (c) Coordinate with `flatsbo-b2b-sales-research` per the SKILL's prospect-identification handoff for the B2B interview cohort. The unblock here is highest-leverage in the insights cohort because surveys/interviews produce data from scratch — no other sub-agent has that property pre-revenue.

**Honesty tag:** **CHARTER-ONLY** *(Phase 0 unstarted; the agent the SKILL self-designates as highest pre-revenue value has produced nothing in its own name; v0 ICP survey was authored by head-of-insights on this agent's behalf, not by this agent)*

---

## Cross-agent observations

1. **The "3 + 13" pattern.** Of the 16 agents, exactly 3 have ever fired and logged a completion entry under their own name in `fleet_activity_log.md` (b2b-client-service-director once, insights-head-of-department once, platform-eng ten times). The other 13 have zero own-author entries. All three of the firing agents fired in a 3-day window between 2026-05-01 and 2026-05-03; **no agent in this cohort has logged a completion entry under its own name in the 24 days since 2026-05-03**.

2. **The capability-builder-as-stand-in pattern.** Of the 13 agents with zero own-author entries, 6 have recommendations inboxes created by capability-builder on their behalf during the deep-dive-on-rotation cycle (b2b-ceo / b2b-client-service-director / b2b-eng-tech-lead / b2b-eng-backend / b2b-eng-frontend / platform-eng). The voice blocks in those inboxes are written in each silent agent's voice by capability-builder. The b2b-eng-frontend voice block says verbatim *"I have never fired"* (2026-05-22); the b2b-eng-backend voice block says verbatim *"I have no daily-loop entries, no fleet-activity entries since pod stand-up 2026-04-28"* (2026-05-27). The agent designated to MEASURE whether those capability-builder proposals work (insights-agent-measurement) has itself never fired — the EvolveR feedback loop runs unmeasured at the very moment capability-builder is producing the largest volume of proposals across the fleet.

3. **The ghost-repo SKILL drift.** The 4 b2b-eng agents (tech-lead + backend + frontend + integrations) all point their SKILL at `C:\b2b\` and at `~/.claude/projects/C--b2b/memory/b2b_eng_pod/`. The canonical repo is `C:\agentplain\` (30+ API routes, 18 Prisma migrations between 2026-05-08 and 2026-05-26, 9-vertical scope, workspace-RLS-on-shared-DB, MCP-first integration migration locked 2026-05-12, passkey auth, Stripe per-seat ladder, Inngest renewal sweep, knowledge substrate pgvector). The SKILL drift is mechanical: every activation of any of the 4 agents that follows the SKILL goes to a near-empty repo (`C:\b2b\` has one encryption primitive + tests) and a stale memory tree (last meaningful `recent_decisions.md` entry 2026-04-28).

4. **The dogfood overclaim.** The about-page assertion *"agentplain itself is built BY the same fleet model we sell. The service team — the same shape we sell to customers — proposes capabilities, decomposes them into work, runs the tests, decides what's ready to ship, and surfaces the calls that need a human"* (`app/(marketing)/about/page.tsx:118-125`) names 4 verbs (proposes / decomposes / runs tests / decides ready to ship). The current verifiable record: **proposes** = capability-builder (Part 1's territory, not this cohort), **decomposes** = silent (b2b-eng-tech-lead never fired), **runs tests** = silent (b2b-eng-qa never fired), **decides ready to ship** = silent (b2b-ceo zero own-author entries; b2b-client-service-director one entry 25 days ago). The dogfood claim is aspirational at the b2b layer; the verifiable record is that Conner + capability-builder are doing the work the dogfood claim attributes to the named org agents.

5. **The "~35 cron-fired agents" brag and what it actually means.** The about-page line at `:99-106` says *"The brokerage in production today is ~35 cron-fired agents covering lead intake, listing coordination, contracts, CRM hygiene, recruiting, and production reporting."* That count refers to FlatSBO consumer fleet (Part 4/5 territory), not the agentplain B2B fleet. Of the 16 agents in THIS cohort, only 4 have GHA cron workflows on disk (b2b-ceo, b2b-client-service-director, b2b-eng-tech-lead, platform-eng) — and all 4 are gated by repo var `USE_GHA_CRON == 'true'` whose state isn't inspectable from this audit; the absence of own-author fleet-log entries since 2026-05-03 is consistent with the gate being off. The "~35 cron-fired agents" claim is FlatSBO-side scaffolding; readers who infer that agentplain B2B has the same active-cron headcount would be wrong.

6. **The insights department is the largest unbuilt surface.** 7 of the 16 agents (44%) are the insights department; 1 of those 7 has fired once. The 6 sub-agents specify 40 V0 Phase-0 capability-building files total across their SKILLs; **0 of the 40 exist on disk**. The agent designated by its own SKILL as "the highest pre-revenue-value sub-agent in the department" (insights-survey-research) has produced nothing in its own name despite being the only one of the 6 that doesn't need data to be useful. The boundary doc with capability-builder is unsigned, leaving capability-builder unmeasured at the very moment it's producing the largest proposal volume.

7. **The one safety-critical contract that hasn't been verified.** `b2b-eng-qa`'s live-fixture protocol — sandbox-only credentials in `.env.test.live`, hardcoded test-account allowlist guard, `LIVE_FIXTURE_ENABLED` env flag — is the contract that prevents an integration test from ever hitting a customer's real OAuth-connected account. The agent that owns it has never fired. None of the protocol's files exist on disk. The day the first design-partner customer OAuth-connects a live Gmail / Outlook / EZLynx account, the safety surface that catches "a test accidentally ran against the customer's real mailbox" is unverified.

---

## Headline

**3 of 16 fire (b2b-client-service-director once, insights-head-of-department once, platform-eng ten times in a 3-day burst) — and all 3 have been dormant for 24+ days; 13 of 16 are CHARTER-ONLY with zero own-author fleet-log entries despite installed SKILL.md files.** Zero of 16 produce customer-facing output; the entire cohort scope is internal planning, internal eng, internal measurement, internal coordination. The about-page dogfood claim — *"agentplain itself is built BY the same fleet model we sell ... The service team proposes capabilities, decomposes them into work, runs the tests, decides what's ready to ship"* (`app/(marketing)/about/page.tsx:118-125`) — names 4 verbs whose verifiable execution is: proposes = `flatsbo-capability-builder` (different cohort), decomposes = silent, runs tests = silent, decides what's ready to ship = silent. The "fleet runs it / your AI ops team" framing is the right aspiration; the activity record for the b2b org agents that would back it is 24 days stale, and the insights department that would close the EvolveR loop by measuring whether the dogfood is actually working has 0 of 40 specified V0 files on disk.
