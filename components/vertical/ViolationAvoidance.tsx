import Section from "@/components/Section";

// The second half of the ROI story (added 2026-06-06 per Conner's "softer
// true claim beats an over-inflated one" ruling that capped the headline
// band at 50x — see PR #155's competitive audit). The hours-reclaimed
// multiplier understates real value because it ignores the regulatory
// downside the draft-then-approve loop removes: an auto-execution competitor
// sends before any human sees the message, so a non-compliant draft becomes
// a fileable violation; our loop hands every customer-facing draft to a
// person for approval, so a violating message never leaves the building.
//
// Pure presentational component — the per-vertical regulation, penalty, and
// avoidance mechanism live in `lib/verticals/<slug>/content.ts` →
// `roi.violationAvoidance`, so this renderer carries no claims of its own.
export default function ViolationAvoidance({ paragraph }: { paragraph: string }) {
  return (
    <Section
      tone="paper"
      eyebrow="The downside it removes"
      title="The other half of ROI: the violation that never sends."
      intro="Hours reclaimed is only one side of the math. The other side is the regulatory exposure a draft-then-approve loop takes off the table — the part an auto-execution tool structurally cannot promise to dodge."
    >
      <div className="max-w-3xl border border-rule bg-paper-deep p-8 md:p-10">
        <p className="text-[15px] leading-relaxed text-ink-soft">{paragraph}</p>
      </div>
    </Section>
  );
}
