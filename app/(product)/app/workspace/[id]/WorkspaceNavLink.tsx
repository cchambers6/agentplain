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
  /**
   * Extra full hrefs that should also mark this tab active. In the 13→5 IA
   * collapse one tab absorbs several routes (e.g. Connections owns
   * /integrations, /marketplace, /agents) that are still reachable via in-tab
   * hubs; this keeps the right tab lit when the customer lands on one of them.
   */
  match?: string[];
  /** Optional stable hook for the first-run welcome tour (e.g. "nav-talk").
   *  Rendered as `data-tour` so WelcomeTour can spotlight this link without
   *  depending on label text or DOM order. */
  dataTour?: string;
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
export function WorkspaceNavLink({ href, exact, match, dataTour, children }: WorkspaceNavLinkProps) {
  const pathname = usePathname();
  const onPath = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  const matchesAbsorbed = match?.some(onPath) ?? false;
  const isActive = exact
    ? pathname === href || matchesAbsorbed
    : onPath(href) || matchesAbsorbed;

  return (
    <Link
      href={href}
      data-tour={dataTour}
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
