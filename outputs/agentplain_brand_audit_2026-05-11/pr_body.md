# feat(brand): apply canonical agentplain brand standards v0

## Summary

Conner's note: *"our logo and branding never made it to agentplain."* Audit confirmed it. The canonical brand exists at `C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md` (ratified 2026-05-10 per `project_brand_locked.md`), but the marketing site that shipped was wearing a **flatsbo-leaked editorial palette** — paper `#F4EEE3` / ink `#2A2620` / forest-green accent / Cormorant Garamond — none of which are in the agentplain spec.

This PR applies the spec. It is not a new design proposal; it is the first time the canonical brand has been built into code.

- **Logo:** wordmark-only in display serif (spec §2 — "any geometric mark" was explicitly rejected). Previous `<Logo>` had a rect mark; removed.
- **Palette:** `paper #F7F4ED`, `ink #1A1A1F`, `clay #B65D3A` (primary accent — was `signal #5F8060`, a moss-family green that the spec reserves for verified-state-only usage), `moss #3F5C3F` (verified-only), `flag #B43A3A` (errors-only), `mute #8C8478` (warm secondary text — was `slate #3A3D42`, a cool bluish grey).
- **Typography:** Source Serif 4 (V0 dev per spec §3, deferred paid serif to V1) replaces Cormorant Garamond. Inter + JetBrains Mono unchanged.
- **Favicon + icon:** lowercase `a` glyph at `public/favicon.svg` + `app/icon.svg` (was an abstract rect mark).
- **og-image:** `app/opengraph-image.tsx` renders a 1200×630 PNG via `next/og` at request time. Source-of-truth SVG mirror at `public/brand/og-image.svg`.
- **Primary CTA:** clay-on-paper per spec §6 (was ink-on-paper).
- **Portability:** `lib/brand/{types,tokens}.ts` typed single source of truth; tailwind + globals.css consume it. Future rebrand swaps tokens, components don't change. Honors `feedback_runner_portability.md`.

Discovery + rationale: `outputs/agentplain_brand_audit_2026-05-11/audit.md` + `proposal.md`.

## Brand-kit summary

| Item | Source | Value |
|---|---|---|
| Logo | spec §2 (found) | wordmark `agentplain` in Source Serif 4, no mark |
| Primary color | spec §4 (found) | `paper #F7F4ED` + `ink #1A1A1F` + `clay #B65D3A` accent |
| Typography | spec §3 (found) | Source Serif 4 display, Inter body, JetBrains Mono data |
| Favicon | spec §2 (found, glyph derived) | lowercase `a` in Source Serif 4 outlines |
| og-image | task brief (derived) | 1200×630 PNG via `next/og`; SVG mirror in `public/brand/` |

## Conner — sign off or override?

Four **derived calls** (everything else is direct from spec):

1. **`paper-deep #EDE9DE`** kept as a token rather than refactor every `bg-paper-deep` section to spec-§6's hairline-only rule. Override path: remove the token, rework sections.
2. **`ink-soft #2E2E33`** as a neutral-cool secondary text. Override: use `mute` everywhere instead — spec is silent on secondary-ink.
3. **`clay-deep #9A4D2F`** as hover state (-12% L off clay). Override: use opacity instead.
4. **og-image rendered at request time via `next/og`** rather than a committed static PNG. Override: pre-render and commit `public/brand/og-image.png`.

Non-derived items (palette colors, Source Serif 4, lowercase-`a` favicon, wordmark-only logo, clay primary CTA, removal of leaked tokens) are direct applications of `agentplain_brand_standards_v0.md` — not up for override in this PR. If the spec itself is wrong, that's a separate decision against `project_brand_locked.md`.

## Test plan

- [x] `npx tsc --noEmit` — clean
- [x] `npx next lint` — clean
- [x] `npm test` — 60/60 pass (incl. 19 new brand-token tests)
- [x] `npx next build` — clean, 11 static pages + `/icon.svg` + `/opengraph-image` routes generated
- [ ] **Conner:** open the Vercel preview after this PR builds; verify home (`/`), pricing (`/#pricing`), and pilot (`/pilot`) render the canonical brand
- [ ] **Conner:** confirm the four derived calls in §Conner above, or override

## BEFORE / AFTER

BEFORE = current production at https://agentplain.com (forest-green accent, Cormorant serif, brown ink — the flatsbo-leaked editorial). AFTER = the Vercel preview that GitHub will surface on this PR.

Pages worth comparing side-by-side:
- `/` — hero "Intelligence. Rooted in reality." accent color shifts forest → clay; serif shifts Cormorant → Source Serif 4
- `/#pricing` — featured tier shadow + bullet ticks shift forest → clay
- `/pilot` — hero "Opt-in at the end." + timeline week labels shift forest → clay
- `/about` — paper + ink hue shifts (warmer cream → cooler off-white; brown ink → neutral-black)

## Coordination

Zero overlap with `feat/p0-10-p0-12-integration-foundation` / `feat/agentplain-customer-surface-shell` — those branches add `lib/inngest/`, `lib/ops/`, `lib/security/`, `.husky/`, `agent-state/`, `package*.json`. This PR touches `app/`, `components/`, `lib/brand/`, `public/`, `tailwind.config.ts`, `app/globals.css`, `lib/auth/resend-provider.ts` (email template colors only), and `tests/brand.test.ts`. Both can land independently in either order.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
