/**
 * scripts/test-outlook-mcp.ts
 *
 * Phase B smoke test for the workspace-scoped Outlook MCP server. Mirrors
 * `scripts/test-gmail-mcp.ts` assertion-for-assertion so the protocol
 * wiring of the second provider is proved without real OAuth, real
 * Prisma, or real Microsoft Graph.
 *
 * What it proves:
 *   * Factory routes to `TestOutlookMcpServer` when `TEST_OUTLOOK_MCP=true`.
 *   * Marketplace registration: an `outlook` entry exists with the right
 *     endpoint template + Microsoft Graph scopes + status.
 *   * The exact dispatcher the HTTP route invokes returns the expected
 *     tool surface (6 outlook.* tools) and resource surface.
 *   * `list_messages`, `get_message`, `search_threads`, `list_categories`,
 *     `draft_message`, `label_message` all round-trip through the in-process
 *     client.
 *   * Drafts persist in-memory and were NEVER sent (no /sendMail call path).
 *   * The MCP surface contains no `send` tool (no-outbound check).
 *   * Cross-workspace resource reads are rejected.
 *
 * Run: `npx tsx scripts/test-outlook-mcp.ts`
 *
 * Per `feedback_runner_portability.md`: this smoke test runs the SAME
 * dispatcher the HTTP route runs. The only difference is the route adds
 * the workspace-membership wrapper; the dispatcher + server pair is
 * identical.
 */

import {
  InProcessOutlookMcpClient,
  type DraftMessageOutput,
  type GetMessageOutput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  type ListMessagesOutput,
  type SearchThreadsOutput,
  buildOutlookMcpServer,
  TestOutlookMcpServer,
} from '@/lib/integrations/outlook-mcp';
import { getMarketplaceEntry, resolveMcpEndpoint } from '@/lib/integrations/marketplace';

// Force the test impl regardless of how the script is launched.
process.env.TEST_OUTLOOK_MCP = 'true';

const TEST_WORKSPACE_ID = '11111111-2222-3333-4444-555555555555';

interface SmokeResult {
  passed: number;
  failed: number;
  failures: Array<{ name: string; reason: string }>;
}

