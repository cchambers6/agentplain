/**
 * lib/plaino/index.ts
 *
 * Public surface of the Plaino dispatcher package. Server actions +
 * tests import from `@/lib/plaino` only; concrete impls
 * (PrismaChatStore, InngestEventEmitter, runPlainoTurn, etc.) are
 * surfaced here.
 */

export { runPlainoTurn } from './dispatcher';
export {
  triagePlainoTurnFailure,
  type TurnFailureTriage,
  type TurnFailureCategory,
} from './turn-failure';
export { buildSystemPrompt, PLAINO_SYSTEM_PROMPT_VERSION } from './system-prompt';
export {
  checkDegradedMode,
  DEGRADED_MODE_METADATA_KIND,
  type DegradedMode,
} from './degraded-mode';
export {
  buildPreferenceMemoryBody,
  parsePreferenceMemoryBody,
  preferenceScopeFromTitle,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';
export {
  readFeedbackRules,
  renderFeedbackRulesForPrompt,
  type FeedbackRule,
  type ReadFeedbackRulesArgs,
} from './feedback-rules';
export {
  buildCapabilitySnapshot,
  buildCapabilitySnapshotSync,
} from './capabilities';
export {
  buildBeforeAfterCard,
  type BuildBeforeAfterArgs,
} from './before-after';
export {
  buildDecisionTreeCard,
  type BuildDecisionTreeArgs,
} from './decision-tree';
export {
  buildCompliancePostureCard,
  type BuildCompliancePostureArgs,
} from './compliance-posture';
export {
  buildOnboardingProgressCard,
  type BuildOnboardingProgressArgs,
} from './onboarding-progress';
export {
  buildNextSteps,
  buildNextStepsCard,
  buildActivationCard,
  type BuildNextStepsArgs,
  type NextStepsActivationState,
  type NextStepsApprovalState,
  type NextStepsComplianceState,
  type NextStepsOnboardingState,
} from './next-steps';
export {
  buildKillerWorkflowStep,
  killerWorkflowFor,
  connectedProvidersFromSnapshot,
  type KillerWorkflowSpec,
  type BuildKillerWorkflowStepArgs,
} from './killer-workflow';
export {
  buildActivationCardFromState,
  buildActivationCardFromConnectedProviders,
  loadActivationCard,
  type BuildActivationCardFromStateArgs,
} from './activation-card-server';
export {
  PrismaChatStore,
  PLAINO_INSTRUCTION_AGENT_SLUG,
  PLAINO_INSTRUCTION_REF_TABLE,
} from './prisma-chat-store';
export { RecordingChatStore } from './recording-chat-store';
export {
  runInstructionHandler,
  buildInstructionHandlerSystemPrompt,
  buildInstructionHandlerUserPrompt,
  INSTRUCTION_HANDLER_PROMPT_VERSION,
  type IInstructionQueueStore,
  type InstructionDraft,
  type InstructionQueueItem,
  type RunInstructionHandlerArgs,
} from './instruction-handler';
export { PrismaInstructionQueueStore } from './prisma-instruction-queue-store';
export { RecordingInstructionQueueStore } from './recording-instruction-queue-store';
export const INSTRUCTION_CREATED_EVENT_NAME =
  'agentplain/instruction.created' as const;
export { InngestEventEmitter, RecordingEventEmitter } from './event-emitter';
export {
  PrismaMemoryStore,
  RecordingMemoryStore,
  EXTRACT_SYSTEM_PROMPT_VERSION,
  extractMemoryFromConversation,
  DEFAULT_DISPATCH_MEMORY_BUDGET,
  DISPATCH_MEMORY_CHAR_CAP,
  MEMORY_KINDS,
} from './memory';
export type {
  IMemoryStore,
  MemoryEntry,
  MemoryKind,
  ProposedMemoryEntry,
} from './memory';
export type {
  IChatStore,
  IEventEmitter,
  IKnowledgeSubstratePort,
  PersistedChatMessage,
  PlainoCapabilitySnapshot,
  PlainoClassification,
  PlainoDispatchKind,
  PlainoRunResult,
  PlainoTurnInput,
  PlainoTurnOutput,
  SupportContextSnippet,
} from './types';
export type {
  BeforeAfterCard,
  BeforeAfterRow,
  CapabilityCard,
  ComplianceArea,
  CompliancePostureCard,
  ConnectCta,
  DecisionBranch,
  DecisionTreeCard,
  NavCard,
  NavTarget,
  NextStep,
  NextStepsCard,
  OnboardingMilestone,
  OnboardingProgressCard,
  PlainoCard,
  PlainoCardInstructionState,
  QueueGlance,
  WorkStatusCard,
} from './visual-card';
export { parsePlainoCard } from './visual-card';
export {
  CUSTOMER_MESSAGE_CHAR_CAP,
  DEFAULT_ANSWER_FLOOR,
  DEFAULT_TOP_K,
  HISTORY_CAP,
  isPreferenceScopeId,
  PREFERENCE_SCOPE_IDS,
  type PreferenceScopeId,
} from './types';
