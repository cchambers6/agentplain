/**
 * Pins the Notion MCP read + write paths and the file-source adapter:
 *   - listPages / getPage return mapped DTOs + plain-text body
 *   - createPage requires title + valid parent
 *   - updatePage supports archived + appendBody
 *   - searchWorkspace returns pages + databases
 *   - NotionFileSource lists non-archived pages with notion source metadata
 *   - NotionFileSource fetches plain-text content
 *   - Block-text renderer maps heading/list/quote/code blocks
 *
 * Tests stay in-memory — production REST is exercised end-to-end by the
 * notion-ingest sweep.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RecordingNotionMcpServer,
  NotionFileSource,
  __renderBlocksToText,
  type NotionPageSummary,
  type NotionDatabaseSummary,
} from '.';

function fakePage(over: Partial<NotionPageSummary & { body?: string }> = {}): NotionPageSummary & { body?: string } {
  return {
    id: 'p-1',
    title: 'Engineering runbook',
    parentType: 'workspace',
    parentId: null,
    url: 'https://www.notion.so/p1',
    createdAt: '2026-05-30T12:00:00Z',
    lastEditedAt: '2026-05-30T12:00:00Z',
    archived: false,
    body: 'first paragraph\nsecond paragraph',
    ...over,
  };
}

describe('notion-mcp — recording server', () => {
  it('listPages returns non-archived pages up to the limit', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1',
      seed: {
        pages: [fakePage(), fakePage({ id: 'p-2', title: 'Archived doc', archived: true })],
      },
    });
    const res = await mcp.listPages({ limit: 10 });
    assert.ok(res.ok);
    assert.equal(res.value.pages.length, 1);
    assert.equal(res.value.pages[0].id, 'p-1');
  });

  it('getPage returns the page + plain-text body', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1',
      seed: { pages: [fakePage()] },
    });
    const res = await mcp.getPage({ pageId: 'p-1' });
    assert.ok(res.ok);
    assert.equal(res.value.content.text, 'first paragraph\nsecond paragraph');
  });

  it('getPage returns NOT_FOUND for unknown pages', async () => {
    const mcp = new RecordingNotionMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.getPage({ pageId: 'missing' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });

  it('listDatabases returns seeded databases', async () => {
    const db: NotionDatabaseSummary = {
      id: 'db-1', title: 'Tasks', url: null,
      createdAt: null, lastEditedAt: null,
      propertyTypes: { Name: 'title', Status: 'select' },
    };
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1', seed: { databases: [db] },
    });
    const res = await mcp.listDatabases({});
    assert.ok(res.ok);
    assert.equal(res.value.databases.length, 1);
    assert.equal(res.value.databases[0].propertyTypes.Status, 'select');
  });

  it('queryDatabase returns child pages', async () => {
    const db: NotionDatabaseSummary = {
      id: 'db-1', title: 'Tasks', url: null,
      createdAt: null, lastEditedAt: null, propertyTypes: {},
    };
    const child = fakePage({
      id: 'p-3', parentType: 'database_id', parentId: 'db-1',
    });
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1',
      seed: { databases: [db], pages: [child] },
    });
    const res = await mcp.queryDatabase({ databaseId: 'db-1' });
    assert.ok(res.ok);
    assert.equal(res.value.pages.length, 1);
    assert.equal(res.value.pages[0].id, 'p-3');
  });

  it('createPage requires a non-empty title', async () => {
    const mcp = new RecordingNotionMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.createPage({
      parentType: 'page_id', parentId: 'p-1', title: '   ',
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });

  it('createPage rejects when parent does not exist', async () => {
    const mcp = new RecordingNotionMcpServer({ workspaceId: 'ws-1' });
    const res = await mcp.createPage({
      parentType: 'page_id', parentId: 'missing', title: 'New page',
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });

  it('createPage under existing parent returns a pageId', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1', seed: { pages: [fakePage()] },
    });
    const res = await mcp.createPage({
      parentType: 'page_id', parentId: 'p-1', title: 'Child',
      body: 'child body',
    });
    assert.ok(res.ok);
    assert.ok(res.value.pageId.startsWith('page-'));
    assert.ok(res.value.url && res.value.url.startsWith('https://www.notion.so/'));
  });

  it('updatePage appends body and archives', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1', seed: { pages: [fakePage()] },
    });
    const append = await mcp.updatePage({ pageId: 'p-1', appendBody: 'third paragraph' });
    assert.ok(append.ok);
    const after = await mcp.getPage({ pageId: 'p-1' });
    assert.ok(after.ok);
    assert.ok(after.value.content.text.includes('third paragraph'));

    const archive = await mcp.updatePage({ pageId: 'p-1', archived: true });
    assert.ok(archive.ok);
    const listed = await mcp.listPages({});
    assert.ok(listed.ok);
    assert.equal(listed.value.pages.length, 0);
  });

  it('updatePage requires archived or appendBody', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1', seed: { pages: [fakePage()] },
    });
    const res = await mcp.updatePage({ pageId: 'p-1' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });

  it('searchWorkspace returns matching pages and databases', async () => {
    const db: NotionDatabaseSummary = {
      id: 'db-eng', title: 'Engineering Sprints', url: null,
      createdAt: null, lastEditedAt: null, propertyTypes: {},
    };
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-1',
      seed: { pages: [fakePage()], databases: [db] },
    });
    const res = await mcp.searchWorkspace({ query: 'engineer' });
    assert.ok(res.ok);
    assert.equal(res.value.hits.length, 2);
    const objects = res.value.hits.map((h) => h.object).sort();
    assert.deepEqual(objects, ['database', 'page']);
  });
});

describe('notion-mcp — block-text renderer', () => {
  it('renders headings, lists, todos, quotes, and code', () => {
    const text = __renderBlocksToText([
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title' }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Lead paragraph.' }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Item A' }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Step 1' }] } },
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Done item' }], checked: true } },
      { type: 'quote', quote: { rich_text: [{ plain_text: 'Quoted thought.' }] } },
      { type: 'code', code: { language: 'ts', rich_text: [{ plain_text: 'const x = 1;' }] } },
      { type: 'image' }, // skipped
    ]);
    const lines = text.split('\n');
    assert.ok(lines.some((l) => l === '# Title'));
    assert.ok(lines.some((l) => l === '- Item A'));
    assert.ok(lines.some((l) => l === '1. Step 1'));
    assert.ok(lines.some((l) => l === '[x] Done item'));
    assert.ok(lines.some((l) => l === '> Quoted thought.'));
    assert.ok(lines.some((l) => l === '```ts'));
    assert.ok(lines.some((l) => l === 'const x = 1;'));
  });
});

describe('notion-mcp — NotionFileSource', () => {
  it('listFiles returns refs with notion source metadata', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-A', seed: { pages: [fakePage()] },
    });
    const source = new NotionFileSource({ workspaceId: 'ws-A', mcp });
    const res = await source.listFiles('ws-A');
    assert.ok(res.ok);
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].id, 'p-1');
    assert.equal(res.value[0].metadata.source, 'notion');
    assert.equal(res.value[0].mimeType, 'text/markdown');
  });

  it('rejects mismatched workspaceId', async () => {
    const mcp = new RecordingNotionMcpServer({ workspaceId: 'ws-A' });
    const source = new NotionFileSource({ workspaceId: 'ws-A', mcp });
    const res = await source.listFiles('ws-B');
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });

  it('fetchFile returns the page body text', async () => {
    const mcp = new RecordingNotionMcpServer({
      workspaceId: 'ws-A', seed: { pages: [fakePage()] },
    });
    const source = new NotionFileSource({ workspaceId: 'ws-A', mcp });
    const ref = {
      id: 'p-1', title: 'Engineering runbook', mimeType: 'text/markdown',
      sizeBytes: null, sourceUrl: 'https://www.notion.so/p1',
      modifiedAt: null, metadata: { source: 'notion' },
    };
    const res = await source.fetchFile('ws-A', ref);
    assert.ok(res.ok);
    assert.equal(res.value.text, 'first paragraph\nsecond paragraph');
  });

  it('fetchFile returns NOT_FOUND when the page disappears', async () => {
    const mcp = new RecordingNotionMcpServer({ workspaceId: 'ws-A' });
    const source = new NotionFileSource({ workspaceId: 'ws-A', mcp });
    const ref = {
      id: 'missing', title: 'gone', mimeType: 'text/markdown',
      sizeBytes: null, sourceUrl: null, modifiedAt: null,
      metadata: { source: 'notion' },
    };
    const res = await source.fetchFile('ws-A', ref);
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });
});
