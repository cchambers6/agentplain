# agentplain — Brand Discovery Audit

**Date:** 2026-05-11
**Branch:** `feat/agentplain-brand-identity` (off `origin/main` @ `9f95d70`)
**Scope:** read-only enumeration of brand-related assets across the agentplain codebase, flatsbo outputs, and orchestrator memory.
**Outcome:** canonical brand spec exists; current codebase implements a different (flatsbo-leaked editorial) palette and typeface. Gap is concrete.

---

## 1. Canonical source

`C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md` — **the authoritative file**. Five files in that directory together form the brand kit:

| File | Status |
|---|---|
| `agentplain_brand_standards_v0.md` | logo, typography, palette, components, audit checklist |
| `agentplain_voice.md` | voice pillars, banned words, audience tones |
| `agentplain_taglines.md` | sanctioned tagline variants |
| `agentplain_positioning.md` | category positioning |
| `agentplain_brand_kickoff_summary.md` | locked decisions + open questions |

Brand-lock memory at `C:\Users\conne\.claude\projects\C--agentplain\memory\project_brand_locked.md` (mirror of `…\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-…\agent\memory\project_brand_locked.md`) confirms the name `agentplain` (lowercase, no space, no hyphen) is locked as of 2026-05-10. The orchestrator memory says nothing about visual identity beyond the name — the visual spec lives in the `install_now/memory/agentplain_brand/` files above.

The standards file says, verbatim: *"Conflicts between this file and any prior brand fragments are resolved in favor of this file."*

## 2. What exists in the agentplain codebase today

| Asset | Path | Condition |
|---|---|---|
| Favicon | `public/favicon.svg` | inline 32×32 SVG: cream square (`#F4EEE3`) with a centered dark rect (`#2A2620`) and a baseline rule — abstract mark, not the canonical lowercase `a` |
| Logo component | `components/Logo.tsx` | renders a 20×20 rect mark + wordmark "agentplain" in `font-display`. `variant` prop accepts `'ink' \| 'color'`; `'color'` uses `#5F8060` (forest sage). |
| Display serif | `app/layout.tsx:5` | **Cormorant_Garamond** loaded via `next/font/google` |
| Body sans | `app/layout.tsx:12` | **Inter** loaded via `next/font/google` |
| Mono | `app/layout.tsx:18` | **JetBrains_Mono** loaded via `next/font/google` |
| Tailwind palette | `tailwind.config.ts:7-18` | paper `#F4EEE3`, paper-deep `#EDE5D6`, ink `#2A2620`, ink-soft `#3D3830`, slate `#3A3D42`, slate-soft `#5A5D62`, signal `#5F8060`, signal-deep `#496349`, amber `#C9892F`, rule `#D9CFBC` |
| Global CSS | `app/globals.css` | body bg `#F4EEE3`, body color `#2A2620`, `::selection` swap, eyebrow class, btn-primary/secondary, container-wide |
| Marketing layout | `app/(marketing)/layout.tsx` | imports `Header` + `Footer` from `components/` |
| Marketing home | `app/(marketing)/page.tsx` | uses tagline correctly: "Intelligence." + `<span className="text-signal">Rooted in reality.</span>` (signal=forest sage, wrong color per spec) |
| Pilot, About | `app/(marketing)/{pilot,about}/page.tsx` | use the same wrong-token palette throughout |
| Product layout | `app/(product)/layout.tsx` | brand chrome present: inline `<Link href="/app" className="font-display text-xl tracking-tight text-ink">agentplain</Link>` — does **not** import the `<Logo>` component; otherwise uses the same token system as marketing |
| Workspace layout | `app/(product)/app/workspace/[id]/layout.tsx` | uses same tokens (paper-deep, slate-soft, ink, font-display) |
| Sign-in, sign-up, verify, workspace pages | `app/(product)/app/**` | all use the same wrong-token palette |
| Live site | `https://agentplain.com` | WebFetched 2026-05-11; current production renders this same Cormorant + signal-green editorial system |

**Files touching the wrong-token names** (grepped for `signal|amber|slate|font-display|font-mono|paper-deep|ink-soft|F4EEE3|2A2620|5F8060|C9892F|Cormorant`): **30 files** across `app/` and `components/`. Blast radius is contained — no `lib/` files reference brand tokens.

## 3. What's missing (per canonical spec vs current code)

