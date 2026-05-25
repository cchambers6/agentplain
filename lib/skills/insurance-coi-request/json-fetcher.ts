/**
 * lib/skills/insurance-coi-request/json-fetcher.ts
 *
 * Second implementation of `PolicyLookup` — serves a pre-loaded JSON
 * payload (the same shape the EZLynx / Applied Epic / AMS360 / HawkSoft
 * MCPs will populate when wired). Tests bind this; production binds the
 * MCP adapter.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { PolicyLookup, PolicyOnFile } from './types';

export interface JsonPolicySeed {
  workspaceId: string;
  /** Insured-keyed policy ledger. Lookup matches case-insensitively on
   *  the insured's `legalName` so callers don't have to pre-uppercase. */
  policiesByInsured: Record<string, PolicyOnFile[]>;
}

export class JsonPolicyLookup implements PolicyLookup {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonPolicySeed) {}

  async fetchPoliciesForInsured(args: {
    workspaceId: string;
    insuredLegalName: string;
  }): Promise<SkillResult<PolicyOnFile[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonPolicyLookup seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const key = normalizeInsuredKey(args.insuredLegalName);
    for (const [seedKey, policies] of Object.entries(this.seed.policiesByInsured)) {
      if (normalizeInsuredKey(seedKey) === key) {
        return skillOk(policies);
      }
    }
    // Unknown insured → empty list (skill treats as "not on file").
    return skillOk([]);
  }
}

function normalizeInsuredKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
