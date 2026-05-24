/**
 * tests/customer-file-ingestion.test.ts
 *
 * P0b acceptance: per-customer file ingestion pipeline.
 *
 * Covers:
 *   - IFileSource → ingest → KnowledgeDocument (kind=CUSTOMER, workspaceId)
 *     end-to-end on a fixture source.
 *   - chunkText: long bodies split into multiple chunks; short bodies
 *     stay as one.
 *   - retrieveCustomerContext returns only the caller workspace's rows
 *     (RLS + CUSTOMER-kind filter + application-layer assertion).
 *   - TENANT ISOLATION: workspace A's retrieval never includes
 *     workspace B's foreign-workspace-sentinel string.
 *   - Re-ingesting the same file id replaces chunks in place (dedupe).
 */

import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  FixtureFileSource,
  chunkText,
  ingestWorkspaceFiles,
  renderCustomerContextBlock,
  retrieveCustomerContext,
} from '@/lib/customer-files';
import {
  TestEmbeddingProvider,
  TestKnowledgeStore,
} from '@/lib/knowledge';
import {
  FixtureMessageFetcher,
  buildWebhookEventFromFixture,
} from '@/lib/skills/fixture-fetcher';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { loadAllFixtures } from './fixtures/webhook-events/_loader';
import type { Workspace } from '@prisma/client';

const FIXTURE_DIR = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'customer-files',
);

const WORKSPACE_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const WORKSPACE_B = 'bbbbbbbb-9999-8888-7777-666666666666';

function makeStore(): TestKnowledgeStore {
  return new TestKnowledgeStore(new TestEmbeddingProvider({ dimensions: 1536 }));
}

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkText('Just a short paragraph.');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].index, 0);
    assert.equal(chunks[0].total, 1);
  });

  it('splits long text into multiple chunks honoring the target size', () => {
    const sentence = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. ';
    const longBody = sentence.repeat(200); // ~11,000 chars
    const chunks = chunkText(longBody, {
      targetChars: 1200,
      overlapChars: 100,
      minChars: 100,
    });
    assert.ok(chunks.length > 4, `expected >4 chunks, got ${chunks.length}`);
    for (const c of chunks) {
      // Allow overlap to push beyond the target by a single chunk-prefix.
      assert.ok(c.text.length <= 1200 + 100 + 5);
      assert.equal(c.total, chunks.length);
    }
  });

  it('returns no chunks for empty/whitespace text', () => {
    assert.deepEqual(chunkText(''), []);
    assert.deepEqual(chunkText('   \n\n\n  '), []);
  });
});

describe('FixtureFileSource', () => {
  it('lists workspace A files and skips workspace B files', async () => {
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    const ids = listed.value.map((r) => r.id).sort();
    assert.deepEqual(ids, ['listing-playbook', 'past-deal-summary']);
    for (const ref of listed.value) {
      assert.ok(ref.title.length > 0);
      assert.equal(ref.mimeType.length > 0, true);
    }
  });

  it('returns empty list for an unknown workspace', async () => {
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
    const listed = await source.listFiles(
      '00000000-0000-0000-0000-000000000000',
    );
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.value.length, 0);
  });
});

describe('ingestWorkspaceFiles → KnowledgeDocument (kind=CUSTOMER)', () => {
  let store: TestKnowledgeStore;
  let source: FixtureFileSource;

  beforeEach(() => {
    store = makeStore();
    source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
  });

  it('writes one or more chunks per fixture file, all CUSTOMER-kind + workspaceId-stamped', async () => {
    const result = await ingestWorkspaceFiles({
      workspaceId: WORKSPACE_A,
      source,
      store,
    });
    assert.equal(result.workspaceId, WORKSPACE_A);
    assert.equal(result.filesSeen, 2);
    assert.equal(result.filesIngested, 2);
    assert.ok(result.chunksWritten >= 2, 'expected at least one chunk per file');
    for (const report of result.reports) {
      assert.equal(report.error, undefined);
      assert.ok(report.embeddingIds.length > 0);
    }

    // Direct query under operator context: every persisted doc has the
    // right kind + workspaceId stamp.
    const all = await store.search({
      query: 'listing playbook past deal',
      contextKinds: ['CUSTOMER'],
      k: 50,
    });
    assert.equal(all.ok, true);
    if (!all.ok) return;
    assert.ok(all.value.length >= 2);
    for (const hit of all.value) {
      assert.equal(hit.contextKind, 'CUSTOMER');
      assert.equal(hit.workspaceId, WORKSPACE_A);
    }
  });

  it('re-ingesting the same workspace replaces chunks in place (dedupe by sourceId)', async () => {
    const first = await ingestWorkspaceFiles({
      workspaceId: WORKSPACE_A,
      source,
      store,
    });
    const second = await ingestWorkspaceFiles({
      workspaceId: WORKSPACE_A,
      source,
      store,
    });
    assert.equal(first.filesIngested, second.filesIngested);
    // Total chunks visible should not double after a re-ingest.
    const visible = await store.search({
      query: 'playbook deal',
      contextKinds: ['CUSTOMER'],
      k: 50,
    });
    assert.equal(visible.ok, true);
    if (!visible.ok) return;
    assert.equal(
      visible.value.length,
      first.chunksWritten,
      `expected ${first.chunksWritten} chunks after re-ingest, got ${visible.value.length}`,
    );
  });
});

