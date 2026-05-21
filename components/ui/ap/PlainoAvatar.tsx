import type { SVGProps } from "react";

// Placeholder mark for Plaino, the named service partner. The logo v3
// pack is still unmerged; this is a line-art robot drawn in the same
// hairline-stroke language as ApMotif (§2.6 of the design language doc).
//
// TODO: replace with canonical Plaino mark when logo v3 lands.
//
// Visual rules (matches the rest of the product surface):
//   - 1.5px stroke, currentColor, square corners (no rounded-*).
//   - paper-deep base behind the figure so the avatar reads as a
//     framed mark instead of a floating doodle.
//   - foreground is ink by default; tone="clay" or tone="moss" override
//     when the avatar charges a clay moment (e.g. error / outage state).
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

interface PlainoAvatarProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: PlainoAvatarSize;
  tone?: PlainoAvatarTone;
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

      {/* antenna */}
      <path d="M24 6 V10" />
      <circle cx={24} cy={5} r={1.5} />

      {/* head — square mark, square corners */}
      <rect x={12} y={11} width={24} height={18} />

      {/* eyes — short hairline marks, not filled dots */}
      <path d="M18 19 H20" />
      <path d="M28 19 H30" />

      {/* mouth — single calm line, no smile, no frown */}
      <path d="M19 24 H29" />

      {/* neck */}
      <path d="M22 29 V32" />
      <path d="M26 29 V32" />

      {/* body — square corners, taller than the head */}
      <rect x={14} y={32} width={20} height={10} />

      {/* a single chest mark, like a worn enamel pin */}
      <path d="M22 37 H26" />
    </svg>
  );
}
