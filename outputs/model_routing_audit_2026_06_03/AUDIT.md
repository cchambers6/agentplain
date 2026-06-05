# Model-routing audit — token-shortage rebalance

**Dispatch:** Conner, 2026-06-03 — "audit which model we should use for which tasks, with a token shortage we need to re-evaluate."
**Authored:** 2026-06-05 (date per session `currentDate`).
**Scope:** read-only across `C:\agentplain`. No production code modified. This doc is the artifact.
**Prior state:** `docs/skill-model-routing-2026-05-29.md` (wave-8 sweep) — its Phase-3 per-call `model:` overrides **did land** and are verified live in code (see §1). This audit does not redo wave 8; it **re-evaluates wave 8's calibration**, which has been invalidated by the token shortage.

---

## TL;DR — top 3 quick wins

1. **`draft.ts` Opus → Sonnet.** `lib/skills/draft.ts:63`. The single highest-volume customer-facing surface (every coordinate→draft chain ends here). ~80% per-call cost cut. Regular-tier general drafting does not need Opus; reserve Opus for high-stakes verticals (law, RIA) via per-skill override. **Wave B (A/B first).**
2. **`chief-of-staff/llm-refine` Sonnet → Haiku.** `lib/skills/chief-of-staff-scheduler/llm-refine.ts:71`. This is the **hottest LLM cron** — `scheduler-sweep` fires `*/15` (96×/day/workspace, `lib/inngest/functions/scheduler-sweep.ts:77`). Slot-proposal refine is structured ranking, not prose judgment. ~67% per-call cut on the highest-frequency site. **Wave A/B.**
3. **The four weekly/daily Opus pulse-crons → Sonnet** (`analytics-weekly-pulse`, `finance-pulse`, `content-calendar`, `briefing-generator`). Synthesis over already-structured metrics, not multi-constraint reasoning. ~80% per-call cut on the recurring batch surface. **Wave B.**

Net direction: wave 8 deliberately drove **cost up** ("API usage will remain a very small impact on margin" — `docs/skill-model-routing-2026-05-29.md:5-8`). The token shortage **voids that premise**. The 11 Opus sites are the cost center; this audit moves 8 of them down a tier and keeps Opus only where cross-document synthesis or genuine multi-step planning is the job.

---

## Section 1 — Inventory + current state (verified live)

Every `.complete()` LLM call site, found by `grep -rln "\.complete(" lib --include=*.ts` (excluding tests) on 2026-06-05. Model column is the **actual current** assignment read from the import + call line — wave-8 Phase 3 is fully landed.

