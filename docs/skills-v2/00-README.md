# Skills catalog v2 — reusable fleet patterns (Fable upgrade of PR #370)

This directory packages the recurring capability patterns the agentplain fleet invented across the June–July 2026 builds into reusable, installable skills. Every skill traces to a **real, executed** pattern — each cites the PR#, file path, or memory that seeded it (Truth Wave; no fabricated skills). v1 lives at `docs/skills/` (PR #370); the per-skill improvements are summarized in [`DIFF-FROM-V1.md`](./DIFF-FROM-V1.md).

```
docs/skills-v2/
├── 00-README.md                ← the catalog index (you are here)
├── DIFF-FROM-V1.md             ← what changed per skill vs PR #370
├── cowork/                     ← 36 installable skills (SKILL.md dirs) — the CANONICAL texts
│   ├── capability-builder/     ← the meta-skill: turns new patterns into skills
│   ├── fleet-ops/ (14)         ← build / push / schedule / dispatch mechanics
│   ├── orchestration/ (9)      ← dispatching + coordinating agent passes
│   ├── governance/ (7)         ← truth / positioning / secrets gates
│   └── code-hygiene/ (5)       ← PR discipline, migrations, wiring
├── patterns/                   ← 5 cross-cutting INCIDENT DOSSIERS + index (not skill twins — see below)
├── orchestration/              ← ready-to-paste parametric prompt templates (3)
├── governance/                 ← the paste-in ratified-frame preamble + refresh checklist
└── code-hygiene/               ← ready-to-run push + PR runbooks with real paths (2)
```

**One text per skill.** In v1, each skill existed twice (a `patterns/` prose twin + a `cowork/` SKILL.md). v2 makes `cowork/**/SKILL.md` the single canonical text — self-contained, with a worked **example invocation** and `[[cross-links]]` — and repurposes `patterns/` as the *incident casebook*: one dossier per failure domain, every recorded incident with citation, feeding many skills at once.

## Install (Cowork/Claude Code global skills folder)

```powershell
# one skill
Copy-Item -Recurse docs/skills-v2/cowork/capability-builder $env:USERPROFILE\.claude\skills\
# a domain's worth: copy each leaf dir under cowork/<domain>/
```
Installed path is `~/.claude/skills/<skill-name>/SKILL.md`; the frontmatter `name` equals the directory name (the resolver matches on it). Restart/reload the session; confirm it appears in the available-skills list. Skills are self-contained — installable without this repo. One copy per `name` (v2 has no duplicate names by construction).

**Recommended first install: `capability-builder`** — it's the skill that mints the rest, and its rubric/anti-patterns keep a growing catalog honest.

## Invoke

Via the Skill tool or `/<skill-name>`. The `description:` frontmatter carries the trigger phrases — it is the matching surface. Only invoke skills that appear in the available-skills list.

## Catalog

### Meta
| Skill | Purpose | Seeded by |
|---|---|---|
| [capability-builder](./cowork/capability-builder/SKILL.md) | Pattern → skill, with a build/don't-build rubric, two worked examples, anti-patterns | how this catalog was built (v1 PR #370 → v2) |

