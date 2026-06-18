/**
 * lib/integrations/kvcore-mcp/test-server.ts
 *
 * Fixture-backed kvCORE MCP server — the second implementation that satisfies
 * the two-implementation rule (`feedback_runner_portability.md`). Deterministic,
 * no network, no credential resolution. Used by the smoke test + by
 * `INTEGRATIONS_PROVIDER=test` previews.
 *
 * Read methods return fixtures; mutating methods return the same
 * APPROVAL_REQUIRED the prod server returns — so the smoke test pins the gate
 * behaviour (nothing mutating fires without approval).
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type CreateLeadInput,
  type CreateLeadOutput,
  type KvcoreLeadSummary,
  type KvcoreMcpServer,
  type ListLeadsInput,
  type ListLeadsOutput,
  type LogActivityInput,
  type LogActivityOutput,
  type SendMassMessageInput,
  type SendMassMessageOutput,
} from './types';

const FIXTURE_LEADS: KvcoreLeadSummary[] = [
  {
    id: 'l-1',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+14045550101',
    status: 'New',
    source: 'Zillow',
  },
  {
    id: 'l-2',
    name: 'Bob Jones',
    email: 'bob.jones@example.com',
    phone: '+14045550102',
    status: 'Nurture',
    source: 'IDX',
  },
  {
    id: 'l-3',
    name: 'Carla Doe',
    email: null,
    phone: '+14045550103',
    status: 'Active',
    source: null,
  },
];

export class TestKvcoreMcpServer implements KvcoreMcpServer {
  readonly name = 'kvcore-test' as const;
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

  async createLead(_input: CreateLeadInput): Promise<McpResult<CreateLeadOutput>> {
    return gateMutation('kvCORE', 'creating a lead');
  }

  async sendMassMessage(
    _input: SendMassMessageInput,
  ): Promise<McpResult<SendMassMessageOutput>> {
    return gateMutation('kvCORE', 'sending a mass message');
  }

  async logActivity(_input: LogActivityInput): Promise<McpResult<LogActivityOutput>> {
    return gateMutation('kvCORE', 'logging an activity');
  }
}
