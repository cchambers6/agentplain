// ReplaceIntegrateAugment — Q4 of the homepage story arc ("What makes
// agentplain unique"). Three labeled columns with concrete-not-abstract
// examples per vertical. Source framing:
//   - REPLACE = listing copy / marketing builds / compliance triage / manual
//     chasing — work the practitioner stops doing entirely
//   - INTEGRATE = CRM / lead-gen / email / transaction tools — agentplain sits
//     on top of what the customer already pays for; no migration
//   - AUGMENT = staging / pricing / disclosures / negotiations — judgment work
//     the human keeps doing, but with agentplain drafting
//
// Mirrors the per-vertical `ClaimsTriad` shape in `lib/verticals/types.ts` so
// the same mental model carries from the homepage into every vertical page —
// no surprise when the visitor clicks through to /real-estate or /cpa.
//
// Per `feedback_everything_tells_a_story.md`: every bullet earns its place by
// being concrete. "We integrate with your CRM" is filler; "Reads Lofty,
// Follow Up Boss, Salesforce; never asks you to migrate" is signal.

type Column = {
  label: "Replace" | "Integrate" | "Augment";
  blurb: string;
  examples: string[];
};

const COLUMNS: Column[] = [
  {
    label: "Replace",
    blurb: "Work the fleet takes off your desk entirely.",
    examples: [
      "Drafting listing copy, marketing emails, social posts",
      "Triaging inbox for compliance flags before they ship",
      "Chasing partners for missing docs, signatures, status",
      "Compiling weekly production reports and KPI digests",
    ],
  },
  {
    label: "Integrate",
    blurb: "Tools you already pay for — the fleet sits on top.",
    examples: [
      "CRMs: Lofty, Follow Up Boss, Salesforce, HubSpot",
      "Inboxes: Gmail, Outlook, Microsoft 365",
      "Transaction systems: dotloop, SkySlope, DocuSign",
      "Accounting + e-sign: QuickBooks, Xero, AdobeSign",
    ],
  },
  {
    label: "Augment",
    blurb: "Judgment work you keep — drafted by the fleet, decided by you.",
    examples: [
      "Pricing strategy, CMA narratives, market-position calls",
      "Disclosure language, fair-housing-safe rewrites",
      "Negotiation scripts, counter-offer drafts",
      "Staging recommendations, marketing-channel mix",
    ],
  },
];

export default function ReplaceIntegrateAugment() {
  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
      {COLUMNS.map((col) => (
        <Column key={col.label} {...col} />
      ))}
    </div>
  );
}

function Column({ label, blurb, examples }: Column) {
  return (
    <div className="flex flex-col bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {label}
      </p>
      <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-mute">
        {blurb}
      </p>
      <ul className="mt-6 space-y-3 border-t border-rule pt-6 text-[15px] leading-relaxed text-ink">
        {examples.map((e) => (
          <li key={e} className="flex gap-3">
            <span className="mt-2 inline-block h-px w-3 shrink-0 bg-clay" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
