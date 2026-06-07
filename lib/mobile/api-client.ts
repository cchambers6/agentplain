// Shared mobile API client.
//
// A thin, dependency-free wrapper over fetch that the Expo app uses to talk to
// the agentplain Next.js backend. It lives in the shared lib/ (NOT inside
// apps/mobile) on purpose: it's isomorphic — no React Native imports, no Next
// imports, no SecureStore — so the same contract types compile under both the
// web tsconfig and the mobile tsconfig. The native-only concern (where the
// token is stored) is injected via `getToken`, keeping this module portable
// per project_living_portable_architecture.
//
// Auth model: the magic-link exchange returns a sealed session string; the app
// persists it (Expo SecureStore) and this client replays it as
// `Authorization: Bearer <token>` on every authed call. See
// lib/auth/mobile-session.ts for the server side.

// ---------------------------------------------------------------------------
// Contract types — mirror the JSON shapes returned by app/api/mobile/* and
// app/api/auth/magic-link/*. Kept inline (not imported from server modules) so
// this file pulls in zero server-only code when bundled into the RN app.
// ---------------------------------------------------------------------------

export interface ExchangeResponse {
  /** Sealed iron-session token — store in SecureStore, send as bearer. */
  token: string;
  userId: string;
  email: string;
  isOperator: boolean;
  activeWorkspaceId: string | null;
  onboardingDone: boolean;
}

export interface MeWorkspace {
  id: string;
  name: string;
  vertical: string;
  tier: string;
  role: string;
}

export interface MeResponse {
  user: { id: string; email: string; isOperator: boolean };
  activeWorkspaceId: string | null;
  workspaces: MeWorkspace[];
}

export interface BriefingItem {
  id: string;
  /** ISO Y-M-D the briefing covers. */
  forDate: string;
  /** Decrypted briefing body (markdown-ish plaintext). */
  body: string;
  summary: Record<string, unknown>;
  status: string;
  generatedAt: string;
}

export interface ApprovalItem {
  id: string;
  agentSlug: string;
  kind: string;
  discipline: string | null;
  payload: unknown;
  proposedAt: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface ApiClientConfig {
  /** Backend origin, e.g. https://app.agentplain.com (no trailing slash). */
  baseUrl: string;
  /** Returns the stored sealed session token, or null when signed out. */
  getToken: () => string | null | Promise<string | null>;
  /** Invoked when an authed request comes back 401, so the app can sign out. */
  onUnauthorized?: () => void | Promise<void>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const trimTrailingSlash = (s: string): string => s.replace(/\/+$/, "");

export interface MobileApiClient {
  /** POST /api/auth/magic-link — anti-enumeration, always resolves on 200. */
  sendMagicLink(email: string, remember?: boolean): Promise<void>;
  /** POST /api/auth/magic-link/exchange — raw token → sealed session. */
  exchangeToken(rawToken: string, remember?: boolean): Promise<ExchangeResponse>;
  /** GET /api/mobile/me — identity + owned workspaces. */
  me(): Promise<MeResponse>;
  /** GET /api/mobile/workspace/:id/briefing — last 14 briefings, decrypted. */
  briefings(workspaceId: string): Promise<BriefingItem[]>;
  /** GET /api/mobile/workspace/:id/approvals — PENDING queue items. */
  approvals(workspaceId: string): Promise<ApprovalItem[]>;
}

export function createApiClient(config: ApiClientConfig): MobileApiClient {
  const base = trimTrailingSlash(config.baseUrl);

  async function request<T>(
    path: string,
    init: RequestInit & { auth?: boolean } = {},
  ): Promise<T> {
    const { auth = false, headers, ...rest } = init;
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    if (rest.body != null && !("Content-Type" in finalHeaders)) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (auth) {
      const token = await config.getToken();
      if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${base}${path}`, { ...rest, headers: finalHeaders });

    if (res.status === 401 && auth && config.onUnauthorized) {
      await config.onUnauthorized();
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      if (
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
      ) {
        message = (parsed as { error: string }).error;
      }
      throw new ApiError(res.status, message, parsed);
    }

    return parsed as T;
  }

  return {
    async sendMagicLink(email, remember) {
      await request<{ ok: boolean }>("/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email, remember }),
      });
    },

    exchangeToken(rawToken, remember) {
      return request<ExchangeResponse>("/api/auth/magic-link/exchange", {
        method: "POST",
        body: JSON.stringify({ token: rawToken, remember }),
      });
    },

    me() {
      return request<MeResponse>("/api/mobile/me", { auth: true });
    },

    async briefings(workspaceId) {
      const data = await request<{ briefings: BriefingItem[] }>(
        `/api/mobile/workspace/${encodeURIComponent(workspaceId)}/briefing`,
        { auth: true },
      );
      return data.briefings;
    },

    async approvals(workspaceId) {
      const data = await request<{ approvals: ApprovalItem[] }>(
        `/api/mobile/workspace/${encodeURIComponent(workspaceId)}/approvals`,
        { auth: true },
      );
      return data.approvals;
    },
  };
}