| # | Call site (file:line) | Current model | Purpose | Invoked by / cadence |
|---|---|---|---|---|
| 1 | `lib/plaino/dispatcher.ts:151` | **Haiku** | `/talk` classify **and draft reply** in one call (maxTokens 700, JSON) | `/talk` server action, per customer turn (interactive) |
| 2 | `lib/skills/office-admin/classifier.ts:68` | **Haiku** | Bin admin item into one of 9 `ADMIN_*` kinds | office-admin skill (event) |
| 3 | `lib/skills/categorize.ts:50` | **Haiku** | Categorize message into vertical kind (enum-bound) | `process-webhook-event` `*/5`, on-create handlers |
| 4 | `lib/plaino/memory/extract-from-conversation.ts:140` | **Sonnet** | Parse a chat turn → structured FEEDBACK/PREFERENCE rule | dispatcher PREFERENCE path |
| 5 | `lib/skills/inbox-triage-general/llm-refine.ts:108` | **Sonnet** | Feedback-rule override on heuristic triage label | inbox-triage skill (event) |
| 6 | `lib/skills/chief-of-staff-scheduler/llm-refine.ts:71` | **Sonnet** | Refine proposed meeting slots | **`scheduler-sweep` `*/15` — hottest LLM cron** |
| 7 | `lib/skills/coordinate.ts:66` | **Sonnet** | Extract entities from a message thread; feeds Draft | coordinate stage (event-driven) |
| 8 | `lib/skills/schedule.ts:54` | **Sonnet** | Enumerate + rank scheduling slots | schedule stage |
| 9 | `lib/plaino/instruction-handler.ts:247` | **Opus** | Multi-step plan from a customer `/talk` INSTRUCT | `instruction-handler-on-create` (event) |
| 10 | `lib/skills/support-handler/skill.ts:171` | **Opus** | Customer-facing support reply draft | `support-handler-on-create` (event) |
| 11 | `lib/skills/lead-triage-realestate/llm-refine.ts:86` | **Opus** | Refine lead-triage note shown in CRM | lead-triage skill (event) |
| 12 | `lib/skills/process-doc-drafter-general/llm-refine.ts:69` | **Opus** | Draft SOP/process-doc prose | `process-doc-drafter-sweep` `0 13 * * 1` (weekly Mon) |
| 13 | `lib/skills/draft.ts:63` | **Opus** | **THE** customer-facing message draft (terminal stage) | coordinate→draft chain (event), high volume |
| 14 | `lib/skills/briefing-generator/index.ts:264` | **Opus** | Daily briefing synthesis across signals | `briefings-generator-sweep` `0 13 * * 1-5` (weekday) |
| 15 | `lib/skills/compliance-watch-general/skill.ts:70` | **Opus** | Judge which events merit a compliance flag | `compliance-watch-sweep` `0 13 * * *` (daily) |
| 16 | `lib/skills/content-calendar-drafter-general/skill.ts:65` | **Opus** | Draft social/content calendar | `content-calendar-drafter-sweep` `0 13 * * MON` (weekly) |
| 17 | `lib/skills/analytics-weekly-pulse-general/skill.ts:89` | **Opus** | Weekly analytics narrative | `analytics-weekly-pulse-sweep` `0 13 * * MON` (weekly) |
| 18 | `lib/skills/finance-pulse-general/skill.ts:94` | **Opus** | Weekly finance-pulse narrative | `finance-pulse-sweep` `5 13 * * MON` (weekly) |
| 19 | `lib/skills/research-on-demand-general/skill.ts:103` | **Opus** | Research brief synthesized across sources | research-on-demand skill (on-demand) |
| — | `lib/llm/logging-provider.ts` | (decorator) | Wraps any provider for usage logging; chooses no model | infra, not a routing decision |

**Tier source of truth:** `lib/llm/model-tiers.ts` — `MODEL_OPUS='claude-opus-4-7'` (:28), `MODEL_SONNET='claude-sonnet-4-6'` (:33), `MODEL_HAIKU='claude-haiku-4-5-20251001'` (:38). One file changes a tier everywhere (`feedback_no_silent_vendor_lock`).
**Global fallback:** `lib/llm/anthropic-provider.ts:55` `DEFAULT_MODEL='claude-sonnet-4-5'` — now dead code for shipped skills (all pass explicit `model:`), but still the safety net for any new call site that forgets one.

### Code units that call an LLM but are NOT in the table (verified zero `.complete()`)

| Unit | Why no LLM |
|---|---|
| `follow-up-chaser-sweep` → `follow-up-chaser-general/skill.ts` | Heuristic merge-field drafts (`{{operator: …}}`), 0 `.complete()`. Hourly cron, **no token cost.** |
| `follow-up-boss-sync-sweep`, `hubspot-sync-sweep`, `salesforce-sync-sweep` | Pure CRM data sync, 0 `.complete()`. Hourly, no token cost. |
| `b2b-ceo-daily`, `b2b-sales-rep-pre-call-brief`, `b2b-sales-rep-reply-sweep` | Pending-port **stubs** (`b2b-ceo-daily.ts:47` — "port pending"). 0 `.complete()` today. |
| `integration-renewal-sweep` `*/2`, `stripe-usage-meter-sweep`, `stripe-abandoned-signup-sweep`, `trial-expiration-warnings` | Plumbing/billing crons, no LLM. |
| `customer-files-ingestion-sweep` `*/6`, `notion-ingest-sweep` `*/6` | Feed the knowledge substrate via **OpenAI embeddings** (`lib/knowledge/openai-embedding.ts:32` `text-embedding-3-small`), not Claude. See §1a. |

### §1a — Knowledge substrate retrieval (audit item #4)

