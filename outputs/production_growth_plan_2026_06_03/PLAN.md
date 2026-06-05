# agentplain — Production & Growth Optimization Roadmap

**Dispatch:** Conner, 2026-06-03 — *"create a plan for production and growth that optimizes as best as we can."*
**Authored:** 2026-06-05 (date per session `currentDate`).
**Scope:** strategic plan only. **No production code was modified.** Read-only across `C:\agentplain`; the deliverable is this doc (`feedback_persistence_discipline` — the doc is the artifact, decision-first not "we should think about this").
**Citation discipline:** every cost figure, model assignment, cron cadence, and env requirement cites a `file:line`, a vendor doc with read-date, or is explicitly tagged **[LABELED ASSUMPTION]** / **[VERIFY]** where no on-disk artifact backs it (`feedback_no_guesses_no_estimates`).

---

## Provenance note — referenced memory files that do not exist in this snapshot

The dispatch named twelve memory files to anchor scope. Verified by `ls C:\Users\conne\.claude\projects\C--agentplain\memory\` (2026-06-05), **the following are absent**:

`reference_self_serve_readiness_2026_05_27.md`, `project_api_cost_control_2026_05_31.md`, `feedback_long_task_performance_2026_05_31.md`, `project_self_serve_no_bottleneck.md`, `project_mcp_first_integration_architecture.md`, `project_hierarchical_approval_chain.md`, `feedback_max_friction_reduction_for_trials.md`, `project_pricing_value_anchor.md`, `feedback_no_pilot_deferral.md`, `feedback_persistence_discipline.md`, `project_service_partnership_positioning.md`, `project_flatsbo_state_portability.md`.

The same gap was independently flagged by the model-routing audit (`outputs/model_routing_audit_2026_06_03/AUDIT.md`, "Gaps found": three of these confirmed missing by its own `ls`). **This plan is therefore grounded in the codebase (the harder source of truth) plus the memory files that do exist** — the self-serve readiness audit survives as an in-repo doc (`docs/self-serve-readiness-2026-05-27.md`), the pricing model survives in `project_stripe_both_surfaces.md`, the routing audit survives in-repo. **Action for Conner:** the cost-control and service-partnership memories should be (re)written so this plan's calibration is captured durably; I have not invented their contents.

---

## The shape of the problem (executive summary)

agentplain is **code-ready, not config-live.** The self-serve audit (`docs/self-serve-readiness-2026-05-27.md`) proves the value loop runs end-to-end in code — signup, OAuth connect, the read→categorize→coordinate→schedule→draft chain, billing — and that the only thing between "code-ready" and "a real customer operates with zero agentplain human in the loop" is **a list of ~10 production secrets Conner alone can set** (`docs/runbooks/go-live-prod-credentials.md`).

That reframes the whole plan. Pre-launch hardening is **not** "build the product" — the product is built. It is: (1) flip the config, (2) close three genuine correctness/safety gaps the audit surfaced (audit-log immutability, a backup-restore drill, a key-loss recovery drill), (3) install the unit-economics governor before volume arrives, and (4) sequence the model-routing rebalance that turns a near-break-even cost structure into a 70%+ gross-margin one.

The single highest-leverage finding in this document: **at today's post-wave-8 model mix, a heavy single-seat workspace costs ~$162–279/mo in Anthropic tokens (§2) against a $99–199/mo Regular subscription — i.e. we are at or below break-even on our heaviest customers before the routing fix.** The 2026-06-03 routing audit (already authored, on branch `audit/model-routing-token-shortage-2026-06-03`) is therefore not a cost-control nicety; **it is the difference between a viable and an unviable unit economics.** It is the #1 pre-revenue priority alongside the config flip.

This plan preserves the **service-partnership** posture throughout: even at 10,000 customers the operator-in-the-loop stays where it matters (compliance escalation, support exceptions, high-stakes verticals). The scaling work is about removing the operator from *routine* paths, never from *judgment* paths.

---

## Section 1 — Pre-launch hardening (must-be-true before customer 1)

Baseline: the per-link verdict table in `docs/self-serve-readiness-2026-05-27.md`. That audit covered the **happy path** at single-customer scale. Below I keep its findings and add the gaps it explicitly did *not* cover (it states so in "What this audit deliberately did NOT verify," lines 81–92) plus the at-scale concerns the dispatch named.

### 1.0 — The config flip (the audit's load-bearing unlock)

| Item | Owner | Effort | Blocker risk if shipped without it |
|---|---|---|---|
| `ENCRYPTION_KEY`, `DATABASE_URL(+_DIRECT)`, `SESSION_PASSWORD`, `RESEND_API_KEY` | **Conner-only** | minutes (set in Vercel Production) | App won't boot / signup can't issue magic links (`docs/runbooks/go-live-prod-credentials.md` §0) |
| `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` | **Conner-only** | minutes + register app at `/api/inngest` | Loop stops at "WebhookEvent persisted, never processed" (`lib/env.ts:138-139`; runbook §1) |
| `ANTHROPIC_API_KEY` | **Conner-only** | minutes | Loop falls back to heuristic `TestLlmProvider`; drafts unusable (`lib/llm/index.ts:45`; runbook §2). **Must be set before customer 1.** |
| Google + Microsoft OAuth + Pub/Sub/Graph webhook secrets | **Conner-only** | ~1–2 hrs/provider in vendor console | No live integrations; value loop has nothing to read (`lib/env.ts:168-189`; runbook §3–4) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, then `npx tsx scripts/stripe/setup-products.ts` | **Conner-only** | ~30 min | No real-card billing; first charge can never land (runbook §5) |
| `SENTRY_DSN` | **Conner-only** | minutes | Cron failures invisible — `observabilityProvider()` falls to noop (`lib/env.ts:286-296`). **Strongly recommended before customer 1, not optional in practice.** |

**Decision:** Items 1–6 of the runbook's order-of-operations are **Week 1, non-negotiable, Conner-only.** There is no fleet work that can substitute. The runbook is copy-paste ready; the only risk is vendor-console drift (flagged `[VERIFY]` in the runbook itself).

### 1.1 — Encryption-at-rest verification

**Status: SHIPPED, with one missing operational drill.** `lib/security/encryption.ts` is AES-256-GCM, 64-char-hex key, versioned `v1:iv:tag:ciphertext` format (`encryption.ts:8-12, 73-93`). Keys are **per-environment** (runbook §"Vercel env-tier discipline": "`ENCRYPTION_KEY` is different per env"). Key rotation is **already a built tool** — `lib/security/rotate-keys.ts` re-encrypts every credential from `ENCRYPTION_KEY_OLD` → `ENCRYPTION_KEY_NEW` (`rotate-keys.ts:24-30`), and the versioned format means a future `v2` envelope migration is clean. Graceful degradation on missing key is wired (`isEncryptionConfigured`, `encryption.ts:64-67`).

- **Gap:** "key loss = controlled migration not disaster" is *codeably* true but has **never been drilled.** There is no evidence a rotation has been run against a populated prod-shaped table, and no documented key-backup location.
- **Owner / effort:** **Both.** Fleet writes a key-rotation drill script + runbook entry (extends `rotate-keys.ts` with a dry-run reporter against a restored DB snapshot); Conner stores `ENCRYPTION_KEY` in a real secret manager (1Password/Vault) with a documented recovery path.
- **Blocker risk if skipped:** a fat-fingered key rotation with no drill = every customer's OAuth tokens become permanently unreadable, every integration silently breaks, and recovery is manual re-consent across the whole customer base. This is a **business-ending class of incident** at any real customer count. Drill it before customer 1.

### 1.2 — RLS policies

**Status: STRONG.** Migrations enable RLS on **32 tables**, with **35 `FORCE ROW LEVEL SECURITY`** statements and **43 `CREATE POLICY`** statements (counted across `prisma/migrations/*/migration.sql`, 2026-06-05). Two dedicated hardening migrations exist: `20260526000000_add_integration_rls` and `20260526000001_force_rls`. The GUC wrapper sets `app.user_id` / `app.workspace_id` / `app.is_operator` per-transaction with the `true` (transaction-scoped) flag so a pooled connection cannot leak workspace context to the next request (`lib/db/rls.ts:43-58`).

- **Gap (at scale):** there is no **automated test that asserts every workspace-scoped table has a policy.** Today it's verified by reading migrations. As new tables land (the schema already has ~40 models), a future migration can add a customer-data table and forget the policy — silent cross-tenant leak.
- **Owner / effort:** **Fleet-buildable**, small. Add a CI test that introspects `pg_policies` against a list of every table carrying a `workspaceId` column and fails if any lacks a `FORCE`d policy. This makes the invariant a gate, not a convention.
- **Blocker risk if skipped:** a single un-policied customer-data table is a cross-tenant data breach — the worst incident class for a multi-tenant product handling email. Ship the CI gate before opening self-serve signup to strangers (vs. the controlled pilot cohort).

### 1.3 — Audit-log immutability

**Status: GAP — append-only is convention, not enforced.** The `AuditLog` model has no update/delete protection (`prisma/schema.prisma:849-865`); the phase-1 migration explicitly notes "append-only **by convention**; no UPDATE / DELETE triggers in V1" (`prisma/migrations/20260508000000_phase1_init/migration.sql:91`). `PreferenceSignal` carries the same "append-only audit log" comment with no DB enforcement (`20260523000000.../migration.sql:11`).

- **Decision:** enforce append-only **at the database level** before any compliance-sensitive vertical (law, RIA, insurance) goes live. Add a migration that (a) `REVOKE UPDATE, DELETE ON "AuditLog" FROM` the application role, and (b) a `BEFORE UPDATE OR DELETE` trigger that raises an exception. This is the standard Postgres pattern and survives an app-layer bug or a compromised app credential.
- **Owner / effort:** **Fleet-buildable**, one migration + one test.
- **Blocker risk if skipped:** an audit log that the app role can rewrite is not an audit log a regulator or a customer's counsel will accept. For the no-outbound compliance story (`project_no_outbound_architecture.md` — liability transfers to the customer *because we keep a faithful record of what we drafted and when*), a mutable audit log undercuts the entire posture. Fix before law/RIA verticals; strongly recommended before customer 1.

### 1.4 — Backup + restore drill

**Status: UNVERIFIED — no evidence a restore has ever happened.** Neon provides point-in-time restore on paid tiers (`[VERIFY against current Neon plan]`), but the audit, the incident log (`docs/incident-log.md` — two entries, both build/runtime, none about data), and the runbooks contain **no record of a test restore.**

- **Decision:** run a real restore drill against a throwaway Neon branch before customer 1, and document the RPO/RTO it actually achieves (not the vendor's marketing number). Schedule it quarterly thereafter.
- **Owner / effort:** **Both.** Conner triggers the Neon restore (account-level); fleet writes the verification script that diffs row counts + spot-checks decryptability of restored credentials (ties to §1.1 — a restore is only good if the `ENCRYPTION_KEY` that matches the restored ciphertext is also recoverable).
- **Blocker risk if skipped:** "we have backups" is worthless until proven restorable. The combination of an un-drilled restore *and* an un-drilled key rotation (§1.1) means a bad day has no recovery path. This pair is the highest-stakes gap in Section 1.

### 1.5 — Incident-response runbook

**Status: PARTIAL.** A genuine incident log exists with real forensic discipline (`docs/incident-log.md` — verbatim log evidence, root cause, fix, monitoring-gap-to-close for each). Sentry is wired (`chore/runtime-alerting-2026-05-18`, `instrumentation.ts` `onRequestError`). A go-live runbook exists. **What does not exist:** a *response* runbook — severity definitions, who-does-what, customer-comms templates, escalation timing.

- **Decision:** write the incident-response runbook now (Section 9 below is its first draft — the failure-mode catalog *is* the spine of the runbook). "First-1000 customers can't wait 24h" (dispatch) means we need a defined first-response SLA *to ourselves* before we promise one to customers.
- **Owner / effort:** **Both.** Fleet drafts from Section 9; Conner sets the severity thresholds and the customer-facing response-time commitment.
- **Blocker risk if skipped:** the first real outage becomes an improvised scramble while customers' inboxes silently stop being processed. The product's value is invisible-until-broken; a broken loop with no comms reads as abandonment.

### 1.6 — Compliance-corpus draft-vs-counsel labeling

**Status: GAP per the standing constraint.** Counsel has not returned on most verticals (`project_agentplain_mission_and_positioning.md` Q6 — "when counsel returns, name them publicly"). The risk: an unbadged compliance rule reads as legal advice we're not licensed to give.

- **Decision:** every per-vertical compliance rule must carry an explicit badge — `DRAFT (not counsel-reviewed)` vs `COUNSEL-REVIEWED <firm>, <date>` — rendered on every customer-facing surface that shows a compliance flag (the `ComplianceFlag` model, `schema.prisma:789`). Default badge is `DRAFT`. Until a vertical's corpus is counsel-reviewed, its compliance flags say so.
- **Owner / effort:** **Both.** Fleet adds the badge field + render; Conner drives counsel. Per `feedback_no_new_verticals_finish_locked`, this is finishing locked verticals, not opening new ones.
- **Blocker risk if skipped:** unlicensed-practice-of-law exposure for the law/RIA verticals, and a credibility hit for all of them. This gates the *claim* "compliance-first" (Q4), not the product mechanics — but the claim is load-bearing for the brand.

### 1.7 — Vendor SLAs

**Status: NOT ESTABLISHED.** I have not read the contractual SLAs for Anthropic, Neon, Inngest, or Vercel — and per `feedback_no_guesses_no_estimates` I will not assert percentages I can't cite. What I *can* state from the code: the product hard-depends on Anthropic (every draft), Neon (all state), Inngest (the */5 drain cron — without it the loop stops), and Vercel (hosting).

