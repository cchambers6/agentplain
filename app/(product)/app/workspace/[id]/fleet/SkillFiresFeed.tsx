/**
 * SkillFiresFeed.tsx — last-N skill-driven approval rows surfaced as a
 * "what fired" panel on the fleet hub. Reuses the approval-queue rows
 * because that is the closest thing agentplain persists to a skill
 * audit on origin/main (no SkillRun table yet — see
 * lib/skills/skill-scorecard.ts for the honesty note).
 *
 * Each row shows skill (agentSlug) + discipline (when tagged) +
 * proposed-at timestamp + outcome (drafted / approved / auto-approved /
 * rejected / expired) and links to /approvals?focus=<id> for the full
 * card.
 *
 * Per the wave-5 visibility brief: this is server-rendered, no
 * realtime — same deferred-realtime pattern as the rest of the fleet
 * hub. Customer hits refresh to see new fires.
 */

import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApRootedEmptyState,
} from "@/components/ui/ap";

export interface SkillFireRow {
  id: string;
  skillSlug: string;
  discipline: string | null;
  proposedAtIso: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED" | "EXPIRED";
  kind: string;
}

interface Props {
  workspaceId: string;
  rows: SkillFireRow[];
}

export function SkillFiresFeed({ workspaceId, rows }: Props): JSX.Element {
  return (
    <section className="space-y-4">
      <header className="border-b border-rule pb-3">
        <ApEyebrow>skill fires</ApEyebrow>
        <h2 className="mt-2 font-display text-2xl text-ink">
          What your fleet drafted, lately.
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          Every row is a real approval-queue item one of your skills
          produced. Click through to review, edit, or send via your own
          tools.
        </p>
      </header>
      {rows.length === 0 ? (
        <ApRootedEmptyState
          motif="horizon"
          reality={`Nothing has fired yet.`}
          change={`Once a skill drafts something, it lands here with the discipline + outcome.`}
        />
      ) : (
        <ApHairlineList aria-label="Recent skill fires">
          {rows.map((r) => (
            <ApHairlineRow
              key={`fire-${r.id}`}
              right={
                <span className="font-mono text-[11px] uppercase text-mute">
                  {humanStatus(r.status)} ·{" "}
                  {new Date(r.proposedAtIso).toLocaleString()}
                </span>
              }
            >
              <Link
                href={`/app/workspace/${workspaceId}/approvals?focus=${r.id}`}
                className="block hover:underline-offset-4 hover:underline"
              >
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  {r.skillSlug}
                  {r.discipline ? ` · ${r.discipline}` : ""}
                </p>
                <p className="mt-1 text-[14px] text-ink">{humanKind(r.kind)}</p>
              </Link>
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      )}
    </section>
  );
}

function humanStatus(status: SkillFireRow["status"]): string {
  if (status === "AUTO_APPROVED") return "auto-approved";
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "EXPIRED") return "expired";
  return "drafted";
}

function humanKind(kind: string): string {
  return kind.replace(/_/g, " ").toLowerCase();
}