| Required by spec | Status in code |
|---|---|
| `lib/brand/types.ts` typed token interface | **missing** |
| `lib/brand/tokens.ts` exporting canonical values | **missing** — Tailwind has hardcoded values, no shared source-of-truth |
| `clay` accent (`#B65D3A`) | **missing** — replaced by `signal #5F8060` (forest sage, a flatsbo-family color) |
| `moss` (`#3F5C3F`, **verified-state-only**) | **missing** — `signal` is incorrectly elevated to primary accent role |
| `flag` (`#B43A3A`, error-state-only) | **missing** entirely |
| `mute` (`#8C8478`, warm warm-grey) | **missing** — replaced by `slate #3A3D42` (cool bluish grey) |
| Canonical `paper` (`#F7F4ED`) | **mismatched** — current uses `#F4EEE3` (more yellow/cream, leaked from flatsbo v3 oat palette) |
| Canonical `ink` (`#1A1A1F`, near-neutral-black) | **mismatched** — current uses `#2A2620` (warm brown, leaked from flatsbo v3 ink) |
| Display serif: **Source Serif 4** (V0 dev) | **mismatched** — current uses Cormorant Garamond |
| Logo: **wordmark-only in display serif** (no monogram, no mark) | **mismatched** — current Logo has a 16×16 rect mark + wordmark |
| Favicon: lowercase `a` only | **mismatched** — current favicon is abstract dark-rect-on-cream-square |
| og-image 1200×630 | **missing** — `app/layout.tsx` declares `openGraph` but provides no `images` array; Next.js falls back to nothing |
| Primary CTA: clay on paper | **mismatched** — `btn-primary` currently `bg-ink text-paper` |
| `components/brand/Logo.tsx` | **missing** — Logo lives at `components/Logo.tsx`, no `brand/` namespace |
| Title template `agentplain — {page}` | **missing** — `metadata.title` is a literal string, not a template |
| `app/(product)/layout.tsx` using `<Logo />` | **missing** — uses inline `<Link>` instead |

## 4. What's contradictory (flatsbo-leaked palette)

The current code's editorial system **is** the flatsbo v3 Concierge palette family, applied to agentplain:

- `paper #F4EEE3` is in the same warm-cream family as flatsbo's `--oat` paper. Canonical agentplain `paper` is `#F7F4ED` — a fractionally cooler, less-yellow off-white described in the spec as "more Georgia clay than Apple-store grey," distinct from flatsbo's oat.
- `signal #5F8060` is a brighter green relative to flatsbo's `--forest` (`#3F5C3F`-adjacent), but in the same hue family — and it is **literally the moss color reserved by the agentplain spec for verified-state-only usage**, mis-applied here as the primary brand accent. The canonical primary accent is `clay #B65D3A` (terracotta).
- `ink #2A2620` is warm-brown, matching flatsbo v3 ink. Canonical agentplain ink is `#1A1A1F`, near-neutral-black (the spec explicitly rejects warm-brown for ink because clay is the warm accent — keeping ink neutral lets clay carry the warmth single-handed).
- `Cormorant Garamond` is the flatsbo v3 display serif. Canonical agentplain V0 dev serif is `Source Serif 4` (paid V1: Söhne Breit / Tiempos Headline). Cormorant has a more decorative humanist feel; Source Serif 4 has a contemporary editorial gravitas closer to the standards-file description.
- `amber #C9892F` is a yellow-orange present nowhere in the canonical spec — it appears to be a substitute that drifted in for the clay slot.
- `slate #3A3D42` is cool-bluish; canonical `mute #8C8478` is warm-grey. The hue family conflict is intentional in the spec: a warm palette ought to have a warm neutral, not a cool one.

The user's verbatim phrasing — *"our logo and branding never made it to agentplain"* — is consistent with this finding: the canonical visual identity (clay accent, Source Serif 4, lowercase-`a` favicon, neutral ink) was never built into code; what shipped instead was a flatsbo-family editorial pass that uses the wrong tokens.

## 5. In-flight branches (coordination check)

- `origin/feat/p0-10-p0-12-integration-foundation` and the local `feat/agentplain-customer-surface-shell` both have the same 20-file delta vs main (4968 insertions, 127 deletions). All 20 files are under `lib/inngest/`, `lib/ops/`, `lib/security/`, `agent-state/`, `.husky/`, `.eslintrc.json`, `package*.json`. **Zero overlap** with the brand surface (`app/`, `components/`, `public/`, `tailwind.config.ts`, `app/globals.css`). Brand PR can land independently.

## 6. External assets

No Figma file reference, no Notion design page, no Google Drive folder. Brand standards are text-only in `agentplain_brand_standards_v0.md`; SVG/PNG assets do not exist anywhere — they are to be **built from the spec**, not imported. No hard-stop trigger per task constraints.
