'use server';

/**
 * Server actions for the workspace pause (vacation/PTO) settings page.
 * BROKER_OWNER-gated. Encrypts the optional reason via the same v1
 * envelope the rest of the app uses for at-rest PII.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireWorkspaceMember } from '@/lib/auth';
import { withSystemContext } from '@/lib/db';
import { encrypt } from '@/lib/security/encryption';

const createPauseSchema = z.object({
  workspaceId: z.string().uuid(),
  pausedFrom: z
    .string()
    .min(1)
    .transform((s) => new Date(s)),
  pausedUntil: z
    .string()
    .min(1)
    .transform((s) => new Date(s)),
  pausedDisciplineIds: z.array(z.string()).default([]),
  reason: z.string().max(2000).optional(),
});

export interface CreatePauseResult {
  ok: boolean;
  error?: string;
  pauseId?: string;
}

export async function createWorkspacePause(
  input: z.input<typeof createPauseSchema>,
): Promise<CreatePauseResult> {
  const parsed = createPauseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;
  if (data.pausedUntil <= data.pausedFrom) {
    return { ok: false, error: 'pausedUntil must be after pausedFrom' };
  }
  const member = await requireWorkspaceMember(data.workspaceId, ['BROKER_OWNER']);

  const reasonEncrypted =
    data.reason && data.reason.trim().length > 0 ? encrypt(data.reason.trim()) : null;

  const row = await withSystemContext((tx) =>
    tx.workspacePauseConfig.create({
      data: {
        workspaceId: data.workspaceId,
        pausedFrom: data.pausedFrom,
        pausedUntil: data.pausedUntil,
        pausedDisciplineIds: data.pausedDisciplineIds,
        reasonEncrypted,
        createdByUserId: member.userId,
      },
    }),
  );

  revalidatePath(`/app/workspace/${data.workspaceId}/settings/pause`);
  revalidatePath(`/app/workspace/${data.workspaceId}`);
  return { ok: true, pauseId: row.id };
}

const deletePauseSchema = z.object({
  workspaceId: z.string().uuid(),
  pauseId: z.string().uuid(),
});

export async function deleteWorkspacePause(
  input: z.infer<typeof deletePauseSchema>,
): Promise<CreatePauseResult> {
  const parsed = deletePauseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid request' };
  await requireWorkspaceMember(parsed.data.workspaceId, ['BROKER_OWNER']);

  // Defense-in-depth: scope the delete by both id AND workspaceId so a
  // stray pauseId from another workspace cannot delete.
  await withSystemContext((tx) =>
    tx.workspacePauseConfig.deleteMany({
      where: {
        id: parsed.data.pauseId,
        workspaceId: parsed.data.workspaceId,
      },
    }),
  );
  revalidatePath(`/app/workspace/${parsed.data.workspaceId}/settings/pause`);
  revalidatePath(`/app/workspace/${parsed.data.workspaceId}`);
  return { ok: true };
}
