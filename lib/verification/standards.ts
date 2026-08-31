/**
 * lib/verification/standards.ts
 *
 * THE STANDARD FOR THE STANDARDS.
 *
 * Every gate in this repo makes the same implicit promise: "green means the
 * thing I check is true." That promise has failed here in two distinct ways,
 * and both were invisible from the outside:
 *
 *   • A multi-tenant isolation test looked for a literal `workspaceId` column,
 *     examined the tables that had one, and reported success while ten
 *     customer-data tables it had never considered sat unprotected. It caught
 *     1 of 11. Its output was indistinguishable from a clean schema.
 *   • A guard test compared a module against itself. It could not fail. Its
 *     output was indistinguishable from a passing guard.
 *
 * In both cases the bug was not the missing coverage. The bug was that NOTHING
 * DISTINGUISHED a check that had run and found nothing from a check that could
 * not find anything. This module removes that ambiguity by making each standard
 * carry, in code, the evidence that it works:
 *
 *   proveItCanFail()        — run me against an input built to violate me.
 *                             I must report the violation.
 *   proveItDiscriminates()  — run me against a near-miss that is legal.
 *                             I must report nothing.
 *   coverage()              — how much of the real surface I examined, and
 *                             what I am structurally unable to see.
 *
 * A standard that cannot supply all three does not go in the registry, and
 * `standards-contract.test.ts` fails the build if one stops supplying them.
 *
 * ── ON WHO WRITES WHAT ──────────────────────────────────────────────────
 * The `coverage()` and blind-spot text for each entry is authored HERE, by the
 * auditor, not inside the checker by its builder. That is deliberate. A
 * builder's account of their own blind spots is the least reliable sentence in
 * any audit — the Unit 1 review found a live injection vector its own author
 * had missed. `auditor` must differ from `owner` for every entry, and the
 * contract test enforces it, including for this module: the Verification
 * standard is audited by Tenant Isolation, not by itself.
 */

import {
  checkRosterCapabilityClaims,
  checkConnectorActionScopes,
  checkVerticalReachability,
  ADVERTISED_ACTION_RULES,
  type CatalogEntryLike,
  type ConnectorTileLike,
  type VerticalRosterLike,
} from '@/lib/claims/capability-claims';
import {
  checkTenantReachability,
  checkSystemContextBudget,
  type SchemaModelLike,
} from '@/lib/tenancy/tenant-reachability';
import type { CoverageReport } from '@/lib/tenancy/types';

/**
 * What happens when this standard fails. Deliberately not "all of the above" —
 * a standard that blocks a merge AND opens an issue AND pages is a standard
 * whose signal nobody can rank. One consequence each.
 */
export type FailureAction =
  /** The PR does not merge. For defects that are cheap to fix at review time. */
  | 'block-merge'
  /** An issue is opened; the merge proceeds. For debt that needs scheduling. */
  | 'open-issue'
  /** Conner is interrupted. Reserved for "a customer is being harmed now." */
  | 'page-conner';

export interface StandardDescriptor {
  /** Stable id. Used in the contract test's failure output. */
  id: string;
  /** The state of the world this standard defends. Not a task. */
  outcome: string;
  /** The owner role accountable for the outcome. */
  owner: string;
  /** Who checks the checker. MUST differ from `owner`. */
  auditor: string;
  /** Where the check lives, so a failure is navigable. */
  module: string;
  /** What happens on failure. Exactly one thing. */
  onFailure: FailureAction;

  /**
   * Run the checker against an input built to violate it.
   * MUST return at least one violation, or the checker is dead.
   */
  proveItCanFail: () => readonly unknown[];

  /**
   * Run the checker against a NEAR MISS — the same shape, one field changed
   * so it is legal. MUST return zero violations, or the checker fires on
   * everything and its green means nothing either.
   */
  proveItDiscriminates: () => readonly unknown[];

  /**
   * The auditor's account of what this standard sees and does not see.
   * `blindTo` may not be empty: a standard claiming no blind spots is
   * claiming omniscience, which is the posture that produced the
   * 1-of-11 isolation test.
   */
  coverage: () => CoverageReport;
}

// ─────────────────────────────────────────────────────────────────────────
// Fixtures — small, local, and NOT shared between entries.
//
// Shared fixtures are how a fixture drifts into being wrong for one caller
// while still passing for another. Each block below is built for exactly one
// standard and is legible in one screen.
// ─────────────────────────────────────────────────────────────────────────

