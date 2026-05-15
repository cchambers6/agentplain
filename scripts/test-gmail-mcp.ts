/**
 * scripts/test-gmail-mcp.ts
 *
 * Phase A smoke test for the workspace-scoped Gmail MCP server. Verifies
 * the protocol wiring without real OAuth, real Prisma, or real Gmail.
 *
 * Per the PR brief:
 *   * Creates a test workspace context (synthetic UUID; no DB).
 *   * Mints an in-process MCP client pointed at the deterministic test
 *     server (`TestGmailMcpServer` via the marketplace factory with
 *     `preferTestImpl: true`).
 *   * Calls list_messages, get_message, search_threads, list_labels,
 *     draft_message, label_message, plus tools/list, resources/list,
 *     resources/read.
 *   * Verifies no real OAuth is needed by setting `INTEGRATIONS_PROVIDER=test`
 *     and `TEST_GMAIL_MCP=true` if not already present.
 *   * Prints PASS/FAIL with assertion count.
 *
 * Run: `npx tsx scripts/test-gmail-mcp.ts`
 *
 * Per `feedback_runner_portability.md`: this smoke test runs the SAME
 * dispatcher the HTTP route runs. The only difference is the route adds
 * the workspace-membership wrapper; the dispatcher + server pair is
 * identical.
 */

import {
  InProcessMcpClient,
  type FullMessage,
  type ListMessagesOutput,
  type GetMessageOutput,
  type SearchThreadsOutput,
  type DraftMessageOutput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  buildGmailMcpServer,
  TestGmailMcpServer,
} from '@/lib/integrations/gmail-mcp';
import { getMarketplaceEntry, resolveMcpEndpoint } from '@/lib/integrations/marketplace';

