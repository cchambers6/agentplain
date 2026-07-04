# Redundant work — where the fleet is producing the same thing twice (or five times)

**Rule for this file: "redundant" requires a cited overlap — two artifacts answering the same
question. Kill/merge recommendations follow each.**

## 1. Four documents ranking the same five fixes

The overlap, item by item:

| Fix | Kaizen master §3 (first-5) | Audit MASTER top-20 | CEO Pass 1 `01` §5 | Direction check Move 1 |
|---|---|---|---|---|
| Connect-button / activation path | — (product rows) | rows 9–14 wave | gate 1 | fix 1 |
| Guarantee saved-time writers | #3 (guarantee leak) | audit 9 P0 row | gate 2 | fix 2 |
| `/how-it-works` redirect | — | audit 1 P0 row | inside gate 1/3 | fix 3 |
| Server-side CI floor | #2 | pattern-level fix | inside gate 5 | fix 4 |
| Spend-pipeline / `stampSessionCost` wiring | #1 | pattern-level fix | gate 5 | fix 5 |

Four planning layers (PRs #343, #344, #348, #350) re-derived and re-ranked substantially the
same work while zero rows of it merged (PR #350 `03-sequencing-critique` error 1: "layers 3
through 8 largely re-rank the same top-20 fix table"). The direction check itself says a
fourth re-derivation "would be malpractice" — and this CoS pass declines to produce a fifth
list; `00-fleet-sequence` simply adopts the converged one.

**Ruling:** the converged five-fix list is now canonical; any future session that re-ranks it
instead of merging from it is off-mandate. Analysis tap closed per PR #350 stop-list 2.

## 2. Two Conner queues plus two more queue-shaped documents

- **Repo queue:** `memory/data/conner-queue.yaml` — the YAML data layer's queue file; zero
  rows ever written (PR #350 `00-direction-verdict` line 3; kaizen 09-data "YAML layer 0 rows
  ever").
- **Fleet-memory queue:** `conner-queue.yaml` on the Librarian's memory mount — 5 live pending
  items, maintained since June (verified this session: `design-partners-on-record`,
  `legal-entity-ip`, `company-postal-address`, `weekly-email-dedupe`, `revoke-flatsbo-pat`).
- **CEO Pass 1 `04-open-questions`** — 5 decisions, overlapping items 1–2 of the above and
  adding key-trigger / flatsbo / kill-list ratification.
- **Direction check Move 2 (Decision Pack)** — specifies aggregating "the 6 kaizen
  contradictions + the 6 sales-plan blocking decisions" into the repo queue.

Four artifacts, one underlying set of ~8 decisions. Worse than duplication: the split-brain
means PR #350 truthfully reported "queue has 0 rows ever" about the repo file while a
populated queue existed on the memory mount — the machinery designed to surface Conner's
decisions can't even agree where the queue lives.

**Ruling:** one queue. The Decision Pack PR (fleet-sequence day 2–7 item 6) merges
fleet-memory rows + CEO 04 + the contradictions into the repo `memory/data/conner-queue.yaml`
(version-controlled, readable by every session), and the Librarian's copy becomes a mirror,
not a second source of truth.

## 3. PR #349 institutionalizes the layers PR #350 orders stopped — while both are open

Loop v3's track table (`docs/loop/prompts/TRACKS.md`) allocates 50% of all governor-fired
passes to `ceo` (20%) + `chief-of-staff` (15%) + `product-owner` (15%) — perpetual analysis
lenses. The direction check, open simultaneously, freezes the expansion and closes the
analysis tap until fixes merge (PR #350 `04` §1–2). Both cannot be followed; today a session
obeying #349 violates #350.

**Ruling:** reconcile at landing (fleet-sequence day 0–2 item 2): #349 merges dormant,
governor unscheduled, restart-gated on #350's two conditions. Not redundancy in output yet —
redundancy in *directives*, which is more corrosive.

## 4. Marketing asset inventory vs zero distribution

51 outbound creative files + 31 claims-grounded outreach files + 25 ad concepts exist against
zero sends and a 0/4 paid gate (PR #350 `04-what-to-stop` §5; kaizen 05-sales "assets strong,
motion missing"). Additional asset production duplicates inventory that is already
depreciating unused.

**Ruling:** already stopped by #350 §5; restated here so the restart condition is visible —
paid gate met, or a real partner supplies proof material.

## 5. CPA journey depth passes queued for a lane closed by policy

`memory/data/loop/state.yaml` queues CPA depth for passes 3–4 while the sales plan closes CPA
until 2 RE pilots live (PR #350 `04` §4). Deepening maps for a closed lane duplicates the
analysis-over-execution error in vertical form; RE — the beachhead — has the shallowest map.

**Ruling:** re-order per #350 — RE depth stays, CPA/general depth drops from the queue.

## 6. Retro/synthesis passes reading unmerged inputs — self-inflicted rework

Kaizen master ran with 4 of 10 retros unmerged and read them from PR heads; retros 01/05/06/08
are cited from branches (kaizen MASTER header). The audit synthesis similarly ran with flatsbo
audits 3/5/7 existing only locally (`project_master_synthesis_2026_07_02` memory). Every
synthesis over unlanded inputs must be re-verified once they land — analysis that may need
doing twice. This CoS retry exists for the sibling reason: the first CoS session
(`local_b37ce9e4`) died before turn 1 and its brief had to be re-run whole.

**Ruling:** land-before-synthesize becomes a standing rule: no synthesis pass starts until its
inputs are ancestors of origin/main (`feedback_wait_gate_on_outcome_not_pr_number` already
encodes the general form).

## 7. Fleet-attention leakage: PR #351 and ~30 stale worktrees

PR #351 (draft, `claude/dewpoint-prediction-app-9q3oce` — a dew-point prediction app) matches
no plan, vertical, or memory rule on disk. The primary checkout `C:\agentplain` additionally
carries ~30 untracked worktree directories (`agentplain-w-*`, `agentplain-wt-*`, `wt-*`) and
stray one-off scripts (`.mk-pr*.mjs`, `pr-sweep.mjs`) from past waves (git status snapshot,
this session). Not redundant *work* so much as unreclaimed workspace that makes every future
session's picture noisier.

**Ruling:** close #351 unless Conner claims it; one hygiene commit (or scheduled sweep) prunes
dead worktrees — cheap, and it removes a whole class of "which checkout is real?" confusion.
The same sweep should note the ~260 `WORKING_STATE.md.preXXXX` backup snapshots the Librarian
already flags as bloat (`WORKING_STATE.md` hygiene note, 2026-07-03).
