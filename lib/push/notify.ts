// Approval-ready notification trigger — push AND email.
//
// Called server-side AFTER a WorkApprovalQueueItem lands PENDING (call
// sites: lib/skills/persist-artifacts for the inbox chain, and
// lib/skills/lead-triage-realestate/prisma-approval-sink for the CRM
// lead-triage path — pilot dry-run 2026-07-11 P0-1 found the sink never
// notified). The trigger reads durable state on every fire (no cache) per
// feedback_cold_start_safe_agents, and is fully best-effort — a
// notification failure must NEVER affect the work it was announcing.
//
// Channels:
//   - EMAIL (lib/email, Resend) — the channel the partner actually has.
//     Per-partner delivery preference (WorkspacePreference.
//     approvalEmailMode): 'always' (default) sends day or night — the
//     after-hours ping is the sold premise; 'business_hours' holds
//     after-hours pings for the weekday-morning digest sweep; 'digest'
//     never sends immediately. Held pings are delayed, never lost — the
//     approval-digest sweep covers them.
//   - PUSH (Expo) — kept, but never relied on alone: the mobile app has
//     not shipped, so zero registered devices is the normal case.
//
// Targeting: if the item is routed to a specific DisciplineHead
// (requiredApproverUserId), only that person is notified; otherwise every
// ACTIVE BROKER_OWNER of the workspace is. This mirrors who the /approvals
// page lets decide.

import type { Prisma } from "@prisma/client";
import { withSystemContext as defaultWithSystemContext } from "../db/rls";
import { getEmailProvider } from "../email";
import type { EmailProvider } from "../email";
import { env } from "../env";
import { servicePartnerForWorkspace } from "../onboarding/service-partner";
import {
  asApprovalEmailMode,
  decideApprovalEmailDelivery,
  renderApprovalReadyEmail,
} from "../notifications/approval-ready-email";
import { getPushProvider } from "./provider";
import {
  disableDeviceByToken,
  listEnabledDevicesForUsers,
} from "./devices";

export interface NotifyApprovalInput {
  workspaceId: string;
  /** How many items just landed (for "3 drafts are waiting" copy). Default 1. */
  count?: number;
  /** When set, only this user is notified (routed DisciplineHead). */
  requiredApproverUserId?: string | null;
}

type SystemContextRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

/** DI seam for tests — every dependency that touches the outside world.
 *  Production call sites pass nothing. */
export interface NotifyApprovalDeps {
  systemContext?: SystemContextRunner;
  email?: EmailProvider;
  /** Device lookup override (the default reads PushDevice rows). */
  listDevices?: typeof listEnabledDevicesForUsers;
  appOrigin?: string;
  now?: Date;
}

export interface NotifyApprovalResult {
  /** Devices successfully pinged (0 when nobody has a device). */
  pushesDelivered: number;
  /** Emails handed to the provider this call. */
  emailsSent: number;
  /** Emails held for the weekday-morning digest per the partner's
   *  preference (business_hours after hours, or digest mode). */
  emailsHeldForDigest: number;
}

const NO_NOTIFY: NotifyApprovalResult = {
  pushesDelivered: 0,
  emailsSent: 0,
  emailsHeldForDigest: 0,
};

interface NotifyTarget {
  userId: string;
  email: string | null;
}

interface WorkspaceNotifyState {
  workspaceName: string;
  approvalEmailMode: string | null;
  targets: NotifyTarget[];
}

/** Resolve the workspace's name, email preference, and who should be
 *  pinged — one durable read per fire (cold-start safe). */
