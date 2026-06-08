/**
 * lib/skills/property-management-rent-collection-chase/buildium-lookup.ts
 *
 * Production wiring of the `RentRollLookup` port to Buildium via the
 * workspace-scoped Buildium MCP server (`lib/integrations/buildium-mcp`).
 * This resolves the keystone audit finding for the property-management
 * family: the `RentRollLookup` PORT already existed (with `JsonRentRollLookup`
 * as the second impl and "AppFolio / Buildium / Propertyware / Yardi Breeze
 * MCPs will return when wired" noted in json-fetcher.ts) — this is the
 * ADAPTER that was missing.
 *
 * Per `feedback_runner_portability.md`'s two-implementation rule, adding a
 * real impl behind the existing port is purely additive — skill.ts does not
 * change.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the ONLY place the rent-collection
 * skill touches Buildium, and it only ever speaks the `BuildiumMcpServer`
 * interface — never raw Buildium JSON.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We list delinquent
 * leases; we never write back to Buildium and never trigger a charge.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — each fetch builds the server fresh (which re-reads the flag +
 * re-resolves the credential), so a flag flip / key rotation lands on the
 * next fire.
 *
 * Honesty seam — when Buildium isn't configured (no credential, or a 401)
 * the adapter returns a NOT_CONFIGURED skill error with a calm "connect
 * Buildium" message rather than throwing or faking delinquent units.
 *
 * Honest mapping gaps (documented, not faked): Buildium's lease resource
 * does NOT carry the PM-of-record contact, the per-property
 * owner-approval-for-formal-notice flag, or per-tenant chase history. Those
 * are surfaced as operator merge fields / conservative defaults:
 *   - propertyManager → an operator-merge placeholder ContactPerson
 *   - formalNoticeRequiresOwnerApproval → true (fail safe: a formal
 *     Pay-Or-Quit always routes for owner sign-off until configured)
 *   - tenantAcknowledged / lastChaseAt → false / null (agentplain tracks
 *     chase history in its own approval ledger, not Buildium)
 */

import { buildBuildiumMcpServer } from '@/lib/integrations/buildium-mcp';
import type { BuildiumLeaseSummary, BuildiumMcpServer } from '@/lib/integrations/buildium-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type { ContactPerson, RentRollLookup, UnitDelinquency } from './types';

/** Calm message surfaced when Buildium isn't usable yet for this workspace. */
export const BUILDIUM_NOT_CONNECTED_MESSAGE =
  'Buildium is not yet connected for this workspace. Connect it from /integrations (and set BUILDIUM_ADAPTER_LIVE=on) and Plaino will pick up delinquent units on the next fire.';

/** Operator-merge placeholder PM-of-record. Buildium's lease API does not
 *  carry the property manager assignment, so the draft signs with an
 *  operator merge field the PM fills in (or the workspace config supplies). */
const OPERATOR_PM_PLACEHOLDER: ContactPerson = {
  name: '{{operator: property manager name}}',
  email: '{{operator: property manager email}}',
  phone: null,
};

export interface BuildiumRentRollLookupOptions {
  /** Override the MCP server — tests pass a TestBuildiumMcpServer or stub.
   *  Production omits this and the adapter builds the flagged server. */
  mcp?: BuildiumMcpServer;
  /** Cap on leases pulled per fire. Defaults to the server's own cap. */
  limit?: number;
}

export class BuildiumRentRollLookup implements RentRollLookup {
  readonly name = 'buildium' as const;
  private readonly workspaceId: string;
  private readonly opts: BuildiumRentRollLookupOptions;

  constructor(args: { workspaceId: string } & BuildiumRentRollLookupOptions) {
    if (!args.workspaceId) throw new Error('BuildiumRentRollLookup: workspaceId is required');
    this.workspaceId = args.workspaceId;
    this.opts = { mcp: args.mcp, limit: args.limit };
  }

  /** Build the server fresh per call — cold-start safe (re-reads flag+cred). */
  private mcp(): BuildiumMcpServer {
    return this.opts.mcp ?? buildBuildiumMcpServer({ workspaceId: this.workspaceId });
  }

  async fetchDelinquentUnits(args: {
    workspaceId: string;
  }): Promise<SkillResult<UnitDelinquency[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `BuildiumRentRollLookup bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const res = await this.mcp().listDelinquentLeases(
      this.opts.limit ? { limit: this.opts.limit } : {},
    );
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const units: UnitDelinquency[] = [];
    for (const lease of res.value.leases) {
      const mapped = toUnitDelinquency(lease);
      if (mapped) units.push(mapped);
    }
    return skillOk(units);
  }
}

/** Translate a Buildium MCP error into a skill error. Auth-class codes
 *  surface the calm NOT_CONFIGURED notice; everything else surfaces the raw
 *  upstream message under the port-level UPSTREAM_GMAIL_ERROR code (the
 *  shared "any upstream fetch failure" code the skill already speaks). */
function translateMcpError(code: string, message: string): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED'
  ) {
    return skillError('NOT_CONFIGURED', BUILDIUM_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `Buildium: ${message}`, code);
}

/** Map one Buildium lease to the skill's `UnitDelinquency`. Returns null
 *  when the lease has no addressable primary tenant (no email) — the skill
 *  can't draft a chase without a recipient, and we never fabricate one. */
export function toUnitDelinquency(lease: BuildiumLeaseSummary): UnitDelinquency | null {
  const withEmail = lease.tenants.filter((t) => t.email && t.email.trim().length > 0);
  if (withEmail.length === 0) return null;
  const [primary, ...rest] = withEmail;
  return {
    leaseId: lease.id,
    unitLabel: lease.unitLabel,
    primaryTenant: {
      name: primary.name,
      email: primary.email as string,
      phone: primary.phone,
    },
    coTenants: rest.map((t) => ({ name: t.name, email: t.email as string, phone: t.phone })),
    daysPastDue: lease.daysPastDue,
    paymentPlanInPlace: lease.paymentPlanInPlace,
    // agentplain tracks chase history in its own approval ledger, not
    // Buildium — start each fire from the durable state the skill owns.
    tenantAcknowledged: false,
    lastChaseAt: null,
    propertyManager: OPERATOR_PM_PLACEHOLDER,
    // Fail safe: a formal Pay-Or-Quit always routes for owner sign-off
    // until a per-property config says otherwise. Buildium does not carry
    // the jurisdiction flag.
    formalNoticeRequiresOwnerApproval: true,
  };
}
