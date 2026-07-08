---
name: report-back
description: End a dispatched agent pass with a compact, decision-dense summary the orchestrator can act on — PR URL (or file paths), what shipped, top findings, forced decisions, and declined work. Use whenever finishing a delegated task whose result feeds a parent session or a memory index.
---

# Structured report-back

A subagent's final message *is* the result the parent sees — it is not the full transcript and not shown to the end user. Make it the conclusion, not "see the files."

## Return exactly this shape

```md
## Report-back
- **PR:** <html_url>            (or the file paths written, if docs-in-place)
- **What shipped:** <1–3 lines: count of files/fixes, surfaces touched>
- **Top findings:** <2–4 bullets — what the orchestrator actually needs to know>
- **Open questions / forced decisions:** <the few things a human must decide, each with a default>
- **Declined / out of scope:** <what you deliberately did NOT do, with reasons>
```

## Rules

- **Lead with the PR URL / paths** so the reader jumps straight to the diff.
- **Findings, not narration** — "5 patterns extracted, top-1 = truth-seam defect," not "I read a lot and wrote docs."
- **Always include declined work** — silent omission reads as "covered everything."
- **Write it like a memory-index line** — it usually becomes one; keep it skimmable and self-contained.

## Origin

Every 2026-07 fleet pass ended in this shape (department heads PR #356–#365). Those report-backs compressed directly into one-line memory-index entries — proof the format survives compression.
