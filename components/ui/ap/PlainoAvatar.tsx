import React, { type SVGProps } from "react";

// Placeholder mark for Plaino, the named service partner. The persona is
// internally a working sheepdog on the plains — patient, faithful,
// grounded — and the silhouette is a geometric, sitting robot dog drawn
// in the same hairline-stroke language as ApMotif (§2.6 of the design
// language doc). The metaphor is NEVER disclosed to customers; this is
// purely a visual scaffold.
//
// TODO: replace with canonical Plaino mark when logo v3 lands. The
// production illustration will live at
// `public/brand/plaino/plaino-{pose}.svg` and this component will swap
// to an <img> tag at that point.
//
// Visual rules (matches the rest of the product surface):
//   - 1.5px stroke, currentColor, square corners (no rounded-*).
//   - paper-deep base behind the figure so the avatar reads as a
//     framed mark instead of a floating doodle.
//   - foreground is ink by default; tone="clay" or tone="moss" override
//     when the avatar charges a clay moment (e.g. error / outage state).
//
// Pose:
//   - "sit"   — default. Plaino at rest / waiting. Used in chat header,
//                empty states, dashboards when no work is in flight.
//   - "fetch" — Plaino retrieving. Used during ANSWER / data pulls /
//                substrate retrieval.
//   - "herd"  — Plaino routing. Used during REGISTER / approval-queue
//                attribution / moving work through the team.
//   When the canonical asset pack lands, each pose maps to a distinct
//   illustration; today, "sit" is the only pose with a unique render
//   and the other poses fall through to the sitting silhouette with a
//   subtle posture hint (the ear/tail line). The pose prop is the
//   stable contract so callers don't change when the assets swap in.
//
// Accessibility:
//   - When the avatar appears alongside the name "Plaino", the SVG is
//     decorative — pass `decorative` (default true) so the screen reader
//     reads the name text only and skips the avatar.
//   - When the avatar appears alone (a tiny "drafted by" footer with no
//     name beside it), pass `decorative={false}` to expose the
//     `aria-label="Plaino"`.

export type PlainoAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type PlainoAvatarTone = "ink" | "clay" | "moss";
export type PlainoAvatarPose = "sit" | "fetch" | "herd";

interface PlainoAvatarProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: PlainoAvatarSize;
  tone?: PlainoAvatarTone;
  /** Visual posture — defaults to "sit". See file header. */
  pose?: PlainoAvatarPose;
  /** When true (default), avatar is hidden from assistive tech because the
   *  paired "Plaino" text already names the character. */
  decorative?: boolean;
}

const SIZE_PX: Record<PlainoAvatarSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 96,
};

const TONE_CLASS: Record<PlainoAvatarTone, string> = {
  ink: "text-ink",
  clay: "text-clay",
  moss: "text-moss",
};

export function PlainoAvatar({
  size = "md",
  tone = "ink",
  pose = "sit",
  decorative = true,
  className,
  ...rest
}: PlainoAvatarProps) {
  const px = SIZE_PX[size];
  const toneClass = TONE_CLASS[tone];
  const wrapperClass = ["inline-block", toneClass, className]
    .filter(Boolean)
    .join(" ");

  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": "Plaino" };

  // Posture-specific accents: ears + tail angle nudge by pose. The body
  // stays anchored (Plaino is a sitting figure across every pose) so the
  // mark stays recognizable; the gesture changes with the work.
  const earTilt = pose === "fetch" ? -3 : 0;
  const tailLine =
    pose === "herd"
      ? "M37 30 L42 26"
      : pose === "fetch"
        ? "M37 30 L42 32"
        : "M37 30 L41 28";

  return (
    <svg
      {...a11y}
      {...rest}
      width={px}
      height={px}
      viewBox="0 0 48 48"
      className={wrapperClass}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-pose={pose}
    >
      {/* paper-deep base square — provides the framed-mark feel */}
      <rect
        x={1}
        y={1}
        width={46}
        height={46}
        className="fill-paper-deep"
        stroke="none"
      />
      {/* paper-deep border (drawn as a stroked rect at the same bounds) */}
      <rect x={1} y={1} width={46} height={46} />

      {/* sitting robot dog — geometric silhouette, square corners, no curves */}

      {/* ears — two short angled hairlines on top of the head */}
      <g transform={`rotate(${earTilt} 20 11)`}>
        <path d="M16 11 L18 7" />
      </g>
      <g transform={`rotate(${-earTilt} 28 11)`}>
        <path d="M32 11 L30 7" />
      </g>

      {/* head — square block sitting on the chest */}
      <rect x={14} y={11} width={20} height={14} />

      {/* eye — single hairline mark, alert but calm */}
      <path d="M19 17 H21" />
      <path d="M27 17 H29" />

      {/* muzzle bar — a horizontal line across the lower head */}
      <path d="M18 22 H30" />

      {/* a single antenna nub — keeps the "robot" reading */}
      <path d="M24 11 V8" />
      <circle cx={24} cy={7} r={1} />

      {/* neck connector */}
      <path d="M22 25 V28" />
      <path d="M26 25 V28" />

      {/* chest / front legs — sitting upright, square corners */}
      <rect x={18} y={28} width={12} height={12} />

      {/* haunches (back leg folded under, sitting pose) — angled block
          behind the chest, anchoring the figure to the ground line */}
      <path d="M30 30 L36 30 L36 40 L30 40 Z" />

      {/* paws / ground contact — two short lines at the base */}
      <path d="M18 42 H22" />
      <path d="M26 42 H30" />
      <path d="M32 42 H36" />

      {/* tail — angled hairline, posture nudged by pose */}
      <path d={tailLine} />
    </svg>
  );
}
