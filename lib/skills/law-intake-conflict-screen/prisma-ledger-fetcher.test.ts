/**
 * lib/skills/law-intake-conflict-screen/prisma-ledger-fetcher.test.ts
 *
 * Tests for PrismaLedgerFetcher — the production KnowledgeDocument-based
 * ledger implementation. Uses a stub `tx` to avoid a live DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PrismaLedgerFetcher } from './prisma-ledger-fetcher';
import type { Prisma } from '@prisma/client';

const WORKSPACE_ID = 'ws-law-prisma-test';

/** Build a minimal stub Prisma TransactionClient for KnowledgeDocument reads. */
function stubTx(
  docs: Array<{ title: string; metadata: Prisma.JsonValue }>,
): Prisma.TransactionClient {
  return {
    knowledgeDocument: {
      findMany: async () => docs,
    },
  } as unknown as Prisma.TransactionClient;
}

describe('PrismaLedgerFetcher — basic extraction', () => {
  it('returns an empty ledger when no CUSTOMER docs exist', async () => {
    const fetcher = new PrismaLedgerFetcher({ tx: stubTx([]) });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 0);
  });

  it('extracts clientName from metadata.clientName when present', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        {
          title: 'Acme Corp — engagement.pdf',
          metadata: { clientName: 'Acme Corp', matterStatus: 'active' },
        },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].clientName, 'Acme Corp');
    assert.equal(res.value[0].status, 'active');
  });

  it('falls back to metadata.matterParty when clientName absent', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        {
          title: 'engagement.pdf',
          metadata: { matterParty: 'Jane Smith', matterStatus: 'closed' },
        },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].clientName, 'Jane Smith');
    assert.equal(res.value[0].status, 'closed');
  });

  it('falls back to document title when no metadata name fields present', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        {
          title: 'Beacon Foods',
          metadata: {},
        },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].clientName, 'Beacon Foods');
  });

  it('strips chunk suffix from title when falling back', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        {
          title: 'Yonder Capital LLC (part 1/3)',
          metadata: {},
        },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].clientName, 'Yonder Capital LLC');
  });

  it('strips common file-name dash suffix from title', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        {
          title: 'Smith v Jones — engagement letter',
          metadata: {},
        },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].clientName, 'Smith v Jones');
  });

  it('deduplicates by normalized name, keeping active status over closed', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        { title: 'Acme Corp', metadata: { matterStatus: 'closed' } },
        { title: 'Acme Corp', metadata: { matterStatus: 'active' } },
        { title: 'Acme Corp', metadata: { matterStatus: 'closed' } },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1, 'duplicates should be deduped');
    assert.equal(res.value[0].status, 'active', 'active should win dedup');
  });

  it('maps status open/in-progress to active', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        { title: 'Alpha LLC', metadata: { matterStatus: 'open' } },
        { title: 'Beta Inc', metadata: { matterStatus: 'in-progress' } },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const statuses = res.value.map((e) => e.status);
    assert.ok(statuses.every((s) => s === 'active'));
  });

  it('maps unknown matterStatus to closed', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        { title: 'Old Client', metadata: { matterStatus: 'archived' } },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value[0].status, 'closed');
  });

  it('discards documents with very short titles and no metadata name', async () => {
    const fetcher = new PrismaLedgerFetcher({
      tx: stubTx([
        { title: 'A', metadata: {} },  // too short
        { title: '', metadata: {} },    // empty
        { title: 'OK Name', metadata: {} },
      ]),
    });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].clientName, 'OK Name');
  });

  it('wraps DB errors in a SkillResult error', async () => {
    const badTx = {
      knowledgeDocument: {
        findMany: async () => { throw new Error('DB connection lost'); },
      },
    } as unknown as Prisma.TransactionClient;
    const fetcher = new PrismaLedgerFetcher({ tx: badTx });
    const res = await fetcher.fetchLedger({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.ok(res.error.message.includes('DB connection lost'));
  });
});
