'use server';

/**
 * Server actions for the per-discipline approver routing page.
 *
 * The DisciplineHead model (wave-6) lets a workspace nominate one
 * specific user as the required approver for every new approval-queue
 * item in a given discipline. Until a head is assigned, the discipline
 * routes the same way it always has — any qualified member can
 * approve. This page covers assignment + unassignment.
 *
 * Owner-only (canPerform 'discipline.head.assign') per
 * `lib/auth/roles.ts`. The page-level gate already redirects non-owners
 * to `/app`, but server actions defend in depth.
 *
 * HONEST CONCESSION: the runtime escalation cron — "if the head hasn't
 * acted in N days, fall back to the owner" — is queued for wave 7.
 * Today, assigning a head and then having them go on vacation will
 * pile items up until the head returns or the head is reassigned.
 * The settings page makes this explicit so the customer can plan.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireWorkspaceMember } from '@/lib/auth';
import { canPerform } from '@/lib/auth/roles';
import { asDisciplineId } from '@/lib/disciplines';
import { withSystemContext } from '@/lib/db';

const assignSchema = z.object({
  workspaceId: z.string().uuid(),
  discipline: z.string().min(1),
  userId: z.string().uuid(),
});

const unassignSchema = z.object({
  workspaceId: z.string().uuid(),
  discipline: z.string().min(1),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Assign — or reassign — a head for `discipline`. Idempotent on the
 * (workspaceId, discipline) unique index; reassignment overwrites in
 * place + bumps assignedAt.
 */
export async function assignDisciplineHead(
  input: z.input<typeof assignSchema>,
): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const discipline = asDisciplineId(data.discipline);
  if (!discipline) {
    return { ok: false, error: `unknown discipline: ${data.discipline}` };
  }

  const member = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
  ]);
  if (!canPerform(member.role, 'discipline.head.assign')) {
    // Belt + suspenders — requireWorkspaceMember already filtered, but
    // the policy table is the source of truth for the action.
    return { ok: false, error: 'forbidden' };
  }

  // Confirm the target user is a member of this workspace. We don't
  // want owners assigning random user-ids as heads.
  const targetMembership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        status: 'ACTIVE',
      },
    }),
  );
  if (!targetMembership) {
    return { ok: false, error: 'target user is not an active member of this workspace' };
  }

  await withSystemContext((tx) =>
    tx.disciplineHead.upsert({
      where: {
        workspaceId_discipline: {
          workspaceId: data.workspaceId,
          discipline,
        },
      },
      create: {
        workspaceId: data.workspaceId,
        discipline,
        userId: data.userId,
        assignedByUserId: member.userId,
      },
      update: {
        userId: data.userId,
        assignedAt: new Date(),
        assignedByUserId: member.userId,
      },
    }),
  );

  revalidatePath(`/app/workspace/${data.workspaceId}/settings/discipline-heads`);
  return { ok: true };
}

/** Unassign the head for a discipline — routing returns to "any qualified member". */
export async function unassignDisciplineHead(
  input: z.input<typeof unassignSchema>,
): Promise<ActionResult> {
  const parsed = unassignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const discipline = asDisciplineId(data.discipline);
  if (!discipline) {
    return { ok: false, error: `unknown discipline: ${data.discipline}` };
  }

  const member = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
  ]);
  if (!canPerform(member.role, 'discipline.head.assign')) {
    return { ok: false, error: 'forbidden' };
  }

  await withSystemContext((tx) =>
    tx.disciplineHead.deleteMany({
      where: { workspaceId: data.workspaceId, discipline },
    }),
  );

  revalidatePath(`/app/workspace/${data.workspaceId}/settings/discipline-heads`);
  return { ok: true };
}
