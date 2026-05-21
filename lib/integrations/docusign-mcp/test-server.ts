/**
 * lib/integrations/docusign-mcp/test-server.ts
 *
 * Fixture-backed DocuSign MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke test
 * + by `INTEGRATIONS_PROVIDER=test` previews.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type DocuSignMcpServer,
  type DownloadCompletedDocumentInput,
  type DownloadCompletedDocumentOutput,
  type EnvelopeSummary,
  type GetEnvelopeStatusInput,
  type GetEnvelopeStatusOutput,
  type GetRecipientStatusInput,
  type GetRecipientStatusOutput,
  type ListEnvelopesInput,
  type ListEnvelopesOutput,
  type SendEnvelopeInput,
  type SendEnvelopeOutput,
  type VoidEnvelopeInput,
  type VoidEnvelopeOutput,
} from './types';

const FIXTURE_ENVELOPES: EnvelopeSummary[] = [
  {
    envelopeId: 'env-1001',
    status: 'completed',
    emailSubject: 'Listing Agreement — 123 Peachtree',
    sentDateTime: '2026-05-10T14:00:00Z',
    completedDateTime: '2026-05-11T09:30:00Z',
    statusChangedDateTime: '2026-05-11T09:30:00Z',
  },
  {
    envelopeId: 'env-1002',
    status: 'sent',
    emailSubject: 'Purchase Contract — 456 Oak',
    sentDateTime: '2026-05-18T16:00:00Z',
    completedDateTime: null,
    statusChangedDateTime: '2026-05-18T16:00:00Z',
  },
];

export class TestDocuSignMcpServer implements DocuSignMcpServer {
  readonly name = 'docusign-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listEnvelopes(input: ListEnvelopesInput): Promise<McpResult<ListEnvelopesOutput>> {
    const envelopes = input.status
      ? FIXTURE_ENVELOPES.filter((e) => e.status === input.status)
      : FIXTURE_ENVELOPES;
    return mcpOk({ envelopes, resultSetSize: envelopes.length });
  }

  async getEnvelopeStatus(input: GetEnvelopeStatusInput): Promise<McpResult<GetEnvelopeStatusOutput>> {
    const envelope = FIXTURE_ENVELOPES.find((e) => e.envelopeId === input.envelopeId);
    if (!envelope) return mcpError('NOT_FOUND', `No envelope ${input.envelopeId}`);
    return mcpOk({ envelope });
  }

  async getRecipientStatus(input: GetRecipientStatusInput): Promise<McpResult<GetRecipientStatusOutput>> {
    if (!FIXTURE_ENVELOPES.some((e) => e.envelopeId === input.envelopeId)) {
      return mcpError('NOT_FOUND', `No envelope ${input.envelopeId}`);
    }
    return mcpOk({
      recipients: [
        {
          recipientId: '1',
          name: 'Dana Seller',
          email: 'dana@example.com',
          status: 'completed',
          routingOrder: '1',
          signedDateTime: '2026-05-11T09:30:00Z',
          deliveredDateTime: '2026-05-10T14:05:00Z',
        },
      ],
    });
  }

  async sendEnvelope(input: SendEnvelopeInput): Promise<McpResult<SendEnvelopeOutput>> {
    const usingTemplate = !!input.templateId;
    const usingDocuments = !!(input.documents && input.documents.length > 0);
    if (usingTemplate === usingDocuments) {
      return mcpError('INVALID_ARGUMENT', 'sendEnvelope requires EITHER templateId OR documents.');
    }
    return mcpOk({
      envelopeId: 'env-new-2001',
      status: input.status ?? 'sent',
      statusDateTime: '2026-05-20T12:00:00Z',
    });
  }

  async downloadCompletedDocument(
    input: DownloadCompletedDocumentInput,
  ): Promise<McpResult<DownloadCompletedDocumentOutput>> {
    if (!FIXTURE_ENVELOPES.some((e) => e.envelopeId === input.envelopeId)) {
      return mcpError('NOT_FOUND', `No envelope ${input.envelopeId}`);
    }
    const bytes = Buffer.from('%PDF-1.4 fixture', 'utf8');
    return mcpOk({
      envelopeId: input.envelopeId,
      documentId: input.documentId ?? 'combined',
      contentType: 'application/pdf',
      contentBase64: bytes.toString('base64'),
      sizeBytes: bytes.byteLength,
    });
  }

  async voidEnvelope(input: VoidEnvelopeInput): Promise<McpResult<VoidEnvelopeOutput>> {
    const envelope = FIXTURE_ENVELOPES.find((e) => e.envelopeId === input.envelopeId);
    if (!envelope) return mcpError('NOT_FOUND', `No envelope ${input.envelopeId}`);
    if (envelope.status === 'completed') {
      return mcpError('INVALID_ARGUMENT', 'Cannot void a completed envelope');
    }
    return mcpOk({ envelopeId: input.envelopeId, status: 'voided' });
  }
}
