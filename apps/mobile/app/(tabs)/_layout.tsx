// App shell tab bar. Guards the group: anyone who reaches it without a session
// or without an active workspace is redirected back out. Registers for push
// permission on first mount (client-side stub — see src/push.ts).

import React, { useEffect } from "react";
import { Redirect, Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useAuth } from "../../src/auth/auth-context";
import { Loading } from "../../src/ui";
import { registerForPushNotificationsAsync } from "../../src/push";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const { status, activeWorkspaceId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Fire-and-forget: request permission, get the Expo token, and register
    // it with the backend so the approval-ready push can reach this device.
    void registerForPushNotificationsAsync();
  }, []);

  // Tapping an approval-ready push lands the owner on the approvals tab —
  // the "7am push → tap approve" path made real.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as
        | { type?: string }
        | undefined;
      if (data?.type === "approval") {
        router.navigate("/(tabs)/approvals");
      }
    });
    return () => sub.remove();
  }, [router]);

  if (status === "loading") return <Loading />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (!activeWorkspaceId) return <Redirect href="/select-workspace" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.paperRaised,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Briefings",
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plaino"
        options={{
          title: "Plaino",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="integrations"
        options={{
          title: "Integrations",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
