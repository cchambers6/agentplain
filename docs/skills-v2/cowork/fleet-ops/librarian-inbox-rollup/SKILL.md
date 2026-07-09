---
name: librarian-inbox-rollup
description: Keep a fleet memory store current — agents append raw observations to an INBOX; one Librarian classifies, dedupes, formats, and rolls the index; the data layer hydrates from primary sources rather than waiting for reports. Use when the memory index is stale, when observations are dying in transcripts, or on periodic memory maintenance.
---

# Librarian INBOX-rollup (observe → append → one writer)

Memory-worthy observations die in transcripts unless capture is *someone's job*. The division of labor: every agent appends raw observations to `INBOX.md`; only the Librarian writes formatted memory and the index.

## The inbox-append block (paste into every orchestrator + wave prompt)

```md
### Memory inbox (append, don't format)
When you observe something memory-worthy — a pattern that worked, an antipattern that bit,
a decision made, a number future agents will cite — append ONE entry to <memory>/INBOX.md:
---
ts: <ISO-8601 UTC> · source: <session id> · type-hint: feedback|project|reference
suggested-name: <kebab-slug>
observation: |
  <one paragraph: what happened, the lesson, what to repeat or avoid.>
---
Do NOT write the final memory file yourself — the Librarian classifies, dedupes, and links.
```

## The Librarian pass

1. **Drain INBOX** → classify, dedupe against existing files (update, don't twin; delete disproven), write formatted memories, link with `[[name]]`.
2. **Roll the index**: one line per memory — `- [Title](file.md) — <hook>` — grouped (load-bearing rules / active / mechanics / historical "read-only if resuming"). Detail never lives in the index.
3. **Hydrate the data layer from primary sources, don't wait for reports.** The recorded failure: the YAML layer only ingested INBOX session-reports; no reports came, so `session-costs.yaml` sat 17 days stale and `week_to_date_usd: null` for three weeks aborted two re-tier audits. Derive what's derivable (merge counts from `git log origin/main`, PR state from REST) every pass; acceptance: no data file >24h older than its newest reachable primary source.
4. **Prune** — snapshot backups multiply (264 `WORKING_STATE.md.preXXXX` files at one count); batch-prune on a cadence, don't note-and-defer.

## Rules

- **One fact per file; one line per file in the index.** Absolute dates.
- **Only the Librarian writes formatted memory** — parallel writers duplicate, conflict on the index, and pile bad metadata.
- **Ghost files are a real failure mode:** briefs cited memories that were never written — 6 of 7 the engineering retro was told to load didn't exist; the expensive lessons (stacked-PR backmerge, junction-follow deletion) had been *named and never written*, so the fleet paid to relearn them. Every recovery/bypass session ends by writing its memory; STUBs >7 days count as missing.
- **Know the canonical store — and cross-index the stores.** Fleet memory has lived on a different mount than the repo-side index, with neither indexing the other; a typo'd path silently no-ops. The two stores reference each other, and rollups land in the canonical one.

## Example invocation

> **Input:** "Roll up the week."
>
> **Output shape:** N INBOX entries drained → M memories written/updated (named) → index diff (lines added/moved to historical) → data-layer hydration report (each YAML: source + freshness) → prune count → the one-line summary for the next brief.

## Compose with

[[scheduled-task-prompt]] (the block rides in every prompt) · [[report-back]] (reports become index lines) · [[truth-wave-check]] (no ghost citations) · [[consolidated-decision-queue]]

## Origin

`LIBRARIAN_CHARTER.md` + `feedback_librarian_pattern_in_every_orchestrator` (2026-06-09: five load-bearing learnings were chat-only) · staleness/hydration: `docs/kaizen/2026-07-02/10-fleet-ops.md` friction-1/friction-6 · ghost files: `docs/kaizen/2026-07-02/01-engineering.md` friction-1, `MASTER-IMPROVEMENT-PLAN.md` F6/improvement-7.
