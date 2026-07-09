import type { HTMLAttributes, ReactNode } from "react";

// Mono micro-label badge — square-cornered, hairline-bordered, set in the
// eyebrow voice. The heritage answer to the SaaS "pill": no rounded-full, no
// tinted chip soup. Five semantic tones mapped to tokens; text colors are
// WCAG-checked at this size (11px):
//   neutral   — border-rule, mute text. Categories, metadata.
//   verified  — moss. Passed / connected / counsel-cleared.
//   attention — flag. Needs the customer; the only red on a working surface.
//   accent    — clay-DEEP text (clay itself is 4.19:1 at small sizes and
//               fails AA — the deep step clears 5.9:1).
//   harvest   — clay-wash ground + ink text. The rare premium marker (a
//               featured tier, a new capability) — at most one per view,
//               same budget as the wheat accent it stands in for.

export type ApBadgeTone =
  | "neutral"
  | "verified"
  | "attention"
  | "accent"
  | "harvest";

const TONE: Record<ApBadgeTone, string> = {
  neutral: "border-rule text-mute",
  verified: "border-moss/50 text-moss",
  attention: "border-flag/50 text-flag",
  accent: "border-clay/50 text-clay-deep",
  harvest: "border-mid-rule bg-clay-wash text-ink",
};

interface ApBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ApBadgeTone;
  children: ReactNode;
}

/**
 * @example
 * <ApBadge tone="verified">connected</ApBadge>
 * <ApBadge tone="attention">needs a connector</ApBadge>
 * <ApBadge tone="harvest">named partner</ApBadge>
 */
export function ApBadge({
  tone = "neutral",
  className,
  children,
  ...rest
}: ApBadgeProps) {
  const classes = [
    "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] tracking-eyebrow uppercase",
    TONE[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
