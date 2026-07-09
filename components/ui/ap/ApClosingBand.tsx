import Link from "next/link";
import type { ReactNode } from "react";
import { tokens } from "@/lib/brand/tokens";

// The one grounded close every long page ends on. Before this component the
// estate had two competing closes (home on forest-deep, about/how-it-works/
// compare on bg-ink) — kaizen 2026-07-02 improvement 4c asked for one answer,
// and the answer is the heritage one: the deepest field tone (forest-deep),
// letterpress inverted, a visible hairline at the band→footer seam so the two
// dark panels read as stacked plates instead of one undifferentiated void.
//
// The tagline eyebrow is on by default (it IS the closing signature); pass
// `eyebrow={null}` only when the band sits on a page that already spent the
// tagline in its own chrome.

interface ApClosingBandProps {
  /** Mono eyebrow. Defaults to the locked tagline. Pass null to omit. */
  eyebrow?: ReactNode | null;
  /** Display-serif closing statement. */
  title: ReactNode;
  /** Supporting paragraph, cream at 75%. */
  body?: ReactNode;
  /** CTA row — compose from ApClosingBandAction. 2–4 actions, primary first. */
  actions?: ReactNode;
  className?: string;
}

export function ApClosingBand({
  eyebrow = tokens.tagline,
  title,
  body,
  actions,
  className,
}: ApClosingBandProps) {
  const classes = [
    "border-b border-forest bg-forest-deep text-paper letterpress-dark",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={classes}>
      <div className="container-wide py-24 md:py-32">
        {eyebrow ? <p className="eyebrow mb-6 text-paper/60">{eyebrow}</p> : null}
        <h2 className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
          {title}
        </h2>
        {body ? (
          <div className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            {body}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-10 flex flex-wrap gap-4">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

// CTA for the dark ground. `primary` is the cream-filled lead action (one per
// band); `secondary` is the outlined follow; `quiet` recedes for the third+
// link. External hrefs (mailto:, https:) render an <a>; internal paths render
// a Next <Link>. 44px touch target inherited via min-h.

type ActionVariant = "primary" | "secondary" | "quiet";

const ACTION_CLASS: Record<ActionVariant, string> = {
  primary:
    "border border-paper bg-paper text-ink hover:bg-paper-deep",
  secondary:
    "border border-paper/40 bg-transparent text-paper hover:border-paper",
  quiet:
    "border border-paper/20 bg-transparent text-paper/80 hover:border-paper hover:text-paper",
};

interface ApClosingBandActionProps {
  href: string;
  variant?: ActionVariant;
  /** Open in a new tab (external booking links). Adds rel=noopener. */
  newTab?: boolean;
  withArrow?: boolean;
  children: ReactNode;
}

export function ApClosingBandAction({
  href,
  variant = "secondary",
  newTab = false,
  withArrow = true,
  children,
}: ApClosingBandActionProps) {
  const classes = `inline-flex min-h-[44px] items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition ${ACTION_CLASS[variant]}`;
  const body = (
    <>
      {children}
      {withArrow ? <span aria-hidden>→</span> : null}
    </>
  );
  const external = /^[a-z]+:/.test(href) && !href.startsWith("/");
  if (external || newTab) {
    return (
      <a
        href={href}
        className={classes}
        {...(newTab
          ? { target: "_blank", rel: "noopener noreferrer" }
          : undefined)}
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {body}
    </Link>
  );
}
