# agentplain design tokens — reference (2026-07-08)

The complete design-system contract on one page: what a designer joining later needs to work inside the system without breaking it. Source files are canonical; this doc explains them. When they disagree, the code wins and this doc gets fixed.

**Lockstep rule (load-bearing).** The palette lives in FOUR places that must move together: `lib/brand/tokens.ts` (source), `app/globals.css` `:root` (CSS-variable mirror), `tools/brand/brand-gate.mjs` `CANONICAL_HEX` (the gate), and this doc. Motion tokens live in three: `tokens.ts` `motion`, `globals.css` `--motion-*`/`--ease-*`, `tailwind.config.ts`. A PR that changes one without the others is wrong by definition.

---

## 1. Color

One accent, spent not sprayed. Everything else is substrate. Components never hardcode hex — they use the Tailwind utilities (`bg-paper`, `text-ink`, …). Email generators and other surfaces outside Tailwind import `colorHex` from `lib/brand/tokens.ts`.

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F5F0E6` | Base ground — newsprint cream |
| `paper-deep` | `#ECE5D6` | Tonal step down: header strips, figure mats |
| `paper-bright` | `#FBF8F1` | Tonal step UP: the no-shadow card lift (ledger plates) |
| `ink` | `#1A1612` | Primary type — warm letterpress ink |
| `ink-soft` | `#34302A` | Body copy |
| `clay` | `#B85540` | THE accent. One charge per view. Never small text (see §2) |
| `clay-deep` | `#97402E` | Clay hover; the AA-safe clay for small text (5.99:1) |
| `clay-wash` | `#F3E7E0` | Highlight-band tint (pull-quotes, harvest badges) |
| `forest` | `#1F3D2E` | Grounded full-bleed pause band |
| `forest-deep` | `#16291F` | The close: footer + ApClosingBand ground |
| `wheat` | `#C8A24A` | Rare harvest accent, ≤1 per long page. Decorative/large only |
| `moss` | `#3F5C3F` | Verified/passed ONLY — never a primary accent |
| `flag` | `#B43A3A` | Errors / compliance flags ONLY |
| `mute` | `#726A5E` | Captions, eyebrows — the AA-tuned small-text gray (4.85:1) |
| `rule` | `#D8CFBA` | Hairline rules |
| `mid-rule` | `#C2B69B` | Stronger hairline: figure frames, ledger borders |
| `dust` / `sage` | `#9C8B73` / `#7A8B6F` | Decorative/large-text only — lighter than `mute`, fail AA small |

## 2. Contrast contract

The pairings the reviews keep re-deriving by hand, written down once. "Small" = under ~24px.

| Text on ground | Ratio | Verdict |
|---|---|---|
| `ink` on `paper` | ≈ 9:1 | Always fine |
| `ink-soft` on `paper` | ≈ 8.5:1 | Body copy standard |
| `mute` on `paper` | 4.85:1 | Smallest text allowed — do NOT put `mute` on `paper-deep` (4.25:1, fails) |
| `white` on `clay` | 4.76:1 | The button pairing. `paper` on `clay` (4.19:1) FAILED and is retired |
| `clay` as small text on `paper` | 4.19:1 | BANNED — use `clay-deep` (5.99:1) |
| `wheat` on `paper` | ≈ 2.6:1 | BANNED as text on cream at any size — dark grounds only |
| `paper` on `forest-deep` | ≈ 12:1 | The close pairing |
| `paper/75` on `forest` | ≥ 4.5:1 | Dark-band body floor — don't go below /75 for body |
| Focus ring | — | `clay` on light grounds; `wheat` inside `.letterpress-dark` (dark grounds) — wired globally in `globals.css` |
| `.foil` | 1.3–2.1:1 on cream | Foil is retired from cream grounds (2026-07-08). Dark panels (`forest`/`forest-deep`/`ink`) at display size only |

Touch targets: every button primitive (`.btn-*`, `ApHeritageButton` default/lg, `ApClosingBandAction`) carries `min-h-[44px]`. `ApHeritageButton size="sm"` (36px) is dense-desktop-only by contract.

## 3. Type

