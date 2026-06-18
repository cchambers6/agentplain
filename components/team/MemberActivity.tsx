/**
 * components/team/MemberActivity.tsx
 *
 * Activity feed grouped by team member (item 9 of the 2026-06-17 strategic
 * build). Presentational + server-renderable — visibility is enforced by
 * the data layer (`lib/team/activity.ts#visibleActivityFor`) BEFORE entries
 * reach this component, so a staff viewer is never handed a teammate's row.
 * The `scope` prop only controls the heading copy.
 */

import { ApEyebrow, ApHairlineList, ApHairlineRow } from "@/components/ui/ap";
import type { ActivityEntry } from "@/lib/team/activity";

interface Props {
  entries: ActivityEntry[];
  /** "all" → owner/manager view; "own" → staff/viewer view. Copy only. */
  scope: "all" | "own";
}

function formatWhen(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MemberActivity({ entries, scope }: Props): JSX.Element {
  // Group entries by actor so the feed reads "per member".
  const groups = new Map<string, { label: string; items: ActivityEntry[] }>();
  for (const e of entries) {
    const key = e.actorUserId ?? "__fleet__";
    const label = e.actorUserId ? e.actorLabel : "Your fleet (automatic)";
    const g = groups.get(key) ?? { label, items: [] };
    g.items.push(e);
    groups.set(key, g);
  }

  if (entries.length === 0) {
    return (
      <div>
        <ApEyebrow className="mb-3">activity</ApEyebrow>
        <p className="text-[14px] text-ink-soft">
          {scope === "all"
            ? "No activity yet. Once your team starts handling work, it shows up here per person."
            : "Nothing assigned to you yet. Work routed to you will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ApEyebrow className="mb-1">
        {scope === "all" ? "team activity" : "your activity"}
      </ApEyebrow>
      {[...groups.values()].map((g) => (
        <section key={g.label}>
          <h3 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {g.label} · {g.items.length} item{g.items.length === 1 ? "" : "s"}
          </h3>
          <ApHairlineList
            className="mt-2"
            aria-label={`Activity for ${g.label}`}
          >
            {g.items.map((e) => (
              <ApHairlineRow
                key={e.id}
                right={
                  <span className="text-mute">{formatWhen(e.occurredAt)}</span>
                }
              >
                <div>
                  <p className="text-[14px] text-ink">{e.summary}</p>
                  {e.discipline ? (
                    <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {e.discipline}
                    </p>
                  ) : null}
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        </section>
      ))}
    </div>
  );
}