Retrieval is **vector search only**: `lib/knowledge/pgvector-store.ts` embeds the query (`:225`) via `OpenAIEmbeddingProvider` (`text-embedding-3-small`, `lib/knowledge/openai-embedding.ts:32`) and does a pgvector cosine search. **No Claude call happens in retrieval.** The Opus/Sonnet reasoning happens in the *downstream* skill that consumes the snippets (research-on-demand = Opus, dispatcher ANSWER = Haiku, support-handler = Opus).

**Recommendation:** retrieval needs **neither Opus nor Sonnet** — it is correctly an embeddings-only path. The only lever here is embedding-model choice (`text-embedding-3-small` is already the cheap tier; `-large` would be 6.5× the embed cost for marginal recall — do **not** upgrade under a token shortage). Tier decisions belong to the consuming skill, audited in §3.

### §1b — Compliance Sentinel (audit item #5)

Two things share the name. The repo runtime unit is **`compliance-watch-general`** (`lib/skills/compliance-watch-general/skill.ts:70`, currently **Opus**, daily cron). The Claude Code markdown skill `realty-compliance-sentinel` is an authoring/agent skill, not a repo `.complete()` site — out of this codebase's token budget.

Conner's note ("mostly regex + a final LLM pass — Haiku might suffice") is **directionally right but the tier should be Sonnet, not Haiku.** A missed compliance flag is a liability event, not a cosmetic miss; the asymmetry of a false-negative argues against the cheapest tier on the *judgment* pass. Recommendation: keep/strengthen a regex/rule pre-filter, run the **flag-or-not LLM pass on Sonnet**, and escalate only genuinely-ambiguous items to Opus. See §3 row 15.

---

## Section 2 — Complexity heuristic (the rubric)

Assign the tier by the **first** rule that matches, top to bottom:

1. **Multi-step reasoning over conflicting constraints** (a plan that must trade off competing requirements) → **Opus**.
2. **Cross-document synthesis into a novel artifact** (read N sources → produce something not present in any one) → **Opus**.
3. **Customer-facing prose where voice/judgment is the deliverable** → **Sonnet** — *unless* the vertical is high-stakes (law, RIA), then **Opus**.
4. **Classify / label / summarize / transform structured data** (enum-bound or schema-bound output) → **Haiku**.
5. **Tool/MCP stitching** (call tools, assemble their outputs, no independent judgment) → **Haiku**.
6. **On a hot cron** (≥ 1× per workspace per 5 min) → drop one tier from whatever the above picks, unless rule 1 or 2 applies; document the exception if Opus is genuinely required.
7. **A retry / fallback of any of the above** → **Haiku** (a retry exists to recover a parse/format failure, not to out-think the first attempt).

This rubric is the steering wheel for §3 and for the §4 user-preference rule.

---

## Section 3 — Model-selection matrix (the decision)

Per-call cost-impact column uses the §5 representative-call model and is labeled there. "↓1" = one tier cheaper, etc.

