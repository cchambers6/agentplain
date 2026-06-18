-- ===================================================================
-- MANUAL MIGRATION — Embedding HASH partitioning by workspaceId
-- ===================================================================
--
-- ⚠️  DO NOT place this in prisma/migrations/. It is NOT auto-applied by
--     `prisma migrate deploy`. It rewrites the Embedding table and requires
--     a maintenance window + DBA review + a companion application change.
--     See docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.
--
-- WHY PARTITION
-- -------------
-- At 10K customers the Embedding table dominates the vector workload. Hash-
-- partitioning by workspaceId gives:
--   * Partition pruning — a workspace-scoped ANN query touches one partition,
--     not the whole table (smaller ivfflat/hnsw scans).
--   * Cleaner ops — per-partition VACUUM / REINDEX / backup; a single hot
--     tenant's churn doesn't bloat everyone's index.
--   * Smaller per-partition indexes — ivfflat list quality degrades on huge
--     tables; N smaller indexes stay in their sweet spot longer.
--
-- WHY HASH, NOT LIST-PER-WORKSPACE
-- --------------------------------
-- LIST partitioning with one partition per workspace = 10K partitions, which
-- is a known Postgres anti-pattern: planning time grows with partition count
-- and DDL (every ATTACH) becomes a migration. HASH into a FIXED number of
-- partitions (16 here) caps the partition count while still pruning per
-- workspace. 16 is a starting point for the 100→10K range; revisit (32/64)
-- when a single partition's row count approaches the ivfflat rebuild
-- threshold (~1M).
--
-- THE HARD CONSTRAINT (and the companion app change)
-- --------------------------------------------------
-- A partitioned table's PRIMARY KEY and every UNIQUE constraint MUST include
-- the partition column. Embedding today has:
--     PRIMARY KEY ("id")
--     UNIQUE ("sourceType", "sourceId")
-- Both must gain "workspaceId":
--     PRIMARY KEY ("id", "workspaceId")
--     UNIQUE ("sourceType", "sourceId", "workspaceId")
-- The app's upsert path in lib/knowledge/pgvector-store.ts looks rows up by
-- the bare (sourceType, sourceId) natural key:
--     tx.embedding.findUnique({ where: { sourceType_sourceId: {...} } })
-- That call MUST change to the 3-column key (it already has workspaceId in
-- scope on every write). Ship that code change in the SAME release as this
-- migration — the migration without it breaks upsert; the code change
-- without the migration is a no-op. NULL-workspace rows (SKILL / VERTICAL /
-- COMPLIANCE / CROSS_CUSTOMER shared content) hash deterministically to one
-- partition; that's fine for HASH (unlike LIST, no DEFAULT partition needed).
--
-- RLS: policies + FORCE on the partitioned PARENT propagate to every
-- partition automatically (Postgres 11+). We re-declare them below so the
-- new table is born locked.
--
-- ROLLBACK: at the bottom. Until the swap commits, the old table is intact
-- under "Embedding_legacy"; the rollback renames it back.
-- ===================================================================

BEGIN;

-- 1. Park the existing table. Keep it until the swap is verified.
ALTER TABLE "Embedding" RENAME TO "Embedding_legacy";

-- 2. Create the partitioned parent. Same columns; PK + UNIQUE now carry
--    workspaceId. NOTE: a hash-partitioned table cannot have a UNIQUE on a
--    nullable column that excludes the partition key, hence the 3-col key.
CREATE TABLE "Embedding" (
  "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
  "documentId"  UUID,
  "sourceType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "workspaceId" UUID,
  "contextKind" "ContextKind" NOT NULL,
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "vector"      vector(1536) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id", "workspaceId"),
  UNIQUE ("sourceType", "sourceId", "workspaceId")
) PARTITION BY HASH ("workspaceId");

-- 3. 16 hash partitions.
DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE "Embedding_p%s" PARTITION OF "Embedding" FOR VALUES WITH (MODULUS 16, REMAINDER %s)',
      i, i
    );
  END LOOP;
END $$;

-- 4. FK + secondary indexes (created on the parent → propagate to partitions).
ALTER TABLE "Embedding"
  ADD CONSTRAINT "Embedding_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE;
ALTER TABLE "Embedding"
  ADD CONSTRAINT "Embedding_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

CREATE INDEX "Embedding_contextKind_workspaceId_idx" ON "Embedding"("contextKind", "workspaceId");
CREATE INDEX "Embedding_documentId_idx" ON "Embedding"("documentId");

-- ivfflat ANN index per partition (declared on parent). lists=100 per
-- partition is appropriate at the post-split per-partition row count.
CREATE INDEX "Embedding_vector_cosine_idx" ON "Embedding"
  USING ivfflat ("vector" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "Embedding"
  ADD CONSTRAINT "Embedding_customer_requires_workspace_chk"
  CHECK (
    ("contextKind" = 'CUSTOMER' AND "workspaceId" IS NOT NULL)
    OR ("contextKind" <> 'CUSTOMER' AND "workspaceId" IS NULL)
  );

-- 5. Copy the data. (For large tables, do this in batches outside one tx.)
INSERT INTO "Embedding" (
  "id", "documentId", "sourceType", "sourceId", "workspaceId",
  "contextKind", "metadata", "vector", "createdAt", "updatedAt"
)
SELECT
  "id", "documentId", "sourceType", "sourceId", "workspaceId",
  "contextKind", "metadata", "vector", "createdAt", "updatedAt"
FROM "Embedding_legacy";

-- 6. RLS on the partitioned parent (propagates to partitions).
ALTER TABLE "Embedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Embedding" FORCE ROW LEVEL SECURITY;
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

-- 7. Verify row counts match, then drop the legacy table.
DO $$
DECLARE
  old_count BIGINT;
  new_count BIGINT;
BEGIN
  SELECT count(*) INTO old_count FROM "Embedding_legacy";
  SELECT count(*) INTO new_count FROM "Embedding";
  IF old_count <> new_count THEN
    RAISE EXCEPTION 'row count mismatch after copy: legacy=% new=%', old_count, new_count;
  END IF;
END $$;

DROP TABLE "Embedding_legacy";

COMMIT;

-- ANALYZE so the planner has stats for the new partitions.
ANALYZE "Embedding";

-- ===================================================================
-- ROLLBACK (run instead of COMMIT, or as a follow-up if the swap is bad):
--   BEGIN;
--   DROP TABLE "Embedding";              -- drops the partitioned table + parts
--   ALTER TABLE "Embedding_legacy" RENAME TO "Embedding";
--   COMMIT;
-- The companion code change (3-column natural key) must also be reverted.
-- ===================================================================
