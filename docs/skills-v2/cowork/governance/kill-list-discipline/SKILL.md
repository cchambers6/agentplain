---
name: kill-list-discipline
description: Write and maintain a ratified kill list — each kill names its affected workstreams by PR#/path, carries a specific restart trigger, and records overrides on the same document with name and date. Use when cutting work ("what should we stop"), when ratifying a cut list from a CEO pass, or when someone proposes work that might be killed.
---

# Kill-list discipline (kills with restart triggers)

A kill without a restart trigger is a grudge; a kill without named workstreams is unenforceable; an override recorded anywhere but on the kill itself is a future re-litigation.

## The anatomy of a kill (from the ratified reference)

```md
KILL #N — <what is closed, precisely scoped>
Affected workstreams: <PR#s and paths, so engineering can flag work as blocked>
Restart trigger: <specific, testable — not "when things improve">
```

Reference triggers, verbatim-grade specific:
- #1: "Top-20 fix table burned down. Burn-down means: each item **shipped and merged**, not planned or in-flight."
- #2: "2 RE design partners **live** (not in trial — live, weekly-running)." Live = onboarded, workflow firing, ≥1 real saved-time figure in their workspace.
- #4: "First design partner asks directly."

## Rules

- **Provenance line on the document:** source pass ("CEO Pass 1, `docs/ceo/2026-07-02/03-what-CEO-would-cut.md`"), who ratified, on whose delegation, dated.
- **Overrides are logged ON the kill, with name and date** — "KILL #3 — OVERRIDDEN by Conner; flatsbo stays live." The reasoning stays on file even though the action reversed; future passes must neither re-propose the kill nor quietly resurrect it (`feedback_flatsbo_stays_live_2026_07_03`: do not re-propose waitlist-dark without new signal).
- **Restart triggers are tested, not vibed.** "Trial enrollments do NOT count" is part of the trigger text because someone would have counted them.
- **Kills propagate through the frame** — every decision-producing prompt carries the current list ([[ratified-frame-preamble]]); a kill that lives only in its own file doesn't govern anything.
- **A kill also gates claims:** the security-page ruling softened "within 24 hours" to defensible language *because* KILL #7 meant no funded on-call rotation existed — unfunded-capability claims are truth violations ([[truth-wave-check]]).

## Example invocation

> **Input:** "Ratify the cut list from the CEO pass."
>
> **Output shape:** `docs/kills/<date>/RATIFIED.md` — provenance header, N kills each with affected workstreams + restart trigger, any overrides logged inline; then the ratified-frame preamble template updated to match; report-back names which in-flight PRs are now blocked.

## Compose with

[[ratified-frame-preamble]] (distribution) · [[lens-pass]] (the CEO cut list is the input) · [[truth-wave-check]] (kills gate claims) · [[consolidated-decision-queue]] (override requests route here)

## Origin

`docs/kills/2026-07-03/RATIFIED.md` (seven kills, provenance, #3 override; PR #354) · `docs/copy-rulings/2026-07-03/security-page.md` (KILL #7 driving claim softening) · `feedback_flatsbo_stays_live_2026_07_03`.
