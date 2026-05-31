/**
 * lib/integrations/karbon-mcp/test-server.ts
 *
 * Fixture-backed Karbon MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke
 * test + by `INTEGRATIONS_PROVIDER=test` previews.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type GetClientInput,
  type GetClientOutput,
  type GetWorkflowInput,
  type GetWorkflowOutput,
  type KarbonClientSummary,
  type KarbonJobSummary,
  type KarbonMcpServer,
  type KarbonRecurringTaskSummary,
  type KarbonWorkflowSummary,
  type ListClientsInput,
  type ListClientsOutput,
  type ListJobsInput,
  type ListJobsOutput,
  type ListRecurringTasksInput,
  type ListRecurringTasksOutput,
  type ListWorkflowsInput,
  type ListWorkflowsOutput,
} from './types';

const FIXTURE_CLIENTS: KarbonClientSummary[] = [
  { id: 'k-cl-1', name: 'Acme Roofing', email: 'ar@example.com', kind: 'organization' },
  { id: 'k-cl-2', name: 'Buckhead HVAC', email: 'bh@example.com', kind: 'organization' },
  { id: 'k-cl-3', name: 'Jane Owner', email: 'jane@example.com', kind: 'contact' },
];

const FIXTURE_WORKFLOWS: KarbonWorkflowSummary[] = [
  {
    id: 'wf-1',
    title: '2026 Q1 Monthly Close — Acme Roofing',
    clientId: 'k-cl-1',
    status: 'active',
    daysSinceLastActivity: 9,
  },
  {
    id: 'wf-2',
    title: '2026 Tax Return — Buckhead HVAC',
    clientId: 'k-cl-2',
    status: 'active',
    daysSinceLastActivity: 2,
  },
  {
    id: 'wf-3',
    title: '2025 Tax Return — Jane Owner',
    clientId: 'k-cl-3',
    status: 'completed',
    daysSinceLastActivity: 45,
  },
];

const FIXTURE_JOBS: KarbonJobSummary[] = [
  {
    id: 'job-1',
    workflowId: 'wf-1',
    title: 'Bank reconciliation',
    status: 'blocked',
    assigneeEmail: 'staff@firm.example',
    dueAt: '2026-04-30',
  },
  {
    id: 'job-2',
    workflowId: 'wf-1',
    title: 'AR aging',
    status: 'in-progress',
    assigneeEmail: 'staff@firm.example',
    dueAt: '2026-05-15',
  },
  {
    id: 'job-3',
    workflowId: 'wf-2',
    title: 'Gather 1099s',
    status: 'review',
    assigneeEmail: 'partner@firm.example',
    dueAt: '2026-05-20',
  },
];

const FIXTURE_RECURRING: KarbonRecurringTaskSummary[] = [
  {
    id: 'rt-1',
    title: 'Monthly close — Acme Roofing',
    clientId: 'k-cl-1',
    cadence: 'monthly',
    nextDueAt: '2026-06-15T17:00:00Z',
  },
  {
    id: 'rt-2',
    title: 'Quarterly sales-tax — Buckhead HVAC',
    clientId: 'k-cl-2',
    cadence: 'quarterly',
    nextDueAt: '2026-07-20T17:00:00Z',
  },
];

export class TestKarbonMcpServer implements KarbonMcpServer {
  readonly name = 'karbon-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listClients(_input: ListClientsInput): Promise<McpResult<ListClientsOutput>> {
    return mcpOk({ clients: FIXTURE_CLIENTS });
  }

  async getClient(input: GetClientInput): Promise<McpResult<GetClientOutput>> {
    const client = FIXTURE_CLIENTS.find((c) => c.id === input.clientId);
    if (!client) return mcpError('NOT_FOUND', `No client ${input.clientId}`);
    return mcpOk({ client });
  }

  async listWorkflows(input: ListWorkflowsInput): Promise<McpResult<ListWorkflowsOutput>> {
    let wfs = FIXTURE_WORKFLOWS;
    if (input.clientId) wfs = wfs.filter((w) => w.clientId === input.clientId);
    if (input.status) wfs = wfs.filter((w) => w.status === input.status);
    return mcpOk({ workflows: wfs });
  }

  async getWorkflow(input: GetWorkflowInput): Promise<McpResult<GetWorkflowOutput>> {
    const workflow = FIXTURE_WORKFLOWS.find((w) => w.id === input.workflowId);
    if (!workflow) return mcpError('NOT_FOUND', `No workflow ${input.workflowId}`);
    return mcpOk({ workflow });
  }

  async listJobs(input: ListJobsInput): Promise<McpResult<ListJobsOutput>> {
    let jobs = FIXTURE_JOBS;
    if (input.workflowId) jobs = jobs.filter((j) => j.workflowId === input.workflowId);
    if (input.status) jobs = jobs.filter((j) => j.status === input.status);
    return mcpOk({ jobs });
  }

  async listRecurringTasks(
    input: ListRecurringTasksInput,
  ): Promise<McpResult<ListRecurringTasksOutput>> {
    let rs = FIXTURE_RECURRING;
    if (input.clientId) rs = rs.filter((r) => r.clientId === input.clientId);
    return mcpOk({ recurringTasks: rs });
  }
}
