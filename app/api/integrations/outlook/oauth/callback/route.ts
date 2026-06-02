/**
 * GET /api/integrations/outlook/oauth/callback?code=...&state=...
 *
 * Microsoft identity platform v2.0 OAuth callback. Mirrors the shape of
 * /api/auth/oauth/google/callback for Outlook:
 *
 *   1. Read + verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code for tokens at login.microsoftonline.com.
 *   3. Fetch the user's profile from Microsoft Graph /me to surface
 *      accountId (oid) and accountEmail.
 *   4. Encrypt tokens via `lib/security/encryption.ts`.
 *   5. Upsert IntegrationCredential (provider=M365).
 *   6. Audit log row.
 *   7. Redirect back to /app/workspace/<id>/integrations.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Graph SDK seam is
 * `lib/integrations/outlook-mcp/server.ts`. This callback only talks to
 * the OAuth token endpoint (login.microsoftonline.com) and the lightweight
 * `/me` endpoint via plain fetch, which matches the seam carved in
 * lib/integrations/outlook-mcp/auth.ts (OAuth = distinct seam from Graph).
 *
 * Per `project_no_outbound_architecture.md`: we deliberately omit
 * `Mail.Send` from the requested scopes. The catalog enforces this; the
 * exchange just echoes the granted scopes back.
 */

import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { withSystemContext } from "@/lib/db/rls";
import { encryptTokenSet } from "@/lib/integrations";
import { requireUser } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { MCP_CONNECTED_SEED_INBOX_EVENT } from "@/lib/inngest/functions/mcp-connected-seed-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "agentplain_oauth_state";
const INTEGRATION_ID = "outlook";

interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  integrationId: string;
  issuedAt: number;
  /** Workspace-scoped path the OAuth start route asked the callback to
   *  redirect back to on success. When absent or not workspace-scoped,
   *  fall through to the marketplace index. */
  returnTo?: string;
}

function landingPath(cookie: OAuthStateCookie): string {
  if (
    cookie.returnTo &&
    cookie.returnTo.startsWith(`/app/workspace/${cookie.workspaceId}`)
  ) {
    return cookie.returnTo;
  }
  return `/app/workspace/${cookie.workspaceId}/integrations`;
}

