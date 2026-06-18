/**
 * lib/integrations/clio-mcp/test-server.ts
 *
 * Fixture-backed Clio MCP server — the second implementation that satisfies
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
  type ClioMatterSummary,
  type ClioMcpServer,
  type CreateBillInput,
  type CreateBillOutput,
  type CreateMatterInput,
  type CreateMatterOutput,
  type ListMattersInput,
  type ListMattersOutput,
  type LogTimeInput,
  type LogTimeOutput,
  type SendSecureMessageInput,
  type SendSecureMessageOutput,
} from './types';

const FIXTURE_MATTERS: ClioMatterSummary[] = [
  {
    id: 'm-1',
    displayNumber: '00123-Smith',
    description: 'Smith v. Acme — contract dispute',
    status: 'open',
    responsibleAttorneyEmail: 'partner@firm.example',
    clientId: 'c-1',
  },
  {
    id: 'm-2',
    displayNumber: '00124-Jones',
    description: 'Jones estate planning',
    status: 'pending',
    responsibleAttorneyEmail: 'associate@firm.example',
    clientId: 'c-2',
  },
  {
    id: 'm-3',
    displayNumber: '00099-Doe',
    description: 'Doe closing (completed)',
    status: 'closed',
    responsibleAttorneyEmail: null,
    clientId: 'c-3',
  },
];

export class TestClioMcpServer implements ClioMcpServer {
  readonly name = 'clio-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listMatters(input: ListMattersInput): Promise<McpResult<ListMattersOutput>> {
    let matters = FIXTURE_MATTERS;
    if (input.status) matters = matters.filter((m) => m.status === input.status);
    if (input.query) {
      const q = input.query.toLowerCase();
      matters = matters.filter(
        (m) =>
          m.description.toLowerCase().includes(q) ||
          m.displayNumber.toLowerCase().includes(q),
      );
    }
    return mcpOk({ matters });
  }

  async createMatter(_input: CreateMatterInput): Promise<McpResult<CreateMatterOutput>> {
    return gateMutation('Clio', 'opening a matter');
  }

  async logTime(_input: LogTimeInput): Promise<McpResult<LogTimeOutput>> {
    return gateMutation('Clio', 'logging time on a matter');
  }

  async createBill(_input: CreateBillInput): Promise<McpResult<CreateBillOutput>> {
    return gateMutation('Clio', 'raising a bill');
  }

  async sendSecureMessage(
    _input: SendSecureMessageInput,
  ): Promise<McpResult<SendSecureMessageOutput>> {
    return gateMutation('Clio', 'sending a secure client message');
  }
}
