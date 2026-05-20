-- Add three OAuth-connected integration providers for the DocuSign, QuickBooks
-- Online, and Slack MCP servers. Google Drive reuses the GOOGLE provider (it
-- shares the Gmail Google OAuth app and credential), so it has no enum value.
-- See lib/integrations/{docusign,quickbooks,slack}-mcp/ + the marketplace catalog.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'DOCUSIGN';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'QUICKBOOKS';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'SLACK';

-- Non-secret, per-account routing data (DocuSign base_uri + API account id,
-- QuickBooks realmId + environment, Slack team id/name). NULL for providers
-- that need none. Tokens stay in the encrypted columns; never here.
ALTER TABLE "IntegrationCredential" ADD COLUMN IF NOT EXISTS "providerMetadata" JSONB;
