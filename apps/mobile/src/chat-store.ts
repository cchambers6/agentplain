// Per-workspace local chat cache.
//
// The durable record of every conversation is server-side (PlainoConversation,
// addressed by conversationId). This is just a convenience cache so reopening
// the chat tab shows the recent thread instead of a cold greeting. Stored in
// SecureStore (the same credential store the session uses); bounded so we
// never push a large blob into the keychain.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ChatTurn } from "./api";

const PREFIX = "agentplain.chat.";
const MAX_TURNS = 20;
const MAX_BODY = 600;

export interface StoredChat {
  conversationId: string | null;
  turns: ChatTurn[];
}

// SecureStore keys must be alphanumeric + ".-_"; a workspace UUID qualifies.
const keyFor = (workspaceId: string) => `${PREFIX}${workspaceId}`;

const isWeb = Platform.OS === "web";

function clip(turns: ChatTurn[]): ChatTurn[] {
  return turns.slice(-MAX_TURNS).map((t) => ({
    role: t.role,
    body: t.body.length > MAX_BODY ? t.body.slice(0, MAX_BODY) : t.body,
  }));
}

export async function loadChat(workspaceId: string): Promise<StoredChat | null> {
  try {
    const raw = isWeb
      ? globalThis.localStorage?.getItem(keyFor(workspaceId)) ?? null
      : await SecureStore.getItemAsync(keyFor(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChat;
    if (!Array.isArray(parsed.turns)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveChat(
  workspaceId: string,
  chat: StoredChat,
): Promise<void> {
  try {
    const payload = JSON.stringify({
      conversationId: chat.conversationId,
      turns: clip(chat.turns),
    });
    if (isWeb) {
      globalThis.localStorage?.setItem(keyFor(workspaceId), payload);
    } else {
      await SecureStore.setItemAsync(keyFor(workspaceId), payload);
    }
  } catch {
    // Best-effort cache; a write failure just means a cold greeting next time.
  }
}