- **Decision:** before committing a customer-facing SLA, **obtain and file** each vendor's contractual uptime number `[VERIFY: pull from current vendor agreement, date it]`, then commit a customer-facing number that is *strictly below* the weakest dependency's number (you cannot promise more uptime than your least-reliable critical vendor). Given the dependency chain, the honest customer-facing commitment at launch is **"best-effort, no contractual SLA"** until we're on paid/enterprise tiers of all four with real numbers — which aligns with the service-partnership framing (we operate the service; we don't sell five-nines infrastructure).
- **Owner / effort:** **Conner-only** (contracts), with fleet maintaining a `docs/vendor-slas.md` register.
- **Blocker risk if skipped:** promising "99.9%" with no contractual backing is a commitment we can't keep and a liability if breached. Under-promise until the contracts exist.

**Section 1 verdict:** the product is shippable to customer 1 after the config flip (1.0) + three drills/gates that are days of work, not weeks: audit-log immutability (1.3), the backup-restore + key-rotation paired drill (1.1 + 1.4), and the RLS coverage CI gate (1.2). Nothing here is punted to "post-launch" (`feedback_no_pilot_deferral`, per the dispatch constraint).

---

## Section 2 — Per-customer cost ceiling (unit economics)

**Rates (FACT):** Anthropic list pricing, per `lib/billing/usage/pricing.ts:66-85` (cached source `https://www.anthropic.com/pricing`, read 2026-05-28), per million tokens:

