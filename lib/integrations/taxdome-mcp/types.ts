/**
 * lib/integrations/taxdome-mcp/types.ts
 *
 * TaxDome MCP server tool surface. One instance per `{workspaceId}` per
 * request (never reused across workspaces). Built on
 * `lib/integrations/mcp-core` — the vendor-neutral JSON-RPC envelope +
 * result shapes — so the wire format matches the shipped Gmail/Outlook/
 * QuickBooks servers.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface
 * covers the real CPA-firm value loop — list/read the client docs the
 * staff is chasing, list/read the firms's clients, list the engagement
 * letters that scope each engagement, surface what has actually been
 * received in the firm's document portal. The month-end-close-cpa skill
 * reads these to enrich its draft chase emails ("3 tax docs are pending
 * review in TaxDome").
 *
 * Per `project_no_outbound_architecture.md`: read-only by contract.
 * There is no `create_*` tool here — drafting documents back into
 * TaxDome is a future write surface that will land behind an approval
 * gate, the same way QuickBooks `recordPayment` does.
 *
 * Per `feedback_no_silent_vendor_lock.md`: TaxDome REST calls only
 * appear in `server.ts`. The skill layer (and any tool dispatch) sees
 * the `TaxdomeMcpServer` interface.
 *
 * Auth note: TaxDome is API-key based (per the TaxDome API docs, key
 * created under Account → API Keys, scoped to a "firm audience"). The
 * key is stored in `IntegrationCredential.accessTokenEncrypted` (AES-
 * 256-GCM at rest); `refreshTokenEncrypted` stays NULL; `expiresAt` is
 * pinned far in the future. The firm's portal subdomain lives in
 * `providerMetadata.portalSubdomain` so the server picks the right
 * base URL on every call.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type TaxdomeMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface TaxdomeClientSummary {
  id: string;
  /** Display name (firm or individual). */
  name: string;
  /** Primary contact email — null when TaxDome has none on file. */
  email: string | null;
  /** Whether the client is currently in an active engagement. */
  active: boolean;
}

export interface ListClientsInput {
  /** 1..100, default 25. */
  count?: number;
}

export interface ListClientsOutput {
  clients: TaxdomeClientSummary[];
}

export interface GetClientInput {
  clientId: string;
}

export interface GetClientOutput {
  client: TaxdomeClientSummary;
}

export interface TaxdomeDocumentSummary {
  id: string;
  /** Filename as uploaded. */
  filename: string;
  /** TaxDome client this doc belongs to. */
  clientId: string;
  /** When the doc landed in TaxDome (UTC). */
  uploadedAt: string;
  /** Workflow status — drives whether month-end-close treats this as
   *  pending review or done. */
  status: 'pending-review' | 'reviewed' | 'sent-to-client' | 'archived';
  /** Document classification — `tax-return`, `engagement-letter`,
   *  `received-doc` (client uploaded), `other`. The skill bucketing
   *  reads this to map docs to checklist items. */
  kind: 'tax-return' | 'engagement-letter' | 'received-doc' | 'other';
}

export interface ListTaxDocumentsInput {
  /** Optional client filter. */
  clientId?: string;
  /** Optional status filter. */
  status?: TaxdomeDocumentSummary['status'];
  /** 1..100, default 25. */
  count?: number;
}

export interface ListTaxDocumentsOutput {
  documents: TaxdomeDocumentSummary[];
}

export interface GetTaxDocumentInput {
  documentId: string;
}

export interface GetTaxDocumentOutput {
  document: TaxdomeDocumentSummary;
}

export interface ListEngagementLettersInput {
  /** Optional client filter. */
  clientId?: string;
  /** 1..100, default 25. */
  count?: number;
}

export interface ListEngagementLettersOutput {
  /** TaxDome treats engagement letters as a document subtype — same
   *  shape as TaxdomeDocumentSummary; we narrow `kind` to
   *  `engagement-letter`. */
  engagementLetters: TaxdomeDocumentSummary[];
}

export interface ListReceivedDocumentsInput {
  /** Optional client filter. */
  clientId?: string;
  /** Filter to docs uploaded on/after this ISO date (YYYY-MM-DD). */
  uploadedSince?: string;
  /** 1..100, default 25. */
  count?: number;
}

export interface ListReceivedDocumentsOutput {
  /** Docs the client uploaded (kind === 'received-doc') that the firm
   *  has not yet reviewed. Powers month-end-close-cpa's "5 client docs
   *  pending review in TaxDome" enrichment. */
  receivedDocuments: TaxdomeDocumentSummary[];
}

// ── Interface every implementation honors ──────────────────────────────────

export interface TaxdomeMcpServer extends McpServerBase {
  listClients(input: ListClientsInput): Promise<TaxdomeMcpResult<ListClientsOutput>>;
  getClient(input: GetClientInput): Promise<TaxdomeMcpResult<GetClientOutput>>;
  listTaxDocuments(input: ListTaxDocumentsInput): Promise<TaxdomeMcpResult<ListTaxDocumentsOutput>>;
  getTaxDocument(input: GetTaxDocumentInput): Promise<TaxdomeMcpResult<GetTaxDocumentOutput>>;
  listEngagementLetters(
    input: ListEngagementLettersInput,
  ): Promise<TaxdomeMcpResult<ListEngagementLettersOutput>>;
  listReceivedDocuments(
    input: ListReceivedDocumentsInput,
  ): Promise<TaxdomeMcpResult<ListReceivedDocumentsOutput>>;
}

export const TAXDOME_NAMESPACE = 'taxdome';
