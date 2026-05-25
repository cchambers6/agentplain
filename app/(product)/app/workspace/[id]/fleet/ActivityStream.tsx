import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
} from "@/components/ui/ap";

export type ActivityStreamRow = {
  id: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  occurredAtIso: string;
  summary: string;
};

interface ActivityStreamProps {
  workspaceId: string;
  rows: ActivityStreamRow[];
}

/**
 * Recent handoffs compressed for the fleet hub — a 10-row slice of the
 * append-only handoff log so the customer can see motion without
 * leaving the page. Full feed at /activity.
 *
 * Empty state is intentionally terse: this surface sits next to the
 * fleet map + to-do board, both of which already explain the value
 * loop honestly when there's no data yet. Repeating that copy here
 * would be filler.
 */
export function ActivityStream({ workspaceId, rows }: ActivityStreamProps) {
  return (
    <section aria-labelledby="activity-stream-heading">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <ApEyebrow id="activity-stream-heading">activity stream</ApEyebrow>
        <Link
          href={`/app/workspace/${workspaceId}/activity`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
        >
          open full feed →
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="border border-dashed border-rule bg-paper p-5 text-[13px] leading-relaxed text-mute">
          No handoffs yet. The first row lands as soon as your fleet has
          something to hand over.
        </div>
      ) : (
        <ApHairlineList aria-label="recent fleet handoffs">
          {rows.map((r) => (
            <ApHairlineRow
              key={r.id}
              right={formatTime(r.occurredAtIso)}
            >
              <div className="text-ink-soft">
                <span className="text-[14px]">
                  <span className="font-mono text-ink">{r.fromAgent}</span>
                  <span className="mx-2 text-mute">→</span>
                  <span className="font-mono text-ink">{r.toAgent}</span>
                  <span className="ml-2 text-mute">· {r.handoffType}</span>
                </span>
                {r.summary ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    {r.summary}
                  </p>
                ) : null}
              </div>
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      )}
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
