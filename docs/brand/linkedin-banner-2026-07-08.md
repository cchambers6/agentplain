# LinkedIn banner — Conner profile (2026-07-08)

**Source:** `public/brand/social/linkedin-banner-conner-2026-07-08.svg` · 1584×396 (LinkedIn's native profile-banner size).

**To use:** open the SVG in a browser, screenshot/export at 1584×396 (or `npx svgexport` to PNG), upload as the LinkedIn profile background. Keep the left ~420px visually clear-ish in your mental crop check — LinkedIn overlays the round profile photo bottom-left on desktop; the type block starts at x=96 and clears the overlay zone on the standard crop, but verify once after upload.

## Design decisions

- **Ground:** forest-deep with a forest field band — the same grounded close the site ends every page on, so the banner and the estate read as one hand.
- **Type only, no marks.** The wordmark is set as lowercase Fraunces text (the same treatment `Logo.tsx` renders — the wordmark IS typeset text, so no logo asset was redrawn). No Plaino: profile banners are identity surfaces, and rather than risk the 8-bit mark at an uncontrolled crop, the banner leans on type + landscape. Two-family rule fully respected.
- **Line-work:** horizon tussocks, a lone tree, and cloud bands re-drawn at banner scale in the ApMotif idiom (1.5–2px stroke, dust/mid-rule on dark, never filled).
- **Copy:** tagline (locked) + the one supporting line, vendor-invisible, no claims needing citation.
- **Font caveat:** the SVG names Fraunces/JetBrains Mono with Georgia/Consolas fallbacks. Export from a machine with Fraunces installed (it's in the repo's app font pipeline) or accept the Georgia fallback — both render on-system; the exported PNG freezes whichever was present.

## Do not

- Add "trusted by N" anything (zero customers — Truth Wave).
- Add the Plaino mark or poses to this or any future banner without a controlled-crop check via the brand pipeline.
- Recolor: the palette is the canonical token set, listed in the SVG's comment.
