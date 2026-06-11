/**
 * lib/skills/customer-support-triage/config.ts
 *
 * The CONNER-RATIFIABLE defaults for the triage layer, wired as
 * env-tunable constants. Every threshold a human would want to argue
 * about lives here so the PR's CONNER DECISION block can point at one
 * file: ratify or amend in env, no code change.
 *
 * Cold-start safe (feedback_cold_start_safe_agents.md): every value is
 * read from env on every fire; nothing is captured at module load.
 */

/** KB confidence (0–1) at/above which the triage layer auto-answers
 *  without human review. Below this → draft-for-review. Default 0.80. */
export const KB_CONFIDENCE_THRESHOLD_ENV = 'SUPPORT_TRIAGE_KB_CONFIDENCE_THRESHOLD';
export const DEFAULT_KB_CONFIDENCE_THRESHOLD = 0.8;

/** Billing-dispute dollar amount (USD) above which the triage layer
 *  escalates to a human instead of attempting an answer. Default $200. */
export const BILLING_DISPUTE_THRESHOLD_ENV = 'SUPPORT_TRIAGE_BILLING_DISPUTE_THRESHOLD_USD';
export const DEFAULT_BILLING_DISPUTE_THRESHOLD_USD = 200;

/** Escalation deadline (hours) surfaced to the customer + on the page.
 *  "One business day" is the promise; 24h is the page deadline. */
export const ESCALATION_DEADLINE_HOURS_ENV = 'SUPPORT_TRIAGE_ESCALATION_DEADLINE_HOURS';
export const DEFAULT_ESCALATION_DEADLINE_HOURS = 24;

/** Master switch for bounded auto-resolve of account actions. Even with
 *  this ON, each action still passes the existing #204 per-workspace
 *  bounded-execute gates — this only gates whether triage ATTEMPTS an
 *  auto-resolve at all. Strict equality with "on" (fail-closed on typo).
 *  Recommendation in the PR: ride the existing per-workspace toggle so
 *  there is ONE autonomy mental model — this stays OFF by default and the
 *  real decision is the per-workspace bounded-execute setting. */
export const AUTO_RESOLVE_MASTER_ENV = 'SUPPORT_TRIAGE_AUTO_RESOLVE_MASTER';

/** Stable source tag the triage layer stamps on its pages + metrics rows. */
export const TRIAGE_SOURCE = 'customer-support-triage';

/** The skill slug — matches lib/skills/customer-support-triage/ and the
 *  SKILL_CATALOG entry. Used for gateSkillFire + metrics. */
export const TRIAGE_SKILL_SLUG = 'customer-support-triage';

/** The discipline the triage skill belongs to (for gateSkillFire's
 *  discipline-narrowed pause). Support is customer-success. */
export const TRIAGE_DISCIPLINE_ID = 'customer-success';

export interface TriageConfig {
  kbConfidenceThreshold: number;
  billingDisputeThresholdUsd: number;
  escalationDeadlineHours: number;
  autoResolveMasterOn: boolean;
}

function readNumber(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

/** Resolve the full tunable config from env (or its defaults). Pure. */
export function resolveTriageConfig(
  env: NodeJS.ProcessEnv = process.env,
): TriageConfig {
  return {
    kbConfidenceThreshold: readNumber(
      env,
      KB_CONFIDENCE_THRESHOLD_ENV,
      DEFAULT_KB_CONFIDENCE_THRESHOLD,
      { min: 0, max: 1 },
    ),
    billingDisputeThresholdUsd: readNumber(
      env,
      BILLING_DISPUTE_THRESHOLD_ENV,
      DEFAULT_BILLING_DISPUTE_THRESHOLD_USD,
      { min: 0, max: 1_000_000 },
    ),
    escalationDeadlineHours: readNumber(
      env,
      ESCALATION_DEADLINE_HOURS_ENV,
      DEFAULT_ESCALATION_DEADLINE_HOURS,
      { min: 1, max: 720 },
    ),
    autoResolveMasterOn: env[AUTO_RESOLVE_MASTER_ENV] === 'on',
  };
}
