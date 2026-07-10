import Link from "next/link";

// Landing (POC demo surface). Truth Wave rules: no testimonials, no user
// counts, no logos — nothing the system state can't back.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-8" aria-hidden>
        {/* Placeholder mark — the ratified centaur mark ships with the brand
            pass; placeholder-never-ships gate applies before launch. */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-walnut text-4xl font-serif text-walnut">
          Χ
        </div>
      </div>
      <h1 className="font-serif text-5xl tracking-tight text-ink">Chiron</h1>
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
