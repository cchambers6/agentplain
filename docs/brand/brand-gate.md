# Brand Gate

A dependency-free static check that prevents brand regressions from shipping to customer-facing surfaces.

## What it checks

Four rules run against all customer surfaces (marketing pages, product app, components, email templates, plaino prompts, OG images):

| Rule | Description | Surfaces |
|------|-------------|---------|
| **R1 — Vendor names** | LLM vendor names (Claude, Anthropic, ChatGPT, OpenAI, GPT-N) must not appear in rendered customer copy | All customer surfaces + OG/SVG files |
| **R2 — Placeholder / stand-in text** | `PLACEHOLDER`, `awaiting real asset`, `lorem ipsum`, `FPO`, `coming soon`, and wireframe dimension annotations (`600 × 400`) must not ship in any public asset | ALL of `public/` (every fetchable file, widened 2026-07-19) + `components/ui/ap/` |
| **R3 — Token drift** | Hex colors must be in the canonical token set; deprecated `#8C8478` always flagged; `rounded-*` and `shadow-*` Tailwind classes are square-corner violations | All customer surfaces + email templates |
| **R4 — Banned words** | Marketing buzzwords (`SMB`, `seamless`, `leverage`, `synergy`, `disruptive`, `revolutionary`, `next-gen`, `cutting-edge`, `supercharge`, `knowledge workers`) must not appear in rendered copy | All customer surfaces |

**Comment stripping:** all rules run against comment-stripped source. `// line comments`, `/* block comments */`, and `{/* JSX comments */}` are stripped before matching so documentation about the rules does not self-trigger.

**Limitation:** comment stripping is line-based; it does not handle comment-like sequences embedded inside template-literal strings. This is safe for our codebase which does not use that pattern.

## Canonical hex token set

The following values are ratified (`lib/brand/tokens.ts` + `app/globals.css`):

```
#F7F4ED   paper
#EDE9DE   paper-deep
#1A1A1F   ink
#2E2E33   ink-soft
#B65D3A   clay
#9A4D2F   clay-deep
#3F5C3F   moss
#B43A3A   flag
#726A5E   mute (WCAG AA on paper — replaces deprecated #8C8478)
#E0DAC9   rule
#D9D5C7   mid-rule
#1F3D2E   forest       (support — deep field tone; added 2026-06-19)
#C8A24A   wheat        (support — rare harvest accent; added 2026-06-19)
#FCFAF4   paper-bright (support — no-shadow surface lift; added 2026-06-19)
#F3E7E0   clay-wash    (support — highlight-band ground; added 2026-06-19)
```

Support tokens (`forest`, `wheat`, `paper-bright`, `clay-wash`) were extracted in
the de-AI-fication design-mirror (`docs/brand/design-mirror-2026-06-19.md`) and are
pending Conner sign-off (`docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md`).
Clay remains the single primary accent; these support, never replace, the v0 charge rules.

`#8C8478` is the deprecated pre-WCAG mute. It is always flagged even when present in the allowlist.

## How to run

```bash
# Ratchet mode (default): only fails on NEW violations vs the baseline
node tools/brand/brand-gate.mjs

# Fail on ALL violations — useful to see the full picture
node tools/brand/brand-gate.mjs --all

# JSON output (ratchet mode) — for CI / programmatic consumption
node tools/brand/brand-gate.mjs --json

# JSON output (all violations)
node tools/brand/brand-gate.mjs --all --json

# Write current violations to baseline and exit 0 (run after fix waves land)
node tools/brand/brand-gate.mjs --baseline
```

Via npm script:
```bash
npm run brand-gate
```

## Allowlist workflow

