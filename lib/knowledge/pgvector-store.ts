/**
 * lib/knowledge/pgvector-store.ts
 *
 * Postgres + pgvector implementation of `IKnowledgeStore`. The only file
 * in the codebase that issues `vector` SQL — every other caller speaks
 * the `IKnowledgeStore` interface. Per `feedback_no_silent_vendor_lock.md`
 * + `project_living_portable_architecture.md`, swapping to Pinecone /
 * Weaviate / Qdrant later is "implement a second `IKnowledgeStore`",
 * not a rewrite.
 *
 * Every method runs inside `withRls(ctx, ...)` so the workspace-id +
 * is-operator GUCs the migration's RLS policies read are always set.
 * The store carries its `RlsContext` from construction — the
 * MCP route builds a per-request store, the seed script builds a
 * system-context store.
 *
 * The vector column is `Unsupported("vector(1536)")` per the schema.
 * Prisma's generated client can't read or write it through the typed
 * model API, so we use `$queryRawUnsafe` / `$executeRawUnsafe` with
 * parameter binding for everything that touches the column.
 *
 * Distance operator: `<=>` (cosine distance) per
 * https://github.com/pgvector/pgvector#querying (read 2026-05-12).
 * Lower = more similar; `1 - <=>` = cosine similarity.
 */

