/**
 * GET /api/integrations/[integrationId]/oauth/start?workspaceId=<uuid>
 *
 * Provider-agnostic OAuth kickoff. Dispatches to the right provider's
 * authorize URL based on the marketplace entry. Sets the same sealed
 * `agentplain_oauth_state` cookie the legacy Google connect route uses,
 * so the existing Google callback at /api/auth/oauth/google/callback
 * continues to work without modification — only the start surface moved
 * from /api/auth/oauth/google/connect to this generic route.
 *
 * Auth model: customer-self-serve. The signed-in user must be an ACTIVE
 * BROKER_OWNER of the workspace they're connecting. Operators with the
 * legacy Google flow can still hit the old route directly; this one is
 * the customer-facing path Phase C exposes.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this route imports the
 * marketplace catalog (single source) and the per-provider OAuth client
 * lib (one per provider). No vendor SDK calls happen here directly.
 *
 * Per `project_no_outbound_architecture.md`: the scopes the route
 * requests come from the marketplace entry; no scope requested here that
 * the marketplace doesn't list. The marketplace catalog is the gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { sealData } from "iron-session";
import { requireWorkspaceMember } from "@/lib/auth";
import { env } from "@/lib/env";
import { getMarketplaceEntry } from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import { buildAuthorizeUrl } from "@/lib/integrations/oauth-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "agentplain_oauth_state";
const STATE_TTL_SECONDS = 600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  integrationId: string;
  issuedAt: number;
  /** Workspace-scoped path the callback should redirect back to on
   *  success. Validated against the active workspaceId at start time. */
  returnTo?: string;
}

/**
 * Whitelist the `returnTo` param to workspace-scoped paths owned by THIS
 * workspace. Prevents the OAuth flow from being abused to redirect to
 * arbitrary destinations, and prevents cross-workspace bouncing.
 */
function safeReturnTo(raw: string | null, workspaceId: string): string | undefined {
  if (!raw) return undefined;
  if (raw.length > 256) return undefined;
  // Must be same-origin, must be workspace-scoped, must be this workspace.
  const prefix = `/app/workspace/${workspaceId}/`;
  if (!raw.startsWith(prefix) && raw !== `/app/workspace/${workspaceId}`) {
    return undefined;
  }
  // No protocol-relative or absolute URLs sneak through (defense in depth).
  if (raw.startsWith("//") || /^[a-z]+:/i.test(raw)) return undefined;
  return raw;
}

/**
 * The calm, branded landing for an OAuth start that can't proceed because
 * the provider isn't configured in this environment. The integrations page
 * renders a `notice=not-configured` banner explaining the service partner
 * wires it on the welcome call.
 */
function notConfiguredUrl(
  req: NextRequest,
  workspaceId: string,
  integrationId: string,
): URL {
  const url = new URL(
    `/app/workspace/${workspaceId}/integrations`,
    req.nextUrl.origin,
  );
  url.searchParams.set("notice", "not-configured");
  url.searchParams.set("integration", integrationId);
  return url;
}

interface RouteContext {
  params: Promise<{ integrationId: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { integrationId } = await ctx.params;
  const entry = getMarketplaceEntry(integrationId);
  if (!entry) {
    return NextResponse.json(
      { error: "unknown_integration", integrationId },
      { status: 404 },
    );
  }
  if (entry.status === "coming-soon") {
    return NextResponse.json(
      {
        error: "integration_coming_soon",
        message: `${entry.name} is on the substrate but not yet wired up. Join the waitlist via /custom.`,
      },
      { status: 409 },
    );
  }

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    return NextResponse.json(
      { error: "invalid_workspace_id", message: "workspaceId query param must be a UUID." },
      { status: 400 },
    );
  }

  // Customer-owned action: the signed-in user must be an active broker-owner.
  // requireWorkspaceMember redirects to /app on miss; OAuth start is a GET
  // navigation so the redirect is the right shape.
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  // If the provider's OAuth credentials aren't wired in this environment,
  // buildAuthorizeUrl would throw. This is a GET navigation (the user clicked
  // a link), so a raw JSON 503 is a dead end. Redirect to the connections
  // surface with a calm, branded notice instead — the UI should already be
  // gating the CTA on isIntegrationConfigured, so this is defense in depth.
  if (!isIntegrationConfigured(entry)) {
    return NextResponse.redirect(notConfiguredUrl(req, workspaceId, integrationId));
  }

  const nonce = randomBytes(32).toString("hex");
  const returnTo = safeReturnTo(
    req.nextUrl.searchParams.get("returnTo"),
    workspaceId,
  );
  const cookiePayload: OAuthStateCookie = {
    nonce,
    workspaceId,
    integrationId,
    issuedAt: Date.now(),
    ...(returnTo ? { returnTo } : {}),
  };
  const sealed = await sealData(cookiePayload, {
    password: env.sessionPassword(),
    ttl: STATE_TTL_SECONDS,
  });

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl({
      integrationId,
      scopes: entry.scopes,
      state: nonce,
      origin: env.appPublicOrigin(),
      googleClientId: env.googleOAuthClientId(),
      googleClientSecret: env.googleOAuthClientSecret(),
      microsoftClientId: env.microsoftOAuthClientId(),
      microsoftAuthority: env.microsoftOAuthAuthority(),
      docusignClientId: env.docusignOAuthClientId(),
      docusignBaseUri: env.docusignOAuthBaseUri(),
      quickbooksClientId: env.quickbooksOAuthClientId(),
      slackClientId: env.slackOAuthClientId(),
    });
  } catch {
    // Same calm landing as the pre-check above — never strand the user on a
    // raw JSON error for a navigation they initiated.
    return NextResponse.redirect(notConfiguredUrl(req, workspaceId, integrationId));
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, sealed, {
    httpOnly: true,
    secure: env.appPublicOrigin().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}

