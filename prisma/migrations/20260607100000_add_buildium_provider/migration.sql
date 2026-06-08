-- Property-management vertical: Buildium integration (keystone
-- "port exists, adapter does not" wave). Buildium authenticates with a
-- client-id + client-secret pair (no OAuth, no refresh) — the same
-- API-key credential pattern as FOLLOW_UP_BOSS / TAXDOME / KARBON. The
-- secret is stored in IntegrationCredential.accessTokenEncrypted; the
-- non-secret client id rides in providerMetadata.clientId. The MCP server
-- lives at lib/integrations/buildium-mcp/ and backs the RentRollLookup
-- port consumed by the property-management-rent-collection-chase skill.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'BUILDIUM';
