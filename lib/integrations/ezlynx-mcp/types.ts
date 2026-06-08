/**
 * lib/integrations/ezlynx-mcp/types.ts
 *
 * Provider-neutral types for the EZLynx MCP server. EZLynx is an insurance
 * agency-management system (AMS); this server is the FIRST real adapter
 * behind the `PolicyLookup` port consumed by
 * `lib/skills/insurance-coi-request` (until now that port shipped ONLY its
 * `JsonPolicyLookup` fixture — the keystone "port exists, adapter does not"
 * finding).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the rest of the codebase speaks
 * THESE shapes; raw EZLynx JSON never leaks past `server.ts`.
 *
 * EZLynx API reference (OAuth2; REST Connect Web Services superseding the
 * legacy SOAP rater):
 *   base   https://api.ezlynx.com
 *   auth   OAuth2 Bearer; agency enrolls in the EZLynx partner program for a
 *          client id + secret. Per-agency refresh token persisted on the
 *          credential.
 *   For the COI use case we read an insured account's policies on file (one
 *   policy row per coverage line, with carrier, policy number, term-end, and
 *   in-force status).
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

/** Coverage line, normalized from EZLynx's line-of-business taxonomy. */
export type EzlynxCoverageLine =
  | 'general-liability'
  | 'auto-liability'
  | 'workers-comp'
  | 'umbrella'
  | 'professional-liability'
  | 'property'
  | 'inland-marine'
  | 'other';

/** A normalized EZLynx policy row. */
export interface EzlynxPolicy {
  policyNumber: string;
  carrierName: string;
  line: EzlynxCoverageLine;
  /** ISO date the policy term ends. */
  expirationDate: string;
  /** Whether the policy is currently in force (not cancelled / non-renewed). */
  inForce: boolean;
}

export interface ListPoliciesInput {
  /** Insured legal name as it appears on policy declarations. */
  insuredLegalName: string;
}

export interface ListPoliciesOutput {
  policies: EzlynxPolicy[];
}

/**
 * The ONLY surface the rest of the app uses to read EZLynx. Both the live
 * REST server and the fixture server implement this — the two-implementation
 * rule (`feedback_runner_portability.md`).
 */
export interface EzlynxMcpServer {
  readonly name: string;
  readonly workspaceId: string;
  listPoliciesForInsured(
    input: ListPoliciesInput,
  ): Promise<McpResult<ListPoliciesOutput>>;
}

export const EZLYNX_API_BASE = 'https://api.ezlynx.com';
