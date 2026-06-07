// Approval-ready push trigger.
//
// Called server-side AFTER a WorkApprovalQueueItem lands PENDING (see
// lib/skills/persist-artifacts). This is the "7am push → tap approve"
// pipeline: when the overnight fleet queues work, the owner's phone lights
// up. The trigger reads durable state on every fire (no cache) per
// feedback_cold_start_safe_agents, and is fully best-effort — a push failure
// must NEVER affect the work it was announcing, so the only call site wraps
// this in a fire-and-forget with its own catch.
//
// Targeting: if the item is routed to a specific DisciplineHead
// (requiredApproverUserId), only that person is notified; otherwise every
// ACTIVE BROKER_OWNER of the workspace is. This mirrors who the /approvals
// page lets decide.

import { withSystemContext } from "../db/rls";
import { getPushProvider } from "./provider";
import { disableDeviceByToken, listEnabledDevicesForUsers } from "./devices";

export interface NotifyApprovalInput {
  workspaceId: string;
  /** How many items just landed (for "3 approvals ready" copy). Default 1. */
  count?: number;
  /** When set, only this user is notified (routed DisciplineHead). */
  requiredApproverUserId?: string | null;
}

/** Resolve who should be pinged for a workspace's pending approvals. */
async function resolveRecipients(input: NotifyApprovalInput): Promise<string[]> {
  if (input.requiredApproverUserId) return [input.requiredApproverUserId];
  const members = await withSystemContext((tx) =>
    tx.membership.findMany({
      where: { workspaceId: input.workspaceId, role: "BROKER_OWNER", status: "ACTIVE" },
      select: { userId: true },
    }),
  );
  return members.map((m) => m.userId);
}

function approvalCopy(count: number): { title: string; body: string } {
  if (count > 1) {
    return {
      title: "New approvals ready",
      body: `${count} drafts are waiting on you — tap to review.`,
    };
  }
  return {
    title: "New approval ready",
    body: "A draft is waiting on you — tap to review.",
  };
}

/**
 * Fan a push out to the owner(s) who can approve workspace work. Returns the
 * number of devices successfully pinged (0 when nobody has a device, or on
 * any failure). Never throws.
 */
export async function notifyApprovalQueued(
  input: NotifyApprovalInput,
): Promise<number> {
  try {
    const userIds = await resolveRecipients(input);
    if (userIds.length === 0) return 0;

    const devices = await listEnabledDevicesForUsers(userIds);
    if (devices.length === 0) return 0;

    const { title, body } = approvalCopy(input.count ?? 1);
    const tickets = await getPushProvider().send(
      devices.map((d) => ({
        to: d.expoPushToken,
        title,
        body,
        // The app routes on tap: open the approvals tab for this workspace.
        data: { type: "approval", workspaceId: input.workspaceId },
      })),
    );

    // Evict dead tokens so we stop fanning out to uninstalled devices.
    await Promise.all(
      tickets
        .filter((t) => !t.ok && t.error === "DeviceNotRegistered")
        .map((t) => disableDeviceByToken(t.token).catch(() => {})),
    );

    return tickets.filter((t) => t.ok).length;
  } catch {
    // Best-effort: a notification problem is never allowed to surface.
    return 0;
  }
}
