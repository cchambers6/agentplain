/**
 * POST /api/auth/oauth/google/revoke
 *   body: { credentialId: string }
 *
 * Disconnects a Google integration:
 *   1. Look up the IntegrationCredential row.
 *   2. Call users.stop to drop the Pub/Sub subscription provider-side.
 *   3. Revoke tokens at https://oauth2.googleapis.com/revoke.
 *   4. Mark the credential REVOKED + the WebhookSubscription UNSUBSCRIBED.
 *   5. Audit row.
 *
 * Operator-only in PR-B (same gate as connect).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { decryptCredential, getProvider } from '@/lib/integrations';
import { requireUser } from '@/lib/auth/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  if (!session.isOperator) {
    return NextResponse.json({ error: 'operator_only' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const credentialId = (body as { credentialId?: unknown } | null)?.credentialId;
  if (typeof credentialId !== 'string' || !/^[0-9a-f-]{36}$/i.test(credentialId)) {
    return NextResponse.json({ error: 'invalid_credential_id' }, { status: 400 });
  }

  const credential = await prisma.integrationCredential.findUnique({
    where: { id: credentialId },
    include: { webhookSubscriptions: true },
  });
  if (!credential) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const provider = getProvider(credential.provider);
  const decrypted = decryptCredential(credential);

  // Stop watching first; if revoke succeeds but watch lingers, Pub/Sub
  // keeps pushing to a credential we can't refresh — worse failure mode
  // than the opposite ordering.
  const stopErrors: string[] = [];
  for (const sub of credential.webhookSubscriptions) {
    const stop = await provider.deleteSubscription({
      credential: decrypted,
      subscriptionId: sub.subscriptionId,
    });
    if (!stop.ok && stop.error.code !== 'NOT_FOUND') {
      stopErrors.push(`${sub.id}: ${stop.error.code}: ${stop.error.message}`);
    }
  }

  // Revoke OAuth grant.
  const revoke = await provider.revokeTokens({ accessToken: decrypted.accessToken });
  const revokeError =
    !revoke.ok ? `${revoke.error.code}: ${revoke.error.message}` : null;

  // Update DB regardless — if revoke failed we still mark UNSUBSCRIBED on
  // our side so the cron stops trying.
  await prisma.$transaction([
    prisma.webhookSubscription.updateMany({
      where: { integrationCredentialId: credentialId },
      data: { status: 'UNSUBSCRIBED' },
    }),
    prisma.integrationCredential.update({
      where: { id: credentialId },
      data: { status: 'REVOKED' },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId: credential.workspaceId,
        action: 'integration.revoked',
        targetTable: 'IntegrationCredential',
        targetId: credentialId,
        payload: {
          provider: credential.provider,
          accountEmail: credential.accountEmail,
          stopErrors,
          revokeError,
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    credentialId,
    stopErrors,
    revokeError,
  });
}
