// Workspace selector (V1 screen #2).
//
// Lists the workspaces the signed-in owner has (from /api/mobile/me, already
// loaded into the auth context). Picking one sets the client-side active
// workspace and enters the app shell. Auto-skipped by the boot gate when the
// owner has exactly one workspace.

import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/auth-context";
import { Body, Caption, Eyebrow, H1, Loading, Pill } from "../src/ui";
import { colors, radius, space } from "../src/theme";

export default function SelectWorkspace() {
  const router = useRouter();
  const { me, selectWorkspace, signOut } = useAuth();

  if (!me) return <Loading />;

  const pick = (id: string) => {
    selectWorkspace(id);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Eyebrow>agentplain</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Choose a workspace</H1>
        <Caption style={{ marginTop: space.xs }}>Signed in as {me.user.email}</Caption>
      </View>

      {me.workspaces.length === 0 ? (
        <View style={styles.empty}>
          <Body soft>No workspaces yet. Finish onboarding on the web to get started.</Body>
        </View>
      ) : (
        <FlatList
          data={me.workspaces}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ padding: space.xl, paddingTop: space.md }}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => pick(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "600" }}>{item.name}</Body>
                <Caption style={{ marginTop: 2 }}>{item.vertical}</Caption>
              </View>
              <Pill text={item.tier} />
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={signOut} style={styles.signOut}>
        <Caption style={{ color: colors.clay }}>Sign out</Caption>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  empty: { padding: space.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.paperRaised,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.lg,
  },
  rowPressed: { opacity: 0.85 },
  signOut: { alignItems: "center", paddingVertical: space.xl },
});
