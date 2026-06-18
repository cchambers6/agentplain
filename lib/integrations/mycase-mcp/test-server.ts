/**
 * lib/integrations/mycase-mcp/test-server.ts
 *
 * Fixture-backed MyCase MCP server — the second implementation that satisfies
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
  type CreateCaseInput,
  type CreateCaseOutput,
  type ListCasesInput,
  type ListCasesOutput,
  type MyCaseCaseSummary,
  type MyCaseMcpServer,
  type SendInvoiceInput,
  type SendInvoiceOutput,
  type UpdateStatusInput,
  type UpdateStatusOutput,
} from './types';

const FIXTURE_CASES: MyCaseCaseSummary[] = [
  {
    id: 'cs-1',
    name: 'Smith v. Acme — contract dispute',
    status: 'open',
    clientId: 'c-1',
    leadAttorneyEmail: 'partner@firm.example',
  },
  {
    id: 'cs-2',
    name: 'Jones estate planning',
    status: 'pending',
    clientId: 'c-2',
    leadAttorneyEmail: 'associate@firm.example',
  },
  {
    id: 'cs-3',
    name: 'Doe closing (completed)',
    status: 'closed',
    clientId: 'c-3',
    leadAttorneyEmail: null,
  },
];

export class TestMyCaseMcpServer implements MyCaseMcpServer {
  readonly name = 'mycase-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listCases(input: ListCasesInput): Promise<McpResult<ListCasesOutput>> {
    let cases = FIXTURE_CASES;
    if (input.status) cases = cases.filter((c) => c.status === input.status);
    if (input.query) {
      const q = input.query.toLowerCase();
      cases = cases.filter((c) => c.name.toLowerCase().includes(q));
    }
    return mcpOk({ cases });
  }

  async createCase(_input: CreateCaseInput): Promise<McpResult<CreateCaseOutput>> {
    return gateMutation('MyCase', 'opening a case');
  }

  async sendInvoice(_input: SendInvoiceInput): Promise<McpResult<SendInvoiceOutput>> {
    return gateMutation('MyCase', 'sending an invoice');
  }

  async updateStatus(_input: UpdateStatusInput): Promise<McpResult<UpdateStatusOutput>> {
    return gateMutation('MyCase', 'updating case status');
  }
}
