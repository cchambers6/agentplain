/**
 * lib/skills/month-end-close-cpa/json-fetcher.ts
 *
 * Second implementation of `CloseFetcher` — accepts a pre-loaded JSON
 * payload (the same shape the QuickBooks MCP will return when built) and
 * serves it without any vendor SDK.
 *
 * Per `feedback_runner_portability.md` rule 3: this is the second
 * implementation of `CloseFetcher` so the interface is real (not
 * code-with-extra-steps). The QuickBooks-backed impl will be the third.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ChecklistItem,
  ClientEngagement,
  CloseFetcher,
  ReceivedDoc,
} from './types';

export interface JsonCloseFetcherSeed {
  workspaceId: string;
  clientId: string;
  periodMonth: string;
  engagement: ClientEngagement;
  checklist: ChecklistItem[];
  receivedDocs: ReceivedDoc[];
}

export class JsonCloseFetcher implements CloseFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonCloseFetcherSeed) {}

  async fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>> {
    const guard = this.guard(args);
    if (guard) return guard;
    return skillOk(this.seed.engagement);
  }

  async fetchChecklist(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ChecklistItem[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    return skillOk(this.seed.checklist);
  }

  async fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    return skillOk(this.seed.receivedDocs);
  }

  private guard(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): SkillResult<never> | null {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonCloseFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (args.clientId !== this.seed.clientId) {
      return skillError(
        'INVALID_INPUT',
        `JsonCloseFetcher seeded for client ${this.seed.clientId}, asked for ${args.clientId}`,
      );
    }
    if (args.periodMonth !== this.seed.periodMonth) {
      return skillError(
        'INVALID_INPUT',
        `JsonCloseFetcher seeded for period ${this.seed.periodMonth}, asked for ${args.periodMonth}`,
      );
    }
    return null;
  }
}
