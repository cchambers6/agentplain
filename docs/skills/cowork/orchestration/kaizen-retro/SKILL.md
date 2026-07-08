---
name: kaizen-retro
description: Run a structured retrospective on a function — 10 wins, 10 friction points, top-5 process improvements, then synthesize across functions into a ranked, deduped fix queue. Use for "weekly retro," "what's working and what's causing friction," or a periodic improvement pass. Evidence on every finding.
---

# Kaizen retro

Produce one retro per function, then a master synthesis that dedups and ranks. The value is a **ranked, deduped fix queue**, not a feelings-dump.

## Per-function skeleton

1. **Header** — scope (date range, repos, data sources; caveat any missing data).
2. **10 patterns we do well** — each with an evidence citation.
3. **10 patterns causing friction** — each with its impact.
4. **Top 5 process improvements** — structured: `[title]: [what changes]` · `Measure: [baseline → target]` · `Workstreams affected`.
5. **(Top 3 investments)** — where the next unit of effort goes, if warranted.
6. **Notes on method** — how numbers were derived, not estimated.

## Master synthesis (across all functions)

- **Dedup clusters** — one underlying issue reported by many retros = ONE fix, counted once.
- **First-five ranked fixes** — what converges across every retro.
- **Top-N impact/effort table** — `# | Fix | Impact | Effort | Source retros | After | Risk if skipped`.
- **A STOP list** — practices to stop (e.g. "no more analysis layers, no surfaces without activation").

## Rules

- **Evidence on every win and friction item** — "we ship fast" is not a finding; "14/17 CI runs green, 3 blocked on schema drift" is.
- **Dedup at the master level** — don't count the same issue five times.
- **The STOP list is a deliverable.**
- **Respect freezes** — if analysis loops are frozen until a fix table is burned down, don't spawn a fresh retro just because you can.

## Origin

The 2026-07-02 kaizen sweep: ten function retros + a MASTER-IMPROVEMENT-PLAN (`docs/kaizen/2026-07-02/`). Weekly retro loop introduced in PR #273.
