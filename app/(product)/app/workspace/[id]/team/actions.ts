'use server';

/**
 * Server actions for the team-members page (item 9 of the 2026-06-17
 * strategic build): invite, set role, remove, and generate a new-hire
 * playbook.
 *
 * Authorization is defense-in-depth: the page gate already filters to
 * managers+ for the management view, but every mutation re-checks the
 * action policy (`lib/auth/roles.ts`) against the live membership. The
 * key escalation guard — assigning or changing an ADMIN/OWNER seat —
 * requires the OWNER tier (`roster.write.owner`); plain invites + role
 * changes among MEMBER/VIEWER need only ADMIN (`roster.write`).
 *
 * INVITE ACCEPTANCE IS PARKED (see TODOs-FOR-CONNER): this creates the
 * Membership in `INVITED` status with the inviter recorded, but the
 * magic-link / SSO acceptance flow is a Conner decision. An invited row
 * is inert until acceptance lands — it shows on the roster as "invited"
 * and grants nothing until the user actually signs in.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma, Role } from '@prisma/client';
import { requireWorkspaceMember } from '@/lib/auth';
import { canPerform, asRoleTier, RoleTier } from '@/lib/auth/roles';
import { withSystemContext } from '@/lib/db';
import { servicePartnerForWorkspace } from '@/lib/onboarding/service-partner';
import { generatePlaybookForWorkspace } from '@/lib/team/playbook-generator';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ASSIGNABLE_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;

const inviteSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  role: z.enum(ASSIGNABLE_ROLES),
});

const setRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
});

const removeSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

const playbookSchema = z.object({
  workspaceId: z.string().uuid(),
  newHirePresetKey: z.string().trim().max(64).optional(),
});

/**
 * True if `actorRole` is allowed to grant/manage `targetRole`. Managing an
 * ADMIN/OWNER seat needs the OWNER tier; MEMBER/VIEWER need ADMIN.
 */
function canManageTargetRole(actorRole: Role, targetRole: Role): boolean {
  if (asRoleTier(targetRole) >= RoleTier.ADMIN) {
    return canPerform(actorRole, 'roster.write.owner');
  }
  return canPerform(actorRole, 'roster.write');
}

function revalidate(workspaceId: string): void {
  revalidatePath(`/app/workspace/${workspaceId}/team`);
}

/** Invite a teammate. Creates (or links) the user + an INVITED membership. */
export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const actor = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
    'ADMIN',
  ]);
  if (!canManageTargetRole(actor.role, data.role)) {
    return { ok: false, error: 'You do not have permission to invite at that role.' };
  }

  const email = data.email.toLowerCase();

  return withSystemContext(async (tx) => {
    const user =
      (await tx.user.findUnique({ where: { email } })) ??
      (await tx.user.create({
        data: { email, name: data.name?.trim() || null },
      }));

    const existing = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: data.workspaceId } },
    });
    if (existing && existing.status !== 'DEACTIVATED') {
      return { ok: false, error: 'That person is already on this workspace.' };
    }

    if (existing) {
      // Re-invite a previously removed member: reactivate as INVITED.
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role: data.role,
          status: 'INVITED',
          removedAt: null,
          invitedByUserId: actor.userId,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: data.workspaceId,
          role: data.role,
          status: 'INVITED',
          invitedByUserId: actor.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId,
        workspaceId: data.workspaceId,
        action: 'roster.invited',
        targetTable: 'Membership',
        targetId: user.id,
        payload: { email, role: data.role } satisfies Prisma.InputJsonValue,
      },
    });

    revalidate(data.workspaceId);
    return { ok: true };
  });
}

