/**
 * lib/tenancy/known-tenancy-drift.ts
 *
 * The ratchet, plus the global-table register.
 *
 * Same semantics as `lib/claims/known-drift.ts`, and deliberately the same
 * shape so there is one thing to learn rather than two: itemized entries, a
 * reason, an expiry after which the gate fails on the accepted entry, and a
 * stale-acceptance check so the list cannot rot into fiction.
 *
 * WHY THIS LANDS GREEN OVER TEN OPEN GAPS. The rule that motivated this work
 * is "a standard that catches 1 of 12 is worse than no standard, because it
 * produces a green check over an open gap." That rule is about CONCEALMENT,
 * not about colour. The failure it names is a check that examined one table,
 * found it clean, and reported success while eleven others were never looked
 * at — nobody could tell from the output that anything was missing.
 *
 * This file is the opposite of that. It examines all 64 models, names all ten
 * gaps in the source, and puts a date on each. A reader of this file knows
 * exactly what is unprotected. What the green means is narrow and true: "no
 * ELEVENTH gap has appeared." The alternative — landing red — makes the gate
 * fail on every unrelated PR from day one, and a gate that is always red is
 * bypassed within a week, at which point the eleventh gap arrives unseen. That
 * is the failure mode this repo already has evidence for: `HUSKY=0` is how 27
 * placeholder SVGs reached production.
 *
 * The debt is not hidden. It is dated, and the date is enforced.
 */

import type { TenancyCheckId, TenancyViolation } from './types';

export interface KnownTenancyDriftEntry {
  check: TenancyCheckId;
  /** Must equal `TenancyViolation.subject` exactly. */
  subject: string;
  /** Why this ships un-fixed. Name the blocking decision, not "TODO". */
  reason: string;
  /** ISO date. After this, the gate fails on this entry. */
  expires: string;
}

/**
 * Accepted, dated tenant-isolation debt as of 2026-08-30, measured against
 * origin/main @ 4bc42b5.
 *
 * These ten are ONE finding, not ten: the client-portal subtree
 * (`PortalConfig -> PortalClient/PortalCase/... `) shipped in migration
 * 20260618000003_client_portal without any of the RLS statements its sibling
 * subtrees got in 20260526000001_force_rls, and `TeamMembership` was added in
 * the Wave-6 RBAC work with the same omission.
 *
 * They are NOT fixed in the PR that introduces this gate, on purpose. The fix
 * is a new migration adding ENABLE/FORCE ROW LEVEL SECURITY plus a policy per
 * table, and each policy has to join back to Workspace through a different FK
 * chain — PortalMessage reaches it in three hops, TeamMembership in two by a
 * different route. That is a schema change requiring a migration review and a
 * shadow-database drift pass, and it lands on a repo whose production
 * migrations have been blocked since 2026-06-17 by P3009. Folding it into the
 * PR that introduces the detector would mean the detector could not merge
 * until the migration block is cleared, and the detector is what stops an
 * eleventh table joining this list in the meantime.
 *
 * The expiry is aligned with the 2026-11-09 batch already used by
 * `lib/claims/known-drift.ts` and `tests/quarantine.json` so there is one date
 * to defend, not three.
 */
export const KNOWN_TENANCY_DRIFT: readonly KnownTenancyDriftEntry[] = [
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalConfig',
    reason:
      'Client-portal root. Reaches Workspace directly via workspaceId and has no RLS policy — note that it DOES carry a workspaceId column, which is why the previous column-name-based isolation test read it as protected. Fixed by the client-portal RLS migration, blocked behind the P3009 production migration block.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalClient',
    reason:
      'End-client identities (email, name) for an SMB customer. Reaches Workspace via portalConfigId -> PortalConfig. No workspaceId column, so the previous isolation test never considered it. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalCase',
    reason:
      'End-client matter records. Reaches Workspace via portalConfigId. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalCaseEvent',
    reason:
      'Case timeline entries. Reaches Workspace in three hops via caseId -> PortalCase -> PortalConfig. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalInvite',
    reason:
      'Invite tokens addressed to a named end client. Reaches Workspace via portalConfigId. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalSession',
    reason:
      'Live portal sessions for end clients. Reaches Workspace via portalConfigId. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalThread',
    reason:
      'Gated end-client chat threads. Reaches Workspace via portalConfigId. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalMessage',
    reason:
      'End-client message bodies — the highest-sensitivity table in the portal subtree. Reaches Workspace via threadId -> PortalThread -> PortalConfig. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'PortalDocument',
    reason:
      'End-client document metadata and blob pointers. Reaches Workspace via portalConfigId. Same client-portal RLS migration.',
    expires: '2026-11-09',
  },
  {
    check: 'tenant-reachable-without-rls',
    subject: 'TeamMembership',
    reason:
      'Wave-6 RBAC join table. Reaches Workspace via teamId -> Team and via membershipId -> Membership; both parents are RLS-protected and this row is not, so team composition is readable across workspaces. Separate one-line migration from the portal batch, same review.',
    expires: '2026-11-09',
  },
];

