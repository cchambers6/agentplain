import Link from "next/link";
import LogoLockup from "./brand/LogoLockup";

// Marketing chrome navigation. Brand tokens only — no hardcoded hex.
//
// Nav order follows the visitor's story arc per `feedback_everything_tells_a_story.md`:
//   Verticals  → "is this for me?"
//   How it works → "what does it do?"
//   Pricing    → "what does it cost?" (standalone /pricing page since 2026-05-12)
//   Custom     → "what if Regular doesn't cover me?" (live since 2026-05-12 per
//                 project_stripe_both_surfaces.md simplification)
//   About      → "who are these people?"
//
// Mobile (<md): a server-rendered <details>/<summary> drawer (no JS) holds
// the full secondary nav AND "Sign in". The persistent mobile row is exactly
// three things — the brand lockup, the trial CTA, and a hamburger icon — so
// nothing collides or wraps at iPhone widths (360–414px). Earlier the row
// also carried a "Menu" text label + an always-visible "Sign in" + the long
// "Start free trial" label, which on a 390px viewport overlapped the wordmark,
// stacked "Sign / in" onto two lines, and wrapped the CTA onto three. Keeping
// the drawer also preserves WCAG-2.4.5 (multiple ways to navigate) and the
// story arc (visitors can still reach Verticals / Pricing on phone).
//
// Desktop (md+) is unchanged: inline links + inline "Sign in" + the full
// "Start free trial" CTA.
//
// Routes:
//   /verticals   — index of all 10 verticals
//   /#how        — How it works anchor on the marketing home
//   /pricing     — Standalone pricing page
//   /custom      — Custom-engagement page
//   /about       — Long-form positioning page
//   /app/sign-in — Product sign-in surface
//   /app/sign-up — Start free trial (first month free)

const PRIMARY_NAV: Array<{ href: string; label: string }> = [
  { href: "/verticals", label: "Verticals" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/custom", label: "Custom" },
  { href: "/about", label: "About" },
];

export default function Header() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-wide flex items-center justify-between py-5">
        <LogoLockup className="min-w-0" />
        <nav
          className="flex items-center gap-3 text-sm sm:gap-4 md:gap-6"
          aria-label="primary"
        >
          {/* Desktop nav — links inline at md+ */}
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-ink/70 transition hover:text-ink md:inline"
            >
              {item.label}
            </Link>
          ))}

          {/* Sign in — inline on desktop only. On mobile it lives inside the
              hamburger drawer (below) so the persistent row stays uncluttered. */}
          <Link
            href="/app/sign-in"
            className="hidden text-ink/70 transition hover:text-ink md:inline"
          >
            Sign in
          </Link>

          {/* Trial CTA — persistent at every width. whitespace-nowrap + a
              condensed mobile label ("Start trial") keep it on a single line
              at iPhone widths; desktop keeps the full "Start free trial". */}
          <Link
            href="/app/sign-up"
            className="btn-primary whitespace-nowrap px-3 py-2 text-xs tracking-wide sm:px-4"
          >
            <span className="md:hidden">Start trial</span>
            <span className="hidden md:inline">Start free trial</span>
            <span aria-hidden>→</span>
          </Link>

          {/* Hamburger drawer — server-rendered details/summary, no JS. Icon
              only (no "Menu" text). Shown below md, hidden at md+. Placed last
              so it sits at the far right on mobile. */}
          <details className="relative md:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center text-ink/70 transition hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </svg>
            </summary>
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-56 border border-rule bg-paper py-1 shadow-sm"
            >
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="block px-4 py-2.5 text-sm text-ink/80 transition hover:bg-paper-deep hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-rule" aria-hidden />
              <Link
                href="/app/sign-in"
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-ink/80 transition hover:bg-paper-deep hover:text-ink"
              >
                Sign in
              </Link>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
