---
name: docs-only-pr
description: Keep a documentation PR strictly to files under docs/ — no runtime code, no schema, no assets — so it reviews fast with zero deploy risk. Use when writing a plan, audit, retro, runbook, or ruling. If you find yourself editing lib/ or a component, split it out.
---

# Docs-only PR

A plan/audit/retro/runbook is prose and decisions, not code. Keep the diff exclusively under `docs/`.

## Procedure

1. Confirm the deliverable is **only** files under `docs/` (plus, at most, a new doc directory).
2. Write to the dated, numbered convention: `docs/<area>/<YYYY-MM-DD>/<NN-topic>.md`.
3. Run the gates that apply to docs (e.g. voice-gate for marketing docs); nothing runtime.
4. Title it `docs(<area>): …`.

## Rules

- **Truly docs-only** — the moment you edit `lib/…` or a component, it's a different PR; split it.
- **Dated, numbered convention** keeps passes idempotent and sortable.
- **Docs still respect no-fabrication** — cite the artifacts you reference.
- **Don't smuggle a decision into code** — a planning PR *proposes*; a separate fix wave *implements*.

## Origin

The 2026-07 planning wave — master synthesis (PR #344), department heads (PR #356–#365), pilot runbook (PR #366), coordination (PR #368) — all pure docs. This skills catalog is the same shape.
