/**
 * lib/integrations/taxdome-mcp/test-server.ts
 *
 * Fixture-backed TaxDome MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke
 * test + by `INTEGRATIONS_PROVIDER=test` previews.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type GetClientInput,
  type GetClientOutput,
  type GetTaxDocumentInput,
  type GetTaxDocumentOutput,
  type ListClientsInput,
  type ListClientsOutput,
  type ListEngagementLettersInput,
  type ListEngagementLettersOutput,
  type ListReceivedDocumentsInput,
  type ListReceivedDocumentsOutput,
  type ListTaxDocumentsInput,
  type ListTaxDocumentsOutput,
  type TaxdomeClientSummary,
  type TaxdomeDocumentSummary,
  type TaxdomeMcpServer,
} from './types';

const FIXTURE_CLIENTS: TaxdomeClientSummary[] = [
  { id: 'cl-1', name: 'Acme Roofing', email: 'ar@example.com', active: true },
  { id: 'cl-2', name: 'Buckhead HVAC', email: 'bh@example.com', active: true },
  { id: 'cl-3', name: 'Closed Co.', email: null, active: false },
];

const FIXTURE_DOCS: TaxdomeDocumentSummary[] = [
  {
    id: 'doc-1',
    filename: 'AcmeRoofing-EngagementLetter-2026.pdf',
    clientId: 'cl-1',
    uploadedAt: '2026-01-08T15:24:00Z',
    status: 'reviewed',
    kind: 'engagement-letter',
  },
  {
    id: 'doc-2',
    filename: 'AcmeRoofing-Q1-BankStatement.pdf',
    clientId: 'cl-1',
    uploadedAt: '2026-04-12T09:11:00Z',
    status: 'pending-review',
    kind: 'received-doc',
  },
  {
    id: 'doc-3',
    filename: 'BuckheadHVAC-Q1-BankStatement.pdf',
    clientId: 'cl-2',
    uploadedAt: '2026-04-13T18:30:00Z',
    status: 'pending-review',
    kind: 'received-doc',
  },
  {
    id: 'doc-4',
    filename: 'BuckheadHVAC-EngagementLetter-2026.pdf',
    clientId: 'cl-2',
    uploadedAt: '2026-01-05T10:00:00Z',
    status: 'reviewed',
    kind: 'engagement-letter',
  },
  {
    id: 'doc-5',
    filename: 'AcmeRoofing-2025-1120.pdf',
    clientId: 'cl-1',
    uploadedAt: '2026-03-15T19:45:00Z',
    status: 'sent-to-client',
    kind: 'tax-return',
  },
];

export class TestTaxdomeMcpServer implements TaxdomeMcpServer {
  readonly name = 'taxdome-test' as const;
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

  async listTaxDocuments(
    input: ListTaxDocumentsInput,
  ): Promise<McpResult<ListTaxDocumentsOutput>> {
    let docs = FIXTURE_DOCS;
    if (input.clientId) docs = docs.filter((d) => d.clientId === input.clientId);
    if (input.status) docs = docs.filter((d) => d.status === input.status);
    return mcpOk({ documents: docs });
  }

  async getTaxDocument(
    input: GetTaxDocumentInput,
  ): Promise<McpResult<GetTaxDocumentOutput>> {
    const doc = FIXTURE_DOCS.find((d) => d.id === input.documentId);
    if (!doc) return mcpError('NOT_FOUND', `No document ${input.documentId}`);
    return mcpOk({ document: doc });
  }

  async listEngagementLetters(
    input: ListEngagementLettersInput,
  ): Promise<McpResult<ListEngagementLettersOutput>> {
    let docs = FIXTURE_DOCS.filter((d) => d.kind === 'engagement-letter');
    if (input.clientId) docs = docs.filter((d) => d.clientId === input.clientId);
    return mcpOk({ engagementLetters: docs });
  }

  async listReceivedDocuments(
    input: ListReceivedDocumentsInput,
  ): Promise<McpResult<ListReceivedDocumentsOutput>> {
    let docs = FIXTURE_DOCS.filter((d) => d.kind === 'received-doc');
    if (input.clientId) docs = docs.filter((d) => d.clientId === input.clientId);
    if (input.uploadedSince) {
      docs = docs.filter((d) => d.uploadedAt >= input.uploadedSince!);
    }
    return mcpOk({ receivedDocuments: docs });
  }
}
