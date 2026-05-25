/**
 * lib/skills/mortgage-document-chase/json-fetcher.ts
 *
 * Second implementation of `LoanFileLookup` — serves a pre-loaded JSON
 * payload (the same shape the Encompass / LendingPad / Calyx MCPs will
 * return when they ship). Tests bind this; production binds the MCP.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  LoanFile,
  LoanFileLookup,
  OutstandingDoc,
} from './types';

export interface JsonLoanFileSeed {
  workspaceId: string;
  loanId: string;
  file: LoanFile;
  outstandingDocs: OutstandingDoc[];
}

export class JsonLoanFileLookup implements LoanFileLookup {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonLoanFileSeed) {}

  async fetchFile(args: { workspaceId: string; loanId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<LoanFile>;
    return skillOk(this.seed.file);
  }

  async fetchOutstandingDocs(args: { workspaceId: string; loanId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<OutstandingDoc[]>;
    return skillOk(this.seed.outstandingDocs);
  }

  private guard(args: { workspaceId: string; loanId: string }): SkillResult<never> | null {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLoanFileLookup seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (args.loanId !== this.seed.loanId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLoanFileLookup seeded for loan ${this.seed.loanId}, asked for ${args.loanId}`,
      );
    }
    return null;
  }
}
