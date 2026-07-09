---
name: docs-only-pr
description: Keep a documentation PR strictly to files under docs/ — no runtime code, no schema, no assets — so it reviews fast with zero deploy risk. Use for plans, audits, retros, runbooks, rulings, and skills catalogs. The moment lib/ or a component appears in the diff, it's two PRs pretending to be one.
---

# Docs-only PR

A plan/audit/retro/ruling is prose and decisions. Keeping the diff under `docs/` is what lets a ten-PR planning wave land in a day: nothing to deploy, nothing to break.

## Procedure

1. Confirm the deliverable is only `docs/` files (plus at most a new doc directory).
2. Use the dated, numbered convention: `docs/<area>/<YYYY-MM-DD>/<NN-topic>.md` — idempotent, sortable, and re-runnable passes don't overwrite history.
3. Run the gates that apply to docs: voice-gate covers `docs/marketing/*` markdown (and NOT `docs/outreach/*` — manual read there; [[voice-gate-check]]); Truth-Wave citations throughout.
4. Title `docs(<area>): …`; open ready-for-review with the full URL in the report.

## Rules

- **Truly docs-only.** Editing `lib/billing/facts.ts` "while you're in there" converts a zero-risk PR into a deployable one — split it.
- **A planning PR proposes; a fix wave implements.** Don't smuggle the decision into code — the STOP-list discipline ("no more analysis layers without a fix following") depends on the boundary being real.
- **Docs still respect no-fabrication** — cite the artifacts referenced; flag ghosts ([[truth-wave-check]]).
- **Loop-pass exception, scoped:** loop workers commit docs-only *directly to main* on inert paths without a PR — that's a ratified exception with its own allowed-paths list and revert-based recovery ([[loop-track-pass]]), not a precedent for skipping PRs generally.

## Example invocation

> **Input:** "Write the coordination plan reconciling the ten head plans."
>
> **Output shape:** everything under `docs/departments/<date>/COORDINATION/` — six docs, zero code — PR titled `docs(departments): unified 14-day plan-of-record`, gates run, ready-for-review, URL in the report. (Reference: PR #368, and this catalog itself.)

## Compose with

[[truth-wave-check]] · [[voice-gate-check]] · [[no-scope-creep-fix]] (the fix-wave sibling) · [[curl-per-pr-merge]]

## Origin

The 2026-07 planning wave — PR #344 (11 docs, zero code), #356–#365, #366, #368 — all pure docs; this skills catalog is the same shape.