Some violations are ratified exceptions (e.g. privacy/security pages disclosing Anthropic as a subprocessor; the Plaino widget's `rounded-full` mobile toggle button).

These live in `tools/brand/brand-gate-allow.json`:

```json
[
  {
    "path": "app/(marketing)/privacy/page.tsx",
    "pattern": "Anthropic",
    "reason": "Subprocessor disclosure — ratified PR #164 / SBM response page."
  }
]
```

**Fields:**
- `path` — file path substring that must match the violation's relative file path
- `pattern` — regex string matched against the violation's matched text (optional; omit to suppress all violations in the file)
- `reason` — required; must cite the PR or memory document that ratified the exception

**Adding a new exception:**
1. Run `node tools/brand/brand-gate.mjs --all --json` to confirm the violation exists and identify its exact `match` text.
2. Add an entry to `brand-gate-allow.json` with `path`, `pattern`, and `reason`.
3. Run `node tools/brand/brand-gate.mjs --all` to confirm the violation is now suppressed.
4. Commit the updated `brand-gate-allow.json` in the same PR as the code change.

**Do not** add allowlist entries for violations that should simply be fixed.

## Baseline ratchet workflow

The gate ships with a pre-generated baseline (`tools/brand/brand-gate-baseline.json`) that captures all violations present at time of merge. In **ratchet mode** (the default), the gate only fails on violations that are NOT in the baseline. This means:

- The gate can merge before all existing violations are fixed.
- Any NEW violation introduced by a future PR is caught immediately.
- As fix waves land, the baseline shrinks.

**Regenerating the baseline after a fix wave:**
```bash
node tools/brand/brand-gate.mjs --baseline
git add tools/brand/brand-gate-baseline.json
git commit -m "chore(brand): shrink gate baseline — fixed R3 #8C8478 email violations"
```

The baseline count must decrease or stay flat on a fix PR. If it increases, the PR is introducing new violations.

## Where the gate is enforced

Three stages, no single point of bypass. The gate needs no configuration or env vars — pure Node built-ins, safe to run anywhere.

| Stage | Trigger | Can it be bypassed? |
|-------|---------|---------------------|
| `.husky/pre-push` (Layer 1.5) | every local `git push` | yes — `HUSKY=0`, or fleet REST pushes never run hooks |
| `.github/workflows/brand-gate.yml` | every PR + push to main | only by merging a red PR |
| `npm run build` preflight | every Vercel deploy | no — a violation fails the build before `next build` runs |

The build-script stage is the true launch gate: Vercel deploys on push regardless of GitHub check status, so only a build-time failure actually stops a labeled stand-in from reaching prod. (Added 2026-07-19; the pre-push wiring landed 2026-06-11 with PRs #227–#234.)

**R2 is ratcheted to zero and must stay there.** Never `--baseline` an R2 violation away — fix or delete the asset. New scene slots go through `tools/brand/gen-placeholder-scenes.mjs` / `gen-vertical-scenes.mjs` so they ship as finished prairie-motif compositions, never labeled wireframes.

## How the rules map to brand standards

| Rule | Standard source |
|------|----------------|
| R1 vendor names | `memory/project_sbm_wrapper_positioning_2026_06_06.md` — "built on Claude, configured by us"; never compete/replace/alternative-to |
| R2 placeholder assets | `memory/visual_gap_audit_2026_06_07.md` — 52 visual slots; placeholders are non-blocking stand-ins, never final |
| R3 hex tokens | `lib/brand/tokens.ts` + `memory/project_brand_locked.md` — canonical v0 token set, ratified 2026-05-10 |
| R3 rounded corners | `memory/project_agentplain_mission_and_positioning.md` — "Intelligence rooted in reality"; square, direct, no rounded softness |
| R4 banned words | `memory/feedback_everything_tells_a_story.md` + `memory/project_agentplain_mission_and_positioning.md` — audience is "local businesses", not SMB/knowledge workers; plain language, no buzzwords |

## Design Quality Gate agent

`.claude/agents/design-quality-gate.md` defines an agent that wraps this gate and adds qualitative review of spacing rhythm, component altitude, and story-arc compliance. It scores PRs 1–5 and blocks below 4.
