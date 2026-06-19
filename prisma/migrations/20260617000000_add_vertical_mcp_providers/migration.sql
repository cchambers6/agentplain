-- Vertical-MCP scaffold wave (2026-06-17). Adds four new IntegrationProvider
-- enum values for the adapter scaffolds shipped in this PR. Each connector is
-- `coming-soon` in the marketplace until its credential path opens, so no
-- IntegrationCredential rows reference these values yet — the enum members are
-- the "drop the key in" seam Conner activates per connector.
--
-- BoldTrail already has its enum value (added in the wave-4 realty-CRM
-- migration), so it is NOT re-added here.
--
-- Postgres requires ADD VALUE for enum growth; IF NOT EXISTS keeps the
-- migration idempotent across re-applies. See
-- lib/integrations/{clio,mycase,kvcore,appfolio}-mcp/.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'CLIO';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'MYCASE';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'KVCORE';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'APPFOLIO';
