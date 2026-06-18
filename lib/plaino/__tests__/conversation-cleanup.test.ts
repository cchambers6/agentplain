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
    overrideDays: number | null;
    threads: Array<{ id: string; updatedAt: Date; retentionDays: number | null }>;
    messageCount: number;
  }) {
    const deletedIds: string[] = [];
    const tx = {
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

  it('keeps everything under the default lifetime window (no opt-in)', async () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const { tx, deletedIds } = fakeTx({
      overrideDays: null, // default = lifetime
      threads: [
        // years old — still kept, because lifetime is the default
        { id: 'ancient', updatedAt: new Date('2020-01-01T00:00:00Z'), retentionDays: null },
      ],
      messageCount: 0,
    });
    const r = await cleanupWorkspaceConversations(WS, now, {
      client: tx as unknown as FakeTxClient,
    });
    assert.equal(r.threadsDeleted, 0);
    assert.deepEqual(deletedIds, []);
  });

  it('purges only expired threads once the customer opts into a window', async () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const { tx, deletedIds } = fakeTx({
      overrideDays: 7, // customer opted into a 7-day auto-purge
      threads: [
        { id: 'old', updatedAt: new Date('2026-06-08T00:00:00Z'), retentionDays: null },
        { id: 'fresh', updatedAt: new Date('2026-06-17T18:00:00Z'), retentionDays: null },
      ],
      messageCount: 4,
    });
    const r = await cleanupWorkspaceConversations(WS, now, {
      client: tx as unknown as FakeTxClient,
    });
    assert.equal(r.threadsDeleted, 1);
    assert.equal(r.messagesDeleted, 4);
    assert.deepEqual(deletedIds, ['old']);
  });

  it('honors a longer per-thread window under a workspace auto-purge', async () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const { tx, deletedIds } = fakeTx({
      overrideDays: 7, // workspace purges after 7 days...
      threads: [
        // ...but this thread opted into 90 days and is only 10 days old → kept
        { id: 'kept', updatedAt: new Date('2026-06-08T00:00:00Z'), retentionDays: 90 },
        // inherits the workspace 7-day window and is 10 days old → purged
        { id: 'inherited', updatedAt: new Date('2026-06-08T00:00:00Z'), retentionDays: null },
      ],
      messageCount: 2,
    });
    const r = await cleanupWorkspaceConversations(WS, now, {
      client: tx as unknown as FakeTxClient,
    });
    assert.equal(r.threadsDeleted, 1);
    assert.deepEqual(deletedIds, ['inherited']);
  });
});