| # | Task | Current | **Recommended** | Reason (rubric rule) | Per-call impact | Wave |
|---|---|---|---|---|---|---|
| 1 | dispatcher / `/talk` reply | Haiku | **Haiku (keep)** | Hot interactive + classify-and-draft; rule 6 already satisfied | — | — |
| 2 | office-admin classifier | Haiku | **Haiku (keep)** | Rule 4, enum bin | — | — |
| 3 | categorize core | Haiku | **Haiku (keep)** | Rule 4, enum; also `*/5` cron | — | — |
| 4 | memory-extract | Sonnet | **Haiku** | Rule 4 — structured extraction into a rule schema | −67% | B |
| 5 | inbox-triage refine | Sonnet | **Haiku** | Rule 4 — classification refine on a heuristic label | −67% | B |
| 6 | chief-of-staff scheduler refine | Sonnet | **Haiku** | Rule 4 + rule 6 (**hottest LLM cron**, `*/15`) | −67% | A/B |
| 7 | coordinate core | Sonnet | **Sonnet (keep)** → Haiku candidate | Rule 4 leans Haiku, but it feeds Draft and entity-extraction errors propagate; test Haiku in B | 0 / −67% | B (test) |
| 8 | schedule core | Sonnet | **Sonnet (keep)** → Haiku candidate | Customer sees proposed slots; rank quality matters slightly; test Haiku | 0 / −67% | B (test) |
| 9 | instruction-handler (plan) | Opus | **Opus (keep)** | Rule 1 — genuine multi-step plan from a free-form instruction; this IS a "dispatch" per §4 | — | — |
| 10 | support-handler reply | Opus | **Sonnet** | Rule 3 — customer-facing prose, Regular-tier; bounded by substrate. A/B for empathy/accuracy | −80% | B (A/B) |
| 11 | lead-triage refine | Opus | **Sonnet** | Rule 3 — refine of a heuristic note; medium reasoning | −80% | B |
| 12 | process-doc drafter refine | Opus | **Sonnet** | Rule 3 — SOP prose; weekly cron; structured doc gen | −80% | B |
| 13 | **draft core** | Opus | **Sonnet** (Opus override for law/RIA) | Rule 3 — highest-volume customer draft; voice ≠ Opus-only for Regular tier | −80% | B (A/B) |
| 14 | briefing-generator | Opus | **Sonnet** | Rule 2 borderline → it's synthesis over *structured* signals, not free documents; weekday cron | −80% | B |
| 15 | compliance-watch | Opus | **Sonnet** (Opus escalation for ambiguous) | §1b — Sonnet for the judgment pass, keep rule pre-filter; daily cron | −80% | B |
| 16 | content-calendar drafter | Opus | **Sonnet** | Rule 3 — Regular-tier marketing prose; weekly cron | −80% | B |
| 17 | analytics-weekly pulse | Opus | **Sonnet** | Rule 3 — narrative over structured metrics; weekly cron | −80% | B |
| 18 | finance-pulse | Opus | **Sonnet** | Rule 3 — narrative over structured ledger data; weekly cron | −80% | B |
| 19 | research-on-demand | Opus | **Opus (keep)** | Rule 2 — true cross-document synthesis into a novel brief; on-demand (not hot) | — | — |

**Result:** Opus sites 11 → **2** (instruction-handler plan, research-on-demand). Sonnet 5 → **8**. Haiku 3 → **6** (+coordinate/schedule pending B-test). Every customer-readable surface keeps a judgment-grade model (Sonnet or Opus); only narrow classification/extraction sits on Haiku.

---

## Section 4 — User-preference reconciliation

**Active preference:** "When creating new agents, messages, dispatches, I prefer Opus."
**Tension:** taken literally, Opus-everywhere is exactly the wave-8 posture the token shortage has invalidated.
**Reading that honors the spirit:** the preference protects *intelligence where intelligence is the product* — the design of a new agent, the plan behind a dispatch, the high-stakes reply. It was never a request to run an enum-classifier or a weekly metrics-narrative on Opus. Notably, the existing `/talk` architecture **already** encodes this correctly: the conversational turn is Haiku (dispatcher.ts:151), and only the INSTRUCT *plan* escalates to Opus (instruction-handler.ts:247). "Dispatches get Opus" = **the plan gets Opus, the chatter does not.**

