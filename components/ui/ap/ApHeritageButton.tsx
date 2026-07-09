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
export type ApHeritageButtonSize = "sm" | "default" | "lg";

type CommonProps = {
  variant?: ApHeritageButtonVariant;
  /**
   * Size step. `default` is the standard CTA. `lg` is the confident heritage CTA
   * from the design-mirror (docs/brand/design-mirror-2026-06-19.md §5/§6, Mailchimp
   * + heritage): bigger, surer, for a single hero moment — one per fold, never
   * stacked. `sm` is for dense desktop rows (tables, hairline lists) ONLY — it
   * sits under the 44px touch target, so never use it as a primary mobile
   * affordance. Ignored on the `ghost` variant (a text link has no scale step).
   */
  size?: ApHeritageButtonSize;
  /** Optional trailing chevron, useful on primary / secondary CTAs. */
  withArrow?: boolean;
  /**
   * Optional leading slot for a small inline glyph (an ApMotif at 16px, a mono
   * character). Rendered aria-hidden — the label text carries the meaning.
   */
  icon?: ReactNode;
  /**
   * In-flight state for submit-style actions. Dims the label, disables the
   * control, sets aria-busy, and swaps the trailing arrow for a quiet mono
   * ellipsis. NO spinner — per design language §1.5 (the no-spinner rule),
   * waiting is shown as stillness, not churn.
   */
  loading?: boolean;
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
  // text-white, not text-paper: cream on clay sat at 4.19:1 and failed WCAG AA;
  // white clears it at 4.76:1 (standing P0 from the 2026-06-22 reviews, closed
  // 2026-07-08 — matches .btn-primary in globals.css and the portal buttons).
  primary:
    "border border-clay bg-clay text-white hover:border-clay-deep hover:bg-clay-deep",
  secondary:
    "border border-ink/30 bg-transparent text-ink hover:border-ink hover:bg-ink/[0.03]",
  ghost:
    "gap-2 px-2 py-1 text-sm text-ink underline-offset-4 hover:underline",
};

// Padding/scale step. Applies to primary + secondary; ghost carries its own
// text-link padding/size and ignores the size step. `default` and `lg` clear
// the 44px touch target (kaizen 2026-07-02 improvement 4d — fixed here once so
// every consumer inherits it); `sm` is dense-desktop-only by contract.
const SIZE: Record<ApHeritageButtonSize, string> = {
  sm: "gap-2 px-4 py-1.5 text-[13px] min-h-[36px]",
  default: "gap-2 px-6 py-3 text-sm min-h-[44px]",
  lg: "gap-2.5 px-8 py-4 text-base min-h-[44px]",
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
  const {
    variant = "primary",
    size = "default",
    withArrow,
    icon,
    loading = false,
    children,
    className,
  } = props;
  // Ghost is a text link — it owns its padding/size and ignores the size step.
  const sizeClasses = variant === "ghost" ? "" : SIZE[size];
  const classes = [
    BASE,
    VARIANT[variant],
    sizeClasses,
    loading ? "cursor-wait" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span className={loading ? "opacity-60" : undefined}>{children}</span>
      {loading ? (
        <span aria-hidden className="font-mono">
          …
        </span>
      ) : withArrow ? (
        <span aria-hidden>→</span>
      ) : null}
    </>
  );

  if ("href" in props && props.href) {
    const { variant: _v, size: _s, withArrow: _w, icon: _i, loading: _l, children: _c, className: _cl, href, prefetch = false, ...rest } = props;
    return (
      <Link
        href={href}
        prefetch={prefetch}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        aria-busy={loading || undefined}
        {...rest}
      >
        {body}
      </Link>
    );
  }

  const { variant: _v, size: _s, withArrow: _w, icon: _i, loading: _l, children: _c, className: _cl, disabled, ...rest } = props as AsButtonProps;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {body}
    </button>
  );
});
