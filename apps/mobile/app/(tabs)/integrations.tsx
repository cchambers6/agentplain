// Integration marketplace — V1 STUB.
//
// The connect/OAuth flows live on the web (each provider integration sits
// behind a lib/integrations/ adapter per the portability rule). The mobile
// marketplace will surface connection STATUS and deep-link to the web connect
// flow rather than re-implement OAuth redirects in the app — but that needs a
// /api/mobile/workspace/:id/integrations status route, which is a follow-up.
// Until then this is a labeled placeholder, plus a sign-out affordance so the
// shell is fully exercisable end to end.

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/auth-context";
import { Body, Caption, Eyebrow, H1 } from "../../src/ui";
import { colors, space } from "../../src/theme";

export default function Integrations() {
  const { me, signOut } = useAuth();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>Integrations</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Marketplace</H1>
      </View>
      <View style={styles.center}>
        <Ionicons name="grid-outline" size={40} color={colors.clay} />
        <Body soft style={{ marginTop: space.lg, textAlign: "center" }}>
          Connect your tools from the web for now.
        </Body>
        <Caption style={{ marginTop: space.sm, textAlign: "center" }}>
          The in-app marketplace will show connection status and hand off to the
          secure web connect flow.
        </Caption>
      </View>
      <View style={styles.footer}>
        {me ? <Caption style={{ marginBottom: space.md }}>Signed in as {me.user.email}</Caption> : null}
        <Pressable onPress={signOut}>
          <Caption style={{ color: colors.clay }}>Sign out</Caption>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl },
  footer: { alignItems: "center", paddingBottom: space.xl },
});