/** Change a member's role. Cannot demote the last owner. */
export async function setMemberRole(
  input: z.input<typeof setRoleSchema>,
): Promise<ActionResult> {
  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const actor = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
    'ADMIN',
  ]);

  return withSystemContext(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: data.userId, workspaceId: data.workspaceId } },
    });
    if (!target) return { ok: false, error: 'That member is not on this workspace.' };

    // Need authority over BOTH the current and the new role tier.
    if (
      !canManageTargetRole(actor.role, target.role) ||
      !canManageTargetRole(actor.role, data.role)
    ) {
      return { ok: false, error: 'You do not have permission to change that role.' };
    }

    // Guard the last owner: don't let the final OWNER be demoted.
    if (
      asRoleTier(target.role) === RoleTier.OWNER &&
      asRoleTier(data.role) < RoleTier.OWNER
    ) {
      const owners = await tx.membership.count({
        where: {
          workspaceId: data.workspaceId,
          status: { in: ['ACTIVE', 'INVITED'] },
          removedAt: null,
          role: { in: ['OWNER', 'BROKER_OWNER'] },
        },
      });
      if (owners <= 1) {
        return { ok: false, error: 'A workspace must keep at least one owner.' };
      }
    }

    await tx.membership.update({
      where: { id: target.id },
      data: { role: data.role },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId,
        workspaceId: data.workspaceId,
        action: 'roster.role_changed',
        targetTable: 'Membership',
        targetId: data.userId,
        payload: { from: target.role, to: data.role } satisfies Prisma.InputJsonValue,
      },
    });

    revalidate(data.workspaceId);
    return { ok: true };
  });
}

/** Remove a member (soft — status DEACTIVATED + removedAt). */
export async function removeMember(
  input: z.input<typeof removeSchema>,
): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const actor = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
    'ADMIN',
  ]);

  return withSystemContext(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: data.userId, workspaceId: data.workspaceId } },
    });
    if (!target || target.status === 'DEACTIVATED') {
      return { ok: false, error: 'That member is not on this workspace.' };
    }
    if (!canManageTargetRole(actor.role, target.role)) {
      return { ok: false, error: 'You do not have permission to remove that member.' };
    }

    // Guard the last owner.
    if (asRoleTier(target.role) === RoleTier.OWNER) {
      const owners = await tx.membership.count({
        where: {
          workspaceId: data.workspaceId,
          status: { in: ['ACTIVE', 'INVITED'] },
          removedAt: null,
          role: { in: ['OWNER', 'BROKER_OWNER'] },
        },
      });
      if (owners <= 1) {
        return { ok: false, error: 'A workspace must keep at least one owner.' };
      }
    }

    await tx.membership.update({
      where: { id: target.id },
      data: { status: 'DEACTIVATED', removedAt: new Date() },
    });

    // Clean up any DisciplineHead routing pointed at the removed member so
    // work doesn't pile up on someone who's gone.
    await tx.disciplineHead.deleteMany({
      where: { workspaceId: data.workspaceId, userId: data.userId },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId,
        workspaceId: data.workspaceId,
        action: 'roster.removed',
        targetTable: 'Membership',
        targetId: data.userId,
        payload: { role: target.role } satisfies Prisma.InputJsonValue,
      },
    });

    revalidate(data.workspaceId);
    return { ok: true };
  });
}

export interface PlaybookResult extends ActionResult {
  /** The generated markdown, when ok. */
  markdown?: string;
  /** Suggested download filename. */
  filename?: string;
}

/** Generate a new-hire onboarding playbook from the team's own patterns. */
export async function generateTeamPlaybook(
  input: z.input<typeof playbookSchema>,
): Promise<PlaybookResult> {
  const parsed = playbookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const data = parsed.data;

  const actor = await requireWorkspaceMember(data.workspaceId, [
    'BROKER_OWNER',
    'OWNER',
    'ADMIN',
  ]);
  if (!canPerform(actor.role, 'roster.write')) {
    return { ok: false, error: 'forbidden' };
  }

  const ctx = { userId: actor.userId, workspaceId: data.workspaceId, isOperator: false };
  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: data.workspaceId },
      select: { name: true, vertical: true, slug: true },
    }),
  );
  if (!workspace) return { ok: false, error: 'Workspace not found.' };

  const markdown = await generatePlaybookForWorkspace(ctx, {
    workspaceId: data.workspaceId,
    workspaceName: workspace.name,
    partnerName: servicePartnerForWorkspace(data.workspaceId),
    vertical: workspace.vertical,
    newHirePresetKey: data.newHirePresetKey,
  });

  return {
    ok: true,
    markdown,
    filename: `${workspace.slug}-onboarding-playbook.md`,
  };
}