**Proposed refined rule (for Conner's ratification — not auto-applied):**

> **Opus** by default for: (a) designing a new agent/skill/dispatch, (b) cross-document synthesis into a novel artifact (research briefs), (c) genuine multi-step plans from free-form instructions, (d) customer-facing replies in high-stakes verticals (law, RIA), (e) any task whose brief literally says "design judgment."
>
> **Sonnet** by default for: customer-facing prose in Regular-tier verticals (drafts, support replies, pulses, calendars, SOPs), code-task PR work, and well-defined multi-step skill chains.
>
> **Haiku** by default for: classification, labeling, structured-data extraction/transformation, MCP/tool stitching, hot-cron routine refines, and retries/fallbacks of any of the above.

This keeps Opus on the surfaces where Conner's preference is actually expressed (new design, plans, high-stakes verticals) while letting the token budget breathe everywhere else.

---

## Section 5 — Estimated savings

**Hard facts (no estimate):** per-million-token rates from `lib/billing/usage/pricing.ts:66-85` (Anthropic list pricing, cached source `https://www.anthropic.com/pricing` read 2026-05-28):

| Tier | Input $/M | Output $/M | vs Sonnet | vs Opus |
|---|---|---|---|---|
| Opus | 15 | 75 | 5× | 1× |
| Sonnet | 3 | 15 | 1× | 0.2× |
| Haiku | 1 | 5 | 0.33× | 0.067× |

So per call, holding token count fixed: **Opus→Sonnet = −80%, Opus→Haiku = −93%, Sonnet→Haiku = −67%.** These ratios are exact and source-cited.

**Labeled assumption (no telemetry split by call site exists — `docs/skill-model-routing-2026-05-29.md:72-74` confirms this gap; `LlmUsageRecord` exists in DB but is not queried here, read-only audit).** Representative call sizes, stated so they can be corrected against real `LlmUsageRecord` data in Wave B:

- *Customer-facing draft* ≈ 4,000 input + 600 output tokens.
  - Opus: `4000/1e6×$15 + 600/1e6×$75` = **$0.105/call**
  - Sonnet: `4000/1e6×$3 + 600/1e6×$15` = **$0.021/call** (−80%)
  - Haiku: `4000/1e6×$1 + 600/1e6×$5` = **$0.007/call** (−93%)
- *Hot scheduler refine* ≈ 2,000 input + 300 output tokens.
  - Sonnet: `2000/1e6×$3 + 300/1e6×$15` = **$0.0105/call**
  - Haiku: `2000/1e6×$1 + 300/1e6×$5` = **$0.0035/call** (−67%)

**Frequency-weighted ranking (cron schedules are facts from `lib/inngest/functions/*`; per-workspace multipliers are the labeled assumption):**

| Site | Cadence (cited) | Calls/mo/workspace* | Move | Est. $/mo/ws saved* |
|---|---|---|---|---|
| chief-of-staff refine (#6) | `*/15` scheduler-sweep | ~2,880 (96/day × 30) | Sonnet→Haiku | ~**$20** |
| draft core (#13) | event, est. 30/day | ~900 | Opus→Sonnet | ~**$76** |
| support-handler (#10) | event, est. 5/day | ~150 | Opus→Sonnet | ~**$13** |
| 4 weekly pulses (#14,16,17,18) | weekly/weekday | ~4–22 each | Opus→Sonnet | ~**$2–9 combined** |
| compliance-watch (#15) | daily | ~30 | Opus→Sonnet | ~**$2.5** |
| memory/inbox/lead/process (#4,5,11,12) | event, low | <150 each | ↓1 tier | ~**$5–15 combined** |

\* Calls/mo/ws and $/mo/ws are **illustrative** at the assumed call sizes and a single workspace; multiply by active-workspace count for fleet totals. The **ratios** (−67% / −80% / −93%) are the durable, source-backed figures — the absolute dollars move with real volume, which Wave B should pull from `LlmUsageRecord`.

**Headline:** the two structural wins (`draft` Opus→Sonnet and `chief-of-staff` Sonnet→Haiku) dominate because they are the highest-volume sites; together they are the bulk of recoverable spend. The weekly pulses are low-frequency — moving them is correct on principle but small in dollars.

**Side note — model-version currency (not a tier lever):** `MODEL_OPUS='claude-opus-4-7'`; the current latest is Opus 4.8. Opus 4.x list rates are flat across minor versions (`pricing.ts:73-78` matches by substring `opus`), so a 4.7→4.8 bump is a quality/currency decision, **not** a cost lever — out of scope for this token-shortage audit, flagged so it isn't conflated with savings.

---

## Section 6 — Implementation plan (3 waves)

### Wave A — Easy wins, zero quality risk (≈ half the recoverable spend)
Pure classifier/extraction/hot-cron downgrades where Haiku provably reaches the same answer.

- `lib/skills/chief-of-staff-scheduler/llm-refine.ts:19,71` — `MODEL_SONNET` → `MODEL_HAIKU` (hottest cron; structured slot refine).
- `lib/plaino/memory/extract-from-conversation.ts:23,140` — `MODEL_SONNET` → `MODEL_HAIKU` (structured rule extraction).
- `lib/skills/inbox-triage-general/llm-refine.ts:34,108` — `MODEL_SONNET` → `MODEL_HAIKU` (classification refine).
- Update the corresponding pins in `lib/llm/model-tiers.test.ts` (it asserts each site's `MODEL_*` import + `model:` line — these tests will fail until updated; that's the guardrail working).

### Wave B — Sonnet defaults, A/B-gated (the bulk of the dollars)
Move the 8 Opus prose sites to Sonnet, but **test in dev first** and A/B against Opus on a sample of real customer-facing drafts before flipping prod.

- Opus→Sonnet: `draft.ts:22,63`; `support-handler/skill.ts:37,171`; `lead-triage-realestate/llm-refine.ts:17,86`; `process-doc-drafter-general/llm-refine.ts:18,69`; `briefing-generator/index.ts:27,264`; `compliance-watch-general/skill.ts:12,70`; `content-calendar-drafter-general/skill.ts:12,65`; `analytics-weekly-pulse-general/skill.ts:23,89`; `finance-pulse-general/skill.ts:26,94`.
- **Keep Opus** (do not touch): `instruction-handler.ts:247`, `research-on-demand-general/skill.ts:103`.
- **Per-skill Opus override for high-stakes verticals:** use the `SkillConfig` escape hatch noted in `model-tiers.ts:18-20` so `draft`/`support-handler` run Opus for law-intake and RIA workspaces while Regular-tier runs Sonnet. (No code lever exists for this yet beyond the construction-time `model` override — Wave B should add a vertical→tier map at the skill-construction seam.)
- **A/B method:** run both tiers on a held-out sample of recent threads, score on voice/accuracy/empathy; pull cost deltas from `LlmUsageRecord` to replace §5's labeled assumptions with real numbers.
- Optional within B: test `coordinate.ts` and `schedule.ts` Sonnet→Haiku; keep Sonnet if entity/slot quality regresses.

### Wave C — Architectural: turn-conditional Cowork session tier
The Cowork/Dispatch session model is set **once at session start**, not per turn (a runtime constraint, not a code edit in this repo). So this is an **architecture recommendation**, not a file edit:

- Cowork session currently `claude-opus-4-7[1m]`. Most planning/triage/inventory turns (like this audit's discovery phase) are Sonnet-class work; only true design-judgment turns need Opus.
- **Recommendation:** default the standing Cowork session to **Sonnet**, and escalate to an Opus session only for explicitly design-flagged work (new-agent design, architecture decisions, hard trade-off calls). For code tasks Dispatch fires (audit item #8): **bend the per-task default by task type** — mechanical patches / MCP scaffolding / schema migrations / UI polish → **Sonnet or Haiku**; system-design / cross-cutting refactors → **Opus**. This mirrors the §4 rule applied to the build loop, and reconciles Conner's "Opus for new dispatches" preference (the *plan* stays Opus; mechanical execution does not).
- Because model is session-fixed, the practical lever is **session hygiene**: start cheap (Sonnet) by default, open a dedicated Opus session for design sprints, rather than holding one Opus session open across mechanical work.

---

## Constraints honored

- **Read-only on production code** — no `lib/` or `app/` file modified; only this doc written (`feedback_persistence_discipline` — the doc is the artifact, matrix-first).
- **No guesses** (`feedback_no_guesses_no_estimates`) — every model assignment, cron schedule, and rate cites a `file:line`; the only non-cited numbers are explicitly **labeled assumptions** (call sizes, per-workspace volume) because no per-call-site telemetry split exists (gap confirmed at `docs/skill-model-routing-2026-05-29.md:72-74`). The durable figures are the source-backed ratios.
- **No silent vendor lock** (`feedback_no_silent_vendor_lock`) — all tier strings already route through `lib/llm/model-tiers.ts`; every recommendation is a one-line constant change at that seam, not a scattered SDK edit.
- **Prior wave-8 work referenced, not redone** (`docs/skill-model-routing-2026-05-29.md`).

## Gaps found during the audit (flagged, not fixed)

- The dispatch's cited memory files **`project_api_cost_control_2026_05_31.md`, `feedback_long_task_performance_2026_05_31.md`, `feedback_persistence_discipline.md` do not exist** in `~/.claude/projects/C--agentplain/memory/` (verified by `ls`). The wave-8 routing doc in-repo (`docs/skill-model-routing-2026-05-29.md`) is the recoverable prior state; the cost-control memory should be (re)written so this audit's calibration flip is captured durably.
- No `LlmUsageRecord`-backed per-call-site telemetry dashboard exists — Wave B's A/B should produce one so the next rebalance is data-driven, not assumption-driven.
