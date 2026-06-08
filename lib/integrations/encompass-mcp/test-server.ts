/**
 * lib/integrations/encompass-mcp/test-server.ts
 *
 * Fixture-backed Encompass MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`)
 * and lets the mortgage doc-chase skill run end-to-end in dev with NO live
 * credentials. Deterministic, no network, no credential resolution.
 *
 * Default server when `ENCOMPASS_ADAPTER_LIVE` is not `on` (see index.ts).
 * The fixtures span a fresh / pending / late / stuck doc so the skill's
 * bucketing + batched-chase + LO-nudge paths are all exercised against
 * real-shaped data.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type EncompassLoanSummary,
  type EncompassMcpServer,
  type EncompassOutstandingDoc,
  type GetLoanFileInput,
  type GetLoanFileOutput,
  type ListOutstandingDocsInput,
  type ListOutstandingDocsOutput,
} from './types';

/** The single loan id the fixtures are keyed on. */
export const ENCOMPASS_FIXTURE_LOAN_ID = 'ENC-2026-008812';

/** As-of date the doc requestedAt values are authored against. */
const FIXTURE_AS_OF = new Date('2026-06-07T12:00:00Z');

function daysAgo(n: number): string {
  return new Date(FIXTURE_AS_OF.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

const FIXTURE_LOAN: EncompassLoanSummary = {
  loanId: ENCOMPASS_FIXTURE_LOAN_ID,
  borrower: { name: 'Avery Lin', email: 'avery.lin@example.com' },
  coBorrower: { name: 'Jordan Lin', email: 'jordan.lin@example.com' },
  loanOfficer: { name: 'Pat Romano', email: 'pat.romano@summit-lending.example' },
  propertyAddress: '19 Birchwood Ln, Decatur, GA 30030',
  purpose: 'purchase',
  estimatedClosingDate: '2026-06-25',
};

const FIXTURE_DOCS: EncompassOutstandingDoc[] = [
  {
    // Fresh (requested today).
    id: 'COND-1',
    label: 'Most recent 30 days of pay stubs',
    category: 'income',
    requestedAt: daysAgo(0),
    borrowerAcknowledged: false,
    conditionAttached: false,
  },
  {
    // Pending (2 days).
    id: 'COND-2',
    label: 'Two months of bank statements (all pages)',
    category: 'assets',
    requestedAt: daysAgo(2),
    borrowerAcknowledged: true,
    conditionAttached: false,
  },
  {
    // Late (6 days, default lateAfter=4).
    id: 'COND-3',
    label: 'Government-issued photo ID',
    category: 'identity',
    requestedAt: daysAgo(6),
    borrowerAcknowledged: false,
    conditionAttached: false,
  },
  {
    // Stuck (12 days, default stuckAfter=10) + condition-attached → LO nudge.
    id: 'COND-4',
    label: 'Letter of explanation for large deposit (PTD)',
    category: 'declarations',
    requestedAt: daysAgo(12),
    borrowerAcknowledged: true,
    conditionAttached: true,
  },
];

export class TestEncompassMcpServer implements EncompassMcpServer {
  readonly name = 'encompass-test' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async getLoanFile(input: GetLoanFileInput): Promise<McpResult<GetLoanFileOutput>> {
    if (input.loanId !== ENCOMPASS_FIXTURE_LOAN_ID) {
      return mcpError('NOT_FOUND', `Encompass fixture has no loan ${input.loanId}`);
    }
    return mcpOk({ loan: FIXTURE_LOAN });
  }

  async listOutstandingDocs(
    input: ListOutstandingDocsInput,
  ): Promise<McpResult<ListOutstandingDocsOutput>> {
    if (input.loanId !== ENCOMPASS_FIXTURE_LOAN_ID) {
      return mcpError('NOT_FOUND', `Encompass fixture has no loan ${input.loanId}`);
    }
    return mcpOk({ docs: FIXTURE_DOCS });
  }
}
