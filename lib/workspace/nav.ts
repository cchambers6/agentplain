// Workspace navigation — the 5 customer-job tabs.
//
// The 13-tab IA (Overview / Talk / Disciplines / Fleet / Activity / Approvals
// / Agents / Compliance / Briefings / Integrations / Settings / Help) collapsed
// to five jobs a local-business owner actually has. See
// docs/specs/workspace-ia-simplification-2026-06-14.md.
//
//   Today        — "What needs me right now?"   (overview + approvals + activity)
//   Plaino       — "Let me talk to my partner."  (/talk + memory)
//   Connections  — "What can Plaino do + is it wired in?" (integrations + marketplace + roster)
//   Reports      — "Did I get my money's worth, and is everything safe?" (weekly + compliance + briefings)
//   Account      — "Manage my account."          (settings + support + billing)
//
// Extracted from layout.tsx so the tab set is a single source of truth and is
// unit-testable without rendering the (auth-gated, async) layout component.

export interface WorkspaceTab {
  /** Path segment appended to the workspace base. "" = Today (the overview). */
  href: string;
  /** Customer-facing label. No engineer vocab (no "Fleet", "Disciplines"). */
  label: string;
  /**
   * Extra path segments (relative to the workspace base) that should also
   * light this tab as active — the routes this tab absorbed in the 13→5
   * collapse. Lets the nav stay correct while those pages are still reachable
   * via in-tab hubs and backward-compat links during the phased migration.
   */
  match?: string[];
}

export const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  {
    href: "",
    label: "Today",
    // Approvals (the daily action spine), the activity feed, and the retired
    // Fleet hub all resolve to "what needs me right now".
    match: ["/activity", "/approvals", "/fleet"],
  },
  { href: "/talk", label: "Plaino" },
  {
    href: "/connections",
    label: "Connections",
    match: ["/integrations", "/marketplace", "/agents", "/disciplines"],
  },
  {
    href: "/reports",
    label: "Reports",
    match: ["/briefings", "/compliance"],
  },
  {
    href: "/settings",
    label: "Account",
    match: ["/support"],
  },
] as const;
