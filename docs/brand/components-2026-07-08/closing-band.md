# ApClosingBand / ApClosingBandAction

`components/ui/ap/ApClosingBand.tsx` · NEW 2026-07-08

The one grounded close every long page ends on. Resolves the old divergence (home closed on forest-deep, about/how-it-works/compare on bg-ink) one way: forest-deep, letterpress inverted, wheat focus rings (via `.letterpress-dark`), hairline seam at the band→footer edge so the two dark panels read as stacked plates.

## Props

| Prop | Notes |
|---|---|
| `eyebrow` | Defaults to the locked tagline. Pass `null` to omit; pass a string to override |
| `title` | Display-serif closing statement (ReactNode — inline links allowed) |
| `body` | Cream/75 supporting paragraph. The money-back sentence with its `/guarantee` link lives here on home |
| `actions` | 2–4 `ApClosingBandAction`s, primary first |

## ApClosingBandAction

`variant`: `primary` (cream fill — one per band) · `secondary` (outline) · `quiet` (recedes, for third+ links). `newTab` for external booking links. All are 44px min-height. External protocols (`mailto:`, `https:`) auto-render `<a>`; paths render `<Link>`.

## Rules

- One band per page, always last before the footer.
- Links inside `body` are `text-paper underline … hover:text-wheat`.
- Adopted 2026-07-08 on: home, /how-it-works, /pricing, comparison pages. Remaining bg-ink closes (about) migrate as they're next touched.
