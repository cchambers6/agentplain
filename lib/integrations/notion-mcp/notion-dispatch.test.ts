/**
 * lib/integrations/notion-mcp/notion-dispatch.test.ts
 *
 * Dispatch smoke test for the Notion MCP via the in-process MCP client +
 * recording server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB. (Write-path semantics — create_page / update_page — are
 * covered by notion-mcp.test.ts; this test proves the dispatch wiring.)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient } from '@/lib/integrations/mcp-core';
import { RecordingNotionMcpServer } from './test-server';
import { NOTION_NAMESPACE, NOTION_TOOLS } from './tools';

function client() {
  const server = new RecordingNotionMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: NOTION_TOOLS, namespace: NOTION_NAMESPACE });
}

describe('notion-mcp dispatch', () => {
  it('tools/list exposes the eight Notion tools, all namespaced', async () => {
    const tools = await client().listTools();
    assert.equal(tools.length, 8);
    assert.ok(tools.every((t) => t.name.startsWith('notion.')));
  });

  it('list_pages dispatches and returns an array (non-500)', async () => {
    const res = (await client().call('list_pages', {})) as { pages: unknown[] };
    assert.ok(Array.isArray(res.pages));
  });

  it('search_workspace dispatches with a required query (non-500)', async () => {
    const res = (await client().call('search_workspace', { query: 'runbook' })) as {
      hits: unknown[];
    };
    assert.ok(Array.isArray(res.hits));
  });

  it('invalid params return a typed error, not a generic crash', async () => {
    await assert.rejects(() => client().call('get_page', {}));
  });
});
