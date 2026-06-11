/**
 * POST /api/integrations/buildium/sync
 *
 * On-demand trigger for the property-management rent-collection chase sweep.
 * Backs the onboarding "Sync 7 days of data" button + the rent-collection
 * dashboard "Sync now" button. Dispatches the Inngest trigger event; the
 * sweep then reads delinquent leases for every connected PROPERTY_MANAGEMENT
 * workspace and stages chase drafts into /approvals.
 *
 * The sweep itself enforces every gate (live-flag, billing pause, discipline,
 * install, fire-gate) — this route only fans the event out. It does NOT call
 * Buildium directly (`feedback_no_silent_vendor_lock.md`) and sends nothing
 * outbound (`project_no_outbound_architecture.md`).
 *
 * Note: the sweep is fleet-wide (it processes all connected workspaces, not
 * just the caller's). For the current single-pilot footprint that's
 * equivalent; a per-workspace targeted run is a follow-up.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withSystemContext } from '@/lib/db/rls';
import { requireUser } from '@/lib/auth/server';
import { inngest } from '@/lib/inngest/client';
import { isBuildiumLive } from '@/lib/integrations/buildium-mcp';
import { RENT_COLLECTION_CHASE_SWEEP_TRIGGER_EVENT } from '@/lib/inngest/functions/property-management-rent-collection-chase-sweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ workspaceId: z.string().uuid() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { workspaceId } = parsed.data;

  if (!session.isOperator) {
    const membership = await withSystemContext((tx) =>
      tx.membership.findFirst({
        where: { userId: session.userId, workspaceId, status: 'ACTIVE', role: 'BROKER_OWNER' },
        select: { id: true },
      }),
    );
    if (!membership) {
      return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
    }
  }

  // Honest DX: if the live flag is off, the sweep will no-op against fixtures.
  // Tell the customer instead of pretending a sync ran.
  if (!isBuildiumLive()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_live',
        message:
          'Buildium live mode is not enabled yet (BUILDIUM_ADAPTER_LIVE). Your service partner flips this on after your key is verified — your first chase run lands that night.',
      },
      { status: 409 },
    );
  }

  await inngest.send({
    name: RENT_COLLECTION_CHASE_SWEEP_TRIGGER_EVENT,
    data: { workspaceId, requestedBy: session.userId },
  });

  return NextResponse.json({ ok: true });
}
