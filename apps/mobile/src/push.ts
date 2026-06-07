// Push notification registration — V1 STUB (client half only).
//
// This requests the OS notification permission and obtains the Expo push token
// on a physical device. It deliberately stops there: there is NO backend route
// to register a device token against a workspace yet, and no server-side send
// path (agentplain is no-outbound from the agent surface — push fan-out, when
// built, runs from the customer/notification system, not an agent). Wiring the
// token to a `POST /api/mobile/push/register` endpoint + a briefing/approval
// notification trigger is the tracked follow-up.
//
// Returns the token (or null) so a caller can log it during bring-up; nothing
// consumes it yet.

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function registerForPushNotificationsAsync(): Promise<string | null> {
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
  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}
