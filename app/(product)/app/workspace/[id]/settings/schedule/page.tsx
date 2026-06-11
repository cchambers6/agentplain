import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { ScheduleWindowForm } from "./ScheduleWindowForm";
import { SettingAffects } from "../SettingAffects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ScheduleSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);

  const [workspace, windows] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.skillScheduleWindow.findMany({
        where: { workspaceId },
        orderBy: { skillSlug: "asc" },
      }),
    ),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const { SKILL_CATALOG } = await import("@/lib/skills/registry");
  const skillOptions = SKILL_CATALOG.filter(
    (s) => s.vertical === "all" || s.vertical === verticalSlug,
  ).map((s) => ({ slug: s.slug, name: s.name }));

  const existing: Record<
    string,
    {
      daysOfWeek: number[];
      startHourLocal: number;
      endHourLocal: number;
      workspaceTimezone: string;
    }
  > = {};
  for (const w of windows) {
    existing[w.skillSlug] = {
      daysOfWeek: w.daysOfWeek,
      startHourLocal: w.startHourLocal,
      endHourLocal: w.endHourLocal,
      workspaceTimezone: w.workspaceTimezone,
    };
  }

  return (
    <div className="space-y-10">
      <header>
        <ApEyebrow className="mb-3">scheduling windows</ApEyebrow>
        <h1 className="font-display text-3xl text-ink">
          Tell {partner} when each skill is allowed to fire
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          By default every skill fires whenever the work shows up. Set a
          window here to constrain a specific skill to your business
          hours, or to weekdays only. Anything outside the window is
          skipped honestly — no draft, no LLM cost — and resumes on the
          next in-window fire.
        </p>
        <SettingAffects>
          When the windowed skill is allowed to fire. The follow-up chaser,
          the chief-of-staff scheduler, and inbox triage each skip any fire
          whose local hour or day falls outside the window — honestly, with
          no draft and no LLM cost — and resume on the next in-window fire.
        </SettingAffects>
      </header>

      <section>
        <h2 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          configured windows
        </h2>
        {windows.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality="No skill is windowed yet — every skill fires anytime."
            change="Set a window below to constrain a specific skill."
          />
        ) : (
          <ApHairlineList className="mt-3" aria-label="Windows">
            {windows.map((w) => (
              <ApHairlineRow
                key={w.id}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {w.workspaceTimezone}
                  </span>
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {w.skillSlug}
                  </p>
                  <p className="mt-1 text-[14px] text-ink">
                    Hours {w.startHourLocal} → {w.endHourLocal} local ·
                    {w.daysOfWeek.length === 0
                      ? " every day"
                      : ` days ${w.daysOfWeek.join(", ")}`}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          set or edit a window
        </h2>
        <div className="mt-4 rounded-none border border-rule bg-paper p-5">
          <ScheduleWindowForm
            workspaceId={workspaceId}
            skillOptions={skillOptions}
            existingWindows={existing}
            defaultTimezone="America/New_York"
          />
        </div>
      </section>
    </div>
  );
}
