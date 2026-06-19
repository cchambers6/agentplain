/**
 * components/team/MemberPerformance.tsx
 *
 * Per-member KPI widget (item 9 of the 2026-06-17 strategic build),
 * surfaced in the Weekly BI report (item 7) and on the team page.
 * Presentational — hand it the rows from `lib/team/performance.ts`.
 *
 * The satisfaction column is labelled a PROXY everywhere so it's never
 * read as a real CSAT figure (per `feedback_no_guesses_no_estimates`).
 */

import {
  ApEyebrow,
  ApHeritageTable,
  ApHeritageTh,
  ApHeritageTd,
} from "@/components/ui/ap";
import { roleLabel } from "@/lib/auth/roles";
import { formatResponseMs, type MemberKpis } from "@/lib/team/performance";

interface Props {
  rows: MemberKpis[];
  /** Trailing window the KPIs cover, for the caption. */
  windowDays?: number;
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function MemberPerformance({ rows, windowDays = 7 }: Props): JSX.Element {
  if (rows.length === 0) {
    return (
      <div>
        <ApEyebrow className="mb-3">team performance</ApEyebrow>
        <p className="text-[14px] text-ink-soft">
          No team members yet. Invite your team to see per-person KPIs here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ApEyebrow className="mb-3">team performance · last {windowDays} days</ApEyebrow>
      <ApHeritageTable>
        <thead>
          <tr>
            <ApHeritageTh>Member</ApHeritageTh>
            <ApHeritageTh>Role</ApHeritageTh>
            <ApHeritageTh>Tasks done</ApHeritageTh>
            <ApHeritageTh>Avg response</ApHeritageTh>
            <ApHeritageTh>Approval rate (proxy)</ApHeritageTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-rule">
              <ApHeritageTd>{r.label}</ApHeritageTd>
              <ApHeritageTd>{roleLabel(r.role)}</ApHeritageTd>
              <ApHeritageTd>{r.tasksCompleted}</ApHeritageTd>
              <ApHeritageTd>{formatResponseMs(r.avgResponseMs)}</ApHeritageTd>
              <ApHeritageTd>{pct(r.satisfactionProxy)}</ApHeritageTd>
            </tr>
          ))}
        </tbody>
      </ApHeritageTable>
      <p className="mt-3 text-[12px] leading-relaxed text-mute">
        Approval rate is a proxy for satisfaction — the share of items a
        member approved rather than rejected or sent back. It is not a
        customer survey score.
      </p>
    </div>
  );
}