async function loadNotifyState(
  systemContext: SystemContextRunner,
  input: NotifyApprovalInput,
): Promise<WorkspaceNotifyState | null> {
  return systemContext(async (tx) => {
    const ws = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: {
        name: true,
        preference: { select: { approvalEmailMode: true } },
        memberships: {
          where: input.requiredApproverUserId
            ? { userId: input.requiredApproverUserId, status: "ACTIVE" }
            : { role: "BROKER_OWNER", status: "ACTIVE" },
          select: { userId: true, user: { select: { email: true } } },
        },
      },
    });
    if (!ws) return null;
    return {
      workspaceName: ws.name,
      approvalEmailMode: ws.preference?.approvalEmailMode ?? null,
      targets: ws.memberships.map((m) => ({
        userId: m.userId,
        email: m.user.email ?? null,
      })),
    };
  });
}

function approvalPushCopy(count: number): { title: string; body: string } {
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
 * Fan an approval-ready notification out to the owner(s) who can approve
 * workspace work — push to registered devices AND email per the partner's
 * preference. Never throws; every failure degrades to a zero count.
 */
export async function notifyApprovalQueued(
  input: NotifyApprovalInput,
  deps: NotifyApprovalDeps = {},
): Promise<NotifyApprovalResult> {
  try {
    const systemContext = deps.systemContext ?? defaultWithSystemContext;
    const now = deps.now ?? new Date();
    const count = input.count ?? 1;

    const state = await loadNotifyState(systemContext, input);
    if (!state || state.targets.length === 0) return NO_NOTIFY;

    // ── Push (best-effort; the app has not shipped, so 0 devices is normal).
    const pushesDelivered = await sendPush(
      state.targets.map((t) => t.userId),
      count,
      input.workspaceId,
      deps,
    ).catch(() => 0);

    // ── Email — the channel the partner actually has.
    let emailsSent = 0;
    let emailsHeldForDigest = 0;
    const recipients = state.targets
      .map((t) => t.email)
      .filter((e): e is string => typeof e === "string" && e.length > 0);
    if (recipients.length > 0) {
      const mode = asApprovalEmailMode(state.approvalEmailMode);
      const delivery = decideApprovalEmailDelivery(mode, now);
      if (delivery === "hold_for_digest") {
        // Held, not lost: the item stays PENDING and the weekday-morning
        // approval-digest sweep emails a summary of everything waiting.
        emailsHeldForDigest = recipients.length;
      } else {
        const origin = (deps.appOrigin ?? env.appPublicOrigin()).replace(
          /\/$/,
          "",
        );
        const rendered = renderApprovalReadyEmail({
          count,
          workspaceName: state.workspaceName,
          partner: servicePartnerForWorkspace(input.workspaceId),
          approvalsUrl: `${origin}/app/workspace/${input.workspaceId}/approvals`,
          flavor: "immediate",
        });
        const email = deps.email ?? getEmailProvider();
        for (const to of recipients) {
          try {
            await email.send({
              to,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              tags: {
                kind: "approval_ready",
                workspace_id: input.workspaceId,
              },
            });
            emailsSent += 1;
          } catch {
            // One bad recipient must not block the others.
          }
        }
      }
    }

    return { pushesDelivered, emailsSent, emailsHeldForDigest };
  } catch {
    // Best-effort: a notification problem is never allowed to surface.
    return NO_NOTIFY;
  }
}

async function sendPush(
  userIds: string[],
  count: number,
  workspaceId: string,
  deps: NotifyApprovalDeps,
): Promise<number> {
  const listDevices = deps.listDevices ?? listEnabledDevicesForUsers;
  const devices = await listDevices(userIds);
  if (devices.length === 0) return 0;

  const { title, body } = approvalPushCopy(count);
  const tickets = await getPushProvider().send(
    devices.map((d) => ({
      to: d.expoPushToken,
      title,
      body,
      // The app routes on tap: open the approvals tab for this workspace.
      data: { type: "approval", workspaceId },
    })),
  );

  // Evict dead tokens so we stop fanning out to uninstalled devices.
  await Promise.all(
    tickets
      .filter((t) => !t.ok && t.error === "DeviceNotRegistered")
      .map((t) => disableDeviceByToken(t.token).catch(() => {})),
  );

  return tickets.filter((t) => t.ok).length;
}
