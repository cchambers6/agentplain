import Link from "next/link";
import Logo from "./Logo";

const navItems = [
  { href: "/capabilities", label: "Capabilities" },
  { href: "/pricing", label: "Pricing" },
  { href: "/brokerages", label: "For brokerages" },
  { href: "/for-agents", label: "For solo" },
  { href: "/platform", label: "Platform" },
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
            href="/pricing#calculator"
            className="rounded-none border border-ink px-4 py-2 text-xs font-medium tracking-wide text-ink transition hover:bg-ink hover:text-paper"
          >
            Run the math
          </Link>
        </nav>
      </div>
    </header>
  );
}
