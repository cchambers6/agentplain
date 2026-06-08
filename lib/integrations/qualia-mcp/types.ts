/**
 * lib/integrations/qualia-mcp/types.ts
 *
 * Provider-neutral types for the Qualia MCP server. Qualia is a title /
 * escrow closing-production platform; this server is the FIRST real adapter
 * behind the `ClosingFileFetcher` port consumed by
 * `lib/skills/title-escrow-closing-doc-chase` (until now that port shipped
 * ONLY its `JsonClosingFileFetcher` fixture — the keystone
 * "port exists, adapter does not" finding).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the rest of the codebase speaks
 * THESE shapes; raw Qualia JSON never leaks past `server.ts`.
 *
 * Qualia API reference (read-write GraphQL/JSON, HTTP Basic auth — we use
 * the read surface only; `project_no_outbound_architecture.md`):
 *   base   https://{org}.qualia.io/api/v1   (org-scoped host)
 *   auth   HTTP Basic — username = org id, password = API key
 *   orders GET /orders/{id}                 → order header + parties
 *   docs   GET /orders/{id}/documents       → document checklist + receipts
 *   For the closing-doc-chase use case we read one order's parties, its
 *   document checklist, and which documents have been received.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

/** Closing party role, normalized from Qualia's contact-role taxonomy. */
export type QualiaPartyRole =
  | 'buyer'
  | 'seller'
  | 'lender'
  | 'buyer-attorney'
  | 'seller-attorney'
  | 'underwriter'
  | 'realtor';

export interface QualiaParty {
  name: string;
  email: string | null;
  role: QualiaPartyRole;
}

/** A normalized Qualia closing order header. */
export interface QualiaOrderSummary {
  /** Qualia order id, stringified. */
  id: string;
  /** Free-text property address. */
  propertyAddress: string;
  /** ISO date of the scheduled closing, when Qualia carries it. */
  scheduledClosingDate: string | null;
  /** The escrow officer / closing coordinator on the order, if present. */
  closingCoordinator: QualiaParty | null;
  /** All counterparties on the order. */
  parties: QualiaParty[];
}

/** One document-checklist item on the order. */
export interface QualiaChecklistItem {
  id: string;
  label: string;
  responsibleParty: QualiaPartyRole;
  /** ISO date the doc is internally targeted, when Qualia carries it. */
  dueDate: string | null;
  required: boolean;
}

/** A document Qualia has on file for the order. */
export interface QualiaReceivedDoc {
  id: string;
  /** Checklist item this receipt satisfies, when Qualia links it. */
  satisfiesChecklistItemId: string | null;
  /** ISO datetime the document was received. */
  receivedAt: string;
  filename: string;
}

export interface GetClosingOrderInput {
  orderId: string;
}

export interface GetClosingOrderOutput {
  order: QualiaOrderSummary;
  checklist: QualiaChecklistItem[];
  receivedDocs: QualiaReceivedDoc[];
}

/**
 * The ONLY surface the rest of the app uses to read Qualia. Both the live
 * REST server and the fixture server implement this — the two-implementation
 * rule (`feedback_runner_portability.md`).
 */
export interface QualiaMcpServer {
  readonly name: string;
  readonly workspaceId: string;
  getClosingOrder(
    input: GetClosingOrderInput,
  ): Promise<McpResult<GetClosingOrderOutput>>;
}
