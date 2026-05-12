import Link from "next/link";
import Logo from "./brand/Logo";

export default function Header() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-wide flex items-center justify-between py-5">
        <Logo />
        <nav className="flex items-center gap-7 text-sm">
          <Link
            href="/about"
            className="hidden text-ink/70 transition hover:text-ink sm:inline"
          >
            About
          </Link>
          <Link
            href="/#pricing"
            className="hidden text-ink/70 transition hover:text-ink sm:inline"
          >
            Pricing
          </Link>
          <a
            href="mailto:hello@agentplain.com?subject=agentplain%20interest"
            className="rounded-none border border-ink px-4 py-2 text-xs font-medium tracking-wide text-ink transition hover:bg-ink hover:text-paper"
          >
            Get in touch
          </a>
        </nav>
      </div>
    </header>
  );
}
