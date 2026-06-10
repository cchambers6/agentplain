/**
 * lib/skills/month-end-close-cpa/karbon-close-fetcher.test.ts
 *
 * Integration test for the Karbon-backed `CloseFetcher`. The honest win:
 * Karbon JOBS are the checklist (real firm task wording, not a template),
 * and a `done` job translates into a synthetic receipt that marks its own
 * checklist item received.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: pass = the close
 * checklist is the firm's actual Karbon jobs and completed jobs are
 * bucketed received.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mcpError, mcpOk, type McpErrorCode, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  GetClientInput,
  GetClientOutput,
  GetWorkflowInput,
  GetWorkflowOutput,
  KarbonClientSummary,
  KarbonJobSummary,
  KarbonMcpServer,
  KarbonWorkflowSummary,
  ListClientsInput,
  ListClientsOutput,
  ListJobsInput,
  ListJobsOutput,
  ListRecurringTasksInput,
  ListRecurringTasksOutput,
  ListWorkflowsInput,
  ListWorkflowsOutput,
} from '@/lib/integrations/karbon-mcp';
import { runSkill } from './skill';
import { KARBON_NOT_CONNECTED_MESSAGE, KarbonCloseFetcher } from './karbon-close-fetcher';

const WORKSPACE_ID = 'ws-cpa-karbon-0001';
const CLIENT_ID = 'k-cl-1';
const PERIOD = '2026-04';
const NOW = new Date('2026-05-20T10:00:00Z');

function buildMockMcp(args: {
  client?: KarbonClientSummary;
  workflows?: KarbonWorkflowSummary[];
  jobsByWorkflow?: Record<string, KarbonJobSummary[]>;
  failWith?: { code: McpErrorCode; message: string };
}): KarbonMcpServer {
  return {
    name: 'karbon-mock' as const,
    workspaceId: WORKSPACE_ID,
    async listClients(_i: ListClientsInput): Promise<McpResult<ListClientsOutput>> {
      return mcpOk({ clients: args.client ? [args.client] : [] });
    },
    async getClient(_i: GetClientInput): Promise<McpResult<GetClientOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      if (!args.client) return mcpError('NOT_FOUND', 'no client');
      return mcpOk({ client: args.client });
    },
    async listWorkflows(input: ListWorkflowsInput): Promise<McpResult<ListWorkflowsOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      let wfs = args.workflows ?? [];
      if (input.clientId) wfs = wfs.filter((w) => w.clientId === input.clientId);
      if (input.status) wfs = wfs.filter((w) => w.status === input.status);
      return mcpOk({ workflows: wfs });
    },
    async getWorkflow(_i: GetWorkflowInput): Promise<McpResult<GetWorkflowOutput>> {
      return mcpError('NOT_FOUND', 'not used');
    },
    async listJobs(input: ListJobsInput): Promise<McpResult<ListJobsOutput>> {
      const jobs = (input.workflowId && args.jobsByWorkflow?.[input.workflowId]) || [];
      return mcpOk({ jobs });
    },
    async listRecurringTasks(
      _i: ListRecurringTasksInput,
    ): Promise<McpResult<ListRecurringTasksOutput>> {
      return mcpOk({ recurringTasks: [] });
    },
  };
}

describe('KarbonCloseFetcher — happy path', () => {
  it('builds the checklist from real Karbon jobs and marks done jobs received', async () => {
    const mcp = buildMockMcp({
      client: { id: CLIENT_ID, name: 'Sawmill Industries', email: 'ap@sawmill.example', kind: 'organization' },
      workflows: [
        { id: 'wf-1', title: '2026-04 Monthly Close — Sawmill', clientId: CLIENT_ID, status: 'active', daysSinceLastActivity: 3 },
      ],
      jobsByWorkflow: {
        'wf-1': [
          { id: 'j1', workflowId: 'wf-1', title: 'Bank reconciliation', status: 'done', assigneeEmail: 's@firm.example', dueAt: '2026-05-10' },
          { id: 'j2', workflowId: 'wf-1', title: 'Credit card reconciliation', status: 'blocked', assigneeEmail: 's@firm.example', dueAt: '2026-05-10' },
          { id: 'j3', workflowId: 'wf-1', title: 'Sales tax filing', status: 'todo', assigneeEmail: null, dueAt: '2026-05-12' },
        ],
      },
    });
    const fetcher = new KarbonCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    assert.equal(fetcher.name, 'karbon');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.clientName, 'Sawmill Industries');
    // Checklist = the 3 real jobs (REAL firm wording, not a template).
    assert.equal(res.value.items.length, 3);
    const labels = res.value.items.map((i) => i.label).sort();
    assert.deepEqual(labels, ['Bank reconciliation', 'Credit card reconciliation', 'Sales tax filing']);
    // The done job → received via synthetic receipt.
    const bankItem = res.value.items.find((i) => i.label === 'Bank reconciliation');
    assert.equal(bankItem?.status, 'received');
    assert.equal(res.value.bucketCounts.received, 1);
    // Two jobs still outstanding → chased.
    const chase = res.value.chaseEmails[0];
    assert.match(chase.body, /Credit card reconciliation/);
    assert.match(chase.body, /Sales tax filing/);
    assert.ok(!/Bank reconciliation/.test(chase.body));
    // Job titles mapped to honest categories.
    assert.equal(bankItem?.category, 'bank-statement');
  });
});

describe('KarbonCloseFetcher — degraded / honest gaps', () => {
  it('returns NOT_CONFIGURED when Karbon is not connected', async () => {
    const mcp = buildMockMcp({
      failWith: { code: 'TOKEN_EXPIRED', message: 'karbon token expired' },
    });
    const fetcher = new KarbonCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.ok(res.error.message.includes(KARBON_NOT_CONNECTED_MESSAGE));
  });

  it('returns NOT_APPLICABLE when the client has no active workflow', async () => {
    const mcp = buildMockMcp({
      client: { id: CLIENT_ID, name: 'Sawmill Industries', email: 'ap@sawmill.example', kind: 'organization' },
      workflows: [],
    });
    const fetcher = new KarbonCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_APPLICABLE');
  });

  it('runs end-to-end against the shipped fixture Karbon server', async () => {
    const { TestKarbonMcpServer } = await import('@/lib/integrations/karbon-mcp');
    const fetcher = new KarbonCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestKarbonMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    // Fixture k-cl-1 (Acme Roofing) has active wf-1 with jobs
    // 'Bank reconciliation' (blocked) + 'AR aging' (in-progress).
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: 'k-cl-1',
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.clientName, 'Acme Roofing');
    assert.equal(res.value.items.length, 2);
    // No done job in the fixture → nothing received, both chased.
    assert.equal(res.value.bucketCounts.received, 0);
  });
});
