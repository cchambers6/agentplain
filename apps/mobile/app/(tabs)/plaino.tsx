// Talk-to-Plaino chat — V1 STUB.
//
// The web app already has the two-surface Plaino chat over /api/chat (see
// project_plaino_chatbot_two_surfaces / PR #154). The native chat will reuse
// that same `mode: "support"` backbone, but the streaming transport + message
// UI is its own reviewed PR. This screen is an honest placeholder, not a
// half-wired chat, so the tab is navigable without dead input.

import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Body, Caption, Eyebrow, H1 } from "../../src/ui";
import { colors, space } from "../../src/theme";

export default function Plaino() {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>Plaino</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Talk to Plaino</H1>
      </View>
      <View style={styles.center}>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.clay} />
        <Body soft style={{ marginTop: space.lg, textAlign: "center" }}>
          Chat with Plaino is coming to mobile next.
        </Body>
        <Caption style={{ marginTop: space.sm, textAlign: "center" }}>
          It will run on the same support backbone as the web assistant.
        </Caption>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl },
});
