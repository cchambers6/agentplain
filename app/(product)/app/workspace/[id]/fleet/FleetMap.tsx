import Link from "next/link";
import { ApEyebrow } from "@/components/ui/ap";
import type { AgentRosterEntry } from "@/lib/verticals/types";

interface FleetMapProps {
  workspaceId: string;
  verticalName: string | null;
  fleet: AgentRosterEntry[];
  handoffCounts: Map<string, number>;
}

/**
 * Visual fleet map for the workspace. Groups roster capabilities by
 * runtime status — "live" first, then "rooting" — so the customer
 * sees at a glance what is awake vs. what is still being built.
 *
 * Numbers come from real HandoffLogEntry counts (per agent slug);
 * "rooting" cards never display a count, just the partner's calm
 * statement of what the capability is waiting on.
 *
 * Read-only: enabling/disabling capabilities is the service team's
 * call today (see /agents for the same source-of-truth roster).
 */
export function FleetMap({
  workspaceId,
  verticalName,
  fleet,
  handoffCounts,
}: FleetMapProps) {
  const live = fleet.filter((a) => a.runtime === "live" || a.runtime === undefined);
  const rooting = fleet.filter((a) => a.runtime === "rooting");

  return (
    <section aria-labelledby="fleet-map-heading">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <ApEyebrow>your fleet</ApEyebrow>
          <h2
            id="fleet-map-heading"
            className="mt-2 font-display text-2xl text-ink md:text-3xl"
          >
            {verticalName
              ? `${verticalName} fleet — each capability scoped to one job.`
              : "Your fleet — each capability scoped to one job."}
          </h2>
        </div>
        <Link
          href={`/app/workspace/${workspaceId}/agents`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
        >
          open fleet detail →
        </Link>
      </header>

      <FleetGroup
        title="awake"
        subtitle={
          live.length === 0
            ? "Nothing awake yet — every capability is still rooting."
            : "Working on real handoffs as they land."
        }
        agents={live}
        workspaceId={workspaceId}
        handoffCounts={handoffCounts}
        tone="live"
      />

      {rooting.length > 0 ? (
        <div className="mt-8">
          <FleetGroup
            title="rooting"
            subtitle="Declared in your fleet; runtime still being built. The card says what each one is waiting on."
            agents={rooting}
            workspaceId={workspaceId}
            handoffCounts={handoffCounts}
            tone="rooting"
          />
        </div>
      ) : null}
    </section>
  );
}

interface FleetGroupProps {
  title: string;
  subtitle: string;
  agents: AgentRosterEntry[];
  workspaceId: string;
  handoffCounts: Map<string, number>;
  tone: "live" | "rooting";
}

function FleetGroup({
  title,
  subtitle,
  agents,
  workspaceId,
  handoffCounts,
  tone,
}: FleetGroupProps) {
  return (
    <div>
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <p
          className={
            tone === "live"
              ? "font-mono text-[11px] tracking-eyebrow uppercase text-moss"
              : "font-mono text-[11px] tracking-eyebrow uppercase text-mute"
          }
        >
          {title} · {agents.length}
        </p>
        <p className="text-[13px] leading-relaxed text-mute">{subtitle}</p>
      </header>

      {agents.length === 0 ? (
        <div className="border border-dashed border-rule bg-paper p-5 text-[13px] leading-relaxed text-mute">
          (none in this group)
        </div>
      ) : (
        <ul
          aria-label={`${title} capabilities`}
          className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3"
        >
          {agents.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/app/workspace/${workspaceId}/agents/${a.slug}`}
                className="block h-full bg-paper p-4 transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                    {a.slug}
                  </p>
                  <StatusDot tone={tone} />
                </div>
                <p className="mt-2 font-display text-lg leading-tight text-ink">
                  {a.name}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                  {a.job}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-mute">
                  {statusLine(a, handoffCounts)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ tone }: { tone: "live" | "rooting" }) {
  // Single hairline mark, no animation. The label below the card
  // states the actual status; the dot is just a quick visual.
  const cls =
    tone === "live"
      ? "inline-block h-1.5 w-1.5 bg-moss"
      : "inline-block h-1.5 w-1.5 bg-mute/50";
  return (
    <span
      className={cls}
      aria-hidden
    />
  );
}

function statusLine(
  a: AgentRosterEntry,
  counts: Map<string, number>,
): string {
  const count = counts.get(a.slug) ?? 0;
  if (a.runtime === "rooting") {
    return a.rootingNote ?? "rooting now — runtime still being built.";
  }
  if (
    a.runtime === "live" &&
    typeof a.boundSkill === "string" &&
    a.boundSkill.length > 0 &&
    count === 0
  ) {
    return "ready — capability tested, first run lands when triggered";
  }
  if (count === 0) return "rooting in — first handoff lands soon";
  return `${count} handoff${count === 1 ? "" : "s"} logged`;
}
