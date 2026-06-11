/**
 * POST /api/integrations/buildium/connect
 *
 * API-key connect endpoint for Buildium. Buildium issues a client-id +
 * client-secret pair per account under Settings → API Settings (neither
 * rotates — same long-lived API-key model as TaxDome / Karbon / Follow Up
 * Boss). The customer pastes both; we encrypt the SECRET and persist an
 * IntegrationCredential row keyed by (workspaceId, provider=BUILDIUM,
 * accountId=clientId).
 *
 * Storage (matches lib/integrations/buildium-mcp/auth.ts):
 *   accessTokenEncrypted       = the SECRET (x-buildium-client-secret)
 *   providerMetadata.clientId  = the non-secret id (x-buildium-client-id)
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Buildium REST seam is
 * `lib/integrations/buildium-mcp/server.ts`. This route only persists the
 * credential — it does NOT touch Buildium's API.
 *
 * Per `project_no_outbound_architecture.md`: nothing outbound; the key
 * authorizes inbound read calls only.
 *
 * Honesty: we do NOT validate the key by calling Buildium from this route
 * (a live probe belongs on the "Test connection" button, which calls the
 * health route → buildiumHealthCheck once BUILDIUM_ADAPTER_LIVE=on). A bad
 * key surfaces as UNAUTHORIZED on the first read, and the operator can
 * reconnect from the same page — the trust-on-first-call model the other
 * API-key connectors use.
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
  clientId: z.string().min(4).max(256),
  clientSecret: z.string().min(8).max(1024),
});

// API-key credentials never expire on the provider side. Pin a far-future
// sentinel so resolveApiKeyCredential never tries to refresh.
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

  const { workspaceId, clientId, clientSecret } = parsed.data;

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

  const accountEmail = `${clientId}@buildium.connection`;
  const enc = encryptTokenSet({
    accessToken: clientSecret,
    refreshToken: null,
    scopes: [],
    expiresAt: FAR_FUTURE,
    accountId: clientId,
    accountEmail,
  });

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId,
          provider: 'BUILDIUM',
          accountId: clientId,
        },
      },
      create: {
        workspaceId,
        provider: 'BUILDIUM',
        accountId: clientId,
        accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { clientId },
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { clientId },
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
        // Never log the secret — only the non-secret client id.
        payload: { provider: 'BUILDIUM', clientId },
      },
    }),
  );

  return NextResponse.json({ ok: true, credentialId: credential.id });
}
