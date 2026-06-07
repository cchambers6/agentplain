import Constants from "expo-constants";

// Backend origin. Resolution order:
//   1. EXPO_PUBLIC_API_BASE_URL  (per-build override, e.g. a preview deploy)
//   2. app.json → expo.extra.apiBaseUrl  (the committed default)
//   3. localhost  (bare `expo start` against a local `next dev`)
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  extra.apiBaseUrl ??
  "http://localhost:3000";

// Custom URL scheme — must match app.json `expo.scheme`. Used for the
// magic-link deep-link return path (agentplain://auth/callback?token=...).
export const APP_SCHEME = "agentplain";
