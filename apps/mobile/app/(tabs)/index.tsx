// Briefings inbox (V1 screen #3, home tab). Reads the last 14 daily briefings
// for the active workspace from /api/mobile/workspace/:id/briefing and renders
// them newest-first. Real data, real auth.

import React from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/auth-context";
import { api, type BriefingItem } from "../../src/api";
import { useResource } from "../../src/use-resource";
import { Body, Caption, Card, Eyebrow, H1, H2, Loading } from "../../src/ui";
import { colors, space } from "../../src/theme";

function formatDate(iso: string): string {
  // forDate is a Y-M-D string; render it human-friendly without pulling a date lib.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default function Briefings() {
  const { activeWorkspace, activeWorkspaceId } = useAuth();
  const wsId = activeWorkspaceId ?? "";
  const res = useResource<BriefingItem[]>(() => api.briefings(wsId), wsId);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>{activeWorkspace?.name ?? "Workspace"}</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Briefings</H1>
      </View>

      {res.loading && !res.data ? (
        <Loading label="Loading briefings…" />
      ) : (
        <FlatList
          data={res.data ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.clay} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body soft>
                {res.error ?? "No briefings yet. They arrive each morning once your agents are working."}
              </Body>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <Caption style={{ color: colors.clay }}>{formatDate(item.forDate)}</Caption>
              <H2 style={{ marginTop: space.xs }}>Daily briefing</H2>
              <Body soft style={{ marginTop: space.sm }} numberOfLines={6}>
                {item.body.trim() || "(Briefing is being prepared.)"}
              </Body>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.sm, flexGrow: 1 },
  empty: { paddingVertical: space.xxl, alignItems: "center" },
});
