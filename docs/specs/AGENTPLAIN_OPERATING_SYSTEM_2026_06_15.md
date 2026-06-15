# agentplain Operating System — the 5-tier loop, the Librarian, the YAML data layer, the auto-load contract

**Version:** 1.0 · **Authored:** 2026-06-15 · **Owner:** the fleet (built by agents) · **Ratifier:** Conner
**Status:** canonical — this is the single source of truth for HOW we work
**File of record:** `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md`

> **Read this first, every session.** This document defines the operating loop that runs agentplain. It auto-loads into every future session as boot context (Section 5). If you are an agent reading this: the invariants in Section 1 are non-negotiable, the Librarian protocol in Section 3 governs every write you make to memory, and the boot-context block in Section 5 is what put this document in front of you.

WHAT vs HOW. The product — agentplain, the service layer on top of Claude for local businesses — is governed by the project memory (`project_agentplain_mission_and_positioning`, `project_sbm_wrapper_positioning_2026_06_06`, and the rest of the MEMORY.md index). That is the WHAT. **This spec is the HOW** — the machine that builds the product, keeps its own state, and compounds week over week. The two never contradict; when they appear to, the product memory wins on product questions and this spec wins on process questions.

---

## Section 1 — Purpose + invariants

### Why this OS exists

agentplain is built by agents (`feedback_agentplain_built_by_agents`). The fleet ships the product through a PR-A → PR-B → PR-C cadence, and the memory rules are "the steering wheel." But a fleet of stateless sessions has no shared spine: each session boots cold, does good work, and forgets. Three failure modes recur in the record:

1. **Memory drift** — sessions write directly into formatted memory files, MEMORY.md grows past its size limit (it is *already* over: "MEMORY.md is 27.7KB (limit: 24.4KB)"), and the index stops being loadable.
2. **Silent no-ops** — work that passes tests and builds green but never reaches a customer, because a gate was missed (the registry-truth class of bug; see `project_registry_truth_ci_guard_2026_06_10`).
3. **No compounding** — week 4 fires the same quality of prompt as week 1, because nothing measures which prompts produced 4+/5 work and which re-fired.

This OS fixes all three by making the loop **stateful, gated, and self-measuring**. The Librarian (Section 3) owns the spine. The customer-value bar (Section 1 invariant) is the gate. The YAML data layer (Section 4) is the measurement. The calibration loop (Section 7) is the compounding bet.

### The invariants (non-negotiable)

Each is cited from its source memory file. An agent that violates one is auto-killed (Section 8); a tier that cannot run without violating one does not run.

