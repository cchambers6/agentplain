/**
 * lib/approvals/content-ephemerality.ts
 *
 * Approval-queue content minimization.
 *
 * A WorkApprovalQueueItem's `payload` carries the actual draft text and any
 * customer data the work referenced (the email body, the contact details,
 * the invoice line items). While the item is PENDING that content MUST
 * persist — a decision needs something to decide on. But once the item is
 * decided and the work has run, the body is historical: keeping it forever
 * would make the approval queue a long-term store of customer content, which
 * is exactly what the data-minimization commitment rules out.
 *
 * So: `redactExpiredApprovalContent` runs daily and, for items that were
 * DECIDED more than `DEFAULT_REDACTION_DAYS` (7) ago, replaces the payload
 * with a structural stub — the top-level key NAMES are kept (so the audit
 * trail shows "this had a draftBody, a recipientEmail, a subject") but the
 * VALUES are gone. The item itself survives for the customer's audit record
 * (what kind of work, when, who decided); the content does not.
 *
 * Safety: only DECIDED items (status != PENDING) past the window are touched.
 * The decision + execution path reads the payload at decision time; by the
 * time redaction runs the work is long complete, so the approval flow is
 * never affected. Pending items are never redacted.
 */

import type { Prisma, PrismaClient, WorkApprovalStatus } from '@prisma/client';
import { withSystemContext } from '../db/rls';
import { getLogger } from '../observability';

export const DEFAULT_REDACTION_DAYS = 7;

/** Marker key set on a redacted payload. */
export const REDACTION_MARKER = '_redacted';

export interface RedactedPayload {
  _redacted: true;
  _redactedAt: string;
  /** Top-level key names that USED to be present (values removed). */
  _originalKeys: string[];
  [k: string]: unknown;
}

/** True when a payload has already been redacted by this layer. */
export function isRedacted(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>)[REDACTION_MARKER] === true
  );
}

/**
 * Produce the redacted stub for a payload. Keeps the SHAPE (top-level key
 * names) for the audit trail; drops every value. Non-object payloads collapse
 * to the bare marker.
 */
export function redactApprovalPayload(
  payload: unknown,
  redactedAt: Date,
): RedactedPayload {
  const originalKeys =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? Object.keys(payload as Record<string, unknown>).filter(
          (k) => k !== REDACTION_MARKER,
        )
      : [];
  return {
    _redacted: true,
    _redactedAt: redactedAt.toISOString(),
    _originalKeys: originalKeys,
  };
}

const DECIDED_STATUSES: readonly WorkApprovalStatus[] = [
  'APPROVED',
  'REJECTED',
  'AUTO_APPROVED',
  'EXPIRED',
];

interface CandidateRow {
  id: string;
  payload: Prisma.JsonValue;
}

export interface RedactExpiredApprovalContentArgs {
  now?: Date;
  /** Days after the decision before content is redacted. */
  retentionDays?: number;
  /** Max items to redact per run (bounds a single sweep). */
  batchSize?: number;
  /** Override the candidate lister (tests). */
  listCandidates?: (cutoff: Date, take: number) => Promise<CandidateRow[]>;
  /** Override the per-item redactor (tests). */
  redactItem?: (id: string, payload: RedactedPayload) => Promise<void>;
  /** Prisma client override (tests). */
  client?: PrismaClient;
}

export interface RedactExpiredApprovalContentResult {
  candidatesScanned: number;
  redacted: number;
  alreadyRedacted: number;
}

/**
 * Sweep: redact the content of approval-queue items decided longer than the
 * retention window ago. Idempotent — already-redacted items are skipped.
 */
export async function redactExpiredApprovalContent(
  args: RedactExpiredApprovalContentArgs = {},
): Promise<RedactExpiredApprovalContentResult> {
  const now = args.now ?? new Date();
  const retentionDays = args.retentionDays ?? DEFAULT_REDACTION_DAYS;
  const batchSize = Math.min(args.batchSize ?? 500, 2000);
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const listCandidates =
    args.listCandidates ??
    ((cut: Date, take: number) =>
      withSystemContext(
        (tx) =>
          tx.workApprovalQueueItem.findMany({
            where: {
              status: { in: DECIDED_STATUSES as WorkApprovalStatus[] },
              // Decided items: use decidedAt when present, else fall back to
              // proposedAt (covers EXPIRED rows that never got a decidedAt).
              OR: [
                { decidedAt: { lt: cut } },
                { AND: [{ decidedAt: null }, { proposedAt: { lt: cut } }] },
              ],
            },
            select: { id: true, payload: true },
            orderBy: { proposedAt: 'asc' },
            take,
          }) as Promise<CandidateRow[]>,
      ));

  const redactItem =
    args.redactItem ??
    ((id: string, payload: RedactedPayload) =>
      withSystemContext(async (tx) => {
        await tx.workApprovalQueueItem.update({
          where: { id },
          data: { payload: payload as unknown as Prisma.InputJsonValue },
        });
      }));

  const candidates = await listCandidates(cutoff, batchSize);
  const result: RedactExpiredApprovalContentResult = {
    candidatesScanned: candidates.length,
    redacted: 0,
    alreadyRedacted: 0,
  };

  for (const row of candidates) {
    if (isRedacted(row.payload)) {
      result.alreadyRedacted += 1;
      continue;
    }
    try {
      await redactItem(row.id, redactApprovalPayload(row.payload, now));
      result.redacted += 1;
    } catch (err) {
      getLogger().warn('approval content redaction failed for item (non-fatal)', {
        item_id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
