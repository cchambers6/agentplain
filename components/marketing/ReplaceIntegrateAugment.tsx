import { ReactNode } from "react";

// REPLACE / INTEGRATE / AUGMENT — the three-pillar framing that answers Q4 of
// the homepage story arc ("what does it do / what makes us different") per
// `feedback_everything_tells_a_story.md` §"story arc … Q3 REPLACE/INTEGRATE/
// AUGMENT framing with concrete-not-abstract verbs". The framing is also
// canonical on the per-vertical hero copy — see
// `lib/verticals/real-estate/content.ts:18` ("REPLACES the 8-12 weekly hours …
// INTEGRATES with Follow Up Boss, dotloop … AUGMENTS the broker-of-record's
// review"). Each pillar is grounded in real fleet capability, not abstraction.
//
// Visual contract:
//   - Three columns side-by-side at md+; stacked at sm-.
//   - Each column: brand-styled SVG icon (clay accent), label, one-liner,
//     concrete examples list.
//   - Hairline rules between columns; cards-no-shadows per spec §6.
//   - Per `feedback_runner_portability.md`: pure presentational component,
//     no third-party deps (icons are hand-rolled SVG, not lucide-react —
//     keeps bundle weight and lock-in surface at zero).

interface Pillar {
  /** Brand-styled icon — small SVG, ~32px square viewBox 24x24. */
  icon: ReactNode;
  label: "REPLACE" | "INTEGRATE" | "AUGMENT";
  /** Single-sentence what-this-pillar-is. Grounded in mission rule. */
  oneLiner: string;
  /** 4 concrete examples — verbs + specifics, not abstraction. */
  examples: string[];
}

// Icons are hand-rolled SVG paths. Inline so they tree-shake to nothing and so
// the visual style stays controllable from brand tokens (currentColor → clay).

function ReplaceIcon() {
  // Swap glyph — two opposing arrows around a vertical axis. The metaphor is
  // "this for that" — the systematic work gets swapped out for the fleet's draft.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h13" />
      <path d="m14 4 3 3-3 3" />
      <path d="M20 17H7" />
      <path d="m10 20-3-3 3-3" />
    </svg>
  );
}

function IntegrateIcon() {
  // Two interlocking rings — "sits on top of the tools you already use."
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </svg>
  );
}

function AugmentIcon() {
  // Spark + upward arrow — "the human does MORE of what they're good at."
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v6" />
      <path d="m9 6 3-3 3 3" />
      <path d="M5 13c0 4 3 7 7 8 4-1 7-4 7-8" />
      <path d="M9 13.5h6" />
    </svg>
  );
}

// Concrete examples grounded in the homepage `uniques` array
// (app/(marketing)/page.tsx:38), the real-estate hero copy
// (lib/verticals/real-estate/content.ts:18), and the no-outbound architecture
// rule (project_no_outbound_architecture.md). Verbs over nouns; no abstractions.
const PILLARS: Pillar[] = [
  {
    icon: <ReplaceIcon />,
    label: "REPLACE",
    oneLiner:
      "Systematic work the fleet handles end-to-end so it leaves your week.",
    examples: [
      "Draft listing copy from MLS data",
      "Build marketing one-pagers + emails",
      "Run compliance review on every draft",
      "Chase status updates across threads",
    ],
  },
  {
    icon: <IntegrateIcon />,
    label: "INTEGRATE",
    oneLiner:
      "Sits on top of the tools you already pay for — no migration, no rip-and-replace.",
    examples: [
      "Your CRM (Follow Up Boss, AMS, PMS, …)",
      "Your inbox + calendar (Gmail, Outlook)",
      "Your lead-gen + marketing tools",
      "Your transaction + accounting systems",
    ],
  },
  {
    icon: <AugmentIcon />,
    label: "AUGMENT",
    oneLiner:
      "Judgment work the human keeps — with the fleet's draft and context underneath.",
    examples: [
      "Pricing + offer strategy",
      "Negotiations + counters",
      "Showings + relationship calls",
      "Final review on every customer-facing send",
    ],
  },
];

export default function ReplaceIntegrateAugment() {
  return (
    <div
      className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3"
      role="list"
      aria-label="Three pillars: replace, integrate, augment"
    >
      {PILLARS.map((p) => (
        <PillarCard key={p.label} pillar={p} />
      ))}
    </div>
  );
}

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <article
      role="listitem"
      className="flex flex-col bg-paper p-7 md:p-9"
      aria-labelledby={`pillar-${pillar.label.toLowerCase()}`}
    >
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center border border-rule bg-paper-deep text-clay"
      >
        {pillar.icon}
      </div>
      <h3
        id={`pillar-${pillar.label.toLowerCase()}`}
        className="mt-6 font-mono text-[12px] tracking-eyebrow uppercase text-clay"
      >
        {pillar.label}
      </h3>
      <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-ink md:text-[17px]">
        {pillar.oneLiner}
      </p>
      <ul className="mt-6 space-y-2 border-t border-rule pt-5">
        {pillar.examples.map((ex) => (
          <li
            key={ex}
            className="flex gap-3 text-[14px] leading-relaxed text-ink-soft"
          >
            <span
              aria-hidden="true"
              className="mt-[0.7em] inline-block h-px w-3 flex-none bg-clay"
            />
            <span>{ex}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
