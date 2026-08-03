/**
 * lib/plaino/memory/recording-memory-store.ts
 *
 * In-memory IMemoryStore for tests. Records every call so assertions can
 * pin write order + payload shape. NOT a production path — workspace
 * isolation is enforced by an explicit per-store workspaceId; the
 * production posture is RLS.
 */

import { randomUUID } from 'node:crypto';
import {
  assertProvenance,
  buildProvenance,
  type Provenance,
} from '../../provenance/types';
import type {
  IMemoryStore,
  MemoryEntry,
  MemoryKind,
} from './types';

export interface RecordingMemoryStoreOptions {
  /** Pre-seed entries (each gets a generated id + timestamps).
   *
   *  `provenance` is optional here and ONLY here: a seeded entry stands
   *  in for a row that already existed before the test ran, including the
   *  legacy rows production genuinely has. Omitting it yields null — the
   *  same "we no longer know" a pre-2026-08 row carries. Every entry that
   *  arrives through `upsert` still goes through the door. */
  seed?: Array<
    Omit<
      MemoryEntry,
      'id' | 'createdAt' | 'updatedAt' | 'lastReadAt' | 'provenance'
    > & { provenance?: Provenance | null }
  >;
}

export class RecordingMemoryStore implements IMemoryStore {
  readonly name = 'recording' as const;

  readonly entries: MemoryEntry[] = [];
  readonly markReadCalls: Array<{ ids: string[]; at: Date }> = [];

  constructor(
    private readonly workspaceId: string,
    options: RecordingMemoryStoreOptions = {},
  ) {
    if (options.seed) {
      for (const e of options.seed) {
        const now = new Date();
        this.entries.push({
          id: randomUUID(),
          workspaceId: e.workspaceId,
          kind: e.kind,
          title: e.title,
          body: e.body,
          sourceChatMessageId: e.sourceChatMessageId,
          provenance: e.provenance ?? null,
          pinned: e.pinned,
          createdAt: now,
          updatedAt: now,
          lastReadAt: null,
        });
      }
    }
  }

  async listForWorkspace(args: {
    workspaceId: string;
    limit?: number;
  }): Promise<MemoryEntry[]> {
    this.assertWorkspace(args.workspaceId);
    const cap = args.limit ?? 500;
    const sorted = [...this.entries].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return sorted.slice(0, cap);
  }

  async markRead(args: {
    workspaceId: string;
    ids: string[];
    now?: Date;
  }): Promise<void> {
    this.assertWorkspace(args.workspaceId);
    if (args.ids.length === 0) return;
    const at = args.now ?? new Date();
    this.markReadCalls.push({ ids: [...args.ids], at });
    for (const e of this.entries) {
      if (args.ids.includes(e.id)) e.lastReadAt = at;
    }
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
    // Same door as the Prisma impl. A fake that accepted writes the real
    // store rejects would let a provenance-less caller pass its tests and
    // fail in production — the two implementations must agree on refusal,
    // not just on success.
    const provenance = assertProvenance('memory-entry', args.provenance);
    const now = args.now ?? new Date();
    const normalizedTitle = args.title.trim();
    const existing = this.entries.find(
      (e) => e.kind === args.kind && e.title === normalizedTitle,
    );
    if (existing) {
      existing.body = args.body;
      existing.sourceChatMessageId = args.sourceChatMessageId;
      // Re-stamped on update, mirroring the Prisma impl: the citation
      // describes the write that put the current body here.
      existing.provenance = provenance;
      existing.updatedAt = now;
      return existing;
    }
    const created: MemoryEntry = {
      id: randomUUID(),
      workspaceId: args.workspaceId,
      kind: args.kind,
      title: normalizedTitle,
      body: args.body,
      sourceChatMessageId: args.sourceChatMessageId,
      provenance,
      pinned: false,
      createdAt: now,
      updatedAt: now,
      lastReadAt: null,
    };
    this.entries.push(created);
    return created;
  }

  async setPinned(args: {
    workspaceId: string;
    id: string;
    pinned: boolean;
    now?: Date;
  }): Promise<MemoryEntry> {
    this.assertWorkspace(args.workspaceId);
    const e = this.entries.find((x) => x.id === args.id);
    if (!e) throw new Error(`RecordingMemoryStore: entry ${args.id} not found`);
    e.pinned = args.pinned;
    e.updatedAt = args.now ?? new Date();
    return e;
  }

  async edit(args: {
    workspaceId: string;
    id: string;
    title: string;
    body: string;
    now?: Date;
  }): Promise<MemoryEntry> {
    this.assertWorkspace(args.workspaceId);
    const e = this.entries.find((x) => x.id === args.id);
    if (!e) throw new Error(`RecordingMemoryStore: entry ${args.id} not found`);
    e.title = args.title.trim();
    e.body = args.body;
    // The customer vouching for the fact in their own words — the one
    // path that legitimately produces verified:true. Stamped here, never
    // accepted from the caller.
    e.provenance = buildProvenance({
      sourceType: 'customer-edit',
      origin: 'customer',
      recordType: 'memory-entry',
      sourceRef: `WorkspaceMemoryEntry:${args.id}`,
      storedBy: 'customer',
      confidence: 1,
      verified: true,
      now: args.now,
    });
    e.updatedAt = args.now ?? new Date();
    return e;
  }

  async delete(args: { workspaceId: string; id: string }): Promise<boolean> {
    this.assertWorkspace(args.workspaceId);
    const i = this.entries.findIndex((e) => e.id === args.id);
    if (i === -1) return false;
    this.entries.splice(i, 1);
    return true;
  }

  private assertWorkspace(workspaceId: string): void {
    if (workspaceId !== this.workspaceId) {
      throw new Error(
        `RecordingMemoryStore: workspaceId mismatch (store=${this.workspaceId}, arg=${workspaceId})`,
      );
    }
  }
}
