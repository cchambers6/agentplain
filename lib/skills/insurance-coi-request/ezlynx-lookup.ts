/**
 * lib/skills/insurance-coi-request/ezlynx-lookup.ts
 *
 * Production wiring of the `PolicyLookup` port to EZLynx via the
 * workspace-scoped EZLynx MCP server (`lib/integrations/ezlynx-mcp`). This
 * resolves the keystone audit finding for the insurance family: the
 * `PolicyLookup` PORT already existed (with `JsonPolicyLookup` as the second
 * impl and "EZLynx / Applied Epic / AMS360 / HawkSoft MCPs will populate
 * when wired" noted in json-fetcher.ts) — this is the ADAPTER that was
 * missing.
 *
 * Per `feedback_runner_portability.md`'s two-implementation rule, adding a
 * real impl behind the existing port is purely additive — skill.ts does not
 * change.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the ONLY place the COI skill
 * touches EZLynx, and it only ever speaks the `EzlynxMcpServer` interface —
 * never raw EZLynx JSON.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We read policies on
 * file; we never bind, quote, or issue.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — each fetch builds the server fresh (which re-reads the flag +
 * re-resolves the credential), so a flag flip / token rotation lands on the
 * next fire.
 *
 * Honesty seam — when EZLynx isn't configured (no credential, or a 401) the
 * lookup returns a NOT_CONFIGURED skill error with a calm "connect EZLynx"
 * message rather than throwing or faking policies on file.
 *
 * Honest mapping gap (documented, not faked): EZLynx lines that don't map to
 * one of the skill's known coverage lines (the 'other' bucket) are dropped
 * from the returned set — they can't satisfy a requested certificate line,
 * and surfacing them as a coverage match would be a fabrication. The skill
 * then treats any requested line with no in-force policy as a coverage gap
 * and routes to operator review.
 */

import { buildEzlynxMcpServer } from '@/lib/integrations/ezlynx-mcp';
import type { EzlynxMcpServer, EzlynxPolicy } from '@/lib/integrations/ezlynx-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type { CoverageLine, PolicyLookup, PolicyOnFile } from './types';

/** Calm message surfaced when EZLynx isn't usable yet for this workspace. */
export const EZLYNX_NOT_CONNECTED_MESSAGE =
  'EZLynx is not yet connected for this workspace. Connect it from /integrations (and set EZLYNX_ADAPTER_LIVE=on) and Plaino will read policies on file on the next fire.';

export interface EzlynxPolicyLookupOptions {
  /** Override the MCP server — tests pass a TestEzlynxMcpServer or stub.
   *  Production omits this and the lookup builds the flagged server. */
  mcp?: EzlynxMcpServer;
}

export class EzlynxPolicyLookup implements PolicyLookup {
  readonly name = 'ezlynx' as const;
  private readonly workspaceId: string;
  private readonly opts: EzlynxPolicyLookupOptions;

  constructor(args: { workspaceId: string } & EzlynxPolicyLookupOptions) {
    if (!args.workspaceId) throw new Error('EzlynxPolicyLookup: workspaceId is required');
    this.workspaceId = args.workspaceId;
    this.opts = { mcp: args.mcp };
  }

  /** Build the server fresh per call — cold-start safe (re-reads flag+cred). */
  private mcp(): EzlynxMcpServer {
    return this.opts.mcp ?? buildEzlynxMcpServer({ workspaceId: this.workspaceId });
  }

  async fetchPoliciesForInsured(args: {
    workspaceId: string;
    insuredLegalName: string;
  }): Promise<SkillResult<PolicyOnFile[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `EzlynxPolicyLookup bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const res = await this.mcp().listPoliciesForInsured({
      insuredLegalName: args.insuredLegalName,
    });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const policies: PolicyOnFile[] = [];
    for (const p of res.value.policies) {
      const mapped = toPolicyOnFile(p);
      if (mapped) policies.push(mapped);
    }
    return skillOk(policies);
  }
}

function translateMcpError(code: string, message: string): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED'
  ) {
    return skillError('NOT_CONFIGURED', EZLYNX_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `EZLynx: ${message}`, code);
}

/** Map one EZLynx policy to the skill's `PolicyOnFile`. Returns null for
 *  the 'other' line bucket (no skill coverage line to match) — never faked
 *  into a coverage the skill could match against. */
export function toPolicyOnFile(p: EzlynxPolicy): PolicyOnFile | null {
  if (p.line === 'other') return null;
  return {
    policyNumber: p.policyNumber,
    carrierName: p.carrierName,
    line: p.line as CoverageLine,
    expirationDate: p.expirationDate,
    inForce: p.inForce,
  };
}
