// PushDevice store helpers.
//
// One row per physical device, keyed by its Expo push token. Registration
// runs under the signed-in user's RLS context (the user owns their devices);
// the fan-out reads + disables run under withSystemContext because the
// approval trigger fires server-side with no session (mirrors the briefing
// fan-out).

import { withRls, withSystemContext } from "../db/rls";

/** A valid Expo push token looks like `ExponentPushToken[...]` or
 *  `ExpoPushToken[...]`. We validate loosely — Expo owns the exact format —
 *  but reject obvious garbage so a malformed token never lands in the table. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.trim());
}

export interface RegisterDeviceInput {
  userId: string;
  expoPushToken: string;
  platform: string;
  deviceName?: string | null;
}

/**
 * Upsert a device for the signed-in user. Keyed by the Expo token so a
 * reinstall (same token) updates in place — never a duplicate row delivering
 * twice. If the token was previously registered to a DIFFERENT user (a shared
 * device handed off, or a reused simulator token), it is reassigned to the
 * current user and re-enabled. Returns the device row id.
 */
export async function registerPushDevice(
  input: RegisterDeviceInput,
): Promise<{ id: string }> {
  const ctx = { userId: input.userId, workspaceId: null, isOperator: false };
  const platform = input.platform === "android" ? "android" : "ios";
  return withRls(ctx, async (tx) => {
    const created = await tx.pushDevice.upsert({
      where: { expoPushToken: input.expoPushToken },
      create: {
        userId: input.userId,
        expoPushToken: input.expoPushToken,
        platform,
        deviceName: input.deviceName ?? null,
        enabled: true,
        lastUsedAt: new Date(),
      },
      update: {
        userId: input.userId,
        platform,
        deviceName: input.deviceName ?? null,
        enabled: true,
        lastUsedAt: new Date(),
      },
      select: { id: true },
    });
    return created;
  });
}

/** Mark a token disabled after Expo reports it DeviceNotRegistered. Runs as
 *  system context — the fan-out has no session. Best-effort. */
export async function disableDeviceByToken(token: string): Promise<void> {
  await withSystemContext((tx) =>
    tx.pushDevice.updateMany({
      where: { expoPushToken: token },
      data: { enabled: false },
    }),
  );
}

export interface EnabledDevice {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: string;
}

/** All enabled devices for a set of users. System context — the approval
 *  trigger fans out across an owner's devices without a session. */
export async function listEnabledDevicesForUsers(
  userIds: string[],
): Promise<EnabledDevice[]> {
  if (userIds.length === 0) return [];
  return withSystemContext((tx) =>
    tx.pushDevice.findMany({
      where: { userId: { in: userIds }, enabled: true },
      select: { id: true, userId: true, expoPushToken: true, platform: true },
    }),
  );
}
