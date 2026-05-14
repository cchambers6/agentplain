/**
 * LeadershipBoardView — pure presentational component for the
 * operator-only leadership board. Receives a pre-classified
 * `ClassifiedBoard` plus a `now` timestamp; renders status counters,
 * per-tier sections, and per-agent rows.
 *
 * Per `feedback_everything_tells_a_story.md`: every section answers a
 * specific operator question. The order matches that arc:
 *
 *   1. status row     → "what's the headline?"
 *   2. per-tier list  → "who fired? who didn't? what did they do?"
 *   3. empty-state    → "why is this view blank — and when will it fill?"
 *
 * Per `project_no_outbound_architecture.md`: this is a READ-ONLY surface.
 * No action triggers from here. The single form (Refresh) submits a
 * server action that revalidates the route — no third-party calls fire.
 */

// `import React` is required because `tsconfig.json` uses `jsx: preserve`
// (Next.js owns the transform in production builds), which means the tsx
// loader used by `node --test` emits classic-runtime `React.createElement`
// calls. Importing React keeps the file runnable in both pipelines.
import React from "react";
import {
  TIER_ORDER,
  type AgentStatus,
  type BoardRow,
  type ClassifiedBoard,
} from "@/lib/operator/leadership-data";

interface LeadershipBoardViewProps {
  board: ClassifiedBoard;
  now: Date;
  refreshAction: () => Promise<void>;
}

