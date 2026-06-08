/**
 * PlainoCardView — renders the optional visual card beneath a Plaino chat reply
 * (V27–V30, the retention payload).
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4.3.
 *
 * Rendering rules (from the spec):
 *  - ADDITIVE: the prose answer is ALWAYS present above this; the card never
 *    replaces text, it follows it. Callers render `message.body` first, then
 *    this if `metadata.card` parses.
 *  - ACCESSIBLE: every tile is a real <a>/<button> with a text label; the card
 *    is screen-reader complete without the visual. No information lives only in
 *    the card.
 *  - DEGRADED MODE: pass an already-parsed `PlainoCard` (use `parsePlainoCard`
 *    on the raw metadata at the call site). If parsing returned null, render
 *    nothing — never throw.
 *  - BOTH SURFACES: the same component renders in /talk and in the in-app
 *    support chat, since both ride the one Plaino backbone
 *    (project_plaino_chatbot_two_surfaces).
 *
 * Square hairline tiles, clay for the primary step, mono labels, brand palette
 * only. No next/image, no client-only APIs — renders under node:test via
 * renderToStaticMarkup like the Ap* primitives.
 */
// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";
import type { ReactNode } from "react";
import type {
  CapabilityCard,
  NavCard,
  NextStepsCard,
  PlainoCard,
  PlainoCardInstructionState,
  WorkStatusCard,
} from "@/lib/plaino/visual-card";

export interface PlainoCardViewProps {
  /** Already parsed via `parsePlainoCard`; null/undefined renders nothing. */
  card: PlainoCard | null | undefined;
}

export function PlainoCardView({ card }: PlainoCardViewProps) {
  if (!card) return null;
  switch (card.type) {
    case "next-steps":
      return <NextStepsView card={card} />;
    case "capability":
      return <CapabilityView card={card} />;
    case "work-status":
      return <WorkStatusView card={card} />;
    case "nav":
      return <NavView card={card} />;
    default:
      return null;
  }
}

// ── V27 next-steps ──────────────────────────────────────────────────────────

function NextStepsView({ card }: { card: NextStepsCard }) {
  return (
    <section
      className="mt-3 border border-rule bg-paper"
      aria-label="Suggested next steps"
    >
      {card.queue ? (
        <div className="flex flex-wrap gap-4 border-b border-rule px-4 py-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          <span>
            <span className="text-ink">{card.queue.drafts}</span> drafts
          </span>
          <span>
            <span className="text-ink">{card.queue.flags}</span> flags
          </span>
          {card.queue.oldestAgeHrs > 0 ? (
            <span>
              oldest{" "}
              <span className="text-ink">
                {formatAgeHrs(card.queue.oldestAgeHrs)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="divide-y divide-rule">
        {card.steps.map((step) => (
          <li key={`${step.href}:${step.label}`}>
            <a
              href={step.href}
              className={[
                "flex items-start gap-3 px-4 py-3 transition hover:bg-paper-deep",
                step.weight === "primary"
                  ? "border-l-2 border-clay"
                  : "border-l-2 border-transparent",
              ].join(" ")}
            >
              <span aria-hidden className="mt-1 shrink-0">
                <GlyphSquare accent={step.weight === "primary"} />
              </span>
              <span className="min-w-0">
                <span
                  className={[
                    "block text-[14px] leading-snug",
                    step.weight === "primary"
                      ? "font-medium text-clay"
                      : "text-ink",
                  ].join(" ")}
                >
                  {step.label}
                </span>
                {step.why ? (
                  <span className="mt-0.5 block text-[12px] leading-snug text-mute">
                    {step.why}
                  </span>
                ) : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── V28 capability ──────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<CapabilityCard["verdict"], string> = {
  yes: "yes — the fleet does this",
  "not-yet": "not yet",
  roadmap: "on the roadmap",
};

function CapabilityView({ card }: { card: CapabilityCard }) {
  const isYes = card.verdict === "yes";
  return (
    <section
      className="mt-3 border border-rule bg-paper px-4 py-3"
      aria-label={`Capability: ${VERDICT_LABEL[card.verdict]}`}
    >
      <p
        className={[
          "font-mono text-[11px] uppercase tracking-eyebrow",
          isYes ? "text-moss" : "text-mute",
        ].join(" ")}
      >
        {VERDICT_LABEL[card.verdict]}
      </p>
      <p className="mt-1.5 text-[14px] leading-snug text-ink">{card.detail}</p>
      {card.namedGap ? (
        <p className="mt-1 text-[12px] leading-snug text-mute">
          {card.namedGap}
        </p>
      ) : null}
      {card.connect ? (
        <a
          href={card.connect.href}
          className="mt-3 inline-flex items-center gap-2 border border-clay px-3 py-1.5 text-[13px] text-clay transition hover:bg-clay hover:text-paper"
        >
          connect {card.connect.label}
          <span aria-hidden>→</span>
        </a>
      ) : null}
    </section>
  );
}

// ── V29 work-status ─────────────────────────────────────────────────────────

const STATUS_STEPS: Array<{
  key: PlainoCardInstructionState;
  label: string;
}> = [
  { key: "drafting", label: "drafting" },
  { key: "awaiting-review", label: "awaiting review" },
  { key: "approved", label: "approved" },
];

function WorkStatusView({ card }: { card: WorkStatusCard }) {
  const activeIdx = STATUS_STEPS.findIndex((s) => s.key === card.state);
  return (
    <section
      className="mt-3 border border-rule bg-paper px-4 py-3"
      aria-label={`Work status: ${card.state.replace("-", " ")}`}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {STATUS_STEPS.map((s, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden>
                <GlyphSquare accent={done || current} filled={done} />
              </span>
              <span
                className={[
                  "font-mono text-[11px] uppercase tracking-eyebrow",
                  current ? "text-clay" : done ? "text-ink" : "text-mute",
                ].join(" ")}
              >
                {s.label}
              </span>
              {i < STATUS_STEPS.length - 1 ? (
                <span aria-hidden className="text-mute">
                  ·
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {card.state === "awaiting-review" ? (
        <a
          href={`?focus=${encodeURIComponent(card.approvalId)}`}
          className="mt-3 inline-flex items-center gap-2 text-[13px] text-clay underline"
        >
          review it now
          <span aria-hidden>→</span>
        </a>
      ) : null}
    </section>
  );
}

// ── V30 nav ─────────────────────────────────────────────────────────────────

function NavView({ card }: { card: NavCard }) {
  return (
    <nav className="mt-3 flex flex-wrap gap-2" aria-label="Where to find it">
      {card.destinations.map((d) => (
        <a
          key={d.href}
          href={d.href}
          className="inline-flex items-center gap-2 border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink transition hover:border-ink hover:bg-paper-deep"
        >
          {d.label}
          <span aria-hidden className="text-mute">
            →
          </span>
        </a>
      ))}
    </nav>
  );
}

// ── shared glyph ────────────────────────────────────────────────────────────

function GlyphSquare({
  accent = false,
  filled = false,
}: {
  accent?: boolean;
  filled?: boolean;
}): ReactNode {
  const stroke = accent ? "#B65D3A" : "#1A1A1F";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <rect
        x="1"
        y="1"
        width="10"
        height="10"
        fill={filled ? stroke : "#F7F4ED"}
        stroke={stroke}
        strokeWidth="1.25"
      />
    </svg>
  );
}

function formatAgeHrs(hrs: number): string {
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d`;
  return `${Math.round(hrs)}h`;
}

export default PlainoCardView;