function workspaceRedirect(
  origin: string,
  cookie: OAuthStateCookie,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(landingPath(cookie), origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

function fallbackRedirect(
  origin: string,
  params: Record<string, string>,
): NextResponse {
  const url = new URL("/app", origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  const origin = env.appPublicOrigin();
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const stateParam = params.get("state");
  const errorParam = params.get("error");
  const errorDescription = params.get("error_description");

  // We need the workspaceId before we can redirect to the workspace's
  // integrations page. The cookie carries it; fall back to /app if absent.
  const sealed = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!sealed) {
    return fallbackRedirect(origin, { error: "missing_state_cookie" });
  }
  let cookie: OAuthStateCookie;
  try {
    cookie = await unsealData<OAuthStateCookie>(sealed, {
      password: env.sessionPassword(),
    });
  } catch {
    return fallbackRedirect(origin, { error: "invalid_state_cookie" });
  }

  // Now we have the workspaceId — every subsequent error lands the user
  // back on the marketplace with an inline error banner.
  const workspaceId = cookie.workspaceId;

  if (cookie.integrationId !== INTEGRATION_ID) {
    return workspaceRedirect(origin, cookie, {
      error: "integration_mismatch",
      detail: cookie.integrationId,
    });
  }
  if (errorParam) {
    return workspaceRedirect(origin, cookie, {
      error: "microsoft_returned_error",
      detail: errorDescription ?? errorParam,
    });
  }
  if (!code || !stateParam) {
    return workspaceRedirect(origin, cookie, {
      error: "missing_code_or_state",
    });
  }
  if (cookie.nonce !== stateParam) {
    return workspaceRedirect(origin, cookie, { error: "state_mismatch" });
  }

  const clientId = env.microsoftOAuthClientId();
  const clientSecret = env.microsoftOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, {
      error: "microsoft_oauth_not_configured",
    });
  }

  // Re-derive the redirect URI exactly as the start route set it; Microsoft
  // requires byte-equality with the redirect_uri used at the authorize step.
  const redirectUri = new URL(
    "/api/integrations/outlook/oauth/callback",
    origin,
  ).toString();

  // Token exchange.
  const tokenUrl = `${env.microsoftOAuthAuthority().replace(/\/$/, "")}/oauth2/v2.0/token`;
  let tokenRes: Response;
  try {
    tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        // We MUST echo back exactly the scopes that were granted; per
        // the v2 protocol the response will populate `scope` accordingly.
        scope: "Mail.Read Mail.ReadWrite offline_access",
      }),
    });
  } catch (err) {
    return workspaceRedirect(origin, cookie, {
      error: "token_exchange_network",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (!tokenRes.ok) {
    let detail = `HTTP ${tokenRes.status}`;
    try {
      const body = (await tokenRes.json()) as {
        error_description?: string;
        error?: string;
      };
      detail = body.error_description ?? body.error ?? detail;
    } catch {
      // fall through
    }
    return workspaceRedirect(origin, cookie, {
      error: "token_exchange_failed",
      detail: detail.slice(0, 240),
    });
  }

  interface MicrosoftTokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  }
  let parsed: MicrosoftTokenResponse;
  try {
    parsed = (await tokenRes.json()) as MicrosoftTokenResponse;
  } catch (err) {
    return workspaceRedirect(origin, cookie, {
      error: "token_parse_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  if (!parsed.access_token) {
    return workspaceRedirect(origin, cookie, {
      error: "token_missing_access_token",
    });
  }
  if (!parsed.refresh_token) {
    // Outlook must return a refresh_token because we requested
    // offline_access. If it's missing the grant won't survive past
    // the access token's lifetime.
    return workspaceRedirect(origin, cookie, {
      error: "token_missing_refresh_token",
      detail: "Re-grant with offline_access scope.",
    });
  }

  // Fetch the user profile from Graph /me to populate accountId + accountEmail.
  // This is the only Graph call this file makes; the rest of the Graph SDK
  // surface lives in lib/integrations/outlook-mcp/server.ts.
  let profile: { id: string; mail: string | null; userPrincipalName: string };
  try {
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${parsed.access_token}`,
        Accept: "application/json",
      },
    });
    if (!profileRes.ok) {
      return workspaceRedirect(origin, cookie, {
        error: "graph_me_failed",
        detail: `HTTP ${profileRes.status}`,
      });
    }
    const body = (await profileRes.json()) as {
      id?: string;
      mail?: string | null;
      userPrincipalName?: string;
    };
    if (!body.id || !body.userPrincipalName) {
      return workspaceRedirect(origin, cookie, {
        error: "graph_me_incomplete",
      });
    }
    profile = {
      id: body.id,
      mail: body.mail ?? null,
      userPrincipalName: body.userPrincipalName,
    };
  } catch (err) {
    return workspaceRedirect(origin, cookie, {
      error: "graph_me_threw",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const accountEmail = profile.mail ?? profile.userPrincipalName;
  const expiresInSec = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
  const scopes = (parsed.scope ?? "").split(/\s+/).filter(Boolean);

  // Encrypt + persist.
  const enc = encryptTokenSet({
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
    scopes: scopes.length > 0 ? scopes : ["Mail.Read", "Mail.ReadWrite", "offline_access"],
    accountId: profile.id,
    accountEmail,
  });

  // IntegrationCredential is workspace-scoped RLS — withSystemContext seeds
  // the operator GUC for the connect path.
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId,
          provider: "M365",
          accountId: profile.id,
        },
      },
      create: {
        workspaceId,
        provider: "M365",
        accountId: profile.id,
        accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        lastRefreshedAt: new Date(),
        status: "ACTIVE",
      },
      update: {
        accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        lastRefreshedAt: new Date(),
        status: "ACTIVE",
      },
    }),
  );

  // Verify-after-create.
  const verify = await withSystemContext((tx) =>
    tx.integrationCredential.findUnique({
      where: { id: credential.id },
    }),
  );
  if (!verify) {
    return workspaceRedirect(origin, cookie, {
      error: "credential_persist_verify_failed",
    });
  }

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId,
        action: "integration.connected",
        targetTable: "IntegrationCredential",
        targetId: credential.id,
        payload: {
          provider: "M365",
          integrationId: INTEGRATION_ID,
          accountEmail,
          scopes,
        },
      },
    }),
  );

  // Wave-10 phase-3a — dispatch the seed-inbox seam (mirrors the Google
  // callback). Wave-10 handler is a no-op; wave-10b swaps it for real
  // substrate ingestion. Failure is non-fatal — the OAuth flow
  // completes regardless.
  try {
    await inngest.send({
      name: MCP_CONNECTED_SEED_INBOX_EVENT,
      data: {
        workspaceId,
        provider: "M365" as const,
        credentialId: credential.id,
      },
    });
  } catch {
    // Best-effort; see comment in the Google callback for rationale.
  }

  const res = workspaceRedirect(origin, cookie, {
    connected: INTEGRATION_ID,
  });
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
