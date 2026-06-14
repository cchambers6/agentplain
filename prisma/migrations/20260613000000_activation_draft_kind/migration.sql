-- First-5-min activation. Adds the ACTIVATION_DRAFT approval kind produced
-- once per workspace by lib/onboarding/activation-run.ts so a brand-new
-- customer sees Plaino draft real work (against a clearly-labelled demo
-- dataset) within their first five minutes. Draft-only by contract; the
-- /welcome surface lets the owner approve in one click.
--
-- Additive enum value only — representable in schema.prisma, so no
-- schema-drift-baseline entry is needed (cf. raw-SQL index migrations).
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ACTIVATION_DRAFT';
