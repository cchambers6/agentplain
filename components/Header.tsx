import Link from "next/link";
import Logo from "./brand/Logo";

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
// Routes:
//   /verticals   — index of all 10 verticals (single per-seat tier per
//                  project_stripe_both_surfaces.md 2026-05-12 simplification)
//   /#how        — How it works anchor on the marketing home
//   /pricing     — Standalone pricing page (single tier + ROI calc)
//   /custom      — Custom-engagement page (per-scope work for anything Regular doesn't cover)
//   /about       — Long-form positioning page
//   /app/sign-in — Product sign-in surface
//   /app/sign-up — Start free trial (signup; first month free; per
//                  project_app_build_now_not_gated.md, customer surface is open)
export default function Header() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-wide flex items-center justify-between py-5">
        <Logo />
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/verticals"
            className="hidden text-ink/70 transition hover:text-ink md:inline"
          >
            Verticals
          </Link>
          <Link
            href="/#how"
            className="hidden text-ink/70 transition hover:text-ink lg:inline"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="hidden text-ink/70 transition hover:text-ink md:inline"
          >
            Pricing
          </Link>
          <Link
            href="/custom"
            className="hidden text-ink/70 transition hover:text-ink md:inline"
          >
            Custom
          </Link>
          <Link
            href="/about"
            className="hidden text-ink/70 transition hover:text-ink md:inline"
          >
            About
          </Link>
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
