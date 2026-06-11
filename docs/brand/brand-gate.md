# Brand Gate

A dependency-free static check that prevents brand regressions from shipping to customer-facing surfaces.

## What it checks

Four rules run against all customer surfaces (marketing pages, product app, components, email templates, plaino prompts, OG images):

| Rule | Description | Surfaces |
|------|-------------|---------|
| **R1 — Vendor names** | LLM vendor names (Claude, Anthropic, ChatGPT, OpenAI, GPT-N) must not appear in rendered customer copy | All customer surfaces + OG/SVG files |
| **R2 — Placeholder text** | `PLACEHOLDER` and `awaiting real asset` must not ship in brand assets or ap/ components | `public/brand/` + `components/ui/ap/` |
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
```

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

## Wiring into pre-push (planned)

The gate is not yet wired into `.husky/pre-push` because in-flight waves A1–C still contain existing violations tracked in the baseline. Once those waves merge and the baseline count reaches zero, wire it:

```bash
# .husky/pre-push  (add after existing checks)
node tools/brand/brand-gate.mjs || exit 1
```

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