### fleet-ops (14)
| Skill | Purpose | Seeded by |
|---|---|---|
| [isolated-worktree](./cowork/fleet-ops/isolated-worktree/SKILL.md) | Parallel-safe builds; junction mechanics; junction-first teardown | every wave; `feedback_worktree_remove_force_follows_junctions` |
| [fleet-token-push](./cowork/fleet-ops/fleet-token-push/SKILL.md) | Headless push via minted App token; 403/404 failure modes | every fleet PR; `docs/git-auth.md` |
| [push-verification](./cowork/fleet-ops/push-verification/SKILL.md) ★ | curl-200 + SHA evidence before any "pushed" claim | `feedback_push_verification_required` |
| [curl-per-pr-merge](./cowork/fleet-ops/curl-per-pr-merge/SKILL.md) | PR create/merge via raw REST, past the gh classifier; ready-not-draft | `.mk-pr.mjs`; 07-07/08 sweep |
| [detached-worktree-rebase](./cowork/fleet-ops/detached-worktree-rebase/SKILL.md) ★ | Rebase a branch that's checked out elsewhere; `--force-with-lease=<branch>:<sha>` | `feedback_detached_worktree_rebase_pattern` |
| [rebase-first-full-build](./cowork/fleet-ops/rebase-first-full-build/SKILL.md) ★ | Rebase both ends of a task; full build after union rebases (broken hooks won't) | `feedback_code_tasks_rebase_first` + union-dup incident |
| [sequential-landings](./cowork/fleet-ops/sequential-landings/SKILL.md) ★ | Overlap audit, rebase-tax math, merge-train, HEAD-collision hazard | `feedback_sequential_not_parallel_for_overlapping_prs` |
| [stacked-pr-discipline](./cowork/fleet-ops/stacked-pr-discipline/SKILL.md) ★ | Never backmerge child→parent; leaf-to-root; verify content on main | `feedback_stacked_pr_backmerge_antipattern` |
| [heartbeat-governor](./cowork/fleet-ops/heartbeat-governor/SKILL.md) | Deterministic conductor: reconcile → gate → fire → tick | `docs/loop/prompts/L3-haiku-heartbeat.md` |
| [scheduled-task-liveness](./cowork/fleet-ops/scheduled-task-liveness/SKILL.md) ★ | The three dormancy modes: unscheduled / can't-dispatch / starved | COORDINATION §0.11; kaizen 10 |
| [scheduled-task-prompt](./cowork/fleet-ops/scheduled-task-prompt/SKILL.md) | Cold-start-safe, idempotent, never-blocks cron prompts | `docs/loop/RUNBOOK.md`; `feedback_cold_start_safe_agents` |
| [librarian-inbox-rollup](./cowork/fleet-ops/librarian-inbox-rollup/SKILL.md) | INBOX-append + single-writer memory + hydrate-from-primary-sources | `LIBRARIAN_CHARTER.md`; kaizen 10 |
| [payload-oversize-handling](./cowork/fleet-ops/payload-oversize-handling/SKILL.md) | Launch error ≠ no launch; verify via the session list | PR #352 "retry"; L3 STEP 1 |
| [dispatch-amend-in-flight](./cowork/fleet-ops/dispatch-amend-in-flight/SKILL.md) | Live message vs durable nudge; amend without restarting | loop nudge mechanics |

### orchestration (9)
| Skill | Purpose | Seeded by |
|---|---|---|
| [head-of-department](./cowork/orchestration/head-of-department/SKILL.md) | 14-day executive plan, exit tests, the ONE escalated decision | PR #356–#365 |
| [lens-pass](./cowork/orchestration/lens-pass/SKILL.md) | CEO / CoS / direction-check — one lens, bounded scope, decisions | PR #348/#350/#352 |
| [loop-track-pass](./cowork/orchestration/loop-track-pass/SKILL.md) | One design increment; typed deliverables; design FOR profitable | `docs/loop/prompts/*` |
| [kaizen-retro](./cowork/orchestration/kaizen-retro/SKILL.md) | Evidenced retro → deduped ranked fix queue + STOP list | `docs/kaizen/2026-07-02/` |
| [cross-department-coordination](./cowork/orchestration/cross-department-coordination/SKILL.md) | N plans → one sequence + handoff matrix + ONE bottleneck | PR #368 |
| [report-back](./cowork/orchestration/report-back/SKILL.md) | Verified, decision-dense pass summary with declines | every 2026-07 pass |
| [consolidated-decision-queue](./cowork/orchestration/consolidated-decision-queue/SKILL.md) ★ | One queue, defaults that fire, silence-unsafe exceptions, aging SLA | PR #352; COORDINATION |
| [orchestrator-prompt-hygiene](./cowork/orchestration/orchestrator-prompt-hygiene/SKILL.md) ★ | No slash prefix, no AskUserQuestion, visible replies, turn budgets | `feedback_no_slash_prefix_in_orchestrator_prompts` |
| [wait-gate-on-outcome](./cowork/orchestration/wait-gate-on-outcome/SKILL.md) ★ | Gate on artifacts, never on PR numbers or self-reports | `feedback_wait_gate_on_outcome_not_pr_number` |

### governance (7)
| Skill | Purpose | Seeded by |
|---|---|---|
| [ratified-frame-preamble](./cowork/governance/ratified-frame-preamble/SKILL.md) | The standing-decisions block for every decision-producing prompt | every 2026-07 orchestrator pass |
| [kill-list-discipline](./cowork/governance/kill-list-discipline/SKILL.md) ★ | Kills with restart triggers, named workstreams, logged overrides | `docs/kills/2026-07-03/RATIFIED.md` |
| [truth-wave-check](./cowork/governance/truth-wave-check/SKILL.md) | Claims trace to artifacts; funded claims only; no ghost citations | PR #290; kaizen F6 |
| [voice-gate-check](./cowork/governance/voice-gate-check/SKILL.md) | LLM-ese families A–D; exact scan scope incl. the outreach gap | `tools/brand/voice-gate.mjs`; PR #309 |
| [model-vendor-invisible](./cowork/governance/model-vendor-invisible/SKILL.md) | Vendor-invisible surfaces + the conversational never-confirm form | 2026-07-03 copy ruling |
| [no-secrets-in-chat](./cowork/governance/no-secrets-in-chat/SKILL.md) ★ | Pasted = burned; revoke with an SLA; mint fresh instead | `feedback_no_secrets_in_chat`; 23-day PAT |
| [placeholder-never-ships](./cowork/governance/placeholder-never-ships/SKILL.md) ★ | Token scan + launch gate + works-without-it fallbacks | 27 live "PLACEHOLDER" SVGs; `{{CALENDLY_LINK}}` |

### code-hygiene (5)
| Skill | Purpose | Seeded by |
|---|---|---|
| [prisma-migration](./cowork/code-hygiene/prisma-migration/SKILL.md) | Schema+migration together; unique stamps; P3009 = migrate resolve | `schema-drift.yml`; kaizen 01 |
| [docs-only-pr](./cowork/code-hygiene/docs-only-pr/SKILL.md) | Pure-docs diffs; propose vs implement boundary | PR #344–#368 |
| [no-scope-creep-fix](./cowork/code-hygiene/no-scope-creep-fix/SKILL.md) | Enumerated items only, best fix each, declines as deliverable | PR #369 |
| [brand-gate-check](./cowork/code-hygiene/brand-gate-check/SKILL.md) | R1–R5 ratchet; baseline vs allowlist; visual asset checks | `tools/brand/brand-gate.mjs` |
| [wired-not-just-built](./cowork/code-hygiene/wired-not-just-built/SKILL.md) ★ | Producers need consumers; grep the call site; first-fire proof | kaizen F1; guarantee leak |

★ = not in v1 as an installable skill (11 net-new; 4 more promoted from v1 pattern-only status).

## Guardrails for this catalog

- **No fabricated skills** — every Origin cites a real artifact; candidates that fail the [capability-builder rubric](./cowork/capability-builder/SKILL.md) are listed as candidates, not shipped.
- **Self-contained** — a SKILL.md applies with no repo and no conversation history.
- **Refresh dated facts** — the ratified frame's kills/lever/model-default age; the [refresh checklist](./governance/ratified-frame-preamble.md) says where each fact lives.
- **Dedup before adding** — sharpen an existing skill rather than shipping a twin.
- **Docs-only** — this catalog describes mechanics; applying a skill may run real commands, and the skill text says which.

## Provenance & scope

Extracted from merged work June 6 – July 4, 2026 (PR #146–#369, the 2026-07-02/03 docs waves) plus the fleet feedback-memory corpus. Where a source names something that never shipped (e.g. `scripts/mint-fleet-token.mjs` in this repo), the skill says so instead of citing the ghost.
