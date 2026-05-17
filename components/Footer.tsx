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
  return (
    <footer className="border-t border-rule bg-paper-deep">
      <div className="container-wide grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm font-display text-2xl leading-snug text-ink">
            {tokens.tagline}
          </p>
          <p className="mt-3 max-w-sm text-sm text-mute">
            A service partnership for local businesses. We install a fleet of
            capable AI partners, run reviews, customize as your ops shift —
            so you stay focused on the people you serve. Built for ten
            verticals.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Verticals</p>
          <ul className="space-y-2 text-sm">
            {verticals.slice(0, 6).map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/${v.slug}`}
                  className="text-ink hover:text-clay"
                >
                  {v.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/verticals"
                className="text-mute hover:text-clay"
              >
                All ten →
              </Link>
            </li>
            <li>
              <Link
                href="/general"
                className="text-mute hover:text-clay"
              >
                Don&apos;t see your industry? →
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Product</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/#how" className="text-ink hover:text-clay">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-ink hover:text-clay">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/custom" className="text-ink hover:text-clay">
                Build with us
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-ink hover:text-clay">
                FAQ
              </Link>
            </li>
            <li>
              <Link
                href="/app/sign-up"
                className="text-ink hover:text-clay"
              >
                Start free trial
              </Link>
            </li>
            <li>
              <Link
                href="/app/sign-in"
                className="text-ink hover:text-clay"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Company</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-ink hover:text-clay">
                About
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@agentplain.com"
                className="text-ink hover:text-clay"
              >
                hello@agentplain.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="container-wide flex flex-col gap-2 py-5 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono tracking-wide">© 2026 agentplain</p>
          <p className="font-mono tracking-wide">
            10 verticals · 3 service-partnership tiers · first month free
          </p>
        </div>
      </div>
    </footer>
  );
}
