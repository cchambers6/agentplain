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
 * WHY THE DRIFT LIST IS EMPTY. An earlier revision of this file accepted ten
 * dated gaps and argued at length for landing green over them. That argument
 * is moot: PR #467 (merged `f6e2b52`) shipped migration
 * `20260830000000_portal_team_outreach_rls`, which closed all ten. The list is
 * empty because the debt was paid, not because it was swept away.
 *
 * The rule that motivated this work still stands: "a standard that catches 1
 * of 12 is worse than no standard, because it produces a green check over an
 * open gap." That rule is about CONCEALMENT, not about colour. The failure it
 * names is a check that examined one table, found it clean, and reported
 * success while eleven others were never looked at — nobody could tell from
 * the output that anything was missing.
 *
 * This file is the opposite of that. It examines all 64 models and reports how
 * many it examined, so "found nothing" and "examined nothing" stay
 * distinguishable in the output. An empty acceptance list is the strongest
 * state this file can be in — but only because the coverage count is reported
 * beside it. An empty list over an unexamined schema would be the same green
 * over the same open gap; the reporting is the only thing that tells them
 * apart.
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
 * Accepted, dated tenant-isolation debt.
 *
 * EMPTY as of 2026-08-31, re-derived against origin/main @ 5c03712.
 *
 * It previously carried ten `tenant-reachable-without-rls` entries — the nine
 * client-portal tables plus `TeamMembership`. All ten were closed by migration
 * `20260830000000_portal_team_outreach_rls`, shipped in PR #467 (merged
 * `f6e2b52`), which is on main and predates this branch.
 *
 * Measured, not assumed. Over all 67 migration SQL files on origin/main, with
 * `--` comments stripped first (commented-out SQL has been miscounted as
 * coverage in this repo before):
 *
 *   models in prisma/schema.prisma .................. 64
 *   tables with ENABLE ROW LEVEL SECURITY ........... 64
 *   tables with FORCE ROW LEVEL SECURITY ............ 64
 *   tables with at least one CREATE POLICY .......... 64
 *   models lacking ENABLE + FORCE + a policy ......... 0
 *
 *   of the ten formerly-accepted subjects, now protected ... 10 of 10
 *     PortalConfig, PortalClient, PortalCase, PortalCaseEvent, PortalInvite,
 *     PortalSession, PortalThread, PortalMessage, PortalDocument,
 *     TeamMembership — each with ENABLE + FORCE + a *_workspace_isolation
 *     policy created in 20260830000000_portal_team_outreach_rls.
 *
 * Do NOT re-add an entry here to make a red check green. An entry is a dated
 * promise that a specific table is knowingly unprotected; if the detector
 * reports a violation, either the table regressed or the detector is wrong,
 * and both are worth finding out.
 *
 * WHAT THIS EMPTINESS DOES NOT MEAN. Every number above is read out of
 * migration *text*, not out of a live database. A policy dropped by hand in
 * production, or a migration that never applied, still reads as protected
 * here. Production migrations have been blocked since 2026-06-17, so the
 * deployed database is NOT known to match this. Live enforcement is a separate
 * question, answered by the `rls-live` workflow (PR #472, merged `ea5fbf6`),
 * which runs the cross-tenant layer against a real Postgres — and which covers
 * four tables by read, and none by cross-tenant INSERT.
 *
 * The expiry convention, should an entry ever be needed again: align with the
 * 2026-11-09 batch already used by `lib/claims/known-drift.ts` and
 * `tests/quarantine.json` so there is one date to defend, not three.
 */
export const KNOWN_TENANCY_DRIFT: readonly KnownTenancyDriftEntry[] = [];

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
    "agentplain's own sales CRM — businesses WE are prospecting, not any customer's clients. No tenant to isolate by, which is why it belongs here rather than in the drift list: no amount of tenant scoping would address it. CORRECTED 2026-08-31: this note used to say it had 'neither a tenant boundary NOR an RLS policy' and that 'the sole control is the operator-only route guard'. Both halves are now out of date. Migration 20260830000000_portal_team_outreach_rls (PR #467, merged f6e2b52) gave it ENABLE + FORCE ROW LEVEL SECURITY and the policy outreach_prospect_operator_all — verified against origin/main. It still holds personal data (name, business, email) and still has no tenant boundary, but there are now two controls, not one: the operator-only route guard on its surfaces AND a database policy. The residual risk is narrower and worth stating exactly — an operator-only policy is satisfied by anything running under withSystemContext(), so the policy constrains ordinary tenant traffic and does not constrain the bypass surface counted by SYSTEM_CONTEXT_BUDGET.",
  ],
  [
    'OutreachTouch',
    "Contact events against an OutreachProspect. Same class as OutreachProspect: agentplain's own data, no tenant boundary. CORRECTED 2026-08-31: the old 'no RLS' and 'single-control' wording was wrong for this table too, not just for its parent — the same migration 20260830000000_portal_team_outreach_rls (PR #467) gave it ENABLE + FORCE ROW LEVEL SECURITY and the policy outreach_touch_operator_all. #467 covered BOTH outreach tables; this branch was the last place still describing the pre-#467 world. Same residual as OutreachProspect: an operator-only predicate is satisfied by withSystemContext(), so it bounds tenant traffic and not the bypass surface.",
  ],
]);

/**
 * Ceiling on `withSystemContext()` call sites in the declared source roots.
 *
 * RE-MEASURED 2026-08-31 against `origin/main` @ 5c03712, reproducing
 * `scanSystemContext`'s own rules (roots app/lib/components/scripts; excluding
 * `lib/db/rls.ts`, `lib/tenancy/`, `*.test.ts(x)` and `__tests__/`; comments
 * stripped): **365 call sites across 170 files of 1,418 scanned.** The same
 * scan of this branch returns an identical 365/170/1,418, so the six merges
 * since the original measurement added no bypass sites and the budget is met
 * exactly — which passes, since the gate fails only on EXCEEDING it.
 *
 * The previously recorded figure was "365 across 170 of 1,467 scanned" at
 * 4bc42b5. The call-site count — the number the budget is actually about — is
 * unchanged; only the denominator moved, and it moved DOWN, so the floor
 * (SOURCE_FILE_FLOOR) is still cleared with room. Every one of those call
 * sites runs its queries with
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
