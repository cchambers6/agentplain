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
  DEFAULT_DRIVE_QUERY,
  DriveFileSource,
  FixtureFileSource,
  chunkText,
  ingestWorkspaceFiles,
  renderCustomerContextBlock,
  retrieveCustomerContext,
} from '@/lib/customer-files';
import type { DriveMcpServer } from '@/lib/integrations/google-drive-mcp';
import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  CreateFolderOutput,
  DownloadFileInput,
  DownloadFileOutput,
  GetFileMetadataInput,
  GetFileMetadataOutput,
  ListFilesInput,
  ListFilesOutput,
  SearchFilesOutput,
  ShareFileInput,
  ShareFileOutput,
  UploadFileInput,
  UploadFileOutput,
} from '@/lib/integrations/google-drive-mcp/types';
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

  it('voice loop: draft prompt carries the voice directive AND the draft cites a real example', async () => {
    // The product differentiator — upload your templates, get drafts in
    // YOUR voice. This is the end-to-end proof: 3 ingested example docs
    // (the two workspace-A fixtures + a third synthetic template) →
    // retrieval → the draft prompt instructs the model to follow the
    // examples' voice → the (heuristic) model cites one. Mirrors the PR
    // acceptance demo deterministically, no live provider required.
    const store = makeStore();
    const source = new FixtureFileSource({ rootDir: FIXTURE_DIR });
    await ingestWorkspaceFiles({ workspaceId: WORKSPACE_A, source, store });

    const fixtures = await loadAllFixtures();
    const fixture = fixtures.find((f) => f.id === 're-01-buyer-inquiry');
    if (!fixture) throw new Error('fixture missing');

    const llm = new TestLlmProvider();
    const persister = new RecordingDraftPersister();
    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-runs-voice-'));
    store.setContext({ workspaceId: WORKSPACE_A, isOperator: false });

    await runSkillChain({
      workspace: WORKSPACE_A_WS,
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister,
      llm,
      customerContextResolver: async (query) =>
        retrieveCustomerContext({ workspaceId: WORKSPACE_A, query, store }),
      logDir,
    });

    // (1) The draft system prompt instructs voice matching — both the
    //     shared REPLY RULES voice bullet and the file-context block's
    //     VOICE directive.
    const draftCall = llm.calls
      .filter((c) => c.request.system.includes('[[agentplain.skill.draft.v1]]'))
      .pop();
    assert.ok(draftCall, 'expected a draft LLM call');
    const sys = draftCall!.request.system;
    assert.match(sys, /Follow the\s+tone, structure, and phrasings/);
    assert.match(sys, /VOICE: Follow the tone, structure, and phrasings/);
    assert.match(sys, /Match THIS customer’s voice/);

    // (2) The produced draft cites at least one of the broker-owner's
    //     own examples (proves the model followed the CITE directive,
    //     not generic boilerplate).
    const drafted = persister.calls.at(-1);
    assert.ok(drafted, 'expected a persisted draft');
    assert.match(drafted!.body, /Listing Playbook|Riverbend/);
    assert.match(drafted!.body, /in your voice/);
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

/* ─────────────────────────────────────────────────────────────────────────
 * DriveFileSource (P0-2)
 *
 * The Drive source delegates list + download to the per-workspace Drive
 * MCP server (`lib/integrations/google-drive-mcp`). Tests inject a
 * deterministic mock via `buildMcpServer`, so we exercise:
 *   - wired branch (creds present → MCP returns ok) feeds the pipeline,
 *   - unwired branch (creds absent → MCP returns CREDENTIAL_NOT_FOUND)
 *     surfaces as NOT_CONFIGURED and `ingestWorkspaceFiles` skips cleanly,
 *   - error mapping (forbidden / rate-limited / not-found) preserves
 *     vendor signal at the IFileSource boundary,
 *   - the Drive query is restricted to text-extractable mime types so the
 *     "works from your files" contract never silently swallows a binary.
 * ───────────────────────────────────────────────────────────────────────── */

interface MockDriveBehavior {
  listFiles: (input: ListFilesInput) => Promise<McpResult<ListFilesOutput>>;
  downloadFile: (input: DownloadFileInput) => Promise<McpResult<DownloadFileOutput>>;
}

/** Mock implementation of the full DriveMcpServer surface. Tests provide
 *  behaviors for the two methods DriveFileSource actually calls; the
 *  remaining methods throw if invoked — that asserts the source never
 *  reaches for anything beyond list + download. */
class MockDriveMcpServer implements DriveMcpServer {
  readonly name = 'mock-drive' as const;
  readonly workspaceId: string;
  public listFilesCalls: ListFilesInput[] = [];
  public downloadFileCalls: DownloadFileInput[] = [];

  constructor(args: { workspaceId: string }, private behavior: MockDriveBehavior) {
    this.workspaceId = args.workspaceId;
  }

  async listFiles(input: ListFilesInput): Promise<McpResult<ListFilesOutput>> {
    this.listFilesCalls.push(input);
    return this.behavior.listFiles(input);
  }
  async downloadFile(input: DownloadFileInput): Promise<McpResult<DownloadFileOutput>> {
    this.downloadFileCalls.push(input);
    return this.behavior.downloadFile(input);
  }
  async getFileMetadata(_input: GetFileMetadataInput): Promise<McpResult<GetFileMetadataOutput>> {
    throw new Error('MockDriveMcpServer.getFileMetadata should not be called');
  }
  async uploadFile(_input: UploadFileInput): Promise<McpResult<UploadFileOutput>> {
    throw new Error('MockDriveMcpServer.uploadFile should not be called');
  }
  async createFolder(_input: { name: string }): Promise<McpResult<CreateFolderOutput>> {
    throw new Error('MockDriveMcpServer.createFolder should not be called');
  }
  async searchFiles(_input: { text: string }): Promise<McpResult<SearchFilesOutput>> {
    throw new Error('MockDriveMcpServer.searchFiles should not be called');
  }
  async shareFile(_input: ShareFileInput): Promise<McpResult<ShareFileOutput>> {
    throw new Error('MockDriveMcpServer.shareFile should not be called');
  }
}

function textDownload(text: string): DownloadFileOutput {
  const bytes = Buffer.from(text, 'utf8');
  return {
    fileId: 'unused',
    mimeType: 'text/plain',
    contentBase64: bytes.toString('base64'),
    sizeBytes: bytes.byteLength,
    exported: false,
  };
}

describe('DriveFileSource — unwired (no credentials) returns NOT_CONFIGURED', () => {
  it('listFiles maps CREDENTIAL_NOT_FOUND from the MCP to NOT_CONFIGURED', async () => {
    const server = new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () =>
          mcpError(
            'CREDENTIAL_NOT_FOUND',
            'No active GOOGLE credential for workspace ws-1. Connect Google Drive first.',
          ),
        downloadFile: async () => mcpError('NOT_FOUND', 'unused in this test'),
      },
    );
    const source = new DriveFileSource({ buildMcpServer: () => server });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, false);
    if (listed.ok) return;
    assert.equal(listed.error.code, 'NOT_CONFIGURED');
    // The pipeline's NOT_CONFIGURED contract: ingestWorkspaceFiles surfaces
    // notConfigured=true and writes zero chunks, instead of throwing.
    const store = makeStore();
    const outcome = await ingestWorkspaceFiles({
      workspaceId: WORKSPACE_A,
      source,
      store,
    });
    assert.equal(outcome.notConfigured, true);
    assert.equal(outcome.filesSeen, 0);
    assert.equal(outcome.chunksWritten, 0);
  });

  it('forceUnconfigured short-circuits without ever calling the MCP', async () => {
    let mcpCalled = false;
    const source = new DriveFileSource({
      forceUnconfigured: true,
      buildMcpServer: () => {
        mcpCalled = true;
        throw new Error('MCP factory must not be invoked when forceUnconfigured=true');
      },
    });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, false);
    if (listed.ok) return;
    assert.equal(listed.error.code, 'NOT_CONFIGURED');
    assert.equal(mcpCalled, false);
  });
});

