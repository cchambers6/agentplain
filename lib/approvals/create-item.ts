/**
 * lib/approvals/create-item.ts
 *
 * THE ONE DOOR every WorkApprovalQueueItem row goes through.
 *
 * Before this module there were ~25 scattered `tx.workApprovalQueueItem
 * .create(...)` calls — one per skill sink, two in the persist seam, two
 * in the voice paths, several in the connector/portal approval gates, one
 * in the demo seed. Every one of them decided for itself what the row
 * meant, and none of them recorded where the row came from. When an owner
 * asked "why is this in my queue?", the honest answer was "read the
 * calling code" — and there were 25 answers.
 *
 * Per feedback_no_quick_fixes: the fix is not a convention that every new
 * writer must remember. It is a single door that REQUIRES a provenance
 * block as an argument and calls `assertProvenance` before it touches the
 * database. A caller who forgets is a type error; a caller who passes a
 * malformed block gets a ProvenanceError instead of a row.
 *
 * The repo-scan test in `create-item.test.ts` closes the loop: it greps
 * lib/, app/ and prisma/ for `workApprovalQueueItem.create(` and asserts
 * this file is the only hit. A future writer who bypasses the door fails
 * CI rather than quietly re-introducing an unattributable row. (Same
 * enforcement shape the trust module uses to pin permission + source.)
 *
 * Per project_no_outbound_architecture: writing an approval row sends
 * nothing. It stages work for a human decision — which is precisely why
 * the human deserves to know where the work came from.
 */

import type { Prisma } from '@prisma/client';
import { assertProvenance, buildProvenance, type Provenance } from '../provenance/types';

export interface CreateWorkApprovalItemInput {
  /** The row exactly as the caller composed it — this module does not
   *  reinterpret kind/status/payload. It only adds the citation. */
  data: Prisma.WorkApprovalQueueItemUncheckedCreateInput;
  /** Where this item came from. Validated before the write; a bad block
   *  throws ProvenanceError and NO row lands. */
  provenance: Provenance;
}

/**
 * Create one WorkApprovalQueueItem, provenance-first.
 *
 * `assertProvenance` runs BEFORE the create call, so an invalid block
 * cannot produce a partial write — the transaction the caller owns is
 * untouched when the door rejects.
 *
 * Returns `{ id }` (the shape every existing call site already used via
 * `select: { id: true }`).
 */
export async function createWorkApprovalItem(
  tx: Prisma.TransactionClient,
  input: CreateWorkApprovalItemInput,
): Promise<{ id: string }> {
  const provenance = assertProvenance('approval-item', input.provenance);
  return tx.workApprovalQueueItem.create({
    data: {
      ...input.data,
      provenance: provenance as unknown as Prisma.InputJsonObject,
    },
    select: { id: true },
  });
}

/**
 * Provenance for the common case: an agent/skill staged this row while
 * doing its job.
 *
 * Reads the citation straight off the row the caller already built —
 * `agentSlug` is who wrote it, and `refTable:refId` is the artifact the
 * row is about (the webhook event, the lead, the knowledge document).
 * Deriving it from the row rather than from a hand-typed constant means
 * the citation cannot drift away from what the row actually points at.
 *
 * `verified` is false and stays false: a staged proposal is exactly the
 * thing a human has NOT vouched for yet. Approving it in /approvals is
 * that vouching — a separate, later, human act.
 */
export function skillRunApprovalProvenance(
  row: Pick<
    Prisma.WorkApprovalQueueItemUncheckedCreateInput,
    'agentSlug' | 'refTable' | 'refId'
  >,
  opts: { confidence?: number; now?: Date } = {},
): Provenance {
  return buildProvenance({
    sourceType: 'skill-run',
    origin: 'agent',
    recordType: 'approval-item',
    sourceRef: `${row.refTable}:${row.refId}`,
    storedBy: row.agentSlug,
    // 0.8 is the standing default for staged skill output: high enough
    // that we put it in front of a human, honestly short of certainty.
    // Sinks that know a real number for their own work pass it.
    confidence: opts.confidence ?? 0.8,
    verified: false,
    now: opts.now,
  });
}