// Force the test impl regardless of how the script is launched.
process.env.TEST_GMAIL_MCP = 'true';

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

  console.log('\n=== Gmail MCP Phase A smoke test ===\n');
  console.log(`Workspace: ${TEST_WORKSPACE_ID}`);
  console.log(`Test impl: TestGmailMcpServer (no real OAuth, no real Gmail)\n`);

  // ── Factory routes to the test impl when TEST_GMAIL_MCP=true ────────
  console.log('1. Factory + impl selection');
  const server = buildGmailMcpServer({
    workspaceId: TEST_WORKSPACE_ID,
    preferTestImpl: true,
  });
  assert(
    'factory returns TestGmailMcpServer when preferTestImpl=true',
    server instanceof TestGmailMcpServer,
    `name=${server.name}`,
  );
  assert(
    'server is bound to the requested workspaceId',
    server.workspaceId === TEST_WORKSPACE_ID,
    `workspaceId=${server.workspaceId}`,
  );

  // ── Marketplace registration ────────────────────────────────────────
  console.log('\n2. Marketplace registration');
  const entry = getMarketplaceEntry('gmail');
  assert('marketplace contains gmail entry', entry !== null);
  if (entry) {
    assert(
      'mcpEndpointTemplate uses /api/integrations/gmail-mcp/{workspaceId}',
      entry.mcpEndpointTemplate === '/api/integrations/gmail-mcp/{workspaceId}',
      entry.mcpEndpointTemplate,
    );
    assert(
      'resolveMcpEndpoint substitutes workspaceId',
      resolveMcpEndpoint(entry, TEST_WORKSPACE_ID) ===
        `/api/integrations/gmail-mcp/${TEST_WORKSPACE_ID}`,
    );
    assert(
      'scopes include gmail.readonly + gmail.modify + gmail.compose',
      entry.scopes.includes('gmail.readonly') &&
        entry.scopes.includes('gmail.modify') &&
        entry.scopes.includes('gmail.compose'),
    );
    assert(
      'status is available',
      entry.status === 'available',
      entry.status,
    );
  }

  // ── In-process MCP client ───────────────────────────────────────────
  console.log('\n3. MCP client (in-process)');
  const client = new InProcessMcpClient(server);

  const tools = await client.listTools();
  assert('tools/list returns 6 gmail tools', tools.length === 6, `got ${tools.length}`);
  const toolNames = tools.map((t) => t.name).sort();
  const expectedTools = [
    'gmail.draft_message',
    'gmail.get_message',
    'gmail.label_message',
    'gmail.list_labels',
    'gmail.list_messages',
    'gmail.search_threads',
  ];
  assert(
    'tools/list names match the expected set',
    JSON.stringify(toolNames) === JSON.stringify(expectedTools),
    toolNames.join(', '),
  );

  // ── list_messages ───────────────────────────────────────────────────
  console.log('\n4. gmail.list_messages');
  const listResult = (await client.call('gmail', 'list_messages', {
    query: 'in:inbox',
    maxResults: 10,
  })) as ListMessagesOutput;
  assert(
    'list_messages returns inbox fixtures',
    listResult.messages.length >= 1,
    `got ${listResult.messages.length} messages`,
  );
  const firstId = listResult.messages[0]?.id;
  assert('first message has an id', typeof firstId === 'string' && firstId.length > 0);

  // ── get_message ─────────────────────────────────────────────────────
  console.log('\n5. gmail.get_message');
  const getResult = (await client.call('gmail', 'get_message', {
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

  // ── search_threads ──────────────────────────────────────────────────
  console.log('\n6. gmail.search_threads');
  const threadsResult = (await client.call('gmail', 'search_threads', {
    query: 'Peachtree',
    maxResults: 5,
  })) as SearchThreadsOutput;
  assert(
    'search_threads finds the buyer-lead thread',
    threadsResult.threads.length >= 1,
    `got ${threadsResult.threads.length} threads`,
  );

  // ── list_labels ─────────────────────────────────────────────────────
  console.log('\n7. gmail.list_labels');
  const labelsResult = (await client.call('gmail', 'list_labels', {})) as ListLabelsOutput;
  assert(
    'list_labels returns INBOX',
    labelsResult.labels.some((l) => l.id === 'INBOX'),
  );
  assert(
    'list_labels returns DRAFT',
    labelsResult.labels.some((l) => l.id === 'DRAFT'),
  );

  // ── draft_message (no send, per project_no_outbound_architecture) ──
  console.log('\n8. gmail.draft_message (drafts only — never sends)');
  const draftResult = (await client.call('gmail', 'draft_message', {
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
  // Verify the draft landed in the test server's drafts map (NOT sent).
  if (server instanceof TestGmailMcpServer) {
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
    }
  }

  // ── label_message ──────────────────────────────────────────────────
  console.log('\n9. gmail.label_message');
  const labelResult = (await client.call('gmail', 'label_message', {
    messageId: firstId,
    addLabelIds: ['IMPORTANT'],
  })) as LabelMessageOutput;
  assert(
    'label_message adds IMPORTANT',
    labelResult.labels.includes('IMPORTANT'),
    labelResult.labels.join(', '),
  );

  // ── tools/list, resources/list, resources/read ─────────────────────
  console.log('\n10. MCP discovery + resource read');
  const resources = await client.listResources();
  assert(
    'resources/list returns gmail://workspace/{workspaceId}/inbox',
    resources.some((r) => r.uri === `gmail://workspace/${TEST_WORKSPACE_ID}/inbox`),
  );
  const inboxRead = await client.readResource(
    `gmail://workspace/${TEST_WORKSPACE_ID}/inbox`,
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
      `gmail://workspace/00000000-0000-0000-0000-000000000000/inbox`,
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

  // ── Verify no real Gmail call was made ─────────────────────────────
  console.log('\n13. Verify no real OAuth + no real Gmail');
  if (server instanceof TestGmailMcpServer) {
    const realGmailCalls = server.calls.filter((c) =>
      /googleapis|users\.messages\.|users\.threads\./.test(JSON.stringify(c)),
    );
    assert(
      'no real Gmail SDK calls were made',
      realGmailCalls.length === 0,
      `${server.calls.length} calls total, all routed through TestGmailMcpServer`,
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
