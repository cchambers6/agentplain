"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DisciplineId } from "@/lib/disciplines";

interface AgentCard {
  slug: string;
  name: string;
  job: string;
  status: string;
  discipline: DisciplineId | null;
  disabled: boolean;
  /** True when the card's runtime is "live" but the workspace's
   *  `liveRequires.connectors` are not yet wired. Rendered as a
   *  "connect to activate" badge above the status line. */
  needsConnector: boolean;
}

interface AgentsFleetGridProps {
  workspaceId: string;
  cards: AgentCard[];
  disciplines: Array<{ id: DisciplineId; name: string }>;
}

const ALL = "all" as const;
type FilterValue = typeof ALL | DisciplineId;

export function AgentsFleetGrid({
  workspaceId,
  cards,
  disciplines,
}: AgentsFleetGridProps) {
  const [filter, setFilter] = useState<FilterValue>(ALL);

  const counts = useMemo(() => {
    const m = new Map<FilterValue, number>();
    m.set(ALL, cards.length);
    for (const d of disciplines) {
      m.set(d.id, cards.filter((c) => c.discipline === d.id).length);
    }
    return m;
  }, [cards, disciplines]);

  const visible = useMemo(() => {
    if (filter === ALL) return cards;
    return cards.filter((c) => c.discipline === filter);
  }, [cards, filter]);

  return (
    <>
      <div
        className="mt-6 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter fleet by discipline"
      >
        <FilterChip
          label="all"
          count={counts.get(ALL) ?? 0}
          active={filter === ALL}
          onClick={() => setFilter(ALL)}
        />
        {disciplines.map((d) => (
          <FilterChip
            key={d.id}
            label={d.name.toLowerCase()}
            count={counts.get(d.id) ?? 0}
            active={filter === d.id}
            onClick={() => setFilter(d.id)}
            disabled={(counts.get(d.id) ?? 0) === 0}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((agent) => (
          <Link
            key={agent.slug}
            href={`/app/workspace/${workspaceId}/agents/${agent.slug}`}
            className="block border border-transparent bg-paper p-5 transition hover:border-ink focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
          >
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {agent.slug}
            </p>
            <p className="mt-2 font-display text-xl text-ink">{agent.name}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {agent.job}
            </p>
            {agent.needsConnector ? (
              <p
                className="mt-3 inline-flex items-center gap-2 border border-clay px-2 py-1 font-mono text-[10px] tracking-eyebrow uppercase text-clay"
                data-testid="needs-connector-badge"
              >
                connect to activate
              </p>
            ) : null}
            <p className="mt-3 text-[13px] text-mute">{agent.status}</p>
            {agent.discipline ? (
              <p className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                <span aria-hidden className="inline-block h-1 w-3 bg-rule" />
                {agent.discipline}
                {agent.disabled ? (
                  <span className="text-flag">· discipline off</span>
                ) : null}
              </p>
            ) : null}
          </Link>
        ))}
        {visible.length === 0 ? (
          <div className="col-span-full bg-paper p-8 text-center text-[14px] leading-relaxed text-mute">
            Nothing in this discipline for your vertical yet.
          </div>
        ) : null}
      </div>
    </>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function FilterChip({ label, count, active, disabled, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        "inline-flex items-center gap-2 border px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        active
          ? "border-ink bg-ink text-paper"
          : disabled
            ? "cursor-not-allowed border-rule text-mute/60"
            : "border-rule bg-paper text-ink hover:border-ink",
      ].join(" ")}
    >
      {label}
      <span className="opacity-70">{count}</span>
    </button>
  );
}
