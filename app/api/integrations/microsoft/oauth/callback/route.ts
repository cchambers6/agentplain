/**
 * GET /api/integrations/microsoft/oauth/callback?code=...&state=...
 *
 * Shared Microsoft identity-platform v2.0 OAuth callback for the
 * post-Outlook M365 integrations: Teams, OneDrive, Excel. Structurally
 * identical to `/api/integrations/outlook/oauth/callback/route.ts` — kept
 * separate so the existing Outlook redirect URI in Entra doesn't need to
 * move. Conner adds THIS callback URL as an additional redirect URI on
 * the same OAuth app.
 *
 *   1. Read + verify the sealed `agentplain_oauth_state` cookie.
 *   2. Look up the marketplace entry by `cookie.integrationId` to learn
 *      which scopes were granted (each M365 integration has its own
 *      scope set; consent is incremental at Microsoft's side).
 *   3. Exchange code for tokens at login.microsoftonline.com.
 *   4. Fetch the user's profile from Graph /me to populate
 *      accountId + accountEmail.
 *   5. Encrypt tokens via `lib/security/encryption.ts`.
 *   6. Upsert the M365 IntegrationCredential row — ONE row per workspace
 *      regardless of which M365 integration triggered the consent. The
 *      scope union accumulates as the customer connects additional
 *      M365-flavoured integrations.
 *   7. Audit log row.
 *   8. Redirect back to /app/workspace/<id>/integrations.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this callback talks to the
 * Microsoft OAuth token endpoint + the lightweight `/me` endpoint. Both
 * seams already exist in the Outlook callback; this file mirrors them
 * verbatim so the SET of files that touch Microsoft hosts stays small.
 *
 * Per `project_no_outbound_architecture.md`: the requested scopes are
 * driven by the marketplace entry (single source of truth). The catalog
 * lists no `Mail.Send` for any entry; we trust the catalog rather than
 * re-stating the rule here.
 */

import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { prisma } from "@/lib/db/prisma";
import { encryptTokenSet } from "@/lib/integrations";
import { getMarketplaceEntry } from "@/lib/integrations/marketplace";
import { requireUser } from "@/lib/auth/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "agentplain_oauth_state";
const SUPPORTED_INTEGRATIONS = new Set(["teams", "onedrive", "excel"]);

interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  integrationId: string;
  issuedAt: number;
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

  const workspaceId = cookie.workspaceId;
  if (!SUPPORTED_INTEGRATIONS.has(cookie.integrationId)) {
    return workspaceRedirect(origin, cookie, {
      error: "integration_not_supported_by_microsoft_callback",
      detail: cookie.integrationId,
    });
  }
  const entry = getMarketplaceEntry(cookie.integrationId);
  if (!entry) {
    return workspaceRedirect(origin, cookie, {
      error: "unknown_integration",
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
    return workspaceRedirect(origin, cookie, { error: "missing_code_or_state" });
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

  const redirectUri = new URL(
    "/api/integrations/microsoft/oauth/callback",
    origin,
  ).toString();

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
        scope: entry.scopes.join(" "),
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
      // body wasn't JSON
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
    return workspaceRedirect(origin, cookie, {
      error: "token_missing_refresh_token",
      detail: "Re-grant with offline_access scope.",
    });
  }

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
  const grantedScopes = (parsed.scope ?? "").split(/\s+/).filter(Boolean);

  // Merge with any scopes already on the existing M365 row so subsequent
  // grants don't drop earlier consent. Each M365 integration adds its
  // scope set incrementally; the row's `scopes` is the running union.
  const existing = await prisma.integrationCredential.findUnique({
    where: {
      workspaceId_provider_accountId: {
        workspaceId,
        provider: "M365",
        accountId: profile.id,
      },
    },
    select: { scopes: true },
  });
  const mergedScopes = Array.from(
    new Set([...(existing?.scopes ?? []), ...grantedScopes, ...entry.scopes]),
  );

  const enc = encryptTokenSet({
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
    scopes: mergedScopes,
    accountId: profile.id,
    accountEmail,
  });

  const credential = await prisma.integrationCredential.upsert({
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
  });

  const verify = await prisma.integrationCredential.findUnique({
    where: { id: credential.id },
  });
  if (!verify) {
    return workspaceRedirect(origin, cookie, {
      error: "credential_persist_verify_failed",
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      workspaceId,
      action: "integration.connected",
      targetTable: "IntegrationCredential",
      targetId: credential.id,
      payload: {
        provider: "M365",
        integrationId: cookie.integrationId,
        accountEmail,
        grantedScopes,
        mergedScopes,
      },
    },
  });

  const res = workspaceRedirect(origin, cookie, {
    connected: cookie.integrationId,
  });
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
