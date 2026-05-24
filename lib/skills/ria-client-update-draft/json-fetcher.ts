/**
 * lib/skills/ria-client-update-draft/json-fetcher.ts
 *
 * Second implementation of `PortfolioFetcher` — serves a pre-loaded JSON
 * payload (the same shape Orion / Black Diamond / Tamarac will return
 * when wired). Tests bind this; production binds the MCP.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  AdvisorNote,
  ClientHousehold,
  PortfolioFetcher,
  PortfolioSnapshot,
} from './types';

export interface JsonPortfolioSeed {
  workspaceId: string;
  household: ClientHousehold;
  snapshot: PortfolioSnapshot;
  notes: AdvisorNote[];
}

export class JsonPortfolioFetcher implements PortfolioFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonPortfolioSeed) {}

  async fetchHousehold(args: {
    workspaceId: string;
    householdId: string;
  }): Promise<SkillResult<ClientHousehold>> {
    const g = this.guard(args.workspaceId, args.householdId);
    if (g) return g;
    return skillOk(this.seed.household);
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    householdId: string;
    periodLabel: string;
  }): Promise<SkillResult<PortfolioSnapshot>> {
    const g = this.guard(args.workspaceId, args.householdId);
    if (g) return g;
    if (args.periodLabel !== this.seed.household.periodLabel) {
      return skillError(
        'INVALID_INPUT',
        `JsonPortfolioFetcher seeded for period ${this.seed.household.periodLabel}, asked for ${args.periodLabel}`,
      );
    }
    return skillOk(this.seed.snapshot);
  }

  async fetchAdvisorNotes(args: {
    workspaceId: string;
    householdId: string;
    periodLabel: string;
  }): Promise<SkillResult<AdvisorNote[]>> {
    const g = this.guard(args.workspaceId, args.householdId);
    if (g) return g;
    if (args.periodLabel !== this.seed.household.periodLabel) {
      return skillError(
        'INVALID_INPUT',
        `JsonPortfolioFetcher seeded for period ${this.seed.household.periodLabel}, asked for ${args.periodLabel}`,
      );
    }
    return skillOk(this.seed.notes);
  }

  private guard(workspaceId: string, householdId: string): SkillResult<never> | null {
    if (workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonPortfolioFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${workspaceId}`,
      );
    }
    if (householdId !== this.seed.household.householdId) {
      return skillError(
        'INVALID_INPUT',
        `JsonPortfolioFetcher seeded for household ${this.seed.household.householdId}, asked for ${householdId}`,
      );
    }
    return null;
  }
}