| Tier | Input $/M | Output $/M | Cache-write $/M | Cache-read $/M |
|---|---|---|---|---|
| Opus 4.x | 15 | 75 | 18.75 | 1.50 |
| Sonnet 4.x | 3 | 15 | 3.75 | 0.30 |
| Haiku 4.5 | 1 | 5 | 1.25 | 0.10 |

**The cost substrate already exists.** Every `complete()` call writes an `LlmUsageRecord` row with token counts, computed `costMicroCents`, and a `sourceSurface` tag (`lib/billing/usage/recorder.ts:62-101`; model `schema.prisma:1658-1681`, indexed for window aggregation). **We are not flying blind — we have per-call telemetry; we just haven't queried it into a budget governor yet** (the routing audit confirms this gap: "`LlmUsageRecord` exists in DB but is not queried").

### The per-workspace cost model

**[LABELED ASSUMPTION]** — no per-call-site telemetry split has been pulled yet (the audit confirms `LlmUsageRecord` is unqueried), so call *sizes* and per-workspace *volumes* below are stated assumptions, anchored to the routing audit's own representative sizes (`outputs/model_routing_audit_2026_06_03/AUDIT.md` §5: customer draft ≈ 4,000 in + 600 out; scheduler refine ≈ 2,000 in + 300 out) and to **cited cron cadences** (facts). The **ratios** (Opus→Sonnet −80%, Sonnet→Haiku −67%) are exact and source-backed; the absolute dollars move with real volume. Wave B (§11) replaces these with queried numbers.

**Per value-loop unit cost** (one inbound email → categorize + coordinate + schedule + draft):

| Stage | Model (current) | in/out tokens | $/call current | $/call ideal (post-audit) |
|---|---|---|---|---|
| categorize | Haiku → Haiku | 1500 / 100 | 0.0020 | 0.0020 |
| coordinate | Sonnet → Sonnet | 3000 / 300 | 0.0135 | 0.0135 |
| schedule | Sonnet → Sonnet | 2000 / 200 | 0.0090 | 0.0090 |
| **draft** | **Opus → Sonnet** | 4000 / 600 | **0.1050** | **0.0210** |
| **per-loop total** | | | **$0.1295** | **$0.0455** |

**Fixed monthly overhead per active workspace** (crons + interactive, cadences cited from `lib/inngest/functions/*`):

| Surface | Cadence (fact) | calls/mo | Model current→ideal | $/mo current | $/mo ideal |
|---|---|---|---|---|---|
| scheduler-sweep refine | `*/15` (96/day) | 2,880 | Sonnet→**Haiku** | 30.24 | 10.08 |
| pulses (briefing/compliance/4 weekly) | daily+weekly @ 13:00 UTC | ~68 | Opus→**Sonnet** | 13.77 | 2.75 |
| /talk dispatcher | interactive | ~100 | Haiku→Haiku | 0.55 | 0.55 |
| support-handler | event | ~10 | Opus→**Sonnet** | 0.90 | 0.18 |
| **fixed total** | | | | **$45.46** | **$13.56** |

**Monthly token cost per active workspace = fixed + (loops/mo × per-loop):**

| Workspace profile | loops/mo | **Current mix** | **Ideal mix (post-audit)** | Δ |
|---|---|---|---|---|
| Light (10 actionable emails/day) | 300 | **$84.31** | **$27.21** | −68% |
| Medium (30/day) | 900 | **$162.01** | **$54.51** | −66% |
| Heavy (60/day) | 1,800 | **$278.56** | **$95.46** | −66% |

### Gross margin per seat (the headline)

Against the Regular ladder ($199 solo → $99 at 50–99 seats; `project_stripe_both_surfaces.md`) and Partner ($199–299, schema-confirmed via runbook §5 "3 Products: Regular / Partner / Max"). Gross margin = (price − token cost) / price (Stripe ~2.9% fee noted separately):

| | $199/seat | $149/seat | $99/seat |
|---|---|---|---|
| Light, **ideal** | 86% | 82% | **73%** |
| Medium, **ideal** | 73% | 63% | **45%** ⚠ |
| Heavy, **ideal** | 52% | 36% | **4%** 🔴 |
| Medium, **current mix** | 19% ⚠ | −9% 🔴 | −64% 🔴 |
| Heavy, **current mix** | −40% 🔴 | −87% 🔴 | −181% 🔴 |

**The findings that change decisions:**

1. **At the current (post-wave-8) mix we lose money on every medium-or-heavier workspace below the $199 band.** Wave-8 deliberately drove cost up ("API usage will remain a very small impact on margin" — `docs/skill-model-routing-2026-05-29.md:5`). That premise is false at the $99–149 volume bands. The routing audit (§3) is the fix and it is **pre-revenue-critical.**
2. **Even at the ideal mix, the $99 floor + heavy usage = 4% margin.** The per-seat price floor and the per-workspace token budget are coupled. **Decision:** the $99 band must carry a token budget (below) or it is a margin trap for power users.

### Break-even token budget per workspace

At a **70% gross-margin target** (a reasonable SaaS COGS line; the only non-cited number, stated as a target not a fact), the monthly token-cost ceiling per seat is **30% of MRR minus other COGS**:

| Band | MRR/seat | 70%-margin token ceiling | Ideal-mix profile that hits it |
|---|---|---|---|
| $199 | $199 | ~$60/mo | Heavy (~$95) **exceeds** → review |
| $149 | $149 | ~$45/mo | Medium (~$55) **exceeds** → review |
| $99 | $99 | ~$30/mo | Light (~$27) fits; Medium (~$55) **exceeds** → review |

### Recommended in-product token-budget alarm (operator-facing)

**Decision:** build a budget governor on top of the existing `LlmUsageRecord` substrate — **no new schema needed** (the records, cost, surface, and window index all exist, `schema.prisma:1658-1681`).

