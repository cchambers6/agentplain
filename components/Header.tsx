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
// Mobile: a server-rendered <details>/<summary> menu (no JS) exposes the
// secondary nav items. The previous "hidden md:inline" approach left mobile
// visitors looking at only Sign in + Start free trial — they couldn't
// reach Verticals or Pricing without scrolling to the footer. That was a
// WCAG-2.4.5 issue (multiple ways to navigate) and a story-arc issue
// (visitors can't answer Q2 / Q4 / Q6 on phone).
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
        <LogoLockup />
        <nav className="flex items-center gap-6 text-sm" aria-label="primary">
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

          {/* Mobile menu — server-rendered details/summary, no JS. Shown
              below md, hidden at md+. */}
          <details className="relative md:hidden">
            <summary
              className="flex h-8 cursor-pointer list-none items-center gap-1.5 text-ink/70 transition hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label="open menu"
            >
              Menu
              <span aria-hidden className="text-[10px]">▾</span>
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
            </div>
          </details>

          <Link
            href="/app/sign-in"
            className="text-ink/70 transition hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/app/sign-up"
            className="btn-primary px-4 py-2 text-xs tracking-wide"
          >
            Start free trial
            <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
