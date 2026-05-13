import { ReactNode } from "react";
import { getAllVerticals } from "@/lib/verticals";

// "How it works" — 3-step value loop. Answers Q3 (what does it do) + Q5 (how
// easy is it to use) of the homepage story arc per
// `feedback_everything_tells_a_story.md` §"story arc … Q4 3-step value loop".
//
// Step 1: Pick your vertical — chip row mirrors hero chip row (lib/verticals
//   registry — all 10 names, locked per `project_vertical_tier_mapping.md`
//   and `feedback_no_new_verticals_finish_locked.md`).
// Step 2: Connect your tools — generic mail/calendar/CRM/docs icons. We do
//   NOT use vendor logos (no Gmail/Outlook marks) — we don't have permission
//   and don't want to imply endorsement. Per the task hard-stop clause, we
//   fall back to generic icons.
// Step 3: The fleet runs — micro-flow showing message-in → categorize →
//   draft → review. Pure SVG, subtle CSS animation (respects
//   prefers-reduced-motion).
//
// Per `feedback_runner_portability.md`: no third-party deps. SVG icons inline.
// Per `feedback_no_silent_vendor_lock.md`: no icon library lock-in.
// Per `project_no_outbound_architecture.md`: Step 3 ends in "review" — never
// in "send." The fleet drafts; the human decides; the customer's existing
// system handles the send.

interface StepProps {
  number: string;
  title: string;
  body: string;
  visual: ReactNode;
}

export default function HowItWorks() {
  const verticals = getAllVerticals();

  const steps: StepProps[] = [
    {
      number: "01",
      title: "Pick your vertical.",
      body: "Each ships with its own JTBD table, integration list, and counsel-reviewed compliance corpus. No prompt engineering, no per-customer custom build.",
      visual: (
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {verticals.map((v) => (
            <span
              key={v.slug}
              className="inline-flex items-center border border-rule bg-paper px-2 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-mute"
            >
              {shortName(v.name)}
            </span>
          ))}
        </div>
      ),
    },
    {
      number: "02",
      title: "Connect your tools.",
      body: "Read-only OAuth into the CRM, inbox, calendar, and accounting tools you already use. 60 seconds, not a project.",
      visual: <ConnectVisual />,
    },
    {
      number: "03",
      title: "The fleet drafts; you decide.",
      body: "Read → categorize → draft → queue for your review. Every customer-facing output queues. Your existing systems handle every send.",
      visual: <FleetFlowVisual />,
    },
  ];

  return (
    <div
      role="list"
      aria-label="Three-step value loop"
      className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-[1fr_auto_1fr_auto_1fr]"
    >
      <StepCard step={steps[0]} />
      <Connector />
      <StepCard step={steps[1]} />
      <Connector />
      <StepCard step={steps[2]} />
    </div>
  );
}

function StepCard({ step }: { step: StepProps }) {
  return (
    <article
      role="listitem"
      className="flex flex-col bg-paper p-7 md:p-8"
      aria-labelledby={`how-step-${step.number}`}
    >
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {step.number}
      </p>
      <h3
        id={`how-step-${step.number}`}
        className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl"
      >
        {step.title}
      </h3>
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-soft">
        {step.body}
      </p>
      <div className="mt-6 flex min-h-[8rem] items-center border border-rule bg-paper-deep p-4">
        {step.visual}
      </div>
    </article>
  );
}

// Horizontal connector between steps on md+. Collapses to a vertical hairline
// on mobile (md-). The arrowhead is rendered with currentColor so it inherits
// the clay accent.
function Connector() {
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

// Generic tool icons for Step 2. No vendor marks (Gmail/Outlook/etc) per the
// task's permission constraint. Icons represent CATEGORIES of integration:
// inbox (envelope), calendar (grid), CRM (card stack), docs (file).
function ConnectVisual() {
  const tools: { label: string; icon: ReactNode }[] = [
    { label: "Inbox", icon: <EnvelopeGlyph /> },
    { label: "Calendar", icon: <CalendarGlyph /> },
    { label: "CRM", icon: <CardsGlyph /> },
    { label: "Docs", icon: <FileGlyph /> },
  ];
  return (
    <ul
      className="grid w-full grid-cols-4 gap-2"
      aria-label="Categories of tools the fleet reads"
    >
      {tools.map((t) => (
        <li
          key={t.label}
          className="flex flex-col items-center gap-1 border border-rule bg-paper p-2 text-clay"
        >
          {t.icon}
          <span className="font-mono text-[9px] uppercase tracking-eyebrow text-mute">
            {t.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Step 3 — micro-flow showing the four states a message moves through.
// Pulse animation runs as a CSS keyframe; honors prefers-reduced-motion.
function FleetFlowVisual() {
  const stages = ["READ", "CATEGORIZE", "DRAFT", "REVIEW"];
  return (
    <div className="w-full">
      <ol
        className="flex w-full items-stretch gap-1"
        aria-label="Four stages a message moves through"
      >
        {stages.map((s, i) => (
          <li
            key={s}
            className={`fleet-flow-pip flex flex-1 items-center justify-center border border-rule bg-paper px-1 py-2 font-mono text-[9px] uppercase tracking-eyebrow text-clay`}
            style={{ animationDelay: `${i * 0.5}s` }}
          >
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-mute">
        Last stop = your inbox. The fleet never sends.
      </p>
      <style>{`
        @keyframes fleet-flow-pulse {
          0%, 100% { background-color: var(--color-paper); color: var(--color-clay); }
          25% { background-color: var(--color-clay); color: var(--color-paper); }
        }
        .fleet-flow-pip {
          animation: fleet-flow-pulse 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fleet-flow-pip { animation: none; }
        }
      `}</style>
    </div>
  );
}

function EnvelopeGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function CardsGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="14" height="12" rx="1" />
      <rect x="7" y="3" width="14" height="12" rx="1" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

// Trim vertical names for the chip row so 10 chips fit without wrapping
// awkwardly on narrow viewports. The full name lives on the per-vertical
// landing page; here we just need recognition.
function shortName(name: string): string {
  return name
    .replace(/ brokerages?$/i, "")
    .replace(/ firms?$/i, "")
    .replace(/ practices?$/i, "");
}
