// Integration marketplace (V2 — real).
//
// Pulls live tiles + connection status from
// GET /api/mobile/workspace/:id/integrations. Each tile shows category, name,
// and status (connected ✓ / connect / coming soon). "Connect" opens the
// existing web OAuth flow in an in-app browser — the web flow owns the OAuth
// redirect + the sealed state cookie, so we never re-implement OAuth natively
// (feedback_no_silent_vendor_lock). On return (browser dismissed, or the
// agentplain://integrations/oauth/callback deep link fires) we refetch so a
// freshly-connected tile flips to "Connected ✓".
//
// api-key connectors (Follow Up Boss, Sierra, TaxDome, Karbon) connect via a
// short web form rather than an OAuth redirect — those open the per-connector
// web detail page.

import React, { useEffect } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "../../src/auth/auth-context";
import { api, type IntegrationTile } from "../../src/api";
import { API_BASE_URL } from "../../src/config";
import { useResource } from "../../src/use-resource";
import { Body, Caption, Card, Eyebrow, H1, H2, Loading, Pill } from "../../src/ui";
import { colors, space } from "../../src/theme";

const OAUTH_CALLBACK = "agentplain://integrations/oauth/callback";

function absolute(path: string): string {
  return `${API_BASE_URL.replace(/\/+$/, "")}${path}`;
}

export default function Integrations() {
  const { me, signOut, activeWorkspace, activeWorkspaceId } = useAuth();
  const wsId = activeWorkspaceId ?? "";
  const res = useResource<IntegrationTile[]>(() => api.integrations(wsId), wsId);

  // Deep-link return from the web OAuth callback → refetch status.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith("agentplain://integrations/oauth/callback")) {
        res.refresh();
      }
    });
    return () => sub.remove();
  }, [res]);

  const connect = async (tile: IntegrationTile) => {
    try {
      if (tile.connectMode === "oauth" && tile.connectPath) {
        // Auth session shares the device's web cookies on iOS, so an already
        // signed-in customer connects without re-authing. Resolves on dismiss.
        await WebBrowser.openAuthSessionAsync(
          absolute(tile.connectPath),
          OAUTH_CALLBACK,
        );
      } else {
        // api-key connectors (+ manage of a connected tile) live on the web
        // detail page.
        await WebBrowser.openBrowserAsync(absolute(tile.webPath));
      }
    } finally {
      // Whatever happened in the browser, re-pull the truth.
      res.refresh();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>{activeWorkspace?.name ?? "Workspace"}</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Marketplace</H1>
        <Caption style={{ marginTop: space.xs }}>
          Connect the tools you already use. Nothing sends without your hand on it.
        </Caption>
      </View>

      {res.loading && !res.data ? (
        <Loading label="Loading connectors…" />
      ) : (
        <FlatList
          data={res.data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.clay} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body soft>
                {res.error ?? "No connectors for your workspace yet."}
              </Body>
            </View>
          }
          renderItem={({ item }) => <Tile tile={item} onConnect={connect} />}
          ListFooterComponent={
            <View style={styles.footer}>
              {me ? <Caption>Signed in as {me.user.email}</Caption> : null}
              <Pressable onPress={signOut} style={{ marginTop: space.md }}>
                <Caption style={{ color: colors.clay }}>Sign out</Caption>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Tile({
  tile,
  onConnect,
}: {
  tile: IntegrationTile;
  onConnect: (t: IntegrationTile) => void;
}) {
  const connected = tile.status === "connected";
  const comingSoon = tile.status === "coming-soon";
  // A configured oauth tile, or any api-key tile, is actionable; an
  // unconfigured oauth tile can't self-connect in-app.
  const canAct =
    !comingSoon &&
    (connected ||
      tile.connectMode === "api-key" ||
      (tile.connectMode === "oauth" && tile.configured));

  return (
    <Card>
      <View style={styles.tileTop}>
        <Caption style={{ color: colors.clay }}>{tile.category}</Caption>
        {connected ? (
          <Pill text="connected" tone="positive" />
        ) : comingSoon ? (
          <Pill text="coming soon" />
        ) : (
          <Pill text="available" tone="pending" />
        )}
      </View>
      <H2 style={{ marginTop: space.xs }}>{tile.name}</H2>
      <Body soft style={{ marginTop: space.xs }} numberOfLines={3}>
        {tile.description}
      </Body>
      {connected && tile.accountLabel ? (
        <Caption style={{ marginTop: space.sm }}>{tile.accountLabel}</Caption>
      ) : null}

      <View style={{ marginTop: space.md }}>
        {comingSoon ? (
          <Caption>On the roadmap — ask your service partner to move it up.</Caption>
        ) : canAct ? (
          <Pressable
            onPress={() => onConnect(tile)}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
          >
            <Ionicons
              name={connected ? "settings-outline" : "link-outline"}
              size={16}
              color={colors.clay}
            />
            <Caption style={{ color: colors.clay }}>
              {connected ? "Manage" : "Connect"}
            </Caption>
          </Pressable>
        ) : (
          <Caption>Your service partner wires this with you.</Caption>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.sm, flexGrow: 1 },
  empty: { paddingVertical: space.xxl, alignItems: "center" },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  action: { flexDirection: "row", alignItems: "center", gap: space.xs },
  footer: { alignItems: "center", paddingVertical: space.xxl },
});
