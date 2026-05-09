import Link from "next/link";
import Logo from "./Logo";

const navItems = [
  { href: "/platform", label: "Platform" },
  { href: "/brokerages", label: "For brokerages" },
  { href: "/for-agents", label: "For agents" },
  { href: "/verticals", label: "Verticals" },
  { href: "/pricing", label: "Pricing" },
];

export default function Header() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-wide flex flex-wrap items-center justify-between gap-4 py-5">
        <Logo />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-ink/70 transition hover:text-ink md:inline"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/brokerages"
            className="rounded-none border border-ink px-4 py-2 text-xs font-medium tracking-wide text-ink transition hover:bg-ink hover:text-paper"
          >
            Start a pilot
          </Link>
        </nav>
      </div>
    </header>
  );
}
