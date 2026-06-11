/* eslint-disable @next/next/no-img-element -- Plaino renders local /public brand
   rasters with a plain <img>, not next/image, on purpose: the product surface is
   unit-tested with react-dom/server `renderToStaticMarkup` in bare node:test
   (see tests/customer-approvals.test.tsx), where next/image's loader config is
   absent and would throw. A plain <img> renders identically server-side, in
   tests, and in email/OG contexts. These assets are small, pre-sized PNGs. */
import type { CSSProperties } from "react";

// LOW-LEVEL PRIMITIVE — do not use directly in product or marketing surfaces.
// Use PlainoMark (the 8-bit BRAND mark — identity surfaces) or PlainoStatus
// (the live-STATE pose icon — dashboard / queue / health). Never mix the two
// families (Conner 2026-06-10; see docs/brand/icon-families.md). The only
// direct callers of `Plaino` are PlainoMark / PlainoStatus / PlainoScene
// internals and the OG image routes (heritage state).
//
// Canonical Plaino brand mark — the working-dog system delivered on the
// reference sheet at `public/brand/plaino-system/reference-sheet.png`
// (a ChatGPT delivery built from `docs/brand` AGENTPLAIN_BRAND_BRIEF.md).
// This is the production successor to the line-art `PlainoAvatar` scaffold:
// every pose is a real illustration, one PNG per state.
//
// State → product meaning (the wiring contract; see docs/brand/plaino-system.md):
//   standing-watch — idle / monitoring, no active work
//   sitting-alert  — output ready for review (approval approved / ready)
//   herding        — actively running a skill chain
//   fetching       — delivering a draft to the approvals queue
//   scouting       — search / research in progress
//   guarding       — Sentinel blocked something (compliance / budget / spam)
//   resting        — paused / over-budget / key sentinel-paused
//   head-icon      — default avatar: chat headers, comments, attribution
//   8bit           — favicon + mobile app icon
//   heritage       — homepage hero, OG image, marketing splashes
//
// Accessibility: by default the avatar is decorative (the paired "Plaino"
// text names the character) and is hidden from assistive tech. Pass `alt`
// to expose a label when the mark stands alone.

export type PlainoState =
  | "standing-watch"
  | "sitting-alert"
  | "herding"
  | "fetching"
  | "scouting"
  | "guarding"
  | "resting"
  | "head-icon"
  | "8bit"
  | "heritage";

type Props = {
  /** Which pose to render. Defaults to the head-icon avatar. */
  state?: PlainoState;
  /** Rendered box size in px (square). Defaults to 64. */
  size?: number;
  className?: string;
  /** Accessible label. When omitted the mark is decorative (aria-hidden). */
  alt?: string;
};

const BASE = "/brand/plaino-system";

const SRC: Record<PlainoState, string> = {
  "standing-watch": `${BASE}/poses/standing-watch.png`,
  "sitting-alert": `${BASE}/poses/sitting-alert.png`,
  herding: `${BASE}/poses/herding.png`,
  fetching: `${BASE}/poses/fetching.png`,
  scouting: `${BASE}/poses/scouting.png`,
  guarding: `${BASE}/poses/guarding.png`,
  resting: `${BASE}/poses/resting.png`,
  "head-icon": `${BASE}/head-icon.png`,
  "8bit": `${BASE}/8bit.png`,
  heritage: `${BASE}/heritage.png`,
};

export function Plaino({
  state = "head-icon",
  size = 64,
  className,
  alt,
}: Props) {
  const decorative = !alt;
  const style: CSSProperties = {
    width: size,
    height: size,
    objectFit: "contain",
    // 8-bit Plaino is pixel art — keep its hard edges when scaled.
    imageRendering: state === "8bit" ? "pixelated" : undefined,
  };

  return (
    <img
      src={SRC[state]}
      alt={alt ?? ""}
      width={size}
      height={size}
      style={style}
      className={["inline-block shrink-0 align-middle", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={decorative || undefined}
      data-plaino-state={state}
    />
  );
}

export default Plaino;
