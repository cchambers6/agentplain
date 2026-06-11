import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";
import { tokens } from "@/lib/brand/tokens";
import { verticalSceneName } from "@/components/ui/ap";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";

// Vertical-page hero. Brand tokens only.
//
// Per `project_agentplain_mission_and_positioning.md` (LOCKED 2026-05-11):
//   - Tagline ("Intelligence rooted in reality.") appears immediately under
//     the wordmark / page label.
//   - The locked mission line renders with the vertical-specific
//     `missionSubject` noun ("We lift up {missionSubject} by doing the work
//     that takes their time and money away from the people they serve.").
//   - Vertical's original headline is preserved as the supporting line.
//   - CTA pair routes to /app/sign-up and the pricing anchor.

export default function VerticalHero({
  content,
}: {
  content: VerticalContent;
}) {
  // Default the audience noun if a content file hasn't been backfilled yet —
  // keeps the locked mission line stable across the 10 active verticals while
  // tolerating any future vertical that lands content-first.
  const audience = content.missionSubject ?? `${content.name.toLowerCase()} firms`;

  // On-ramp surfaces (e.g. `/general`) don't have a Prisma `Vertical` enum
  // entry, so the sign-up flow can't accept `?vertical=general`. We drop the
  // prefill on on-ramp pages — the visitor picks one of the ten ratified
  // verticals during sign-up. The CTA stays the same shape.
  const signUpHref =
    content.status === "on-ramp"
      ? "/app/sign-up"
      : `/app/sign-up?vertical=${content.slug}`;

  const sceneName = verticalSceneName(content.slug);

  return (
    <section className="relative overflow-hidden border-b border-rule bg-paper">
      {/* Per-vertical heritage backdrop (md+), mirrors the homepage hero. */}
      <HeroBackdrop scene={sceneName} />
      <div className="relative container-wide py-20 md:py-28">
        <p className="eyebrow mb-3">{content.hero.eyebrow}</p>
        <p className="font-display text-base leading-snug text-clay md:text-lg">
          {tokens.tagline}
        </p>

        <h1 className="mt-8 max-w-4xl font-display text-4xl leading-[1.06] text-ink md:text-6xl md:leading-[1.04]">
          We lift up{" "}
          <span className="text-clay">{audience}</span> by doing the work
          that takes their time and money away from the people they serve.
        </h1>

        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
          {content.hero.valueProp}
        </p>

        {/* Run-for-you subhead — vendor-generic per the 2026-06-11 customer-
            surface rule (the underlying AI model is never named on a customer
            surface). Rendered only when the content file supplies it (all ten
            ratified verticals do). */}
        {content.hero.sbmSubhead ? (
          <p className="mt-4 max-w-3xl font-display text-base leading-snug text-clay md:text-lg">
            {content.hero.sbmSubhead}
          </p>
        ) : null}

        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-mute">
          {content.hero.headline}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href={signUpHref} className="btn-primary">
            Start free trial
            <span aria-hidden>→</span>
          </Link>
          <Link href="#pricing" className="btn-secondary">
            See pricing
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
          <Stat label="ROI multiplier" value={content.roi.multiplier} />
          <Stat label="Per seat" value="$199 → $99" />
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
