// Wave-2 per-skill config page — three sections, three forms, one
// honest "live"/"saved-only" badge per field.
//
// The three skills listed here are the ones whose runtime caller reads
// the config on every fire today:
//   - follow-up-chaser-general  → staleAfterDays + maxNudgesPerRun
//   - inbox-triage-general      → priorityKeywords
//   - chief-of-staff-scheduler  → defaultMeetingMinutes + businessHours
//
// Fields without a runtime reader yet (nudgeTone, flagFromSenders,
// autoArchiveSenders, bufferMinutes) still persist into SkillConfig —
// we just badge them honestly so the customer knows the cron isn't
// honoring them today. Per audit §9 #4 "honesty seam: show a 'config
// saved — applied on next skill update' notice" we do exactly that
// per-field, not per-skill.

import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import {
  CHIEF_OF_STAFF_SLUG,
  FOLLOW_UP_CHASER_SLUG,
  INBOX_TRIAGE_SLUG,
  readChiefOfStaffConfig,
  readFollowUpChaserConfig,
  readInboxTriageConfig,
  SKILL_CONFIG_LIVE_KEYS,
} from "@/lib/skills/config";
import {
  saveChiefOfStaffConfigAction,
  saveFollowUpChaserConfigAction,
  saveInboxTriageConfigAction,
} from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

function liveBadge(skillSlug: string, key: string) {
  const liveKeys = SKILL_CONFIG_LIVE_KEYS[skillSlug] ?? [];
  const isLive = liveKeys.includes(key);
  return (
    <span
      className={`ml-2 inline-block rounded-sm border px-2 py-[2px] font-mono text-[10px] tracking-eyebrow uppercase ${
        isLive
          ? "border-clay text-clay"
          : "border-rule text-mute"
      }`}
      title={
        isLive
          ? "Live — the running skill reads this value on every fire."
          : "Saved — persists, but the running skill does not read it yet. Wires up in a future release."
      }
    >
      {isLive ? "live" : "saved"}
    </span>
  );
}

export default async function SkillsSettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const [follow, triage, scheduler] = await Promise.all([
    readFollowUpChaserConfig(workspaceId),
    readInboxTriageConfig(workspaceId),
    readChiefOfStaffConfig(workspaceId),
  ]);

  return (
    <div>
      <ApEyebrow className="mb-3">settings · skills</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Teach each skill how you work.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        One card per skill. Fields tagged{" "}
        <span className="font-mono text-clay">live</span> apply on the
        next fire. Fields tagged{" "}
        <span className="font-mono text-mute">saved</span> persist but
        the running skill doesn't honor them yet — they wire up in a
        future release, and the badge will flip when they do.
      </p>

      <ul className="mt-8 space-y-4">
        <li>
          <ApPaperCard
            eyebrow={FOLLOW_UP_CHASER_SLUG}
            title="Follow-up chaser"
          >
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Nudges stalled outbound threads. Set how long to wait
              before nudging and how many nudges land per hourly run.
            </p>
            <form
              action={saveFollowUpChaserConfigAction}
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  wait days before nudge
                  {liveBadge(FOLLOW_UP_CHASER_SLUG, "staleAfterDays")}
                </span>
                <input
                  name="staleAfterDays"
                  type="number"
                  min="1"
                  max="90"
                  defaultValue={follow.staleAfterDays}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  max nudges per run
                  {liveBadge(FOLLOW_UP_CHASER_SLUG, "maxNudgesPerRun")}
                </span>
                <input
                  name="maxNudgesPerRun"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={follow.maxNudgesPerRun}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  nudge tone
                  {liveBadge(FOLLOW_UP_CHASER_SLUG, "nudgeTone")}
                </span>
                <select
                  name="nudgeTone"
                  defaultValue={follow.nudgeTone}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  <option value="professional">professional</option>
                  <option value="warm">warm</option>
                  <option value="firm">firm</option>
                </select>
              </label>
              <ApHeritageButton variant="secondary" type="submit">
                save
              </ApHeritageButton>
            </form>
          </ApPaperCard>
        </li>

        <li>
          <ApPaperCard eyebrow={INBOX_TRIAGE_SLUG} title="Inbox triage">
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Classifies inbound mail. Your priority keywords ride
              alongside the built-in urgency cues — anything that
              matches forces the message to urgent.
            </p>
            <form
              action={saveInboxTriageConfigAction}
              className="mt-5 grid gap-4 sm:grid-cols-3"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <label className="flex flex-col gap-1 text-sm sm:col-span-3">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  priority keywords (comma- or newline-separated)
                  {liveBadge(INBOX_TRIAGE_SLUG, "priorityKeywords")}
                </span>
                <textarea
                  name="priorityKeywords"
                  rows={3}
                  defaultValue={triage.priorityKeywords.join(", ")}
                  placeholder="e.g. closing today, wire failed, recission"
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-3">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  flag from these senders
                  {liveBadge(INBOX_TRIAGE_SLUG, "flagFromSenders")}
                </span>
                <textarea
                  name="flagFromSenders"
                  rows={2}
                  defaultValue={triage.flagFromSenders.join(", ")}
                  placeholder="e.g. compliance@partner.com"
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-3">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  auto-archive senders
                  {liveBadge(INBOX_TRIAGE_SLUG, "autoArchiveSenders")}
                </span>
                <textarea
                  name="autoArchiveSenders"
                  rows={2}
                  defaultValue={triage.autoArchiveSenders.join(", ")}
                  placeholder="e.g. newsletter@noreply.com"
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <div className="sm:col-span-3">
                <ApHeritageButton variant="secondary" type="submit">
                  save
                </ApHeritageButton>
              </div>
            </form>
          </ApPaperCard>
        </li>

        <li>
          <ApPaperCard
            eyebrow={CHIEF_OF_STAFF_SLUG}
            title="Chief-of-staff scheduler"
          >
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Proposes meeting slots + reply drafts. Set the default
              meeting length and your business-hours window.
            </p>
            <form
              action={saveChiefOfStaffConfigAction}
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  default meeting length (min)
                  {liveBadge(CHIEF_OF_STAFF_SLUG, "defaultMeetingMinutes")}
                </span>
                <input
                  name="defaultMeetingMinutes"
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  defaultValue={scheduler.defaultMeetingMinutes}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  business hours start (24h)
                  {liveBadge(CHIEF_OF_STAFF_SLUG, "businessHoursStart")}
                </span>
                <input
                  name="businessHoursStart"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={scheduler.businessHoursStart}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  business hours end (24h)
                  {liveBadge(CHIEF_OF_STAFF_SLUG, "businessHoursEnd")}
                </span>
                <input
                  name="businessHoursEnd"
                  type="number"
                  min="1"
                  max="24"
                  defaultValue={scheduler.businessHoursEnd}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  buffer minutes between meetings
                  {liveBadge(CHIEF_OF_STAFF_SLUG, "bufferMinutes")}
                </span>
                <input
                  name="bufferMinutes"
                  type="number"
                  min="0"
                  max="120"
                  defaultValue={scheduler.bufferMinutes}
                  className="border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                />
              </label>
              <ApHeritageButton variant="secondary" type="submit">
                save
              </ApHeritageButton>
            </form>
          </ApPaperCard>
        </li>
      </ul>
    </div>
  );
}
