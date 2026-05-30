"use server";

// Wave-2 per-skill config — server actions for the three skills the
// runtime caller honors today. The actions normalize the form values
// and delegate to `lib/skills/config#writeSkillConfig`, which encrypts
// the JSON body before write.

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import {
  CHIEF_OF_STAFF_SLUG,
  DEFAULT_CHIEF_OF_STAFF_CONFIG,
  DEFAULT_FOLLOW_UP_CHASER_CONFIG,
  DEFAULT_INBOX_TRIAGE_CONFIG,
  FOLLOW_UP_CHASER_SLUG,
  INBOX_TRIAGE_SLUG,
  writeSkillConfig,
} from "@/lib/skills/config";

function intInRange(
  raw: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof raw !== "string") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function commaList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 100);
}

function oneOf<T extends readonly string[]>(
  raw: FormDataEntryValue | null,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof raw !== "string") return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T[number]) : fallback;
}

export async function saveFollowUpChaserConfigAction(
  form: FormData,
): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!workspaceId) throw new Error("missing workspaceId");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await writeSkillConfig({
    workspaceId,
    skillSlug: FOLLOW_UP_CHASER_SLUG,
    config: {
      staleAfterDays: intInRange(
        form.get("staleAfterDays"),
        DEFAULT_FOLLOW_UP_CHASER_CONFIG.staleAfterDays,
        1,
        90,
      ),
      maxNudgesPerRun: intInRange(
        form.get("maxNudgesPerRun"),
        DEFAULT_FOLLOW_UP_CHASER_CONFIG.maxNudgesPerRun,
        1,
        100,
      ),
      nudgeTone: oneOf(
        form.get("nudgeTone"),
        ["professional", "warm", "firm"] as const,
        DEFAULT_FOLLOW_UP_CHASER_CONFIG.nudgeTone,
      ),
    },
    configuredByUserId: member.userId,
  });
  revalidatePath(`/app/workspace/${workspaceId}/settings/skills`);
}

export async function saveInboxTriageConfigAction(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!workspaceId) throw new Error("missing workspaceId");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await writeSkillConfig({
    workspaceId,
    skillSlug: INBOX_TRIAGE_SLUG,
    config: {
      priorityKeywords: commaList(form.get("priorityKeywords")),
      flagFromSenders: commaList(form.get("flagFromSenders")),
      autoArchiveSenders: commaList(form.get("autoArchiveSenders")),
    },
    configuredByUserId: member.userId,
  });
  revalidatePath(`/app/workspace/${workspaceId}/settings/skills`);
}

export async function saveChiefOfStaffConfigAction(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!workspaceId) throw new Error("missing workspaceId");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const start = intInRange(
    form.get("businessHoursStart"),
    DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursStart,
    0,
    23,
  );
  const endRaw = intInRange(
    form.get("businessHoursEnd"),
    DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursEnd,
    1,
    24,
  );
  const end = endRaw > start ? endRaw : DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursEnd;
  await writeSkillConfig({
    workspaceId,
    skillSlug: CHIEF_OF_STAFF_SLUG,
    config: {
      defaultMeetingMinutes: intInRange(
        form.get("defaultMeetingMinutes"),
        DEFAULT_CHIEF_OF_STAFF_CONFIG.defaultMeetingMinutes,
        5,
        240,
      ),
      businessHoursStart: start,
      businessHoursEnd: end,
      bufferMinutes: intInRange(
        form.get("bufferMinutes"),
        DEFAULT_CHIEF_OF_STAFF_CONFIG.bufferMinutes,
        0,
        120,
      ),
    },
    configuredByUserId: member.userId,
  });
  revalidatePath(`/app/workspace/${workspaceId}/settings/skills`);
}
