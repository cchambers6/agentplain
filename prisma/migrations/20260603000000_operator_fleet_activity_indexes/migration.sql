-- agentplain — indexes powering the /operator/fleet activity inspector (Stream D.1).
--
-- The inspector turns the thin fleet page into a real cross-workspace activity
-- feed: the newest agent actions across EVERY workspace, filterable by
-- workspace / skill / agent / discipline / status / time, with free-text
-- search. Two index families make that query family cheap:
--
--   1. Feed ordering. The feed reads "newest N SkillRuns across all
--      workspaces ordered by firedAt DESC". The pre-existing SkillRun indexes
--      are all workspaceId-leading (built for the per-discipline scorecard),
--      so a cross-workspace ORDER BY firedAt would fall back to a full scan +
--      sort. This firedAt-leading index serves both the cross-workspace feed
--      and workspace-filtered variants. Declared in schema.prisma; the CREATE
--      below uses the Prisma-canonical name so it round-trips cleanly.
--
--   2. Free-text search. The search box matches against skillSlug, discipline,
--      errorMessage (SkillRun) and agentSlug (WorkApprovalQueueItem). These
--      are substring (`ILIKE %term%`) matches, which a btree cannot serve.
--      pg_trgm GIN indexes make them index-backed so search stays well under
--      the p95 < 500ms bar as the audit tables grow. NOTE: the encrypted
--      WorkApprovalQueueItem.payload (draft bodies, PII) is deliberately NOT
--      indexed — it is AES-GCM ciphertext at rest (lib/security/payload-crypto)
--      and is not server-side searchable by design. Search covers slugs,
--      discipline, agent, and error text only.
--
-- These indexes add no tables and no RLS policies, so the FORCE-ROW-LEVEL
-- SECURITY invariant (tests/wave5-multitenant-isolation.test.ts) is untouched.

-- 1. Cross-workspace feed ordering (declared in schema.prisma).
CREATE INDEX IF NOT EXISTS "SkillRun_firedAt_workspaceId_idx"
  ON "SkillRun" ("firedAt" DESC, "workspaceId");

-- 2. Trigram free-text search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "SkillRun_skillSlug_trgm_idx"
  ON "SkillRun" USING gin ("skillSlug" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "SkillRun_discipline_trgm_idx"
  ON "SkillRun" USING gin ("discipline" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "SkillRun_errorMessage_trgm_idx"
  ON "SkillRun" USING gin ("errorMessage" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "WorkApprovalQueueItem_agentSlug_trgm_idx"
  ON "WorkApprovalQueueItem" USING gin ("agentSlug" gin_trgm_ops);
