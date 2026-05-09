import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-rule bg-paper-deep">
      <div className="container-wide grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm font-display text-2xl leading-snug text-ink">
            Intelligence. Rooted in reality.
          </p>
          <p className="mt-3 max-w-sm text-sm text-slate-soft">
            A platform for AI agent fleets that run operations work inside
            small-to-mid businesses. Realty first.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Platform</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/platform" className="text-ink hover:text-signal">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/verticals" className="text-ink hover:text-signal">
                Verticals
              </Link>
            </li>
            <li>
              <Link href="/trust" className="text-ink hover:text-signal">
                Trust &amp; security
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-ink hover:text-signal">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Use it</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/brokerages" className="text-ink hover:text-signal">
                For brokerages
              </Link>
            </li>
            <li>
              <Link href="/for-agents" className="text-ink hover:text-signal">
                For individual agents
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-ink hover:text-signal">
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Company</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-ink hover:text-signal">
                About
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@agentplain.com"
                className="text-ink hover:text-signal"
              >
                hello@agentplain.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="container-wide flex flex-col justify-between gap-2 py-5 text-xs text-slate-soft sm:flex-row">
          <p className="font-mono tracking-wide">
            © {new Date().getFullYear()} agentplain
          </p>
          <p className="font-mono tracking-wide">Pin 1 · realty in pilot</p>
        </div>
      </div>
    </footer>
  );
}
