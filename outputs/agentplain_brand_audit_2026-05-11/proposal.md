# agentplain — Brand Application Proposal

**Date:** 2026-05-11
**Branch:** `feat/agentplain-brand-identity`
**Companion:** `audit.md` (this directory)

This is **not a new design proposal**. The canonical brand standards already exist at `C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md` and were ratified by Conner 2026-05-10 (`project_brand_locked.md`). This PR is the **first application of that canonical spec to code** — the marketing site currently wears a flatsbo-leaked editorial pass; this PR replaces it with the canonical agentplain visual system.

Every value below cites the canonical spec section it's drawn from. Where the spec deferred a detail (e.g., the exact glyph shape of the favicon `a`, the PNG-render path for og-image), the chosen implementation is called out as a **derived call** with its rationale, so Conner can override.

---

## 1. What's being applied (sourced — not proposed)

### Logo — wordmark, no monogram
- **Source:** `agentplain_brand_standards_v0.md` §2 ("lowercase `agentplain`. Set in the display serif. The 'g' descender clears the baseline cleanly. Single weight; no stacked logo, no all-caps variant. … Rejected: any monogram, any 'ap' lockup, any geometric mark.")
- **Implementation:** `components/brand/Logo.tsx` renders the wordmark in `font-display` (Source Serif 4). Removes the 20×20 rect mark that was on the previous `components/Logo.tsx`. Variants: `default` (ink on paper), `inverted` (paper on ink). Sizes: `sm` / `md` / `lg` controlling line-height-anchored cap-height. `aria-label="agentplain — home"` retained.
- **SVG source files:** `public/brand/wordmark-light.svg`, `public/brand/wordmark-inverted.svg` — both static SVGs of the wordmark in Source Serif 4 outlines, for use as embed assets (decks, third-party listings) where the live web font isn't available.

### Favicon — lowercase `a`
- **Source:** standards §2 ("Below [minimum size], switch to the favicon mark (lowercase `a` only).")
- **Implementation:** `app/icon.svg` (Next 14 file convention; auto-served at `/icon`) — single glyph lowercase `a` in `#1A1A1F` ink on a transparent background. The Next.js convention auto-emits a `<link rel="icon">` tag. The existing `public/favicon.svg` is rewritten to the same glyph so direct `/favicon.svg` requests stay valid for legacy scrapers.
- **Derived call:** the lowercase `a` is rendered as Source Serif 4 outlines, not a custom drawn glyph, because the spec says the favicon mark IS the lowercase `a` of the wordmark — same typeface family. If Conner wants a custom-drawn glyph later, swap the SVG without code changes.

### Typography
- **Source:** standards §3.
- **Display:** **Source Serif 4** via `next/font/google` (V0 dev substitute per spec, replacing Cormorant Garamond which was leaked from flatsbo). Spec defers paid serif (Söhne Breit / Tiempos Headline) to V1 site rebuild.
- **Body:** **Inter** (unchanged from current — already correct).
- **Mono:** **JetBrains Mono** (unchanged from current — already correct).

### Color palette
- **Source:** standards §4.
- **Implementation:** `lib/brand/tokens.ts` exports typed brand tokens; `tailwind.config.ts` consumes them; `app/globals.css` declares CSS variables derived from them.

| Token | Hex | Role | Source |
|---|---|---|---|
| `paper` | `#F7F4ED` | default light surface | §4 |
| `ink` | `#1A1A1F` | default text + dark surface | §4 |
| `clay` | `#B65D3A` | primary accent (CTA, tagline highlight, single use per page) | §4 |
| `moss` | `#3F5C3F` | secondary accent — verified/passed states only | §4 |
| `flag` | `#B43A3A` | utility — compliance flags / errors only | §4 |
| `mute` | `#8C8478` | captions, source citations, secondary text | §4 |

**Derived tokens** (utilities not enumerated in spec but required for visual hierarchy at the layouts we already have):

| Token | Hex | Role | Derivation |
|---|---|---|---|
| `paper-deep` | `#EDE9DE` | tonal step on paper for header strips, cards-on-cards | spec §6 says "Background = `paper` even on `paper` (use the hairline to define edge)" — but the existing layouts use a deeper tone for section separation; I've kept this token at a paper-family value (-6% lightness off `#F7F4ED`) rather than removing it and reworking every section, which would be out of scope for a brand-apply PR |
| `ink-soft` | `#2E2E33` | secondary text on paper | derived as 90% ink — keeps the warm-vs-cool decision consistent (canonical ink is near-neutral; ink-soft stays neutral) |
| `rule` | `#E0DAC9` | hairline rules on paper | mute @ 20% on paper baseline, kept as named token for `border-rule` Tailwind usage |
| `clay-deep` | `#9A4D2F` | hover state for clay CTAs | derived as -12% lightness off clay |

