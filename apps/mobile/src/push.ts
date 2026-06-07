// Push notification registration (client half).
//
// Requests the OS notification permission, obtains the Expo push token on a
// physical device, and registers it with the backend
// (POST /api/mobile/push/register) so the approval-ready trigger can fan out
// to this device. The server half lives in lib/push; the device row is keyed
// by the Expo token so re-registering is idempotent.
//
// Must be called only when signed in (the register call is bearer-authed).

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

// Foreground-notification presentation: show the banner even while the app is
// open so the "tap to review" affordance is consistent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The EAS project id powers getExpoPushTokenAsync in standalone builds.
 *  Until an EAS project is created the committed value is a placeholder —
 *  we treat that as "not configured" and skip token fetch rather than throw. */
function easProjectId(): string | undefined {
  const id = (Constants.expoConfig?.extra as { eas?: { projectId?: string } })
    ?.eas?.projectId;
  if (!id || id === "REPLACE_WITH_EAS_PROJECT_ID") return undefined;
  return id;
}

/**
 * Request permission, get the Expo push token, and register it with the
 * backend. Returns the token (or null if unavailable / denied / not a
 * physical device). Best-effort — never throws into the caller's render path.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Simulators/emulators can't get a real push token.
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = easProjectId();
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoPushToken = token.data;

    // Register with the backend so the approval trigger can reach this device.
    try {
      await api.registerPushDevice({
        expoPushToken,
        platform: Platform.OS === "android" ? "android" : "ios",
        deviceName: Device.deviceName ?? undefined,
      });
    } catch {
      // A registration failure (offline, transient) must not break the app —
      // the token is re-registered on the next foreground.
    }

    return expoPushToken;
  } catch {
    return null;
  }
}
