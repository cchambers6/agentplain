"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface WorkspaceNavLinkProps {
  href: string;
  /** True when this nav item points at the workspace overview (the empty
   *  href base). Overview matches only the exact workspace base — other
   *  sub-paths handle their own active check. */
  exact?: boolean;
  children: ReactNode;
}

/**
 * Client wrapper for workspace-nav links. Sets `aria-current="page"` and a
 * visible active indicator (underline + text-ink, vs the muted ink/70 rest
 * state) so keyboard + screen-reader users can locate themselves.
 *
 * WCAG 2.4.8 (Location). The original link composition relied on hover
 * styling alone — keyboard users had no way to tell which workspace
 * section they were inside without reading the URL.
 */
export function WorkspaceNavLink({ href, exact, children }: WorkspaceNavLinkProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "whitespace-nowrap rounded-none text-ink underline underline-offset-[6px] decoration-clay decoration-2 focus:outline-none focus-visible:text-ink"
          : "whitespace-nowrap rounded-none text-ink/70 transition hover:text-ink focus:outline-none focus-visible:text-ink focus-visible:underline focus-visible:underline-offset-4"
      }
    >
      {children}
    </Link>
  );
}