describe('retrieveCustomerContext + tenant isolation', () => {
  let store: TestKnowledgeStore;

  beforeEach(async () => {
    store = makeStore();
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
    await ingestWorkspaceFiles({ workspaceId: WORKSPACE_A, source, store });
    await ingestWorkspaceFiles({ workspaceId: WORKSPACE_B, source, store });
  });

  it('returns workspace A snippets to workspace A and never workspace B', async () => {
    // Bind the test store's context to workspace A — the test analog
    // of the production RLS GUC.
    store.setContext({ workspaceId: WORKSPACE_A, isOperator: false });
    const snippets = await retrieveCustomerContext({
      workspaceId: WORKSPACE_A,
      query: 'buyer inquiry on Magnolia Ridge',
      store,
      k: 10,
    });
    assert.ok(snippets.length > 0, 'expected at least one customer snippet');
    const combined = snippets.map((s) => `${s.title}\n${s.body}`).join('\n');
    assert.ok(
      combined.includes('Magnolia Ridge') || combined.includes('Carter'),
      `expected workspace A content in retrieval, got: ${combined.slice(0, 200)}`,
    );
    assert.ok(
      !combined.includes('FOREIGN-WORKSPACE-SENTINEL'),
      `LEAK: workspace B foreign-workspace-sentinel appeared in workspace A retrieval`,
    );
    assert.ok(
      !combined.includes('Sunbelt Realty Partners'),
      `LEAK: workspace B brokerage name appeared in workspace A retrieval`,
    );
  });

  it('renderCustomerContextBlock emits a non-empty block with the snippet bodies', async () => {
    store.setContext({ workspaceId: WORKSPACE_A, isOperator: false });
    const snippets = await retrieveCustomerContext({
      workspaceId: WORKSPACE_A,
      query: 'closing attorney',
      store,
      k: 5,
    });
    const block = renderCustomerContextBlock(snippets);
    assert.ok(block.length > 0);
    assert.ok(block.includes('WORKSPACE FILE CONTEXT'));
  });

  it('returns empty for a workspace with no ingested files', async () => {
    store.setContext({
      workspaceId: '00000000-0000-0000-0000-000000000000',
      isOperator: false,
    });
    const snippets = await retrieveCustomerContext({
      workspaceId: '00000000-0000-0000-0000-000000000000',
      query: 'anything',
      store,
    });
    assert.deepEqual(snippets, []);
  });
});

describe('runSkillChain inlines retrieved customer-context into the draft prompt', () => {
  const WORKSPACE_A_WS: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'> = {
    id: WORKSPACE_A,
    slug: 'carter-realty',
    name: 'Carter Realty',
    vertical: 'REAL_ESTATE',
  };

  it('end-to-end: ingest → resolver → runner → draft LLM call carries the snippet text', async () => {
    const store = makeStore();
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
    await ingestWorkspaceFiles({ workspaceId: WORKSPACE_A, source, store });

    const fixtures = await loadAllFixtures();
    const fixture = fixtures.find((f) => f.id === 're-01-buyer-inquiry');
    if (!fixture) throw new Error('fixture missing');

    const llm = new TestLlmProvider();
    const persister = new RecordingDraftPersister();
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-runs-ctx-'));

    // Bind the store to workspace A — production calls getKnowledgeStore(rls)
    // with the same effect; the test analog is `setContext`.
    store.setContext({ workspaceId: WORKSPACE_A, isOperator: false });

    await runSkillChain({
      workspace: WORKSPACE_A_WS,
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister,
      llm,
      customerContextResolver: async (query) =>
        retrieveCustomerContext({
          workspaceId: WORKSPACE_A,
          query,
          store,
        }),
      logDir,
    });

    const draftCall = llm.calls
      .filter((c) => c.request.system.includes('[[agentplain.skill.draft.v1]]'))
      .pop();
    assert.ok(draftCall, 'expected at least one draft LLM call');
    const sys = draftCall!.request.system;
    assert.match(sys, /WORKSPACE FILE CONTEXT/);
    // Anchored to the real fixture content — proves the snippet body
    // actually rode through the resolver into the prompt.
    assert.match(sys, /Carter Realty Listing Playbook|Bonnie|Magnolia Ridge/);
    // Foreign-workspace decoy must not appear.
    assert.doesNotMatch(sys, /FOREIGN-WORKSPACE-SENTINEL/);
    assert.doesNotMatch(sys, /Sunbelt Realty Partners/);
  });

  it('runner survives a resolver throw — no customer context in the draft prompt', async () => {
    const fixtures = await loadAllFixtures();
    const fixture = fixtures.find((f) => f.id === 're-01-buyer-inquiry');
    if (!fixture) throw new Error('fixture missing');

    const llm = new TestLlmProvider();
    const persister = new RecordingDraftPersister();
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-runs-throw-'));

    await runSkillChain({
      workspace: WORKSPACE_A_WS,
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister,
      llm,
      customerContextResolver: async () => {
        throw new Error('simulated knowledge-store outage');
      },
      logDir,
    });

    const draftCall = llm.calls
      .filter((c) => c.request.system.includes('[[agentplain.skill.draft.v1]]'))
      .pop();
    assert.ok(draftCall);
    assert.doesNotMatch(draftCall!.request.system, /WORKSPACE FILE CONTEXT/);
  });
});
