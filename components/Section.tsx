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
  return (
    <section
      id={id}
      className={`${bg} border-b border-rule py-20 md:py-28 ${className}`}
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
