/**
 * lib/skills/recruiting-candidate-status-update/json-fetcher.ts
 *
 * Second implementation of `RolePipelineLookup` — serves a pre-loaded
 * JSON payload (the same shape the Greenhouse / Lever / Workable /
 * Bullhorn MCPs will return when wired). Tests bind this; production
 * binds the MCP adapter.
 *
 * Per `feedback_runner_portability.md` rule 3 — two implementations of
 * the port keep the interface honest.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  CandidateRecord,
  RoleContext,
  RolePipelineLookup,
} from './types';

export interface JsonPipelineSeed {
  workspaceId: string;
  roleId: string;
  role: RoleContext;
  candidates: CandidateRecord[];
}

export class JsonRolePipelineLookup implements RolePipelineLookup {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonPipelineSeed) {}

  async fetchRole(args: { workspaceId: string; roleId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<RoleContext>;
    return skillOk(this.seed.role);
  }

  async fetchCandidates(args: { workspaceId: string; roleId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<CandidateRecord[]>;
    return skillOk(this.seed.candidates);
  }

  private guard(args: { workspaceId: string; roleId: string }): SkillResult<never> | null {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonRolePipelineLookup seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (args.roleId !== this.seed.roleId) {
      return skillError(
        'INVALID_INPUT',
        `JsonRolePipelineLookup seeded for role ${this.seed.roleId}, asked for ${args.roleId}`,
      );
    }
    return null;
  }
}
