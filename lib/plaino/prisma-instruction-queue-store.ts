/**
 * lib/plaino/prisma-instruction-queue-store.ts
 *
 * Production `IInstructionQueueStore`. Reads the encrypted payload of
 * a PLAINO_INSTRUCTION WorkApprovalQueueItem and persists the drafted
 * reply back into the same row's payload. Row status stays PENDING so
 * the operator queue continues to surface it for review — only the
 * payload's `status` field flips from `drafting` → `awaiting_review`.
 *
 * Per `feedback_no_silent_vendor_lock`: Prisma is the only external
 * dependency here; the rest of the handler talks to this through the
 * port.
 *
 * Per `project_no_outbound_architecture`: this module READS + WRITES
 * one DB row. It does not emit any outbound message.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from '../security/payload-crypto';
import type {
  IInstructionQueueStore,
  InstructionDraft,
  InstructionQueueItem,
} from './instruction-handler';

export interface PrismaInstructionQueueStoreOptions {
  /** Override the RLS context. Production is an operator-tier context
   *  (no userId, isOperator=true) because the Inngest handler runs
   *  with no session — mirrors the PrismaApprovalSink pattern. */
  ctx?: RlsContext;
  /** Override the Prisma client. Tests pass a stub. */
  client?: PrismaClient;
}

export class PrismaInstructionQueueStore implements IInstructionQueueStore {
  readonly name = 'prisma' as const;

  constructor(
    private readonly workspaceId: string,
    private readonly options: PrismaInstructionQueueStoreOptions = {},
  ) {}

  private ctx(): RlsContext {
    return (
      this.options.ctx ?? {
        userId: null,
        workspaceId: this.workspaceId,
        isOperator: true,
      }
    );
  }

  private rlsOptions(): { client?: PrismaClient } | undefined {
    return this.options.client ? { client: this.options.client } : undefined;
  }

  async readForDrafting(args: {
    approvalQueueItemId: string;
  }): Promise<InstructionQueueItem | null> {
    return withRls(
      this.ctx(),
      async (tx) => {
        const row = await tx.workApprovalQueueItem.findUnique({
          where: { id: args.approvalQueueItemId },
          select: {
            id: true,
            workspaceId: true,
            kind: true,
            discipline: true,
            payload: true,
          },
        });
        if (!row) return null;
        if (row.kind !== 'PLAINO_INSTRUCTION') return null;
        if (row.workspaceId !== this.workspaceId) {
          // RLS would have dropped this, but defense-in-depth.
          return null;
        }
        const payload = decryptPayloadForRead(row.payload);
        if (!isRecord(payload)) return null;
        // Re-firing on a row that's already drafted is a no-op.
        if (payload.status !== 'drafting') return null;
        const instructionText =
          typeof payload.instructionText === 'string'
            ? payload.instructionText
            : '';
        if (instructionText.length === 0) return null;
        const targetDiscipline =
          typeof payload.targetDiscipline === 'string'
            ? payload.targetDiscipline
            : (row.discipline ?? '');
        const sourceChatMessageId =
          typeof payload.sourceChatMessageId === 'string'
            ? payload.sourceChatMessageId
            : '';
        const sourceUserId =
          typeof payload.sourceUserId === 'string' ? payload.sourceUserId : '';
        const reasoning =
          typeof payload.reasoning === 'string'
            ? payload.reasoning
            : 'no reasoning recorded';
        return {
          approvalQueueItemId: row.id,
          workspaceId: row.workspaceId,
          instructionText,
          targetDiscipline,
          sourceChatMessageId,
          sourceUserId,
          reasoning,
        };
      },
      this.rlsOptions(),
    );
  }

  async attachDraft(args: {
    approvalQueueItemId: string;
    workspaceId: string;
    draft: InstructionDraft;
    now?: Date;
  }): Promise<void> {
    if (args.workspaceId !== this.workspaceId) {
      throw new Error(
        `PrismaInstructionQueueStore.attachDraft: workspaceId mismatch ` +
          `(store=${this.workspaceId}, arg=${args.workspaceId})`,
      );
    }
    const now = args.now ?? new Date();
    await withRls(
      this.ctx(),
      async (tx) => {
        const row = await tx.workApprovalQueueItem.findUnique({
          where: { id: args.approvalQueueItemId },
          select: { payload: true, workspaceId: true, kind: true },
        });
        if (!row) return;
        if (row.kind !== 'PLAINO_INSTRUCTION') return;
        if (row.workspaceId !== this.workspaceId) return;
        const existing = decryptPayloadForRead(row.payload);
        const merged = {
          ...(isRecord(existing) ? existing : {}),
          status: 'awaiting_review',
          draftBody: args.draft.draftBody,
          draftedAt: now.toISOString(),
          draftReasoning: args.draft.reasoning,
          honoredRules: args.draft.honoredRules.map((r) => ({
            entryId: r.entryId,
            scope: r.scope,
            rule: r.rule,
          })),
        };
        await tx.workApprovalQueueItem.update({
          where: { id: args.approvalQueueItemId },
          data: {
            payload: encryptPayloadForWrite(merged) as Prisma.InputJsonValue,
          },
        });
      },
      this.rlsOptions(),
    );
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