const WORKSPACE: SchemaModelLike = { model: 'Workspace', table: 'Workspace', fkTargets: [] };

const violatingSchema = {
  models: [WORKSPACE, { model: 'Leak', table: 'Leak', fkTargets: ['Workspace'] }],
  rlsTables: new Set(['Workspace']),
  declaredGlobal: new Map<string, string>(),
  rootModel: 'Workspace',
};

const legalSchema = {
  ...violatingSchema,
  rlsTables: new Set(['Workspace', 'Leak']),
};

const violatingRoster: VerticalRosterLike[] = [
  {
    slug: 'fixture-vertical',
    agentRoster: [{ slug: 'card', runtime: 'live', boundSkill: 'fixture-skill' }],
  },
];
const deadCatalog: CatalogEntryLike[] = [{ slug: 'fixture-skill', runtime: 'schema-only' }];
const liveCatalog: CatalogEntryLike[] = [{ slug: 'fixture-skill', runtime: 'live' }];

const violatingTile: ConnectorTileLike[] = [
  {
    id: 'fixture-connector',
    name: 'Fixture Scheduler',
    description: 'Schedule meetings with your clients.',
    scopes: ['mail.read'],
    status: 'available',
  },
];
const legalTile: ConnectorTileLike[] = [
  { ...violatingTile[0], scopes: ['mail.read', 'Calendars.ReadWrite'] },
];

