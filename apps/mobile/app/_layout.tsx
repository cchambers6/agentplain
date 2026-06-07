// Root layout. Mounts the providers every screen depends on (safe-area,
// gesture handler, auth) and a single Stack. Route groups below it:
//   index            — boot gate, redirects by auth state
//   sign-in          — magic-link request (signed-out)
//   auth/callback    — deep-link token exchange (agentplain://auth/callback)
//   select-workspace — workspace picker (signed-in, no active workspace)
//   (tabs)           — the app shell (briefings / approvals / plaino / integrations)

import "react-native-gesture-handler";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/auth-context";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