/**
 * Tables that hold no customer-tenant data.
 *
 * A model with no foreign-key path to Workspace is NOT automatically safe —
 * "no path to the tenant root" is exactly as consistent with "this is global"
 * as it is with "somebody forgot the tenant link." The check therefore refuses
 * to pass an unclassified table, and this register is where the classification
 * is stated in writing, once, where a reviewer can disagree with it.
 */
export const GLOBAL_TABLES: ReadonlyMap<string, string> = new Map([
  [
    'User',
    'Identity root. One human, one row, potentially many workspaces — scoping User by workspace would break multi-workspace membership. RLS is present and scopes by app.user_id, not by workspace.',
  ],
  [
    'MagicLinkToken',
    'Login token bound to a User before any workspace context exists. RLS present, scoped by user.',
  ],
  [
    'WebAuthnCredential',
    'Passkey bound to a User, not to a workspace. RLS present, scoped by user.',
  ],
  [
    'PushDevice',
    'Device registration bound to a User. RLS present, scoped by user.',
  ],
  [
    'Inquiry',
    'Pre-signup marketing inquiry. By definition precedes the existence of a workspace. RLS present, operator-scoped.',
  ],
  [
    'LeadCapture',
    'Anonymous website lead capture. No authenticated user and no workspace at write time. RLS present, operator-scoped.',
  ],
  [
    'OpsFlag',
    "Internal operations flag about agentplain's own fleet, not about any customer. RLS present, operator-scoped.",
  ],
  [
    'ComplianceCounselSignoff',
    'Outside-counsel signoff on agentplain corpus material. Not customer data. RLS present, operator-scoped.',
  ],
  [
    'OutreachProspect',
    "agentplain's own sales CRM — businesses WE are prospecting, not any customer's clients. No tenant to isolate by. NOTE, and this is not a suppression: together with OutreachTouch it is the only table in the schema holding personal data (name, business, email) with neither a tenant boundary NOR an RLS policy. The sole control is the operator-only route guard on its surfaces. That is a real finding about a single access-control layer, tracked as its own item — it is recorded here rather than in the drift list because it is genuinely global, so no amount of tenant scoping would address it.",
  ],
  [
    'OutreachTouch',
    "Contact events against an OutreachProspect. Same class, same single-control caveat as OutreachProspect: agentplain's own data, no tenant boundary, no RLS.",
  ],
]);

/**
 * Ceiling on `withSystemContext()` call sites in the declared source roots.
 *
 * Measured 2026-08-30 against a pristine `git archive origin/main` export at
 * 4bc42b5: 365 call sites across 170 files of 1,467 scanned. The same scan of
 * the working checkout returns 365/170/1,470 — the three-file difference is
 * untracked local files, and the call-site count is identical, which is the
 * property a budget needs. Every one of those call sites runs its queries with
 * `app.is_operator = 'true'` and `app.workspace_id = ''`, which disables the
 * tenant predicate on every policy written as "operator sees all." RLS on a
 * table is only worth what the call sites that read it do NOT bypass, so the
 * table-level check above is incomplete without this number being watched.
 *
 * This is a budget, not a ban. Raising it is a legitimate PR; raising it
 * without saying so in the diff is not.
 */
export const SYSTEM_CONTEXT_BUDGET = 365;

export interface TenancyRatchetResult {
  /** Violations with no accepted entry — these fail the gate. */
  unaccepted: TenancyViolation[];
  /** Accepted entries whose expiry has passed — these fail the gate too. */
  expired: KnownTenancyDriftEntry[];
  /** Accepted entries with no matching violation — the list has rotted. */
  stale: KnownTenancyDriftEntry[];
}

function key(check: TenancyCheckId, subject: string): string {
  return `${check}::${subject}`;
}

/**
 * Apply the ratchet. `today` is injected so expiry behaviour is testable
 * without waiting until November.
 */
export function applyTenancyRatchet(
  violations: readonly TenancyViolation[],
  today: Date,
  known: readonly KnownTenancyDriftEntry[] = KNOWN_TENANCY_DRIFT,
): TenancyRatchetResult {
  const knownByKey = new Map(known.map((e) => [key(e.check, e.subject), e]));
  const seen = new Set<string>();

  const unaccepted: TenancyViolation[] = [];
  for (const v of violations) {
    const k = key(v.check, v.subject);
    seen.add(k);
    if (!knownByKey.has(k)) unaccepted.push(v);
  }

  return {
    unaccepted,
    expired: known.filter((e) => new Date(e.expires) < today),
    stale: known.filter((e) => !seen.has(key(e.check, e.subject))),
  };
}
