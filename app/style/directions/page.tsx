import type { Metadata } from "next";
import Link from "next/link";

// ============================================================================
// Design Directions — comparison index
//
// Side-by-side entry point for the five parallel visual directions Conner asked
// for. Each direction ships as a self-contained route so they can be judged on
// their own terms, then one gets rolled out.
//
// Lives at /style/directions (NOT /style) on purpose: /style is the existing
// internal brand style guide (app/(marketing)/style). A top-level
// app/style/page.tsx would collide with it and break the build, so the
// comparison hub gets its own segment. Direction routes are also top-level
// (app/style/direction-*), which keeps them outside the brand/voice CI gates —
// correct, since these are exploratory studies, not live brand surfaces.
// ============================================================================

export const metadata: Metadata = {
  title: "Design directions — comparison",
  description:
    "Five parallel visual directions for agentplain, each shipped end-to-end for side-by-side comparison.",
  robots: { index: false, follow: false },
};

type Direction = {
  n: number;
  slug: string | null;
  name: string;
  blurb: string;
  inspiration: string;
  swatches: string[];
  status: "ready" | "planned";
};

const DIRECTIONS: Direction[] = [
  {
    n: 1,
    slug: "direction-1-heritage-plains",
    name: "Heritage Plains Editorial",
    blurb:
      "Serif editorial, earth tones, paper grain, plainspoken voice. Reads like a Patagonia catalog — earned, weathered, real American heartland.",
    inspiration: "Patagonia · Pendleton · Filson · McCarthy book design · WPA posters",
    swatches: ["#1f3d2e", "#b85540", "#f5f0e6", "#c8a24a", "#1a1612"],
    status: "ready",
  },
  {
    n: 2,
    slug: null,
    name: "Direction 2",
    blurb: "Shipped in a sibling pull request. Link appears once that branch lands.",
    inspiration: "—",
    swatches: ["#d8cfba", "#c2b69b", "#9c8b73"],
    status: "planned",
  },
  {
    n: 3,
    slug: null,
    name: "Direction 3",
    blurb: "Shipped in a sibling pull request. Link appears once that branch lands.",
    inspiration: "—",
    swatches: ["#d8cfba", "#c2b69b", "#9c8b73"],
    status: "planned",
  },
  {
    n: 4,
    slug: null,
    name: "Direction 4",
    blurb: "Shipped in a sibling pull request. Link appears once that branch lands.",
    inspiration: "—",
    swatches: ["#d8cfba", "#c2b69b", "#9c8b73"],
    status: "planned",
  },
  {
    n: 5,
    slug: null,
    name: "Direction 5",
    blurb: "Shipped in a sibling pull request. Link appears once that branch lands.",
    inspiration: "—",
    swatches: ["#d8cfba", "#c2b69b", "#9c8b73"],
    status: "planned",
  },
];

export default function DirectionsIndex() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-wide px-6 py-16 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-eyebrow text-clay">
          Design studies · pick one to roll out
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          Five directions for agentplain
        </h1>
        <p className="mt-4 max-w-prose font-sans text-ink-soft">
          Each direction is a complete visual treatment, shipped end-to-end on
          its own route so it can be judged on its own terms. Open them
          side-by-side, then choose the one that should become the system.
        </p>

        <ul className="mt-12 grid gap-px border border-rule bg-rule sm:grid-cols-2">
          {DIRECTIONS.map((d) => {
            const inner = (
              <div className="flex h-full flex-col bg-paper p-6 transition-colors hover:bg-paper-deep">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs uppercase tracking-eyebrow text-mute">
                    Direction {d.n} / 5
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-eyebrow ${
                      d.status === "ready" ? "text-moss" : "text-mute"
                    }`}
                  >
                    {d.status === "ready" ? "● Ready" : "○ In progress"}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-2xl tracking-tight">
                  {d.name}
                </h2>
                <p className="mt-2 flex-1 font-sans text-sm text-ink-soft">
                  {d.blurb}
                </p>
                {d.inspiration !== "—" && (
                  <p className="mt-3 font-mono text-[11px] leading-relaxed text-mute">
                    {d.inspiration}
                  </p>
                )}
                <div className="mt-4 flex">
                  {d.swatches.map((hex, i) => (
                    <span
                      key={i}
                      className="h-6 w-8 border-r border-paper last:border-r-0"
                      style={{ background: hex }}
                    />
                  ))}
                </div>
                <p className="mt-4 font-sans text-sm font-medium text-clay">
                  {d.slug ? "View direction →" : "Not yet linked"}
                </p>
              </div>
            );
            return (
              <li key={d.n}>
                {d.slug ? (
                  <Link href={`/style/${d.slug}`} className="block h-full">
                    {inner}
                  </Link>
                ) : (
                  <div className="h-full opacity-70">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Also: <Link href="/style" className="text-clay underline">/style</Link>{" "}
          — the current live brand style guide (unchanged by these studies).
        </p>
      </div>
    </main>
  );
}
