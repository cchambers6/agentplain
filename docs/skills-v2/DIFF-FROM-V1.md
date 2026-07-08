# DIFF-FROM-V1 — what the Fable upgrade changed vs `docs/skills/` (PR #370)

v1 (Opus 4.8, 2026-07-08 overnight): 52 files — 21 installable skills + 24 pattern twins + 6 top-level artifacts. Solid extraction of the obvious patterns; thin on worked invocations; duplicated every skill across two layers; missed most of the failure-shaped mechanics that live in the fleet feedback memories.

v2 (this tree): **36 installable skills** (11 net-new, 4 promoted from pattern-only, 21 upgraded), 5 incident dossiers replacing the 24 twins, 6 tightened top-level artifacts, and a hardened capability-builder. Every v2 claim was re-verified against the corpus — including two places v1's own facts had gone stale (below).

## Structural changes

| v1 | v2 | Why |
|---|---|---|
| Each skill duplicated (patterns/*.md + cowork SKILL.md) | **One canonical SKILL.md per skill**; `patterns/` becomes 5 cross-cutting **incident dossiers** (windows-worktree, github-auth, parallel-collisions, dispatch-sessions, built-but-unwired ledger) | Twins drift; dossiers add what per-skill files can't — the full incident record per failure domain, feeding many skills |
| No example invocations | **Every SKILL.md carries an "Example invocation"** (input → output shape) | The single biggest usability gap in v1 |
| Prose "see also" links | **`[[skill-name]]` dependency edges both directions** on every skill | Composability is the point of a catalog |
| Duplicate-name collision warning in README | No duplicate names by construction | v1 shipped the hazard it warned about |

## Corrections to v1 content (both verified against sources)

1. **Kill list: v1's ratified-frame preamble froze FIVE kills; `docs/kills/2026-07-03/RATIFIED.md` has SEVEN** (#6 paid-media hold, #7 no-new-surface-area were missing). v2 carries all seven with their restart triggers, and adds the refresh-checklist table (fact → source-of-truth file) so the frame can't silently go stale again.
2. **Model default: v1 hardcoded "back to opus."** True at v1's writing and still the ratified default (`feedback_back_to_opus_2026_07_08`), but it's a *dated fact*, not a rule — v2 frames it as refresh-from-the-latest-memory with a conflict-flag instruction (same-day window changes are exactly how it drifts).
3. **Kept and strengthened:** v1's Truth-Wave catch that `scripts/mint-fleet-token.mjs` doesn't exist here was correct (re-verified on disk 2026-07-08); v2 adds *why* the ghost keeps reappearing (a same-named flatsbo-side minter in `feedback_no_secrets_in_chat`) and documents the real chain end-to-end from `docs/git-auth.md`.

## Net-new skills (11) — each traces to a recorded incident v1 didn't mine

| Skill | The incident it encodes |
|---|---|
| **push-verification** | silent 403 → branches falsely reported "pushed," GitHub 404 (2026-05-14) |
| **detached-worktree-rebase** | `--force-with-lease=<branch>:<sha>` from detached HEAD; bare form rejected (#219/#224) |
| **rebase-first-full-build** | union rebase duplicated a const in a file nobody edited; broken tsx hook exits 0 (#224) |
| **sequential-landings** | 5 parallel PRs = ~3h rebase tax; concurrent tasks switched each other's HEAD |
| **stacked-pr-discipline** | back-merges gave #220/#221 empty diffs; #222 `merged=true` with content stranded off main |
| **scheduled-task-liveness** | governor dormant (#349); Dispatch MCP unreachable 17 days (triage-only auto-fire); "fired 0" vs dead seeder indistinguishable |
| **orchestrator-prompt-hygiene** | `/goal` prefix swallowed the overnight mandate — 0 turns; AskUserQuestion wedge; invisible plain-text replies |
| **wait-gate-on-outcome** | #235 closed-unmerged while its fix was already on main — downstream gate deadlocked forever |
| **consolidated-decision-queue** | repo-YAML-vs-memory split-brain; the 23-day-unrevoked PAT aging in a queue with no SLA |
| **kill-list-discipline** | the RATIFIED.md anatomy: restart triggers, named workstreams, overrides logged inline (#354) |
| **no-secrets-in-chat** | pasted PAT = burned; safe-to-echo table; out-of-band replacement routing |
| **placeholder-never-ships** | 27 literal "PLACEHOLDER" SVGs live in prod; the `{{CALENDLY_LINK}}` dead-end |
| **wired-not-just-built** | `stampSessionCost` zero call sites (spend null 3 weeks); `recordSavedTime` 1-of-8 paths → wrongful refunds |

(13 rows: kill-list-discipline and placeholder-never-ships arrived via the GTM corpus; the count of eleven excludes the two v1 had as guardrail-lines inside other skills.)

## Promoted from v1 pattern-only to installable (4)

`payload-oversize-handling` · `dispatch-amend-in-flight` · `wait-gate-on-outcome` · `consolidated-decision-queue` — v1 wrote these as library prose with no loadable form; they're precisely the ones a cold session needs mid-incident.

## Upgrades to carried-over skills (the load-bearing deltas)

- **capability-builder:** skeleton → hardened. Adds the 5-dimension build/don't-build **rubric** with calibration scores, the exact frontmatter contract (name=dir, description=matching-surface), a **second full worked example** that ends in "this is a rule, not a skill — bundle by failure mode" (the judgment v1's single clean example never exercised), and six **anti-patterns** (one-off patches, unstable APIs, deliverables-in-trench-coats, aspirational/ghost patterns, secrets-bearing runbooks, twins).
- **isolated-worktree:** names the *reason* junction-not-symlink matters (reparse point vs recursive delete), adds the `worktree remove --force` follows-junctions incident, the fresh-worktree husky gap, and the teardown liturgy.
- **fleet-token-push:** adds the 403/404 failure-mode table (404-on-private = auth), the ~1h TTL / re-mint-before-REST rule, and the full verified auth chain (PEM → JWT → helper → 0600 file).
- **curl-per-pr-merge:** adds ready-not-draft (mobile-merge incident), `mergeable≠compiles`, `merged=true≠on-main`, and the lagging-badge trap.
- **heartbeat-governor:** adds the single-governor/single-writer race rules, the mechanical-gate-only doctrine ("never edit worker output"), and the 4h/died-silently branches with their exact recoveries.
- **librarian-inbox-rollup:** adds the INBOX-append block (paste-ready), hydrate-from-primary-sources (the 17-day-stale YAML incident), ghost-file discipline, and snapshot pruning.
- **report-back / head-of-department / lens-pass / kaizen-retro / cross-department-coordination:** verification-before-relay, ghost-source flagging, the quoted-verbatim lever discipline, built-but-unwired hunting, and the merge-train order — each now cites its reference output (#363, #348/#350, #368).
- **truth-wave-check:** adds the funded-claims rule (KILL #7 → security-page softening), the live-integration whitelist vs targeting-signals split, and the no-ghost-citations procedure step.
- **voice-gate-check / model-vendor-invisible / brand-gate-check:** exact scan scopes (incl. the `docs/outreach/` gap), the A–D family definitions with fixes, the conversational never-confirm form, scan-list drift, and the visual-verification rules for assets.
- **prisma-migration:** adds the duplicate-timestamp collision (8 on main), authoring-time-not-debug-time discipline, and the P3009 ruling.
- **scheduled-task-prompt / loop-track-pass:** the never-block rule, typo'd-UUID trap, allowed-paths + no-PR rationale, degraded-mode verdicts, and the design-FOR-profitable correction with its source quote.

## Recommendation

Close #370 in favor of this tree, or keep both for a week and diff in practice — Conner's call. v2 is a strict superset in coverage and was fact-checked against v1's own sources; the only argument for keeping v1 alive is comparing extraction quality across models, which `DIFF-FROM-V1.md` now documents statically.
