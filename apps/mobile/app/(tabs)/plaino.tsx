// Talk-to-Plaino chat (V2 — real).
//
// Full-screen support chat over the same /api/chat mode=support backbone the
// web uses (project_plaino_chatbot_two_surfaces). Workspace context is auto-
// injected from the bearer session server-side. Respects the sentinel-aware
// degradation (PR #163) + budget enforcement (PR #145): when a reply comes
// back `degraded`, the "send this to a person" hand-off auto-expands inline —
// the same behavior as web. Recent thread is cached per workspace
// (src/chat-store) over the durable server record.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/auth-context";
import { api, ApiError, type ChatTurn } from "../../src/api";
import { loadChat, saveChat } from "../../src/chat-store";
import { Body, Button, Caption, Eyebrow, H1 } from "../../src/ui";
import { colors, radius, space } from "../../src/theme";

function greeting(workspaceName: string): ChatTurn {
  return {
    role: "plaino",
    body:
      `i'm Plaino — your service partner for ${workspaceName}. ask me how ` +
      "something works, why you're seeing it, or where to find it. if it " +
      "needs a person, i'll get it to the team for review.",
  };
}

export default function Plaino() {
  const { activeWorkspace, activeWorkspaceId } = useAuth();
  const wsId = activeWorkspaceId ?? "";
  const wsName = activeWorkspace?.name ?? "your workspace";

  const [messages, setMessages] = useState<ChatTurn[]>([greeting(wsName)]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  // Hydrate the recent thread for this workspace.
  useEffect(() => {
    let cancelled = false;
    if (!wsId) return;
    void loadChat(wsId).then((stored) => {
      if (cancelled || !stored) return;
      if (stored.turns.length > 0) setMessages(stored.turns);
      setConversationId(stored.conversationId);
    });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  // Persist on every change (bounded write).
  useEffect(() => {
    if (wsId) void saveChat(wsId, { conversationId, turns: messages });
  }, [wsId, conversationId, messages]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, sending]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || !wsId) return;
    const next: ChatTurn[] = [...messages, { role: "user", body }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await api.supportChat({
        workspaceId: wsId,
        messages: next,
        conversationId,
      });
      setMessages((m) => [...m, { role: "plaino", body: res.reply }]);
      if (res.conversationId) setConversationId(res.conversationId);
      // Sentinel-aware degradation / budget block: surface the human path.
      if (res.degraded) setHandoffOpen(true);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? "i couldn't reach the line just now. try again, or send it to the team below and a person will follow up."
          : "i couldn't reach the line. try again shortly.";
      setMessages((m) => [...m, { role: "plaino", body: msg }]);
      setHandoffOpen(true);
    } finally {
      setSending(false);
    }
  }, [draft, sending, wsId, messages, conversationId]);

  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.body ?? "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Eyebrow>Plaino</Eyebrow>
          <H1 style={{ marginTop: space.sm }}>Talk to Plaino</H1>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
          renderItem={({ item }) => <Bubble turn={item} />}
          ListFooterComponent={
            <View>
              {sending ? (
                <Caption style={{ marginTop: space.lg }}>
                  Plaino is fetching that…
                </Caption>
              ) : null}
              <HandoffPanel
                workspaceId={wsId}
                conversationId={conversationId}
                seedBody={lastUserMessage}
                open={handoffOpen}
                setOpen={setHandoffOpen}
              />
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="ask how something works…"
            placeholderTextColor={colors.inkFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            editable={!sending}
          />
          <View style={{ width: space.sm }} />
          <Button label="Ask" onPress={send} loading={sending} disabled={draft.trim().length === 0} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const isPlaino = turn.role === "plaino";
  return (
    <View style={isPlaino ? styles.plainoWrap : styles.userWrap}>
      <Caption style={{ marginBottom: space.xs }}>
        {isPlaino ? "Plaino" : "You"}
      </Caption>
      <View style={[styles.bubble, isPlaino ? styles.plainoBubble : styles.userBubble]}>
        <Body>{turn.body}</Body>
      </View>
    </View>
  );
}

// Draft-into-review hand-off — same SupportRequest pipeline as web
// (/api/support/draft). Auto-opens when a reply is degraded.
function HandoffPanel({
  workspaceId,
  conversationId,
  seedBody,
  open,
  setOpen,
}: {
  workspaceId: string;
  conversationId: string | null;
  seedBody: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Seed once when opening.
  useEffect(() => {
    if (open && seedBody) {
      setBody((b) => (b.length === 0 ? seedBody : b));
      setSubject((s) => (s.length === 0 ? seedBody.slice(0, 80) : s));
    }
  }, [open, seedBody]);

  const submit = async () => {
    if (!workspaceId) return;
    setStatus("sending");
    setError(null);
    try {
      await api.supportDraft({
        workspaceId,
        subject: subject.trim(),
        body: body.trim(),
        conversationId: conversationId ?? undefined,
      });
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof ApiError ? e.message : "couldn't send that to the team — try again.",
      );
    }
  };

  if (status === "sent") {
    return (
      <View style={styles.handoffSent}>
        <Caption style={{ color: colors.sage }}>sent to the team</Caption>
        <Body soft style={{ marginTop: space.xs }}>
          your team is drafting a reply for review. track it under Approvals.
        </Body>
      </View>
    );
  }

  return (
    <View style={styles.handoff}>
      {!open ? (
        <Pressable onPress={() => setOpen(true)}>
          <Caption style={{ color: colors.clay }}>
            need a person? send this to the team →
          </Caption>
        </Pressable>
      ) : (
        <View>
          <Caption>send to the team — a person reviews + replies</Caption>
          <TextInput
            style={[styles.input, { marginTop: space.sm }]}
            placeholder="short subject"
            placeholderTextColor={colors.inkFaint}
            value={subject}
            onChangeText={setSubject}
            editable={status !== "sending"}
          />
          <TextInput
            style={[styles.input, styles.inputMulti, { marginTop: space.sm }]}
            placeholder="what you need help with"
            placeholderTextColor={colors.inkFaint}
            value={body}
            onChangeText={setBody}
            multiline
            editable={status !== "sending"}
          />
          {error ? (
            <Caption style={{ color: colors.danger, marginTop: space.sm }}>{error}</Caption>
          ) : null}
          <View style={{ marginTop: space.md }}>
            <Button
              label={status === "sending" ? "sending…" : "send to the team"}
              onPress={submit}
              loading={status === "sending"}
              disabled={subject.trim().length < 3 || body.trim().length < 10}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.sm, flexGrow: 1 },
  plainoWrap: { alignItems: "flex-start" },
  userWrap: { alignItems: "flex-end" },
  bubble: { borderRadius: radius.lg, padding: space.lg, maxWidth: "92%" },
  plainoBubble: {
    backgroundColor: colors.paperRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  userBubble: { backgroundColor: colors.clayWash },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.paperRaised,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    fontSize: 15,
    color: colors.ink,
  },
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  handoff: { marginTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.lg },
  handoffSent: {
    marginTop: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.sage,
    backgroundColor: colors.sageWash,
    padding: space.lg,
  },
});