These derived tokens are flagged as `derived: true` in the brand tokens file so they're visually distinct from spec-canonical tokens. Conner can override any of them without touching component code.

### Primary CTA
- **Source:** standards §6 ("Primary CTA is `clay` on `paper`; secondary is outlined `ink` on `paper`.")
- **Implementation:** `globals.css` `.btn-primary` updated from `bg-ink text-paper` → `bg-clay text-paper hover:bg-clay-deep`. `.btn-secondary` stays outlined-ink (already matches spec).

### og-image
- **Source:** none in spec — derived call.
- **Implementation:** `app/opengraph-image.tsx` (Next 14 file convention) uses `next/og` `ImageResponse` to render a 1200×630 PNG at request time: paper background, wordmark in Source Serif 4 centered, tagline below in Inter regular, clay underline under "Rooted in reality." Vercel caches the result. Source SVG mirror at `public/brand/og-image.svg` for archival/manual upload paths.
- **Rationale for runtime PNG over committed static PNG:** keeps a single source of truth (`app/opengraph-image.tsx`), versions cleanly under git diff, and renders crisp on any future token change. The portable-architecture rule (`feedback_runner_portability.md`) is honored — the PNG is regenerable from the tokens, not a frozen artifact divorced from code.

### Title template
- **Source:** task brief.
- **Implementation:** `metadata.title = { default: "agentplain — Intelligence. Rooted in reality.", template: "agentplain — %s" }`. Child route pages opt-in by exporting `metadata.title` as a string.

---

## 2. Architecture — portability

Per `feedback_runner_portability.md` and `project_living_portable_architecture.md`:

- `lib/brand/types.ts` defines `interface BrandTokens` (color, typography, spacing token shapes).
- `lib/brand/tokens.ts` exports `tokens: BrandTokens` — the canonical values.
- `tailwind.config.ts` imports from `lib/brand/tokens.ts`. Single source of truth.
- `app/globals.css` declares CSS variables that reference Tailwind utilities; component code uses Tailwind class names or CSS variables, never hardcoded hex.
- A future rebrand swaps `lib/brand/tokens.ts` and ships — components stay untouched.

Per `feedback_no_silent_vendor_lock.md`: fonts use `next/font/google`. Source Serif 4, Inter, JetBrains Mono are all self-hosted by Next at build (no runtime CDN call). No silent vendor lock-in.

---

## 3. What's removed

- `signal`, `signal-deep`, `amber` tokens (flatsbo-leaked; not in canonical agentplain spec). Replaced by `clay`, `clay-deep`, `moss`.
- `slate`, `slate-soft` tokens (cool-grey; not in canonical agentplain spec). Replaced by `mute` and `ink-soft`.
- `Cormorant_Garamond` font import (flatsbo-leaked).
- The 16×16 rect mark in the Logo component (rejected by spec §2 — "any geometric mark" explicitly listed as anti-pattern).

---

## 4. Conner — sign off or override?

This is the canonical spec applied. Nothing in §1 is invention. The four **derived calls** that warrant your eyes:

1. **paper-deep `#EDE9DE`** — kept as a token rather than reworking every section that uses `bg-paper-deep` to rely on hairline rules alone (spec preference). Override path: remove the token, refactor sections to use rules. Out of scope for this PR.
2. **ink-soft `#2E2E33`** — derived as 90% of canonical ink to give secondary text some hierarchy without warming it. Override: replace with mute (`#8C8478`) wherever ink-soft appears; spec is silent on a secondary-ink concept.
3. **clay-deep `#9A4D2F`** — derived hover state for clay CTAs (-12% lightness). Override: pick a different hover behavior (e.g., 90% opacity).
4. **og-image rendered at request time via `next/og`** — versus committing a static PNG. Override: pre-render a PNG and commit to `public/brand/og-image.png`. The runtime path is portable; the committed-PNG path is bulletproof for scrapers that don't follow the OG URL through Vercel's edge cache.

If any of these is wrong, override and I'll re-cut.

The non-derived items (palette colors, Source Serif 4 substitution, lowercase-`a` favicon, wordmark-only logo, clay-on-paper primary CTA, removal of leaked tokens) are all direct applications of `agentplain_brand_standards_v0.md`. They're not up for override in this PR — they're the spec. If the spec itself is wrong, that's a separate decision against `project_brand_locked.md`.
