/**
 * lib/skills/follow-up-chaser-general/json-fetcher.ts
 *
 * Second implementation of `FollowUpFetcher` — serves a JSON snapshot.
 * Tests bind this; production binds an adapter over Gmail / Microsoft
 * Graph (operator-outbound messages older than `lookbackDays` get
 * filtered upstream so this layer never sees them).
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { FollowUpFetcher, FollowUpSnapshot } from './types';

export interface JsonFollowUpSeed {
  workspaceId: string;
  snapshot: FollowUpSnapshot;
}

export class JsonFollowUpFetcher implements FollowUpFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonFollowUpSeed) {}

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookbackDays: number;
  }): Promise<SkillResult<FollowUpSnapshot>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonFollowUpFetcher seeded for workspace ${this.seed.workspaceId}, ` +
          `asked for ${args.workspaceId}`,
      );
    }
    if (args.lookbackDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookbackDays must be > 0; got ${args.lookbackDays}`,
      );
    }
    return skillOk(this.seed.snapshot);
  }
}
