/**
 * lib/claims/types.ts
 *
 * Shared shapes for the claim-vs-code checks.
 *
 * WHY THIS MODULE EXISTS: three separate findings across the 2026-08-10 and
 * 2026-08-11 audits were the same failure, not three failures — a customer
 * surface claims something the code cannot do:
 *
 *   1. In-product fleet cards render a capability as live-and-watching while
 *      the skill behind it has no production caller. Nothing can trigger it.
 *   2. A connector tile advertises an action ("schedule") for which the
 *      connect flow never requests a scope, so every call of that kind fails.
 *   3. The signup gate decides which verticals can take money using a rule
 *      that is not the readiness resolver, so the two can disagree silently.
 *   4. (added 2026-08-30) A reader counts approval-queue rows by an
 *      `agentSlug` no sink writes, so a customer-facing number is 0 forever.
 *      Same failure, one layer lower: the surface claims to be reporting work
 *      that its own query can never see. `approval-slug-parity.ts`.
 *
 * Each is invisible at runtime: no error, no log, no alert — the surface just
 * quietly lies. These checks turn each into a failing test.
 *
 * Every checker here is PURE and dependency-injected: it takes the registry
 * data as an argument rather than importing it. That is what makes the
 * deliberate-failure tests possible — a check that has never been observed
 * failing is indistinguishable from a check that cannot fail, and that
 * indistinguishability is the bug this module is fixing.
 */

export type ClaimCheckId =
  | 'roster-capability'
  | 'connector-action-scope'
  | 'vertical-reachability'
  | 'approval-slug-parity';

export interface ClaimViolation {
  /** Which check produced this. */
  check: ClaimCheckId;
  /**
   * Stable identity for the violation — the key the known-drift ratchet in
   * `known-drift.ts` matches on. Must not embed prose that could be reworded,
   * or an accepted entry would silently stop matching and the gate would
   * start failing on already-accepted debt.
   */
  subject: string;
  /** Human-readable statement of what is claimed vs what the code does. */
  detail: string;
  /** What a fix looks like. Stated so the failure is actionable at 2am. */
  remedy: string;
}

export function formatViolations(violations: readonly ClaimViolation[]): string {
  return violations
    .map((v) => `  • [${v.check}] ${v.subject}\n      ${v.detail}\n      fix: ${v.remedy}`)
    .join('\n');
}
