/**
 * lib/skills/finance-pulse-general/index.ts
 *
 * Public entry-points for the finance-pulse skill. Wave-4 discipline-
 * wrap closer — flips the finance discipline from PARTIAL → DELIVERING
 * (`docs/fleet-autonomy-audit-2026-05-28.md` §10) by giving every
 * workspace a weekly finance read, not just the per-vertical invoice-
 * chase / month-end-close skills.
 *
 * Per `project_no_outbound_architecture.md`: the skill produces one
 * weekly approval-queue row. Nothing leaves the workspace.
 */

export { runSkill } from './skill';
export { runFinancePulseForWorkspace } from './run-for-workspace';
export {
  PrismaFinancePulseApprovalSink,
  buildFinancePulseApprovalRow,
} from './prisma-approval-sink';
export { RecordingFinancePulseApprovalSink } from './approval-sink';
export { buildFinancePulseSnapshot } from './activity-snapshot';
export type {
  FinanceInternalCounts,
  FinancePulseApprovalSink,
  FinancePulseProposal,
  FinancePulseSkillInput,
  FinancePulseSkillOutput,
  FinancePulseSnapshot,
  FinanceQuickbooksState,
  FinanceQuickbooksSummary,
} from './types';
export {
  FINANCE_PULSE_AGENT_SLUG,
  FINANCE_PULSE_REF_TABLE,
} from './types';
