/**
 * lib/knowledge/test-store.ts
 *
 * In-memory `IKnowledgeStore`. Satisfies the two-implementation rule
 * per `feedback_runner_portability.md` + `project_living_portable_architecture.md`.
 *
 * Same workspace-isolation contract as the pgvector store: customer
 * queries see their own + non-customer-scoped rows. Workspace context
 * is set via `setWorkspaceContext()` (the test analog of
 * `lib/db/rls.ts` GUC seeding). Operator context is the default.
 *
 * Brute-force cosine search over the row list — fine at the test scale
 * (≤ 1000 rows); not a real ANN index.
 */

import { randomUUID } from 'node:crypto';
import type { ContextKind } from '@prisma/client';
import {
  IEmbeddingProvider,
  IKnowledgeStore,
  KnowledgeDeleteInput,
  KnowledgeResult,
  KnowledgeSearchHit,
  KnowledgeSearchInput,
  KnowledgeUpsertInput,
  KnowledgeUpsertResult,
  knowledgeError,
  knowledgeOk,
} from './types';

interface StoredDoc {
  id: string;
  contextKind: ContextKind;
  workspaceId: string | null;
  title: string;
  body: string;
  sourceUrl: string | null;
  verticalSlug: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredEmbedding {
  id: string;
  documentId: string | null;
  sourceType: string;
  sourceId: string;
  workspaceId: string | null;
  contextKind: ContextKind;
  metadata: Record<string, unknown>;
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestKnowledgeStoreContext {
  workspaceId: string | null;
  isOperator: boolean;
}

export const TEST_OPERATOR_CONTEXT: TestKnowledgeStoreContext = {
  workspaceId: null,
  isOperator: true,
};

export class TestKnowledgeStore implements IKnowledgeStore {
  readonly name = 'test' as const;
  readonly dimensions: number;
  private readonly embedder: IEmbeddingProvider;
  private readonly docs = new Map<string, StoredDoc>();
  private readonly embeddings = new Map<string, StoredEmbedding>();
  private readonly bySource = new Map<string, string>(); // `${sourceType}:${sourceId}` → embeddingId
  private context: TestKnowledgeStoreContext = TEST_OPERATOR_CONTEXT;

  constructor(embedder: IEmbeddingProvider) {
    this.embedder = embedder;
    this.dimensions = embedder.dimensions;
  }

  /** Test analog of `withRls(ctx, ...)` — sets the visibility context for
   *  subsequent search() calls. */
  setContext(ctx: TestKnowledgeStoreContext): void {
    this.context = { workspaceId: ctx.workspaceId, isOperator: ctx.isOperator };
  }

  async upsert(input: KnowledgeUpsertInput): Promise<KnowledgeResult<KnowledgeUpsertResult>> {
    const validation = validateContextWorkspaceFit(input.contextKind, input.workspaceId ?? null);
    if (!validation.ok) return validation;

    const sourceType = input.sourceType ?? 'knowledge_document';
    const documentId = randomUUID();
    const sourceId = input.sourceId ?? documentId;

    let vector = input.vector;
    if (!vector) {
      const emb = await this.embedder.embed(input.body);
      if (!emb.ok) return emb;
      vector = emb.value.vector;
    }
    if (vector.length !== this.dimensions) {
      return knowledgeError(
        'DIMENSION_MISMATCH',
        `Vector length ${vector.length} != store dimensions ${this.dimensions}.`,
      );
    }

    const now = new Date();
    const doc: StoredDoc = {
      id: documentId,
      contextKind: input.contextKind,
      workspaceId: input.workspaceId ?? null,
      title: input.title,
      body: input.body,
      sourceUrl: input.sourceUrl ?? null,
      verticalSlug: input.verticalSlug ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.docs.set(documentId, doc);

    const naturalKey = `${sourceType}:${sourceId}`;
    const existingId = this.bySource.get(naturalKey);
    let created = true;
    let embeddingId: string;
    if (existingId) {
      // Update the existing embedding row in place; replace document link too.
      const existing = this.embeddings.get(existingId);
      if (existing) {
        // Remove the prior document if any (mirrors pgvector cascade-ish behavior).
        if (existing.documentId && existing.documentId !== documentId) {
          this.docs.delete(existing.documentId);
        }
        const updated: StoredEmbedding = {
          ...existing,
          documentId,
          workspaceId: input.workspaceId ?? null,
          contextKind: input.contextKind,
          metadata: { ...existing.metadata, ...input.metadata, model: this.embedder.model },
          vector: vector.slice(),
          updatedAt: now,
        };
        this.embeddings.set(existingId, updated);
        embeddingId = existingId;
        created = false;
      } else {
        embeddingId = randomUUID();
      }
    } else {
      embeddingId = randomUUID();
    }

    if (created) {
      const row: StoredEmbedding = {
        id: embeddingId,
        documentId,
        sourceType,
        sourceId,
        workspaceId: input.workspaceId ?? null,
        contextKind: input.contextKind,
        metadata: { ...(input.metadata ?? {}), model: this.embedder.model },
        vector: vector.slice(),
        createdAt: now,
        updatedAt: now,
      };
      this.embeddings.set(embeddingId, row);
      this.bySource.set(naturalKey, embeddingId);
    }

    return knowledgeOk({
      id: embeddingId,
      documentId,
      model: this.embedder.model,
      created,
    });
  }

  async search(input: KnowledgeSearchInput): Promise<KnowledgeResult<KnowledgeSearchHit[]>> {
    const k = clampK(input.k);
    const emb = await this.embedder.embed(input.query);
    if (!emb.ok) return emb;
    const q = emb.value.vector;
    if (q.length !== this.dimensions) {
      return knowledgeError(
        'DIMENSION_MISMATCH',
        `Query vector length ${q.length} != store dimensions ${this.dimensions}.`,
      );
    }
    const wanted = input.contextKinds && input.contextKinds.length > 0 ? new Set(input.contextKinds) : null;
    const hits: KnowledgeSearchHit[] = [];
    for (const e of this.embeddings.values()) {
      if (!visible(e.workspaceId, this.context)) continue;
      if (wanted && !wanted.has(e.contextKind)) continue;
      const doc = e.documentId ? this.docs.get(e.documentId) : null;
      if (input.verticalSlug != null) {
        if (!doc) continue;
        if (doc.verticalSlug !== input.verticalSlug) continue;
      }
      const distance = cosineDistance(q, e.vector);
      const similarity = 1 - distance;
      hits.push({
        embeddingId: e.id,
        documentId: e.documentId,
        contextKind: e.contextKind,
        workspaceId: e.workspaceId,
        title: doc?.title ?? '',
        body: doc?.body ?? '',
        sourceUrl: doc?.sourceUrl ?? null,
        verticalSlug: doc?.verticalSlug ?? null,
        metadata: { ...(doc?.metadata ?? {}), ...e.metadata },
        distance,
        similarity,
      });
    }
    hits.sort((a, b) => a.distance - b.distance);
    return knowledgeOk(hits.slice(0, k));
  }

  async delete(input: KnowledgeDeleteInput): Promise<KnowledgeResult<{ deleted: number }>> {
    let deleted = 0;
    if (input.embeddingId) {
      const e = this.embeddings.get(input.embeddingId);
      if (e) {
        this.embeddings.delete(e.id);
        this.bySource.delete(`${e.sourceType}:${e.sourceId}`);
        if (e.documentId) this.docs.delete(e.documentId);
        deleted = 1;
      }
      return knowledgeOk({ deleted });
    }
    if (input.documentId) {
      const doc = this.docs.get(input.documentId);
      if (doc) {
        this.docs.delete(doc.id);
        for (const e of Array.from(this.embeddings.values())) {
          if (e.documentId === doc.id) {
            this.embeddings.delete(e.id);
            this.bySource.delete(`${e.sourceType}:${e.sourceId}`);
            deleted += 1;
          }
        }
      }
      return knowledgeOk({ deleted });
    }
    if (input.byWorkspaceAndSource) {
      const { workspaceId, sourceName } = input.byWorkspaceAndSource;
      const docIds = new Set<string>();
      for (const doc of this.docs.values()) {
        if (doc.contextKind !== 'CUSTOMER') continue;
        if (doc.workspaceId !== workspaceId) continue;
        if (readSource(doc.metadata) !== sourceName) continue;
        docIds.add(doc.id);
      }
      return knowledgeOk({ deleted: this.dropDocs(docIds) });
    }
    if (input.byWorkspaceAndTombstone) {
      const { workspaceId, sourceName, liveFileIds } = input.byWorkspaceAndTombstone;
      const live = new Set(liveFileIds);
      const docIds = new Set<string>();
      for (const doc of this.docs.values()) {
        if (doc.contextKind !== 'CUSTOMER') continue;
        if (doc.workspaceId !== workspaceId) continue;
        if (readSource(doc.metadata) !== sourceName) continue;
        const fileId = readFileId(doc.metadata);
        // No fileId in metadata = can't classify tombstoned; skip.
        if (fileId === null) continue;
        if (live.has(fileId)) continue;
        docIds.add(doc.id);
      }
      return knowledgeOk({ deleted: this.dropDocs(docIds) });
    }
    if (input.allWorkspaceCustomerDocs) {
      const { workspaceId } = input.allWorkspaceCustomerDocs;
      const docIds = new Set<string>();
      for (const doc of this.docs.values()) {
        if (doc.contextKind !== 'CUSTOMER') continue;
        if (doc.workspaceId !== workspaceId) continue;
        docIds.add(doc.id);
      }
      return knowledgeOk({ deleted: this.dropDocs(docIds) });
    }
    return knowledgeError(
      'INVALID_ARGUMENT',
      'KnowledgeStore.delete requires one of: embeddingId, documentId, byWorkspaceAndSource, byWorkspaceAndTombstone, allWorkspaceCustomerDocs.',
    );
  }

  private dropDocs(docIds: Set<string>): number {
    let deleted = 0;
    for (const id of docIds) {
      this.docs.delete(id);
    }
    for (const e of Array.from(this.embeddings.values())) {
      if (e.documentId && docIds.has(e.documentId)) {
        this.embeddings.delete(e.id);
        this.bySource.delete(`${e.sourceType}:${e.sourceId}`);
        deleted += 1;
      }
    }
    return deleted;
  }
}

function readSource(metadata: Record<string, unknown>): string | null {
  const v = metadata?.source;
  return typeof v === 'string' ? v : null;
}

function readFileId(metadata: Record<string, unknown>): string | null {
  const v = metadata?.fileId;
  return typeof v === 'string' ? v : null;
}

function visible(rowWorkspaceId: string | null, ctx: TestKnowledgeStoreContext): boolean {
  if (ctx.isOperator) return true;
  if (rowWorkspaceId === null) return true;
  return rowWorkspaceId === ctx.workspaceId;
}

function validateContextWorkspaceFit(
  kind: ContextKind,
  workspaceId: string | null,
): KnowledgeResult<true> {
  if (kind === 'CUSTOMER' && !workspaceId) {
    return knowledgeError(
      'CUSTOMER_REQUIRES_WORKSPACE',
      'CUSTOMER context requires a workspaceId.',
    );
  }
  if (kind !== 'CUSTOMER' && workspaceId) {
    return knowledgeError(
      'NON_CUSTOMER_HAS_WORKSPACE',
      `${kind} context must not carry a workspaceId.`,
    );
  }
  return knowledgeOk(true);
}

function clampK(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 10;
  return Math.min(Math.floor(raw), 100);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 1;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return 1 - sim;
}
