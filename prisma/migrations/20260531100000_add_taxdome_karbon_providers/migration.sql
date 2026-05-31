-- Add TAXDOME + KARBON to the IntegrationProvider enum (wave 5).
-- Both are CPA-vertical API-key integrations: the firm pastes a static
-- key (TaxDome) or a Bearer+AccessKey pair (Karbon) on the connect
-- form, and the credential is persisted with `refreshTokenEncrypted =
-- NULL` and `expiresAt` pinned far in the future. Neither rotates.
--
-- Per `feedback_no_silent_vendor_lock.md`: the REST seams live at
--   - lib/integrations/taxdome-mcp/server.ts
--   - lib/integrations/karbon-mcp/server.ts
-- The skill layer speaks only the MCP interface.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'TAXDOME';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'KARBON';
