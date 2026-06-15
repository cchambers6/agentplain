"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface WorkspaceMobileNavProps {
  /** Workspace route base, e.g. `/app/workspace/abc123`. */
  base: string;
}

interface Tab {
  href: string;
  label: string;
  icon: ReactNode;
  /** True for the landing tab so it matches its exact path, not sub-paths. */
  exact?: boolean;
}

// 5 bottom tabs — the structural payoff of the IA simplification. 14 nav
// entries do not fit a phone; 5 do. 5 is the proven ceiling for a bottom tab
// bar (workspace-ia-simplification-2026-06-14, Section C). Sub-routes open
// in-tab; the bar mirrors the desktop ApWorkspaceStrip nav exactly.
const ICON = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16v15H4z" />
      <path d="M4 9h16M8 3v4M16 3v4" />
      <path d="M8 14l2.5 2.5L16 11" />
    </svg>
  ),
  plaino: (
    // Plaino — the partner. A calm dog-mark glyph (the brand metaphor).
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 10c0-1 .8-2 1.8-1.7L9 9h6l2.2-.7C18.2 8 19 9 19 10v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" />
      <path d="M5.5 8.5 4 6M18.5 8.5 20 6" />
      <circle cx="10" cy="13" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r=".6" fill="currentColor" stroke="none" />
      <path d="M11 16h2" />
    </svg>
  ),
  connections: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 7 7 9a3.5 3.5 0 0 0 0 5l1 1M15 17l2-2a3.5 3.5 0 0 0 0-5l-1-1" />
      <path d="M9.5 14.5 14.5 9.5" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

export function WorkspaceMobileNav({ base }: WorkspaceMobileNavProps) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: `${base}/today`, label: "Today", icon: ICON.today },
    { href: `${base}/plaino`, label: "Plaino", icon: ICON.plaino },
    { href: `${base}/connections`, label: "Connections", icon: ICON.connections },
    { href: `${base}/reports`, label: "Reports", icon: ICON.reports },
    { href: `${base}/account`, label: "Account", icon: ICON.account },
  ];

  return (
    <nav
      aria-label="workspace sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] ${
                  isActive ? "text-ink" : "text-mute"
                } focus:outline-none focus-visible:text-ink`}
              >
                <span
                  aria-hidden
                  className={`h-6 w-6 ${isActive ? "text-clay" : ""}`}
                >
                  {tab.icon}
                </span>
                <span className="leading-none">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
