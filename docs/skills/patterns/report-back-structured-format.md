# Pattern: structured report-back (PR URL + findings + open questions)

**Group:** orchestration · **Seeded by:** the report-back block every dispatched fleet pass returns (department heads PR #356–#365, waves PR #344–#369); memory index entries are themselves compressed report-backs.

## When to use — trigger phrases
- ending any dispatched agent pass
- "report back when done"
- summarizing a background task's result to the orchestrator

## Inputs
- The completed work (PR opened, docs written, decisions made).

## Procedure — return exactly this shape
```md
## Report-back
- **PR:** <html_url>            (or the file paths written, if docs-in-place)
- **What shipped:** <1–3 lines: count of files/fixes, the surfaces touched>
- **Top findings:** <2–4 bullets — the things the orchestrator actually needs to know>
- **Open questions / forced decisions:** <the ONE (or few) things a human must decide, each with a default>
- **Declined / out of scope:** <what you deliberately did NOT do, with reasons>
```

## Output
A compact, decision-dense summary — the orchestrator reads *this*, not the full transcript.

## Guardrails
- **The report-back IS the interface.** A subagent's final message is the tool result the parent sees; it is not shown to the user. Put the conclusion here, not "see the files."
- **Findings, not narration.** "I read 20 audits and wrote some docs" is narration; "5 patterns extracted, top-1 = truth-seam defect" is a finding.
- **Always include declined work** (see `no-scope-creep-fix-pr`) — silent omission reads as "covered everything."
- **Lead with the PR URL / paths** so the human can jump straight to the diff.
- Keep it skimmable — this becomes a memory-index line later; write it like one.

## Worked example
Every 2026-07 department head pass ended with: PR URL, the plan's one forced decision, and the top findings. Those report-backs compressed directly into the memory index (e.g. "Head of Sales plan DONE (PR #363) — 5 named GA RE prospects … goal 5 sends/2+ replies/1 call by 07-17") — proof the format survives compression.
