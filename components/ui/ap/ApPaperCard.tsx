import type { HTMLAttributes, ReactNode } from "react";
import { ApEyebrow } from "./ApEyebrow";

// Workhorse container — paper background, hairline border, no shadow, square corners.
// Per design language §3.2. Use for any single block of content: a stat, a draft,
// an integration tile, a settings panel. One CTA per card maximum.

export type ApPaperCardDensity = "dense" | "default" | "spacious";

interface ApPaperCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Mono uppercase label rendered above the title. */
  eyebrow?: ReactNode;
  /** Display-serif card title. Single line preferred. */
  title?: ReactNode;
  /** Optional explicit footer node (e.g. a single CTA, hairline-separated). */
  footer?: ReactNode;
  /** Whether the card is interactive (renders the hover-border affordance). */
  interactive?: boolean;
  /** Density step — drives padding. Defaults to `default` (p-6 md:p-8). */
  density?: ApPaperCardDensity;
  children?: ReactNode;
}

const PADDING: Record<ApPaperCardDensity, string> = {
  dense: "p-5",
  default: "p-6 md:p-8",
  spacious: "p-8 md:p-10",
};

/**
 * @example
 * <ApPaperCard
 *   eyebrow="today's progress"
 *   title="3 drafts ready"
 *   footer={<ApHeritageButton variant="secondary" href="/queue">open queue</ApHeritageButton>}
 * >
 *   <p className="text-[15px] leading-relaxed text-ink-soft">
 *     Your fleet drafted three replies overnight. None flagged.
 *   </p>
 * </ApPaperCard>
 */
export function ApPaperCard({
  eyebrow,
  title,
  footer,
  interactive = false,
  density = "default",
  className,
  children,
  ...rest
}: ApPaperCardProps) {
  const classes = [
    "bg-paper border border-rule",
    PADDING[density],
    interactive ? "transition hover:border-ink" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {eyebrow ? <ApEyebrow className="mb-2">{eyebrow}</ApEyebrow> : null}
      {title ? (
        <h2 className="font-display text-2xl leading-snug text-ink md:text-[1.6rem]">
          {title}
        </h2>
      ) : null}
      {children ? (
        <div className={title || eyebrow ? "mt-4" : ""}>{children}</div>
      ) : null}
      {footer ? (
        <div className="mt-6 border-t border-rule pt-5">{footer}</div>
      ) : null}
    </div>
  );
}