| # | Invariant | Source |
|---|---|---|
| I-1 | **Memory is truth.** Durable state lives in `~/.claude/projects/C--agentplain/memory/`. Provider session memory is performance, never correctness — every agent reads durable state on every fire. | `feedback_cold_start_safe_agents`, `feedback_agentplain_built_by_agents` |
| I-2 | **The Librarian is a singleton.** All writes to *formatted* memory files go through the Librarian. Every other session appends to `INBOX.md` only and never edits a formatted file. | This spec (Section 3); INBOX protocol per `INBOX.md` |
| I-3 | **The customer-value bar is the ship gate.** Every wave self-scores 4+/5 on "an owner with a $10K/mo problem says *holy shit*" — or it does not open a PR. | `CUSTOMER_VALUE_WAVES_2026_06_09` ("self-scores 4+/5 … or doesn't open a PR") |
| I-4 | **The Conner-dead bar is the survivability gate.** Every surface either self-heals, self-routes (human paged with context + deadline ≤24h), or fails loud (graceful degrade + human paged + customer told). Silent failure is the only failure. | `FLEET_RUNS_FLEET_PLAN_2026_06_10` |
| I-5 | **No `HUSKY=0` bypass.** The pre-push gate runs `build:no-migrate`. Use `PRISMA_GENERATE_NO_ENGINE=true` to pass it; never disable the hook. (`HUSKY=0` is correct *only* when another wave's uncommitted files break *your* build in the shared tree — which is itself banned; use a worktree.) | `feedback_parallel_waves_use_worktrees`, `project_prisma_no_engine_unblocks_prepush`, `project_schema_drift_baseline_for_raw_indexes` |
| I-6 | **The prod API key is paused as policy, not by accident.** `ANTHROPIC_API_KEY` is sentinel-paused. LLM-dependent surfaces must degrade gracefully ("Plaino's catching his breath"). Do not treat the pause as a bug to "fix" by un-pausing; restoring it is a Conner-blocking decision (Section 6). | `project_e2e_247_audit_2026_06_14` ("LLM paused by policy"), `SIGNUP_TO_GO_AUDIT_2026_06_10` |
| I-7 | **Conner-time is Max/Custom only.** The pricing ladder (Option C) sells Conner's hours only at the Max tier and in `/custom` engagements. The loop never spends Conner's attention on work a tier can do autonomously. | `project_money_gtm_pack_2026_06_14`, `project_stripe_both_surfaces` |
| I-8 | **Worktree per wave; rebase first; sequential for overlapping PRs.** Parallel waves isolate into `git worktree add C:\agentplain-<name>`. Every code task starts fetch + checkout main + pull --ff-only + rebase. Overlapping PRs land sequentially. | `feedback_fleet_waves_use_worktree`, `feedback_code_tasks_rebase_first`, `feedback_sequential_not_parallel_for_overlapping_prs` |
| I-9 | **No silent vendor lock-in; adapter pattern mandatory.** Every vendor SDK call lives in `lib/<domain>/` behind an abstraction with a second implementation. Scattered direct calls are a code-review block. | `feedback_no_silent_vendor_lock`, `feedback_runner_portability`, `project_living_portable_architecture` |
| I-10 | **No outbound from agentplain's surface.** Agents advise and draft; the customer system executes outreach. No Twilio/SendGrid/dialers on agentplain's side. (Webhook *receivers* and the fleet's own ops email via the `pageHuman`/`lib/email` seam are fine.) | `project_no_outbound_architecture` |
| I-11 | **No guesses, no estimates — cite the artifact.** Every claim cites a file path, git ref, API response, or vendor doc URL with date read. This spec's own claims obey this rule. | `feedback_no_guesses_no_estimates` |
| I-12 | **The fleet does not merge.** Waves push branches and open PRs; Conner (or a Conner-greenlit human) merges. The fleet self-scores below 4 → no PR. | `FLEET_RUNS_FLEET_PLAN_2026_06_10` standing constraints |
| I-13 | **Customer vocabulary on customer surfaces.** Never expose engineer labels ("rooting", "live", agent counts) on product surfaces. Use the internal→customer map. | `feedback_customer_vocab_not_engineer`, `feedback_everything_tells_a_story` |

> **Invariant precedence.** When two invariants tension (e.g. I-3 "ship value fast" vs I-4 "survivable"), the *safety* invariant wins: I-4, I-6, I-10 outrank I-3. You may ship less, never less-safe.

---

## Section 2 — The 5-tier loop

The loop runs five tiers at different cadences and budgets. Lower tiers are continuous and cheap; higher tiers are episodic and expensive. **Total envelope: ~$3–5k/week steady-state, $5–8k in a burst week.** Every tier obeys the Section 1 invariants; every tier has Librarian touchpoints (Section 3) and decision routing (Section 6).

Budget enforcement is mechanical: before a tier fires, it reads `memory/data/budget-state.yaml` (Section 4) and refuses to start if its week-to-date burn already exceeds its cap. Cost is *estimated* from model + tokens at completion and logged to `session-costs.yaml`; the Librarian rolls those into `budget-state.yaml` (Section 3).

> **Cost figures are planning targets, not measured actuals** (I-11). They are derived from the model-mix and token assumptions in `project_production_growth_plan_2026_06_05` (a heavy workspace's Anthropic tokens run $162–279/mo). Replace every figure here with measured values from `session-costs.yaml` once Week-1 data accumulates (Section 7).

### Tier 1 — Continuous

| Field | Value |
|---|---|
| **Trigger** | Schedule. Watchdog every 30 min; PR sweep every 30 min; Librarian INBOX processing every 15 min; Librarian WORKING_STATE refresh every 15 min; YAML refresh every 30 min. |
| **Scope** | Heartbeat work only: liveness checks, PR mergeability sweep, memory processing, state refresh. **Not** here: any code change, any customer-facing edit, anything that opens a PR. |
| **Model** | **Haiku** for watchdog + PR sweep (mechanical reads). **Sonnet** for the Librarian (judgment: which INBOX entries are durable vs ephemeral). |
| **Budget cap** | ~**$10/day**. |
| **Librarian touchpoints** | *This tier contains the Librarian.* It reads `INBOX.md`, the formatted memory files it may update, and the YAML data files; it writes formatted memory, `WORKING_STATE.md`, `INBOX_PROCESSED.md`, and all five YAML files. See Section 3. |
| **Decision routing** | Fully autonomous. The only Conner output is a sentinel alert if the watchdog finds a silent-fail (notify-only, Section 6). |
| **Failure modes + recovery** | *Watchdog itself dies* → heartbeat-staleness metric in the fleet-health cron (`lib/ops/fleet-health.ts`, `OPS_FLEET_HEALTH_LAST_SUCCESS`) breaches at 48h and pages the designated human (I-4). *Librarian processes a bad entry* → `INBOX_PROCESSED.md` holds the full decision history; roll back (Section 8). *PR sweep finds an unmergeable PR* → records it to `WORKING_STATE.md` "open PRs" and surfaces in the morning brief; never auto-resolves a conflict. |

### Tier 2 — Daily

| Field | Value |
|---|---|
| **Trigger** | Schedule + Conner-input. Morning brief 06:30 ET; evening synthesis 19:00 ET; autonomous polish drawn from the audit queue continuously through the day; hot fixes on Conner-screenshot input (event). |
| **Scope** | Morning brief (state + Conner queue + overnight results). Evening synthesis (what shipped, what's blocked, calibration deltas). Autonomous polish: small, well-scoped fixes from the standing audit queue (copy nits, a11y, the pricing-drift class of finding, single-file corrections). Hot fixes: a Conner screenshot of a broken surface → diagnose + fix + PR, no-ask. **Not** here: multi-file features, schema changes, anything self-scoring <4 that isn't a defect fix. |
| **Model** | Brief + synthesis: **Sonnet**. Autonomous polish: **Haiku** for mechanical, **Sonnet** for judgment, **Opus** only when the fix is genuinely hard — the session picks by difficulty and records the choice in `session-costs.yaml`. Hot fixes: **Opus** (a broken customer surface is worth the best model). |
| **Budget cap** | Brief + synthesis ~**$20 each**. Autonomous polish cap **$300/day**. Hot fixes up to **$150/fix**, no-ask. |
| **Librarian touchpoints** | *Before:* every Tier-2 session reads top-of-MEMORY.md + WORKING_STATE.md + the task-relevant YAML (polish reads `cv-bar-scores.yaml` for templates that produced 4+; hot fixes read nothing extra). *After:* appends an observation to `INBOX.md` (what was found/shipped, self-score, cost) per the inbox protocol. The morning brief is *generated by* the Librarian from `conner-queue.yaml` + overnight `session-costs.yaml` rows. |
| **Decision routing** | Autonomous: polish + hot fixes. Notify-only: brief + synthesis go to Conner as information. A polish item that grows past one PR's worth of scope stops and files a `conner-queue.yaml` item rather than ballooning (I-7 — don't spend Conner's merge attention on scope creep; file it, let him greenlight a wave). |
| **Failure modes + recovery** | *Polish exceeds daily cap mid-run* → auto-kill, state preserved, item returned to audit queue (Section 8). *Hot fix can't reproduce the screenshot* → does not guess (I-11); replies in the brief with what it checked and asks Conner for repro steps. *Brief can't read a YAML* → renders with a loud "DATA MISSING: <file>" line, never silently omits. |

### Tier 3 — Weekly

| Field | Value |
|---|---|
| **Trigger** | Schedule + Conner-greenlight. Monday strategic review (auto-fires, notify-only output). Wednesday customer-journey re-walk (auto). 2–3 targeted feature waves per week (**Conner-greenlit** — the wave plan is proposed Monday, fired on his go). |
| **Scope** | Monday review: full state-of-the-fleet against the customer-value bar + the audit queue + calibration deltas; proposes the week's wave plan. Wednesday re-walk: signup→go customer-journey audit (the recurring audit class; see `SIGNUP_TO_GO_AUDIT_2026_06_10`, `project_e2e_247_audit_2026_06_14`). Feature waves: a scoped customer-value feature, one worktree each, self-scored 4+ to PR. |
| **Model** | Monday review: **Opus (1M context)** — it must hold the whole fleet state. Wednesday re-walk: **Opus** (judgment-heavy audit). Feature waves: **Opus** for the build, **Sonnet** for sub-tasks, per the wave's own decomposition. |
| **Budget cap** | Monday review ~**$300**. Wednesday re-walk ~**$200**. Feature waves ~**$500–800 each**. **Tier-3 weekly cap ~$2,500.** |
| **Librarian touchpoints** | *Before:* Monday review reads everything — MEMORY.md, WORKING_STATE.md, all five YAML files, INBOX_PROCESSED.md (to see what was decided). It is the single biggest memory *reader* in the loop. *After:* it writes a strategic-review observation to INBOX and the proposed wave plan to `conner-queue.yaml`. Each feature wave reads task-relevant memory before acting and appends its result (self-score, cost, outcome) to INBOX. |
| **Decision routing** | Monday review + Wednesday re-walk: notify-only. **The wave plan requires Conner greenlight** (Section 6) before any wave fires. Any single wave projected >$500 needs explicit per-wave greenlight. |
| **Failure modes + recovery** | *Weekly cap exceeded* → remaining planned waves do not fire; the Librarian records the overrun in `budget-state.yaml` and surfaces it in the next brief. *A feature wave self-scores <4* → no PR (I-3, I-12); the session writes *why* to INBOX so the calibration loop learns the prompt didn't land. *Two waves collide in the shared tree* → forbidden by I-8; each wave is in its own worktree, so this can't happen if the OS is followed — if it does, it's a process violation logged to INBOX. |

### Tier 4 — Wholistic attack (on-demand, 1–2/week typical)

| Field | Value |
|---|---|
| **Trigger** | Conner-greenlight (he authorizes an attack on a named problem) **or** the Monday review proposes one and he greenlights it. |
| **Scope** | A coordinated assault on one large problem too big for a single wave: a migration, an IA refactor, a full design sprint, a cross-cutting audit-and-fix. Four phases: (1) **planning packet** → (2) **coordinated execution** (6–10 parallel worktree sessions) → (3) **integration audit** → (4) **customer-journey verify**. |
| **Model** | Planning packet: **Opus (1M)**. Execution sessions: **Opus** per worktree (each is a real build). Integration audit: **Opus**. Customer-journey verify: **Opus/Sonnet**. |
| **Budget cap** | Planning ~**$500** → execution ~**$1.5k** → integration audit ~**$200** → journey verify ~**$150**. **~$2.5–4k per attack.** Cadence 1–2/week typical (folds into the steady-state envelope on light weeks, pushes toward burst on heavy ones). |
| **Librarian touchpoints** | *Phase 1* reads the full memory + YAML layer to build the packet, writes the packet to `docs/` and a pointer to INBOX. *Phase 2* — each of the 6–10 sessions reads the packet + its slice of memory and appends its own result to INBOX; the integration-merge step is the cheap place to catch cross-branch registry drift (proven by `registry-truth-guard-caught-cross-branch-gap`, INBOX 2026-06-10). *Phase 3/4* append audit verdicts to INBOX. The Librarian's 15-min processing keeps `WORKING_STATE.md` showing all 6–10 live orchestrators so nothing is lost if a session dies. |
| **Decision routing** | **Conner greenlight required to start** (Section 6). Within the attack, the planning packet turns every blocker into a mobile-tappable Conner action (the pattern from `night3_progress_2026_06_09` — "a decision packet that turns every blocker into a CONNER ACTION"). Phases 2–4 are autonomous once greenlit. |
| **Failure modes + recovery** | *A parallel session dies mid-attack* → cold-start-safe (I-1): its worktree branch + INBOX appends survive; another session resumes from durable state. *Integration audit finds the merge broke an invariant* → the attack does not open the final PR; it files the breakage to `conner-queue.yaml`. *Attack exceeds budget* → phases not yet started don't start; partial work is preserved on its branches and reported. |

### Tier 5 — Burst

| Field | Value |
|---|---|
| **Trigger** | **Conner-blocking** activation. He says "let's cook" (or explicitly authorizes a Tier-4 attack with caps lifted). Burst is a *mode*, not a schedule. |
| **Scope** | Pre-launch crunch, a full design sprint, a multi-attack IA refactor — work that needs more than the steady-state envelope for one week. Caps for that week are lifted (Tier-2/3/4 run without their normal ceilings, under the burst envelope). |
| **Model** | Whatever the work needs — predominantly **Opus**, including 1M context for planning. |
| **Budget cap** | **~$5–8k that week.** This is the only mode that exceeds the steady-state envelope, and only Conner can turn it on. |
| **Librarian touchpoints** | Same as the tiers it accelerates, but the Librarian's YAML refresh matters *more*: `budget-state.yaml` is the only thing keeping a burst week from running past $8k, so the 30-min YAML refresh is the live guardrail. The weekly roll-up (Section 7) treats a burst week as a labeled outlier so it doesn't poison the steady-state calibration baseline. |
| **Decision routing** | Conner turns it on (blocking) and turns it off. Inside the week, decisions route as the underlying tier (Tier-4 attacks still get their phase gates; only the *caps* lift, not the *safety* gates — I-4/I-6/I-10 still hold). |
| **Failure modes + recovery** | *Burst week never turned off* → the Librarian's weekly roll-up flags a week still in burst mode as a Conner action ("burst still on — confirm or end"). *Burst envelope exceeded* → same mechanical refusal as any cap; burst lifts the steady caps, it does not remove the $8k ceiling. |

---

## Section 3 — The Librarian as a first-class loop participant

The Librarian is the **singleton** (I-2) that owns all memory persistence. It is not a convenience; it is the spine that makes the loop stateful and the calibration loop possible. It runs continuously as part of Tier 1.

### The two rules every other session obeys

1. **Read relevant memory before acting.** Load the specific files the task needs — not all of memory, the *relevant slice* (the boot contract, Section 5, makes this mechanical). This is I-1 in practice: durable state on every fire, because provider session memory is performance, never correctness.
2. **Append observations to `INBOX.md`; never write a formatted memory file.** Every session that runs *must* append what it learned to `INBOX.md` per the inbox protocol (the YAML-frontmatter-per-entry structure already in `INBOX.md`: `ts`, `source`, `type-hint`, `suggested-name`, `observation`, `links`). Only the Librarian writes formatted files. A non-Librarian session that edits a formatted memory file is a process violation (Section 8).

> Why a singleton: concurrent writers to MEMORY.md and the formatted files cause exactly the drift that already pushed MEMORY.md over its size limit. One writer, one queue (INBOX), one decision log (INBOX_PROCESSED) — that is the only way the index stays loadable and the history stays auditable. This is the `feedback_librarian_pattern_in_every_orchestrator` principle made concrete: every orchestrator *feeds* the Librarian; only the Librarian *persists*.

### The Librarian's cadence

| Cadence | Action |
|---|---|
| **Every 15 min** | Process `INBOX.md`. For each entry: (a) **promote** → write a new formatted memory file with proper frontmatter + add a one-line pointer to MEMORY.md; (b) **merge** → update an existing formatted file rather than duplicate; (c) **drop** → ephemeral, relevant only to its conversation. Every decision (promote/merge/drop + why) is appended to `INBOX_PROCESSED.md`. Processed entries are removed from `INBOX.md`. |
| **Every 15 min** | Refresh `WORKING_STATE.md` — the short-term live-state file: which orchestrators are running (Tier 3/4 sessions), open PRs + mergeability (from the PR sweep), the Conner queue head, and current sentinel state (API key paused? budget caps breached?). This is the file Tier-2/3 sessions read to know "what is live right now." |
| **Every 30 min** | Update the five YAML data files (Section 4): append completed sessions to `session-costs.yaml`, roll those into `budget-state.yaml`, append landed-PR self-scores to `cv-bar-scores.yaml`, refresh `conner-queue.yaml` ages, and write calibration deltas to `calibration.yaml`. |
| **Daily** | **Decay sweep.** Verify that files/PRs/branches referenced in memory still exist. Demote stale memory to an archive section/file. (This directly serves the system-reminder rule: a recalled memory that names a file must still resolve — the decay sweep is what keeps that true.) |
| **Weekly (and every 2 weeks for the deep roll-up)** | **Roll-up.** Identify patterns from `INBOX_PROCESSED.md` + `session-costs.yaml` + `cv-bar-scores.yaml`, surface calibration learnings as new top-of-mind MEMORY.md entries, and write the deltas into `calibration.yaml` (Section 7). |

### Why the Librarian makes the loop compound

The Librarian's outputs are what make week 4 better than week 1. Without it, every session re-derives context and re-learns the same lessons (the record shows this: the inngest-route conflict was independently re-discovered *three times* in one day — see the three INBOX entries `inngest-route-is-the-recurring-rebase-seam`, `inngest-route-array-seam-refactor`). With it, the lesson is written once, decayed when fixed, and surfaced to the next session that would hit it. The calibration loop (Section 7) is only possible because the Librarian is continuously turning raw session output into structured, queryable data.

---

## Section 4 — The YAML data layer (the Librarian maintains it)

Five machine-readable files under `memory/data/`. They are the structured complement to the prose memory: prose holds *lessons*, YAML holds *measurements*. The Librarian is the only writer (I-2 extends to these); any session may read them per the boot contract (Section 5). All five are created on Day 1 of activation (Section 9).

> **Schema convention.** Each file is a YAML document with a top-level `schema_version: 1` and a list under a named key. Timestamps are ISO-8601 UTC. Costs are USD, *estimated* from model + token counts (I-11 — flagged estimated, never asserted as billed actuals). Append-only where noted; the Librarian compacts on the weekly roll-up.

### `memory/data/session-costs.yaml` — per-session ledger

Appended by the Librarian on session completion. Used by the Tier-3 cost retro and the calibration roll-up.

```yaml
schema_version: 1
sessions:
  - id: "wf_or_session_id"
    ts: "2026-06-15T13:40:00Z"
    tier: 2                      # 1–5
    task: "autonomous-polish: pricing-drift fix"
    model: "sonnet"             # haiku | sonnet | opus | opus-1m
    tokens_in: 184000
    tokens_out: 22000
    est_cost_usd: 4.10          # estimated, not billed
    outcome: "delivered"        # delivered | errored | killed
    pr: "https://github.com/cchambers6/agentplain/pull/NNN"  # or null
    self_score: 4                # cv-bar, null if not a shipping wave
    notes: "one-file fix, reused RoiCalculator pattern"
```

### `memory/data/cv-bar-scores.yaml` — per-PR customer-value self-scores

Appended when a PR carrying a self-score lands. Used to calibrate *which prompt templates produce 4+/5 work on the first try* (the heart of the compounding bet).

```yaml
schema_version: 1
scores:
  - pr: "https://github.com/cchambers6/agentplain/pull/NNN"
    ts: "2026-06-15T20:00:00Z"
    tier: 3
    template: "feature-wave-v1"   # the prompt template used
    self_score: 4                  # 1–5, ship gate is >=4 (I-3)
    reasoning: "owner with a $10K/mo problem says holy shit because <X>"
    first_try: true                # did it hit >=4 without a re-fire?
    refired: 0                     # number of re-fires before >=4
```

### `memory/data/calibration.yaml` — running calibration data

Updated by the Librarian on the weekly (deep: bi-weekly) roll-up. The accumulated learning about what works.

```yaml
schema_version: 1
updated: "2026-06-15T20:00:00Z"
prompt_patterns:
  - pattern: "lead with the Conner-dead bar in the PR body"
    effect: "raised first-try cv-bar from 3.1 to 3.9 avg"
    evidence: ["pr#224", "pr#219"]
    action: "baked into feature-wave-v2 template"
cost_surprises:
  - task_class: "customer-journey re-walk"
    estimated_usd: 200
    actual_avg_usd: 265
    action: "raise Tier-3 re-walk cap to 275"
refire_causes:
  - cause: "self-scored <4: copy too internal (engineer vocab leaked)"
    count: 3
    fix: "add I-13 vocab check to the polish template preflight"
```

### `memory/data/conner-queue.yaml` — Conner-decision-pending items

Auto-pulled into the morning brief. The single queue of things waiting on Conner.

```yaml
schema_version: 1
items:
  - id: "cq-2026-06-15-01"
    title: "Restore ANTHROPIC_API_KEY (prod LLM)"
    source: "I-6 / project_e2e_247_audit_2026_06_14"
    raised: "2026-06-14"
    age_days: 1                    # Librarian recomputes on each refresh
    recommended_default: "keep paused until launch crunch"
    priority: "high"               # high | med | low
    blocking_tier: 5               # which tier this gates, if any
```

### `memory/data/budget-state.yaml` — week-to-date burn + caps

Updated on every session completion. The mechanical guardrail: a tier refuses to fire if its week-to-date burn exceeds its cap.

```yaml
schema_version: 1
week_of: "2026-06-15"             # Monday of the current week
mode: "steady"                    # steady | burst
envelope_usd: 5000                # 5000 steady, up to 8000 burst
tiers:
  - tier: 1
    cap_usd_per_day: 10
    wtd_usd: 38.20
    status: "ok"                  # ok | warn (>=0.9 cap) | exceeded
  - tier: 2
    cap_usd_per_day: 300           # polish; +150/hotfix, +20x2 brief
    wtd_usd: 612.00
    status: "ok"
  - tier: 3
    cap_usd_per_week: 2500
    wtd_usd: 1180.00
    status: "ok"
  - tier: 4
    cap_usd_per_attack: 4000
    wtd_usd: 0
    status: "ok"
projected_eow_usd: 4100
```

---

## Section 5 — The auto-load contract

Every future session prompt **must** open with a boot-context block. It auto-includes this OS spec, the top of MEMORY.md (already auto-loaded by the harness), the current WORKING_STATE.md, and the YAML data files relevant to the task type. This is what guarantees an agent boots *stateful* instead of cold.

### Task-type → YAML map

| Task type | Reads (beyond OS spec + MEMORY.md + WORKING_STATE.md) |
|---|---|
| Cost-conscious / any tier firing under a cap | `budget-state.yaml` |
| UX / customer-surface / copy | `cv-bar-scores.yaml` (which templates landed 4+) |
| Strategic (Monday review, attack planning) | `calibration.yaml` + all four others |
| Brief generation | `conner-queue.yaml` + overnight `session-costs.yaml` |
| Pure polish / hot fix | `budget-state.yaml` only |

### The boot-context block (copy-paste ready)

Paste this verbatim at the top of any fleet session prompt. Replace the `<TASK_TYPE>` line per the table above.

```
## BOOT CONTEXT — agentplain operating system (read before acting)

You operate under the agentplain OS. Load these before doing anything:
1. OS SPEC (HOW we work — invariants, tiers, Librarian protocol, decision routing):
   docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md  — READ Section 1 (invariants) + your tier in Section 2.
2. MEMORY INDEX (auto-loaded): ~/.claude/projects/C--agentplain/memory/MEMORY.md
   Load the specific topic files relevant to this task — not all of memory.
3. LIVE STATE: ~/.claude/projects/C--agentplain/memory/WORKING_STATE.md
   (running orchestrators, open PRs + mergeability, Conner queue head, sentinel/API-key state, budget caps).
4. DATA (load per task type — <TASK_TYPE>):
   - budget-state.yaml   (always, if you might spend under a cap — refuse to fire if your tier is 'exceeded')
   - cv-bar-scores.yaml  (UX/copy/feature work — reuse templates that landed >=4)
   - calibration.yaml    (strategic/planning work)
   - conner-queue.yaml   (brief/synthesis)

NON-NEGOTIABLES (full list = OS spec Section 1):
- Memory is truth; read durable state, don't trust session memory (I-1).
- Append findings to INBOX.md per the inbox protocol; NEVER edit a formatted memory file — the Librarian owns those (I-2).
- Self-score every shipping wave on the customer-value bar; <4 → no PR (I-3).
- Conner-dead bar: self-heal, self-route (page a human ≤24h), or fail loud. Silent failure is the only failure (I-4).
- Never HUSKY=0; use PRISMA_GENERATE_NO_ENGINE=true to pass the pre-push gate (I-5).
- ANTHROPIC_API_KEY is paused by policy — degrade gracefully, don't "fix" it (I-6).
- Worktree per wave; rebase on origin/main first; overlapping PRs land sequentially (I-8).
- Adapter pattern behind lib/<domain>/; no scattered vendor calls (I-9).
- Cite the artifact for every claim — file path, git ref, API response, vendor doc + date (I-11).
- The fleet does not merge; push branch + open PR (I-12).

ON COMPLETION: append an INBOX.md entry (ts, source, type-hint, suggested-name, observation, links)
including your self-score, model, and estimated cost so the Librarian can log session-costs.yaml + cv-bar-scores.yaml.
```

---

## Section 6 — Decision routing (when Conner is needed)

Four lanes. The default is the most autonomous lane the work qualifies for; escalate a lane only when the matrix says so. The governing principle is I-7: **never spend Conner's attention on what a tier can do autonomously.**

| Lane | What routes here | What Conner does |
|---|---|---|
| **Autonomous** | Tier 1 (all); Tier 2 autonomous polish from the audit queue; hot fixes from Conner screenshots. | Nothing. Work happens; results appear in the brief. |
| **Conner notify-only** | Daily morning brief + evening synthesis; weekly Monday review + Wednesday re-walk; sentinel/fleet-health alerts. | Reads. No action required; he *may* act, but the loop doesn't block on him. |
| **Conner greenlight required** | Tier-3 weekly wave plan; Tier-4 wholistic attack; any single fire projected >$500; any policy change (a change to this spec or an invariant). | Says go / amend / no. The work is *staged and ready*; his greenlight releases it. |
| **Conner blocking** | Tier-5 burst-week activation; any new or changed cost cap; restoring the prod API key (I-6); any change to a *safety* invariant (I-4, I-6, I-10). | His decision is a precondition; nothing proceeds without it. These are the only things that truly stop the loop. |

> **The packet rule.** Anything in the "greenlight" or "blocking" lanes must reach Conner as a *mobile-tappable decision with a recommended default*, written to `conner-queue.yaml` and surfaced in the morning brief — never as an open-ended question. This is the `night3_progress_2026_06_09` pattern: turn every blocker into a CONNER ACTION with a default, so the answer is one tap, not an essay.

---

## Section 7 — The calibration loop (the compounding bet)

This is why the OS is worth building. The bet: **week 4 fires better prompts than week 1**, because the loop measures itself and tightens.

The mechanism:

1. **Every session logs.** On completion, each session's INBOX entry carries model + tokens + estimated cost + outcome + (for shipping waves) the cv-bar self-score and the template used. The Librarian turns these into rows in `session-costs.yaml` and `cv-bar-scores.yaml` (Section 4).
2. **Every 2 weeks, the Librarian rolls up.** It mines `INBOX_PROCESSED.md` + the two ledgers for patterns: which prompt templates produced 4+ on the first try, which task classes cost more than estimated, what caused re-fires. It writes these into `calibration.yaml` (Section 4) and surfaces the top learnings as new top-of-mind MEMORY.md entries.
3. **The patterns update the templates.** A pattern that demonstrably raised first-try cv-bar gets baked into the next version of the prompt template, and **this OS spec is re-versioned** (1.0 → 1.1 …). The templates and the spec evolve together; the version in the filename/header is the contract for what a session can rely on.
4. **The result compounds.** Concretely: the record already contains compounding-shaped evidence — "leading the PR body with the Conner-dead bar" correlated with the highest-scoring waves (`pfd/conner-dead-e2e` #224, `pfd/vertical-gating-refund` #219). The calibration loop is what turns that anecdote into a template default instead of a thing each session rediscovers.

> **Guardrail against false signal.** Burst weeks are labeled outliers in `budget-state.yaml` (`mode: burst`) and excluded from the steady-state cost baseline (Section 2, Tier 5). A re-fire driven by a Conner scope change is *not* counted as a template failure. The roll-up distinguishes "the prompt was weak" from "the world changed."

---

## Section 8 — Failure modes + safety

The loop is autonomous and spends real money, so its safety machinery is load-bearing. Four mechanisms:

1. **Silent-fail watchdog (Tier 1).** Runs every 30 min. The governing rule (I-4) is *silent failure is the only failure* — so the watchdog's entire job is to convert silence into noise. It cross-checks: are the scheduled tiers actually firing (heartbeat-staleness ≥48h → page, via `lib/ops/fleet-health.ts` `OPS_FLEET_HEALTH_LAST_SUCCESS`)? Did a sweep claim "live" but reach zero workspaces (the registry-truth class — `project_registry_truth_ci_guard_2026_06_10`)? Is a tier's `budget-state.yaml` status `exceeded` while it's still firing? Any yes → page the designated human with context + deadline.

2. **Kill switch.** Conner says **"pause fleet"** → all running sessions stop, all state is preserved (cold-start-safe, I-1: every branch + every INBOX append survives, so a paused fleet loses no durable work). Resume re-reads WORKING_STATE.md and continues. This is a Conner-blocking control (Section 6) and the bluntest safety instrument.

3. **Auto-kill on policy violation.** A session is killed mid-run if it: attempts `HUSKY=0` (I-5); invokes an unauthorized model for its tier (e.g. Opus on a Tier-1 watchdog); exceeds its cost cap mid-run (read from `budget-state.yaml`); edits a formatted memory file when it is not the Librarian (I-2); or attempts a merge (I-12). The kill preserves state and logs the violation to INBOX so the Librarian records it and the calibration loop can see if a template is steering sessions toward violations.

4. **Memory-corruption recovery.** If the Librarian promotes a bad INBOX entry into a formatted file, `INBOX_PROCESSED.md` holds the **full decision history** (every promote/merge/drop + the source entry + why). Recovery: find the bad promotion in INBOX_PROCESSED, revert the formatted file (git history on the memory dir is the backstop), and re-process. Because the Librarian is a singleton (I-2), there is exactly one write history to audit — no concurrent-writer ambiguity about who wrote what.

> **Defense in depth.** These four sit *on top of* the existing in-product Conner-dead machinery (the `pfd-1..6` self-healing pillars: `pageHuman`, key rotation, integration self-heal, L1 triage, counsel gating, fleet-health cron — all shipped PRs #217–#224). The OS-level safety here governs *the fleet that builds the product*; the pillars govern *the product*. Both report to the same designated human via the same `pageHuman` seam.

---

## Section 9 — First-week activation plan

Concrete sequence to get the loop running starting tomorrow (2026-06-15). Each step names its owner and its acceptance check.

### Day 1 (2026-06-15)

- **Scaffold the YAML layer** *(separate Sonnet task)*. Create `memory/data/` and the five files with `schema_version: 1` + an empty list + one seed row each (so readers never hit an empty-file parse error). **Accept:** all five files parse as valid YAML and the boot block's step-4 paths resolve.
- **Create the Librarian's durable files** *(Librarian task)*. Create `WORKING_STATE.md` (live-state schema: orchestrators / open PRs / Conner-queue head / sentinel state) and `INBOX_PROCESSED.md` (decision-history log, append-only). **Accept:** WORKING_STATE.md reflects the current open PRs from the PR sweep; INBOX_PROCESSED.md exists and is empty-but-valid.
- **Give the Librarian its new responsibilities** *(send_message to the existing Librarian session)*. Hand it Section 3's cadence (15-min INBOX processing + WORKING_STATE refresh, 30-min YAML, daily decay, weekly roll-up). **Accept:** the Librarian acknowledges and runs one full 15-min cycle, leaving an INBOX_PROCESSED entry.
- **Activate the morning-brief schedule** *(cron/schedule task)*. 06:30 ET daily, Sonnet, reads `conner-queue.yaml` + overnight `session-costs.yaml`. **Accept:** a dry-run brief renders from the seeded YAML without a "DATA MISSING" line.
- **Add this spec to MEMORY.md** *(Librarian, on processing the INBOX entry this PR ships)*. One top-of-mind index line pointing here. **Accept:** MEMORY.md index contains the OS-spec pointer.

### Day 2–3

- **First calibration data accumulates.** Tier-1 runs continuously; the first Tier-2 polish items and (if Conner greenlights) Tier-3 waves write the first real rows to `session-costs.yaml` and `cv-bar-scores.yaml`. **Accept:** ≥5 session rows and ≥1 cv-bar score by end of Day 3.
- **Budget guardrail proves out.** Confirm a tier reads `budget-state.yaml` and the Librarian's 30-min refresh updates `wtd_usd` after a real session. **Accept:** `budget-state.yaml` `wtd_usd` is non-zero and matches the sum of that tier's `session-costs.yaml` rows.

### Day 7 (2026-06-21)

- **First weekly strategic review fires** *(Monday review, Opus 1M)*. Reads the full memory + YAML layer, scores the fleet against the customer-value bar, and proposes the week's wave plan to `conner-queue.yaml`. **Accept:** a wave plan reaches Conner as a mobile-tappable greenlight item with recommended defaults — the loop has closed once.

### Acceptance for "the OS is live"

The loop is live when: (1) all five YAML files exist and are being written by the Librarian on cadence; (2) WORKING_STATE.md + INBOX_PROCESSED.md exist and update; (3) the morning brief renders from real data; (4) at least one tier has refused to fire (or been confirmed clear) against `budget-state.yaml`; and (5) the first Monday review has produced a greenlight-ready wave plan. Until all five hold, the OS is *activating*, not *active* — and the morning brief says which.

---

## Appendix A — Invariant → source-memory index

For audit. Every invariant in Section 1 is grounded in a memory file that exists today (verified against the memory dir on 2026-06-14):

- I-1 → `feedback_cold_start_safe_agents`, `feedback_agentplain_built_by_agents`
- I-2 → this spec (establishes the singleton); inbox structure in `INBOX.md`
- I-3 → `CUSTOMER_VALUE_WAVES_2026_06_09`
- I-4 → `FLEET_RUNS_FLEET_PLAN_2026_06_10`
- I-5 → `feedback_parallel_waves_use_worktrees`, `project_prisma_no_engine_unblocks_prepush`, `project_schema_drift_baseline_for_raw_indexes`
- I-6 → `project_e2e_247_audit_2026_06_14`, `SIGNUP_TO_GO_AUDIT_2026_06_10`
- I-7 → `project_money_gtm_pack_2026_06_14`, `project_stripe_both_surfaces`
- I-8 → `feedback_fleet_waves_use_worktree`, `feedback_code_tasks_rebase_first`, `feedback_sequential_not_parallel_for_overlapping_prs`
- I-9 → `feedback_no_silent_vendor_lock`, `feedback_runner_portability`, `project_living_portable_architecture`
- I-10 → `project_no_outbound_architecture`
- I-11 → `feedback_no_guesses_no_estimates`
- I-12 → `FLEET_RUNS_FLEET_PLAN_2026_06_10`
- I-13 → `feedback_customer_vocab_not_engineer`, `feedback_everything_tells_a_story`

## Appendix B — New constructs this spec establishes (did not exist before 2026-06-15)

These are created by the activation plan (Section 9), not pre-existing. Flagged so no future session mistakes them for already-shipped state:

- The **Librarian singleton charter** (Section 3) — formalized here; a `LIBRARIAN_CHARTER.md` may be split out by the Librarian on first roll-up.
- `WORKING_STATE.md` — created Day 1.
- `INBOX_PROCESSED.md` — created Day 1.
- The `memory/data/` YAML layer (all five files) — created Day 1.
- The five-tier cadence + budget caps — proposed here, ratified by Conner's greenlight on the first wave plan.

The mechanics that **already exist** and this spec only *references*: the INBOX protocol (`INBOX.md`), the `pageHuman` seam + fleet-health cron (PRs #217–#224), the fleet push/PR mechanism (`project_fleet_push_pr_mechanism`), the worktree discipline (`feedback_fleet_waves_use_worktree`), and the customer-value + Conner-dead bars (`CUSTOMER_VALUE_WAVES_2026_06_09`, `FLEET_RUNS_FLEET_PLAN_2026_06_10`).

---

*This document is versioned. Changes to invariants (Section 1) or tier budgets (Section 2) are policy changes (Section 6, Conner-greenlight or -blocking) and bump the version. The calibration loop (Section 7) drives minor versions as prompt templates tighten.*
