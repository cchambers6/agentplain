---
name: brand-gate-check
description: Run the brand ratchet (R1–R5) over changed UI and assets — vendor-invisibility, no placeholder SVGs on launch surfaces, on-token colors, banned words, the two icon families never mixed. Use after touching any component, color, icon, or brand asset, or when the gate is red. Fix the code; never baseline around it.
---

# Brand-gate check (the R1–R5 ratchet)

`tools/brand/brand-gate.mjs` mechanizes five brand rules over changed `.tsx`/`.svg`. It's a ratchet: violations get fixed, not baselined.

## The rules and what each mechanizes

- **R1 — no vendor/model names in rendered UI** — the CI form of [[model-vendor-invisible]].
- **R2 — no placeholder SVGs on launch surfaces** — the CI form of [[placeholder-never-ships]] (born from the 27 live "PLACEHOLDER" scenes).
- **R3 — no raw hex / off-token colors** — brand tokens only; `CANONICAL_HEX` moves in lockstep with `tokens.ts`, never one alone (Heritage rollout rule).
- **R4 — banned hype words** — the lexicon half of [[voice-gate-check]].
- **R5 — the two icon families never mix** — `PlainoMark` (brand) vs `PlainoStatus` (status) serve different jobs; mixing them is a CI failure, not a taste question.

## Procedure

1. `node tools/brand/brand-gate.mjs` (or `npm run brand-gate`).
2. Fix violations. Only a *legitimately intentional* exception goes in the allowlist, **with a justification**.
3. Re-run to green.

## Rules

- **Baseline = known pre-existing debt. Allowlist = intentional exceptions with reasons.** Dumping new violations into the baseline to go green defeats the ratchet — and hand-maintained scan-lists already drift (the gate's email scan-scope hardcoded 6 files while ~8 generators existed; treat scan-scope as code to review, not config to trust).
- **Creative assets route through tools or humans — never improvise SVG/PNG** (`feedback_creative_assets_use_tools_or_humans`); and cropped/sheet-derived assets need a **visual check** before shipping — all 10 Plaino pose crops once shipped broken because rect constants were trusted without eyeballing the output (`feedback_sheet_crop_needs_visual_verification`).
- **iconKey-style internal slugs are not customer text** — grep for renderer-hint strings leaking into JSX text before any brand PR; it has shipped three times (`feedback_icon_slug_as_text_third_surface`).

## Example invocation

> **Input:** "New pricing-tier banner component is ready."
>
> **Output shape:** gate run → R3 flags one raw hex → replaced with the token → R5 clean (status icon used for status, mark for brand) → green run pasted in the PR; no baseline/allowlist changes.

## Compose with

[[model-vendor-invisible]] · [[placeholder-never-ships]] · [[voice-gate-check]] · [[truth-wave-check]]

## Origin

`tools/brand/brand-gate.mjs` + baseline/allow JSON + `tests/fixtures/brand-gate/r1..r4-*` · R3: Heritage rollout PR #320 · R5: two-family icon split PR #232 · scan-scope drift: `docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md` F7.
