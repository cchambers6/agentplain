// Approvals queue (V2 — decision actions).
//
// Swipe right → approve, swipe left → reject, tap → edit drawer ("Approve
// edited"). Each card also carries a "doesn't sound like us" feedback button
// (the PR #153 closed-loop substrate). All actions are optimistic: the item
// leaves the list immediately and is restored on failure. Decisions hit the
// mobile JSON routes, which share the exact decision core with the web server
// actions (lib/approvals/decisions) — audit + preference-signal capture are
// identical across surfaces.

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/auth-context";
import { api, ApiError, type ApprovalItem, type FeedbackCategory } from "../../src/api";
import { useResource } from "../../src/use-resource";
import { Body, Button, Caption, Card, Eyebrow, H1, H2, Loading, Pill } from "../../src/ui";
import { colors, radius, space } from "../../src/theme";

const FEEDBACK_CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: "tone", label: "Tone" },
  { key: "structure", label: "Structure" },
  { key: "factual", label: "A fact's wrong" },
  { key: "length", label: "Length" },
  { key: "other", label: "Something else" },
];

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function preview(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  const p = asRecord(payload);
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

/** The editable body of a draft, when one exists. */
function editableBody(payload: unknown): string | null {
  const p = asRecord(payload);
  for (const k of ["body", "draft", "text", "message"]) {
    const v = p[k];
    if (typeof v === "string") return v;
  }
  return null;
}

function humanKind(kind: string): string {
  return kind.toLowerCase().replace(/_/g, " ");
}

export default function Approvals() {
  const { activeWorkspace, activeWorkspaceId } = useAuth();
  const wsId = activeWorkspaceId ?? "";
  const res = useResource<ApprovalItem[]>(() => api.approvals(wsId), wsId);

  // Local optimistic copy of the queue.
  const [items, setItems] = useState<ApprovalItem[]>([]);
  useEffect(() => {
    setItems(res.data ?? []);
  }, [res.data]);

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ApprovalItem | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<ApprovalItem | null>(null);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // Optimistically remove `item`, run `action`, restore on failure.
  const optimistic = async (item: ApprovalItem, action: () => Promise<void>) => {
    if (busy.has(item.id)) return;
    setBusyFor(item.id, true);
    const snapshot = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    try {
      await action();
    } catch (e) {
      setItems(snapshot); // rollback
      const msg =
        e instanceof ApiError ? e.message : "Couldn't reach agentplain. Try again.";
      Alert.alert("That didn't go through", msg);
    } finally {
      setBusyFor(item.id, false);
    }
  };

  const approve = (item: ApprovalItem, editedBody?: string) =>
    optimistic(item, () => api.approveApproval(wsId, item.id, editedBody));
  const reject = (item: ApprovalItem) =>
    optimistic(item, () => api.rejectApproval(wsId, item.id));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Eyebrow>{activeWorkspace?.name ?? "Workspace"}</Eyebrow>
        <H1 style={{ marginTop: space.sm }}>Approvals</H1>
        <Caption style={{ marginTop: space.xs }}>
          Swipe right to approve, left to reject. Tap to edit before approving.
        </Caption>
      </View>

      {res.loading && !res.data ? (
        <Loading label="Loading approvals…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.clay} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body soft>
                {res.error ??
                  "Nothing waiting on you. Your agents will queue work here when they need a decision."}
              </Body>
            </View>
          }
          renderItem={({ item }) => (
            <ApprovalRow
              item={item}
              disabled={busy.has(item.id)}
              onApprove={() => approve(item)}
              onReject={() => reject(item)}
              onTap={() => setEditing(item)}
              onFeedback={() => setFeedbackFor(item)}
            />
          )}
        />
      )}

      <EditDrawer
        item={editing}
        onClose={() => setEditing(null)}
        onApproveEdited={(body) => {
          const it = editing;
          setEditing(null);
          if (it) void approve(it, body);
        }}
      />

      <FeedbackDrawer
        item={feedbackFor}
        onClose={() => setFeedbackFor(null)}
        onSubmit={async (category, reason) => {
          const it = feedbackFor;
          setFeedbackFor(null);
          if (!it) return;
          try {
            await api.submitApprovalFeedback(wsId, it.id, {
              targetSkillSlug: it.agentSlug,
              category,
              reason,
            });
            Alert.alert("Thanks — noted", "Your next draft will reflect this.");
          } catch (e) {
            Alert.alert(
              "Couldn't send feedback",
              e instanceof ApiError ? e.message : "Try again shortly.",
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

function ApprovalRow({
  item,
  disabled,
  onApprove,
  onReject,
  onTap,
  onFeedback,
}: {
  item: ApprovalItem;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onTap: () => void;
  onFeedback: () => void;
}) {
  return (
    <Swipeable
      enabled={!disabled}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      renderLeftActions={() => (
        <View style={[styles.swipe, styles.swipeApprove]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.paperRaised} />
          <Caption style={styles.swipeLabel}>Approve</Caption>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.swipe, styles.swipeReject]}>
          <Ionicons name="close-circle" size={22} color={colors.paperRaised} />
          <Caption style={styles.swipeLabel}>Reject</Caption>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        // Swiping right reveals the LEFT actions (approve); swiping left
        // reveals the RIGHT actions (reject).
        if (direction === "left") onApprove();
        else onReject();
      }}
    >
      <Pressable onPress={onTap} disabled={disabled}>
        <Card style={disabled ? { opacity: 0.5 } : undefined}>
          <View style={styles.cardTop}>
            <Pill text={humanKind(item.kind)} tone="pending" />
            {item.discipline ? <Caption>{item.discipline}</Caption> : null}
          </View>
          <H2 style={{ marginTop: space.sm }}>{item.agentSlug}</H2>
          <Body soft style={{ marginTop: space.xs }} numberOfLines={4}>
            {preview(item.payload) || "(No preview available.)"}
          </Body>
          <Pressable onPress={onFeedback} style={styles.feedbackBtn} disabled={disabled}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.inkFaint} />
            <Caption style={{ color: colors.inkFaint }}>Doesn&apos;t sound like us</Caption>
          </Pressable>
        </Card>
      </Pressable>
    </Swipeable>
  );
}

function EditDrawer({
  item,
  onClose,
  onApproveEdited,
}: {
  item: ApprovalItem | null;
  onClose: () => void;
  onApproveEdited: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  useEffect(() => {
    setBody(item ? editableBody(item.payload) ?? preview(item.payload) : "");
  }, [item]);

  return (
    <Modal
      visible={item !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Eyebrow>Edit draft</Eyebrow>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>
          <Caption style={{ marginBottom: space.sm }}>
            {item ? humanKind(item.kind) : ""}
          </Caption>
          <TextInput
            style={styles.editInput}
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus
            placeholder="Draft text"
            placeholderTextColor={colors.inkFaint}
          />
          <View style={{ marginTop: space.lg }}>
            <Button
              label="Approve edited"
              onPress={() => onApproveEdited(body)}
              disabled={body.trim().length === 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FeedbackDrawer({
  item,
  onClose,
  onSubmit,
}: {
  item: ApprovalItem | null;
  onClose: () => void;
  onSubmit: (category: FeedbackCategory, reason: string) => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("tone");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (item) {
      setCategory("tone");
      setReason("");
    }
  }, [item]);

  return (
    <Modal
      visible={item !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Eyebrow>Doesn&apos;t sound like us</Eyebrow>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>
          <Caption style={{ marginBottom: space.sm }}>What was off?</Caption>
          <View style={styles.chips}>
            {FEEDBACK_CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Caption style={active ? { color: colors.paperRaised } : undefined}>
                    {c.label}
                  </Caption>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[styles.editInput, { minHeight: 100, marginTop: space.md }]}
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="A sentence or two on what to change"
            placeholderTextColor={colors.inkFaint}
          />
          <View style={{ marginTop: space.lg }}>
            <Button
              label="Send feedback"
              onPress={() => onSubmit(category, reason.trim())}
              disabled={reason.trim().length === 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.sm, flexGrow: 1 },
  empty: { paddingVertical: space.xxl, alignItems: "center" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feedbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginTop: space.md,
  },
  swipe: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.lg,
    marginVertical: 0,
    paddingHorizontal: space.xl,
    gap: space.xs,
  },
  swipeApprove: { backgroundColor: colors.sage, alignItems: "flex-start" },
  swipeReject: { backgroundColor: colors.danger, alignItems: "flex-end" },
  swipeLabel: { color: colors.paperRaised },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    paddingBottom: space.xxl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  editInput: {
    minHeight: 160,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.paperRaised,
    padding: space.lg,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chipActive: { backgroundColor: colors.clay, borderColor: colors.clay },
});
