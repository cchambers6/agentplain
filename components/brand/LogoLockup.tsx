import Link from "next/link";
import { tokens } from "@/lib/brand/tokens";

// Horizontal brand lockup: the 8-bit robot-dog mark (pixel art, on its plain)
// next to the serif wordmark.
//
// The mark is the public agentplain brand mark ratified 2026-06-06 — the robot
// dog metaphor is now a customer-facing logo, per
// ~/.claude/projects/C--agentplain/memory/project_brand_public_robot_dog_ratified_2026_06_06.md
//
// The wordmark is rendered as live text (not baked into the SVG) so it inherits
// the page's loaded Source Serif 4 web font and stays pixel-identical to the
// rest of the site's display type. The pixel mark is a static SVG (crispEdges,
// no font dependency) loaded as an <img>.
//
// `direction` selects which candidate art direction to show. Defaults to
// direction-13 — the higher-fidelity standing hound (chest panel + antenna +
// collar) wired as the production brand mark while a human pixel artist is
// commissioned for the final v2. Change the default to swap the shipped mark.

type LockupVariant = "default" | "inverted";
type LockupSize = "sm" | "md" | "lg";

type LogoLockupProps = {
  direction?: number;
  variant?: LockupVariant;
  size?: LockupSize;
  className?: string;
  asLink?: boolean;
};

const WORDMARK_SIZE: Record<LockupSize, string> = {
  sm: "text-[1.25rem]",
  md: "text-[1.6rem]",
  lg: "text-[2.25rem]",
};

// Height-based with auto width: the hi-fi hound mark (direction-13) is wider
// than tall, so a fixed square box would squish it. h-N w-auto preserves aspect.
const MARK_SIZE: Record<LockupSize, string> = {
  sm: "h-7 w-auto",
  md: "h-9 w-auto",
  lg: "h-12 w-auto",
};

const WORD_COLOR: Record<LockupVariant, string> = {
  default: "text-ink",
  inverted: "text-paper",
};

export default function LogoLockup({
  direction = 13,
  variant = "default",
  size = "md",
  className = "",
  asLink = true,
}: LogoLockupProps) {
  const lockup = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/brand/direction-${direction}/logo-icon.svg`}
        alt=""
        aria-hidden
        className={`${MARK_SIZE[size]} shrink-0`}
        style={{ imageRendering: "pixelated" }}
      />
      <span
        className={`font-display leading-none tracking-tight ${WORDMARK_SIZE[size]} ${WORD_COLOR[variant]}`}
      >
        {tokens.wordmark}
      </span>
    </span>
  );

  if (!asLink) return lockup;

  return (
    <Link
      href="/"
      aria-label={`${tokens.wordmark} — home`}
      className="inline-flex items-center"
    >
      {lockup}
    </Link>
  );
}
