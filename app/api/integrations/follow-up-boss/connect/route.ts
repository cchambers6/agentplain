/**
 * POST /api/integrations/follow-up-boss/connect
 *
 * Wave-3 — Follow Up Boss API-key connection. FUB authenticates with a
 * per-account API key (HTTP Basic), not OAuth, so the workspace pastes
 * the key into a simple form and we:
 *
 *   1. Validate the caller is an ACTIVE broker-owner of the workspace.
 *   2. Call FUB GET /v1/identity with the supplied key — confirms the
 *      key is valid AND we capture the account id + email for the
 *      operator-facing label on the credential row.
 *   3. Encrypt the key (v1 envelope) and upsert one
 *      `IntegrationCredential` row for the workspace.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this route owns the only
 * place that calls FUB's REST surface for connect-time validation. Once
 * the credential is persisted, the FUB MCP server takes over for every
 * subsequent call.
 *
 * Per `project_no_outbound_architecture.md`: the route writes durable
 * state and audit log only. No mail / SMS / customer-facing send.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireWorkspaceMember } from '@/lib/auth';
import { withSystemContext } from '@/lib/db';
import { encrypt, isEncryptionConfigured } from '@/lib/security/encryption';
import { FUB_API_BASE } from '@/lib/integrations/follow-up-boss-mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Far-future sentinel — FUB API keys do not expire; the credential
// resolver checks status='ACTIVE' rather than expiresAt.
const FUB_SENTINEL_EXPIRES_AT = new Date('2099-12-31T00:00:00.000Z');

interface ConnectBody {
  workspaceId?: string;
  apiKey?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as ConnectBody;
  if (!body.workspaceId || !UUID_RE.test(body.workspaceId)) {
    return NextResponse.json(
      { error: 'workspaceId required (uuid)' },
      { status: 400 },
    );
  }
  if (
    !body.apiKey ||
    typeof body.apiKey !== 'string' ||
    body.apiKey.trim().length < 10
  ) {
    return NextResponse.json(
      { error: 'apiKey required (paste it from FUB → My Profile → API Key)' },
      { status: 400 },
    );
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'encryption not configured', detail: 'ENCRYPTION_KEY missing' },
      { status: 500 },
    );
  }

  // Auth gate — caller must be an active BROKER_OWNER of the workspace.
  await requireWorkspaceMember(body.workspaceId);

  // Validate the key with FUB. The /identity endpoint returns the
  // current account context — accountId + accountEmail — when the
  // Basic auth header authenticates.
  const apiKey = body.apiKey.trim();
  const basicAuth = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  let identityRes: Response;
  try {
    identityRes = await fetch(`${FUB_API_BASE}/identity`, {
      headers: {
        Authorization: basicAuth,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'fub_network_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
  if (identityRes.status === 401 || identityRes.status === 403) {
    return NextResponse.json(
      {
        error: 'invalid_api_key',
        detail: 'Follow Up Boss rejected the key. Double-check it on FUB → My Profile → API Key.',
      },
      { status: 401 },
    );
  }
  if (!identityRes.ok) {
    return NextResponse.json(
      {
        error: 'fub_upstream_error',
        detail: `FUB returned HTTP ${identityRes.status}`,
      },
      { status: 502 },
    );
  }
  const identity = (await identityRes.json().catch(() => ({}))) as {
    accountId?: number | string;
    name?: string;
    email?: string;
  };
  const accountId =
    identity.accountId !== undefined ? String(identity.accountId) : null;
  const accountEmail =
    typeof identity.email === 'string' && identity.email.length > 0
      ? identity.email
      : 'fub-account';
  if (!accountId) {
    return NextResponse.json(
      {
        error: 'fub_identity_malformed',
        detail: 'Follow Up Boss did not return an accountId on /identity.',
      },
      { status: 502 },
    );
  }

  const ciphertext = encrypt(apiKey);
  await withSystemContext(async (tx) => {
    await tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: body.workspaceId!,
          provider: 'FOLLOW_UP_BOSS',
          accountId,
        },
      },
      create: {
        workspaceId: body.workspaceId!,
        provider: 'FOLLOW_UP_BOSS',
        accountId,
        accountEmail,
        accessTokenEncrypted: ciphertext,
        refreshTokenEncrypted: null,
        scopes: [
          'people:read',
          'people:write',
          'notes:write',
          'pipelines:read',
        ],
        expiresAt: FUB_SENTINEL_EXPIRES_AT,
        status: 'ACTIVE',
      },
      update: {
        accessTokenEncrypted: ciphertext,
        accountEmail,
        status: 'ACTIVE',
        expiresAt: FUB_SENTINEL_EXPIRES_AT,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: body.workspaceId!,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: accountId,
        payload: { provider: 'FOLLOW_UP_BOSS', accountEmail },
      },
    });
  });

  return NextResponse.json({ ok: true, accountId, accountEmail });
}