- **Alarm rule:** flag any workspace whose **trailing-30-day `SUM(costMicroCents)` exceeds 30% of its current MRR** (resolved from `Subscription`, `schema.prisma:562`). Surface on `/operator/fleet` as a "cost review" chip, **operator-facing only** — never shown to the customer (`project_no_outbound_architecture` keeps us advisory; a customer-facing "you're expensive" message is off-brand and off-strategy).
- **Implementation outline** (propose, don't build): `lib/llm/budget.ts` (does not exist today — confirmed by `ls`) exporting `workspaceTokenSpend(workspaceId, windowDays)` → queries the existing index; `workspaceBudgetStatus(workspaceId)` → compares to MRR-derived ceiling, returns `OK | WATCH (80%) | OVER`. Wire into the operator fleet board and the daily ops digest. A second function, `skillSpendBreakdown(workspaceId)`, groups by `sourceSurface` so the operator sees *which* skill is hot (the routing audit's missing dashboard).
- **Why operator-facing:** the service-partnership model means the *operator* decides "this workspace should move to Partner tier / get a per-skill Opus→Sonnet override / is a Custom candidate." The alarm is a coordination signal to the human partner, consistent with `feedback_integration_acceptance_is_functional` (the human stays in the loop where judgment lives).

---

## Section 3 — Model routing as the primary scaling lever

**The audit landed.** `outputs/model_routing_audit_2026_06_03/AUDIT.md` exists on branch `audit/model-routing-token-shortage-2026-06-03` (217 lines, verified via `git show`). Wave-8's per-call `model:` overrides are **fully landed and verified live in code** (audit §1 reads each call site's actual model). This section summarizes the audit's decisions; it is the steering wheel for the whole cost story.

### Top 5 recommendations (with impact)

