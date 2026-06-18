'use server';

/**
 * Server action for the Day-7 trial-guarantee walk-away. BROKER_OWNER-
 * gated. One tap: refund the customer, delete their data, close the
 * workspace — all behind the idempotent `executeWalkAway` executor.
 *
 * Per the mission: walk-away is a one-tap commitment, so this action does
 * the whole thing in one call. The executor guards itself (once-per-
 * lifetime OpsFlag + Stripe idempotency key), so a double-submit is safe.
 */

import { z } from 'zod';
import { requireWorkspaceMember } from '@/lib/auth';
import { executeWalkAway, type WalkAwayStatus } from '@/lib/guarantee/walk-away';

const schema = z.object({ workspaceId: z.string().uuid() });

export interface AcceptWalkAwayResult {
  ok: boolean;
  status?: WalkAwayStatus;
  refundedUsdCents?: number;
  error?: string;
}

export async function acceptWalkAway(
  input: z.infer<typeof schema>,
): Promise<AcceptWalkAwayResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid request' };
  // BROKER_OWNER only — walking away deletes the workspace's data.
  await requireWorkspaceMember(parsed.data.workspaceId, ['BROKER_OWNER']);
  try {
    const result = await executeWalkAway({ workspaceId: parsed.data.workspaceId });
    return {
      ok: true,
      status: result.status,
      refundedUsdCents: result.refundedUsdCents,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'walk-away failed',
    };
  }
}