describe('DriveFileSource — wired (credentials present) returns real content', () => {
  const FIXTURE_FILE_ID = 'drive-file-abc123';
  const FIXTURE_NAME = 'workspace-a-playbook.md';
  const FIXTURE_BODY = [
    '# Workspace A Listing Playbook',
    '',
    'When a buyer asks about Magnolia Ridge, mention the renovated kitchen.',
    'Closing attorney: Carter & Associates.',
  ].join('\n');

  function buildWiredServer() {
    return new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () =>
          mcpOk({
            files: [
              {
                id: FIXTURE_FILE_ID,
                name: FIXTURE_NAME,
                mimeType: 'text/markdown',
                modifiedTime: '2026-05-20T12:00:00Z',
              },
            ],
            nextPageToken: null,
          }),
        downloadFile: async (input) => {
          if (input.fileId !== FIXTURE_FILE_ID) {
            return mcpError('NOT_FOUND', `unexpected fileId ${input.fileId}`);
          }
          const bytes = Buffer.from(FIXTURE_BODY, 'utf8');
          return mcpOk({
            fileId: FIXTURE_FILE_ID,
            mimeType: 'text/markdown',
            contentBase64: bytes.toString('base64'),
            sizeBytes: bytes.byteLength,
            exported: false,
          });
        },
      },
    );
  }

  it('listFiles returns FileRefs with id/title/mimeType/modifiedAt populated', async () => {
    const server = buildWiredServer();
    const source = new DriveFileSource({ buildMcpServer: () => server });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.value.length, 1);
    const ref = listed.value[0];
    assert.equal(ref.id, FIXTURE_FILE_ID);
    assert.equal(ref.title, FIXTURE_NAME);
    assert.equal(ref.mimeType, 'text/markdown');
    assert.ok(ref.modifiedAt instanceof Date);
    assert.equal(ref.modifiedAt?.toISOString(), '2026-05-20T12:00:00.000Z');
    assert.equal(ref.sourceUrl, `https://drive.google.com/file/d/${FIXTURE_FILE_ID}/view`);
    // The MCP listFiles was called once, with the text-only Drive query.
    assert.equal(server.listFilesCalls.length, 1);
    assert.equal(server.listFilesCalls[0].query, DEFAULT_DRIVE_QUERY);
  });

  it('fetchFile decodes downloaded base64 to UTF-8 text', async () => {
    const server = buildWiredServer();
    const source = new DriveFileSource({ buildMcpServer: () => server });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    const fetched = await source.fetchFile(WORKSPACE_A, listed.value[0]);
    assert.equal(fetched.ok, true);
    if (!fetched.ok) return;
    assert.equal(fetched.value.text, FIXTURE_BODY);
    assert.equal(fetched.value.ref.sizeBytes, Buffer.from(FIXTURE_BODY, 'utf8').byteLength);
  });

  it('end-to-end: ingestWorkspaceFiles writes CUSTOMER chunks scoped to the workspace', async () => {
    const store = makeStore();
    const source = new DriveFileSource({ buildMcpServer: () => buildWiredServer() });
    const outcome = await ingestWorkspaceFiles({
      workspaceId: WORKSPACE_A,
      source,
      store,
    });
    assert.equal(outcome.notConfigured, undefined);
    assert.equal(outcome.filesSeen, 1);
    assert.equal(outcome.filesIngested, 1);
    assert.ok(outcome.chunksWritten >= 1);
    // Direct query of the store: the chunk landed under CUSTOMER + workspace A.
    const all = await store.search({
      query: 'magnolia ridge buyer carter',
      contextKinds: ['CUSTOMER'],
      k: 10,
    });
    assert.equal(all.ok, true);
    if (!all.ok) return;
    assert.ok(all.value.length >= 1);
    for (const hit of all.value) {
      assert.equal(hit.contextKind, 'CUSTOMER');
      assert.equal(hit.workspaceId, WORKSPACE_A);
    }
    // sourceType:sourceId dedupe key uses the source name + Drive fileId,
    // proving the chunk traces back to the Drive provenance.
    const combined = all.value.map((h) => `${h.title}\n${h.body}`).join('\n');
    assert.match(combined, /Magnolia Ridge|Carter/);
  });
});

