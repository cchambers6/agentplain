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

type CommonProps = {
  variant?: ApHeritageButtonVariant;
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

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-none font-sans text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:ring-clay";

const VARIANT: Record<ApHeritageButtonVariant, string> = {
  primary:
    "border border-clay bg-clay px-6 py-3 text-paper hover:border-clay-deep hover:bg-clay-deep",
  secondary:
    "border border-ink/30 bg-transparent px-6 py-3 text-ink hover:border-ink hover:bg-ink/[0.03]",
  ghost:
    "px-2 py-1 text-ink underline-offset-4 hover:underline",
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
  const { variant = "primary", withArrow, children, className } = props;
  const classes = [BASE, VARIANT[variant], className].filter(Boolean).join(" ");

  const body = (
    <>
      {children}
      {withArrow ? <span aria-hidden>→</span> : null}
    </>
  );

  if ("href" in props && props.href) {
    const { variant: _v, withArrow: _w, children: _c, className: _cl, href, prefetch = false, ...rest } = props;
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

  const { variant: _v, withArrow: _w, children: _c, className: _cl, ...rest } = props as AsButtonProps;
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
