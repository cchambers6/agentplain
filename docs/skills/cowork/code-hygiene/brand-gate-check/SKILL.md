---
name: brand-gate-check
description: Run the brand ratchet over changed UI and assets to enforce vendor-invisibility, no placeholder SVGs on launch surfaces, on-token colors, banned-word bans, and the two icon-family split. Use after touching any component, color, icon, or brand asset, or when the brand gate is red. Fix the code, don't disable the gate.
---

# Brand-gate check (ratchet)

An automated ratchet over changed `.tsx`/`.svg` keeps UI on-brand and vendor-invisible by construction. It's a CI gate — fix violations, don't disable it.

## The rules it enforces

- **R1** — no vendor/model names in rendered UI (mechanizes model-vendor-invisibility).
- **R2** — no placeholder SVGs shipping to launch surfaces.
- **R3** — no raw hex / off-token Tailwind colors; use brand tokens (canonical hex kept in lockstep with the tokens file).
- **R4** — no banned words.
- **R5** — the two icon-family split: the brand mark and the status mark are never mixed.

## Procedure

1. Run the gate (`node tools/brand/brand-gate.mjs` / `npm run brand-gate`).
2. Fix violations. Only for a *legitimately intentional* exception, add it to the allowlist **with a justification** — never dump new violations into the baseline to go green.
3. Re-run until clean.

## Rules

- **Baseline = known pre-existing debt; allowlist = intentional exceptions with a reason.** Don't confuse them.
- **Canonical hex moves in lockstep with the tokens file** — never change one alone.
- **Never mix the two icon families** (R5).
- **Creative assets route through the creative pipeline** (tools or humans) — never improvise SVG/PNG.

## Origin

`tools/brand/brand-gate.mjs` + baseline/allow JSON + `tests/fixtures/brand-gate/r1..r4-*`. R3 tokens from the Heritage rollout (PR #320); R5 from the two-family icon split (PR #232).
