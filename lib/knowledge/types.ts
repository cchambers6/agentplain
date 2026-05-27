/**
 * lib/knowledge/types.ts
 *
 * The knowledge-substrate boundary types — the abstractions every other
 * file in this folder satisfies. Skills, the MCP route, the seed scripts
 * speak only the interfaces here. The concrete pgvector / OpenAI calls
 * stay inside the impl files.
 *
 * Per `feedback_no_silent_vendor_lock.md`: lib/knowledge/openai-embedding.ts
 * is the only file that talks to OpenAI; lib/knowledge/pgvector-store.ts
 * is the only file that issues pgvector SQL. Nothing else imports either.
 *
 * Per `feedback_runner_portability.md` + `project_living_portable_architecture.md`:
 * each interface has TWO implementations (production + test). The two-impl
 * rule for the substrate is satisfied by:
 *   - `IEmbeddingProvider` → OpenAIEmbeddingProvider + TestEmbeddingProvider
 *   - `IKnowledgeStore`    → PgvectorKnowledgeStore + TestKnowledgeStore
 *
 * Per `project_no_outbound_architecture.md`: this layer reads + writes
 * durable state. It does not place outbound calls on the customer's
 * behalf. The OpenAI embedding call is an INBOUND fetch of vector bytes,
 * not an outbound message — it conforms to the receive-shape carve-out.
 */

import type { ContextKind } from '@prisma/client';

export type { ContextKind };

// ── Result shape ─────────────────────────────────────────────────────────

export type KnowledgeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: KnowledgeError };

export type KnowledgeErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'NOT_FOUND'
  | 'NOT_IMPLEMENTED'
  | 'CUSTOMER_REQUIRES_WORKSPACE'
  | 'NON_CUSTOMER_HAS_WORKSPACE'
  | 'DIMENSION_MISMATCH';

export interface KnowledgeError {
  code: KnowledgeErrorCode;
  message: string;
  status?: number;
  reference?: string;
}

