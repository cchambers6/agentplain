// RootedInRealityProof — Q6 of the homepage story arc ("Why should anyone
// believe us?"). Three-card proof block tied directly to the locked tagline
// "Intelligence rooted in reality." Each card grounds a tagline word with
// something we can point at today — not magic, not pixie dust.
//
// Per `project_agentplain_mission_and_positioning.md` Q6, allowable claims:
//   - eat-our-own-cooking (flatsbo brokerage ~35 cron-fired agents)
//   - counsel-reviewed compliance corpus (gated until counsel returns)
//   - ROI math anchored at $2,900–$10,600/mo per seat
//
// Per `feedback_everything_tells_a_story.md`: every card cites the memory rule
// or artifact that grounds it. No assertions without anchor.

type Card = {
  label: string;
  body: string;
  cite: string;
};

const CARDS: Card[] = [
  {
    label: "Eat our own cooking",
    body: "agentplain is built BY a fleet of agents, not a human engineering team. A real brokerage in production today runs ~35 cron-fired agents on daily ops — lead intake, listing coordination, contracts, CRM hygiene, recruiting. The pattern is shipped, not theoretical; we productized what we already run.",
    cite: "project_agentplain_built_by_agents.md",
  },
  {
    label: "Counsel-reviewed compliance",
    body: "Outside counsel is reviewing every per-vertical compliance corpus before it lands in the product — GA TCPA + RESPA + fair-housing for real estate; analog corpuses for the other nine. When counsel signs off we name them publicly. Until then the corpus is gated, not vapor.",
    cite: "project_counsel_engaged.md",
  },
  {
    label: "ROI math, not vibes",
    body: "Every value claim anchors to numbers you can audit: $2,900–$10,600/mo recovered per practitioner against $99–$199/mo per-seat subscription. Method is hours × rate + deals × commission + mistakes-avoided. The calculator is on /pricing — bring your own inputs.",
    cite: "project_pricing_value_anchor.md",
  },
];

export default function RootedInRealityProof() {
  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
      {CARDS.map((c) => (
        <div key={c.label} className="flex flex-col bg-paper p-7 md:p-8">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
            {c.label}
          </p>
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
            {c.body}
          </p>
          <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
            Source: <code className="text-[11px]">{c.cite}</code>
          </p>
        </div>
      ))}
    </div>
  );
}