function makeAssert(result: SmokeResult) {
  return (name: string, condition: boolean, detail = ''): void => {
    if (condition) {
      result.passed += 1;
      console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
      result.failed += 1;
      result.failures.push({ name, reason: detail || 'condition was false' });
      console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };
}

async function main(): Promise<number> {
  const result: SmokeResult = { passed: 0, failed: 0, failures: [] };
  const assert = makeAssert(result);

  console.log('\n=== Outlook MCP Phase B smoke test ===\n');
  console.log(`Workspace: ${TEST_WORKSPACE_ID}`);
  console.log(`Test impl: TestOutlookMcpServer (no real OAuth, no real Microsoft Graph)\n`);

  // ── Factory routes to the test impl when TEST_OUTLOOK_MCP=true ─────
  console.log('1. Factory + impl selection');
  const server = buildOutlookMcpServer({
    workspaceId: TEST_WORKSPACE_ID,
    preferTestImpl: true,
  });
  assert(
    'factory returns TestOutlookMcpServer when preferTestImpl=true',
    server instanceof TestOutlookMcpServer,
    `name=${server.name}`,
  );
  assert(
    'server is bound to the requested workspaceId',
    server.workspaceId === TEST_WORKSPACE_ID,
    `workspaceId=${server.workspaceId}`,
  );

  // ── Marketplace registration ────────────────────────────────────────
  console.log('\n2. Marketplace registration');
  const entry = getMarketplaceEntry('outlook');
  assert('marketplace contains outlook entry', entry !== null);
  if (entry) {
    assert(
      'mcpEndpointTemplate uses /api/integrations/outlook-mcp/{workspaceId}',
      entry.mcpEndpointTemplate === '/api/integrations/outlook-mcp/{workspaceId}',
      entry.mcpEndpointTemplate,
    );
    assert(
      'resolveMcpEndpoint substitutes workspaceId',
      resolveMcpEndpoint(entry, TEST_WORKSPACE_ID) ===
        `/api/integrations/outlook-mcp/${TEST_WORKSPACE_ID}`,
    );
    assert(
      'scopes include Mail.Read + Mail.ReadWrite + offline_access',
      entry.scopes.includes('Mail.Read') &&
        entry.scopes.includes('Mail.ReadWrite') &&
        entry.scopes.includes('offline_access'),
    );
    assert(
      'scopes DO NOT include Mail.Send (no-outbound architecture)',
      !entry.scopes.includes('Mail.Send'),
      entry.scopes.join(', '),
    );
    assert(
      'status is available',
      entry.status === 'available',
      entry.status,
    );
    assert(
      'oauthConfigKey is MICROSOFT_OAUTH',
      entry.oauthConfigKey === 'MICROSOFT_OAUTH',
      entry.oauthConfigKey,
    );
  }

  // ── In-process MCP client ───────────────────────────────────────────
  console.log('\n3. MCP client (in-process)');
  const client = new InProcessOutlookMcpClient(server);

  const tools = await client.listTools();
  assert('tools/list returns 6 outlook tools', tools.length === 6, `got ${tools.length}`);
  const toolNames = tools.map((t) => t.name).sort();
  const expectedTools = [
    'outlook.draft_message',
    'outlook.get_message',
    'outlook.label_message',
    'outlook.list_categories',
    'outlook.list_messages',
    'outlook.search_threads',
  ];
  assert(
    'tools/list names match the expected set',
    JSON.stringify(toolNames) === JSON.stringify(expectedTools),
    toolNames.join(', '),
  );

  // ── list_messages ───────────────────────────────────────────────────
  console.log('\n4. outlook.list_messages');
  const listResult = (await client.call('outlook', 'list_messages', {
    query: 'inbox',
    maxResults: 10,
  })) as ListMessagesOutput;
  assert(
    'list_messages returns inbox fixtures',
    listResult.messages.length >= 1,
    `got ${listResult.messages.length} messages`,
  );
  const firstId = listResult.messages[0]?.id;
  assert('first message has an id', typeof firstId === 'string' && firstId.length > 0);
  assert(
    'fixture ids look Outlook-shaped (AAMkA prefix)',
    typeof firstId === 'string' && firstId.startsWith('AAMkA'),
    firstId,
  );

  // ── get_message ─────────────────────────────────────────────────────
  console.log('\n5. outlook.get_message');
  const getResult = (await client.call('outlook', 'get_message', {
    messageId: firstId,
  })) as GetMessageOutput;
  assert(
    'get_message returns the same id',
    getResult.message.id === firstId,
    `id=${getResult.message.id}`,
  );
  assert(
    'get_message returns a non-empty body or subject',
    getResult.message.bodyText.length > 0 || getResult.message.subject.length > 0,
  );
  assert(
    'get_message returns ISO 8601 receivedAt',
    typeof getResult.message.receivedAt === 'string' &&
      !Number.isNaN(Date.parse(getResult.message.receivedAt)),
    getResult.message.receivedAt,
  );
  assert(
    'get_message returns Outlook-shaped threadId (AAQkA prefix)',
    typeof getResult.message.threadId === 'string' &&
      getResult.message.threadId.startsWith('AAQkA'),
    getResult.message.threadId,
  );

  // ── search_threads ──────────────────────────────────────────────────
  console.log('\n6. outlook.search_threads');
  const threadsResult = (await client.call('outlook', 'search_threads', {
    query: 'Peachtree',
    maxResults: 5,
  })) as SearchThreadsOutput;
  assert(
    'search_threads finds the buyer-lead thread',
    threadsResult.threads.length >= 1,
    `got ${threadsResult.threads.length} threads`,
  );

  // ── list_categories (Outlook equivalent of Gmail list_labels) ──────
  console.log('\n7. outlook.list_categories');
  const labelsResult = (await client.call('outlook', 'list_categories', {})) as ListLabelsOutput;
  assert(
    'list_categories returns Inbox (system folder)',
    labelsResult.labels.some((l) => l.id === 'Inbox' && l.type === 'system'),
  );
  assert(
    'list_categories returns Drafts (system folder)',
    labelsResult.labels.some((l) => l.id === 'Drafts' && l.type === 'system'),
  );
  assert(
    'list_categories returns a user-defined category',
    labelsResult.labels.some((l) => l.type === 'user'),
  );

  // ── draft_message (no send, per project_no_outbound_architecture) ──
  console.log('\n8. outlook.draft_message (drafts only — never sends)');
  const draftResult = (await client.call('outlook', 'draft_message', {
    to: ['jane.buyer@example.com'],
    subject: 'Re: Interested in 123 Peachtree St',
    body: 'Hi Jane, happy to show you the home Wednesday at 2pm.',
    threadId: getResult.message.threadId,
    inReplyToMessageId: getResult.message.rfcMessageId ?? undefined,
  })) as DraftMessageOutput;
  assert(
    'draft_message returns a provider draftId',
    typeof draftResult.draftId === 'string' && draftResult.draftId.length > 0,
    draftResult.draftId,
  );
  assert(
    'draft_message returns the requested threadId',
    draftResult.threadId === getResult.message.threadId,
  );
  assert(
    'draft_message draftId === messageId (Microsoft has no separate draft id)',
    draftResult.draftId === draftResult.messageId,
  );
  // Verify the draft landed in the test server's drafts map (NOT sent).
  if (server instanceof TestOutlookMcpServer) {
    const persistedDraft = server.getDraft(draftResult.draftId);
    assert(
      'draft persisted in-memory (test server has no send path)',
      persistedDraft !== undefined,
    );
    if (persistedDraft) {
      assert(
        'draft body matches the input',
        persistedDraft.body.includes('Wednesday at 2pm'),
      );
      assert(
        'draft inReplyTo header was carried through',
        persistedDraft.inReplyToMessageId === (getResult.message.rfcMessageId ?? undefined),
      );
    }
  }

  // ── label_message (Outlook category PATCH) ─────────────────────────
  console.log('\n9. outlook.label_message');
  const labelResult = (await client.call('outlook', 'label_message', {
    messageId: firstId,
    addLabelIds: ['cat-red'],
  })) as LabelMessageOutput;
  assert(
    'label_message adds cat-red',
    labelResult.labels.includes('cat-red'),
    labelResult.labels.join(', '),
  );

  // ── tools/list, resources/list, resources/read ─────────────────────
  console.log('\n10. MCP discovery + resource read');
  const resources = await client.listResources();
  assert(
    'resources/list returns outlook://workspace/{workspaceId}/inbox',
    resources.some((r) => r.uri === `outlook://workspace/${TEST_WORKSPACE_ID}/inbox`),
  );
  const inboxRead = await client.readResource(
    `outlook://workspace/${TEST_WORKSPACE_ID}/inbox`,
  );
  assert(
    'resources/read returns application/json',
    inboxRead.mimeType === 'application/json',
  );
  try {
    const parsed = JSON.parse(inboxRead.text) as ListMessagesOutput;
    assert(
      'resources/read body decodes to a ListMessagesOutput',
      Array.isArray(parsed.messages),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert('resources/read body decodes to a ListMessagesOutput', false, msg);
  }

  // ── Cross-workspace isolation ──────────────────────────────────────
  console.log('\n11. Cross-workspace isolation');
  try {
    const other = await client.readResource(
      `outlook://workspace/00000000-0000-0000-0000-000000000000/inbox`,
    );
    assert(
      'cross-workspace resource read is rejected',
      false,
      `unexpectedly succeeded: ${JSON.stringify(other)}`,
    );
  } catch (err) {
    assert(
      'cross-workspace resource read is rejected',
      err instanceof Error && /workspace/i.test(err.message),
      err instanceof Error ? err.message : String(err),
    );
  }

  // ── No-outbound surface check ──────────────────────────────────────
  console.log('\n12. No-outbound surface check');
  const sendTool = tools.find((t) => /send/i.test(t.name));
  assert(
    'no send tool exists in the MCP surface',
    sendTool === undefined,
    sendTool ? `unexpected: ${sendTool.name}` : 'confirmed',
  );

  // ── Verify no real Microsoft Graph call was made ──────────────────
  console.log('\n13. Verify no real OAuth + no real Microsoft Graph');
  if (server instanceof TestOutlookMcpServer) {
    const realGraphCalls = server.calls.filter((c) =>
      /graph\.microsoft\.com|me\/messages|me\/mailFolders/.test(JSON.stringify(c)),
    );
    assert(
      'no real Microsoft Graph SDK calls were made',
      realGraphCalls.length === 0,
      `${server.calls.length} calls total, all routed through TestOutlookMcpServer`,
    );
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log(`Total assertions: ${result.passed + result.failed}`);
  console.log(`Passed: ${result.passed}`);
  console.log(`Failed: ${result.failed}`);
  if (result.failed > 0) {
    console.log('\nFailures:');
    for (const f of result.failures) {
      console.log(`  - ${f.name}: ${f.reason}`);
    }
    console.log('\nRESULT: FAIL\n');
    return 1;
  }
  console.log('\nRESULT: PASS\n');
  return 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exit(2);
  });
