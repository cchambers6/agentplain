/**
 * lib/skills/inbox-triage-general/json-fetcher.ts
 *
 * Second implementation of `TriageFetcher` — serves a pre-loaded JSON
 * snapshot. Tests bind this; production binds an adapter over the
 * customer's mailbox MCP (Gmail / Microsoft Graph).
 *
 * Per `feedback_runner_portability.md` two-implementation rule.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { TriageFetcher, TriageSnapshot } from './types';

export interface JsonTriageSeed {
  workspaceId: string;
  snapshot: TriageSnapshot;
}

export class JsonTriageFetcher implements TriageFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonTriageSeed) {}

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
  }): Promise<SkillResult<TriageSnapshot>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonTriageFetcher seeded for workspace ${this.seed.workspaceId}, ` +
          `asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.snapshot);
  }
}
