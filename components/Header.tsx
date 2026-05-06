import Link from "next/link";
import Logo from "./Logo";

export default function Header() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="container-wide flex items-center justify-between py-5">
        <Logo />
        <nav className="flex items-center gap-7 text-sm">
          <Link
            href="/pilot"
            className="hidden text-ink/70 transition hover:text-ink sm:inline"
          >
            Pilot
          </Link>
          <Link
            href="/about"
            className="hidden text-ink/70 transition hover:text-ink sm:inline"
          >
            About
          </Link>
          <Link
            href="/pilot"
            className="rounded-none border border-ink px-4 py-2 text-xs font-medium tracking-wide text-ink transition hover:bg-ink hover:text-paper"
          >
            See the pilot
          </Link>
        </nav>
      </div>
    </header>
  );
}
