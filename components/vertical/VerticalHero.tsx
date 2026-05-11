import type { VerticalContent } from "@/lib/verticals/types";

export default function VerticalHero({
  content,
}: {
  content: VerticalContent;
}) {
  return (
    <section className="border-b border-rule bg-paper">
      <div className="container-wide py-20 md:py-28">
        <p className="eyebrow mb-6">{content.hero.eyebrow}</p>
        <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
          {content.hero.headline}
        </h1>
        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
          {content.hero.valueProp}
        </p>
      </div>
    </section>
  );
}
