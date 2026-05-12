import Link from "next/link";
import { tokens } from "@/lib/brand/tokens";

// Canonical agentplain wordmark. spec §2:
// - lowercase, single word, display serif
// - no monogram, no "ap" lockup, no geometric mark
// - clear space: 1× cap-height of "a" on every side (controlled by callers via spacing)
// - minimum size: 88px wide on screen — below that, switch to the favicon mark
// Variants render the same wordmark in two color treatments:
//   default  = ink on whatever the parent surface is (default usage)
//   inverted = paper on ink (for ink surfaces like the footer CTA banner)

type LogoVariant = "default" | "inverted";
type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  /** When true (default), wraps the wordmark in a Link to /. Set false inside an existing anchor. */
  asLink?: boolean;
};

const SIZE_CLASS: Record<LogoSize, string> = {
  sm: "text-[1.25rem]",
  md: "text-[1.6rem]",
  lg: "text-[2.25rem]",
};

const VARIANT_CLASS: Record<LogoVariant, string> = {
  default: "text-ink",
  inverted: "text-paper",
};

export default function Logo({
  variant = "default",
  size = "md",
  className = "",
  asLink = true,
}: LogoProps) {
  const wordmark = (
    <span
      className={`font-display leading-none tracking-tight ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
    >
      {tokens.wordmark}
    </span>
  );

  if (!asLink) return wordmark;

  return (
    <Link
      href="/"
      aria-label={`${tokens.wordmark} — home`}
      className="inline-flex items-baseline"
    >
      {wordmark}
    </Link>
  );
}
