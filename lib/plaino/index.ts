/**
 * lib/plaino/index.ts
 *
 * Public surface of the Plaino dispatcher package. Server actions +
 * tests import from `@/lib/plaino` only; concrete impls
 * (PrismaChatStore, InngestEventEmitter, runPlainoTurn, etc.) are
 * surfaced here.
 */

export { runPlainoTurn } from './dispatcher';
export { buildSystemPrompt, PLAINO_SYSTEM_PROMPT_VERSION } from './system-prompt';
export {
  buildCapabilitySnapshot,
  buildCapabilitySnapshotSync,
} from './capabilities';
export { PrismaChatStore } from './prisma-chat-store';
export { RecordingChatStore } from './recording-chat-store';
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
export {
  CUSTOMER_MESSAGE_CHAR_CAP,
  DEFAULT_ANSWER_FLOOR,
  DEFAULT_TOP_K,
  HISTORY_CAP,
} from './types';