import type { ContextKind, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';
import { RlsContext, withRls } from '../db/rls';
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

export interface PgvectorKnowledgeStoreConfig {
  embedder: IEmbeddingProvider;
  rlsContext: RlsContext;
  client?: PrismaClient;
}

export class PgvectorKnowledgeStore implements IKnowledgeStore {
  readonly name = 'pgvector' as const;
  readonly dimensions: number;
  private readonly embedder: IEmbeddingProvider;
  private readonly rlsContext: RlsContext;
  private readonly client: PrismaClient;

  constructor(config: PgvectorKnowledgeStoreConfig) {
    this.embedder = config.embedder;
    this.rlsContext = config.rlsContext;
    this.client = config.client ?? prisma;
    this.dimensions = config.embedder.dimensions;
  }

  async upsert(input: KnowledgeUpsertInput): Promise<KnowledgeResult<KnowledgeUpsertResult>> {
    const validation = validateContextWorkspaceFit(input.contextKind, input.workspaceId ?? null);
    if (!validation.ok) return validation;

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
    const sourceType = input.sourceType ?? 'knowledge_document';
    const literal = pgvectorLiteral(vector);
    const metadata = { ...(input.metadata ?? {}), model: this.embedder.model };

    try {
      const result = await withRls(
        this.rlsContext,
        async (tx) => {
          // Insert (or update) the document FIRST. We always create a fresh
          // KnowledgeDocument so an update of (sourceType, sourceId) replaces
          // both rows atomically — simpler than maintaining doc-by-naturalKey.
          const existing = await tx.embedding.findUnique({
            where: { sourceType_sourceId: { sourceType, sourceId: input.sourceId ?? '' } },
            select: { id: true, documentId: true },
          });

          // If there's no upstream natural key (typical for fresh upserts of
          // knowledge_document), sourceId defaults to the new doc id.
          const explicitSourceId = input.sourceId && input.sourceId.length > 0;
          if (!explicitSourceId && sourceType === 'knowledge_document') {
            const created = await tx.knowledgeDocument.create({
              data: {
                contextKind: input.contextKind,
                workspaceId: input.workspaceId ?? null,
                title: input.title,
                body: input.body,
                sourceUrl: input.sourceUrl ?? null,
                verticalSlug: input.verticalSlug ?? null,
                metadata: metadata as object,
              },
              select: { id: true },
            });
            const embId = await tx.$queryRawUnsafe<Array<{ id: string }>>(
              `INSERT INTO "Embedding"
                 ("documentId", "sourceType", "sourceId", "workspaceId", "contextKind", "metadata", "vector", "updatedAt")
               VALUES
                 ($1::uuid, $2, $3, $4::uuid, $5::"ContextKind", $6::jsonb, $7::vector, CURRENT_TIMESTAMP)
               RETURNING id::text`,
              created.id,
              sourceType,
              created.id,
              input.workspaceId ?? null,
              input.contextKind,
              JSON.stringify(metadata),
              literal,
            );
            return {
              id: embId[0].id,
              documentId: created.id,
              created: true,
            };
          }

          // sourceId provided — UPDATE path if exists, otherwise INSERT.
          const sId = input.sourceId as string;
          if (existing) {
            // Replace the doc and the vector in one transaction.
            const doc = await tx.knowledgeDocument.upsert({
              where: { id: existing.documentId ?? '00000000-0000-0000-0000-000000000000' },
              create: {
                id: existing.documentId ?? undefined,
                contextKind: input.contextKind,
                workspaceId: input.workspaceId ?? null,
                title: input.title,
                body: input.body,
                sourceUrl: input.sourceUrl ?? null,
                verticalSlug: input.verticalSlug ?? null,
                metadata: metadata as object,
              },
              update: {
                contextKind: input.contextKind,
                workspaceId: input.workspaceId ?? null,
                title: input.title,
                body: input.body,
                sourceUrl: input.sourceUrl ?? null,
                verticalSlug: input.verticalSlug ?? null,
                metadata: metadata as object,
              },
              select: { id: true },
            });
            await tx.$executeRawUnsafe(
              `UPDATE "Embedding"
                  SET "documentId" = $1::uuid,
                      "workspaceId" = $2::uuid,
                      "contextKind" = $3::"ContextKind",
                      "metadata" = $4::jsonb,
                      "vector" = $5::vector,
                      "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $6::uuid`,
              doc.id,
              input.workspaceId ?? null,
              input.contextKind,
              JSON.stringify(metadata),
              literal,
              existing.id,
            );
            return { id: existing.id, documentId: doc.id, created: false };
          }

          // INSERT path (sourceId provided but no existing row).
          const created = await tx.knowledgeDocument.create({
            data: {
              contextKind: input.contextKind,
              workspaceId: input.workspaceId ?? null,
              title: input.title,
              body: input.body,
              sourceUrl: input.sourceUrl ?? null,
              verticalSlug: input.verticalSlug ?? null,
              metadata: metadata as object,
            },
            select: { id: true },
          });
          const embId = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `INSERT INTO "Embedding"
               ("documentId", "sourceType", "sourceId", "workspaceId", "contextKind", "metadata", "vector", "updatedAt")
             VALUES
               ($1::uuid, $2, $3, $4::uuid, $5::"ContextKind", $6::jsonb, $7::vector, CURRENT_TIMESTAMP)
             RETURNING id::text`,
            created.id,
            sourceType,
            sId,
            input.workspaceId ?? null,
            input.contextKind,
            JSON.stringify(metadata),
            literal,
          );
          return { id: embId[0].id, documentId: created.id, created: true };
        },
        { client: this.client },
      );
      return knowledgeOk({
        id: result.id,
        documentId: result.documentId,
        model: this.embedder.model,
        created: result.created,
      });
    } catch (err) {
      return knowledgeError(
        'UPSTREAM_ERROR',
        `pgvector upsert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
    const literal = pgvectorLiteral(q);
    const kinds = input.contextKinds && input.contextKinds.length > 0 ? input.contextKinds : null;
    const verticalFilter = input.verticalSlug ?? null;

    // Build a single query with optional filters. Parameter positions:
    //   $1 = pgvector query literal
    //   $2 = k
    //   $3 = jsonb array of allowed context kinds (NULL = no filter)
    //   $4 = verticalSlug (NULL = no filter)
    const sql = `
      SELECT
        e."id"::text                                    AS "embeddingId",
        e."documentId"::text                            AS "documentId",
        e."contextKind"::text                           AS "contextKind",
        e."workspaceId"::text                           AS "workspaceId",
        COALESCE(d."title", '')                         AS "title",
        COALESCE(d."body", '')                          AS "body",
        d."sourceUrl"                                   AS "sourceUrl",
        d."verticalSlug"                                AS "verticalSlug",
        COALESCE(d."metadata", '{}'::jsonb) || e."metadata"
                                                        AS "metadata",
        (e."vector" <=> $1::vector)                     AS "distance"
      FROM "Embedding" e
      LEFT JOIN "KnowledgeDocument" d ON d."id" = e."documentId"
      WHERE
        ($3::text[] IS NULL OR e."contextKind"::text = ANY($3::text[]))
        AND ($4::text IS NULL OR d."verticalSlug" = $4::text)
      ORDER BY e."vector" <=> $1::vector ASC
      LIMIT $2::int
    `;

    try {
      const rows = await withRls(
        this.rlsContext,
        (tx) =>
          tx.$queryRawUnsafe<
            Array<{
              embeddingId: string;
              documentId: string | null;
              contextKind: string;
              workspaceId: string | null;
              title: string;
              body: string;
              sourceUrl: string | null;
              verticalSlug: string | null;
              metadata: Record<string, unknown> | null;
              distance: number | string;
            }>
          >(
            sql,
            literal,
            k,
            kinds === null ? null : kinds.map((k) => String(k)),
            verticalFilter,
          ),
        { client: this.client },
      );
      const hits: KnowledgeSearchHit[] = rows.map((r) => {
        const distance = typeof r.distance === 'number' ? r.distance : Number(r.distance);
        return {
          embeddingId: r.embeddingId,
          documentId: r.documentId,
          contextKind: r.contextKind as ContextKind,
          workspaceId: r.workspaceId,
          title: r.title,
          body: r.body,
          sourceUrl: r.sourceUrl,
          verticalSlug: r.verticalSlug,
          metadata: (r.metadata ?? {}) as Record<string, unknown>,
          distance,
          similarity: 1 - distance,
        };
      });
      return knowledgeOk(hits);
    } catch (err) {
      return knowledgeError(
        'UPSTREAM_ERROR',
        `pgvector search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(input: KnowledgeDeleteInput): Promise<KnowledgeResult<{ deleted: number }>> {
    const hasShape =
      !!input.embeddingId ||
      !!input.documentId ||
      !!input.byWorkspaceAndSource ||
      !!input.byWorkspaceAndTombstone ||
      !!input.allWorkspaceCustomerDocs;
    if (!hasShape) {
      return knowledgeError(
        'INVALID_ARGUMENT',
        'KnowledgeStore.delete requires one of: embeddingId, documentId, byWorkspaceAndSource, byWorkspaceAndTombstone, allWorkspaceCustomerDocs.',
      );
    }
    try {
      const deleted = await withRls(
        this.rlsContext,
        async (tx) => {
          if (input.embeddingId) {
            // Look up the doc id first so cascade order matches the spec.
            const row = await tx.embedding.findUnique({
              where: { id: input.embeddingId },
              select: { id: true, documentId: true },
            });
            if (!row) return 0;
            // Delete the doc; ON DELETE CASCADE drops the embedding row too.
            if (row.documentId) {
              await tx.knowledgeDocument.delete({ where: { id: row.documentId } });
              return 1;
            }
            await tx.embedding.delete({ where: { id: row.id } });
            return 1;
          }
          if (input.documentId) {
            // Delete by documentId — cascades to embeddings.
            const before = await tx.embedding.count({ where: { documentId: input.documentId } });
            await tx.knowledgeDocument.delete({ where: { id: input.documentId as string } });
            return before;
          }
          if (input.byWorkspaceAndSource) {
            // Bulk deletion of CUSTOMER docs ingested from one source for
            // one workspace. The CUSTOMER + workspaceId guards are the
            // scope precision the customer-data deletion path requires.
            const { workspaceId, sourceName } = input.byWorkspaceAndSource;
            const docs = await tx.knowledgeDocument.findMany({
              where: {
                contextKind: 'CUSTOMER',
                workspaceId,
                metadata: { path: ['source'], equals: sourceName },
              },
              select: { id: true },
            });
            if (docs.length === 0) return 0;
            const ids = docs.map((d) => d.id);
            const before = await tx.embedding.count({ where: { documentId: { in: ids } } });
            await tx.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
            return before;
          }
          if (input.byWorkspaceAndTombstone) {
            const { workspaceId, sourceName, liveFileIds } = input.byWorkspaceAndTombstone;
            // List the (id, metadata.fileId) pairs scoped to this
            // workspace + source, then drop the ones whose fileId is no
            // longer in the live set the caller passed in.
            const docs = await tx.knowledgeDocument.findMany({
              where: {
                contextKind: 'CUSTOMER',
                workspaceId,
                metadata: { path: ['source'], equals: sourceName },
              },
              select: { id: true, metadata: true },
            });
            if (docs.length === 0) return 0;
            const live = new Set(liveFileIds);
            const ids: string[] = [];
            for (const doc of docs) {
              const meta = (doc.metadata ?? {}) as Record<string, unknown>;
              const fileId = typeof meta.fileId === 'string' ? meta.fileId : null;
              // No fileId in metadata = can't be sure it's tombstoned; skip.
              if (fileId === null) continue;
              if (!live.has(fileId)) ids.push(doc.id);
            }
            if (ids.length === 0) return 0;
            const before = await tx.embedding.count({ where: { documentId: { in: ids } } });
            await tx.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
            return before;
          }
          // allWorkspaceCustomerDocs — workspace-teardown variant.
          const { workspaceId } = input.allWorkspaceCustomerDocs as { workspaceId: string };
          const docs = await tx.knowledgeDocument.findMany({
            where: { contextKind: 'CUSTOMER', workspaceId },
            select: { id: true },
          });
          if (docs.length === 0) return 0;
          const ids = docs.map((d) => d.id);
          const before = await tx.embedding.count({ where: { documentId: { in: ids } } });
          await tx.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
          return before;
        },
        { client: this.client },
      );
      return knowledgeOk({ deleted });
    } catch (err) {
      // Treat "record not found" as a soft delete with deleted=0; surface
      // anything else as upstream error.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('P2025') || msg.toLowerCase().includes('not found')) {
        return knowledgeOk({ deleted: 0 });
      }
      return knowledgeError('UPSTREAM_ERROR', `pgvector delete failed: ${msg}`);
    }
  }
}

/** Format a JS number[] as a pgvector literal string: `[0.1,0.2,...]`. */
export function pgvectorLiteral(vector: number[]): string {
  // pgvector accepts the literal as `'[f1,f2,...]'::vector`. We emit the
  // bracketed form without quotes; the SQL cast handles quoting via the
  // parameter binding.
  return `[${vector.map((n) => (Number.isFinite(n) ? n.toString() : '0')).join(',')}]`;
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
