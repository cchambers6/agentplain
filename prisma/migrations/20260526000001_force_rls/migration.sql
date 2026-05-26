-- agentplain — FORCE ROW LEVEL SECURITY on every policied table.
--
-- Postgres SKIPS row-level security for the table-OWNER role by default.
-- prisma migrate deploy creates the tables, so they're owned by the
-- migration role. If the application connects as that same role
-- (e.g. Neon's default `neondb_owner`), then every CREATE POLICY in the
-- schema is silently NOT enforced — tenants would see each other's rows.
--
-- The robust fix is `FORCE ROW LEVEL SECURITY` on every policied table.
-- FORCE makes the policies bind even for the table owner. System / cron
-- writes still pass because every policy in this schema carries an
-- `is_operator='true'` branch, which `withSystemContext()` in
-- lib/db/rls.ts sets via `SET LOCAL app.is_operator='true'` before the
-- DML runs.
--
-- The companion source-grep invariant in
-- tests/wave5-multitenant-isolation.test.ts asserts that every table
-- with a CREATE POLICY also has a matching FORCE ROW LEVEL SECURITY
-- statement, so a future policied table cannot ship un-forced.
--
-- Authoritative table list — every model with at least one CREATE POLICY
-- across all prior migrations (24 tables, listed in migration-discovery
-- order):
--
--   phase1_init (20260508000000)
--     1.  Workspace                — workspace_member_read / workspace_operator_write
--     2.  Membership                — membership_workspace_isolation
--     3.  WorkThresholdConfig       — wtc_workspace_isolation
--     4.  WorkApprovalQueueItem     — waqi_workspace_isolation
--     5.  HandoffLogEntry           — handoff_workspace_isolation
--     6.  ComplianceFlag            — flag_workspace_isolation
--     7.  CapabilityProposal        — capability_proposal_operator_only
--     8.  WorkspaceInvoice          — invoice_workspace_isolation
--     9.  AuditLog                  — audit_workspace_read / audit_operator_write
--     10. User                      — user_self_or_operator (R/W)
--     11. MagicLinkToken            — magic_link_self_or_system
--
--   add_vertical_and_onboarding (20260511000000)
--     12. OnboardingState           — onboarding_workspace_isolation
--
--   add_stripe_billing (20260511120000)
--     13. Subscription              — subscription_workspace_isolation
--     14. BillingEvent              — billing_event_workspace_read / billing_event_operator_write
--
--   add_knowledge_substrate (20260512000000)
--     15. KnowledgeDocument         — knowledge_doc_read / knowledge_doc_write
--     16. Embedding                 — embedding_read / embedding_write
--
--   add_inquiry_intake (20260515000000)
--     17. Inquiry                   — inquiry_operator_all
--
--   add_passkey_and_support_routing (20260520000000)
--     18. WebAuthnCredential        — webauthn_self_or_system
--     19. SupportRequest            — support_request_workspace_isolation
--
--   add_workspace_preferences (20260523000000)
--     20. WorkspacePreference       — workspace_preference_read / workspace_preference_write
--     21. PreferenceSignal          — preference_signal_read / preference_signal_write
--
--   add_integration_rls (20260526000000)
--     22. IntegrationCredential     — integration_credential_workspace_isolation
--     23. WebhookSubscription       — webhook_subscription_workspace_isolation
--     24. WebhookEvent              — webhook_event_workspace_isolation

ALTER TABLE "Workspace"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "Membership"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "WorkThresholdConfig"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "WorkApprovalQueueItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "HandoffLogEntry"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceFlag"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "CapabilityProposal"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceInvoice"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "User"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "MagicLinkToken"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingState"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "BillingEvent"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeDocument"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "Embedding"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "Inquiry"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebAuthnCredential"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "SupportRequest"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "WorkspacePreference"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "PreferenceSignal"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationCredential" FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebhookSubscription"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent"          FORCE ROW LEVEL SECURITY;
