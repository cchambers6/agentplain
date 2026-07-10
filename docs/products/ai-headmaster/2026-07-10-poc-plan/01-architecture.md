# AI Headmaster POC — Architecture

Four agents over one shared memory. This doc makes that concrete: stack, where each agent lives, how shared memory works, which agentplain patterns port over, and the cost architecture.

## 1. Tech stack (recommendation + justification)

| Layer | Pick | Why |
|---|---|---|
| App framework | **Next.js 15 (App Router) + TypeScript** | The fleet's fluent stack (agentplain, flatsbo). Every build/push/CI recipe in `docs/skills-v2/` applies unchanged. One deployable for UI + API routes + cron handlers. |
| DB | **Postgres (Neon) + Prisma** | Same as agentplain. Shared memory is relational + JSONB — no vector store needed for one family. Neon free tier covers the POC. Prisma migration discipline ports from `docs/skills-v2/cowork/code-hygiene/prisma-migration/SKILL.md` (incl. the drift-baseline rule for raw-SQL indexes, `project_schema_drift_baseline_for_raw_indexes`). |
| Job orchestration | **Vercel Cron + on-demand route handlers. No Redis, no Inngest.** | The workload is cron-shaped and tiny: one weekly Opus run, one Friday run, lazy daily generation. A queue is infrastructure for problems the POC does not have (concurrency, retries at volume, fan-out). This is the "no quick fixes ≠ maximal infra" reading of `feedback_no_quick_fixes`: the *best* fix for a 1-family scheduler is no queue. Revisit at v1 multi-tenant (doc 08). |
| Hosting | **Vercel** | Fleet already operates Vercel (deploy checks, `VERCEL_ENV=production` migrate gating recipe from PR #307 ports directly). |
| LLM access | **Anthropic API via a provider adapter** (`lib/llm/`) | Port agentplain's compose order verbatim — `Logging(Budget(Sentinel(Caching(Anthropic))))` (`project_llm_provider_compose_order`). The adapter seam satisfies `feedback_no_silent_vendor_lock` / `project_living_portable_architecture`: model IDs live in one config file, never in agent code. |
| Chat frontend | **Lightweight web app, one chat-shaped thread per school day, SSE streaming** | Recommendation for Conner decision #1. Why not Slack: homeschool parents aren't in Slack; vendor invisibility and voice are ours to control on our own surface. Why not iMessage: no sanctioned server API — anything there is a hack that violates the runner-portability instinct (`feedback_runner_portability`). Why SSE over WebSocket: the flow is one-directional streaming (agent → parent) with ordinary POSTs back; SSE is Vercel-native, no connection state to manage. Why web over native: out of scope per brief (no native mobile); responsive web on the parent's phone is sufficient for a 5-min loop. |
| Auth | **Single-family password + session cookie. No auth provider.** | Multi-family auth is explicitly out of scope. One env-var-configured family. The 30-day cookie recipe from agentplain PR #270 (cookies set on the redirect response) is the only auth code we port. |

## 2. Where each agent lives

```
app/
  (parent)/today/          ← daily loop UI: morning brief + debrief chat (SSE)
  api/agents/integrator/   ← POST: on-demand run (onboarding, curriculum change)
  api/agents/tutor/        ← POST: debrief turn (SSE stream); GET: morning brief (lazy)
  api/cron/headmaster/     ← Vercel Cron: Sun 18:00 (WeeklyPlan), Fri 16:00 (report)
  api/registrar/export/    ← GET: Georgia compliance export (CSV/PDF)
lib/agents/{integrator,headmaster,tutor,registrar}/
```

- **Integrator = on-demand job.** Fires at onboarding completion and on curriculum add/remove. One Opus call, ~60–120s, streamed progress to the onboarding UI. No queue: the caller awaits the route handler.
- **Headmaster = scheduled job.** Vercel Cron → route handler. Two schedules: Sunday evening (WeeklyPlan for the coming week) and Friday afternoon (weekly report). A **disruption replan** endpoint lets the parent trigger an off-cycle run ("we lost Tuesday — replan the rest of the week"); it is the same code path with a `disruption` context block.
- **Tutor-Advisor = interactive service.** Morning brief is **lazily generated on first open of the day** (not cron): if the family skips a day, we spend zero tokens — this is the "no polling" rule from the cost-architecture rules applied to generation. Debrief is a stateful SSE chat; turns persist to `DailyLog.debrief_transcript` as they happen. When the parent ends the debrief, the extraction pipeline runs (Haiku triage → Opus when warranted, §5).
- **Registrar = post-debrief rules engine.** Runs synchronously in the same transaction that closes the DailyLog: deterministic TypeScript derives the Georgia attendance/subject record from structured DayPlan/DailyLog fields. Haiku is consulted only when the rules engine flags an edge case (e.g., a half-day it can't classify). LLM-free on the happy path — same discipline as the killer-workflow runtime (PR #303, "synthetic data, LLM-free").

All four agents are **cold-start-safe** (`feedback_cold_start_safe_agents`): every fire reads durable state from Postgres; nothing depends on in-process memory surviving between fires.

## 3. Shared memory

**Postgres is the single source of truth. No cache layer in the POC** — one family generates a few hundred rows a month; every read is a single-digit-millisecond indexed query. (Prompt caching at the API layer is where caching actually pays — §5.)

Write-through discipline, borrowed from the Librarian's single-writer invariant (`memory/LIBRARIAN_CHARTER.md`, I-2) and adapted:

| Entity | Sole writer | Readers |
|---|---|---|
| IntegrationMap | Integrator | Headmaster, Tutor-Advisor |
| WeeklyPlan / DayPlan | Headmaster | Tutor-Advisor, Registrar, UI |
| DailyLog (incl. debrief transcript) | Tutor-Advisor route | Headmaster, Registrar |
| **Child.model** | **extraction pipeline only** (never the chat turn itself) | everyone |
| ChildModelUpdate (append-only) | extraction pipeline | Headmaster (rationale), acceptance query |
| ComplianceRecord | Registrar | export route |

Child.model is a JSONB document (modalities, strengths, struggles, pacing, interests) **plus** an append-only `ChildModelUpdate` event table. The JSONB is the fast-read materialization; the event table is the audit trail that makes acceptance criterion 3 a SQL query instead of a story. This is the Librarian's INBOX→formatted-file split translated to relational form: observations append; one process merges.

## 4. Reuse decisions — what ports from agentplain, what doesn't

**Ports over (with source):**
- LLM provider compose order `Logging(Budget(Sentinel(Caching(Anthropic))))` — `project_llm_provider_compose_order`, agentplain `lib/llm/`. Sentinel here enforces the **no-curriculum-content rule** (output scanner, doc 03 §guardrails) instead of real-estate compliance.
- Budget seam + `NO_CAP`-when-unset — PR #146 (`project_budget_seam_shared`); every skill/agent caller goes through the fire-gate (PR #147 rule: *all* callers wired, no bypass).
- YAML-free equivalent of `canSpend()` — agentplain `lib/memory/data-readers.ts` (PR #265); here it's a `family_budget` table with the same gate-before-fire contract.
- RLS with `workspace_id = family_id` — memory-scale RLS pattern from PR #298 (`project_memory_scale_rls_tiering_byo_2026_06_18`). Single-family POC still ships the policies so v1 multi-tenant is a config change, not a retrofit.
- Heartbeat/conductor split — the daily loop is L3-shaped (`docs/loop/00-DESIGN.md`): *the cheap layer does process control, the expensive layer does judgment, and neither takes over the other's job.* Concretely: Haiku triage decides whether Opus extraction fires; cron fires Headmaster; nothing self-chains.
- Ops mechanics — isolated worktrees, fleet-token push, curl-per-PR merge, push-verification, rebase-first (`docs/skills-v2/cowork/fleet-ops/*`). The fleet builds this repo the same way it builds agentplain.
- Voice-gate + brand-gate scaffolding — `tools/brand/voice-gate.mjs` / `brand-gate.mjs` lifted and re-pointed (doc 05).
- Truthful-state discipline — Truth Wave (PR #290): every UI claim traceable to a real system state; no "your child is thriving" copy the data doesn't support.

**Deliberately does NOT port:**
- **Plaino / agentplain brand system** — different product, different audience. Brand TBD by Conner; `project_brand_locked` applies to agentplain, and we don't smuggle its identity here. Placeholder-never-ships still applies (`feedback_placeholder_convention_needs_launch_gate`).
- **No-outbound architecture** (`project_no_outbound_architecture`) — carried in spirit but trivially: Headmaster POC has *zero* outbound. Nothing emails, posts, or files anything externally; the compliance export is a download the parent submits themselves. (Georgia's declaration-of-intent stays a parent action.)
- **MCP connector layer** — no third-party integrations in POC scope.
- **The 9-track loop / governor** — that's fleet self-management, not product runtime. Only the conductor *pattern* ports.
- **BYO-key** — agentplain's BYO-key default is a B2B posture. Headmaster is B2C at $25–35/mo; families won't bring keys. Product-owned key with per-family budget caps instead; the adapter seam keeps portability.

## 5. Cost architecture (summary — full math in doc 06)

Model placement (pricing per MTok: Opus 4.8 $5 in / $25 out; Sonnet 5 $3/$15; Haiku 4.5 $1/$5; cache reads ≈0.1× input, cache writes 1.25×):

| Call | Model | Freq/mo | In / out tokens (est.) | $/mo |
|---|---|---|---|---|
| Integrator run | Opus 4.8 | 2 | 20K / 8K | 0.60 |
| Headmaster Sunday plan | Opus 4.8 | 4.33 | 30K / 6K | 1.30 |
| Headmaster Friday report | Opus 4.8 | 4.33 | 25K / 3K | 0.87 |
| Morning brief | Haiku 4.5 | 17.3 | 6K / 0.8K | 0.17 |
| Debrief conversation (~6 turns) | Sonnet 5 | 17.3 | ~40K effective w/ caching / 3K | 2.08 |
| Extraction triage | Haiku 4.5 | 17.3 | 5K / 0.3K | 0.11 |
| Extraction deep pass | Opus 4.8 | ~7 (40% of days) | 10K / 1.5K | 0.61 |
| Registrar edge cases | Haiku 4.5 | ~2 | 4K / 0.3K | 0.02 |
| **Total** | | | | **≈ 5.76** |

The Haiku-triage-gates-Opus pattern (the cost-architecture rules' core move, and the same shape as agentplain's L3 governor deciding when Fable fires) is what keeps extraction from being a daily Opus tax: most days' debriefs are routine ("did the lessons, math was fine") and Haiku both detects that and applies the trivial update itself; Opus fires only when the log is observation-rich. Prompt caching strategy per agent, budget enforcement, and the meter design are in doc 06.

## 6. The two hard rules, enforced structurally

1. **Never reproduce curriculum content.** The database *cannot store it*: the `Curriculum`/`CurriculumUnit` schema (doc 02) holds titles, unit/lesson numbers, durations, skill tags, and the parent's own notes — there is no column for lesson text. Prompts instruct planning-by-reference ("Lesson 14" not its content); the Sentinel layer scans agent output for quoted-passage heuristics and blocks on hit (doc 03).
2. **The AI serves the parent-teacher, never the child.** No child-facing surface exists in the POC; the UI copy is addressed to the parent throughout; debrief prompts are explicit that the interlocutor is the teacher. Vendor invisibility (`feedback_model_vendor_invisible_on_customer_surfaces`) applies to every parent surface — model names appear only in internal logs and a future /privacy subprocessor list.
