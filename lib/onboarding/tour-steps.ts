// First-run Plaino walkthrough — declarative step config.
//
// The tour fires once per member per workspace (gated by
// Membership.welcomeTourSeenAt) on their first workspace load. It is a
// spotlight tour, NOT a blocking modal: each step dims the page and frames
// one real nav element while a popover explains it in Plaino's voice. The
// page stays fully usable underneath (the dim layer is pointer-events:none).
//
// Voice: warm, brief, first-person. Plaino is a working sheepdog introducing
// his own home — calm, not chirpy. Per project_no_outbound_architecture.md,
// copy says watch / draft / advise and "you sign" — never that Plaino sends.
//
// SELECTOR CONTRACT — read before renaming nav.
//   Anchored steps bind to `[data-tour="<key>"]` attributes rendered by the
//   workspace nav (app/(product)/app/workspace/[id]/layout.tsx via
//   WorkspaceNavLink). The selectors here are the single source of truth;
//   the layout sets the matching keys. If a nav item is renamed, removed, or
//   not yet mounted (e.g. a future mobile collapsed menu), WelcomeTour does
//   NOT crash or stall: a step whose `selector` resolves to nothing renders
//   its popover CENTERED (no spotlight) and the copy still reads. Steps with
//   `selector: null` are always centered (welcome + end). This is why the
//   copy never says "click the highlighted box" — it names the tab by label,
//   so it remains true whether or not the spotlight lands.

export type TourPlacement = "auto" | "center";

export interface TourStep {
  /** Stable id — also used as the React key and the analytics-friendly slug. */
  id: string;
  /** Mono eyebrow above the title (lowercase, design-language §1.4). */
  eyebrow: string;
  /** Display-serif title — one short line. */
  title: string;
  /** Body copy in Plaino's voice. Plain string; rendered as a paragraph. */
  body: string;
  /** CSS selector for the element to spotlight, or null for a centered card.
   *  When the selector matches nothing at runtime the step falls back to a
   *  centered card automatically. */
  selector: string | null;
  /** Preferred placement. "center" forces a centered card even if the
   *  selector matches; "auto" (default) anchors to the matched element and
   *  picks a side with room. */
  placement?: TourPlacement;
}

// Steps map to the REAL workspace IA as of 2026-06-15
// (layout.tsx NAV: Overview / Talk to Plaino / … / Approvals / … /
// Integrations / Settings). We surface the five that orient a brand-new
// owner to the core loop and skip the deeper operational tabs (Disciplines /
// Fleet / Activity / Agents / Compliance / Briefings / Help) so the first run
// stays short — they discover those from Overview once they know the shape.
export const WELCOME_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    eyebrow: "welcome",
    title: "Hi, I'm Plaino.",
    body: "I'm your service partner at agentplain — I run the work that takes time away from the people you serve. Give me two minutes and I'll show you around your shop.",
    selector: null,
    placement: "center",
  },
  {
    id: "overview",
    eyebrow: "the tour · 1 of 5",
    title: "Start here every day.",
    body: "Overview is home base. It's where you'll see what I'm watching, what I'm working on, and anything that needs your eyes. If you only check one tab, check this one.",
    selector: '[data-tour="nav-overview"]',
  },
  {
    id: "talk",
    eyebrow: "the tour · 2 of 5",
    title: "Tell me what's on your plate.",
    body: "Talk to Plaino is just that — tell me what you need handled, what's worrying you, what's slipping. I'll figure out what to do and put the work in motion.",
    selector: '[data-tour="nav-talk"]',
  },
  {
    id: "integrations",
    eyebrow: "the tour · 3 of 5",
    title: "Connect your tools.",
    body: "This is where you hook me up to the tools you already use — your inbox, calendar, CRM. I read them so I can do real work. The more I can see, the more I can take off your hands. I only ever read; nothing changes without you.",
    selector: '[data-tour="nav-integrations"]',
  },
  {
    id: "approvals",
    eyebrow: "the tour · 4 of 5",
    title: "Nothing goes out without your okay.",
    body: "Anything that touches a customer waits for you here. I draft it, you read it, you sign — then it goes. Approvals is your seat at the wheel; I never send on my own.",
    selector: '[data-tour="nav-approvals"]',
  },
  {
    id: "settings",
    eyebrow: "the tour · 5 of 5",
    title: "Make me yours.",
    body: "Settings is where you shape how I work — your vertical, the voice I draft in, your brand details, billing. Set it once and I carry it into everything.",
    selector: '[data-tour="nav-settings"]',
  },
  {
    id: "end",
    eyebrow: "all set",
    title: "That's the shop.",
    body: "Best first move: connect one tool and let me start. I'll take it from there — and I'm always a message away in Talk to Plaino.",
    selector: null,
    placement: "center",
  },
];

/** Map of nav href suffix → the data-tour key the layout should stamp on it.
 *  Kept beside the steps so the layout and the tour can't drift: the layout
 *  imports this to label its nav links, the steps select on the same keys. */
export const NAV_TOUR_KEYS: Record<string, string> = {
  "": "nav-overview",
  "/talk": "nav-talk",
  "/integrations": "nav-integrations",
  "/approvals": "nav-approvals",
  "/settings": "nav-settings",
};
