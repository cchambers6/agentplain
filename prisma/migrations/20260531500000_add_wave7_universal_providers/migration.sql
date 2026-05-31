-- Wave-7 universal MCPs. HubSpot, Salesforce, and Notion all ship as
-- customer-installable across every vertical. The IntegrationProvider
-- enum gains three new values:
--   HUBSPOT     — OAuth2 + long-lived refresh tokens; hub id on
--                 providerMetadata.hubId. MCP at lib/integrations/hubspot-mcp/.
--   SALESFORCE  — OAuth2 + instance URL discovery; instance host on
--                 providerMetadata.instanceUrl. MCP at lib/integrations/salesforce-mcp/.
--                 Customer-installed dev apps work without partner
--                 enrollment; production AppExchange distribution requires
--                 Connected App security review.
--   NOTION      — Workspace-scoped OAuth; access token never expires
--                 (no refresh path). MCP at lib/integrations/notion-mcp/.
--                 Connect fires an inngest event that ingests pages into
--                 the knowledge substrate (pgvector-indexed) so
--                 research-on-demand has real customer context immediately.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'HUBSPOT';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'SALESFORCE';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'NOTION';
