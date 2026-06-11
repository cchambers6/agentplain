/**
 * lib/skills/home-services-estimate-followup/json-fetcher.ts
 *
 * Second implementation of `EstimateLookup` — serves a pre-loaded JSON
 * payload (the same shape the AccuLynx / JobNimbus / ServiceTitan /
 * Housecall Pro MCPs will return when wired). Tests bind this;
 * production binds the MCP adapter.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { EstimateLookup, EstimateRecord } from './types';

export interface JsonEstimateSeed {
  workspaceId: string;
  /** `amountUsd` is optional on seed records so fixtures pre-dating the
   *  field compile without changes.  The fetcher back-fills 0 when absent. */
  estimates: Array<Omit<EstimateRecord, 'amountUsd'> & { amountUsd?: number }>;
}

export class JsonEstimateLookup implements EstimateLookup {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonEstimateSeed) {}

  async fetchOpenEstimates(args: {
    workspaceId: string;
  }): Promise<SkillResult<EstimateRecord[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonEstimateLookup seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    // Back-fill amountUsd = 0 for seeds that pre-date the field, so test
    // fixtures written before amountUsd existed continue to compile.
    const records: EstimateRecord[] = this.seed.estimates.map((e) => ({
      ...e,
      amountUsd: e.amountUsd ?? 0,
    }));
    return skillOk(records);
  }
}
