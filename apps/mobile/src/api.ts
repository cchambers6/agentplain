// App-wide API client instance.
//
// Wires the shared, portable client (lib/mobile/api-client.ts) to the native
// concerns it doesn't know about: the configured base URL and the SecureStore
// token. The 401 handler is late-bound by the auth provider so a stale token
// triggers a clean sign-out.

import { createApiClient } from "@shared/lib/mobile/api-client";
import { API_BASE_URL } from "./config";
import { getToken } from "./auth/session-store";

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setUnauthorizedHandler(
  fn: (() => void | Promise<void>) | null,
): void {
  unauthorizedHandler = fn;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken,
  onUnauthorized: () => unauthorizedHandler?.(),
});

export type {
  MeResponse,
  MeWorkspace,
  BriefingItem,
  ApprovalItem,
  ExchangeResponse,
  IntegrationTile,
  ChatTurn,
  SupportChatResponse,
  FeedbackCategory,
  AppleSignInInput,
  RegisterPushInput,
} from "@shared/lib/mobile/api-client";
export { ApiError } from "@shared/lib/mobile/api-client";
