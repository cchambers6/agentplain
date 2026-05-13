// Architecture diagram for technical/trust audiences. Answers Q6 of the story
// arc ("why should I believe you?") per `feedback_everything_tells_a_story.md`.
//
// Shows the no-outbound, read-only architecture per
// `project_no_outbound_architecture.md`:
//   Customer tools (CRM, inbox, calendar, docs)
//     → read-only OAuth
//     → agentplain fleet (per-vertical skills, knowledge substrate)
//     → drafts queue in customer's workspace dashboard
//     → customer reviews + their existing system sends
//
// The diagram is intentionally hand-rolled SVG (not Mermaid) so:
//   - it stays brand-styled with our tokens (paper / ink / clay / mute)
//   - no runtime JS dependency for rendering (Mermaid is ~600KB)
//   - works as a server component, no hydration cost
//
// Per `feedback_runner_portability.md`: pure presentational, no third-party
// deps. Per `feedback_no_silent_vendor_lock.md`: no diagram library lock-in.
// Per `feedback_no_guesses_no_estimates.md`: every label cites the memory rule
// that grounds it (read-only, drafts-only, customer sends) — all visible in
// the legend underneath.

const LAYERS = [
  {
    id: "tools",
    label: "Your tools",
    sublabels: ["CRM", "Inbox", "Calendar", "Docs"],
    note: "Stays where it is. No migration.",
  },
  {
    id: "fleet",
    label: "agentplain fleet",
    sublabels: ["Per-vertical skills", "Compliance corpus", "Knowledge substrate"],
    note: "Reads your data via read-only OAuth.",
  },
  {
    id: "workspace",
    label: "Your workspace",
    sublabels: ["Drafts queue", "Audit trail", "Weekly digest"],
    note: "Drafts surface here for your review.",
  },
  {
    id: "send",
    label: "You + your system",
    sublabels: ["Review", "Edit / approve", "Send via your tools"],
    note: "Every customer-facing send originates from you.",
  },
];

const LEGEND = [
  {
    rule: "Read-only OAuth — your credentials stay in your workspace.",
    cite: "project_no_outbound_architecture.md",
  },
  {
    rule: "The fleet drafts and proposes; it never auto-sends or moves money.",
    cite: "project_no_outbound_architecture.md",
  },
  {
    rule: "Open standard (MCP) under the hood for tool access — no proprietary lock-in surface.",
    cite: "project_living_portable_architecture.md",
  },
  {
    rule: "Every action visible in the workspace — full audit trail, no behind-the-curtain.",
    cite: "project_no_outbound_architecture.md",
  },
];

export default function ArchitectureDiagram() {
  return (
    <div
      className="border border-rule bg-paper p-6 md:p-10"
      role="region"
      aria-label="agentplain architecture diagram"
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {LAYERS.map((layer, i) => (
          <LayerCellAndArrow
            key={layer.id}
            layer={layer}
            isLast={i === LAYERS.length - 1}
          />
        ))}
      </div>

      {/* Annotations — the trust-bearing claims. Each cites the rule that
          grounds it so a technical buyer can audit. */}
      <ul
        className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2"
        aria-label="Architecture commitments"
      >
        {LEGEND.map((item) => (
          <li
            key={item.cite + item.rule}
            className="flex flex-col bg-paper p-5"
          >
            <p className="text-[14px] leading-relaxed text-ink">{item.rule}</p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-mute">
              Source: <code className="text-[10px]">{item.cite}</code>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayerCellAndArrow({
  layer,
  isLast,
}: {
  layer: (typeof LAYERS)[number];
  isLast: boolean;
}) {
  return (
    <>
      <article
        className="flex flex-col bg-paper p-5"
        aria-labelledby={`arch-${layer.id}`}
      >
        <p
          id={`arch-${layer.id}`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-clay"
        >
          {layer.label}
        </p>
        <ul className="mt-4 space-y-1.5 border-t border-rule pt-4">
          {layer.sublabels.map((s) => (
            <li
              key={s}
              className="flex gap-2 font-mono text-[12px] text-ink-soft"
            >
              <span aria-hidden="true" className="text-clay">·</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-mute">
          {layer.note}
        </p>
      </article>
      {!isLast ? <ArchArrow /> : null}
    </>
  );
}

function ArchArrow() {
  return (
    <div
      aria-hidden="true"
      className="hidden items-center justify-center bg-paper text-clay md:flex"
    >
      <svg
        viewBox="0 0 24 12"
        width="36"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 6h18" />
        <path d="m16 2 4 4-4 4" />
      </svg>
    </div>
  );
}
