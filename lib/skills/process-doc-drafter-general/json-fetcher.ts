/**
 * lib/skills/process-doc-drafter-general/json-fetcher.ts
 *
 * Second implementation of `ProcessDocFetcher`. Tests bind this;
 * production binds an adapter over the workspace's activity log + the
 * customer's existing doc-system (Notion / Confluence / Drive) to read
 * existing SOP titles for dedupe.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { ProcessDocFetcher, ProcessDocSnapshot } from './types';

export interface JsonProcessDocSeed {
  workspaceId: string;
  snapshot: ProcessDocSnapshot;
}

export class JsonProcessDocFetcher implements ProcessDocFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonProcessDocSeed) {}

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookbackDays: number;
  }): Promise<SkillResult<ProcessDocSnapshot>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonProcessDocFetcher seeded for workspace ${this.seed.workspaceId}, ` +
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
