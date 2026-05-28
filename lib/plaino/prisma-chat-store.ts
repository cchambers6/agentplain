/**
 * lib/plaino/prisma-chat-store.ts
 *
 * Production IChatStore. Encrypts message bodies at rest via the v1
 * envelope (lib/security/encryption — `v1:iv:tag:ct`, identical shape
 * to the IntegrationCredential token envelope). Reads decrypt back to
 * plaintext before returning.
 *
 * Workspace isolation is delegated to the database — every operation
 * runs through `withRls` under the workspace's RlsContext, and the
 * Postgres RLS policies on ChatThread + ChatMessage drop foreign
 * rows. We also assert the workspaceId on read as defense-in-depth,
 * mirroring the retrieveCustomerContext pattern.
 *
 * Per project_no_outbound_architecture: writes only land in this
 * workspace's two tables; this store never reaches outside the schema.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';
import { decrypt, encrypt } from '../security/encryption';
import {
  type IChatStore,
  type PersistedChatMessage,
} from './types';

export interface PrismaChatStoreOptions {
  /** RLS context used for every operation. Defaults to a workspace-
   *  scoped customer context. */
  ctx?: RlsContext;
  /** Override the Prisma client. Tests pass a stub. */
  client?: PrismaClient;
}

/**
 * The Plaino chat store backed by Prisma. Constructed per server-action
 * invocation — each request has its own ctx + workspaceId. The store
 * also exposes `createSupportRequest` so the dispatcher's REGISTER
 * path can hand off to the support-handler without a second store
 * abstraction; this keeps the chat store as the single
 * workspace-isolation seam.
 */
export class PrismaChatStore implements IChatStore {
  readonly name = 'prisma' as const;

  constructor(
    private readonly workspaceId: string,
    private readonly options: PrismaChatStoreOptions = {},
  ) {}

  private ctx(): RlsContext {
    return (
      this.options.ctx ?? {
        userId: null,
        workspaceId: this.workspaceId,
        isOperator: false,
      }
    );
  }

  private rlsOptions(): { client?: PrismaClient } | undefined {
    return this.options.client ? { client: this.options.client } : undefined;
  }

  async ensureWorkspaceThread(args: {
    workspaceId: string;
    now?: Date;
  }): Promise<{ id: string; title: string }> {
    this.assertWorkspace(args.workspaceId);
    return withRls(
      this.ctx(),
      async (tx) => {
        const existing = await tx.chatThread.findFirst({
          where: { workspaceId: args.workspaceId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, title: true },
        });
        if (existing) return existing;
        const created = await tx.chatThread.create({
          data: {
            workspaceId: args.workspaceId,
            // Use the schema default but bind it here for clarity.
            title: 'talk with Plaino',
          },
          select: { id: true, title: true },
        });
        return created;
      },
      this.rlsOptions(),
    );
  }

  async appendMessage(args: {
    threadId: string;
    workspaceId: string;
    role: 'customer' | 'plaino';
    body: string;
    metadata?: Record<string, unknown> | null;
    now?: Date;
  }): Promise<PersistedChatMessage> {
    this.assertWorkspace(args.workspaceId);
    const ciphertext = encrypt(args.body);
    const metadata = args.metadata ?? null;
    return withRls(
      this.ctx(),
      async (tx) => {
        const row = await tx.chatMessage.create({
          data: {
            threadId: args.threadId,
            workspaceId: args.workspaceId,
            role: args.role,
            body: ciphertext,
            metadata: metadata as Prisma.InputJsonValue | undefined,
          },
          select: {
            id: true,
            threadId: true,
            workspaceId: true,
            role: true,
            body: true,
            metadata: true,
            createdAt: true,
          },
        });
        // Bump the thread's updatedAt so listing surfaces in /talk
        // order by recency without a join.
        await tx.chatThread.update({
          where: { id: args.threadId },
          data: { updatedAt: new Date() },
        });
        return this.toMessage(row);
      },
      this.rlsOptions(),
    );
  }

  async listMessages(args: {
    threadId: string;
    workspaceId: string;
    limit?: number;
  }): Promise<PersistedChatMessage[]> {
    this.assertWorkspace(args.workspaceId);
    const cap = clampLimit(args.limit);
    return withRls(
      this.ctx(),
      async (tx) => {
        const rows = await tx.chatMessage.findMany({
          where: {
            threadId: args.threadId,
            workspaceId: args.workspaceId,
          },
          orderBy: { createdAt: 'asc' },
          take: cap,
          select: {
            id: true,
            threadId: true,
            workspaceId: true,
            role: true,
            body: true,
            metadata: true,
            createdAt: true,
          },
        });
        return rows.map((r) => this.toMessage(r));
      },
      this.rlsOptions(),
    );
  }

  /**
   * Create a SupportRequest row for the REGISTER hand-off. Lives on
   * the chat store because it shares the workspace-isolation envelope
   * and means the dispatcher does not need a second store seam.
   * Returns the new SupportRequest id.
   */
  async createSupportRequest(args: {
    workspaceId: string;
    fromUserId: string;
    subject: string;
    body: string;
  }): Promise<string> {
    this.assertWorkspace(args.workspaceId);
    return withRls(
      this.ctx(),
      async (tx) => {
        const created = await tx.supportRequest.create({
          data: {
            workspaceId: args.workspaceId,
            fromUserId: args.fromUserId,
            subject: args.subject,
            body: args.body,
          },
          select: { id: true },
        });
        return created.id;
      },
      this.rlsOptions(),
    );
  }

  private assertWorkspace(workspaceId: string): void {
    if (workspaceId !== this.workspaceId) {
      // Defense-in-depth — caller-side workspaceId mismatch is a bug
      // even before RLS rejects it. Throwing loud beats silent leak.
      throw new Error(
        `PrismaChatStore: workspaceId mismatch (store=${this.workspaceId}, arg=${workspaceId})`,
      );
    }
  }

  private toMessage(row: {
    id: string;
    threadId: string;
    workspaceId: string;
    role: string;
    body: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): PersistedChatMessage {
    return {
      id: row.id,
      threadId: row.threadId,
      workspaceId: row.workspaceId,
      role: row.role === 'plaino' ? 'plaino' : 'customer',
      body: decrypt(row.body),
      metadata: toRecordJson(row.metadata),
      createdAt: row.createdAt,
    };
  }
}

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 200;
  return Math.min(Math.floor(raw), 500);
}

function toRecordJson(
  v: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  return v as unknown as Record<string, unknown>;
}
