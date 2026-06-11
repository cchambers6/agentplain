import { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "paper" | "deep";
  className?: string;
};

export default function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "paper",
  className = "",
}: SectionProps) {
  const bg = tone === "deep" ? "bg-paper-deep" : "bg-paper";
  // Editorial vertical rhythm: py-16/md:py-24 (was py-20/md:py-28). The earlier
  // scale stacked ~224px of chrome per section; across a long marketing page
  // that read as a monotonous text wall. Tightened to a calmer broadsheet
  // cadence that still breathes, and brought into deliberate relation with the
  // hero's own py-20/md:py-28 (the hero earns the extra air as the first fold;
  // every section below it sits a notch tighter). Wave A3, 2026-06-11.
  return (
    <section
      id={id}
      className={`${bg} border-b border-rule py-16 md:py-24 ${className}`}
    >
      <div className="container-wide">
        {(eyebrow || title || intro) && (
          <header className="mb-12 max-w-3xl md:mb-16">
            {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
            {title && (
              <h2 className="font-display text-4xl leading-[1.1] text-ink md:text-5xl">
                {title}
              </h2>
            )}
            {intro && (
              <div className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
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