Three faces, no additions: **Fraunces** (display, variable with the `opsz` optical-size axis — use the axis, not extra weights), **Inter** (sans/UI), **JetBrains Mono** (eyebrows, figures, captions, datelines). Headings carry the letterpress emboss globally; dark grounds invert it via `.letterpress-dark`.

The scale is a nine-step subset of the Tailwind utilities — using a size outside this table is drift:

| Step | Utility | Line-height | Use |
|---|---|---|---|
| Display XL | `text-[4.25rem]` | `leading-[1.04]` | Home H1 only |
| Display L | `text-5xl`/`text-[4rem]` | `leading-[1.05–1.08]` | Page H1s |
| Display M | `text-4xl` | `leading-[1.1]` | Section titles |
| Display S | `text-2xl`–`text-3xl` | `leading-snug` | Card titles, pull-quotes |
| Title | `text-xl` | `leading-tight`/`snug` | Sub-cards, FAQ questions |
| Body L | `text-lg` | `leading-relaxed` | Section intros |
| Body | `text-[15px]` | `leading-relaxed` | Card + running copy |
| Caption | `text-[13px]` | `leading-relaxed` | Footnotes, field-notes |
| Micro | `text-[11px]` mono | `tracking-eyebrow` uppercase | Eyebrows, datelines, badges (10px only inside chips) |

## 4. Space & rhythm

8px scale (Tailwind default; stay on 4/8/12/16/24/32/48/64/96/128 equivalents). Vertical cadence: hero `py-20 md:py-28`, sections `py-16 md:py-24` (owned by the `Section` primitive), closing band `py-24 md:py-32`. Editorial rhythm rules: one visual anchor per block, uneven block heights on purpose, one dateline per page, heritage.png always a contained figure (see `docs/departments/2026-07-03/design/03-editorial-rhythm-application.md`).

## 5. Radius & elevation

- **Radius: 0. Everywhere. Ratified.** `rounded-none` is brand equity; brand-gate R3 flags `rounded-*` drift. There is no per-component radius table because the answer is always square.
- **Shadows: none.** Elevation is tonal + hairline: `paper-deep` (recessed) → `paper` (base) → `paper-bright` (lifted), framed by `rule`/`mid-rule`. Brand-gate R3 flags `shadow-*` drift. If a surface needs to "float" (sheets), it slides in from an edge instead.

## 6. Motion

Three durations, two easings — the entire vocabulary. Tokens in `tokens.ts` `motion` → CSS vars → Tailwind utilities (`duration-quick`, `ease-out-soft`, …).

| Token | Value | Use |
|---|---|---|
| `quick` | 120ms | Hover/focus state changes |
| `settle` | 180ms | Sheet/panel entrances — translate only, never fade |
| `drift` | 1200ms | Ambient loader travel |
| `out-soft` | `cubic-bezier(0.2, 0, 0, 1)` | Entrances |
| `travel` | `cubic-bezier(0.4, 0, 0.6, 1)` | Loops |

Rules: no spinners (waiting = the rooted-loader hairline strip or stillness), no pulse/float decoration, everything gates on `prefers-reduced-motion` (the three existing keyframes are the reference implementations).

## 7. Iconography & illustration

- **Plaino two-family split is untouchable**: `PlainoMark` (8-bit, identity) vs `PlainoStatus` (pose, live state). Never mixed; see `docs/brand/icon-families.md`.
- **Line motifs**: `ApMotif` — 1.5px stroke, `currentColor`, never filled, never two-tone. Twelve names as of 2026-07-08 (lone-tree, silo, wheat, sheaf, horizon, seed, plow, big-sky, windmill, homestead, creek, gate). Empty states, auth, welcome strips — not inside working surfaces.
- **New pictorial assets** route through the deterministic generators (`tools/brand/gen-*.mjs`) or a commissioned human via creative-router — never improvised (creative-assets rule).

## 8. Component inventory

`components/ui/ap/` is the single import surface (the barrel). Specs with usage examples: `docs/brand/components-2026-07-08/`. Marketing-only compositions (`Section`, `Footer`, `PriceTiers`, `HomeCards`) live in `components/` root.

---

Changelog: 2026-07-08 — v1, written alongside the design-run PR (contrast P0 closed, motion tokenized, foil retired from cream, ApCallout/ApBadge/ApClosingBand/PriceTiers added, ApMotif +4).
