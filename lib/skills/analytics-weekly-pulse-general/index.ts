/**
 * lib/skills/analytics-weekly-pulse-general/index.ts
 *
 * Public entry-points for the analytics-weekly-pulse skill. Wave-3
 * discipline-wrap — closes the "analytics is NOT-DELIVERING" gap from
 * the 2026-05-28 fleet-autonomy audit.
 *
 * Per `project_no_outbound_architecture.md`: the skill produces one
 * weekly approval-queue row. Nothing leaves the workspace.
 */

export { runSkill } from './skill';
export { runAnalyticsPulseForWorkspace } from './run-for-workspace';
export { PrismaPulseApprovalSink, buildPulseApprovalRow } from './prisma-approval-sink';
export { buildPulseSnapshot } from './activity-snapshot';
export type {
  PulseActivitySnapshot,
  PulseProposal,
  PulseApprovalSink,
  PulseSkillInput,
  PulseSkillOutput,
} from './types';
export {
  PULSE_AGENT_SLUG,
  PULSE_REF_TABLE,
} from './types';
