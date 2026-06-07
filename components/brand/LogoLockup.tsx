import Link from "next/link";
import Logo from "./Logo";
import { Plaino } from "@/components/ui/ap";
import { tokens } from "@/lib/brand/tokens";

// Horizontal brand lockup: the Plaino head-icon mark + the agentplain
// wordmark. Used in product/marketing chrome where the mark and the name
// appear together. The mark is decorative — the wordmark names the brand,
// so screen readers read the link label once (not "Plaino, agentplain").
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
  const inner = (
    <>
      <Plaino state="head-icon" size={size} />
      <Logo asLink={false} variant={variant} />
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
