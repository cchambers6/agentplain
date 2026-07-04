import Link from "next/link";
import Logo from "./brand/Logo";
import { tokens } from "@/lib/brand/tokens";
import { getAllVerticals } from "@/lib/verticals";

// Marketing footer. Brand tokens only.
// Four-column layout: brand / Verticals / Product / Company.
// Per project_brand_locked.md the wordmark stays lowercase and the tagline
// `tokens.tagline` is the only top-line subhead allowed.
//
// The footer bottom strip carries © + brand-summary line ONLY. Internal
// product-development metadata (build version, "v0", "status: build",
// last-updated dates) is banned from customer surfaces per
// ~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md
// — it doesn't answer any visitor's question and surfaces internal language
// to people who don't know what an agent is yet.

export default function Footer() {
  const verticals = getAllVerticals();
  // Heritage Plains Editorial rollout (2026-06-22): the footer is grounded in the
  // deepest field tone (forest-deep) with cream type — the heritage chrome that
  // closes every page. The wordmark uses Logo's existing `inverted` variant
  // (paper-on-dark); the logo component itself is untouched.
  return (
    <footer className="border-t border-forest-deep bg-forest-deep text-paper/85">
      <div className="container-wide grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo variant="inverted" />
          <p className="mt-5 max-w-sm font-display text-2xl leading-snug text-paper">
            {tokens.tagline}
          </p>
          <p className="mt-3 max-w-sm text-sm text-paper/55">
            A service partnership for local businesses. We install a fleet of
            capable AI partners, run reviews, customize as your ops shift —
            so you stay focused on the people you serve. Built for ten
            verticals.
          </p>
        </div>

        <div>
          <p className="footer-label">Verticals</p>
          <ul className="space-y-2 text-sm">
            {verticals.slice(0, 6).map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/${v.slug}`}
                  className="text-paper/80 hover:text-wheat"
                >
                  {v.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/verticals"
                className="text-paper/55 hover:text-wheat"
              >
                All ten →
              </Link>
            </li>
            <li>
              <Link
                href="/general"
                className="text-paper/55 hover:text-wheat"
              >
                Don&apos;t see your industry? →
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-label">Product</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/how-it-works"
                className="text-paper/80 hover:text-wheat"
              >
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-paper/80 hover:text-wheat">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/custom" className="text-paper/80 hover:text-wheat">
                Build with us
              </Link>
            </li>
            <li>
              <Link href="/waitlist" className="text-paper/80 hover:text-wheat">
                Join the list
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-paper/80 hover:text-wheat">
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/app/sign-up"
                className="text-paper/80 hover:text-wheat"
              >
                Start free trial
              </Link>
            </li>
            <li>
              <Link
                href="/app/sign-in"
                className="text-paper/80 hover:text-wheat"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-label">Company</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-paper/80 hover:text-wheat">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-paper/80 hover:text-wheat">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-paper/80 hover:text-wheat">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-paper/80 hover:text-wheat">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/aup" className="text-paper/80 hover:text-wheat">
                Acceptable use
              </Link>
            </li>
            <li>
              <Link href="/security" className="text-paper/80 hover:text-wheat">
                Security
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@agentplain.com"
                className="text-paper/80 hover:text-wheat"
              >
                hello@agentplain.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-forest/70">
        <div className="container-wide flex flex-col gap-2 py-5 text-xs text-paper/45 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono tracking-wide">© 2026 agentplain</p>
          <p className="font-mono tracking-wide">
            10 verticals · 3 service-partnership tiers · 7-day free trial
          </p>
        </div>
      </div>
    </footer>
  );
}
