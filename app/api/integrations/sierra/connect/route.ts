/**
 * POST /api/integrations/sierra/connect
 *
 * Wave-4 — Sierra Interactive API-key connection. Mirrors the FUB
 * connect endpoint (api-key, no OAuth). Steps:
 *
 *   1. Validate the caller is an ACTIVE broker-owner of the workspace.
 *   2. Call Sierra GET /v1/account with the supplied key — confirms
 *      the key is valid AND captures the account id + email for the
 *      operator-facing label on the credential row.
 *   3. Encrypt the key (v1 envelope) and upsert one
 *      `IntegrationCredential` row.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this route owns the only
 * place that calls Sierra's REST surface for connect-time validation.
 * Once the credential is persisted, the Sierra MCP server takes over.
 *
 * Per `project_no_outbound_architecture.md`: writes durable state +
 * audit log only. No mail / SMS / customer-facing send.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireWorkspaceMember } from '@/lib/auth';
import { withSystemContext } from '@/lib/db';
import { encrypt, isEncryptionConfigured } from '@/lib/security/encryption';
import { SIERRA_API_BASE } from '@/lib/integrations/sierra-mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Far-future sentinel — Sierra API keys do not expire; the resolver
// checks status='ACTIVE' rather than expiresAt.
const SIERRA_SENTINEL_EXPIRES_AT = new Date('2099-12-31T00:00:00.000Z');

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
      {
        error:
          'apiKey required (paste it from Sierra Interactive → Settings → API Access)',
      },
      { status: 400 },
    );
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'encryption not configured', detail: 'ENCRYPTION_KEY missing' },
      { status: 500 },
    );
  }

  await requireWorkspaceMember(body.workspaceId);

  const apiKey = body.apiKey.trim();
  const bearer = `Bearer ${apiKey}`;
  let accountRes: Response;
  try {
    accountRes = await fetch(`${SIERRA_API_BASE}/account`, {
      headers: {
        Authorization: bearer,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'sierra_network_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
  if (accountRes.status === 401 || accountRes.status === 403) {
    return NextResponse.json(
      {
        error: 'invalid_api_key',
        detail:
          'Sierra Interactive rejected the key. Double-check it on Sierra → Settings → API Access.',
      },
      { status: 401 },
    );
  }
  if (!accountRes.ok) {
    return NextResponse.json(
      {
        error: 'sierra_upstream_error',
        detail: `Sierra returned HTTP ${accountRes.status}`,
      },
      { status: 502 },
    );
  }
  const account = (await accountRes.json().catch(() => ({}))) as {
    id?: number | string;
    accountId?: number | string;
    email?: string;
    name?: string;
  };
  const accountId =
    account.accountId !== undefined
      ? String(account.accountId)
      : account.id !== undefined
        ? String(account.id)
        : null;
  const accountEmail =
    typeof account.email === 'string' && account.email.length > 0
      ? account.email
      : 'sierra-account';
  if (!accountId) {
    return NextResponse.json(
      {
        error: 'sierra_account_malformed',
        detail:
          'Sierra Interactive did not return an accountId on /account.',
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
          provider: 'SIERRA_INTERACTIVE',
          accountId,
        },
      },
      create: {
        workspaceId: body.workspaceId!,
        provider: 'SIERRA_INTERACTIVE',
        accountId,
        accountEmail,
        accessTokenEncrypted: ciphertext,
        refreshTokenEncrypted: null,
        scopes: [
          'contacts:read',
          'contacts:write',
          'notes:write',
          'pipelines:read',
        ],
        expiresAt: SIERRA_SENTINEL_EXPIRES_AT,
        status: 'ACTIVE',
      },
      update: {
        accessTokenEncrypted: ciphertext,
        accountEmail,
        status: 'ACTIVE',
        expiresAt: SIERRA_SENTINEL_EXPIRES_AT,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: body.workspaceId!,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: accountId,
        payload: { provider: 'SIERRA_INTERACTIVE', accountEmail },
      },
    });
  });

  return NextResponse.json({ ok: true, accountId, accountEmail });
}
