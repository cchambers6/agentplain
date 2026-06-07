// Persistent storage for the sealed session token.
//
// Native: Expo SecureStore (Keychain / Keystore-backed). Web: SecureStore is
// unavailable, so we fall back to localStorage — acceptable for the Expo-web
// preview target; the production credential store is the native one.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "agentplain.session.token";

const isWeb = Platform.OS === "web";

export async function getToken(): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(KEY, token);
    } catch {
      /* no-op */
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* no-op */
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
