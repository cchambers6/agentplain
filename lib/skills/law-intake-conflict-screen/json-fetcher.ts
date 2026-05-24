/**
 * lib/skills/law-intake-conflict-screen/json-fetcher.ts
 *
 * Second implementation of `LedgerFetcher` — serves a pre-loaded JSON
 * payload (the same shape the Clio / MyCase / PracticePanther MCPs will
 * return when they land). Tests bind this; production binds the MCP.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { LedgerEntry, LedgerFetcher } from './types';

export interface JsonLedgerSeed {
  workspaceId: string;
  ledger: LedgerEntry[];
}

export class JsonLedgerFetcher implements LedgerFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonLedgerSeed) {}

  async fetchLedger(args: {
    workspaceId: string;
  }): Promise<SkillResult<LedgerEntry[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLedgerFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.ledger);
  }
}
