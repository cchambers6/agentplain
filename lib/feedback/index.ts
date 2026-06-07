/**
 * lib/feedback — customer-feedback closed loop.
 *
 * Capture (/approvals modal) → aggregate (weekly drift sweep) → propose
 * (CapabilityProposal) → surface back (/briefings + operator leadership
 * board). The public surface every caller imports from.
 */

export * from './types';
export {
  tallyBySkillAndCategory,
  tallyByCategory,
  selectDriftGroups,
  driftMarker,
  buildProposalBody,
  summarizeWorkspaceWeek,
} from './drift';
export {
  recordPreferenceFeedback,
  listWorkspaceFeedbackSince,
  listWorkspaceFeedbackBatchesSince,
  hasOpenDriftProposal,
  createDriftProposal,
  summarizeCorrectionRatesSince,
  type RecordFeedbackArgs,
  type WorkspaceFeedbackBatch,
  type CreateDriftProposalArgs,
} from './store';
