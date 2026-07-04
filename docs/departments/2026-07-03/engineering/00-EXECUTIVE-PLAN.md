# Head of Engineering — next 14 days (2026-07-03 → 2026-07-17)

**Mandate:** design engineering FOR profitable. Every line below is a fix spec, an infra change, or a gate — no analysis items. The ratified frame governs: Conner's 5 Georgia-RE sends are the lever; the kill list is law (no new surface area, no LLM-dependent features against the paused key, portal flagged off, GTM = RE only); flatsbo stays live per Conner's override, which converts its open PII surface from "recommend" to "mandatory lock."

**Where main actually is:** `origin/main` is at the #347 merge. The CEO pass (#348), loop v3 (#349), direction check (#350), CoS pass (#352), outreach kit (#353), kills (#354), and send-path wave (#355) are all on unmerged branches. The single most important engineering fact this week: **our decision layer is not on main.** Landing that stack is scheduled before any new build.

**Model-window note:** Fable-max is available inside the plan-included window until Jul 7. All high-judgment work (guarantee wiring, RLS specs, CI-floor design review) is front-loaded into days 1–4; days 5–14 are mechanical execution any tier can run.

---

## Days 1–2 (Jul 3–4) — stop the bleeding, land the decision layer

1. **Merge train for the open stack** (#348 → #355, smallest/oldest first, sequential per the sequential-landings rule). Owner: one Opus code-task session per landing, HUSKY honored (no `HUSKY=0`). Exit: `git log origin/main` shows all seven; memory read-back confirms. Main not moving is why June findings were re-confirmed verbatim in July — this is the highest-leverage two days available.
2. **Guarantee money-leak fix** — the only defect that recurringly pays out real dollars. Full spec in `01-top-5-P0-fixes-to-burn-down.md` §1. Day-1 interim (ships in hours): flip the Day-7 walk-away cron to human-review mode so no refund email sends on an undercounted ledger. Day-2: wire the missing `recordSavedTime` writers.
3. **CI floor PR** — `pr-checks.yml` per `02-CI-floor-and-gates.md`. One workflow file; lands independently of everything else. Exit: a PR touching `app/` gets a red X server-side for the first time in this repo's history.

## Days 3–5 (Jul 5–7) — portal off, flatsbo locked, spend pipeline v1

4. **Portal flag-off + safety net** (kill #4, scoped to the S-effort net). Spec in `01-…` §2. Exit: `PORTAL_ENABLED` defaults off, RLS covers the 12 tables, `tests/portal-units.test.ts` green, invariant suites in CI.
5. **flatsbo unauthenticated-API lock** (top-20 row 1, S). Spec in `01-…` §3. The only flatsbo engineering spend this quarter. Exit: no anonymous read of PII, no offer forgery, no unauthenticated checkout mint.
6. **Spend telemetry v1** — wire `stampSessionCost` (zero call sites today) into the wave/dispatch template and stand up the rollup executor. Spec in `03-prod-key-unpause-readiness.md` §2. Exit: this very PR's session appears in `agent-state/` with a cost stamp; weekly rollup lands in `memory/data/`.

## Days 6–9 (Jul 8–11) — prod-key readiness package

7. **Cost-governor completion**: default per-workspace cap replacing the `NO_CAP` fallback in `lib/billing/budget.ts` (`resolveBudgetCapUsd`), `canSpend()` verified in every skill caller via the `gateSkillFire` seam, budget-alert sweep verified end-to-end. Full checklist in `03-…`. Exit: every item on the un-pause checklist is checked or has a dated owner; Conner gets a one-page go/no-go.
8. **Inert-controls truth pass** (top-20 row 12, S). Spec in `01-…` §4.
9. **Connector disclosure routing** (row 13 remainder — #355 already fixed api-key connect; the tile Connect still bypasses the #306 storage disclosure). Spec in `01-…` §5.

## Days 10–14 (Jul 12–17) — make the fleet cheap to run

10. **`fleet-ship.mjs`** — one door for mint-token/push/PR-create (kaizen tooling #1). Replaces the four-memory recipe and the root-level one-off scripts. Exit: this fortnight's last PR ships through it.
11. **`wt.mjs`** — worktree lifecycle (`wt new` / `wt done`) encoding the junction, EPERM, and backslash traps (kaizen tooling #3).
12. **Migration timestamp gate**: `uniq -d` duplicate-stamp check added to `schema-drift.yml`; timestamps minted machine-generated at rebase time. Kills the 82%-of-CI-failures class.
13. **Main-tree hygiene sweep, scheduled**: weekly job returns `C:\agentplain` to `main`, prunes merged worktrees, quarantines root strays. ~40 untracked root entries today → <5.
14. **PR size budget check** added to `pr-checks.yml` (≤800 insertions / ≤30 files, `size-exception` label override).

## Standing rules effective immediately

- **Definition of done = merged to main + a caller at every seam + read-back on `origin/main`.** No more "landed" claims against unmerged branches.
- **No recovery without a memory** — any bypass/heal/debug session writes the memory file in the same session; PR body links it.
- **Freeze list** in `05-what-eng-must-stop.md` is in force — no engineering cycles to frozen workstreams.

## What I am NOT doing (and why that's the design)

No new features, no new connectors, no new surfaces, no audits. The fortnight converts an unlanded backlog into a landed one, makes quality server-enforced instead of author-optional, and makes the paused key safe to turn back on the day Conner's prospecting starts. That is engineering's whole contribution to profitable this month, and it is enough — see `06-profit-contribution.md`.
