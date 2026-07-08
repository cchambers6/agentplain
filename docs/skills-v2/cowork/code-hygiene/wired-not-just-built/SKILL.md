---
name: wired-not-just-built
description: A producer with no consumer is not shipped — verify every new capability is actually called, registered, and firing before claiming it done. Use when landing any instrumentation, cron, skill, notifier, or data writer; when a metric reads null/zero for weeks; or when auditing why a shipped feature never produced output. Grep for the call site; run the first fire.
---

# Wired, not just built (producers need consumers)

The fleet's most expensive quiet failure: modules that ship, compile, test green — and are never called. The retro sweep found a whole family at once, including one that was **paying out money on a counting bug**.

## The recorded instances (grep-verified, 2026-07-02)

- **`stampSessionCost` — zero call sites** outside its own test. The populate mechanism shipped in PR #273 and was never wired into dispatch completion → week-to-date spend read **null (not zero)** for three consecutive weeks; two re-tier audits aborted for lack of data. Four retros independently ranked "wire it" #1.
- **`recordSavedTime` — 1 caller on ~8 creation paths** → 4/7 guarantee actions wrote 0 saved minutes → the guarantee sweep issued **wrongful full refunds** and false "we failed you" emails to customers the fleet had served.
- **Registry entries without `runtime: 'live'`** → `isSkillInstalledByDefault()` returns false → the cron skips every workspace → the killer workflow **silently never fires** (`feedback_runtime_live_flag_required_in_registry`; PR #223's registry-truth CI guard exists to catch exactly this — don't remove it).
- Also on the list: a Librarian charter with no registered executor, `notifyApprovalQueued` on 1 of ~8 paths, a fully-spec'd health score with zero implementation.

## Procedure

1. **At ship time:** grep for the call site. `grep -rn '<producerName>(' --include='*.ts'` returning only the definition + its test = not shipped. Name the consumer in the PR body ("wired into `<path>` at line N").
2. **Registration surfaces are call sites too:** registry flags, cron schedules, executor registrations, skill-to-discipline mappings — each unwired one is a silent no-op.
3. **First-fire proof:** run (or trigger) the path once and cite the output — the same bar as "integration acceptance is functional": plumbing landing is a milestone, the behavior demonstrably running is the acceptance.
4. **At audit time:** any metric that reads null/zero for multiple periods gets a producer-consumer trace before any other diagnosis — "null is not zero"; the distinction points at the missing wire.
5. **Guard the money paths first:** anything that gates refunds, billing, or customer-visible claims runs in human-review mode until its writers are verified wired.

## Rules

- **"Done" = called, registered, fired once, output cited** — not merged.
- **A dashboard fed by an unwired writer is worse than no dashboard** — it reads as truth ("a wrong number on the proof shelf is worse than an empty shelf").
- **CI guards that assert wiring are load-bearing** — registry-truth-style tests stay.
- The docs cousin is [[placeholder-never-ships]]; the claims cousin is [[truth-wave-check]] (unwired capability ⇒ unclaimable capability).

## Example invocation

> **Input:** "Land the session-cost stamping so re-tier audits have data."
>
> **Output shape:** `stampSessionCost()` called from the dispatch completion seam (path:line in the PR body) → one real dispatch run → `session-costs.yaml` shows the row (cited) → the null-for-three-weeks metric now populates → PR notes which downstream consumers (budget state, re-tier, kaizen cost retro) unblock.

## Compose with

[[truth-wave-check]] · [[placeholder-never-ships]] · [[kaizen-retro]] (the audit that hunts these) · [[scheduled-task-liveness]] (the cron-shaped special case)

## Origin

`docs/kaizen/2026-07-02/07-finance-ops.md` (zero call sites; "null — not zero") · `docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md` F1 + kaizen-agreement-1/3 · `docs/audits/full-audit-2026-07-02/MASTER-SYNTHESIS.md` fix-11 (guarantee leak) · `feedback_runtime_live_flag_required_in_registry` · `feedback_integration_acceptance_is_functional`.
