/* eslint-disable @next/next/no-img-element -- PlainoAvatar renders a local
   /public brand raster with a plain <img>, not next/image, on purpose: the
   product surface is unit-tested with react-dom/server `renderToStaticMarkup`
   in bare node:test (see tests/customer-approvals.test.tsx), where next/image's
   loader config is absent and would throw. A plain <img> renders identically
   server-side, in tests, and in email/OG contexts. Matches the `Plaino`
   component precedent in the same barrel. */
import type { CSSProperties } from "react";

// Plaino avatar — the small, framed head-icon mark used inline beside the
// "Plaino" name (chat headers, attribution rows, dashboards, the operator
// fleet surface). This is the production successor to the former hairline-SVG
// scaffold: it now renders the real illustrated head-icon delivered on the
// brand reference sheet, served from `public/brand/plaino-system/head-icon.png`
// via the same plain-<img> path as the `Plaino` component.
//
// The props API is preserved so existing call sites compile unchanged:
//   - size: the t-shirt scale (xs…xl) → a px box.
//   - tone: kept in the contract for callers that previously charged a clay /
//           moss "moment". A raster can't be recoloured with currentColor, so
//           tone no longer tints the mark; it is retained as a no-op so the
//           call signature is stable and a future per-tone asset can wire in.
//   - pose: kept in the contract (sit/fetch/herd). The avatar is the resting
//           head-icon at every pose today; when the full pose pack is wired for
//           the avatar slot, each pose maps to a distinct PNG. The prop is the
//           stable seam so callers don't change when that lands.
//
// Accessibility:
//   - decorative (default true): the paired "Plaino" text names the character,
//     so the mark is hidden from assistive tech (aria-hidden).
//   - decorative={false}: the mark stands alone (e.g. a tiny "drafted by"
//     footer with no name beside it) → exposes role="img" aria-label="Plaino".

export type PlainoAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type PlainoAvatarTone = "ink" | "clay" | "moss";
export type PlainoAvatarPose = "sit" | "fetch" | "herd";

interface PlainoAvatarProps {
  size?: PlainoAvatarSize;
  /** Retained for call-site compatibility; no longer tints the raster mark. */
  tone?: PlainoAvatarTone;
  /** Visual posture — retained as a stable seam. See file header. */
  pose?: PlainoAvatarPose;
  /** When true (default), avatar is hidden from assistive tech because the
   *  paired "Plaino" text already names the character. */
  decorative?: boolean;
  className?: string;
}

const SIZE_PX: Record<PlainoAvatarSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 96,
};

const HEAD_ICON_SRC = "/brand/plaino-system/head-icon.png";

export function PlainoAvatar({
  size = "md",
  // tone is intentionally accepted-and-ignored — see file header.
  tone: _tone,
  pose = "sit",
  decorative = true,
  className,
}: PlainoAvatarProps) {
  const px = SIZE_PX[size];

  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "Plaino" };

  const style: CSSProperties = {
    width: px,
    height: px,
    objectFit: "contain",
  };

  return (
    <img
      {...a11y}
      src={HEAD_ICON_SRC}
      alt={decorative ? "" : "Plaino"}
      width={px}
      height={px}
      style={style}
      data-pose={pose}
      className={["inline-block shrink-0 align-middle", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
