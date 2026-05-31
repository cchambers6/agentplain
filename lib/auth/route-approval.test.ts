/**
 * lib/auth/route-approval.test.ts
 *
 * Pins the wave-6 approval routing helper:
 *   * Returns the head's userId when a DisciplineHead row exists for
 *     (workspaceId, discipline).
 *   * Returns null when no head is assigned.
 *   * Returns null for an unknown/invalid discipline string.
 *   * Honors a passed-in transaction client without spinning up a new
 *     system context.
 *
 * Driven by a stubbed `Prisma.TransactionClient` so we don't need a
 * live database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

import { resolveRequiredApprover } from './route-approval';

interface StubCall {
  discipline: string;
  workspaceId: string;
}

function stubTx(
  rows: Record<string, { userId: string }>,
  callLog: StubCall[],
): Prisma.TransactionClient {
  return {
    disciplineHead: {
      findUnique: async (args: {
        where: { workspaceId_discipline: { workspaceId: string; discipline: string } };
        select?: unknown;
      }) => {
        const { workspaceId, discipline } = args.where.workspaceId_discipline;
        callLog.push({ workspaceId, discipline });
        const key = `${workspaceId}:${discipline}`;
        return rows[key] ?? null;
      },
    },
  } as unknown as Prisma.TransactionClient;
}

describe('lib/auth/route-approval', () => {
  it('returns the head userId when assigned', async () => {
    const calls: StubCall[] = [];
    const tx = stubTx(
      { 'ws-1:legal': { userId: 'user-head' } },
      calls,
    );

    const result = await resolveRequiredApprover('ws-1', 'legal', tx);

    assert.equal(result, 'user-head');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { workspaceId: 'ws-1', discipline: 'legal' });
  });

  it('returns null when no head is assigned', async () => {
    const tx = stubTx({}, []);
    const result = await resolveRequiredApprover('ws-1', 'finance', tx);
    assert.equal(result, null);
  });

  it('returns null for an unknown discipline string', async () => {
    const calls: StubCall[] = [];
    const tx = stubTx({ 'ws-1:not-a-real-discipline': { userId: 'x' } }, calls);

    const result = await resolveRequiredApprover('ws-1', 'not-a-real-discipline', tx);

    // Unknown discipline short-circuits without hitting the DB.
    assert.equal(result, null);
    assert.equal(calls.length, 0);
  });

  it('returns null for null / undefined discipline', async () => {
    const tx = stubTx({}, []);
    assert.equal(await resolveRequiredApprover('ws-1', null, tx), null);
    assert.equal(await resolveRequiredApprover('ws-1', undefined, tx), null);
  });

  it('isolates lookups per workspace', async () => {
    const tx = stubTx(
      {
        'ws-1:legal': { userId: 'head-a' },
        'ws-2:legal': { userId: 'head-b' },
      },
      [],
    );
    assert.equal(await resolveRequiredApprover('ws-1', 'legal', tx), 'head-a');
    assert.equal(await resolveRequiredApprover('ws-2', 'legal', tx), 'head-b');
  });
});
