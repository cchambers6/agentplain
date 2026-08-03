/**
 * lib/plaino/memory/prisma-memory-store.ts
 *
 * Production IMemoryStore. Encrypts `body` at rest with the v1 envelope
 * (`lib/security/encryption` — `v1:iv:tag:ct`, same shape as
 * ChatMessage.body + IntegrationCredential tokens). Reads decrypt back
 * to plaintext before returning.
 *
 * Workspace isolation is delegated to the database — every operation
 * runs through `withRls` under the workspace's RlsContext, and the
 * Postgres RLS policy on WorkspaceMemoryEntry drops foreign rows. We
 * also assert the workspaceId on read as defense-in-depth, mirroring
 * the chat-store pattern.
 *
 * Per project_no_outbound_architecture: writes only land in this
 * workspace's memory table; this store never reaches outside the schema.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../../db/rls';
import {
  assertProvenance,
  buildProvenance,
  parseStoredProvenance,
  type Provenance,
} from '../../provenance/types';
import { decrypt, encrypt } from '../../security/encryption';
import {
  type IMemoryStore,
  type MemoryEntry,
  type MemoryKind,
} from './types';

export interface PrismaMemoryStoreOptions {
  ctx?: RlsContext;
  client?: PrismaClient;
}

export class PrismaMemoryStore implements IMemoryStore {
  readonly name = 'prisma' as const;

  constructor(
    private readonly workspaceId: string,
    private readonly options: PrismaMemoryStoreOptions = {},
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

  async listForWorkspace(args: {
    workspaceId: string;
    limit?: number;
  }): Promise<MemoryEntry[]> {
    this.assertWorkspace(args.workspaceId);
    const cap = clampLimit(args.limit);
    return withRls(
      this.ctx(),
      async (tx) => {
        const rows = await tx.workspaceMemoryEntry.findMany({
          where: { workspaceId: args.workspaceId },
          // Pinned first, then newest first. The composite index
          // (workspaceId, kind, pinned, createdAt) covers this query
          // for the per-kind read path; the
          // (workspaceId, pinned, updatedAt) index covers the global
          // memory-page read.
          orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
          take: cap,
        });
        return rows.map((r) => this.toEntry(r));
      },
      this.rlsOptions(),
    );
  }

  async markRead(args: {
    workspaceId: string;
    ids: string[];
    now?: Date;
  }): Promise<void> {
    this.assertWorkspace(args.workspaceId);
    if (args.ids.length === 0) return;
    const now = args.now ?? new Date();
    await withRls(
      this.ctx(),
      async (tx) => {
        await tx.workspaceMemoryEntry.updateMany({
          where: {
            workspaceId: args.workspaceId,
            id: { in: args.ids },
          },
          data: { lastReadAt: now },
        });
      },
      this.rlsOptions(),
    );
  }

  async upsert(args: {
    workspaceId: string;
    kind: MemoryKind;
    title: string;
    body: string;
    sourceChatMessageId: string | null;
    provenance: Provenance;
    now?: Date;
  }): Promise<MemoryEntry> {
    this.assertWorkspace(args.workspaceId);
    // The door, BEFORE the encrypt + the transaction: a caller who did
    // not say where this fact came from gets a throw, not a row.
    const provenance = assertProvenance('memory-entry', args.provenance);
    const ciphertext = encrypt(args.body);
    const normalizedTitle = args.title.trim();
    return withRls(
      this.ctx(),
      async (tx) => {
        const existing = await tx.workspaceMemoryEntry.findFirst({
          where: {
            workspaceId: args.workspaceId,
            kind: args.kind,
            title: normalizedTitle,
          },
          select: { id: true },
        });
        if (existing) {
          const updated = await tx.workspaceMemoryEntry.update({
            where: { id: existing.id },
            data: {
              body: ciphertext,
              sourceChatMessageId: args.sourceChatMessageId,
              // Re-stamp on update: the citation must describe the write
              // that put the CURRENT body here, not the first one. A
              // stale block would cite a turn that no longer says this.
              provenance: provenance as unknown as Prisma.InputJsonObject,
            },
          });
          return this.toEntry(updated);
        }
        const created = await tx.workspaceMemoryEntry.create({
          data: {
            workspaceId: args.workspaceId,
            kind: args.kind,
            title: normalizedTitle,
            body: ciphertext,
            sourceChatMessageId: args.sourceChatMessageId,
            provenance: provenance as unknown as Prisma.InputJsonObject,
          },
        });
        return this.toEntry(created);
      },
      this.rlsOptions(),
    );
  }

  async setPinned(args: {
    workspaceId: string;
    id: string;
    pinned: boolean;
    now?: Date;
  }): Promise<MemoryEntry> {
    this.assertWorkspace(args.workspaceId);
    return withRls(
      this.ctx(),
      async (tx) => {
        const updated = await tx.workspaceMemoryEntry.update({
          where: { id: args.id },
          data: { pinned: args.pinned },
        });
        return this.toEntry(updated);
      },
      this.rlsOptions(),
    );
  }

  async edit(args: {
    workspaceId: string;
    id: string;
    title: string;
    body: string;
    now?: Date;
  }): Promise<MemoryEntry> {
    this.assertWorkspace(args.workspaceId);
    const ciphertext = encrypt(args.body);
    const normalizedTitle = args.title.trim();
    // A customer editing a memory entry is the customer vouching for the
    // fact in their own words — the one write path in the system that
    // legitimately produces `verified: true`. Stamped here, not accepted
    // from the caller, so nothing else can claim the customer said it.
    const provenance = buildProvenance({
      sourceType: 'customer-edit',
      origin: 'customer',
      recordType: 'memory-entry',
      sourceRef: `WorkspaceMemoryEntry:${args.id}`,
      storedBy: 'customer',
      confidence: 1,
      verified: true,
      now: args.now,
    });
    return withRls(
      this.ctx(),
      async (tx) => {
        const updated = await tx.workspaceMemoryEntry.update({
          where: { id: args.id },
          data: {
            title: normalizedTitle,
            body: ciphertext,
            provenance: provenance as unknown as Prisma.InputJsonObject,
          },
        });
        return this.toEntry(updated);
      },
      this.rlsOptions(),
    );
  }

  async delete(args: { workspaceId: string; id: string }): Promise<boolean> {
    this.assertWorkspace(args.workspaceId);
    return withRls(
      this.ctx(),
      async (tx) => {
        const r = await tx.workspaceMemoryEntry.deleteMany({
          where: { id: args.id, workspaceId: args.workspaceId },
        });
        return r.count > 0;
      },
      this.rlsOptions(),
    );
  }

  private assertWorkspace(workspaceId: string): void {
    if (workspaceId !== this.workspaceId) {
      throw new Error(
        `PrismaMemoryStore: workspaceId mismatch (store=${this.workspaceId}, arg=${workspaceId})`,
      );
    }
  }

  private toEntry(row: {
    id: string;
    workspaceId: string;
    kind: MemoryKind;
    title: string;
    body: string;
    sourceChatMessageId: string | null;
    provenance?: Prisma.JsonValue | null;
    pinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastReadAt: Date | null;
  }): MemoryEntry {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      kind: row.kind,
      title: row.title,
      body: decrypt(row.body),
      sourceChatMessageId: row.sourceChatMessageId,
      // LENIENT on read, strict on write. A legacy row (NULL) or a block
      // from some future shape we can't parse must never break the
      // customer's memory page — it degrades to "no citation shown",
      // which is honest. Only the write door throws.
      provenance: parseStoredProvenance(row.provenance ?? null),
      pinned: row.pinned,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastReadAt: row.lastReadAt,
    };
  }
}

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 500;
  return Math.min(Math.floor(raw), 1_000);
}

// Suppress unused import error when Prisma's namespace types aren't
// directly referenced; we keep the import so future evolutions of
// `WorkspaceMemoryEntry` (e.g. JSON metadata) can use Prisma.* types.
export const __testing = {
  unused: (_v: Prisma.JsonValue | null): void => undefined,
};
