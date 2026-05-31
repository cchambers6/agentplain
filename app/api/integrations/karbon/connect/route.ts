/**
 * POST /api/integrations/karbon/connect
 *
 * API-key connect endpoint for Karbon. Karbon API v3 uses two static
 * headers (Authorization: Bearer + AccessKey) per the developer docs at
 * developers.karbonhq.com (read 2026-05-29). We persist the bearer
 * (`accessToken`) encrypted at rest and the per-firm AccessKey in
 * `providerMetadata.accessKey`.
 *
 * Same trust-on-first-call model as TaxDome — we do NOT call Karbon
 * from this route. The first MCP call surfaces TOKEN_EXPIRED if either
 * key is bad.
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
  accessToken: z.string().min(8).max(2048),
  accessKey: z.string().min(8).max(512),
  /** Optional human label — the firm's Karbon tenant name or display
   *  name. Persisted as `accountEmail` for the operator UI label. */
  firmLabel: z.string().min(2).max(120).optional(),
});

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

  const { workspaceId, accessToken, accessKey, firmLabel } = parsed.data;

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

  // Account id: stable per-firm identifier. We derive from the accessKey
  // hash so the upsert key is deterministic and rotating the key creates
  // a new credential row rather than silently overwriting the previous.
  // (Compose with workspaceId so two workspaces can share a key in the
  // unlikely partner-program case.)
  const { createHash } = await import('node:crypto');
  const accountId = createHash('sha256').update(accessKey).digest('hex').slice(0, 32);
  const accountEmail = firmLabel ?? `karbon-firm@${accountId.slice(0, 12)}.connection`;

  const enc = encryptTokenSet({
    accessToken,
    refreshToken: null,
    scopes: [],
    expiresAt: FAR_FUTURE,
    accountId,
    accountEmail,
  });

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId,
          provider: 'KARBON',
          accountId,
        },
      },
      create: {
        workspaceId,
        provider: 'KARBON',
        accountId,
        accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { accessKey, firmLabel: firmLabel ?? null },
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: null,
        scopes: [],
        expiresAt: FAR_FUTURE,
        providerMetadata: { accessKey, firmLabel: firmLabel ?? null },
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
        payload: { provider: 'KARBON', firmLabel: firmLabel ?? null },
      },
    }),
  );

  return NextResponse.json({ ok: true, credentialId: credential.id });
}
