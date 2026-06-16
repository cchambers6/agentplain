/**
 * lib/integrations/docusign-mcp/types.ts
 *
 * DocuSign MCP server tool surface. One instance per `{workspaceId}` per
 * request (never reused across workspaces). Built on `lib/integrations/mcp-core`
 * — the vendor-neutral JSON-RPC envelope + result shapes — so the wire format
 * matches the shipped Gmail/Outlook servers.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: the bar is a real
 * read+act surface — list/track envelopes, send for signature, pull the
 * completed PDF — not just OAuth plumbing.
 *
 * Per `project_no_outbound_architecture.md`: `send_envelope` and
 * `void_envelope` act through the CUSTOMER's own DocuSign account via their
 * token (the customer's system executing), and both are explicit, single
 * actions a person or approval step invokes — never auto-fired by a
 * background sweep.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type DocuSignMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface EnvelopeSummary {
  envelopeId: string;
  status: string;
  emailSubject: string | null;
  sentDateTime: string | null;
  completedDateTime: string | null;
  /** ISO timestamp the status last changed. */
  statusChangedDateTime: string | null;
}

export interface ListEnvelopesInput {
  /** ISO date; envelopes changed on/after this are returned. Defaults to 30 days ago. */
  fromDate?: string;
  /** Optional status filter, e.g. `sent`, `completed`, `declined`, `voided`. */
  status?: string;
  /** 1..100, default 25. */
  count?: number;
}

export interface ListEnvelopesOutput {
  envelopes: EnvelopeSummary[];
  resultSetSize: number | null;
}

export interface GetEnvelopeStatusInput {
  envelopeId: string;
}

export interface GetEnvelopeStatusOutput {
  envelope: EnvelopeSummary;
}

export interface RecipientStatus {
  recipientId: string;
  name: string;
  email: string;
  /** `created` | `sent` | `delivered` | `completed` | `declined` | `autoresponded` */
  status: string;
  routingOrder: string | null;
  signedDateTime: string | null;
  deliveredDateTime: string | null;
}

export interface GetRecipientStatusInput {
  envelopeId: string;
}

export interface GetRecipientStatusOutput {
  recipients: RecipientStatus[];
}

/** A signer to place on an envelope (raw-document path). */
export interface SignerInput {
  name: string;
  email: string;
  /** Defaults to "1". */
  routingOrder?: string;
}

/** A template role binding (template path). */
export interface TemplateRoleInput {
  roleName: string;
  name: string;
  email: string;
}

/** A document to attach (raw-document path). `documentBase64` is the file bytes. */
export interface DocumentInput {
  name: string;
  /** File extension without the dot, e.g. `pdf`, `docx`. */
  fileExtension: string;
  documentBase64: string;
}

export interface SendEnvelopeInput {
  emailSubject: string;
  /** Template path: send from a stored template + role bindings. */
  templateId?: string;
  templateRoles?: TemplateRoleInput[];
  /** Raw-document path: attach documents + place signers. */
  documents?: DocumentInput[];
  signers?: SignerInput[];
  /** `sent` (default — delivers immediately) or `created` (saved as draft). */
  status?: 'sent' | 'created';
  /**
   * Approval token (a `WorkApprovalQueueItem.id`) the operator approved for
   * THIS send. Carried forward on the second attempt once approved. The
   * approval gate (`with-approval.ts`) rejects the call with APPROVAL_REQUIRED
   * when this is absent, mismatched, un-approved, or expired — DocuSign is
   * never contacted in that case.
   */
  pendingApprovalId?: string;
}

export interface SendEnvelopeOutput {
  envelopeId: string;
  status: string;
  statusDateTime: string | null;
}

export interface DownloadCompletedDocumentInput {
  envelopeId: string;
  /** Document id, or `combined` (default) for the merged signed PDF. */
  documentId?: string;
}

export interface DownloadCompletedDocumentOutput {
  envelopeId: string;
  documentId: string;
  contentType: string;
  /** Base64-encoded document bytes. */
  contentBase64: string;
  sizeBytes: number;
}

export interface VoidEnvelopeInput {
  envelopeId: string;
  voidedReason: string;
  /** Approval token for THIS void — see `SendEnvelopeInput.pendingApprovalId`. */
  pendingApprovalId?: string;
}

export interface VoidEnvelopeOutput {
  envelopeId: string;
  status: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface DocuSignMcpServer extends McpServerBase {
  listEnvelopes(input: ListEnvelopesInput): Promise<DocuSignMcpResult<ListEnvelopesOutput>>;
  getEnvelopeStatus(input: GetEnvelopeStatusInput): Promise<DocuSignMcpResult<GetEnvelopeStatusOutput>>;
  getRecipientStatus(input: GetRecipientStatusInput): Promise<DocuSignMcpResult<GetRecipientStatusOutput>>;
  sendEnvelope(input: SendEnvelopeInput): Promise<DocuSignMcpResult<SendEnvelopeOutput>>;
  downloadCompletedDocument(
    input: DownloadCompletedDocumentInput,
  ): Promise<DocuSignMcpResult<DownloadCompletedDocumentOutput>>;
  voidEnvelope(input: VoidEnvelopeInput): Promise<DocuSignMcpResult<VoidEnvelopeOutput>>;
}

export const DOCUSIGN_NAMESPACE = 'docusign';
