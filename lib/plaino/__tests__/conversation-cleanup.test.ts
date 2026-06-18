/**
 * Behavior tests for the conversation-cleanup sweep (DI — no DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import {
  cleanupWorkspaceConversations,
  runConversationCleanup,
} from '../conversation-cleanup';

type FakeTxClient = Prisma.TransactionClient;

const WS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('runConversationCleanup', () => {
  it('aggregates per-workspace deletions and captures failures', async () => {
    const result = await runConversationCleanup({
      listCandidates: async () => ['w1', 'w2', 'w3'],
      cleanupWorkspace: async (id) => {
        if (id === 'w2') throw new Error('boom');
        return { threadsDeleted: 2, messagesDeleted: 5 };
      },
    });
    assert.equal(result.workspacesConsidered, 3);
    assert.equal(result.threadsDeleted, 4);
    assert.equal(result.messagesDeleted, 10);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, 'w2');
  });
});

describe('cleanupWorkspaceConversations', () => {
  function fakeTx(opts: {
    tier: string | null;
    overrideDays: number | null;
    threads: Array<{ id: string; updatedAt: Date; retentionDays: number | null }>;
    messageCount: number;
  }) {
    const deletedIds: string[] = [];
    const tx = {
      subscription: {
        findUnique: async () => (opts.tier ? { tier: opts.tier } : null),
      },
      workspacePreference: {
        findUnique: async () =>
          opts.overrideDays === null ? null : { chatRetentionDays: opts.overrideDays },
      },
      chatThread: {
        findMany: async () => opts.threads,
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deletedIds.push(...where.id.in);
          return { count: where.id.in.length };
        },
      },
      chatMessage: {
        count: async () => opts.messageCount,
      },
    };
    return { tx, deletedIds };
  }

  it('deletes only threads past the resolved window', async () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const { tx, deletedIds } = fakeTx({
      tier: 'regular',
      overrideDays: null, // default = 2 days
      threads: [
        { id: 'old', updatedAt: new Date('2026-06-10T00:00:00Z'), retentionDays: null },
        { id: 'fresh', updatedAt: new Date('2026-06-17T18:00:00Z'), retentionDays: null },
      ],
      messageCount: 7,
    });

    const r = await cleanupWorkspaceConversations(WS, now, {
      client: tx as unknown as FakeTxClient,
    });
    assert.equal(r.threadsDeleted, 1);
    assert.equal(r.messagesDeleted, 7);
    assert.deepEqual(deletedIds, ['old']);
  });

  it('honors a per-thread retention override that keeps an otherwise-old thread', async () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const { tx, deletedIds } = fakeTx({
      tier: 'max',
      overrideDays: null,
      threads: [
        // 8 days old but pinned to 30-day retention → survives
        { id: 'pinned', updatedAt: new Date('2026-06-10T00:00:00Z'), retentionDays: 30 },
      ],
      messageCount: 0,
    });
    const r = await cleanupWorkspaceConversations(WS, now, {
      client: tx as unknown as FakeTxClient,
    });
    assert.equal(r.threadsDeleted, 0);
    assert.deepEqual(deletedIds, []);
  });
});
