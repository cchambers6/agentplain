-- Wave-1b vertical adapter family — completes the keystone
-- "port exists, adapter does not" finding across insurance / mortgage /
-- title. Each new IntegrationProvider value backs a skill port that until
-- now shipped ONLY its JSON fixture impl:
--
--   EZLYNX    → PolicyLookup        (insurance-coi-request)
--               OAuth2; refresh token rotates. Secret in
--               accessTokenEncrypted; refresh in refreshTokenEncrypted.
--               MCP at lib/integrations/ezlynx-mcp/.
--   ENCOMPASS → LoanFileLookup      (mortgage-document-chase)
--               OAuth2; Encompass instance id on providerMetadata.instanceId.
--               MCP at lib/integrations/encompass-mcp/.
--   QUALIA    → ClosingFileFetcher  (title-escrow-closing-doc-chase)
--               HTTP Basic (no OAuth, no refresh) — same API-key pattern as
--               BUILDIUM / TAXDOME / KARBON. Secret in accessTokenEncrypted;
--               non-secret org id on providerMetadata.orgId.
--               MCP at lib/integrations/qualia-mcp/.
--
-- Each adapter is read-only (project_no_outbound_architecture.md) and gated
-- behind a per-vendor <VENDOR>_ADAPTER_LIVE=on flag (fixtures by default).
--
-- Enum-add migrations need no schema-drift-baseline entry (only raw-SQL
-- index migrations do).
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'EZLYNX';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'ENCOMPASS';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'QUALIA';
