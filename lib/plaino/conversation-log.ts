/**
 * lib/plaino/conversation-log.ts
 *
 * Persistence for the PlainoConversation log — one row per conversation
 * across both front-door surfaces (marketing widget + in-app support
 * chat). Feeds the drift sweep + voice-fingerprinting passes.
 *
 * Per feedback_no_silent_vendor_lock: the route never touches Prisma for
 * this table directly; it calls these functions. Per the encryption-at-
 * rest posture (lib/security/payload-crypto), `turns` is written as an
 * AES-256-GCM envelope and read back through the same codec — a SUPPORT
 * transcript can carry customer specifics, and MARKETING uses the same
 * wire format so there is one thing to audit.
 *
 * RLS:
 *   - MARKETING writes go through withSystemContext (operator identity):
 *     the visitor is anonymous, the row has a NULL workspaceId, and the
 *     PlainoConversation policy's operator clause covers the write.
 *   - SUPPORT writes go through the signed-in member's RLS context so the
 *     workspace-isolation clause is satisfied directly — no operator
 *     escalation for a customer-initiated write.
 */

import type { PlainoConversationMode } from '@prisma/client';
import { withRls, withSystemContext, type RlsContext } from '@/lib/db/rls';
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from '@/lib/security/payload-crypto';

export interface PlainoTurn {
  role: 'user' | 'plaino';
  body: string;
  /** ISO-8601 timestamp the turn was recorded. */
  at: string;
}

export interface PersistConversationArgs {
  mode: PlainoConversationMode;
  /** Set for SUPPORT, null for MARKETING (anonymous). */
  workspaceId: string | null;
  /** Anonymous browser session id (MARKETING) or the user id (SUPPORT). */
  sessionId: string;
  /** Marketing route the widget was opened on. Null for SUPPORT. */
  sourcePage?: string | null;
  /** Existing conversation to append to; omit to start a new one. */
  conversationId?: string | null;
  /** The full turn list as it stands after this exchange. */
  turns: PlainoTurn[];
}

/**
 * Create or update a PlainoConversation row, returning its id. The caller
 * passes the full `turns` array each time (the conversation is small —
 * a chat-widget session — so rewriting the envelope is cheaper than
 * append-in-place + decrypt-merge, and keeps the row a single source of
 * truth for the drift sweep).
 */
export async function persistConversation(
  args: PersistConversationArgs,
): Promise<string> {
  const encryptedTurns = encryptPayloadForWrite(args.turns);
  const run = <T>(fn: (tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>) =>
    args.mode === 'SUPPORT' && args.workspaceId
      ? withRls(supportContext(args.sessionId, args.workspaceId), fn)
      : withSystemContext(fn);

  return run(async (tx) => {
    if (args.conversationId) {
      const updated = await tx.plainoConversation.updateMany({
        where: { id: args.conversationId },
        data: { turns: encryptedTurns },
      });
      // updateMany returns a count; when the row exists we keep its id.
      if (updated.count > 0) return args.conversationId;
      // Fall through to create when the id did not match (e.g. a stale
      // client id) so a turn is never silently dropped.
    }
    const row = await tx.plainoConversation.create({
      data: {
        mode: args.mode,
        workspaceId: args.workspaceId,
        sessionId: args.sessionId,
        sourcePage: args.sourcePage ?? null,
        turns: encryptedTurns,
      },
      select: { id: true },
    });
    return row.id;
  });
}

/**
 * Mark a MARKETING conversation as having produced a captured lead. Runs
 * under the operator context (the capture endpoint is anonymous). Best-
 * effort: a failure here never blocks the lead row itself.
 */
export async function markConversationLeadCaptured(
  conversationId: string,
): Promise<void> {
  await withSystemContext((tx) =>
    tx.plainoConversation.updateMany({
      where: { id: conversationId },
      data: { leadCaptured: true },
    }),
  );
}

/**
 * Read a conversation's decrypted turns. Operator/system identity — used
 * by the drift sweep + any operator inspection surface. Returns null when
 * the row is missing or the envelope cannot be decrypted (graceful-
 * degrade, mirroring decryptPayloadForRead).
 */
export async function getConversationTurns(
  conversationId: string,
): Promise<PlainoTurn[] | null> {
  const row = await withSystemContext((tx) =>
    tx.plainoConversation.findUnique({
      where: { id: conversationId },
      select: { turns: true },
    }),
  );
  if (!row) return null;
  const decoded = decryptPayloadForRead(row.turns);
  if (!Array.isArray(decoded)) return null;
  return decoded as PlainoTurn[];
}

function supportContext(userId: string, workspaceId: string): RlsContext {
  return { userId, workspaceId, isOperator: false };
}
