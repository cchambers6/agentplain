/**
 * lib/integrations/retry-queue.test.ts
 *
 * The durable retry queue is the "nothing is silently dropped" guarantee of
 * pfd-2. Bar (if Conner died tomorrow): a draft that failed on a broken
 * integration queues, resumes EXACTLY once on reconnect (idempotency), and a
 * row that can't be resumed dead-letters + pages a human rather than vanishing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueRetryableAction,
  holdRetryableAction,
  resumeRetryableActions,
  summarizeRetryQueueForProvider,
  MAX_ATTEMPTS,
  DEAD_AFTER_MS,
  type RetryHandlerRegistry,
} from './retry-queue';
import { InMemoryRetryStore } from './retry-store';

const WS = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-06-10T00:00:00Z');

describe('retry queue — enqueue', () => {
  it('persists a PENDING row keyed on the idempotency key', async () => {
    const store = new InMemoryRetryStore();
    const row = await enqueueRetryableAction({
      workspaceId: WS,
      provider: 'GOOGLE',
      actionKind: 'lead-triage.persist-draft',
      payload: { leadId: 'lead-1' },
      idempotencyKey: 'k1',
      store,
      now: NOW,
    });
    assert.equal(row.status, 'PENDING');
    assert.equal(store.rows.length, 1);
    assert.equal(row.idempotencyKey, 'k1');
  });

  it('is idempotent — a second enqueue under the same key does NOT duplicate', async () => {
    const store = new InMemoryRetryStore();
    const args = {
      workspaceId: WS,
      provider: 'GOOGLE' as const,
      actionKind: 'lead-triage.persist-draft',
      payload: { leadId: 'lead-1' },
      idempotencyKey: 'k1',
      store,
      now: NOW,
    };
    await enqueueRetryableAction(args);
    await enqueueRetryableAction(args);
    assert.equal(store.rows.length, 1, 'one row, not two');
  });

  it('does NOT reset attempts on a re-enqueue of a still-pending row (cap is real)', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS,
      provider: 'GOOGLE',
      actionKind: 'k',
      payload: {},
      idempotencyKey: 'k1',
      store,
      now: NOW,
    });
    // Simulate the row having burned attempts already.
    store.rows[0].attempts = 3;
    await enqueueRetryableAction({
      workspaceId: WS,
      provider: 'GOOGLE',
      actionKind: 'k',
      payload: {},
      idempotencyKey: 'k1',
      store,
      now: NOW,
    });
    assert.equal(store.rows[0].attempts, 3, 'attempts preserved');
  });
});

describe('retry queue — resume on reconnect', () => {
  it('runs the registered handler and RESOLVES the row exactly once', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS,
      provider: 'GOOGLE',
      actionKind: 'lead-triage.persist-draft',
      payload: { leadId: 'lead-1' },
      idempotencyKey: 'k1',
      store,
      now: NOW,
    });

    let calls = 0;
    const seenKeys: string[] = [];
    const registry: RetryHandlerRegistry = {
      'lead-triage.persist-draft': async (ctx) => {
        calls += 1;
        seenKeys.push(ctx.idempotencyKey);
        return { ok: true };
      },
    };

    const result = await resumeRetryableActions({
      provider: 'GOOGLE',
      workspaceId: WS,
      registry,
      store,
      now: NOW,
    });

    assert.equal(result.resolved, 1);
    assert.equal(calls, 1);
    assert.deepEqual(seenKeys, ['k1']);
    assert.equal(store.rows[0].status, 'RESOLVED');

    // Running resume AGAIN does not re-run the handler — the row is terminal.
    const second = await resumeRetryableActions({
      provider: 'GOOGLE',
      workspaceId: WS,
      registry,
      store,
      now: NOW,
    });
    assert.equal(second.resolved, 0);
    assert.equal(calls, 1, 'handler not called a second time');
  });

  it('only resumes the provider that recovered, leaving others queued', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS, provider: 'GOOGLE', actionKind: 'k', payload: {}, idempotencyKey: 'g', store, now: NOW,
    });
    await enqueueRetryableAction({
      workspaceId: WS, provider: 'SLACK', actionKind: 'k', payload: {}, idempotencyKey: 's', store, now: NOW,
    });
    const registry: RetryHandlerRegistry = { k: async () => ({ ok: true }) };

    await resumeRetryableActions({ provider: 'GOOGLE', registry, store, now: NOW });

    const google = store.rows.find((r) => r.provider === 'GOOGLE');
    const slack = store.rows.find((r) => r.provider === 'SLACK');
    assert.equal(google?.status, 'RESOLVED');
    assert.equal(slack?.status, 'PENDING', 'untouched provider stays queued');
  });

  it('backs off a failed attempt instead of dead-lettering immediately', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS, provider: 'GOOGLE', actionKind: 'k', payload: {}, idempotencyKey: 'k1', store, now: NOW,
    });
    const registry: RetryHandlerRegistry = {
      k: async () => ({ ok: false, detail: 'still broken' }),
    };
    const result = await resumeRetryableActions({ registry, store, now: NOW });
    assert.equal(result.retried, 1);
    assert.equal(result.dead.length, 0);
    const row = store.rows[0];
    assert.equal(row.status, 'PENDING');
    assert.equal(row.attempts, 1);
    assert.ok(row.nextAttemptAt && row.nextAttemptAt.getTime() > NOW.getTime(), 'backoff scheduled');
  });
});

describe('retry queue — dead-letter pages a human', () => {
  it('dead-letters after MAX_ATTEMPTS and calls onDeadLetter', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS, provider: 'GOOGLE', actionKind: 'k', payload: {}, idempotencyKey: 'k1', store, now: NOW,
    });
    // Pre-burn attempts to one below the cap so this resume crosses it.
    store.rows[0].attempts = MAX_ATTEMPTS - 1;
    const registry: RetryHandlerRegistry = {
      k: async () => ({ ok: false, detail: 'permanently broken' }),
    };
    const paged: string[] = [];
    const result = await resumeRetryableActions({
      registry,
      store,
      now: NOW,
      onDeadLetter: (row, reason) => {
        paged.push(`${row.idempotencyKey}:${reason}`);
      },
    });
    assert.equal(result.dead.length, 1);
    assert.equal(store.rows[0].status, 'DEAD');
    assert.ok(store.rows[0].diedAt, 'diedAt set');
    assert.equal(paged.length, 1, 'human paged on dead-letter');
    assert.match(paged[0], /permanently broken/);
  });

  it('dead-letters a row past the 7-day age cap regardless of attempts', async () => {
    const old = new Date(NOW.getTime() - DEAD_AFTER_MS - 1000);
    const store = new InMemoryRetryStore([
      {
        id: 'old-1', workspaceId: WS, provider: 'GOOGLE', actionKind: 'k',
        payload: {} as never, idempotencyKey: 'old', status: 'PENDING', attempts: 0,
        nextAttemptAt: null, lastError: null, diedAt: null, resolvedAt: null,
        createdAt: old, updatedAt: old,
      },
    ]);
    const paged: string[] = [];
    const result = await resumeRetryableActions({
      registry: { k: async () => ({ ok: true }) },
      store,
      now: NOW,
      onDeadLetter: (_row, reason) => { paged.push(reason); },
    });
    assert.equal(result.dead.length, 1);
    assert.equal(store.rows[0].status, 'DEAD');
    assert.match(paged[0], /age cap/);
  });

  it('leaves a row with no registered handler PENDING (deploy gap, not dead)', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({
      workspaceId: WS, provider: 'GOOGLE', actionKind: 'unknown.kind', payload: {}, idempotencyKey: 'k1', store, now: NOW,
    });
    const result = await resumeRetryableActions({ registry: {}, store, now: NOW });
    assert.deepEqual(result.noHandler, ['unknown.kind']);
    assert.equal(store.rows[0].status, 'PENDING', 'not dead-lettered');
    assert.equal(result.dead.length, 0);
  });
});

describe('retry queue — degraded-mode hold + summary', () => {
  it('holdRetryableAction tags the row HELD and it flushes on resume', async () => {
    const store = new InMemoryRetryStore();
    await holdRetryableAction({
      workspaceId: WS, provider: 'SLACK', actionKind: 'slack.notify',
      payload: { channel: '#ops', text: 'hi' }, idempotencyKey: 'n1', store, now: NOW,
    });
    assert.equal(store.rows[0].status, 'HELD');

    let posted = false;
    const result = await resumeRetryableActions({
      provider: 'SLACK',
      registry: { 'slack.notify': async () => { posted = true; return { ok: true }; } },
      store,
      now: NOW,
    });
    assert.equal(result.resolved, 1);
    assert.ok(posted, 'held notification flushed on reconnect');
    assert.equal(store.rows[0].status, 'RESOLVED');
  });

  it('summarizes waiting/held/dead counts for the integration page', async () => {
    const store = new InMemoryRetryStore();
    await enqueueRetryableAction({ workspaceId: WS, provider: 'SLACK', actionKind: 'k', payload: {}, idempotencyKey: 'a', store, now: NOW });
    await holdRetryableAction({ workspaceId: WS, provider: 'SLACK', actionKind: 'k', payload: {}, idempotencyKey: 'b', store, now: NOW });
    const summary = await summarizeRetryQueueForProvider(WS, 'SLACK', store);
    assert.equal(summary.waiting, 1);
    assert.equal(summary.held, 1);
    assert.equal(summary.dead, 0);
  });
});
