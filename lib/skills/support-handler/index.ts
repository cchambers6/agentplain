/**
 * lib/skills/support-handler/index.ts
 *
 * Public surface of the support-handler skill. Consumers import from
 * `@/lib/skills/support-handler` only; concrete impls (PrismaApprovalSink,
 * CustomerFilesKnowledgeSubstrate, runSkill) are surfaced here so the
 * Inngest function + tests stay on the package boundary.
 */

export { runSkill } from './skill';
export { runSupportHandlerForRequest } from './run-for-request';
export {
  PrismaApprovalSink,
  SUPPORT_HANDLER_AGENT_SLUG,
  SUPPORT_HANDLER_REF_TABLE,
  buildApprovalRow,
} from './prisma-approval-sink';
export { RecordingApprovalSink } from './approval-sink';
export type { RecordedSupportDraft } from './approval-sink';
export {
  CustomerFilesKnowledgeSubstrate,
  RecordingKnowledgeSubstrate,
} from './knowledge-substrate';
export type {
  ApprovalSink,
  IKnowledgeSubstratePort,
  SupportContextSnippet,
  SupportDraftConfidence,
  SupportDraftProposal,
  SupportHandlerInput,
  SupportHandlerOutput,
  SupportRequestSnapshot,
} from './types';
export {
  DEFAULT_HIGH_CONFIDENCE_FLOOR,
  DEFAULT_MEDIUM_CONFIDENCE_FLOOR,
  DEFAULT_TOP_K,
  SNIPPET_EXCERPT_CHAR_CAP,
} from './types';
