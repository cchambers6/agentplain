import Link from "next/link";
import Logo from "./Logo";
import { PlainoMark } from "@/components/ui/ap";
import { tokens } from "@/lib/brand/tokens";

// Horizontal brand lockup: the 8-bit Plaino BRAND mark (PlainoMark) + the
// agentplain wordmark. Used in product/marketing chrome where the mark and the
// name appear together. Per the two-family split (Conner 2026-06-10), the
// header is an identity surface → the static 8-bit mark, never a live pose.
// The mark is decorative — the wordmark names the brand, so screen readers
// read the link label once (not "Plaino, agentplain").
//
// Below the wordmark's 88px minimum (spec §2) callers should drop to the
// bare favicon mark instead of this lockup.

type LogoLockupProps = {
  /** Head-icon size in px. Defaults to 32 to pair with the md wordmark. */
  size?: number;
  variant?: "default" | "inverted";
  className?: string;
  /** When true (default) the lockup is a link to /. */
  asLink?: boolean;
};

export default function LogoLockup({
  size = 32,
  variant = "default",
  className = "",
  asLink = true,
}: LogoLockupProps) {
  // The wordmark steps down a size below `sm` (640px) so the lockup fits
  // alongside the trial CTA + hamburger on iPhone widths without overlapping.
  // Logo's `sm` size sets the base text-[1.25rem]; the sm: override restores
  // the full md wordmark from 640px up, so desktop is unchanged. (A single
  // responsive class — not two competing base classes — keeps it deterministic
  // regardless of Tailwind's utility ordering.)
  const inner = (
    <>
      <PlainoMark size={size} />
      <Logo
        asLink={false}
        variant={variant}
        size="sm"
        className="sm:text-[1.6rem]"
      />
    </>
  );

  if (!asLink) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href="/"
      aria-label={`${tokens.wordmark} — home`}
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      {inner}
    </Link>
  );
}
