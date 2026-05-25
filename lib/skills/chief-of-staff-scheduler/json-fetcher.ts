/**
 * lib/skills/chief-of-staff-scheduler/json-fetcher.ts
 *
 * Second implementation of `ChiefOfStaffFetcher` — serves a pre-loaded
 * JSON snapshot. Tests bind this; production binds an adapter over the
 * customer's calendar + email + to-do MCPs (Google Workspace, M365,
 * Asana / Linear / Notion).
 *
 * Per `feedback_runner_portability.md` two-implementation rule: this is
 * the second implementation. Together with the eventual production
 * adapter, the skill is protected against silent vendor lock — neither
 * side imports a vendor SDK.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ChiefOfStaffFetcher,
  ChiefOfStaffSnapshot,
} from './types';

export interface JsonChiefOfStaffSeed {
  workspaceId: string;
  snapshot: ChiefOfStaffSnapshot;
}

export class JsonChiefOfStaffFetcher implements ChiefOfStaffFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonChiefOfStaffSeed) {}

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookaheadDays: number;
  }): Promise<SkillResult<ChiefOfStaffSnapshot>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonChiefOfStaffFetcher seeded for workspace ${this.seed.workspaceId}, ` +
          `asked for ${args.workspaceId}`,
      );
    }
    if (args.lookaheadDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookaheadDays must be > 0; got ${args.lookaheadDays}`,
      );
    }
    return skillOk(this.seed.snapshot);
  }
}