1. **`draft.ts` Opus → Sonnet** (`lib/skills/draft.ts:63`). The single highest-volume customer-facing surface — every coordinate→draft chain terminates here. **−80% per call** ($0.105 → $0.021). This one move dominates recoverable spend (it's the per-loop term that swings the whole §2 table). Wave B, A/B-gated. **Keep an Opus override for high-stakes verticals (law, RIA)** via the `SkillConfig` escape hatch (`lib/llm/model-tiers.ts:18-20`).
2. **`chief-of-staff` scheduler refine Sonnet → Haiku** (`lib/skills/chief-of-staff-scheduler/llm-refine.ts:71`). The **hottest LLM cron** — `scheduler-sweep` fires `*/15` (96×/day/workspace, `lib/inngest/functions/scheduler-sweep.ts`). Structured slot ranking, not prose. **−67% on the highest-frequency site.** Wave A.
3. **The four daily/weekly pulse crons Opus → Sonnet** (`analytics-weekly-pulse`, `finance-pulse`, `content-calendar`, `briefing-generator`). Synthesis over already-structured metrics, not multi-constraint reasoning. **−80% each** on the recurring batch surface. Wave B.
4. **`support-handler` Opus → Sonnet** (`lib/skills/support-handler/skill.ts:171`) and **`compliance-watch` Opus → Sonnet** (`lib/skills/compliance-watch-general/skill.ts:70`, with a regex pre-filter and Opus escalation only for genuinely-ambiguous flags). **−80% each.**
5. **Memory-extract + inbox-triage refine Sonnet → Haiku** (structured extraction / classification refine). **−67% each.**

**Net result:** Opus call sites drop from **11 → 2** (only `instruction-handler` plan and `research-on-demand` synthesis stay Opus — genuine multi-step planning + cross-document synthesis). Every customer-readable surface keeps a judgment-grade model (Sonnet or Opus); only narrow classification sits on Haiku.

**TPM/cost impact:** the durable, source-backed figures are the ratios (−80% / −67% / −93%). The two structural wins (draft Opus→Sonnet, scheduler-sweep Sonnet→Haiku) are the bulk of recoverable spend because they are the highest-volume sites. At the §2 medium profile this is the −66% that moves a $162/mo workspace to $55/mo.

### The per-surface decision (answering the dispatch's specific asks)

| Surface | Decision | Source |
|---|---|---|
| **Customer-facing chat (`/talk`)** | **Haiku** for the conversational turn (classify-and-draft-reply in one call, `lib/plaino/dispatcher.ts:151`); **Opus** only for the INSTRUCT *plan* it escalates to (`lib/plaino/instruction-handler.ts:247`). Per-vertical tier override (Max/law/RIA → Opus on the reply) via `SkillConfig`. | audit §3 rows 1, 9 |
| **Compliance Sentinel** | **Sonnet**, not Opus (overspec'd today). Keep/strengthen the regex pre-filter; run the flag-or-not judgment pass on Sonnet; escalate only ambiguous items to Opus. A false-negative is a liability event, so **not Haiku** despite the cron frequency. | audit §1b, §3 row 15 |
| **Read/categorize hot loop (`*/5` cron)** | **Haiku** (already correct — `lib/skills/categorize.ts:50`, enum-bound). This is the every-5-min × every-workspace surface; Haiku is mandatory at scale. | audit §3 row 3 |
| **Briefing generation (overnight cron)** | **Sonnet** (down from Opus). Synthesis over structured signals. **Plus** pre-warming (§5) so it batches off-peak, not at the 13:00-UTC stampede. A future Anthropic Batch-API tier (50% off async) is the natural home for this. | audit §3 row 14 |
| **`/talk` real-time, judgment-heavy** | **Sonnet** default; **Opus only for Max-tier** customers via the vertical→tier map the audit recommends building at the skill-construction seam (Wave B). | audit §3, §4 |

**One follow-up the audit flags (not a cost lever):** `MODEL_OPUS='claude-opus-4-7'` (`lib/llm/model-tiers.ts:28`) trails the current latest, Opus 4.8. Opus minor versions are flat-rate (`pricing.ts:73` matches by substring `opus`), so a 4.7→4.8 bump is a **quality/currency** decision, not a savings one — out of scope for the token-shortage rebalance but worth a deliberate bump for the two surviving Opus surfaces.

---

## Section 4 — Scaling tier breakpoints

Per-seat margins below use the §2 **ideal-mix, medium profile** ($54.51/seat/mo token cost) unless noted. Fleet LLM COGS scales linearly with active workspaces at this rate.

### 10 customers (post-pilot)

- Anthropic standard tier, Neon starter, Inngest free/starter, Vercel Pro: **all comfortable.**
- Cost/customer/mo: ~$55 tokens (medium-ideal) → **fleet token COGS ≈ $545/mo.** Negligible.
- Gross margin/seat: **73% at $199, 45% at $99.** Healthy at the anchor price.
- **Top 3 things that break first:** nothing infrastructural. The binding constraint at 10 is **the human operator's attention** — support (link 4 is "NO" in the audit; every request hits a human inbox) and exception-handling. This is the service-partnership tier where the operator-in-the-loop is the product.

### 100 customers (post-launch first quarter)

- **First thing that goes from comfortable to tight:** the **operator's manual sweep loop** and **Inngest step volume.** The `*/5` `process-webhook-event` cron × 100 workspaces, plus `*/15` scheduler-sweep, plus hourly syncs (`0 * * * *` ×4) — Inngest bills by step-run; 100 workspaces' worth of drains + chains will move off the free tier `[VERIFY current Inngest tier limits at read-date]`.
- **First vendor upgrade:** **Inngest paid tier** (step volume) and **Neon paid** (connection count + compute hours; Vercel serverless functions each open a pooled connection — at 100 concurrent the pooler matters).
- **Per-customer cost trajectory:** flat at ~$55/seat token COGS (ideal mix). Fleet token COGS ≈ **$5,450/mo.** Still a rounding error against 100 × $99–199 = $9,900–19,900/mo revenue **only if the routing audit has landed.** At the current mix it would be ~$16k/mo COGS — i.e. break-even — which is why §3 is pre-100-customer-critical.
- **Top 3 architecture changes:** (1) the budget governor (§2) live so cost outliers are visible; (2) per-workspace health board (§10); (3) the fleet-side support handler (audit link 4) so support scales sub-linearly with customers.

### 1000 customers (first-year aspiration)

- **Which vendor needs an enterprise contract first: Anthropic.** Fleet token COGS ≈ **$54,510/mo (~$654k/yr)** at medium-ideal — this is the dominant COGS line and the first place a volume/committed-use contract pays for itself. **Decision:** open the Anthropic enterprise/committed-spend conversation when fleet token spend crosses ~$20k/mo (between 300–400 customers), so the contract is signed before 1000.
- **Per-workspace token budget that keeps margins healthy:** enforce the §2 ceiling — **~$30/mo at the $99 band, ~$60/mo at $199.** Workspaces over budget route to the operator for tier-review or per-skill downgrade. This is the governor doing its job at volume.
- **Database changes:** Neon **read replicas** for the operator analytics / fleet board reads (don't run cohort dashboards against the primary). **Sharding by `workspace_id` is NOT needed at 1000** — Postgres handles this row volume comfortably; the `LlmUsageRecord` table is the only one growing fast (millions of rows) and it's already designed for it (BigInt micro-cents, partial index for the meter sweep, `schema.prisma:1668,1678-1680`). Add table partitioning on `LlmUsageRecord` by month if the meter-sweep scan slows.
- **Inngest concurrency tuning:** the per-function `concurrency: { limit: 5 }` caps (`support-handler-on-create.ts:71`, `instruction-handler-on-create.ts:56`) are per-function global today — at 1000 workspaces a burst can starve. **Decision:** move to **per-workspace concurrency keys** (Inngest supports `concurrency: { key: workspaceId, limit: N }`) so one noisy workspace can't starve the fleet, and raise the global drain concurrency.
- **Top 3 that break first:** (1) Anthropic rate limits (TPM/RPM on standard tier) — the `*/5` drain × 1000 is a TPM spike; (2) Neon connection exhaustion without the pooler tuned; (3) the 13:00-UTC pulse stampede (§5) — 1000 briefings firing in the same minute.

### 10,000 customers (the version where this is a real company)

- **Custom Anthropic contract pricing** is mandatory — fleet token COGS ≈ **$545k/mo (~$6.5M/yr)** at medium-ideal; a committed-use discount of even 20–30% is six-to-seven figures/yr. This is also where the **Batch API** (async, ~50% off) for all overnight pulses/briefings becomes a material line item, and where **prompt caching** (§5) on per-skill system prefixes is no longer optional.
- **Multi-region deployment:** Vercel edge + a multi-region Neon posture for latency and blast-radius isolation `[VERIFY Neon multi-region options at read-date]`.
- **Dedicated infra per major customer cluster:** Custom-tier and large Partner accounts (`project_stripe_both_surfaces` — 100+ seats route to /custom) get isolated DB branches / dedicated capacity.
- **Per-vertical sub-architectures:** the dispatch's own example is right — **a law tier may need its own Anthropic org with a separate compliance posture** (zero-data-retention agreement, separate BAA-equivalent), kept distinct from the general fleet. The portable architecture (`project_living_portable_architecture`) makes this an adapter/config concern, not a rewrite — the `LLMClient` seam already isolates the provider.
- **Top 3 that break first:** (1) Anthropic account-level rate limits without an enterprise capacity commitment; (2) single-region Neon primary as a single point of failure; (3) operator tooling — manual sweeps are impossible; a real NOC + on-call rotation is required (§10).
- **Per-seat margin at 10k:** still ~73%/45% (token COGS is per-workspace-flat) **provided** the enterprise Anthropic discount offsets the loss of the per-customer attention the service-partnership model trades on. The margin risk at 10k is not tokens — it's **human cost** if support/exception handling hasn't been driven down by the fleet-side handlers.

**Cross-tier summary of "what to contract, when":**

| At ~customers | Contract/vendor move | Architecture move |
|---|---|---|
| 100 | Inngest paid, Neon paid | Budget governor live; per-workspace health board |
| 300–400 | **Open Anthropic committed-use conversation** | Per-workspace Inngest concurrency keys; read replica |
| 1000 | Anthropic enterprise tier signed; Vercel Enterprise | `LlmUsageRecord` partitioning; pre-warmed briefings |
| 10,000 | Custom Anthropic pricing + Batch API; multi-region | Per-vertical sub-orgs (law/RIA); NOC tooling |

---

## Section 5 — Caching + performance strategy

| What | Where / mechanism | TTL / budget | Impact | Status |
|---|---|---|---|---|
| **Knowledge-substrate retrievals** | pgvector cosine search; query embedded once via `text-embedding-3-small` (`lib/knowledge/openai-embedding.ts:32`, per audit §1a). **Retrieval makes no Claude call** — only an embed. | Cache the **query embedding** for repeated/similar questions within a workspace (LRU keyed on normalized query text), TTL ~1h. Do **not** upgrade to `-large` (6.5× embed cost for marginal recall — wrong under a token shortage, audit §1a). | Avoids re-embedding repeated questions; small but free. | Embeddings path correct as-is; query-cache is net-new, low priority. |
| **Customer chat history** | Persisted in `ChatThread`/`ChatMessage` (`schema.prisma:1383,1403`). | **Set a per-turn context budget.** Decision: load **last N=20 turns or ~6k tokens, whichever is smaller**, plus a rolling summary for older context, into the dispatcher/instruction-handler prompt. Unbounded history growth is a silent per-turn cost creep as long-lived workspaces accumulate. | Caps the most insidious cost-growth vector (per-turn input tokens rising with tenure). | **Net-new — recommend before 100 customers.** |
| **OAuth token-refresh stampede** | `integration-renewal-sweep` runs `0 */2` (`lib/inngest/functions/integration-renewal-sweep.ts`); credentials refresh when `expiresAt` within 5 min (`schema.prisma:903`). | At 10k customers, tokens issued in the same onboarding wave expire in the same hour → refresh stampede against Google/MS. **Decision:** jitter the renewal window (refresh anywhere in a ±30-min band before expiry, keyed on a hash of `credentialId`) so refreshes spread, not spike. | Prevents a self-inflicted provider-rate-limit incident at scale. | **Net-new — needed by 1000 customers.** |
| **Prompt-prefix caching** | **Already supported in the provider** — `cacheable` blocks + `cacheSystem` → `cache_control: ephemeral`; usage reads `cache_creation`/`cache_read` tokens (`lib/llm/anthropic-provider.ts:26-29, 134-153, 164-170`). Pricing already models cache read at 0.1× input (`pricing.ts:70,84`). | Mark every **per-skill system prompt** as `cacheSystem: true`. System prefixes are stable across calls within the 5-min cache window; the `*/5` and `*/15` crons hit the same prefix repeatedly. | **Cache read is 0.1× input** — on a draft call that is ~40% system prefix, this is roughly a **−35% input-token cost** on top of the §3 tier savings. Compounds with the routing audit. | **Mechanism shipped; skills don't all set the flag yet. High-leverage, low-effort.** |
| **Cron pre-warming (briefings)** | Pulses fire at `0 13 * * *` / `0 13 * * 1-5` (= ~8–9am ET) — a fleet-wide stampede (`lib/inngest/functions/briefings-generator-sweep.ts` et al.). | **Decision:** generate the next day's briefing **overnight** (e.g. spread across `0-6 UTC`, keyed/jittered by workspace) and serve it pre-built at the customer's morning, rather than synthesizing 1000+ briefings in one minute. Natural fit for the **Anthropic Batch API** (async, ~50% off) once volume justifies. | Removes the single worst concurrency spike; halves briefing cost via batch tier at scale. | **Net-new — needed by 1000 customers.** |

**Decision priority:** prompt-prefix caching first (shipped mechanism, just set the flag, compounds with §3), then per-turn chat context budget (cost-creep governor), then renewal jitter + briefing pre-warming (scale-driven, by 1000).

---

## Section 6 — Growth mechanics (product-level, not marketing)

- **Onboarding / activation.** Signup → branded workspace is **one self-serve transaction** with no operator step (`signUpAction` → `signUpBrokerOwner` creates User+Workspace+Membership+OnboardingState+audit+trial-sub in one tx, `lib/auth/flows.ts:70-189`; verify route redirects straight into the workspace, `app/(product)/app/verify/route.ts:35-67`). First-draft requires one OAuth connect (`lib/integrations/marketplace.ts`). **Activation metric (decision):** *first real `WorkApprovalQueueItem` produced from the customer's own connected account within 24h of signup* — not "signed up," not "connected." The leak point is the **connect step** (audit link 2): if the customer doesn't connect Gmail, the loop has nothing to read and the workspace shows only the labeled `LoopPreview` empty-state (`app/(product)/app/workspace/[id]/page.tsx:341-394`). **Move:** make "connect your inbox" the single dominant onboarding CTA; everything else is secondary. Instrument the funnel (signup → connect → first-event → first-approval) — that instrumentation is itself net-new and is the prerequisite for optimizing anything here.
- **Trial conversion.** First month free across tiers (`trial_period_days: 30`, `lib/billing/checkout.ts:139`). **Card is captured at signup** when `STRIPE_CHECKOUT_ENABLED` is true (the default in prod — `lib/env.ts:113-114`; this fixed the earlier "no card required" lie, audit §6). First charge lands at day 30. **The conversion-correlating signal (decision):** activation-by-day-3 (first approval-queue item acted on) is the leading indicator — a customer who has approved/edited a draft in week 1 has experienced the value loop; one who connected but never returned to the queue is a month-2 churn risk. Instrument "days-to-first-approval-acted-on" and "weekly returning-to-queue rate" as the churn-predictive cohort metrics.
- **Expansion revenue (single → multi-seat).** The schema already supports N-seat workspaces + Teams (`Membership`, `Team`, `TeamMembership`, `schema.prisma:689,1689,1707`) and a seat-band price ladder. **Trigger (decision):** when a single-seat workspace's owner forwards/CCs another person repeatedly, or when the loop surfaces work clearly belonging to a second person, fire an **operator-facing** expansion chip ("this workspace looks like a 2-person shop — Partner-tier conversation?"). Per `project_no_outbound_architecture`, agentplain does not auto-upsell the customer; it advises the operator/owner. When the second seat is added, the fleet shows the before/after (drafts handled, hours saved across both seats) as the proof.
- **Per-vertical referral.** Real-estate and mortgage-broker networks are dense; customers know each other. **Mechanic (decision):** an in-product "invite a colleague" that grants both parties an extra free month (a billing-credit, executed through Stripe — *not* an outbound send; the invite link is shown to the customer to share via their own channel, honoring no-outbound). Per-vertical because the trust graph is per-vertical.
- **Network effects — confirm and propose.** **Confirmed: agentplain has none today, by design.** Agents don't communicate across workspaces (`project_no_outbound_architecture` + RLS isolation, §1.2). **What could create one without breaking isolation:** *aggregate, anonymized, opt-in* benchmarks — "your response time is faster than the median real-estate workspace," "top-quartile draft-acceptance rate." This is a data-network-effect (more customers → better benchmarks → more value) that never crosses a workspace boundary at the row level. It must be opt-in and aggregate-only to stay inside the isolation guarantee. **Decision:** scope this as a post-100-customer feature (you need a population before a benchmark means anything).

---

## Section 7 — Multi-vertical expansion

Locked at general + 10 named verticals (`project_agentplain_mission_and_positioning.md` Q2 lists all 10; `feedback_no_new_verticals_finish_locked` bars vertical #11 until the locked ones finish). The schema/skills already carry the vertical scaffolds (`lib/skills/*-realestate`, `*-cpa`, `law-intake-conflict-screen`, `ria-client-update-draft`, etc., enumerated in `docs/skill-model-routing-2026-05-29.md:53-60`).

- **"Vertical done" definition (decision):** a vertical is GA-ready when **all four** hold: (1) **counsel-reviewed compliance corpus** with the §1.6 badge flipped from DRAFT to reviewed; (2) **≥1 reference customer** running the live value loop on their own account (the `feedback_integration_acceptance_is_functional` bar — read+categorize+coordinate+schedule+draft, not "it compiles"); (3) **vertical JTBD + ROI content** live (`lib/verticals/<slug>/content.ts`, already the pattern); (4) **the vertical's primary integration** ships its value-loop demo, not just the OAuth wire.
- **Trigger to unlock vertical #11 (decision):** **not a date — a condition.** Unlock when (a) **≥3 of the 10 locked verticals meet the "done" definition** AND (b) fleet token COGS is comfortably inside margin at the current routing (i.e. §3 has landed and the budget governor shows healthy margins at the then-current customer count). Adding breadth before depth is the exact sprawl `feedback_no_new_verticals_finish_locked` exists to prevent.
- **Order to finish (decision):** **stage, don't big-bang.** Lead with **real estate** (the deepest scaffold, the eat-our-own-cooking flatsbo proof-point, the most skills shipped). Then the **email-shaped, low-compliance verticals** (recruiting, property management, home services) where the generic value loop transfers with least corpus work. **Defer the high-compliance verticals (law, RIA, insurance)** until (a) counsel returns and (b) the §1.3 audit-log immutability + §3 compliance-Sentinel-on-Sonnet-with-escalation are both shipped — these verticals carry the liability that makes the hardening non-optional. Ship to GA **as each meets the "done" bar**, with the marketing surface continuing to name all 10 (per Q2 "all 10 on page 1") while only the done ones carry a reference customer / counsel badge.

---

## Section 8 — Multi-state geographic expansion (flatsbo overlap)

**Caveat:** `project_flatsbo_state_portability.md` (named in the dispatch) **does not exist** in this snapshot; flatsbo's GA-only V1 posture is from the global CLAUDE.md ("Georgia-only in V1"). I ground this section in that fact + the agentplain code, and flag the missing memory.

- **agentplain vs flatsbo are separate codebases** (`C:\agentplain` vs `C:\flatsbo`). agentplain's geographic exposure is **only through brokerage customers** — its value loop is email/calendar/CRM-shaped and **state-agnostic for the V1 email loop.** State-specificity enters at two points: (1) **MLS adapters** (per-state/per-MLS integration), and (2) the **per-state real-estate compliance corpus** (fair-housing + state license rules).
- **Which state expands second (decision):** **demand-driven, not opportunity-driven.** agentplain does not need to "pick" a state — its email loop already works for an out-of-GA brokerage on day one. The MLS adapter + state corpus only become necessary when a customer's workflow *requires* MLS read/write. **Decision:** build the **second state's MLS adapter only when a paying or design-partner brokerage in that state needs it** — let revenue pull the integration, don't push it speculatively (mirrors §7's depth-before-breadth and the adapter-on-demand portability rule, `feedback_runner_portability`).
- **Per-state integration cost:** one **MLS adapter** (behind the existing integration-adapter interface — `lib/integrations/<provider>/`, the same shape as the shipped Google/MS/DocuSign adapters) + one **per-state compliance corpus** (counsel-reviewed, §1.6 badging). The adapter is bounded engineering; the corpus is the gating cost because it needs counsel. `[Effort not estimated per feedback_no_guesses_no_estimates — scope is "one adapter + one counsel-reviewed corpus per state."]`
- **Does agentplain's customer dataset inform flatsbo's expansion?** **Only in aggregate and only with care.** agentplain's per-workspace data is RLS-isolated and customer-owned; it cannot feed flatsbo at the row level (cross-product data use is a trust and possibly contractual violation). What *can* transfer: aggregate **market signal** — "we're acquiring brokerage customers in Tennessee" is a demand signal flatsbo's GTM could use, without touching any customer's data. Keep the products' data planes separate; share only the GTM-level signal.

---

## Section 9 — Failure-mode catalog (first draft of the §1.5 response runbook)

For each: **detect → recover → customer-comms.** "Comms template: NONE" flags what we still need to build. All customer comms are **drafted for operator review**, never auto-sent (`project_no_outbound_architecture`).

| Failure | Severity | Detect | Recover | Customer-comms |
|---|---|---|---|---|
| **Anthropic outage 1h** | SEV-2 | Sentry on `UPSTREAM_ERROR`/`RATE_LIMITED` from `mapAnthropicError` (`anthropic-provider.ts:184-205`); the loop already returns typed errors, doesn't crash. | Inngest auto-retries; webhook events stay queued (`process-webhook-event` drains backlog on recovery). No data lost — drafts just delayed. | Status page (build, §10). Template: NONE — build "drafts delayed, nothing lost" message. |
| **Anthropic outage 6–24h** | SEV-1 | As above, sustained. | Backlog grows; on recovery the `*/5` drain catches up (idempotent on `WebhookEvent` rows). Consider a provider-fallback adapter (the `LLMClient` seam supports it — `project_living_portable_architecture`) for true multi-day resilience. | Proactive operator-reviewed note to active customers. Template: NONE. |
| **Neon DB outage** | SEV-1 | `/api/health` fails (route exists); Sentry. | Neon PITR / failover `[VERIFY plan]`. **This is where the §1.4 restore drill pays off.** | Status page. Template: NONE. |
| **Inngest delivery failure** | SEV-2 | No drains firing → webhook backlog climbs with no processing; alert on backlog depth (build, §10). | Inngest replays; events persist regardless. | Usually invisible to customer if caught fast. Template: NONE. |
| **Vendor sets new rate limits w/o notice** | SEV-2 | Spike in `RATE_LIMITED`; the renewal/draft crons surface it. | Renewal jitter (§5) + per-workspace concurrency keys (§4) reduce blast radius; back-off already in the SDK. | Internal first; customer only if sustained. |
| **MCP connector breaks at provider (mass Gmail OAuth expiry)** | SEV-1 | `IntegrationCredential.status` flips to `EXPIRED`/`REVOKED` en masse (taxonomy at `schema.prisma:872-877`); alert on status-change rate. | Customers must re-consent (OAuth). Fleet drafts a re-connect prompt into each workspace; **cannot auto-fix** (no outbound). | **High-need template** — "reconnect your inbox" guidance. Template: NONE — build. |
| **Customer data unreadable (key-rotation accident)** | SEV-1 | Decrypt paths return `encryption_key_unavailable` (`isEncryptionConfigured` seam, `encryption.ts:64`). | **§1.1 key-rotation drill is the only thing standing between this and disaster.** Restore correct key from secret manager; `rotate-keys.ts` re-encrypts if mid-rotation. | Per-customer, operator-reviewed. Template: NONE. |
| **Skill regression — drafts wrong en masse (e.g. compliance mislabel)** | SEV-1 | Drop in draft-acceptance rate; spike in customer edits; compliance-flag anomaly. Needs the §10 quality dashboard. | Per-skill kill-switch via `SkillConfig` / pause (`WorkspacePauseConfig`, `schema.prisma:1555`); the model-tier override seam lets you revert a bad routing change in one constant (`model-tiers.ts`). | Operator-reviewed correction. Template: NONE. |
| **Bad PR breaks the value loop for everyone** | SEV-1 | Sentry post-deploy spike tagged with `VERCEL_GIT_COMMIT_SHA` release (`env.sentryRelease`, `lib/env.ts:309`). The pre-push build gate (`.husky/pre-push`, incident-log 2026-05-18) catches build breaks; runtime breaks still slip (the 2026-05-17 verify-route crash did). | Vercel instant rollback to prior deploy. The incident log's open follow-up — an end-to-end test of the magic-link/value-loop round trip — would catch the class that build gates miss. | Status page if customer-visible. Template: NONE. |

**The pattern:** detection is mostly **wired** (Sentry, typed LLM errors, `IntegrationCredential` status, `/api/health`). **Recovery is mostly sound** because the architecture is durable-state-first (`feedback_cold_start_safe_agents` — events persist, crons drain idempotently). **The universal gap is customer-comms templates and a status page** — every row says "Template: NONE." That is the concrete §1.5 build: a small library of operator-reviewed incident-comms drafts + status.agentplain.com.

---

## Section 10 — Monitoring + alerting at each scale

| Scale | Tooling | Alerts | On-call |
|---|---|---|---|
| **10** | **Sentry** (wired, `chore/runtime-alerting-2026-05-18`); manual sweeps via `/operator/fleet`. `/api/health`. | 500-class on `/app/*` (digest de-dup, incident-log 2026-05-18); cron-throw via `onRequestError`. | Conner. |
| **100** | **Per-workspace health board** (build) — last-drain time, webhook-backlog depth, failed-cron count, **token-spend vs budget** (§2 governor). | Stuck queues, failed crons, **abnormal token spend (>80% of MRR ceiling)**, `IntegrationCredential` status-change rate. | Conner + first ops hire / fleet on-call. |
| **1000** | **SLO dashboards** (loop latency p50/p95: signup→first-approval, event→draft); **cost-per-workspace anomaly detection** on `LlmUsageRecord`; **cohort retention** (activation, return-to-queue, churn). | SLO burn-rate; cost anomalies; cohort drop-offs; draft-acceptance regression (quality signal for §9 skill-regression). | Defined on-call rotation. |
| **10,000** | **Dedicated NOC tooling**; **status.agentplain.com** (public status page — does not exist today, confirmed by grep); per-vertical sub-org dashboards (law/RIA). | Full SLO suite; per-region health; per-vertical compliance-flag anomaly; capacity vs Anthropic committed-use burn. | 24/7 rotation. |

**Build order (decision):** the **token-spend-vs-budget board (§2)** and the **per-`sourceSurface` spend breakdown** are the first net-new monitoring to build — they're cheap (the `LlmUsageRecord` data exists), they protect the margin that §2/§3 establish, and they're the operator's instrument for the service-partnership decisions (tier review, per-skill override). Status page is needed by the time customer-comms templates (§9) ship — they reference it.

---

## Section 11 — Sequenced execution roadmap (12 weeks → "first 100 can operate without us in the loop")

Honors `feedback_code_tasks_rebase_first` (every code task rebases on main first) and `feedback_fleet_waves_use_worktree` (parallel waves isolate into their own `git worktree`).

### Weeks 1–2 (config + land in-flight + easy routing wins)
- **[Conner-only] The config flip** — run `docs/runbooks/go-live-prod-credentials.md` §0–5 in order: encryption/DB/session/Resend → Inngest + Anthropic → Google/MS OAuth → Stripe live + `setup-products.ts` → Sentry. **This is the gate for everything else.**
- **[Fleet] Land the in-flight PRs** — support handler (audit link 4), MCP verify, fleet inspector (Stream D.1, already on `feat/operator-fleet-activity-inspector`), ROI, customer polish, **and merge the model-routing audit** (`audit/model-routing-token-shortage-2026-06-03`).
- **[Fleet] Routing Wave A** (audit §6) — the zero-quality-risk Haiku wins: `chief-of-staff` scheduler refine Sonnet→Haiku (hottest cron), memory-extract Sonnet→Haiku, inbox-triage refine Sonnet→Haiku. Update `model-tiers.test.ts` pins.
- **[Conner] First real-customer signup walkthrough** — sign up a brand-new workspace on prod, connect a real Gmail, watch a real draft land. This is the audit's "only test that matters" (`go-live-prod-credentials.md` final acceptance).

### Weeks 3–6 (first 10 customers)
- **[Fleet] Routing Wave B (A/B-gated)** — draft Opus→Sonnet (the −80% structural win) + the 4 pulses + support-handler + lead-triage + process-doc + compliance-watch, A/B'd against Opus on held-out samples, with the vertical→tier override map so law/RIA stay Opus. This is the move that makes §2's margins real.
- **[Fleet] Per-seat token-budget governor** — `lib/llm/budget.ts` on the existing `LlmUsageRecord` substrate + operator-facing alarm on `/operator/fleet` (§2). **+ the per-`sourceSurface` spend dashboard** (§10) so Wave B's A/B uses real numbers, not §2's labeled assumptions.
- **[Fleet] Pre-launch hardening** — audit-log DB immutability migration (§1.3), RLS-coverage CI gate (§1.2), prompt-prefix caching flag on every skill system prompt (§5, compounds with Wave B).
- **[Both] First incident-response drill** — the paired **backup-restore + key-rotation drill** (§1.1+§1.4); write the first customer-comms templates + stand up status.agentplain.com (§9/§10).
- **[Fleet] Operator harness completion** (D.2, D.3, D.5) + **customer-surface polish** (C.2, C.3).
- **[Both] Counsel review** of the compliance corpus for **≥3 verticals** (start with the email-shaped, lower-stakes ones to build the review pipeline before law/RIA).

### Weeks 7–12 (first 100 customers)
- **[Fleet] Fleet-side support handler GA** (audit link 4 → flips support from "NO" to self-serve) — the single biggest "no human at agentplain" lever once config is set.
- **[Fleet] Multi-vertical MCP completion** (B.1 waves 2–4) for the verticals meeting the §7 "done" bar.
- **[Conner] Anthropic tier upgrade** — move to the next API tier; **open the committed-use conversation** as fleet token spend approaches ~$20k/mo.
- **[Fleet] SLO dashboards + cohort retention** (§10) + **trial-conversion instrumentation** (§6 funnel: signup→connect→first-event→first-approval→acted-on).
- **[Both] Per-workspace concurrency keys + renewal jitter + briefing pre-warming** (§4/§5) — the scale-resilience changes, ahead of the curve.
- **[Both] Documented growth playbook per vertical** (the §7 "done" checklist applied).

---

## Section 12 — Five biggest risks + mitigations (rank-ordered)

1. **Unit economics underwater at current model mix.** *(Highest-stakes: it's the difference between a viable and unviable business, and it's invisible until volume arrives.)* At the post-wave-8 mix we lose money on medium-and-heavier workspaces below $199 (§2 table). **This week:** merge the routing audit PR and execute Wave A; schedule Wave B (draft Opus→Sonnet) for weeks 3–6. The fix exists and is authored — the risk is *not landing it before customers scale.*

2. **Key-loss / backup-restore has never been drilled.** *(A single bad rotation or DB event with no proven recovery is business-ending — and both the key path and the restore path are un-drilled.)* **This week:** store `ENCRYPTION_KEY` in a real secret manager with a documented recovery path (Conner); scope the paired restore+rotation drill for week 3–6 (fleet). Do not open self-serve to strangers until this is drilled.

3. **Audit-log is mutable + compliance corpus is unbadged.** *(Both undercut the compliance-first claim that the law/RIA/insurance verticals — the highest-value ones — depend on, and create real legal exposure.)* **This week:** scope the append-only DB migration (§1.3) and the DRAFT/counsel badge (§1.6); gate law/RIA/insurance GA behind both + counsel (§7).

4. **No cost governor + no per-skill spend visibility.** *(Without it, a single power-user workspace silently erodes margin and we can't see which skill is hot — we'd discover the §1 economics risk only on the Anthropic invoice.)* **This week:** scope `lib/llm/budget.ts` + the per-`sourceSurface` dashboard (§2/§10) on the existing `LlmUsageRecord` data; it's the instrument that makes risks #1 and the §4 scaling decisions data-driven.

5. **Support + incident comms are entirely human-bound with no templates or status page.** *(At 100 customers the operator becomes the bottleneck the whole "no-human-in-the-loop" thesis was meant to remove, and the first outage has no comms path.)* **This week:** scope the fleet-side support handler (audit link 4) for weeks 7–12 and the customer-comms templates + status.agentplain.com for weeks 3–6 (§9/§10).

**The through-line:** four of the five highest risks are **pre-revenue, fleet-buildable, and already scoped in this plan** — the routing fix is authored, the cost substrate exists, the hardening gaps are bounded migrations/drills. The work is sequencing and discipline, not invention. The one Conner-only critical path is the config flip (§1.0) — and it's a copy-paste runbook. **agentplain is closer to a viable launch than the surface suggests; the gap is operational hardening and the margin fix, both of which this plan sequences into the next 12 weeks.**