export const STANDARDS: readonly StandardDescriptor[] = [
  {
    id: 'tenant-isolation',
    outcome:
      'No table holding customer or end-client data is readable across workspaces.',
    owner: 'Tenant Isolation',
    auditor: 'Verification',
    module: 'lib/tenancy/tenant-reachability.ts',
    onFailure: 'block-merge',
    proveItCanFail: () => checkTenantReachability(violatingSchema).violations,
    proveItDiscriminates: () => checkTenantReachability(legalSchema).violations,
    coverage: () => ({
      examined: 64,
      total: 64,
      unit: 'Prisma models (recorded 2026-08-30 @ 4bc42b5; the check recomputes this every run and its own test fails if examined !== total)',
      blindTo: [
        'Proves an ENABLE/FORCE ROW LEVEL SECURITY statement exists in a migration. Does not evaluate the policy predicate — a USING (true) policy passes.',
        'Reads migration files, not the live database. Given the P3009 production migration block, a table can be protected in git and unprotected in production.',
        'Follows Prisma-declared owning-side foreign keys only. A tenant link carried in a Json column or a raw-SQL join is invisible.',
      ],
    }),
  },
  {
    id: 'system-context-budget',
    outcome:
      'The RLS bypass surface does not grow without someone saying so in the diff.',
    owner: 'Tenant Isolation',
    auditor: 'Verification',
    module: 'lib/tenancy/tenant-reachability.ts',
    onFailure: 'block-merge',
    proveItCanFail: () =>
      checkSystemContextBudget({
        callSitesByFile: new Map([['fixture.ts', 5]]),
        budget: 4,
        filesScanned: 1,
      }).violations,
    proveItDiscriminates: () =>
      checkSystemContextBudget({
        callSitesByFile: new Map([['fixture.ts', 4]]),
        budget: 4,
        filesScanned: 1,
      }).violations,
    coverage: () => ({
      examined: 170,
      total: 1467,
      unit: 'source files containing withSystemContext, of source files scanned (recorded 2026-08-30 @ 4bc42b5)',
      blindTo: [
        'Counts literal call sites in the declared SOURCE_ROOTS. A bypass reached through an alias or a wrapper helper is not counted, and a new top-level source directory is not scanned until it is added to SOURCE_ROOTS.',
        'Counts call sites, not executions. One site in a hot loop counts as one.',
        'Says nothing about whether any individual bypass is justified. It is a ratchet on the total, not a review.',
      ],
    }),
  },
  {
    id: 'roster-capability',
    outcome:
      'No fleet card tells a customer a capability is ready when nothing can fire it.',
    owner: 'Claim Truth',
    auditor: 'Verification',
    module: 'lib/claims/capability-claims.ts',
    onFailure: 'block-merge',
    proveItCanFail: () =>
      checkRosterCapabilityClaims({
        verticals: violatingRoster,
        catalog: deadCatalog,
        declaredCallers: new Set<string>(),
      }),
    proveItDiscriminates: () =>
      checkRosterCapabilityClaims({
        verticals: violatingRoster,
        catalog: liveCatalog,
        declaredCallers: new Set(['fixture-skill']),
      }),
    coverage: () => ({
      examined: 0,
      total: 0,
      unit: 'roster cards — SEE BLIND SPOT 1; this checker does not report its own coverage and the auditor cannot compute it from outside',
      blindTo: [
        'THIS CHECKER REPORTS NO COVERAGE. It returns a violation list and nothing else, so neither it nor this registry can state how many of the ~70 roster cards it examined. That is a real gap in the Claim Truth standard, recorded here rather than papered over. Remedy: have checkRosterCapabilityClaims return a CoverageReport the way the tenancy checkers do.',
        'Only checks cards that are runtime:live WITH a boundSkill. Cards live via owns[] are explicitly out of scope and covered, if at all, by tests/vertical-roster-bindings.test.ts.',
        'Trusts SWEEP_DISPATCH_MANIFEST as the definition of "has a caller." A skill wired by a caller not listed there reads as dead; a manifest entry pointing at a broken caller reads as live.',
      ],
    }),
  },
  {
    id: 'connector-action-scope',
    outcome:
      'No connector tile advertises an action the connect flow never requests permission for.',
    owner: 'Claim Truth',
    auditor: 'Verification',
    module: 'lib/claims/capability-claims.ts',
    onFailure: 'block-merge',
    proveItCanFail: () => checkConnectorActionScopes(violatingTile),
    proveItDiscriminates: () => checkConnectorActionScopes(legalTile),
    coverage: () => ({
      examined: ADVERTISED_ACTION_RULES.length,
      total: ADVERTISED_ACTION_RULES.length,
      unit: 'advertised-action rules (schedule, sign) applied to available OAuth tiles',
      blindTo: [
        'TWO VERBS. The rule vocabulary is deliberately tiny — "schedule" and "sign". Every other advertised action on every tile ("send", "file", "post", "sync") is unchecked. This is the standard in the roster with the narrowest declared coverage, and it is narrow on purpose: a fuzzy rule gets argued with and then ignored.',
        'Skips api-key tiles and coming-soon tiles entirely.',
        'Matches tile copy with a regex, so a claim phrased without the keyword ("get it on the calendar") is invisible.',
      ],
    }),
  },
  {
    id: 'vertical-reachability',
    outcome:
      'Nothing takes money for a vertical whose killer workflow cannot fire.',
    owner: 'Claim Truth',
    auditor: 'Verification',
    module: 'lib/claims/capability-claims.ts',
    onFailure: 'page-conner',
    proveItCanFail: () =>
      checkVerticalReachability({
        registrySlugs: ['locked-vertical'],
        onRampSlugs: [],
        // An escape hatch naming one of the locked ten routes a customer past
        // the readiness gate into paid signup. This is the worst launch bug
        // the repo has a name for, which is why this entry pages.
        signupOnRampAllowlist: ['locked-vertical'],
        readiness: () => ({ supported: false, reason: 'fixture' }),
      }),
    proveItDiscriminates: () =>
      checkVerticalReachability({
        registrySlugs: ['locked-vertical'],
        onRampSlugs: ['ramp'],
        signupOnRampAllowlist: ['ramp'],
        readiness: () => ({ supported: false, reason: 'fixture' }),
      }),
    coverage: () => ({
      examined: 0,
      total: 0,
      unit: 'published vertical slugs — SEE BLIND SPOT 1, this checker does not report coverage either',
      blindTo: [
        'THIS CHECKER REPORTS NO COVERAGE, same gap as roster-capability.',
        'Checks that the readiness resolver is the sole authority and that the escape hatch is not abused. It does NOT check that a readiness-supported vertical actually works end to end — resolveVerticalReadiness can be satisfied by a catalog entry and a manifest line while the skill errors at runtime.',
        'Says nothing about what the marketing site sells. A vertical page can take payment attention for a slug this check never sees, because this check reads registries, not pages.',
      ],
    }),
  },
  {
    id: 'standards-contract',
    outcome:
      'Every standard in this repo can be shown to fail, to discriminate, and to state its own coverage.',
    owner: 'Verification',
    // Audited by Tenant Isolation, NOT by Verification. The rule that no owner
    // audits its own outcome has to bind hardest here, because this is the
    // standard that enforces the rule.
    auditor: 'Tenant Isolation',
    module: 'lib/verification/standards.ts',
    onFailure: 'block-merge',
    proveItCanFail: () => checkStandardsContract([BROKEN_FIXTURE]),
    proveItDiscriminates: () => checkStandardsContract([HEALTHY_FIXTURE]),
    coverage: () => ({
      examined: 6,
      total: 6,
      unit: 'registered standards (the contract test asserts examined === STANDARDS.length every run)',
      blindTo: [
        'Only sees standards that are REGISTERED here. A check living somewhere in the repo and never added to STANDARDS is entirely outside this contract — which is the single largest hole in the Verification standard, and there is no mechanical way to close it short of enumerating every test file.',
        'Proves a checker can fail on the fixture it was handed. It does not prove the fixture resembles a real defect — a deliberately trivial fixture would satisfy this contract while the checker missed everything real.',
        'Says nothing about whether the check RUNS. That is the CI workflow contract, not this one.',
      ],
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────
// The contract checker itself
// ─────────────────────────────────────────────────────────────────────────

export interface ContractViolation {
  standard: string;
  problem: string;
  remedy: string;
}

/**
 * Audit the registry. Pure over the descriptor list so it can be handed a
 * broken fixture and shown to fail — the same contract it enforces.
 */
export function checkStandardsContract(
  standards: readonly StandardDescriptor[],
): ContractViolation[] {
  const out: ContractViolation[] = [];
  const seen = new Set<string>();

  for (const s of standards) {
    if (seen.has(s.id)) {
      out.push({
        standard: s.id,
        problem: 'duplicate id in the registry',
        remedy: 'Give each standard a unique id; duplicates make failures ambiguous.',
      });
    }
    seen.add(s.id);

    if (s.owner === s.auditor) {
      out.push({
        standard: s.id,
        problem: `owner and auditor are both "${s.owner}" — the builder is auditing its own work`,
        remedy: 'Assign a different auditor. This is the failure the Unit 1 review demonstrated.',
      });
    }

    let failed: readonly unknown[];
    try {
      failed = s.proveItCanFail();
    } catch (err) {
      out.push({
        standard: s.id,
        problem: `proveItCanFail() threw: ${err instanceof Error ? err.message : String(err)}`,
        remedy: 'Repair the fixture or the checker. A checker that throws is not a checker that passes.',
      });
      continue;
    }
    if (failed.length === 0) {
      out.push({
        standard: s.id,
        problem:
          'proveItCanFail() reported NO violations — this check cannot be shown to fail, so its green means nothing',
        remedy: `Fix the checker in ${s.module}, or fix the fixture if it stopped violating.`,
      });
    }

    let passed: readonly unknown[];
    try {
      passed = s.proveItDiscriminates();
    } catch (err) {
      out.push({
        standard: s.id,
        problem: `proveItDiscriminates() threw: ${err instanceof Error ? err.message : String(err)}`,
        remedy: 'Repair the near-miss fixture or the checker.',
      });
      continue;
    }
    if (passed.length > 0) {
      out.push({
        standard: s.id,
        problem:
          'proveItDiscriminates() reported violations on a legal near-miss — this check fires on everything, so its red means nothing either',
        remedy: `Tighten the predicate in ${s.module}.`,
      });
    }

    const cov = s.coverage();
    if (cov.blindTo.length === 0) {
      out.push({
        standard: s.id,
        problem: 'coverage() declares no blind spots — a claim of omniscience',
        remedy: 'Name at least one mechanism that would defeat this check.',
      });
    }
    if (cov.total < 0 || cov.examined < 0 || cov.examined > cov.total) {
      out.push({
        standard: s.id,
        problem: `coverage() is incoherent: examined ${cov.examined} of ${cov.total}`,
        remedy: 'Report real counts, or report 0/0 and say in blindTo that the checker cannot compute them.',
      });
    }
  }

  return out;
}

// ── Fixtures for the contract checker's own proof-of-failure ─────────────

const HEALTHY_FIXTURE: StandardDescriptor = {
  id: 'fixture-healthy',
  outcome: 'fixture',
  owner: 'Builder',
  auditor: 'Auditor',
  module: 'fixture',
  onFailure: 'open-issue',
  proveItCanFail: () => ['a violation'],
  proveItDiscriminates: () => [],
  coverage: () => ({ examined: 1, total: 1, unit: 'fixture', blindTo: ['everything real'] }),
};

const BROKEN_FIXTURE: StandardDescriptor = {
  ...HEALTHY_FIXTURE,
  id: 'fixture-broken',
  // Same role on both sides, and a checker that cannot fail. Two violations.
  owner: 'Builder',
  auditor: 'Builder',
  proveItCanFail: () => [],
};
