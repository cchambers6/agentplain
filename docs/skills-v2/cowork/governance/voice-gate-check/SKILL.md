---
name: voice-gate-check
description: Run the automated voice gate over changed customer-facing copy so it reads human, not model-generated — and know exactly what the gate does and does not scan. Use after changing marketing pages, emails, UI strings, or docs/marketing markdown, and as the landing gate on any copy PR. The gate owns the banned-pattern families; don't eyeball it.
---

# Voice-gate compliance check

`tools/brand/voice-gate.mjs` owns LLM-ese detection. Run it; don't hand-wave "it reads fine." The banned list is the spec — if you disagree with a flag, rewrite anyway.

## The families it enforces

- **A — AI-tell vocabulary:** words models reach for to sound profound that carry no information. Fix: delete the phrase, state the fact.
- **B — antithesis reflex:** the "not just X, it's Y" / reframe-as-secretly-another shape. Fix: if the point is "we run it for you," write *we run it for you*.
- **C — chatbot warmth:** performed enthusiasm, praise-for-the-question, exclamation spam. Fix: a calm competent partner doesn't gush.
- **D — essay scaffolding:** connective-tissue openers, launch-ese ("Meet X"), rhetorical what-ifs, em-dash chains, decorative triads. Fix: one idea per sentence; vary rhythm like a person.

`tools/brand/brand-gate.mjs` R4 handles the hype lexicon separately ("seamless," "leverage," "10x," "magic," "effortless") — if the adjective is doing the persuading, the sentence is broken.

## Scope (know it, don't assume it)

- **Scanned:** customer surfaces (`app/(marketing)/`, `components/`, `app/(product)/`) **and markdown under `docs/marketing/`** — including drafts; write clean or the push fails.
- **NOT scanned:** `docs/outreach/*` — founder-voice outreach copy needs a **manual** voice read; the gate won't catch it.
- **Enforcement gap to respect:** the gates historically ran client-side, so `HUSKY=0` could land drift; the marketing exec plan's fix is gates as required CI checks. Until that's verified on the repo you're in, run them explicitly and say so in the PR.

## Procedure

1. `node tools/brand/voice-gate.mjs` (and `node tools/brand/brand-gate.mjs` if UI/assets changed).
2. Fix flagged lines to the guidelines; re-run to clean.
3. Landing gate: the copy PR does not merge red.
4. Authority order when sources disagree: voice-guidelines doc → claims ground-truth → locked positioning → the feedback rules.

## Example invocation

> **Input:** "New pricing-page copy is ready to land."
>
> **Output shape:** gate run output (clean, or flags + the rewritten lines) · a note that `docs/outreach/` items in the same PR got a manual read · compose-check: vendor-invisible ([[model-vendor-invisible]]) and claims backed ([[truth-wave-check]]) · then the PR.

## Compose with

[[model-vendor-invisible]] · [[truth-wave-check]] · [[brand-gate-check]] · [[docs-only-pr]]

## Origin

`tools/brand/voice-gate.mjs` + `docs/brand/voice-guidelines-2026-06-19.md` (PR #309 made the gate the owner of A–D) · scope + families: `docs/marketing/deep-dive-2026-07-02/05-brand-voice-do-and-dont.md` · outreach exclusion: `project_outreach_kit_2026_07_03` · CI-floor plan: `docs/marketing/deep-dive-2026-07-02/00-EXECUTIVE-PLAN.md` Outcome 1.
