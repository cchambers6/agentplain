# What Finance & Ops must stop doing

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops
Each stop names the habit, the evidence it's real, and the replacement behavior. These are self-directed — Finance & Ops' own failure modes, not other departments'.

---

## 1. Stop building meters without wires

**Evidence:** `stampSessionCost()` shipped in the kaizen loop (PR #273), was flagged unwired in the same PR's follow-ups, and three weeks later still has zero call sites and a zero-row table. The budget-state YAML, cv-bar scores, and conner-queue all share the pattern: schema built, writer never connected (kaizen 9/10: "YAML layer 0 rows ever").
**Replacement:** definition of done for any finance instrumentation = a caller at every seam + a read-back showing a real row. `01` §5's four acceptance criteria are the template.

## 2. Stop letting forward-estimate models age without a re-baseline date

**Evidence:** `docs/business-plan/unit-economics.md` is dated 2026-06-14, status "decision input, not ratified," carries its own instruction to re-baseline against `LlmUsageRecord` — and its §7 action items (Haiku rates, model routing) sat unactioned for three weeks (kaizen friction #3, #4).
**Replacement:** every modeled document carries an expiry tied to an event (e.g. `02` §5: re-issue within 14 days of un-pause or delete the cells). A model without a scheduled meeting with actuals is fiction on a delay.

## 3. Stop approving — or drifting into — new spend before the first partner

**Evidence:** the kaizen retro's own investment list (#1: Axiom/Datadog) points at a vendor subscription while the company has zero revenue and a NULL spend ledger. The kill list held paid media; the same discipline applies to tooling.
**Replacement:** the standing rule in `00`: zero new spend commitments until the first design partner signs. Telemetry runs on the YAML layer + existing crons, which are sufficient at this volume. Any exception is a written payback case against the $370-CAC / 2-month box.

## 4. Stop treating the paused key as a finance steady-state

**Evidence:** master synthesis §6.2 — "the product routinely demos its own outage." Every week paused with no prospect motion is a week the margin model can't meet actuals and the sales funnel can't show live value. The pause is correct **policy** (ratified, two-condition), but Finance & Ops was drifting toward treating $0 token spend as the goal rather than as a waiting state.
**Replacement:** the governor certification (`04`) is held ready so the pause ends the day the conditions are met, with zero finance-side lag. The metric is un-pause readiness, not months at $0.

## 5. Stop deferring the re-tier / reconciliation pass "for missing data"

**Evidence:** kaizen friction #6 — zero references to any re-tier mechanism in code; the audit "keeps getting deferred for missing data" and has no mechanism to defer to.
**Replacement:** the missing data is what `01` delivers. The monthly reconciliation (workspace `verticalTier` + manual price vs live subscription + usage) gets a design date 30 days after telemetry acceptance — a real deferral with a trigger, not an indefinite one.

## 6. Stop producing finance analysis faster than finance numbers

**Evidence:** this is the fourth finance-adjacent document set since mid-June (unit economics, kaizen retro, CEO pass, this) — all built on the same modeled COGS and the same NULL actuals. The master synthesis said it of audits; it applies here: analysis outran the ledger.
**Replacement:** after this PR, Finance & Ops publishes **no new modeled analysis** until the weekly digest reports two consecutive non-zero weeks. The next finance document is the re-baseline with actuals, and its inputs are rows, not assumptions.

## 7. Stop relying on dashboards nobody scheduled

**Evidence:** kaizen friction #7 and #9 — no ops digest existed, and live operational state (Vercel green? Neon suspended? key state?) is unanswerable from the repo; "Vercel red compounds" precisely because nothing surfaces it.
**Replacement:** the weekly digest (`01` §4) is scheduled on the existing kaizen cadence, with key state and budget state as standing lines. Ops facts arrive on a schedule or they don't exist.
