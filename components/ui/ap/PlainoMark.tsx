/* eslint-disable @next/next/no-img-element -- PlainoMark renders the local
   /public 8-bit brand raster with a plain <img>, not next/image, on purpose:
   the product surface is unit-tested with react-dom/server
   `renderToStaticMarkup` in bare node:test (see tests/customer-approvals.test.tsx),
   where next/image's loader config is absent and would throw. A plain <img>
   renders identically server-side, in tests, and in email/OG contexts. Matches
   the `Plaino` primitive precedent in the same barrel. */
import type { CSSProperties } from "react";

// ─── BRAND MARK ────────────────────────────────────────────────────────
// PlainoMark is the agentplain BRAND identity mark: the 8-bit pixel Plaino.
// Conner ratified the two-family split 2026-06-10 (see
// docs/brand/icon-families.md):
//
//   PlainoMark   = identity — "this is agentplain". STATIC. Used only on
//                  identity surfaces: site header lockup, footer, the chat
//                  entry point + chat header, login, favicon/app icons,
//                  social cards, marketing chrome.
//   PlainoStatus = live product state — maps a running workflow's state to a
//                  persona pose (sit/fetch/herd/alert/sleep). Used in the
//                  dashboard, action queue, integration health, workflow cards.
//
// NEVER MIX THE FAMILIES. A brand surface never renders a pose; a status
// surface never renders the 8-bit mark. The old conflation — head-icon.png
// (a circle coin) doing both jobs at 15+ sites — is what this split retires.
//
// This is a pure mark. The wordmark is composed separately by
// `components/brand/LogoLockup.tsx`; do not add a wordmark slot here.
//
// Accessibility: decorative by default (a paired wordmark/name labels the
// brand). Pass `alt` to expose a label when the mark stands alone.

// 8bit.png crop must include ≥10px of paper buffer above the raised-tail orb.
// Orb topmost pixel = sheet y=823; crop starts at y=810 (13px buffer).
// If this asset is ever re-cropped, run tools/brand/fix-8bit-crop.mjs to verify.
const MARK_SRC = "/brand/plaino-system/8bit.png";

type PlainoMarkProps = {
  /** Rendered box size in px (square). Brand marks live 16–64px. Default 32. */
  size?: number;
  className?: string;
  /** Accessible label. When omitted the mark is decorative (aria-hidden). */
  alt?: string;
};

export function PlainoMark({ size = 32, className, alt }: PlainoMarkProps) {
  const decorative = !alt;
  const style: CSSProperties = {
    width: size,
    height: size,
    objectFit: "contain",
    // 8-bit Plaino is pixel art — keep its hard edges at every scale.
    imageRendering: "pixelated",
  };

  return (
    <img
      src={MARK_SRC}
      alt={alt ?? ""}
      width={size}
      height={size}
      style={style}
      className={["inline-block shrink-0 align-middle", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={decorative || undefined}
      data-plaino-family="brand"
    />
  );
}

export default PlainoMark;
