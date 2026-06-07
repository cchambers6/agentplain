-- LeadCapture: track the Claude-for-Small-Business comparison-prospect cohort.
-- (feat/sbm-wrapper-positioning-2026-06-06)
--
-- Per project_sbm_wrapper_positioning_2026_06_06: agentplain is the service
-- layer that makes Claude SBM usable, not a competitor. Prospects who arrive
-- asking "why not just use Claude" are a distinct cohort worth tracking, so
-- the operator can see how the wrapper positioning lands.
--
-- `askedAboutClaude` is set at capture time — either from an explicit widget
-- flag or by scanning the linked PlainoConversation's turns for Claude /
-- Anthropic mentions (lib/leads). The column is created WITH `DEFAULT false`
-- to match the `@default(false)` in schema.prisma, so `prisma migrate diff`
-- stays empty and this migration adds ZERO new drift-baseline entries.

ALTER TABLE "LeadCapture"
  ADD COLUMN "askedAboutClaude" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "LeadCapture_askedAboutClaude_createdAt_idx"
  ON "LeadCapture"("askedAboutClaude", "createdAt");
