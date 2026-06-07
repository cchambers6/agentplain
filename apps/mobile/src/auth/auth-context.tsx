// Auth provider for the mobile app.
//
// Holds the single source of truth for the signed-in session: the sealed token
// lives in SecureStore (session-store.ts); this context mirrors the derived
// state (identity, owned workspaces, the locally-selected active workspace) and
// exposes the transitions the screens drive — exchange a magic-link token,
// pick a workspace, sign out.
//
// Active-workspace note: there is no server mutation to persist "active
// workspace" over the mobile API in V1, so the selection is client-side state,
// seeded from the exchange/me response and overridable by the selector screen.
// The briefing/approvals routes are addressed by workspaceId in the path, so
// no server round-trip is needed to switch.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, setUnauthorizedHandler, type MeResponse, type MeWorkspace } from "../api";
import { clearToken, setToken } from "./session-store";

type Status = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  me: MeResponse | null;
  activeWorkspaceId: string | null;
  activeWorkspace: MeWorkspace | null;
  /** Exchange a raw magic-link token for a sealed session and load identity. */
  signInWithToken: (rawToken: string, remember?: boolean) => Promise<void>;
  selectWorkspace: (workspaceId: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // Stable ref so the 401 handler always calls the latest signOut.
  const signOutRef = useRef<() => Promise<void>>(async () => {});

  const applyMe = useCallback((data: MeResponse) => {
    setMe(data);
    setStatus("signedIn");
    setActiveWorkspaceId((prev) => {
      if (prev && data.workspaces.some((w) => w.id === prev)) return prev;
      if (data.activeWorkspaceId && data.workspaces.some((w) => w.id === data.activeWorkspaceId)) {
        return data.activeWorkspaceId;
      }
      return data.workspaces.length === 1 ? data.workspaces[0]!.id : null;
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setMe(null);
    setActiveWorkspaceId(null);
    setStatus("signedOut");
  }, []);
  signOutRef.current = signOut;

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      applyMe(data);
    } catch {
      await signOut();
    }
  }, [applyMe, signOut]);

  const signInWithToken = useCallback(
    async (rawToken: string, remember = true) => {
      const exchanged = await api.exchangeToken(rawToken, remember);
      await setToken(exchanged.token);
      setActiveWorkspaceId(exchanged.activeWorkspaceId);
      const data = await api.me();
      applyMe(data);
    },
    [applyMe],
  );

  const selectWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  }, []);

  // On boot: a 401 from any authed call signs us out cleanly.
  useEffect(() => {
    setUnauthorizedHandler(() => signOutRef.current());
    return () => setUnauthorizedHandler(null);
  }, []);

  // On boot: if a token is already stored, validate it by loading identity.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.me();
        if (!cancelled) applyMe(data);
      } catch {
        if (!cancelled) setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe]);

  const value = useMemo<AuthState>(() => {
    const activeWorkspace =
      me?.workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
    return {
      status,
      me,
      activeWorkspaceId,
      activeWorkspace,
      signInWithToken,
      selectWorkspace,
      signOut,
      refresh,
    };
  }, [status, me, activeWorkspaceId, signInWithToken, selectWorkspace, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