describe('DriveFileSource — error mapping preserves vendor signal', () => {
  it('FORBIDDEN at listFiles surfaces as AUTHENTICATION (not NOT_CONFIGURED)', async () => {
    const server = new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () => mcpError('FORBIDDEN', 'The user has not granted drive.readonly'),
        downloadFile: async () => mcpError('NOT_FOUND', 'unused'),
      },
    );
    const source = new DriveFileSource({ buildMcpServer: () => server });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, false);
    if (listed.ok) return;
    assert.equal(listed.error.code, 'AUTHENTICATION');
  });

  it('RATE_LIMITED at downloadFile surfaces as NETWORK on the file', async () => {
    const server = new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () =>
          mcpOk({
            files: [
              {
                id: 'f1',
                name: 'a.txt',
                mimeType: 'text/plain',
                modifiedTime: '2026-05-20T00:00:00Z',
              },
            ],
            nextPageToken: null,
          }),
        downloadFile: async () => mcpError('RATE_LIMITED', '429 userRateLimitExceeded'),
      },
    );
    const source = new DriveFileSource({ buildMcpServer: () => server });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    const fetched = await source.fetchFile(WORKSPACE_A, listed.value[0]);
    assert.equal(fetched.ok, false);
    if (fetched.ok) return;
    assert.equal(fetched.error.code, 'NETWORK');
  });

  it('non-NOT_CONFIGURED listFiles errors cause ingestWorkspaceFiles to throw', async () => {
    const server = new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () => mcpError('UPSTREAM_ERROR', 'Drive API 502'),
        downloadFile: async () => mcpError('NOT_FOUND', 'unused'),
      },
    );
    const source = new DriveFileSource({ buildMcpServer: () => server });
    await assert.rejects(
      () => ingestWorkspaceFiles({ workspaceId: WORKSPACE_A, source, store: makeStore() }),
      /PROVIDER_ERROR|Drive API 502/,
    );
  });
});

