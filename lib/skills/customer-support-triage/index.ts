/**
 * lib/skills/customer-support-triage/index.ts
 *
 * Public surface of the customer-support-triage skill (Pillar-3: Plaino
 * as L1 support). The triage decision core + its production entry point.
 */

export { runTriage, type RunTriageArgs, type TriageGateContext } from './triage';
export { runTriageForRequest, type RunTriageForRequestInput } from './run-for-request';
export {
  resolveTriageConfig,
  TRIAGE_SKILL_SLUG,
  TRIAGE_DISCIPLINE_ID,
  TRIAGE_SOURCE,
  type TriageConfig,
} from './config';
export { RepoKbLoader, PRODUCT_KB } from './kb-loader';
export { classifyEscalation, largestDollarAmount } from './escalation';
export {
  PrismaTriageMetricsSink,
  PrismaEscalationMarker,
  TRIAGE_METRIC_ACTION,
  TRIAGE_ESCALATED_ACTION,
} from './prisma-bindings';
export {
  DEGRADE_PAGE_FLAG,
  DEGRADE_PAGE_COOLDOWN_MS,
  shouldPageForDegrade,
} from './degrade-dedupe';
export * from './types';