export default function LeadershipBoardView({
  board,
  now,
  refreshAction,
}: LeadershipBoardViewProps) {
  const anyObservations = board.tiers.some((t) =>
    t.rows.some((r) => r.observation !== null),
  );

  return (
    <div className="container-wide py-12 space-y-12">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-2">operator</p>
          <h1 className="font-display text-3xl text-ink md:text-4xl">
            Leadership board
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            One view for &ldquo;did each leadership agent fire today, and what
            did it do?&rdquo; Status badges cite the most recent observation
            on each agent &mdash; never extrapolated.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            snapshot generated {formatAbsolute(board.generatedAt)}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            source {board.source}
          </div>
          <form action={refreshAction}>
            <button type="submit" className="btn-secondary px-4 py-2 text-xs">
              Refresh
            </button>
          </form>
        </div>
      </header>

      <SummaryRow summary={board.summary} />

      {anyObservations ? (
        <div className="space-y-10">
          {board.tiers.map((tier) => (
            <TierSection key={tier.tier} tier={tier} now={now} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      <footer className="border-t border-rule pt-6 text-xs text-mute">
        Tier order:{" "}
        {TIER_ORDER.map((t) => `Class ${t}`)
          .join(" → ")
          .replace(/Class 1\.5/g, "Tier 1.5")
          .replace(/Class 1/g, "Tier 1")}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — each kept local; nothing in this file is reused elsewhere.
// ---------------------------------------------------------------------------

function SummaryRow({ summary }: { summary: ClassifiedBoard["summary"] }) {
  const items: Array<{ label: string; value: string; tone: BadgeTone }> = [
    {
      label: "Fired in last 24h",
      value: `${summary.firedInLast24h} / ${summary.totalAgents}`,
      tone: summary.firedInLast24h > 0 ? "moss" : "mute",
    },
    {
      label: "Pending Conner action",
      value: String(summary.pendingConnerAction),
      tone: summary.pendingConnerAction > 0 ? "clay" : "mute",
    },
    {
      label: "Stuck",
      value: String(summary.stuck),
      tone: summary.stuck > 0 ? "clay" : "mute",
    },
    {
      label: "Healthy",
      value: String(summary.healthy),
      tone: summary.healthy > 0 ? "moss" : "mute",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="border border-rule bg-paper px-4 py-5"
        >
          <div className="eyebrow">{item.label}</div>
          <div
            className={`mt-2 font-display text-3xl leading-none ${toneToValueClass(item.tone)}`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TierSection({
  tier,
  now,
}: {
  tier: ClassifiedBoard["tiers"][number];
  now: Date;
}) {
  return (
    <details className="group border border-rule bg-paper" open>
      <summary className="flex cursor-pointer items-center justify-between gap-4 border-b border-rule px-4 py-3">
        <div>
          <div className="eyebrow">tier {tier.tier}</div>
          <div className="font-display text-lg text-ink">{tier.label}</div>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          {tier.rows.length} agent{tier.rows.length === 1 ? "" : "s"}
        </div>
      </summary>
      <ul className="divide-y divide-rule">
        {tier.rows.map((row) => (
          <AgentRow key={row.agent.id} row={row} now={now} />
        ))}
      </ul>
    </details>
  );
}

function AgentRow({ row, now }: { row: BoardRow; now: Date }) {
  const { agent, observation, status } = row;
  const lastFiredAbs = observation?.lastFiredAt
    ? formatAbsolute(observation.lastFiredAt)
    : "—";
  const lastFiredRel = observation?.lastFiredAt
    ? formatRelative(observation.lastFiredAt, now)
    : "never";
  const summary = observation?.lastFireSummary?.trim() ?? "";
  const rec = observation?.latestRecommendation ?? null;
  const escalation = observation?.latestEscalation ?? null;

  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1.4fr_1fr_1.6fr_1.6fr] md:items-start">
      <div className="space-y-1">
        <div className="font-mono text-sm text-ink">{agent.displayName}</div>
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          {agent.cronScheduleLabel}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm text-ink" title={lastFiredAbs}>
          {lastFiredRel}
        </div>
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          last fire
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-1 text-sm text-ink-soft">
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          what it did
        </div>
        {summary ? (
          <p className="line-clamp-2">{summary}</p>
        ) : rec ? (
          <p className="line-clamp-2">
            <span className="font-mono text-xs">{rec.status}</span>{" "}
            &mdash; {rec.title}
          </p>
        ) : (
          <p className="text-mute">No daily-log entry recorded.</p>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          what&apos;s blocked
        </div>
        {escalation ? (
          <p className="text-clay-deep">{escalation.title}</p>
        ) : observation?.lastError ? (
          <p className="text-flag">{observation.lastError}</p>
        ) : (
          <p className="text-mute">No escalations.</p>
        )}
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="border border-rule bg-paper-deep px-6 py-10 text-sm text-ink-soft">
      <p className="font-display text-xl text-ink">
        Leadership tier hasn&apos;t fired yet.
      </p>
      <p className="mt-2 max-w-prose">
        The first scheduled fire lands at 06:00 ET. Once the leadership
        crons begin writing daily-log + recommendation files, run{" "}
        <code className="font-mono text-xs">
          npx tsx scripts/snapshot-leadership-state.ts
        </code>{" "}
        (or wait for the next deploy) to populate this view. Until then
        every agent shows <em>Not yet fired</em>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BadgeTone = "moss" | "clay" | "flag" | "mute";

const STATUS_TONE: Record<AgentStatus, BadgeTone> = {
  Healthy: "moss",
  Stuck: "clay",
  Errored: "flag",
  NotYetFired: "mute",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  Healthy: "Healthy",
  Stuck: "Stuck",
  Errored: "Errored",
  NotYetFired: "Not yet fired",
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center border px-2 py-[2px] font-mono text-[10px] uppercase tracking-eyebrow ${toneToBadgeClass(tone)}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function toneToBadgeClass(tone: BadgeTone): string {
  switch (tone) {
    case "moss":
      return "border-moss text-moss";
    case "clay":
      return "border-clay text-clay-deep";
    case "flag":
      return "border-flag text-flag";
    case "mute":
    default:
      return "border-rule text-mute";
  }
}

function toneToValueClass(tone: BadgeTone): string {
  switch (tone) {
    case "moss":
      return "text-moss";
    case "clay":
      return "text-clay-deep";
    case "flag":
      return "text-flag";
    case "mute":
    default:
      return "text-mute";
  }
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Stable ISO form — operator copy-pasting timestamps into incident
  // notes wants the exact UTC value, not a localized rendering.
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function formatRelative(iso: string, now: Date): string {
  const last = Date.parse(iso);
  if (Number.isNaN(last)) return "—";
  const deltaMs = now.getTime() - last;
  if (deltaMs < 0) return "in the future";
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
