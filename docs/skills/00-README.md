# Skills catalog — reusable fleet patterns

This directory packages the **recurring capability patterns** the agentplain fleet invented across the June–July 2026 builds into reusable, installable skills. Each one is extracted from a *real, executed* pattern — every entry cites the PR # or file path that seeded it (Truth Wave; no fabricated skills).

The catalog answers one question: *"we keep doing this same non-obvious thing — how do I make it a repeatable capability instead of re-deriving it every time?"* The answer is a skill. The skill that **builds** skills from new patterns is [`cowork/capability-builder/SKILL.md`](./cowork/capability-builder/SKILL.md).

## What's here

```
docs/skills/
├── 00-README.md                     ← you are here (the catalog index)
├── patterns/                        ← 24 prose primitives (the library reference)
├── cowork/                          ← 21 Cowork-installable skills (the loadable versions)
│   ├── fleet-ops/                   ← build/push/schedule/memory mechanics
│   ├── orchestration/               ← dispatching + coordinating agent passes
│   ├── governance/                  ← compliance / positioning / truth gates
│   ├── code-hygiene/                ← PR discipline, migrations, scoped fixes
│   └── capability-builder/          ← the meta-skill: turns new patterns into skills
├── orchestration/                   ← ready-to-paste parametric prompt templates
├── code-hygiene/                    ← ready-to-run push/merge runbooks
└── governance/                      ← the standing ratified-frame preamble
```

Two views of the same patterns:
- **`patterns/*.md`** — the *library reference*: when-to-use, inputs, procedure, guardrails, worked example. Read these to understand a pattern.
- **`cowork/<domain>/<skill>/SKILL.md`** — the *loadable* version: self-contained instructions a future Claude session pulls into context to *apply* the pattern (works with no repo checked out).
- The top-level `orchestration/`, `code-hygiene/`, `governance/` files are the **ready-to-paste** operational artifacts (parametric prompt templates + runbooks) the patterns reference.

## How to install a skill into Cowork's global skills folder

Cowork/Claude Code resolves skills by directory name. To install one:

1. Copy the skill's directory (the folder that **contains `SKILL.md`**) into your global skills folder:
   ```bash
   # macOS/Linux
   cp -r docs/skills/cowork/fleet-ops/isolated-worktree ~/.claude/skills/
   # Windows (PowerShell)
   Copy-Item -Recurse docs/skills/cowork/fleet-ops/isolated-worktree $env:USERPROFILE\.claude\skills\
   ```
   The installed path is `~/.claude/skills/<skill-name>/SKILL.md`, where `<skill-name>` matches the `name:` in the frontmatter.
2. Restart the session (or reload skills) so the new skill is discovered.
3. Confirm it appears in the available-skills list.

Skills are self-contained by design — you can install one without the rest of this repo. To install the whole catalog, copy every leaf directory under `cowork/` (each contains one `SKILL.md`).

> Note on `name` collisions: some skill names here (e.g. `curl-per-pr-merge` appears once) are unique, but a few concepts live in **two** places — `fleet-ops/curl-per-pr-merge` and `code-hygiene/…`. When installing, keep one copy per `name` to avoid a duplicate-name collision in the global folder.

## How to invoke a skill

Once installed, invoke via the **Skill tool** (or a `/<skill-name>` slash command in an interactive session):
- The `description:` frontmatter is what matches a skill to a user request — it carries the trigger phrases. When a user's ask matches, load the skill *before* doing the work.
- Only invoke a skill that appears in the available-skills list; don't guess names.

## Guardrails (read before adding or using skills)

- **No fabricated skills.** Every skill traces to a real PR/file. If you can't cite where the pattern actually ran, it's a candidate, not a skill. (Same discipline as `governance/truth-wave-check`.)
- **Self-contained.** A SKILL.md must apply from its own text — assume no repo, no prior conversation.
- **Name = directory**, kebab-case, so the resolver finds it.
- **Refresh dated facts.** Governance skills (kill list, biggest lever, model default) carry facts that age — pull current values before relying on them. See `governance/ratified-frame-preamble`.
- **Docs-only provenance.** This catalog is documentation. The skills *describe* mechanics (push flows, gates); they don't ship runtime code. Applying a skill may run real commands — the skill text tells you which.
- **Dedup before adding.** Check this index first; sharpen an existing skill rather than adding a twin.

---

## Catalog

### Meta
| Skill | Purpose | Seeded by |
|-------|---------|-----------|
| [capability-builder](./cowork/capability-builder/SKILL.md) | Turn a recurring pattern into a new installable skill | How this whole catalog was built (2026-07-08); mirrors the per-product `*-capability-builder` agents |

