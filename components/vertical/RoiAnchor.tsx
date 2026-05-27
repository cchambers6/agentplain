import Section from "@/components/Section";
import type { RoiAnchor as RoiAnchorType } from "@/lib/verticals/types";

export default function RoiAnchor({ roi }: { roi: RoiAnchorType }) {
  return (
    <Section
      tone="deep"
      eyebrow="ROI math"
      title="The arithmetic. Audit it."
      intro="Illustrative inputs, real math — the headline is the multiplier; the row below shows the arithmetic. If your shop's inputs differ, the same template runs against your numbers in the first month's outcome report."
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
            Illustrative; your numbers will vary with the hours you reclaim.
          </p>
        </div>

        <div className="bg-paper p-10 md:p-12">
          <dl className="space-y-6">
            <Row label="Subscription cost" value={roi.inputCost} />
            <Row label="Value delivered" value={roi.outputValue} />
            <Row label="The math" value={roi.math} wide />
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
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "" : "flex flex-wrap items-baseline gap-3"}>
      <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </dt>
      <dd
        className={`${
          wide ? "mt-2" : ""
        } text-[15px] leading-relaxed text-ink-soft`}
      >
        {value}
      </dd>
    </div>
  );
}
