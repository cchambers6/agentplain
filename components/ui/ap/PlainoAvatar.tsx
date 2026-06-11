import { PlainoStatus, type PlainoStatusState } from "./PlainoStatus";

// ─── DEPRECATED SHIM ───────────────────────────────────────────────────
// PlainoAvatar is retained ONLY for call-site compatibility (the operator
// fleet surface and a handful of tests). It now delegates to PlainoStatus —
// the live-state icon family — mapping its `pose` prop to a status state.
//
// Per Conner's two-family ratification (2026-06-10, see
// docs/brand/icon-families.md):
//   - Brand/identity surfaces use PlainoMark (the 8-bit mark).
//   - Live-state surfaces use PlainoStatus (the pose icons).
//   - PlainoAvatar maps to PlainoStatus; do NOT add new call sites — use
//     PlainoStatus directly so the state vocabulary is explicit.
//
// The old avatar rendered the head-icon coin at every pose (the prop was a
// no-op seam). Under the two-family system the pose now resolves to a real
// status pose: sit → sitting-alert, fetch → fetching, herd → herding.
//
// `tone` is accepted-and-ignored (rasters can't be recoloured with
// currentColor); kept so existing call signatures stay stable.

export type PlainoAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type PlainoAvatarTone = "ink" | "clay" | "moss";
export type PlainoAvatarPose = "sit" | "fetch" | "herd";

interface PlainoAvatarProps {
  size?: PlainoAvatarSize;
  /** Retained for call-site compatibility; no longer tints the raster mark. */
  tone?: PlainoAvatarTone;
  /** Visual posture — maps to the PlainoStatus live-state family. */
  pose?: PlainoAvatarPose;
  /** When true (default), the icon is hidden from assistive tech because the
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

// PlainoAvatar's three legacy poses map 1:1 onto the status vocabulary.
const POSE_TO_STATE: Record<PlainoAvatarPose, PlainoStatusState> = {
  sit: "sit",
  fetch: "fetch",
  herd: "herd",
};

export function PlainoAvatar({
  size = "md",
  // tone is intentionally accepted-and-ignored — see file header.
  tone: _tone,
  pose = "sit",
  decorative = true,
  className,
}: PlainoAvatarProps) {
  return (
    <PlainoStatus
      state={POSE_TO_STATE[pose]}
      size={SIZE_PX[size]}
      decorative={decorative}
      className={className}
    />
  );
}

export default PlainoAvatar;
