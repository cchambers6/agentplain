"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

// Square-corner heritage CTA — clay fill (primary), paper border (secondary),
// or plain text-link with arrow (ghost). No gradients, no transforms on hover,
// no rounded corners. Per design language §2.4 / §1.7. Label text MUST be a
// verb-led, lowercase phrase ("approve draft", "connect gmail") — no Title Case.

export type ApHeritageButtonVariant = "primary" | "secondary" | "ghost";
export type ApHeritageButtonSize = "default" | "lg";

type CommonProps = {
  variant?: ApHeritageButtonVariant;
  /**
   * Size step. `default` is the standard CTA. `lg` is the confident heritage CTA
   * from the design-mirror (docs/brand/design-mirror-2026-06-19.md §5/§6, Mailchimp
   * + heritage): bigger, surer, for a single hero moment — one per fold, never
   * stacked. Ignored on the `ghost` variant (a text link has no scale step).
   */
  size?: ApHeritageButtonSize;
  /** Optional trailing chevron, useful on primary / secondary CTAs. */
  withArrow?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type AsAnchorProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
    /** Defaults to false — Next/Link does not need to prefetch most product CTAs. */
    prefetch?: boolean;
  };

export type ApHeritageButtonProps = AsButtonProps | AsAnchorProps;

// `gap`/`text-size` live in SIZE (and on the ghost variant) so the `lg` step can
// override them cleanly without relying on CSS source order.
const BASE =
  "inline-flex items-center justify-center rounded-none font-sans font-medium transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:ring-clay";

const VARIANT: Record<ApHeritageButtonVariant, string> = {
  primary:
    "border border-clay bg-clay text-paper hover:border-clay-deep hover:bg-clay-deep",
  secondary:
    "border border-ink/30 bg-transparent text-ink hover:border-ink hover:bg-ink/[0.03]",
  ghost:
    "gap-2 px-2 py-1 text-sm text-ink underline-offset-4 hover:underline",
};

// Padding/scale step. Applies to primary + secondary; ghost carries its own
// text-link padding/size and ignores the size step. `lg` is the confident
// heritage CTA — bigger type, more air, one per fold.
const SIZE: Record<ApHeritageButtonSize, string> = {
  default: "gap-2 px-6 py-3 text-sm",
  lg: "gap-2.5 px-8 py-4 text-base",
};

/**
 * @example
 * <ApHeritageButton variant="primary" withArrow href="/app/sign-up">
 *   open workspace
 * </ApHeritageButton>
 *
 * <ApHeritageButton variant="secondary" type="submit">approve draft</ApHeritageButton>
 *
 * <ApHeritageButton variant="ghost" href={`/app/workspace/${id}/agents`}>
 *   see fleet
 * </ApHeritageButton>
 */
export const ApHeritageButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ApHeritageButtonProps
>(function ApHeritageButton(props, ref) {
  const { variant = "primary", size = "default", withArrow, children, className } = props;
  // Ghost is a text link — it owns its padding/size and ignores the size step.
  const sizeClasses = variant === "ghost" ? "" : SIZE[size];
  const classes = [BASE, VARIANT[variant], sizeClasses, className]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {children}
      {withArrow ? <span aria-hidden>→</span> : null}
    </>
  );

  if ("href" in props && props.href) {
    const { variant: _v, size: _s, withArrow: _w, children: _c, className: _cl, href, prefetch = false, ...rest } = props;
    return (
      <Link
        href={href}
        prefetch={prefetch}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        {...rest}
      >
        {body}
      </Link>
    );
  }

  const { variant: _v, size: _s, withArrow: _w, children: _c, className: _cl, ...rest } = props as AsButtonProps;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      {...rest}
    >
      {body}
    </button>
  );
});
