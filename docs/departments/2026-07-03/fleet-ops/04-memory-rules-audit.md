# Memory rules audit — stale, superseded, and contradictory entries

**Method:** scan of the code-side project memory (`~/.claude/projects/C--agentplain/
memory/` — 141 files + a 121-line MEMORY.md index), cross-checked against the loop
docs on origin/main, the PR #349 branch, open PRs #348–#355 via REST, and live disk
checks run this session. Per the mandate: findings + recommended follow-ups only; no
rules rewritten here. Every finding cites its artifact.

## Findings, ordered by bite risk

### F1 — A superseded "STOP the loop" recommendation is still live (highest risk)

`project_planning_direction_check_2026_07_02.md` records the verdict "STOP 9-track
loop (freeze dormant) until 'profitable' ratified + 1 backlog card ships."
`project_loop_v3_nine_tracks_2026_07_03.md` records Conner's later reframe: design FOR
profitable, **no stop condition**, milestone field removed — don't reintroduce. Both
are indexed as active. An agent that loads the direction-check first (it sits higher
in the index) has ratified-looking authority to freeze the loop the day we most need
it firing.
**Follow-up:** add a dated SUPERSEDED stamp inside the direction-check file scoped to
that one recommendation (the rest of its verdict stands), cross-linking the v3 memory.
One-file edit; Librarian N3 class going forward.

### F2 — Four rule slugs are cited as canonical but do not exist on disk

`docs/loop/00-DESIGN.md` § Constraint rules names them explicitly as missing:
`feedback_integrations_are_byo_key_by_default`,
`feedback_prod_anthropic_key_paused_is_policy`, `feedback_ai_cost_architecture_rules`,
`project_service_partnership_positioning`. The substance of each is ratified elsewhere
(PR #298 era, kaizen 7/10, `project_llm_provider_compose_order` +
`project_budget_seam_shared`, `project_sbm_wrapper_positioning_2026_06_06`) — the
files were briefed but never written (kaizen 9/10 finding). Every loop pass re-reads
that constraints section; each missing slug is a dangling pointer a pass may resolve
to nothing or, worse, re-derive differently.
**Follow-up:** write the four files from their named sources. Pure transcription, no
new rulings. Already flagged in 00-DESIGN as a backlog-card candidate; land it as one.

### F3 — The fleet push recipe contradicts itself across two memories

`project_fleet_push_pr_mechanism.md` (canonical recipe): the working minter is
`C:\agentplain\.claude\worktrees\mint-fleet-token.mjs`. The outreach-kit memory
(2026-07-03): "mint-fleet-token.mjs still absent → .get-token.mjs". **Verified this
session: the minter file exists at the documented path, and `.get-token.mjs` also
works** (it wraps the tsx credential helper and wrote a valid token). So the newer
memory is wrong on the "absent" claim, and there are now two working recipes with no
statement of which is preferred.
**Follow-up:** correct the outreach memory's claim; add one line to the mechanism
memory naming both paths and when each applies (plain-node minter vs credential-helper
wrapper). This recipe runs in nearly every wave; a wave that trusts "absent" wastes a
debugging cycle per agent.

### F4 — Three first-month/pricing framings coexist

- `project_stripe_both_surfaces.md`: "'first month free' is the only first-month
  framing"; pilot-pricing phrases banned (line 41/54 rulings).
- The same file and the index: launch pricing Regular $199→$99, Partner $299→$199 — a
  strike-through discount framing.
- `project_truth_wave_trial_policy_2026_06_14.md` (PR #262, shipped): 7-day trial
  (14d CPA/Law), CC-at-signup, 14-day money-back.
- Kaizen 5/10 independently flagged "'first month free' drift" in sales assets.

These are not strictly incompatible (a trial, an intro price, and a free month can be
distinct offers) but no memory says which is the customer-facing offer, and sales
assets already drifted once. This bites the Monday design-partner emails directly.
**Follow-up:** a single canonical offer memory (trial vs intro price vs free month,
one sentence each, what is banned) ratified against `lib/billing/facts.ts`. Flag to
the CoS/CEO tracks — fleet-ops surfaces, doesn't rule on pricing copy.

### F5 — Two memory systems, no cross-index (standing, unfixed)

Kaizen 10/10 friction #9, re-confirmed today: the four files this department was told
to read (`feedback_persistence_discipline`, `feedback_anything_useful_to_memory`,
`feedback_leadership_runs_autonomously`,
`project_agentplain_operating_system_greenlight_2026_06_15`) exist only on the Cowork
agent-memory mount, not in the code-side memory a repo session loads. The committed
`memory/LIBRARIAN_CHARTER.md` mitigates for the charter only.
**Follow-up:** the Librarian maintains a one-line-per-file stub index of mount-only
memories inside code-side MEMORY.md (pointer + one-line summary, not content), so a
repo session at least knows what it cannot see. Charter-compatible: it is a roll-up
output.

### F6 — Historical ledgers still resolve as instructions

Ten-plus June sprint files (`SPRINT_*`, `night3_*`, `OVERNIGHT_*`,
`fleet_runs_fleet_*`, `master_build_*`) carry completed one-shot state and stale
recipes (e.g. six of them embed the old fleet-token path). The index already fences
them ("read only if resuming that thread") — the risk is grep/recall hitting file
contents directly.
**Follow-up:** none new — this is exactly the Librarian's decay sweep. Add a
`status: archived` frontmatter line during its next pass; do not delete (they are the
provenance trail).

### F7 — Ratified-but-unexecuted rulings lack status flags

The kill list is ratified with 7 scrub targets "listed, not yet applied"
(`project_kills_and_copy_rulings_2026_07_03.md`); `stop_after` still exists in the
on-main RUNBOOK until PR #349 merges; KILL #3 is overridden (flatsbo live) inside a
memory whose headline says "7 kills". Each is accurate on close reading and misleading
on fast reading.
**Follow-up:** merge #349 first (removes the stop_after contradiction at the source);
add an "executed y/n" column to the kills memory when the scrub lands. Loop passes
must treat ratified-unexecuted as *do not re-propose, do not assume done*.

## Not contradictions (checked, fine)

`project_vertical_tier_mapping.md` is explicitly ARCHIVED and indexed as such.
Journey-loop v2 memory is marked superseded by v3. Media-as-discipline is closed with
a "don't re-open" note. The Plaino icon split, no-outbound, and vendor-invisible rules
are internally consistent across every file that cites them.

## Follow-up summary (recommend → land as separate small PRs / Librarian duties)

| # | Action | Owner | Size |
|---|---|---|---|
| F1 | SUPERSEDED stamp in direction-check memory | Librarian (N3) | 1 file |
| F2 | Write 4 missing rule files from named sources | any fleet session | 4 small files |
| F3 | Reconcile token-recipe memories, name both paths | fleet-ops | 2 edits |
| F4 | Canonical offer memory | CoS → Conner ratifies | 1 file + ruling |
| F5 | Mount-only stub index in MEMORY.md | Librarian | index edit |
| F6 | Archive-stamp June ledgers | Librarian decay sweep | frontmatter only |
| F7 | Execution-status flags on kills memory; merge #349 | fleet-ops | 1 edit + merge |
