// Approvals queue (V1 screen #4) — READ ONLY.
//
// Lists PENDING approval-queue items for the active workspace from
// /api/mobile/workspace/:id/approvals. The decision actions (approve / edit /
// "doesn't sound like us") are intentionally not in V1: that path runs through
// the closed-loop feedback substrate + RLS-gated decision actions and warrants
// its own reviewed PR (the backend route only exposes the read for the same
// reason). The screen makes that explicit rather than showing dead buttons.

import React from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/auth-context";
import { api, type ApprovalItem } from "../../src/api";
import { useResource } from "../../src/use-resource";
import { Body, Caption, Card, Eyebrow, H1, H2, Loading, Pill } from "../../src/ui";
import { colors, space } from "../../src/theme";

// payload is the customer's own work product (shape varies by kind). Pull a
// short human preview without assuming a schema.
function preview(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["summary", "subject", "title", "body", "draft", "text", "message"]) {
      const v = p[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return "";
    }
  }
  return String(payload);
}

function humanKind(kind: string): string {
  return kind.toLowerCase().replace(/_/g, " ");
}

export default function Approvals() {
  const { activeWorkspace, activeWorkspaceId } = useAuth();
  const wsId = activeWorkspaceId ?? "";
  const res = useResource<ApprovalItem[]>(() => api.approvals(wsId), wsId);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>{activeWorkspace?.name ?? "Workspace"}</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Approvals</H1>
        <Caption style={{ marginTop: space.xs }}>
          Review on web to approve — swipe actions land in a later release.
        </Caption>
      </View>

      {res.loading && !res.data ? (
        <Loading label="Loading approvals…" />
      ) : (
        <FlatList
          data={res.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.clay} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body soft>
                {res.error ?? "Nothing waiting on you. Your agents will queue work here when they need a decision."}
              </Body>
            </View>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardTop}>
                <Pill text={humanKind(item.kind)} tone="pending" />
                {item.discipline ? <Caption>{item.discipline}</Caption> : null}
              </View>
              <H2 style={{ marginTop: space.sm }}>{item.agentSlug}</H2>
              <Body soft style={{ marginTop: space.xs }} numberOfLines={4}>
                {preview(item.payload) || "(No preview available.)"}
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
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
