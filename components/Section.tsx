import { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "paper" | "deep" | "forest";
  className?: string;
};

// Heritage Plains Editorial section primitive (PR #316 rollout, 2026-06-22).
//
// The marketing surface's vertical rhythm + heading treatment live here, so a
// single change ripples to every page. Three tones:
//   paper   — the cream base ground (default)
//   deep    — a half-step deeper cream, for an alternating band
//   forest  — the grounded full-bleed pause band (deep field green, cream type).
//             This is the heritage "one bold panel per section" device; use it
//             sparingly — at most once or twice per long page.
//
// Display headings inherit the global letterpress emboss (app/globals.css base
// layer). On the dark `forest` ground that emboss is inverted via the
// `letterpress-dark` helper added to the section wrapper.

export default function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "paper",
  className = "",
}: SectionProps) {
  const forest = tone === "forest";
  // Ground + hairline per tone. Editorial vertical rhythm: py-16/md:py-24 — a
  // calm broadsheet cadence that breathes without stacking a monotonous wall.
  const bg = forest
    ? "bg-forest border-forest-deep"
    : tone === "deep"
      ? "bg-paper-deep border-rule"
      : "bg-paper border-rule";

  const titleColor = forest ? "text-paper" : "text-ink";
  const introColor = forest ? "text-paper/75" : "text-ink-soft";
  // The mono eyebrow's default `.eyebrow` color (mute) disappears on forest, so
  // the forest tone gets a wheat eyebrow instead — the rare harvest accent.
  const eyebrowClass = forest
    ? "font-mono text-[11px] tracking-eyebrow uppercase text-wheat mb-4"
    : "eyebrow mb-4";

  return (
    <section
      id={id}
      className={`${bg} border-b py-16 md:py-24 ${forest ? "letterpress-dark" : ""} ${className}`}
    >
      <div className="container-wide">
        {(eyebrow || title || intro) && (
          <header className="mb-12 max-w-3xl md:mb-16">
            {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
            {title && (
              <h2 className={`font-display text-4xl leading-[1.1] md:text-5xl ${titleColor}`}>
                {title}
              </h2>
            )}
            {intro && (
              <div className={`mt-5 max-w-2xl text-lg leading-relaxed ${introColor}`}>
                {intro}
              </div>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
