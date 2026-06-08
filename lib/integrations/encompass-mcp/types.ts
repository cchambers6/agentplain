/**
 * lib/integrations/encompass-mcp/types.ts
 *
 * Provider-neutral types for the Encompass MCP server. Encompass (ICE
 * Mortgage Technology) is a loan-origination system (LOS); this server is
 * the FIRST real adapter behind the `LoanFileLookup` port consumed by
 * `lib/skills/mortgage-document-chase` (until now that port shipped ONLY its
 * `JsonLoanFileLookup` fixture — the keystone "port exists, adapter does
 * not" finding).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the rest of the codebase speaks
 * THESE shapes; raw Encompass JSON never leaks past `server.ts`.
 *
 * Encompass Developer Connect reference (OAuth2 REST):
 *   base   https://api.elliemae.com/encompass/v3
 *   auth   OAuth2 Bearer; lender enrolls via ICE Developer Connect for a
 *          client id + secret. Per-instance refresh token persisted on the
 *          credential; Encompass instance id on providerMetadata.instanceId.
 *   loan   GET /loans/{id}                              → borrower + LO + dates
 *   conds  GET /loans/{id}/conditions/underwriting      → outstanding docs
 *   For the doc-chase use case we read one loan file's borrower / co-borrower
 *   / loan-officer contacts + the outstanding underwriting conditions.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

export type EncompassDocCategory =
  | 'income'
  | 'assets'
  | 'identity'
  | 'property'
  | 'declarations'
  | 'credit-letter'
  | 'other';

export interface EncompassContact {
  name: string;
  email: string | null;
}

/** A normalized Encompass loan file header. */
export interface EncompassLoanSummary {
  loanId: string;
  borrower: EncompassContact;
  coBorrower: EncompassContact | null;
  loanOfficer: EncompassContact;
  propertyAddress: string;
  /** Loan purpose, normalized. */
  purpose: 'purchase' | 'refinance' | 'cash-out-refi' | 'heloc';
  /** ISO date of the LOS-recorded estimated closing, when present. */
  estimatedClosingDate: string | null;
}

/** One outstanding underwriting condition / document item. */
export interface EncompassOutstandingDoc {
  id: string;
  label: string;
  category: EncompassDocCategory;
  /** ISO datetime the doc was first requested from the borrower. */
  requestedAt: string;
  borrowerAcknowledged: boolean;
  /** True when the item clears an underwriting condition (raises urgency). */
  conditionAttached: boolean;
}

export interface GetLoanFileInput {
  loanId: string;
}

export interface GetLoanFileOutput {
  loan: EncompassLoanSummary;
}

export interface ListOutstandingDocsInput {
  loanId: string;
}

export interface ListOutstandingDocsOutput {
  docs: EncompassOutstandingDoc[];
}

/**
 * The ONLY surface the rest of the app uses to read Encompass. Both the live
 * REST server and the fixture server implement this — the two-implementation
 * rule (`feedback_runner_portability.md`).
 */
export interface EncompassMcpServer {
  readonly name: string;
  readonly workspaceId: string;
  getLoanFile(input: GetLoanFileInput): Promise<McpResult<GetLoanFileOutput>>;
  listOutstandingDocs(
    input: ListOutstandingDocsInput,
  ): Promise<McpResult<ListOutstandingDocsOutput>>;
}

export const ENCOMPASS_API_BASE = 'https://api.elliemae.com/encompass/v3';
