/**
 * lib/integrations/boldtrail-mcp/test-server.ts
 *
 * Fixture-backed BoldTrail MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke test +
 * by `INTEGRATIONS_PROVIDER=test` previews.
 *
 * Read methods return fixtures; mutating methods return the same
 * APPROVAL_REQUIRED the prod server returns — so the smoke test pins the gate
 * behaviour (nothing mutating fires without approval).
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type BoldTrailLeadSummary,
  type BoldtrailMcpServer,
  type ListLeadsInput,
  type ListLeadsOutput,
  type SendTemplateInput,
  type SendTemplateOutput,
  type UpdatePipelineInput,
  type UpdatePipelineOutput,
} from './types';

const FIXTURE_LEADS: BoldTrailLeadSummary[] = [
  {
    id: 'l-1',
    name: 'Ava Smith',
    email: 'ava.smith@example.com',
    stage: 'New',
    pipelineId: 'p-1',
  },
  {
    id: 'l-2',
    name: 'Ben Jones',
    email: 'ben.jones@example.com',
    stage: 'Nurture',
    pipelineId: 'p-1',
  },
  {
    id: 'l-3',
    name: 'Carla Doe',
    email: null,
    stage: 'Active',
    pipelineId: 'p-2',
  },
];

export class TestBoldtrailMcpServer implements BoldtrailMcpServer {
  readonly name = 'boldtrail-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    let leads = FIXTURE_LEADS;
    if (input.query) {
      const q = input.query.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q),
      );
    }
    return mcpOk({ leads });
  }

  async updatePipeline(
    _input: UpdatePipelineInput,
  ): Promise<McpResult<UpdatePipelineOutput>> {
    return gateMutation('BoldTrail', 'updating a lead pipeline');
  }

  async sendTemplate(
    _input: SendTemplateInput,
  ): Promise<McpResult<SendTemplateOutput>> {
    return gateMutation('BoldTrail', 'sending a template message');
  }
}
