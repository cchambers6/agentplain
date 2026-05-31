-- Wave-4 phase 2 — additional realty CRM integrations. Sierra
-- Interactive ships fully wired (lib/integrations/sierra-mcp/, API-key
-- auth via Authorization: Bearer). BoldTrail's enum lands too so the
-- IntegrationProvider taxonomy matches the marketplace's `coming-soon`
-- BoldTrail entry — flipping BoldTrail on once the partner enrollment
-- completes will not require another migration.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'SIERRA_INTERACTIVE';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'BOLDTRAIL';
