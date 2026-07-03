import type { Metadata } from "next";
import { DewpointExplorer } from "./DewpointExplorer";

// Public dew-point explorer. Lives at /dewpoint (outside the /app auth gate
// in middleware.ts) so anyone can use it without signing in. Finds the
// hourly dew-point prediction for any place and interprets it — mugginess,
// fog risk, condensation/frost, and the most comfortable window of the day.

export const metadata: Metadata = {
  title: "Dew Point Forecast",
  description:
    "Find the hourly dew-point prediction for any place and see what it means — how muggy it will feel, fog and frost risk, and the most comfortable window of the day.",
  robots: { index: false, follow: false },
};

export default function DewpointPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-eyebrow text-ink/60">Weather</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Dew Point Forecast</h1>
        <p className="mt-3 max-w-prose text-ink/70">
          Dew point is the honest measure of how humid the air really feels — more so than relative
          humidity. Search a place to pull its hourly prediction and see what it means for comfort,
          fog, and condensation.
        </p>
      </header>
      <DewpointExplorer />
      <footer className="mt-12 text-xs text-ink/50">
        Forecast data from{" "}
        <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        . No account or API key required.
      </footer>
    </main>
  );
}