describe('DriveFileSource — Drive query restricts to text-extractable mime types', () => {
  it('DEFAULT_DRIVE_QUERY excludes trashed files and only allows text mimes', () => {
    // Behavior contract: the query string the source passes to the Drive
    // MCP must skip trashed rows and restrict to the text mime types the
    // source can actually decode. A change here that loosens the filter
    // would surface binaries the pipeline cannot extract.
    assert.match(DEFAULT_DRIVE_QUERY, /trashed = false/);
    assert.match(DEFAULT_DRIVE_QUERY, /mimeType = 'text\/plain'/);
    assert.match(DEFAULT_DRIVE_QUERY, /mimeType = 'text\/markdown'/);
    assert.match(DEFAULT_DRIVE_QUERY, /mimeType = 'text\/csv'/);
    assert.match(DEFAULT_DRIVE_QUERY, /mimeType = 'text\/html'/);
    assert.match(DEFAULT_DRIVE_QUERY, /mimeType = 'application\/json'/);
    // Google-native docs are not in V1 — they need an export-to-text path.
    assert.doesNotMatch(DEFAULT_DRIVE_QUERY, /vnd\.google-apps\.document/);
  });

  it('paginates through multiple list_files pages until nextPageToken is null', async () => {
    const pages: ListFilesOutput[] = [
      {
        files: [
          { id: 'f1', name: 'a.txt', mimeType: 'text/plain', modifiedTime: null },
        ],
        nextPageToken: 'cursor-2',
      },
      {
        files: [
          { id: 'f2', name: 'b.txt', mimeType: 'text/plain', modifiedTime: null },
        ],
        nextPageToken: null,
      },
    ];
    let pageIndex = 0;
    const server = new MockDriveMcpServer(
      { workspaceId: WORKSPACE_A },
      {
        listFiles: async () => mcpOk(pages[pageIndex++]!),
        downloadFile: async (input) => mcpOk(textDownload(`body-${input.fileId}`)),
      },
    );
    const source = new DriveFileSource({
      buildMcpServer: () => server,
      pageSize: 1,
    });
    const listed = await source.listFiles(WORKSPACE_A);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.deepEqual(
      listed.value.map((r) => r.id),
      ['f1', 'f2'],
    );
    assert.equal(server.listFilesCalls.length, 2);
    assert.equal(server.listFilesCalls[0].pageToken, undefined);
    assert.equal(server.listFilesCalls[1].pageToken, 'cursor-2');
  });
});

