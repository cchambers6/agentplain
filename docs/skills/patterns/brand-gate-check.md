# Pattern: brand-gate check (R1–R5 ratchet)

**Group:** code/process (governance-adjacent) · **Seeded by:** `tools/brand/brand-gate.mjs`, `tools/brand/brand-gate-baseline.json`, `tools/brand/brand-gate-allow.json`, `tests/brand-gate.test.ts` + fixtures `tests/fixtures/brand-gate/r1..r4-*`, `docs/brand/brand-gate.md`; memory: project_heritage_rollout, project_plaino_icon_system_two_families (CI gate R5).

## When to use — trigger phrases
- "I touched a component, color, icon, or brand asset"
- "brand-gate is red"
- any PR rendering UI or adding SVG/PNG

## Inputs
- Changed `.tsx`/`.svg` files; the baseline (`brand-gate-baseline.json`) and allowlist (`brand-gate-allow.json`).

## Procedure
1. Run the gate:
   ```bash
   node tools/brand/brand-gate.mjs      # or: npm run brand-gate
   ```
2. It enforces a **ratchet** of rules (fixtures name them):
   - **R1** — no vendor/model names in rendered UI (model-vendor invisibility, mechanized).
   - **R2** — no placeholder SVGs shipping to launch surfaces (placeholder convention needs a launch gate).
   - **R3** — no raw hex / off-token Tailwind colors; use brand tokens (`CANONICAL_HEX` lockstep with `tokens.ts`).
   - **R4** — no banned words.
   - **R5** — the Plaino two-icon-family split: `PlainoMark` (brand) vs `PlainoStatus` (status) never mixed.
3. Fix violations or, only when legitimately intentional, add to `brand-gate-allow.json` with justification. Re-run until green.

## Output
Green brand-gate; UI stays on-brand and vendor-invisible by construction.

## Guardrails
- **R1–R5 is a ratchet, not a suggestion** — it's a CI gate. Don't disable it; fix the code.
- **Baseline vs allowlist:** the baseline records known pre-existing debt; the allowlist is for *intentional* exceptions with a reason. Don't dump new violations into the baseline to go green.
- **`CANONICAL_HEX` moves in lockstep with `tokens.ts`** — never change one without the other (memory: heritage rollout).
- **Never mix PlainoMark and PlainoStatus icon families** (R5) — they're two families for two jobs.
- Creative assets route through the creative-router (tools or humans) — never improvise SVG/PNG (memory: feedback_creative_assets_use_tools_or_humans).

## Worked example
The Heritage Plains rollout (PR #320) introduced brand tokens with `CANONICAL_HEX` kept in lockstep with `tokens.ts`, enforced by R3; the two-family icon split (PR #232) is enforced by R5. The fixtures `tests/fixtures/brand-gate/r1-vendor-violation.tsx` etc. are the executable spec for each rule.
