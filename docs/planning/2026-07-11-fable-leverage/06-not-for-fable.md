# Not for Fable — the Stop-Paying List (2026-07-11)

Work that is real and sometimes urgent, but where Fable adds nothing over Sonnet 5, Haiku, or a human with a checklist. Routing any of these to Fable is the single easiest way to waste the premium. Each row names the cheaper owner.

## Route to Sonnet 5 (or Haiku where marked)

| Work | Why it's mechanical | Evidence it's recipe-following |
|---|---|---|
| **PR merge trains, rebase-push, conflict resolution** | The recipes are fully written down and battle-tested. | `feedback_code_tasks_rebase_first`, the merge-wave memory (PR #384 era), the rebase-push recipe (PRs #295–306 heal pass) |
| **Worktree + junction plumbing, cleanup order** | Solved, documented, copy-paste. | `MSYS_NO_PATHCONV=1 cmd /c mklink /J`, rmdir-before-worktree-remove — recorded in three separate memories |
| **Token mint + push + PR-via-REST** | `.get-token.mjs` → REST calls; zero judgment. | Fleet push/PR mechanism memory; the ghost `scripts/mint-fleet-token.mjs` trap is documented |
| **Chiron repo move to `cchambers6/chiron`** | The move plan is already written. | `chiron/MOVE-TO-DEDICATED-REPO.md` (PR #381); blocked on Conner click-creating the repo, not on intelligence |
| **M3/M4 route, SSE, and cron wiring** | Prompts and schemas arrive from Fable sessions C1/C2; the wiring copies M1/M2 patterns. | `chiron/app/api/*` structure, PR #381/#383 |
| **M5 Registrar** | Rules code + golden-set comparison + CSV/PDF export against a written spec; the one ambiguous-case path is a Haiku call *in the product*, not in the build. | POC plan doc 04, M5 |
| **Bulk catalog extraction (the 64+ new curricula)** | Template-driven once C8's Fable-designed pipeline exists. **Haiku/Sonnet.** | C8 in `03-chiron-fable-queue.md` |
| **Prospect-list grinding when the research ban lifts** | Same shape: A4's pipeline runs on cheap models. **Haiku/Sonnet.** | A4 in `01-agentplain-fable-queue.md` |
| **AO volume downloads, corpus fetching, citation-count scripts** | curl with a Mozilla UA and grep. | CM pack memory (PR #385) |
| **Voice-gate/brand-gate allowlist entries, CI floor upkeep, schema-drift baseline entries** | Pattern-matching against documented gate behavior. | VE `^—$` pattern note (PR #385); drift-baseline recipe memory |
| **Test-failure triage against the known-41 baseline** | The baseline is ratified; re-diagnosing it is explicitly banned. | Send-path memory (PR #355): "don't re-diagnose" |
| **Vercel/hosting config, `ignoreCommand`, env plumbing, migrations** | Config with documented answers. | Apex-alias memory, Vercel-red memories (PRs #267, #307) |
| **Screenshot sweeps and pixel-crop verification** | Tool-driven; judgment lives in the ruling docs already written. | Plaino crop-gate memories (PR #232 era) |
| **Demo seed resets, dry-run scaffolding, observation templates** | Running `scripts/reset-demo.mjs` and filling templates. | PR #377 |

## Route to a human (Conner or counsel) — no model

| Work | Why |
|---|---|
| Entity formation, broker/license predicate, ToS/Privacy for flatsbo | Legal ownership is explicitly Conner's + counsel's (KILL #3; DPA hard-stop precedent PR #360). Models draft briefing material at most. |
| Click-creating `cchambers6/chiron` + fleet-app installation | GitHub App can't create user repos (403, PR #381) — it's literally a button only he can press. |
| Sending the Monday emails, taking discovery calls | The founder-led motion is the ratified lever (CEO Pass 1). The fleet drafts; Conner sends. |
| Chiron logo/mark | Real illustrator per the ratified brand rule — `mark.svg` stays empty (PR #381; `feedback_creative_assets_use_tools_or_humans`). |
| Pricing, naming, vertical greenlights | Ratified-decision territory; models propose, never decide. |

## The one habit to kill

**Refiring already-shipped work is the most expensive Fable waste observed to date.** The pattern appears repeatedly in memory: the TaxDome truth fix was already on main when the CPA brief asked for it (PR #382); two sessions nearly rebuilt finished worktrees before inventorying them (PRs #378, #383); ghost tasks (`scripts/mint-fleet-token.mjs`, audit 07, audit 05-sales) keep resurfacing in briefs. Standing rule for every Fable brief: **first 10 minutes = verify against main + open PRs + memory index that the work doesn't already exist.** A Sonnet pre-flight can do this check before a Fable session ever starts — that single habit likely saves more than every optimization in `05-cost-envelope.md` combined.
