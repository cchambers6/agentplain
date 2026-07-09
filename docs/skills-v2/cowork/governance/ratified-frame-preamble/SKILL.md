---
name: ratified-frame-preamble
description: Prepend a standing-decisions block to any prompt that plans, prioritizes, cuts, or decides, so the agent reasons inside the guardrails instead of re-litigating settled questions. Carries the model default, the biggest lever, the full kill list with restart triggers, positioning overrides, and output discipline. Refresh the dated facts every dispatch; flag conflicts, never pick silently.
---

# Ratified-frame preamble

If a pass produces decisions, it gets this block. Without it, agents drift audience, re-argue kills, or propose dead work — and the error surfaces at coordination time instead of never happening.

## The block (paste at the top; refresh every `[bracketed]` fact before each dispatch)

```md
## RATIFIED FRAME — standing decisions. Do not re-litigate.

### Model default
- [As of 2026-07-08: Opus 4.8 default for code-task sessions; Sonnet for mechanical
  plumbing; Haiku for conductor ticks; Fable only on explicit ask. Refresh from the
  latest feedback_* model memory — this fact changes; if two same-day memories
  conflict, flag it, don't pick.]

### Biggest lever this week
- [the single lever — e.g. "the first 5 GA-RE design-partner sends and the replies
  they produce; cash-breakeven 3–9 customers." Everything competes with it.]

### Kill list (RATIFIED [date] — all seven, with restart triggers; do not propose killed work)
- [#1 no new audit/retro/planning loops — restart: top-20 fix table burned down (shipped, not planned)]
- [#2 no GTM outside GA real estate — restart: 2 RE design partners live, weekly-running]
- [#3 flatsbo waitlist-dark — OVERRIDDEN by Conner; flatsbo stays live]
- [#4 client portal dormant — restart: first design partner asks directly]
- [#5 no LLM-dependent features against the paused prod key — restart: key restored]
- [#6 paid media + photography hold — restart: first partner signed, trial→paid]
- [#7 no new surface area — restart: profitable milestone + a top-20 card shipped]

### Positioning overrides (never drift)
- Audience = "local businesses." Never SMB / knowledge workers / teams.
- Service layer ON TOP OF the underlying model, never a competitor.
  BANNED: compete / replace / instead-of / alternative-to.
- Model/vendor invisible on customer surfaces; sole exception /privacy + /security
  subprocessor lists. Customer vocabulary (Setting up / Working / Watching).
- Plaino is the named service partner. Three tiers + Custom; "pilot pricing" banned.
- No-outbound: agents draft; the customer's system sends. No quick fixes — best fixes only.

### Output discipline
- Decisions, not narrative. Every claim cites a real artifact or is marked todo-real-signal.
- End with ≥1 typed deliverable ({design-decision | fix-spec | action}), or the pass is drift.
```

## Rules

- **Refresh the facts, keep the shape.** Kills, the lever, and the model default all age. Pull current values from `docs/kills/`, `docs/copy-rulings/`, the CEO lever doc, and the latest `feedback_*` memories — the block above froze at 7 kills because v1 of this skill froze at 5 and shipped stale.
- **Overrides travel with the kill they override** (#3), so agents neither propose the kill nor un-propose the override.
- **Don't add standing rules here.** A pass that wants a new rule proposes it as a deliverable for the founder; it doesn't smuggle it into the frame.
- **One source of truth per fact; conflicts get flagged** — the $4-vs-$5 daily-cap split was escalated as an explicit ruling, not silently reconciled ([[cross-department-coordination]]).

## Example invocation

> **Input:** "Dispatch a Head of Marketing pass."
>
> **Output shape:** the prompt opens with this block, lever + kills refreshed from today's docs; downstream, the head's plan stays inside KILL #2/#6 without re-derivation — the reference coordination pass caught exactly the drifted plans whose dispatches had skipped the frame.

## Compose with

[[head-of-department]] · [[lens-pass]] · [[loop-track-pass]] · [[scheduled-task-prompt]] (the frame rides in cron prompts too) · [[kill-list-discipline]] (where the kills come from)

## Origin

The "Ratified frame" block opening every 2026-07 orchestrator pass (`docs/ceo/2026-07-02/`, `docs/departments/2026-07-03/*`, `docs/loop/prompts/TRACKS.md`); kill list per `docs/kills/2026-07-03/RATIFIED.md` (seven kills, #3 overridden); model default per `feedback_back_to_opus_2026_07_08`.