export function knowledgeOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function knowledgeError(
  code: KnowledgeErrorCode,
  message: string,
  extra?: Omit<KnowledgeError, 'code' | 'message'>,
): { ok: false; error: KnowledgeError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── Embedding provider ──────────────────────────────────────────────────

export interface EmbeddingUsage {
  /** Token count the provider charged for. NULL when the provider does
   *  not return usage (test provider, in particular). */
  promptTokens: number | null;
}

export interface EmbeddingValue {
  vector: number[];
  /** Echo of the model id the provider served. Pinned at upsert time so
   *  later code can detect dim/model drift. */
  model: string;
  usage: EmbeddingUsage;
}

export interface IEmbeddingProvider {
  readonly name: 'openai' | 'test';
  /** Vector dimension this provider emits. Stored on every Embedding row
   *  via metadata for cross-check at search time. */
  readonly dimensions: number;
  /** Model identifier (e.g. `text-embedding-3-small`). The store stamps
   *  this on every embedding row's metadata. */
  readonly model: string;
  embed(text: string): Promise<KnowledgeResult<EmbeddingValue>>;
}

// ── Knowledge store ─────────────────────────────────────────────────────

export type ContextKindLiteral =
  | 'SKILL'
  | 'CUSTOMER'
  | 'VERTICAL'
  | 'CROSS_CUSTOMER'
  | 'COMPLIANCE';

/**
 * Upsert input. `workspaceId` is required when `contextKind = 'CUSTOMER'`
 * and FORBIDDEN otherwise. The store enforces this at the application
 * layer; the Postgres CHECK constraint enforces it at the database layer.
 *
 * `sourceType` + `sourceId` form the natural key. For doc-shaped knowledge
 * (the V1 default), the store derives both: sourceType="knowledge_document"
 * and sourceId=<the freshly-minted KnowledgeDocument.id>. Callers
 * embedding non-doc records (a HandoffLogEntry, a Briefing snippet) pass
 * the pair explicitly.
 */
export interface KnowledgeUpsertInput {
  contextKind: ContextKind;
  workspaceId?: string | null;
  title: string;
  body: string;
  sourceUrl?: string | null;
  verticalSlug?: string | null;
  metadata?: Record<string, unknown>;
  /** Optional natural-key override. Defaults to `knowledge_document`
   *  + freshly-minted document id. */
  sourceType?: string;
  sourceId?: string;
  /** Pre-computed vector. Skip the embedder call when present (e.g. seed
   *  pass that batched embeddings via the provider's batch API). */
  vector?: number[];
}

export interface KnowledgeUpsertResult {
  /** Embedding.id. */
  id: string;
  /** KnowledgeDocument.id when the upsert created a document (V1
   *  always). Null only if a future caller upserts an embedding against
   *  an existing row not backed by a doc. */
  documentId: string | null;
  /** Echo of the model id the embedder reported. */
  model: string;
  /** True when this call created a new row; false when it updated an
   *  existing (sourceType, sourceId) row. */
  created: boolean;
}

export interface KnowledgeSearchInput {
  /** Plain-text query. The store embeds it through `IEmbeddingProvider`.
   *  Caller does NOT pass a pre-embedded vector — keep the search API
   *  symmetric so the MCP route doesn't have to know the embedder. */
  query: string;
  /** Top-k. Default 10. Capped at 100 to bound the response payload. */
  k?: number;
  /** Subset of context kinds to return. Default: all. */
  contextKinds?: ContextKind[];
  /** When set, only return rows whose KnowledgeDocument.verticalSlug
   *  matches (NULL verticalSlug rows are EXCLUDED). Used for vertical-
   *  scoped lookups in the categorize / draft skills. */
  verticalSlug?: string | null;
}

export interface KnowledgeSearchHit {
  embeddingId: string;
  documentId: string | null;
  contextKind: ContextKind;
  workspaceId: string | null;
  title: string;
  body: string;
  sourceUrl: string | null;
  verticalSlug: string | null;
  metadata: Record<string, unknown>;
  /** Cosine distance (0 = identical, 2 = opposite). */
  distance: number;
  /** Cosine similarity (1 = identical, -1 = opposite). Cached so callers
   *  don't compute it themselves on every hit. */
  similarity: number;
}

export interface KnowledgeDeleteInput {
  /** Delete a specific embedding row (and its document if cascade applies). */
  embeddingId?: string;
  /** Delete a document and all its embeddings. */
  documentId?: string;
  /**
   * Delete every CUSTOMER-kind document + embedding for a (workspaceId,
   * source name) pair. The store matches `metadata->>'source'` against
   * `sourceName` so disconnecting an integration only purges that
   * integration's ingested rows — other sources (other connectors,
   * fixtures, future channels) stay intact. Embeddings cascade via the
   * Embedding.documentId → KnowledgeDocument.id FK
   * (`prisma/migrations/20260512000000_add_knowledge_substrate/migration.sql`
   * line 82, `ON DELETE CASCADE`).
   */
  byWorkspaceAndSource?: {
    workspaceId: string;
    sourceName: string;
  };
  /**
   * Drive-tombstone reaper variant. Delete every CUSTOMER doc for
   * (workspaceId, sourceName) whose stored `metadata->>'fileId'` is NOT
   * in `liveFileIds`. Used after a complete source listing so customer
   * deletes/trash on the provider propagate into our store.
   */
  byWorkspaceAndTombstone?: {
    workspaceId: string;
    sourceName: string;
    liveFileIds: string[];
  };
  /**
   * Workspace teardown variant — delete every CUSTOMER-kind doc +
   * embedding for the workspace regardless of source. Other context
   * kinds (SKILL / VERTICAL / CROSS_CUSTOMER / COMPLIANCE) are
   * shared-substrate and stay put.
   */
  allWorkspaceCustomerDocs?: {
    workspaceId: string;
  };
}

export interface IKnowledgeStore {
  readonly name: 'pgvector' | 'test';
  /** Vector dimension this store enforces on writes. MUST match the
   *  embedder's `dimensions` — the factory checks at construction. */
  readonly dimensions: number;
  upsert(input: KnowledgeUpsertInput): Promise<KnowledgeResult<KnowledgeUpsertResult>>;
  search(input: KnowledgeSearchInput): Promise<KnowledgeResult<KnowledgeSearchHit[]>>;
  delete(input: KnowledgeDeleteInput): Promise<KnowledgeResult<{ deleted: number }>>;
}
