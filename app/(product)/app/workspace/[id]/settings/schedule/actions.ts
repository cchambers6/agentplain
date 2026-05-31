'use server';

/**
 * Server actions for the per-skill scheduling-window settings page.
 * BROKER_OWNER-gated. Upserts (workspaceId, skillSlug) so the customer
 * can edit an existing window without first deleting it.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireWorkspaceMember } from '@/lib/auth';
import { withSystemContext } from '@/lib/db';

const setWindowSchema = z.object({
  workspaceId: z.string().uuid(),
  skillSlug: z.string().min(1).max(64),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  startHourLocal: z.number().int().min(0).max(23),
  endHourLocal: z.number().int().min(0).max(23),
  workspaceTimezone: z.string().min(1).max(64),
});

export interface SetWindowResult {
  ok: boolean;
  error?: string;
  windowId?: string;
}

export async function setSkillScheduleWindow(
  input: z.infer<typeof setWindowSchema>,
): Promise<SetWindowResult> {
  const parsed = setWindowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;
  if (data.startHourLocal === data.endHourLocal) {
    return {
      ok: false,
      error: 'startHour and endHour must differ (a degenerate window blocks every fire).',
    };
  }
  // Validate the TZ is actually recognized so we don't silently store a typo.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: data.workspaceTimezone });
  } catch {
    return { ok: false, error: `unknown IANA timezone: ${data.workspaceTimezone}` };
  }

  const member = await requireWorkspaceMember(data.workspaceId, ['BROKER_OWNER']);

  const row = await withSystemContext((tx) =>
    tx.skillScheduleWindow.upsert({
      where: {
        workspaceId_skillSlug: {
          workspaceId: data.workspaceId,
          skillSlug: data.skillSlug,
        },
      },
      create: {
        workspaceId: data.workspaceId,
        skillSlug: data.skillSlug,
        daysOfWeek: data.daysOfWeek,
        startHourLocal: data.startHourLocal,
        endHourLocal: data.endHourLocal,
        workspaceTimezone: data.workspaceTimezone,
        configuredByUserId: member.userId,
      },
      update: {
        daysOfWeek: data.daysOfWeek,
        startHourLocal: data.startHourLocal,
        endHourLocal: data.endHourLocal,
        workspaceTimezone: data.workspaceTimezone,
        configuredByUserId: member.userId,
      },
    }),
  );

  revalidatePath(`/app/workspace/${data.workspaceId}/settings/schedule`);
  return { ok: true, windowId: row.id };
}

const removeWindowSchema = z.object({
  workspaceId: z.string().uuid(),
  skillSlug: z.string().min(1).max(64),
});

export async function removeSkillScheduleWindow(
  input: z.infer<typeof removeWindowSchema>,
): Promise<SetWindowResult> {
  const parsed = removeWindowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid request' };
  await requireWorkspaceMember(parsed.data.workspaceId, ['BROKER_OWNER']);

  await withSystemContext((tx) =>
    tx.skillScheduleWindow.deleteMany({
      where: {
        workspaceId: parsed.data.workspaceId,
        skillSlug: parsed.data.skillSlug,
      },
    }),
  );
  revalidatePath(`/app/workspace/${parsed.data.workspaceId}/settings/schedule`);
  return { ok: true };
}
