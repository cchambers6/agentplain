/**
 * lib/plaino/memory/types.ts
 *
 * Contract for Plaino's customer-persistent memory layer. The dispatcher
 * READS through this port at the start of every turn (so Plaino has
 * continuity across sessions, instead of starting cold every time the
 * customer reopens `/talk`) and WRITES through it asynchronously after
 * each turn pair (so the next session inherits what was learned).
 *
 * Four-bucket taxonomy mirrors the agent-side memory system already in
 * use (project / feedback / user / reference) so the same mental model
 * applies on both sides of the customer ↔ agent seam.
 *
 * Per project_no_outbound_architecture: memory is INTERNAL. Nothing in
 * here leaves the workspace. Per feedback_runner_portability + the
 * two-implementation rule: IMemoryStore has a Prisma impl + an
 * in-memory recording impl behind the same shape.
 *
 * Per the honesty rule (reference_product_claims_vs_reality): Plaino
 * never claims to remember something it doesn't have stored. Empty
 * memory is allowed; fabrication is not.
 */

import { z } from 'zod';

/**
 * Four discrete buckets for memory entries. Same shape as the global
 * memory system; renders directly on the customer-facing memory page.
 */
export type MemoryKind = 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE';

export const MEMORY_KINDS: ReadonlyArray<MemoryKind> = [
  'USER',
  'FEEDBACK',
  'PROJECT',
  'REFERENCE',
];

/**
 * One persisted memory entry, decrypted at the seam — callers always
 * see plaintext `body`. The store is the encryption boundary.
 */
export interface MemoryEntry {
  id: string;
  workspaceId: string;
  kind: MemoryKind;
  /** Short, plaintext label used in UI lists and dispatcher prompts.
   *  The extractor is instructed to keep PII out of this field. */
  title: string;
  /** Plaintext body. Persisted encrypted at rest with the v1 envelope. */
  body: string;
  /** Optional pointer back to the ChatMessage where Plaino learned this. */
  sourceChatMessageId: string | null;
  /** Pinned entries are always included in the dispatcher prompt. */
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastReadAt: Date | null;
}

/** A proposed entry produced by `extractMemoryFromConversation` BEFORE
 *  it has been written. No `id` / timestamps yet — those land on upsert. */
export interface ProposedMemoryEntry {
  kind: MemoryKind;
  title: string;
  body: string;
  /** One-sentence justification from the LLM: WHY this is worth saving.
   *  The extractor drops any proposal without a justification — that's
   *  how we keep the rule "save WHY, not just WHAT" enforceable. */
  justification: string;
  sourceChatMessageId: string | null;
}

export const memoryKindSchema = z.enum(['USER', 'FEEDBACK', 'PROJECT', 'REFERENCE']);

/** Zod schema for one extracted entry — used to validate the LLM's
 *  JSON output at the extract boundary. */
export const proposedMemoryEntrySchema = z.object({
  kind: memoryKindSchema,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2_000),
  justification: z.string().trim().min(1).max(500),
  sourceChatMessageId: z.string().nullable().optional(),
});

/** Customer-edit zod schema (memory page). Title + body editable; kind
 *  is fixed once written — the customer wants to move a USER entry to
 *  PROJECT they'd delete + recreate. */
export const memoryEditInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2_000),
});

export const memoryPinInputSchema = z.object({
  id: z.string().min(1),
  pinned: z.boolean(),
});

export const memoryDeleteInputSchema = z.object({
  id: z.string().min(1),
});

export type MemoryEditInput = z.infer<typeof memoryEditInputSchema>;
export type MemoryPinInput = z.infer<typeof memoryPinInputSchema>;
export type MemoryDeleteInput = z.infer<typeof memoryDeleteInputSchema>;

/**
 * Workspace-scoped memory port. All implementations:
 *
 *   - Enforce workspace isolation at the seam (the store is constructed
 *     with the workspaceId; foreign reads/writes throw).
 *   - Encrypt `body` at rest with the v1 envelope.
 *   - Treat `title` as plaintext (so the dispatcher can prompt-include
 *     short labels without round-tripping decryption, and the memory
 *     page can render a list without N decryption calls).
 */
export interface IMemoryStore {
  readonly name: string;

  /**
   * Read entries for the workspace. Pinned entries first, then by
   * recency. The dispatcher uses this for prompt assembly; the memory
   * page uses it to render the customer's full memory.
   */
  listForWorkspace(args: {
    workspaceId: string;
    /** Optional cap on returned rows. Dispatcher passes a small budget
     *  (e.g. 20); memory page reads them all. */
    limit?: number;
  }): Promise<MemoryEntry[]>;

  /**
   * Mark a set of entry ids as read at `now`. Lets future eviction
   * passes prefer "stale + unpinned" without reading the chat log.
   * Fire-and-forget at the dispatcher seam: a failure here does NOT
   * block the reply.
   */
  markRead(args: {
    workspaceId: string;
    ids: string[];
    now?: Date;
  }): Promise<void>;

  /**
   * Idempotent upsert by (workspaceId, kind, title). The extractor
   * normalizes titles so re-mentioning the same fact updates the body
   * + lastReadAt rather than creating a duplicate. Returns the resulting
   * MemoryEntry so the caller can link it to the source message.
   */
  upsert(args: {
    workspaceId: string;
    kind: MemoryKind;
    title: string;
    body: string;
    sourceChatMessageId: string | null;
    now?: Date;
  }): Promise<MemoryEntry>;

  /**
   * Customer-driven pin toggle. Pinned entries are always included by
   * the dispatcher; unpinned entries are selected by recency + token
   * budget.
   */
  setPinned(args: {
    workspaceId: string;
    id: string;
    pinned: boolean;
    now?: Date;
  }): Promise<MemoryEntry>;

  /**
   * Customer-driven edit. Title + body are mutable; kind is not (a
   * "move to a different bucket" workflow is "delete + recreate"). The
   * impl re-encrypts the body and bumps updatedAt.
   */
  edit(args: {
    workspaceId: string;
    id: string;
    title: string;
    body: string;
    now?: Date;
  }): Promise<MemoryEntry>;

  /** Customer-driven delete. Returns whether the row existed. */
  delete(args: { workspaceId: string; id: string }): Promise<boolean>;
}

/**
 * Default cap on entries the dispatcher pulls per fire. Tight on
 * purpose — Plaino's memory should bias toward "fewer, sharper" rather
 * than dumping the whole history into every prompt. Pinned entries
 * bypass this cap.
 */
export const DEFAULT_DISPATCH_MEMORY_BUDGET = 20;

/**
 * Soft character cap the dispatcher applies when assembling the "what
 * you've told me before" block. Keeps the prompt bounded even when a
 * customer has 100 pinned entries.
 */
export const DISPATCH_MEMORY_CHAR_CAP = 6_000;
