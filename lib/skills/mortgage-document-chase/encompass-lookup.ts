/**
 * lib/skills/mortgage-document-chase/encompass-lookup.ts
 *
 * Production wiring of the `LoanFileLookup` port to Encompass via the
 * workspace-scoped Encompass MCP server (`lib/integrations/encompass-mcp`).
 * This resolves the keystone audit finding for the mortgage family: the
 * `LoanFileLookup` PORT already existed (with `JsonLoanFileLookup` as the
 * second impl and "Encompass / LendingPad / Calyx MCPs will return when they
 * ship" noted in json-fetcher.ts) — this is the ADAPTER that was missing.
 *
 * Per `feedback_runner_portability.md`'s two-implementation rule, adding a
 * real impl behind the existing port is purely additive — skill.ts does not
 * change.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the ONLY place the mortgage
 * doc-chase skill touches Encompass, and it only ever speaks the
 * `EncompassMcpServer` interface — never raw Encompass JSON.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We read the loan
 * file + outstanding conditions; we never upload, clear, or advance.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — each fetch builds the server fresh, so a flag flip / token
 * rotation lands on the next fire.
 *
 * Honesty seam — when Encompass isn't configured (no credential, or a 401)
 * the lookup returns a NOT_CONFIGURED skill error with a calm "connect
 * Encompass" message rather than throwing or faking a loan file.
 *
 * Honest mapping gaps (documented, not faked):
 *   - Conditions whose category doesn't map to one of the skill's known doc
 *     categories (the 'other' bucket) are dropped — the skill's per-category
 *     cadence floor can't apply to them, and forcing a category would be a
 *     fabrication. They stay visible to the LO in Encompass.
 *   - A loan with no estimatedClosingDate gets an operator-merge placeholder
 *     so the borrower-facing urgency framing has a date the LO fills in.
 */

import { buildEncompassMcpServer } from '@/lib/integrations/encompass-mcp';
import type {
  EncompassLoanSummary,
  EncompassMcpServer,
  EncompassOutstandingDoc,
} from '@/lib/integrations/encompass-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  DocCategory,
  LoanFile,
  LoanFileLookup,
  OutstandingDoc,
} from './types';

/** Calm message surfaced when Encompass isn't usable yet for this workspace. */
export const ENCOMPASS_NOT_CONNECTED_MESSAGE =
  'Encompass is not yet connected for this workspace. Connect it from /integrations (and set ENCOMPASS_ADAPTER_LIVE=on) and Plaino will read the loan file on the next fire.';

export interface EncompassLoanFileLookupOptions {
  /** Override the MCP server — tests pass a TestEncompassMcpServer or stub.
   *  Production omits this and the lookup builds the flagged server. */
  mcp?: EncompassMcpServer;
}

export class EncompassLoanFileLookup implements LoanFileLookup {
  readonly name = 'encompass' as const;
  private readonly workspaceId: string;
  private readonly opts: EncompassLoanFileLookupOptions;

  constructor(args: { workspaceId: string } & EncompassLoanFileLookupOptions) {
    if (!args.workspaceId) throw new Error('EncompassLoanFileLookup: workspaceId is required');
    this.workspaceId = args.workspaceId;
    this.opts = { mcp: args.mcp };
  }

  /** Build the server fresh per call — cold-start safe (re-reads flag+cred). */
  private mcp(): EncompassMcpServer {
    return this.opts.mcp ?? buildEncompassMcpServer({ workspaceId: this.workspaceId });
  }

  async fetchFile(args: { workspaceId: string; loanId: string }): Promise<SkillResult<LoanFile>> {
    const guard = this.guard(args.workspaceId);
    if (guard) return guard;
    const res = await this.mcp().getLoanFile({ loanId: args.loanId });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    return skillOk(toLoanFile(res.value.loan));
  }

  async fetchOutstandingDocs(args: {
    workspaceId: string;
    loanId: string;
  }): Promise<SkillResult<OutstandingDoc[]>> {
    const guard = this.guard(args.workspaceId);
    if (guard) return guard;
    const res = await this.mcp().listOutstandingDocs({ loanId: args.loanId });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const docs: OutstandingDoc[] = [];
    for (const d of res.value.docs) {
      const mapped = toOutstandingDoc(d);
      if (mapped) docs.push(mapped);
    }
    return skillOk(docs);
  }

  private guard(workspaceId: string): SkillResult<never> | null {
    if (workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `EncompassLoanFileLookup bound to ${this.workspaceId}, asked for ${workspaceId}`,
      );
    }
    return null;
  }
}

function translateMcpError(code: string, message: string): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED'
  ) {
    return skillError('NOT_CONFIGURED', ENCOMPASS_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `Encompass: ${message}`, code);
}

export function toLoanFile(loan: EncompassLoanSummary): LoanFile {
  return {
    loanId: loan.loanId,
    borrower: {
      name: loan.borrower.name,
      email: loan.borrower.email ?? '{{operator: borrower email}}',
    },
    coBorrower: loan.coBorrower
      ? {
          name: loan.coBorrower.name,
          email: loan.coBorrower.email ?? '{{operator: co-borrower email}}',
        }
      : null,
    loanOfficer: {
      name: loan.loanOfficer.name,
      email: loan.loanOfficer.email ?? '{{operator: loan officer email}}',
    },
    propertyAddress: loan.propertyAddress,
    purpose: loan.purpose,
    estimatedClosingDate: loan.estimatedClosingDate ?? '{{operator: estimated closing date}}',
  };
}

/** Map one Encompass condition to the skill's `OutstandingDoc`. Returns null
 *  for the 'other' category (no skill cadence to apply) — never coerced into
 *  a category the skill would bucket. */
export function toOutstandingDoc(d: EncompassOutstandingDoc): OutstandingDoc | null {
  if (d.category === 'other') return null;
  return {
    id: d.id,
    label: d.label,
    category: d.category as DocCategory,
    requestedAt: new Date(d.requestedAt),
    borrowerAcknowledged: d.borrowerAcknowledged,
    conditionAttached: d.conditionAttached,
  };
}
