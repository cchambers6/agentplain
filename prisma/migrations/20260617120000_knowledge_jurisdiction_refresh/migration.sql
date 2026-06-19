-- Knowledge substrate: jurisdiction-awareness + corpus update-detection.
--
-- Additive + nullable only — no backfill, safe to apply online. Existing
-- rows read NULL for every new column, which the retrieval path treats as
-- "jurisdiction-agnostic, always eligible" (lib/knowledge/pgvector-store.ts
-- #search), so behaviour is unchanged for pre-existing knowledge.
--
--   jurisdiction  state/federal scope ("GA", "US") for the rule corpus.
--   sourceKey     stable corpus ingestion natural key (refresh diffs by it).
--   contentHash   SHA-256 of normalized body; drives re-embed-vs-skip.
--   lastSeenAt    last confirmed present at source (refresh sweep).
--   supersededAt  set when a refresh finds the source content gone/replaced.

ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "jurisdiction" TEXT,
  ADD COLUMN "sourceKey"    TEXT,
  ADD COLUMN "contentHash"  TEXT,
  ADD COLUMN "lastSeenAt"   TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3);

CREATE INDEX "KnowledgeDocument_contextKind_jurisdiction_idx"
  ON "KnowledgeDocument"("contextKind", "jurisdiction");

CREATE INDEX "KnowledgeDocument_sourceKey_idx"
  ON "KnowledgeDocument"("sourceKey");