### fleet-ops
| Skill | Purpose | Seeded by |
|-------|---------|-----------|
| [isolated-worktree](./cowork/fleet-ops/isolated-worktree/SKILL.md) | Parallel-safe builds in a detached worktree w/ junctioned node_modules; junction-first cleanup | Every parallel wave; PR #369 |
| [fleet-token-push](./cowork/fleet-ops/fleet-token-push/SKILL.md) | Push from a headless/bot session via minted token + `--force-with-lease` | `.get-token.mjs` + `scripts/git/agentplain-fleet-credential-helper.ts` |
| [curl-per-pr-merge](./cowork/fleet-ops/curl-per-pr-merge/SKILL.md) | Create/merge PRs via raw REST past the gh auto-classifier | `.mk-pr.mjs`, `pr-sweep.mjs`; PR #306 |
| [heartbeat-governor](./cowork/fleet-ops/heartbeat-governor/SKILL.md) | A cheap deterministic conductor that schedules workers, not does their work | `docs/loop/prompts/L3-haiku-heartbeat.md` |
| [librarian-inbox-rollup](./cowork/fleet-ops/librarian-inbox-rollup/SKILL.md) | Roll loose notes into a deduped one-line-per-memory index | `MEMORY.md` convention |
| [scheduled-task-prompt](./cowork/fleet-ops/scheduled-task-prompt/SKILL.md) | Write a cold-start-safe, idempotent prompt for an unattended cron agent | `docs/loop/RUNBOOK.md`, `docs/loop/prompts/TRACKS.md` |

### orchestration
| Skill | Purpose | Seeded by |
|-------|---------|-----------|
| [head-of-department](./cowork/orchestration/head-of-department/SKILL.md) | Dispatch a "Head of {domain}" 14-day executive plan | `docs/departments/2026-07-03/*` (PR #356–#365) |
| [lens-pass](./cowork/orchestration/lens-pass/SKILL.md) | CEO / Chief-of-Staff / direction-check decision passes | `docs/ceo|chief-of-staff|planning/2026-07-02/` (PR #348, #350) |
| [loop-track-pass](./cowork/orchestration/loop-track-pass/SKILL.md) | Run one worker track of a continuous design loop | `docs/loop/prompts/{L1,L2}`, templates |
| [kaizen-retro](./cowork/orchestration/kaizen-retro/SKILL.md) | Structured retro → ranked, deduped fix queue | `docs/kaizen/2026-07-02/` (PR #273 loop) |
| [cross-department-coordination](./cowork/orchestration/cross-department-coordination/SKILL.md) | Reconcile many plans into one sequence + handoff matrix + one bottleneck | `docs/departments/2026-07-03/COORDINATION/` (PR #368) |
| [report-back](./cowork/orchestration/report-back/SKILL.md) | Compact decision-dense pass summary (PR URL + findings + decisions) | Every 2026-07 fleet pass report-back |

### governance
| Skill | Purpose | Seeded by |
|-------|---------|-----------|
| [ratified-frame-preamble](./cowork/governance/ratified-frame-preamble/SKILL.md) | Standing-decisions block prepended to every orchestrator prompt | Every 2026-07 orchestrator pass; PR #368 |
| [voice-gate-check](./cowork/governance/voice-gate-check/SKILL.md) | Catch LLM-ese + banned phrasing before copy ships | `npm run voice-gate`; PR #309 |
| [model-vendor-invisible](./cowork/governance/model-vendor-invisible/SKILL.md) | No vendor/model names on customer surfaces (except subprocessor lists) | `docs/copy-rulings/2026-07-03/model-vendor-invisibility.md`; brand-gate R1 |
| [truth-wave-check](./cowork/governance/truth-wave-check/SKILL.md) | Every claim traces to a real artifact; no guesses | Truth Wave (PR #290), trial policy (PR #262) |

### code-hygiene
| Skill | Purpose | Seeded by |
|-------|---------|-----------|
| [prisma-migration](./cowork/code-hygiene/prisma-migration/SKILL.md) | Generate + commit a migration on every schema change | `prisma/migrations/*`, `schema-drift.yml` |
| [docs-only-pr](./cowork/code-hygiene/docs-only-pr/SKILL.md) | Keep a documentation PR strictly under `docs/` | 2026-07 planning wave (PR #344–#368) |
| [no-scope-creep-fix](./cowork/code-hygiene/no-scope-creep-fix/SKILL.md) | Fix only the listed items; decline the rest with reasons | Overnight fix wave (PR #369) |
| [brand-gate-check](./cowork/code-hygiene/brand-gate-check/SKILL.md) | R1–R5 brand ratchet over changed UI/assets | `tools/brand/brand-gate.mjs`; PR #320, #232 |

## Provenance & scope

- **Window:** patterns extracted from merged work June 6 – July 4, 2026 (PR #146–#369 and the 2026-07-02/03 docs waves).
- **Docs-only:** this PR adds documentation only — no runtime code, no `lib/`, no brand assets.
- **Every skill is cited.** If a skill's "Origin/Seeded by" points at a file, that file existed at extraction time; where an early plan referenced something that never shipped (e.g. `scripts/mint-fleet-token.mjs`), the skill says so rather than citing a ghost.
