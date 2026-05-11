import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-rule bg-paper-deep">
      <div className="container-wide grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm font-display text-2xl leading-snug text-ink">
            Intelligence. Rooted in reality.
          </p>
          <p className="mt-3 max-w-sm text-sm text-slate-soft">
            A pre-trained agent fleet for professional-services firms — realty
            first.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Product</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/#pricing" className="text-ink hover:text-signal">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/#fleet" className="text-ink hover:text-signal">
                The agent fleet
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
          <p className="font-mono tracking-wide">v0 · design partner phase</p>
        </div>
        <div className="container-wide pb-5 text-xs text-slate-soft">
          <p className="font-mono tracking-wide">
            site reflects current product capabilities; updated 2026-05-11
          </p>
        </div>
      </div>
    </footer>
  );
}
