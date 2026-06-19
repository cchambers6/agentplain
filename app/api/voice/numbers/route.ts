/**
 * /api/voice/numbers
 *
 * Per-customer phone-number provisioning — assign (POST) and release (DELETE).
 *
 * STATUS — STUB until a Twilio account exists. The route is fully wired (auth,
 * validation, workspace-membership check, structured responses); the actual
 * Twilio buy/configure/release calls are parked behind
 * `lib/voice/provisioning.ts`, which returns NOT_IMPLEMENTED until
 * TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are configured. That surfaces here as
 * a 503 with a clear reason — so the UI can show "provisioning isn't available
 * yet" rather than failing opaquely.
 *
 * Auth mirrors the API-key connect routes: an operator, or a BROKER_OWNER of
 * the target workspace.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withSystemContext } from '@/lib/db/rls';
import { provisionNumber, releaseNumber } from '@/lib/voice/provisioning';
import { voiceProviderReadiness } from '@/lib/voice/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  workspaceId: z.string().uuid(),
  /** A 3-digit area code, or the literal 'tollfree'. */
  areaCodeOrTollFree: z.string().regex(/^(\d{3}|tollfree)$/),
  verticalSlug: z.string().optional(),
});

const releaseSchema = z.object({
  workspaceId: z.string().uuid(),
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
});

async function assertWorkspaceOwner(
  session: { userId: string; isOperator: boolean },
  workspaceId: string,
): Promise<boolean> {
  if (session.isOperator) return true;
  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: { userId: session.userId, workspaceId, status: 'ACTIVE', role: 'BROKER_OWNER' },
      select: { id: true },
    }),
  );
  return Boolean(membership);
}

/** GET — readiness probe so the UI knows whether provisioning is available. */
export async function GET(): Promise<NextResponse> {
  await requireUser();
  return NextResponse.json({ readiness: voiceProviderReadiness() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  if (!(await assertWorkspaceOwner(session, parsed.data.workspaceId))) {
    return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
  }

  const result = await provisionNumber({
    workspaceId: parsed.data.workspaceId,
    areaCodeOrTollFree: parsed.data.areaCodeOrTollFree,
    verticalSlug: parsed.data.verticalSlug,
  });

  if (!result.ok) {
    const status = result.error.code === 'NOT_IMPLEMENTED' ? 503 : 400;
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status },
    );
  }
  return NextResponse.json({ ok: true, assignment: result.value });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  if (!(await assertWorkspaceOwner(session, parsed.data.workspaceId))) {
    return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
  }

  const result = await releaseNumber(parsed.data.phoneNumber);
  if (!result.ok) {
    const status = result.error.code === 'NOT_IMPLEMENTED' ? 503 : 400;
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status },
    );
  }
  return NextResponse.json({ ok: true, ...result.value });
}
