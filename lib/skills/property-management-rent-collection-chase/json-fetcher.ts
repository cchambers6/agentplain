/**
 * lib/skills/property-management-rent-collection-chase/json-fetcher.ts
 *
 * Second implementation of `RentRollLookup` — serves a pre-loaded JSON
 * payload (the same shape the AppFolio / Buildium / Propertyware /
 * Yardi Breeze MCPs will return when wired). Tests bind this;
 * production binds the MCP adapter.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { RentRollLookup, UnitDelinquency } from './types';

export interface JsonRentRollSeed {
  workspaceId: string;
  delinquentUnits: UnitDelinquency[];
}

export class JsonRentRollLookup implements RentRollLookup {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonRentRollSeed) {}

  async fetchDelinquentUnits(args: {
    workspaceId: string;
  }): Promise<SkillResult<UnitDelinquency[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonRentRollLookup seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.delinquentUnits);
  }
}
