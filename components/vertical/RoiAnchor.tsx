import Section from "@/components/Section";
import type { RoiAnchor as RoiAnchorType } from "@/lib/verticals/types";

export default function RoiAnchor({ roi }: { roi: RoiAnchorType }) {
  return (
    <Section
      tone="deep"
      eyebrow="ROI math"
      title="The arithmetic. Audit it."
      intro="Every claim on this page is grounded in a memory file we can show you. The number below is the headline; the math is the substantiation. If your shop's inputs differ, the same template runs against your numbers in the pilot's day-30 outcome report."
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-[1fr_2fr]">
        <div className="bg-paper p-10 md:p-12">
          <p className="font-mono text-[11px] tracking-eyebrow text-clay">
            Headline multiplier
          </p>
          <p className="mt-4 font-display text-6xl leading-none text-ink md:text-7xl">
            {roi.multiplier}
          </p>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-ink-soft">
            on the pilot price, before residual recurring value
          </p>
        </div>

        <div className="bg-paper p-10 md:p-12">
          <dl className="space-y-6">
            <Row label="Pilot input" value={roi.inputCost} />
            <Row label="Annualized output" value={roi.outputValue} />
            <Row label="The math" value={roi.math} wide />
            <Row label="Source" value={roi.citation} wide cite />
          </dl>
        </div>
      </div>
    </Section>
  );
}

function Row({
  label,
  value,
  wide = false,
  cite = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
  cite?: boolean;
}) {
  return (
    <div className={wide ? "" : "flex flex-wrap items-baseline gap-3"}>
      <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </dt>
      <dd
        className={`${
          wide ? "mt-2" : ""
        } text-[15px] leading-relaxed text-ink-soft ${
          cite ? "font-mono text-[12px] text-mute" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
