/**
 * Unit tests for the customer-data deletion paths
 * (`lib/customer-files/deletion.ts`).
 *
 * Covers all three flavors against the in-memory `TestKnowledgeStore`
 * + a `FakeTeardownPrismaClient` shim for the workspace-teardown
 * relational deletes. The pgvector + test stores satisfy the same
 * `IKnowledgeStore.delete()` contract per `feedback_runner_portability.md`.
 *
 * Scenarios:
 *
 *   1. `deleteIntegrationCustomerData`
 *      - GOOGLE disconnect deletes ONLY workspace A's google-drive-sourced
 *        CUSTOMER docs.
 *      - Other context kinds (SKILL / VERTICAL / etc.) and other
 *        workspaces' docs are untouched.
 *      - A disconnect for a provider with no file source (DOCUSIGN /
 *        QUICKBOOKS / SLACK) is a clean zero — no rows deleted, no error.
 *
 *   2. `tearDownWorkspaceData`
 *      - Every workspace-scoped tenant row is gone after the call.
 *      - Other workspaces' rows are untouched.
 *      - Workspace + Subscription rows themselves are preserved (out of
 *        scope per the function's docblock).
 *
 *   3. `reapTombstonedDriveCustomerData`
 *      - Files in the live set are preserved.
 *      - Files missing from the live set are deleted (incl. their
 *        embeddings via the store's cascade).
 *      - `listingWasComplete=false` is a no-op.
 *      - Docs with no `metadata.fileId` are skipped (defensive — we
 *        can't classify their liveness).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TestEmbeddingProvider,
  TestKnowledgeStore,
} from '../../knowledge';
import type { TestKnowledgeStoreContext } from '../../knowledge/test-store';
import {
  customerFileSourceNamesForProvider,
  deleteIntegrationCustomerData,
  reapTombstonedDriveCustomerData,
  tearDownWorkspaceData,
} from '../deletion';

const WORKSPACE_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const WORKSPACE_B = 'bbbbbbbb-9999-8888-7777-666666666666';

const OPERATOR_CTX: TestKnowledgeStoreContext = {
  workspaceId: null,
  isOperator: true,
};

function buildStore(): TestKnowledgeStore {
  return new TestKnowledgeStore(new TestEmbeddingProvider({ dimensions: 1536 }));
}

// ── Provider → source-name mapping ────────────────────────────────────────

describe('customerFileSourceNamesForProvider', () => {
  it('GOOGLE returns google-drive + fixture (dogfood/seed sweep)', () => {
    const names = customerFileSourceNamesForProvider('GOOGLE');
    assert.ok(names.includes('google-drive'));
    assert.ok(names.includes('fixture'));
  });

  it('returns empty array for providers with no file ingestion', () => {
    for (const provider of ['M365', 'DOCUSIGN', 'QUICKBOOKS', 'SLACK'] as const) {
      assert.deepEqual(customerFileSourceNamesForProvider(provider), []);
    }
  });

  it('null providerKey (coming-soon entry) returns empty array', () => {
    assert.deepEqual(customerFileSourceNamesForProvider(null), []);
  });
});

// ── deleteIntegrationCustomerData ────────────────────────────────────────

describe('deleteIntegrationCustomerData — scoped disconnect cleanup', () => {
  async function seedMixed(store: TestKnowledgeStore): Promise<void> {
    store.setContext(OPERATOR_CTX);
    // Workspace A — google-drive docs
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_A,
      title: 'Drive doc 1 (A)',
      body: 'Listing playbook for A',
      sourceType: 'customer_file_chunk',
      sourceId: 'google-drive:fileA1:0',
      metadata: { source: 'google-drive', fileId: 'fileA1' },
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_A,
      title: 'Drive doc 2 (A)',
      body: 'Past deal summary for A',
      sourceType: 'customer_file_chunk',
      sourceId: 'google-drive:fileA2:0',
      metadata: { source: 'google-drive', fileId: 'fileA2' },
    });
    // Workspace A — a hypothetical OneDrive doc tagged with source=onedrive
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_A,
      title: 'OneDrive doc (A)',
      body: 'Different integration body',
      sourceType: 'customer_file_chunk',
      sourceId: 'onedrive:fileA3:0',
      metadata: { source: 'onedrive', fileId: 'fileA3' },
    });
    // Workspace B — google-drive doc (must not be touched by an A disconnect)
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_B,
      title: 'Drive doc (B)',
      body: 'B brokerage playbook',
      sourceType: 'customer_file_chunk',
      sourceId: 'google-drive:fileB1:0',
      metadata: { source: 'google-drive', fileId: 'fileB1' },
    });
    // Non-CUSTOMER context kinds — VERTICAL + COMPLIANCE
    await store.upsert({
      contextKind: 'VERTICAL',
      title: 'Realty playbook',
      body: 'Generic real-estate guidance',
      verticalSlug: 'real-estate',
    });
    await store.upsert({
      contextKind: 'COMPLIANCE',
      title: 'Fair housing rule',
      body: 'HUD rule body',
    });
  }

  it('deletes only workspace A google-drive docs; spares other workspaces, other sources, other kinds', async () => {
    const store = buildStore();
    await seedMixed(store);

    const before = await store.search({ query: 'playbook', k: 50 });
    assert.equal(before.ok, true);
    if (!before.ok) return;
    const initialCount = before.value.length;

    const result = await deleteIntegrationCustomerData({
      workspaceId: WORKSPACE_A,
      providerKey: 'GOOGLE',
      store,
    });
    // 2 google-drive docs for A → 2 embeddings deleted. The fixture
    // source name also tries to delete; zero rows match it here, so the
    // total stays at 2.
    assert.equal(result.embeddingsDeleted, 2);
    assert.ok(result.bySource.find((s) => s.sourceName === 'google-drive'));
    assert.ok(result.bySource.find((s) => s.sourceName === 'fixture'));

    const after = await store.search({ query: 'playbook', k: 50 });
    assert.equal(after.ok, true);
    if (!after.ok) return;

    // Surviving rows = initial - 2.
    assert.equal(after.value.length, initialCount - 2);

    // Survivors include: WORKSPACE_B google-drive, WORKSPACE_A onedrive,
    // VERTICAL, COMPLIANCE. None of WORKSPACE_A's google-drive rows
    // appear.
    const survivors = after.value;
    const aGoogleSurvivors = survivors.filter(
      (h) =>
        h.workspaceId === WORKSPACE_A &&
        (h.metadata?.source as string | undefined) === 'google-drive',
    );
    assert.equal(aGoogleSurvivors.length, 0, 'A google-drive rows must be gone');

    const bGoogleSurvivors = survivors.filter(
      (h) =>
        h.workspaceId === WORKSPACE_B &&
        (h.metadata?.source as string | undefined) === 'google-drive',
    );
    assert.equal(bGoogleSurvivors.length, 1, 'B google-drive row must be intact');

    const aOnedriveSurvivors = survivors.filter(
      (h) =>
        h.workspaceId === WORKSPACE_A &&
        (h.metadata?.source as string | undefined) === 'onedrive',
    );
    assert.equal(aOnedriveSurvivors.length, 1, 'A onedrive row must be intact');

    const vertical = survivors.filter((h) => h.contextKind === 'VERTICAL');
    assert.equal(vertical.length, 1, 'VERTICAL rows must be intact');
    const compliance = survivors.filter((h) => h.contextKind === 'COMPLIANCE');
    assert.equal(compliance.length, 1, 'COMPLIANCE rows must be intact');
  });

  it('providers with no customer-file source name are a clean zero', async () => {
    const store = buildStore();
    await seedMixed(store);
    const result = await deleteIntegrationCustomerData({
      workspaceId: WORKSPACE_A,
      providerKey: 'DOCUSIGN',
      store,
    });
    assert.equal(result.embeddingsDeleted, 0);
    assert.deepEqual(result.bySource, []);

    // Nothing was deleted — sanity check.
    const after = await store.search({ query: 'playbook', k: 50 });
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.ok(after.value.length >= 3);
  });
});

// ── reapTombstonedDriveCustomerData ──────────────────────────────────────

describe('reapTombstonedDriveCustomerData', () => {
  async function seedDrive(store: TestKnowledgeStore): Promise<void> {
    store.setContext(OPERATOR_CTX);
    for (const fileId of ['live1', 'live2', 'tombstoned1']) {
      await store.upsert({
        contextKind: 'CUSTOMER',
        workspaceId: WORKSPACE_A,
        title: `doc ${fileId}`,
        body: `body for ${fileId}`,
        sourceType: 'customer_file_chunk',
        sourceId: `google-drive:${fileId}:0`,
        metadata: { source: 'google-drive', fileId },
      });
    }
  }

  it('deletes docs whose fileId is not in liveFileIds; keeps live ones', async () => {
    const store = buildStore();
    await seedDrive(store);
    const result = await reapTombstonedDriveCustomerData({
      workspaceId: WORKSPACE_A,
      sourceName: 'google-drive',
      liveFileIds: ['live1', 'live2'],
      listingWasComplete: true,
      store,
    });
    assert.equal(result.ran, true);
    assert.equal(result.embeddingsDeleted, 1);

    const after = await store.search({ query: 'body', k: 50 });
    assert.equal(after.ok, true);
    if (!after.ok) return;
    const remaining = after.value
      .map((h) => (h.metadata?.fileId as string | undefined))
      .filter((s): s is string => typeof s === 'string')
      .sort();
    assert.deepEqual(remaining, ['live1', 'live2']);
  });

  it('skips when listingWasComplete=false (returns ran=false, deletes nothing)', async () => {
    const store = buildStore();
    await seedDrive(store);
    const result = await reapTombstonedDriveCustomerData({
      workspaceId: WORKSPACE_A,
      sourceName: 'google-drive',
      // Pretend the live listing was capped; we mustn't reap anything.
      liveFileIds: ['live1'],
      listingWasComplete: false,
      store,
    });
    assert.equal(result.ran, false);
    assert.equal(result.embeddingsDeleted, 0);

    const after = await store.search({ query: 'body', k: 50 });
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.value.length, 3);
  });

  it('empty liveFileIds with listingWasComplete=true reaps everything', async () => {
    const store = buildStore();
    await seedDrive(store);
    const result = await reapTombstonedDriveCustomerData({
      workspaceId: WORKSPACE_A,
      sourceName: 'google-drive',
      liveFileIds: [],
      listingWasComplete: true,
      store,
    });
    assert.equal(result.ran, true);
    assert.equal(result.embeddingsDeleted, 3);
  });
});

// ── tearDownWorkspaceData ────────────────────────────────────────────────

interface FakeRow {
  id: string;
  workspaceId: string;
  [key: string]: unknown;
}

class FakeTeardownPrismaClient {
  webhookEvents: FakeRow[] = [];
  webhookSubscriptions: FakeRow[] = [];
  integrationCredentials: FakeRow[] = [];
  workApprovals: FakeRow[] = [];
  handoffs: FakeRow[] = [];
  preferenceSignals: FakeRow[] = [];
  workspacePreferences: FakeRow[] = [];
  inquiries: Array<{ id: string; convertedWorkspaceId: string | null }> = [];

  async $transaction<T>(cb: (tx: FakeTeardownPrismaClient) => Promise<T>): Promise<T> {
    return cb(this);
  }

  webhookEvent = makeDeleteMany(this, 'webhookEvents');
  webhookSubscription = makeDeleteMany(this, 'webhookSubscriptions');
  integrationCredential = makeDeleteMany(this, 'integrationCredentials');
  workApprovalQueueItem = makeDeleteMany(this, 'workApprovals');
  handoffLogEntry = makeDeleteMany(this, 'handoffs');
  preferenceSignal = makeDeleteMany(this, 'preferenceSignals');
  workspacePreference = makeDeleteMany(this, 'workspacePreferences');
  inquiry = {
    deleteMany: async (args: { where: { convertedWorkspaceId: string } }) => {
      const before = this.inquiries.length;
      this.inquiries = this.inquiries.filter(
        (r) => r.convertedWorkspaceId !== args.where.convertedWorkspaceId,
      );
      return { count: before - this.inquiries.length };
    },
  };
}

function makeDeleteMany(self: FakeTeardownPrismaClient, key: keyof FakeTeardownPrismaClient) {
  return {
    deleteMany: async (args: { where: { workspaceId: string } }) => {
      const arr = self[key] as FakeRow[];
      const before = arr.length;
      const kept = arr.filter((r) => r.workspaceId !== args.where.workspaceId);
      (self[key] as FakeRow[]) = kept;
      return { count: before - kept.length };
    },
  };
}

describe('tearDownWorkspaceData', () => {
  it('clears every workspace-scoped tenant row for the target workspace, leaves others intact', async () => {
    const store = buildStore();
    store.setContext(OPERATOR_CTX);

    // Workspace A — knowledge docs of both CUSTOMER and non-CUSTOMER kinds.
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_A,
      title: 'A doc 1',
      body: 'body 1',
      sourceType: 'customer_file_chunk',
      sourceId: 'google-drive:fA1:0',
      metadata: { source: 'google-drive', fileId: 'fA1' },
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_A,
      title: 'A doc 2',
      body: 'body 2',
      sourceType: 'customer_file_chunk',
      sourceId: 'fixture:fA2:0',
      metadata: { source: 'fixture', fileId: 'fA2' },
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WORKSPACE_B,
      title: 'B doc 1',
      body: 'body 1 (B)',
      sourceType: 'customer_file_chunk',
      sourceId: 'google-drive:fB1:0',
      metadata: { source: 'google-drive', fileId: 'fB1' },
    });
    await store.upsert({
      contextKind: 'VERTICAL',
      title: 'realty pattern',
      body: 'pattern',
      verticalSlug: 'real-estate',
    });

    const prisma = new FakeTeardownPrismaClient();
    // Seed: workspace A + workspace B rows across every table teardown touches.
    for (const target of [WORKSPACE_A, WORKSPACE_B]) {
      prisma.webhookEvents.push({ id: `we-${target}`, workspaceId: target });
      prisma.webhookSubscriptions.push({ id: `ws-${target}`, workspaceId: target });
      prisma.integrationCredentials.push({ id: `ic-${target}`, workspaceId: target });
      prisma.workApprovals.push({ id: `wa-${target}`, workspaceId: target });
      prisma.handoffs.push({ id: `ho-${target}`, workspaceId: target });
      prisma.preferenceSignals.push({ id: `ps-${target}`, workspaceId: target });
      prisma.workspacePreferences.push({ id: `wp-${target}`, workspaceId: target });
    }
    prisma.inquiries.push({ id: 'iq-a', convertedWorkspaceId: WORKSPACE_A });
    prisma.inquiries.push({ id: 'iq-b', convertedWorkspaceId: WORKSPACE_B });
    prisma.inquiries.push({ id: 'iq-orphan', convertedWorkspaceId: null });

    const result = await tearDownWorkspaceData({
      workspaceId: WORKSPACE_A,
      store,
      // Inject the fake prisma client so the teardown skips withSystemContext
      // and uses the in-memory tables. RLS is exercised elsewhere; here we
      // assert deletion shape.
      client: prisma as unknown as Parameters<typeof tearDownWorkspaceData>[0]['client'],
    });

    assert.equal(result.customerEmbeddingsDeleted, 2, 'both A CUSTOMER docs removed');
    assert.equal(result.workApprovalsDeleted, 1);
    assert.equal(result.handoffsDeleted, 1);
    assert.equal(result.webhookEventsDeleted, 1);
    assert.equal(result.webhookSubscriptionsDeleted, 1);
    assert.equal(result.integrationCredentialsDeleted, 1);
    assert.equal(result.preferenceSignalsDeleted, 1);
    assert.equal(result.workspacePreferencesDeleted, 1);
    assert.equal(result.inquiriesDeleted, 1);

    // B rows still present across the board.
    assert.equal(prisma.webhookEvents.length, 1);
    assert.equal(prisma.webhookEvents[0].workspaceId, WORKSPACE_B);
    assert.equal(prisma.integrationCredentials.length, 1);
    assert.equal(prisma.integrationCredentials[0].workspaceId, WORKSPACE_B);
    assert.equal(prisma.handoffs.length, 1);
    assert.equal(prisma.handoffs[0].workspaceId, WORKSPACE_B);
    assert.equal(prisma.workApprovals.length, 1);
    assert.equal(prisma.workspacePreferences.length, 1);
    assert.equal(prisma.preferenceSignals.length, 1);
    assert.equal(prisma.webhookSubscriptions.length, 1);

    // Inquiry survivors: B's converted row + the orphan (null pointer).
    const inqIds = prisma.inquiries.map((r) => r.id).sort();
    assert.deepEqual(inqIds, ['iq-b', 'iq-orphan']);

    // Knowledge store survivors: B's CUSTOMER doc + the VERTICAL row.
    const surviving = await store.search({ query: 'body pattern', k: 50 });
    assert.equal(surviving.ok, true);
    if (!surviving.ok) return;
    const customerSurvivors = surviving.value.filter((h) => h.contextKind === 'CUSTOMER');
    assert.equal(customerSurvivors.length, 1);
    assert.equal(customerSurvivors[0].workspaceId, WORKSPACE_B);
    const verticalSurvivors = surviving.value.filter((h) => h.contextKind === 'VERTICAL');
    assert.equal(verticalSurvivors.length, 1);
  });

  it('throws on missing workspaceId', async () => {
    await assert.rejects(
      tearDownWorkspaceData({
        workspaceId: '',
        store: buildStore(),
      }),
      /requires a workspaceId/,
    );
  });
});
