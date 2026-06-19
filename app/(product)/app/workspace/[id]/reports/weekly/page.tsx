import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
  PlainoMark,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import {
  computeWeeklyReportData,
  type WeeklyReportData,
} from "@/lib/reports/weekly-report-data";
import { getMemberPerformance } from "@/lib/team/performance";
import { MemberPerformance } from "@/components/team/MemberPerformance";
import { setWeeklyReportEnabledAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** How many completed weeks of history to show under the live week. */
const HISTORY_WEEKS = 4;

// Customer-facing twin of the Friday weekly report email. Renders the EXACT
// numbers the email carries — the current week as it builds, plus the recent
// completed weeks — so the owner can see the report is real, pulled straight
// from their workspace, not marketing copy. Reuses the same
// `computeWeeklyReportData` aggregator the cron + email use, so the dashboard
// and the inbox can never drift.
export default async function WeeklyReportPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const now = new Date();

  const { workspace, pref, currentWeek, history } = await withRls(
    ctx,
    async (tx) => {
      const ws = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, vertical: true },
      });
      if (!ws) {
        return {
          workspace: null,
          pref: null,
          currentWeek: null,
          history: [] as WeeklyReportData[],
        };
      }
      const preference = await tx.workspacePreference.findUnique({
        where: { workspaceId },
        select: { weeklyReportEnabled: true },
      });

      const base = {
        workspaceId: ws.id,
        workspaceName: ws.name,
        vertical: ws.vertical,
      };
      // `now + 7d` resolves the CURRENT in-progress week (reads only count
      // rows up to real now — there are no future rows). `now - k*7d`
      // resolves each prior completed week. One aggregator, every week.
      const current = await computeWeeklyReportData(tx, {
        ...base,
        now: new Date(now.getTime() + 7 * DAY_MS),
      });
      const past: WeeklyReportData[] = [];
      for (let k = 0; k < HISTORY_WEEKS; k++) {
        past.push(
          await computeWeeklyReportData(tx, {
            ...base,
            now: new Date(now.getTime() - k * 7 * DAY_MS),
          }),
        );
      }
      return {
        workspace: ws,
        pref: preference,
        currentWeek: current,
        history: past,
      };
    },
  );

  if (!workspace || !currentWeek) {
    return (
      <div>
        <ApEyebrow className="mb-3">weekly report</ApEyebrow>
        <ApRootedEmptyState
          motif="big-sky"
          reality="This workspace isn't available."
          change="Check the address, or head back to your dashboard."
        />
      </div>
    );
  }

  const enabled = pref?.weeklyReportEnabled ?? true;

  // Per-member KPIs — only meaningful once the workspace has a team, so the
  // section is hidden for the solo-owner case (one row = just the owner).
  const memberPerf = await getMemberPerformance(ctx, workspaceId, 7);

  return (
    <div>
      <div className="flex items-center gap-3">
        <PlainoMark size={32} alt={partner} />
        <ApEyebrow className="mb-0">weekly report</ApEyebrow>
      </div>
      <h1 className="mt-3 font-display text-3xl text-ink">
        What {partner} did for you, week by week.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every Friday at 8am, {partner} emails {workspace.name} a summary of the
        week just finished. Here&rsquo;s the same thing, live — pulled straight
        from your workspace, so you can see it&rsquo;s real.
      </p>

      {/* Email-preferences toggle (anchor target for the email footer link). */}
      <section id="email-preferences" className="mt-6">
        <ApPaperCard
          eyebrow="email preferences"
          title={
            enabled
              ? "Weekly report email is on"
              : "Weekly report email is off"
          }
        >
          <p className="text-[14px] leading-relaxed text-ink-soft">
            {enabled
              ? `${partner} sends this summary to your inbox every Friday morning. The page below stays live either way.`
              : `You won't get the Friday email. ${partner} keeps working — turn the email back on any time.`}
          </p>
          <form action={setWeeklyReportEnabledAction} className="mt-4">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input
              type="hidden"
              name="desired"
              value={enabled ? "off" : "on"}
            />
            <ApHeritageButton variant="ghost" type="submit">
              {enabled
                ? "turn off the weekly email"
                : "turn the weekly email back on"}
            </ApHeritageButton>
          </form>
        </ApPaperCard>
      </section>

      {/* This week, in progress. */}
      <section className="mt-10">
        <ApEyebrow className="mb-3">this week so far</ApEyebrow>
        <ReportCard data={currentWeek} partner={partner} live />
      </section>

      {/* Per-member KPIs — only when there's a team to compare. */}
      {memberPerf.length > 1 ? (
        <section className="mt-10">
          <MemberPerformance rows={memberPerf} windowDays={7} />
        </section>
      ) : null}

      {/* Completed weeks. */}
      <section className="mt-10">
        <ApEyebrow className="mb-3">previous weeks</ApEyebrow>
        <ul className="space-y-4">
          {history.map((wk) => (
            <li key={wk.forDate}>
              <ReportCard data={wk} partner={partner} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Presentational report card (mirrors the email's section order) ────────────

function ReportCard({
  data,
  partner,
  live = false,
}: {
  data: WeeklyReportData;
  partner: string;
  live?: boolean;
}) {
  if (data.isEmpty) {
    return (
      <ApPaperCard
        eyebrow={`${data.weekLabel}${live ? " · in progress" : ""}`}
        title={live ? "Quiet so far" : "A quiet week"}
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {live
            ? `Nothing to report yet this week. ${partner} is watching your inbox and your systems — drafts will show up here as the week fills in.`
            : `${partner} didn't have an approved action to point to this week. That's normal early on — the numbers fill in as your fleet reads enough to act.`}
        </p>
      </ApPaperCard>
    );
  }

  return (
    <ApPaperCard
      eyebrow={`${data.weekLabel}${live ? " · in progress" : ""}`}
      title={`${data.draftsCreated} drafted${
        data.approvalsApproved > 0 ? ` · ${data.approvalsApproved} approved` : ""
      }${data.hoursSaved > 0 ? ` · ~${formatHours(data.hoursSaved)} saved` : ""}`}
    >
      {data.verticalOutcomes.length > 0 ? (
        <ul className="space-y-2">
          {data.verticalOutcomes.map((o, i) => (
            <li key={i}>
              <p className="text-[15px] text-ink">{o.label}</p>
              {o.detail ? (
                <p className="mt-0.5 text-[13px] leading-relaxed text-mute">
                  {o.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-4 text-[13px] text-ink-soft">
        <span>
          <span className="text-ink">{data.draftsCreated}</span> drafted
        </span>
        {data.approvalsApproved > 0 ? (
          <span>
            <span className="text-ink">{data.approvalsApproved}</span> approved
            {data.medianTimeToApproveMinutes !== null ? (
              <span className="text-mute">
                {" "}
                · ~{formatMinutes(data.medianTimeToApproveMinutes)} to clear
              </span>
            ) : null}
          </span>
        ) : null}
        {data.actionsAutoExecuted > 0 ? (
          <span>
            <span className="text-ink">{data.actionsAutoExecuted}</span>{" "}
            auto-handled
          </span>
        ) : null}
        {data.approvalsRejected > 0 ? (
          <span>
            <span className="text-ink">{data.approvalsRejected}</span> sent back
          </span>
        ) : null}
        {data.hasRealDollars && data.dollarsInfluenced > 0 ? (
          <span>
            <span className="text-ink">
              ${Math.round(data.dollarsInfluenced).toLocaleString("en-US")}
            </span>{" "}
            in real dollars
          </span>
        ) : null}
      </div>

      {data.lookAhead.needsInput.length > 0 ? (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            {partner}&rsquo;s look-ahead
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-soft">
            {data.lookAhead.needsInput.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </ApPaperCard>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.round(hours * 10) / 10}h`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60)
    return `${Math.round(minutes)} min${Math.round(minutes) === 1 ? "" : "s"}`;
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}
