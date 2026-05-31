/**
 * POST /api/integrations/taxdome/connect
 *
 * API-key connect endpoint for TaxDome. Unlike OAuth providers (Google,
 * M365, DocuSign, QuickBooks) TaxDome issues a static API key per firm
 * under Account → API Keys. The customer pastes the key + their portal
 * subdomain; we encrypt and persist as an IntegrationCredential row
 * keyed by (workspaceId, provider=TAXDOME, accountId=portalSubdomain).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the TaxDome REST seam is
 * `lib/integrations/taxdome-mcp/server.ts`. This route only persists
 * the credential — it does NOT touch TaxDome's API.
 *
 * Per `project_no_outbound_architecture.md`: there is nothing outbound
 * here; the key authorizes inbound read calls only.
 *
 * Per the no-OAuth-refresh model for API-key providers: we set
 * `refreshTokenEncrypted = null` and pin `expiresAt` to 2099-01-01 so
 * the credential-resolver never tries to refresh.
 *
 * Honesty: we do NOT validate the key by calling TaxDome from this
 * route (their partner-program docs require a specific firm setup we
 * cannot speak to from a connect form). The first MCP call surfaces
 * the credential as TOKEN_EXPIRED if the key is bad, and the operator
 * can reconnect from the same page. This is the same trust-on-first-
 * call model the Slack connector uses for user tokens.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { requireUser } from '@/lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const connectSchema = z.object({
  workspaceId: z.string().uuid(),
  apiKey: z.string().min(8).max(512),
  portalSubdomain: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/i, 'portalSubdomain must be alphanumeric'),
});

// API-key credentials never expire on the provider side. We persist a
// far-future sentinel so resolveApiKeyCredential never tries to refresh.
const FAR_FUTURE = new Date('2099-01-01T00:00:00.000Z');

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { workspaceId, apiKey, portalSubdomain } = parsed.data;

  if (!session.isOperator) {
    const membership = await withSystemContext((tx) =>
      tx.membership.findFirst({
        where: {
          userId: session.userId,
          workspaceId,
          status: 'ACTIVE',
          role: 'BROKER_OWNER',
        },
        select: { id: true },
      }),
    );
    if (!membership) {
      return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
    }
  }

  const enc = encryptTokenSet({
    accessToken: apiKey,
    refreshToken: null,
    scopes: [],
    expiresAt: FAR_FUTURE,
    // accountId/accountEmail are unused by encryptTokenSet but are part
    // of the TokenSet contract; we persist them on the row directly
    // below.
    accountId: portalSubdomain,
    accountEmail: `${portalSubdomain}@taxdome.connection`,
  });

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId,
          provider: 'TAXDOME',
          accountId: portalSubdomain,
        },
      },
      create: {
        workspaceId,
        provider: 'TAXDOME',
        accountId: portalSubdomain,
        accountEmail: `${portalSubdomain}@taxdome.connection`,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { portalSubdomain },
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { portalSubdomain },
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
    }),
  );

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: credential.id,
        payload: { provider: 'TAXDOME', portalSubdomain },
      },
    }),
  );

  return NextResponse.json({ ok: true, credentialId: credential.id });
}
