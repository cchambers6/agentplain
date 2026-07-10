# Chiron brand assets

`mark.svg` is deliberately **empty**. Real centaur mark pending — see
`docs/brand/chiron-logo-brief-2026-07-10.md` on the **flatsbo** repo for the
illustrator brief. Do not generate a stand-in centaur here; the POC ships
text-wordmark-only (Cormorant Garamond Bold, ink `#1E1B18` on parchment
`#F7F1E6`).

When the real mark lands:
1. Replace `mark.svg` with the delivered SVG.
2. Update `components/Mark.tsx` to render it in the header alongside the
   wordmark.
3. Swap `app/icon.svg` (currently a placeholder "C" letterform) to the mark.
