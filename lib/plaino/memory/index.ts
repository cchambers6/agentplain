/**
 * lib/plaino/memory/index.ts
 *
 * Public surface for Plaino's customer-persistent memory. Server
 * actions, the dispatcher, and tests import from
 * `@/lib/plaino/memory` only; concrete impls
 * (PrismaMemoryStore, RecordingMemoryStore) are surfaced here.
 */

export { PrismaMemoryStore } from './prisma-memory-store';
export { RecordingMemoryStore } from './recording-memory-store';
export {
  extractMemoryFromConversation,
  EXTRACT_SYSTEM_PROMPT_VERSION,
} from './extract-from-conversation';
export type {
  ExtractArgs,
  ExtractInputTurn,
  ExtractResult,
} from './extract-from-conversation';
export {
  DEFAULT_DISPATCH_MEMORY_BUDGET,
  DISPATCH_MEMORY_CHAR_CAP,
  MEMORY_KINDS,
  memoryDeleteInputSchema,
  memoryEditInputSchema,
  memoryKindSchema,
  memoryPinInputSchema,
  proposedMemoryEntrySchema,
} from './types';
export type {
  IMemoryStore,
  MemoryDeleteInput,
  MemoryEditInput,
  MemoryEntry,
  MemoryKind,
  MemoryPinInput,
  ProposedMemoryEntry,
} from './types';
