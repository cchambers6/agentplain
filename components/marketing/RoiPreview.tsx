import Link from "next/link";

// RoiPreview — Q7 of the homepage story arc ("How do we think about ROI?").
// Lightweight preview block; the full interactive calculator lives at
// `components/RoiCalculator.tsx` and on `/pricing`.
//
// Anchors per `project_agentplain_mission_and_positioning.md` Q7 and
// `project_pricing_value_anchor.md`:
//   - 15-107x ROI range across the 10 verticals
//   - $2,900–$10,600/mo value recovered per practitioner
//   - $99–$199/mo Regular per-seat subscription
//
// Per `feedback_everything_tells_a_story.md`: this block exists to answer
// "what's the math?" before the visitor commits to opening the calculator.
// If they want to audit it themselves, the calculator link is one click away.

const ANCHORS = [
  {
    metric: "15–107x",
    label: "ROI multiple",
    note: "Range across the ten verticals; lower bound is solo / single-seat / conservative inputs.",
  },
  {
    metric: "$2,900–$10,600",
    label: "Monthly value per seat",
    note: "Hours saved × productive-hour rate, plus deals-closed-faster × commission.",
  },
  {
    metric: "$99–$199",
    label: "Monthly Regular subscription",
    note: "Per-seat ladder. First month free; month-to-month from day one.",
  },
];

export default function RoiPreview() {
  return (
    <div>
      <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
        {ANCHORS.map((a) => (
          <div key={a.label} className="flex flex-col bg-paper p-7 md:p-8">
            <p className="font-display text-4xl leading-none text-ink md:text-5xl">
              {a.metric}
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              {a.label}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              {a.note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-rule pt-6 text-[14px] text-ink-soft">
        <p className="max-w-prose">
          Method: hours-saved × your hourly rate, plus deals-closed-faster ×
          commission, plus mistakes-avoided × cost-per-mistake. Conservative on
          inputs; outcomes-based on outputs. The full calculator is yours to
          audit.
        </p>
        <Link
          href="/pricing#roi"
          className="inline-flex items-center gap-2 text-ink underline"
        >
          Run the calculator on your own numbers →
        </Link>
      </div>
    </div>
  );
}
