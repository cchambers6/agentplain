import Link from "next/link";
import { Wordmark } from "@/components/Mark";

// Landing (POC demo surface). Truth Wave rules: no testimonials, no user
// counts, no logos — nothing the system state can't back.
// Mark policy: text wordmark ONLY until the illustrator-drawn centaur mark
// lands (see public/brand/chiron/README.md). No improvised marks.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-7xl">
        <Wordmark />
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-walnut">
        One wise tutor over everything your homeschool already uses — Chiron
        blends the curricula you own into a coherent week, keeps a living
        picture of each child, and quietly keeps your state records in order.
      </p>
      <Link
        href="/onboard"
        className="mt-10 rounded-md bg-walnut px-8 py-3 font-serif text-lg text-parchment transition-colors hover:bg-ink"
      >
        Get started
      </Link>
      <p className="mt-4 text-sm text-walnut/70">
        Proof of concept — one family per install.
      </p>
    </main>
  );
}
