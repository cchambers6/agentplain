import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";

// Vertical-page hero. Brand tokens only; consistent with the marketing home
// hero treatment (eyebrow, oversized display headline, value-prop body) and
// closes with a CTA pair + tier banner so the reader has an immediate next
// move without scrolling.
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

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href={`/app/sign-up?vertical=${content.slug}`}
            className="btn-primary"
          >
            Start free trial
            <span aria-hidden>→</span>
          </Link>
          <Link href="#pricing" className="btn-secondary">
            See {content.tier} tier pricing
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
          <Stat label="ROI multiplier" value={content.roi.multiplier} />
          <Stat label="Tier" value={titleCase(content.tier)} />
          <Stat
            label="Integrations planned"
            value={String(content.integrations.planned.length)}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
