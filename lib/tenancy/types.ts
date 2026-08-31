/**
 * lib/tenancy/types.ts
 *
 * Shared shapes for the tenant-isolation standard.
 *
 * WHY THIS MODULE EXISTS: the repo already had a multi-tenant isolation test.
 * It passed. It passed because it looked for a literal `workspaceId` column
 * and every table it knew about had one. That is the wrong axis twice over:
 *
 *   • `PortalClient` has NO `workspaceId` column and is still customer data —
 *     it reaches a workspace through `portalConfigId -> PortalConfig`. A
 *     column-name check calls it out of scope and moves on.
 *   • `PortalConfig` HAS a `workspaceId` column and has NO row-level-security
 *     policy. A column-name check calls it protected. It is not.
 *
 * So the check here follows FOREIGN KEYS, not names, and asks a different
 * question: can this table be reached from `Workspace`, and if so does the
 * database refuse to serve it across workspaces?
 *
 * Every checker in this module is PURE and dependency-injected — it takes the
 * parsed schema as an argument rather than reading the filesystem. That is
 * what makes the deliberate-failure fixtures in the test file possible. A
 * check that has never been observed failing is indistinguishable from a check
 * that cannot fail. Same contract as `lib/claims/types.ts`.
 */

export type TenancyCheckId =
  | 'tenant-reachable-without-rls'
  | 'undeclared-global-table'
  | 'stale-global-declaration'
  | 'system-context-budget';

export interface TenancyViolation {
  check: TenancyCheckId;
  /**
   * Stable identity — the key the ratchet in `known-tenancy-drift.ts` matches
   * on. Must not embed prose that could be reworded, or an accepted entry
   * would silently stop matching and the gate would start failing on debt that
   * was already accepted.
   */
  subject: string;
  /** What is true, stated so it is checkable by hand. */
  detail: string;
  /** What a fix looks like. Written to be actionable without context. */
  remedy: string;
}

/**
 * What a check says about its OWN limits.
 *
 * This is not decoration. The failure that motivated this whole module was a
 * green check over an open gap: a test that examined 1 of 12 tables and
 * reported success. A check that cannot state how much of the surface it
 * examined, and what it is structurally unable to see, is not evidence — it is
 * a claim. Every checker here returns one of these alongside its violations,
 * and the meta-standard in `lib/verification` fails any check that reports
 * zero coverage or an empty blind-spot list.
 */
export interface CoverageReport {
  /** How many units of the real surface this check actually inspected. */
  examined: number;
  /** How many units exist. `examined < total` is allowed; hiding it is not. */
  total: number;
  /** What the unit is ("Prisma models", "withSystemContext call sites"). */
  unit: string;
  /**
   * What this check CANNOT see, in specific terms. Not "may have gaps" —
   * name the mechanism that would defeat it.
   */
  blindTo: readonly string[];
}

export interface TenancyReport {
  violations: readonly TenancyViolation[];
  coverage: CoverageReport;
}

export function formatTenancyViolations(
  violations: readonly TenancyViolation[],
): string {
  return violations
    .map(
      (v) =>
        `  • [${v.check}] ${v.subject}\n      ${v.detail}\n      fix: ${v.remedy}`,
    )
    .join('\n');
}

export function formatCoverage(c: CoverageReport): string {
  const pct = c.total === 0 ? 0 : Math.round((c.examined / c.total) * 100);
  return [
    `examined ${c.examined}/${c.total} ${c.unit} (${pct}%)`,
    ...c.blindTo.map((b) => `      blind to: ${b}`),
  ].join('\n');
}
