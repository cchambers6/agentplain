"use client";

import { useMemo, useState } from "react";
import {
  IntegrationTile,
  type TileStatus,
} from "@/components/marketplace/IntegrationTile";
import type { MarketplaceEntry } from "@/lib/integrations/marketplace";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";

export interface FacetTile {
  entry: MarketplaceEntry;
  status: TileStatus;
  accountLabel?: string;
  configured: boolean;
}

interface MarketplaceFacetsProps {
  workspaceId: string;
  /** Tiles for THIS workspace's vertical — the server has already
   *  filtered by `entryAppliesToVertical(...)` so a CPA workspace never
   *  sees realty-only tiles even with the All-disciplines chip on. */
  tiles: FacetTile[];
  /** The customer's vertical slug, surfaced as a static badge so the
   *  customer knows why the catalog is shorter than the global one. */
  verticalSlug: string;
  /** Display label for the vertical badge (title-cased + plain). */
  verticalLabel: string;
}

const ALL = "all" as const;
type FilterValue = typeof ALL | DisciplineId;

export function MarketplaceFacets({
  workspaceId,
  tiles,
  verticalSlug,
  verticalLabel,
}: MarketplaceFacetsProps) {
  const [active, setActive] = useState<FilterValue>(ALL);
  const disciplines = listDisciplines();

  // Per-discipline counts — what the chip shows. Calculated against the
  // vertical-filtered tiles so a chip count of 0 honestly reflects "this
  // discipline has nothing in your vertical."
  const counts = useMemo(() => {
    const m = new Map<FilterValue, number>();
    m.set(ALL, tiles.length);
    for (const d of disciplines) {
      const n = tiles.filter((t) =>
        (t.entry.disciplines as readonly string[]).includes(d.id),
      ).length;
      m.set(d.id, n);
    }
    return m;
  }, [tiles, disciplines]);

  const visible = useMemo(() => {
    if (active === ALL) return tiles;
    return tiles.filter((t) =>
      (t.entry.disciplines as readonly string[]).includes(active),
    );
  }, [tiles, active]);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span
          className="border border-rule bg-paper-deep px-2 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute"
          data-testid="vertical-badge"
          data-vertical={verticalSlug}
        >
          your vertical · {verticalLabel}
        </span>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by discipline"
      >
        <FacetChip
          label="all"
          count={counts.get(ALL) ?? 0}
          active={active === ALL}
          onClick={() => setActive(ALL)}
        />
        {disciplines.map((d) => (
          <FacetChip
            key={d.id}
            label={d.name.toLowerCase()}
            count={counts.get(d.id) ?? 0}
            active={active === d.id}
            onClick={() => setActive(d.id)}
            disabled={(counts.get(d.id) ?? 0) === 0}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ entry, status, accountLabel, configured }) => (
          <IntegrationTile
            key={entry.id}
            entry={entry}
            status={status}
            workspaceId={workspaceId}
            accountLabel={accountLabel}
            configured={configured}
          />
        ))}
        {visible.length === 0 ? (
          <div className="col-span-full bg-paper p-8 text-center text-[14px] leading-relaxed text-mute">
            Nothing in this discipline for your vertical yet. Your service
            partner adds connectors here as the integration roadmap rolls
            out.
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface FacetChipProps {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function FacetChip({ label, count, active, disabled, onClick }: FacetChipProps) {
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
