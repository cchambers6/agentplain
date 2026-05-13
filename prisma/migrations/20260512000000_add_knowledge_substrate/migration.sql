-- agentplain Phase 2 — Knowledge substrate (project_knowledge_substrate.md).
--
-- Lands the storage layer behind every customer-facing agent's
-- "non-generic" answer. Five context kinds (SKILL / CUSTOMER / VERTICAL
-- / CROSS_CUSTOMER / COMPLIANCE), one Embedding row per source record,
-- pgvector for ANN lookups.
--
-- pgvector extension: confirmed supported on Neon as of 2026-05-12
-- (https://neon.tech/docs/extensions/pgvector — read 2026-05-12). On
-- self-hosted Postgres, the extension ships with the pgvector package.
--
-- Vector dimension 1536 = OpenAI `text-embedding-3-small` (1536 dims,
-- $0.02/1M tokens per the OpenAI pricing page — read 2026-05-12). Same
-- dim as the legacy `text-embedding-ada-002` so a future model swap
-- inside the same dimension is a no-op for storage; a dim change would
-- be a rewrite migration.
--
-- ivfflat vs hnsw: V1 uses ivfflat with `lists = 100` because the seed
-- corpus is small (≤ 100 rows). Per pgvector docs
-- (https://github.com/pgvector/pgvector#ivfflat — read 2026-05-12), the
-- ivfflat rule of thumb is rows/1000 for ≤ 1M rows. At our seed scale
-- this is over-provisioned; the index still serves correctly and we
-- avoid an early rewrite. Swap to hnsw when row count > 100k.
--
-- RLS pattern matches lib/db/rls.ts — three GUCs gate every row.
-- Customer queries see their own (workspaceId match) PLUS every non-
-- customer-scoped row (workspaceId IS NULL). Operator sees everything.

-- =====================================================================
-- EXTENSION
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- ENUM
-- =====================================================================
CREATE TYPE "ContextKind" AS ENUM (
  'SKILL',
  'CUSTOMER',
  'VERTICAL',
  'CROSS_CUSTOMER',
  'COMPLIANCE'
);

-- =====================================================================
-- KNOWLEDGE DOCUMENT
-- =====================================================================
CREATE TABLE "KnowledgeDocument" (
  "id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "contextKind"  "ContextKind" NOT NULL,
  "workspaceId"  UUID REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "title"        TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "sourceUrl"    TEXT,
  "verticalSlug" TEXT,
  "metadata"     JSONB NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);

CREATE INDEX "KnowledgeDocument_contextKind_workspaceId_idx"
  ON "KnowledgeDocument"("contextKind", "workspaceId");

CREATE INDEX "KnowledgeDocument_contextKind_verticalSlug_idx"
  ON "KnowledgeDocument"("contextKind", "verticalSlug");

-- Belt-and-suspenders constraint: CUSTOMER rows MUST have a workspaceId;
-- every other context kind MUST NOT. The RLS policy enforces visibility,
-- this constraint enforces correctness of ingestion.
ALTER TABLE "KnowledgeDocument"
  ADD CONSTRAINT "KnowledgeDocument_customer_requires_workspace_chk"
  CHECK (
    ("contextKind" = 'CUSTOMER' AND "workspaceId" IS NOT NULL)
    OR ("contextKind" <> 'CUSTOMER' AND "workspaceId" IS NULL)
  );

-- =====================================================================
-- EMBEDDING
-- =====================================================================
CREATE TABLE "Embedding" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "documentId"  UUID REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE,
  "sourceType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "workspaceId" UUID REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "contextKind" "ContextKind" NOT NULL,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "vector"      vector(1536) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  UNIQUE ("sourceType", "sourceId")
);

CREATE INDEX "Embedding_contextKind_workspaceId_idx"
  ON "Embedding"("contextKind", "workspaceId");

CREATE INDEX "Embedding_documentId_idx"
  ON "Embedding"("documentId");

-- ivfflat ANN index using cosine distance. Cosine is the standard for
-- text embeddings (https://github.com/pgvector/pgvector#querying —
-- read 2026-05-12). lists=100 is over-provisioned at seed scale and
-- correct at the next two orders of magnitude.
CREATE INDEX "Embedding_vector_cosine_idx"
  ON "Embedding"
  USING ivfflat ("vector" vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE "Embedding"
  ADD CONSTRAINT "Embedding_customer_requires_workspace_chk"
  CHECK (
    ("contextKind" = 'CUSTOMER' AND "workspaceId" IS NOT NULL)
    OR ("contextKind" <> 'CUSTOMER' AND "workspaceId" IS NULL)
  );

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
-- Customer queries can read:
--   * any non-customer row (workspaceId IS NULL — VERTICAL/COMPLIANCE/
--     CROSS_CUSTOMER/SKILL)
--   * their own customer rows (workspaceId matches the GUC)
-- Operator sees everything.
-- Writes are operator-only at the RLS layer; the MCP route additionally
-- gates writes at the application layer (workspace context required for
-- CUSTOMER upserts).

ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_doc_read" ON "KnowledgeDocument"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId" IS NULL
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "knowledge_doc_write" ON "KnowledgeDocument"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

ALTER TABLE "Embedding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "embedding_read" ON "Embedding"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId" IS NULL
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "embedding_write" ON "Embedding"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
