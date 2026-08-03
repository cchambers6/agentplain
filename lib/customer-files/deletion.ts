/**
 * lib/customer-files/deletion.ts
 *
 * Customer-data deletion paths. Three flavors:
 *
 *   1. `deleteIntegrationCustomerData({ workspaceId, providerKey, store })`
 *      Called from `disconnectIntegrationAction`. Deletes the CUSTOMER-kind
 *      KnowledgeDocument + Embedding rows that were ingested for this
 *      workspace from the provider being disconnected. Scoped PRECISELY:
 *      only that workspace + only docs whose `metadata.source` matches a
 *      source name produced by that provider. Does NOT touch other context
 *      kinds (SKILL / VERTICAL / CROSS_CUSTOMER / COMPLIANCE), other
 *      workspaces, or docs sourced from other integrations.
 *
 *   2. `tearDownWorkspaceData(workspaceId)`
 *      Workspace-closure path. Deletes every workspace-scoped tenant row:
 *      CUSTOMER KnowledgeDocument + Embeddings, WorkApprovalQueueItem,
 *      HandoffLogEntry, WebhookEvent, WebhookSubscription,
 *      IntegrationCredential, WorkspacePreference + PreferenceSignal,
 *      onboarding / support / team / storage-config rows, the whole
 *      client-portal tree (PortalConfig and every end-client row hanging
 *      off it), and Inquiry rows whose `convertedWorkspaceId` matches.
 *      Runs under `withSystemContext` so RLS policy `FORCE`-mode writes
 *      pass. Callable-only by design — wired to nothing autoexec; an admin
 *      action or workspace-closure UI is the intended caller. Other
 *      context kinds in the knowledge substrate are shared and stay put.
 *
 *      The authoritative list of what this sweep touches lives in the
 *      `SWEPT_MODELS` / `PRESERVED_MODELS` / `OUT_OF_SCOPE_MODELS`
 *      manifests below. `__tests__/deletion-coverage.test.ts` reads the
 *      Prisma DMMF and fails the build when a workspace-scoped model (or
 *      a cascade child of a swept model) is missing from them — so a new
 *      tenant table cannot ship without a deletion ruling.
 *
 *   3. `reapTombstonedDriveCustomerData({ workspaceId, sourceName,
 *      liveFileIds, listingWasComplete, store })`
 *      Drive-tombstone propagation. Given a "currently alive" file-id set
 *      from a complete source listing, delete CUSTOMER docs for that
 *      (workspace, source) whose stored `metadata.fileId` is not in the
 *      live set. Skips when `listingWasComplete=false` (bounded list cap
 *      hit — we can't safely decide what's tombstoned without the full
 *      set).
 *
 * Per `feedback_no_silent_vendor_lock.md`: all knowledge-store I/O goes
 * through `IKnowledgeStore.delete()` rather than scattering `prisma.*`
 * calls. The pgvector + test stores both implement the new delete shapes.
 *
 * Per memory `feedback_cold_start_safe_agents.md` + the RLS policies in
 * `prisma/migrations/20260512000000_add_knowledge_substrate/migration.sql`
 * (writes to `KnowledgeDocument` / `Embedding` require
 * `app.is_operator='true'`): the disconnect cleanup runs under
 * `withSystemContext` (separate from the broker-owner tx that deletes
 * the credential row itself, which is allowed by
 * `integration_credential_workspace_isolation` because the broker-owner
 * owns that row).
 */

import type { Prisma } from '@prisma/client';
import { SYSTEM_OPERATOR_CONTEXT, withSystemContext } from '../db/rls';
import { getKnowledgeStore } from '../knowledge';
import type { IKnowledgeStore } from '../knowledge/types';
import type { MarketplaceProviderKey } from '../integrations/marketplace';

/**
 * Map a provider key to the set of `IFileSource.name` values whose
 * ingested CUSTOMER docs should be deleted when a credential for that
 * provider is revoked.
 *
 * Today only `DriveFileSource` (name='google-drive') and the
 * `FixtureFileSource` ingest rows under contextKind=CUSTOMER (see
 * `lib/customer-files/ingest.ts:71-196`). Drive rides the GOOGLE
 * credential — disconnecting Gmail OR Drive deletes the same shared
 * GOOGLE credential row (uniqueness is on (workspaceId, provider,
 * accountId) — see `prisma/schema.prisma:578`), so either disconnect
 * also clears the workspace's ingested Drive data.
 *
 * Add more entries here when a new provider's file source ships
 * (OneDrive/SharePoint, Slack files, …).
 */
export function customerFileSourceNamesForProvider(
  providerKey: MarketplaceProviderKey,
): string[] {
  switch (providerKey) {
    case 'GOOGLE':
      // The fixture source is included so dev/staging seeds that mark
      // metadata.source='fixture' get cleaned up alongside the OAuth
      // disconnect during dogfood resets.
      return ['google-drive', 'fixture'];
    case 'NOTION':
      // Wave-7 — `NotionFileSource.name === 'notion'`. Disconnecting
      // Notion must purge the workspace's ingested Notion pages from
      // the knowledge substrate (privacy bar from the wave-7 brief).
      return ['notion'];
    case 'M365':
    case 'DOCUSIGN':
    case 'QUICKBOOKS':
    case 'SLACK':
    case 'FOLLOW_UP_BOSS':
    case 'SIERRA_INTERACTIVE':
    case 'BOLDTRAIL':
    case 'TAXDOME':
    case 'KARBON':
    case 'HUBSPOT':
    case 'SALESFORCE':
    case null:
    default:
      return [];
  }
}

export interface DeleteIntegrationCustomerDataArgs {
  workspaceId: string;
  providerKey: MarketplaceProviderKey;
  /** Override the knowledge store. Tests inject `TestKnowledgeStore`. */
  store?: IKnowledgeStore;
}

export interface DeleteIntegrationCustomerDataResult {
  /**
   * Per-source-name counts of embedding rows the store deleted. A
   * KnowledgeDocument and its Embedding rows are deleted together (the
   * Embedding.documentId FK cascade fires inside the store). The
   * embedding count is the deletion-impact metric the audit row records.
   */
  bySource: Array<{ sourceName: string; embeddingsDeleted: number }>;
  /** Sum across sources. */
  embeddingsDeleted: number;
}

/**
 * Disconnect-cleanup variant. Scoped PRECISELY: only that workspace's
 * CUSTOMER docs, only the source names the disconnected provider
 * produces. Empty result when the provider has never ingested anything.
 */
export async function deleteIntegrationCustomerData(
  args: DeleteIntegrationCustomerDataArgs,
): Promise<DeleteIntegrationCustomerDataResult> {
  if (!args.workspaceId) {
    throw new Error('deleteIntegrationCustomerData requires a workspaceId');
  }
  const sourceNames = customerFileSourceNamesForProvider(args.providerKey);
  if (sourceNames.length === 0) {
    return { bySource: [], embeddingsDeleted: 0 };
  }
  const store = args.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
  const bySource: Array<{ sourceName: string; embeddingsDeleted: number }> = [];
  let total = 0;
  for (const sourceName of sourceNames) {
    const result = await store.delete({
      byWorkspaceAndSource: {
        workspaceId: args.workspaceId,
        sourceName,
      },
    });
    const count = result.ok ? result.value.deleted : 0;
    bySource.push({ sourceName, embeddingsDeleted: count });
    total += count;
  }
  return { bySource, embeddingsDeleted: total };
}

export interface ReapTombstonedArgs {
  workspaceId: string;
  /** `IFileSource.name` whose ingested docs are being reaped. */
  sourceName: string;
  /** File IDs the source returned in its most recent listing. */
  liveFileIds: string[];
  /**
   * True iff the caller's `listFiles()` call observed every file the
   * source could enumerate — no `nextPageToken` was dropped and the
   * sweep did not hit the per-workspace `maxFiles` cap. When false the
   * reaper SKIPS work and returns 0, because the missing-from-live-set
   * test would otherwise mis-classify still-present files as tombstones.
   */
  listingWasComplete: boolean;
  /** Override the knowledge store. Tests inject `TestKnowledgeStore`. */
  store?: IKnowledgeStore;
}

export interface ReapTombstonedResult {
  embeddingsDeleted: number;
  /** True when the reaper actually ran (vs. skipped on incomplete listing). */
  ran: boolean;
}

/**
 * Drive-tombstone reaper. Skips when `listingWasComplete=false` (caller
 * hit the bounded list cap — running anyway would mis-classify still-
 * present files). Otherwise deletes every CUSTOMER doc for
 * (workspaceId, sourceName) whose stored metadata.fileId is NOT in
 * `liveFileIds`. Drive deletes/trash propagate this way: trashed files
 * vanish from `listFiles()` (because `DEFAULT_DRIVE_QUERY` filters
 * `trashed = false` — see `lib/customer-files/drive-source.ts:63`), so
 * they end up classified as tombstoned and removed from our store.
 */
export async function reapTombstonedDriveCustomerData(
  args: ReapTombstonedArgs,
): Promise<ReapTombstonedResult> {
  if (!args.workspaceId) {
    throw new Error('reapTombstonedDriveCustomerData requires a workspaceId');
  }
  if (!args.listingWasComplete) {
    return { embeddingsDeleted: 0, ran: false };
  }
  const store = args.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
  const result = await store.delete({
    byWorkspaceAndTombstone: {
      workspaceId: args.workspaceId,
      sourceName: args.sourceName,
      liveFileIds: args.liveFileIds,
    },
  });
  return {
    embeddingsDeleted: result.ok ? result.value.deleted : 0,
    ran: true,
  };
}

// ── Deletion manifests (single source of truth for the coverage gate) ────
//
// Every Prisma model in `prisma/schema.prisma` is classified exactly once
// across the three manifests below. `__tests__/deletion-coverage.test.ts`
// reads the DMMF and asserts:
//
//   a. every model carrying a `workspaceId` column is in SWEPT_MODELS or
//      PRESERVED_MODELS (never both, never neither);
//   b. every model reachable from a SWEPT model through a REQUIRED
//      relation with `onDelete: Cascade` is covered transitively (that is
//      how TeamMembership and the portal children are accounted for) —
//      and so is any future child somebody adds;
//   c. everything left over is named in OUT_OF_SCOPE_MODELS with a reason;
//   d. every `via: 'prisma'` entry actually appears as a `deleteMany` call
//      in this file, so the manifest can't drift away from the code.

export interface SweptModel {
  /** Prisma model name, exactly as spelled in `prisma/schema.prisma`. */
  model: string;
  /**
   * How the row is removed. `'prisma'` = an explicit `deleteMany` in
   * `tearDownWorkspaceData`; `'knowledge-store'` = the `IKnowledgeStore`
   * seam (per `feedback_no_silent_vendor_lock.md`, knowledge-substrate I/O
   * never goes through bare `prisma.*`).
   */
  via: 'prisma' | 'knowledge-store';
  /** Column the delete is keyed on. Defaults to `workspaceId`. */
  keyedOn?: string;
}

/**
 * Tables the workspace teardown hard-deletes. Order here is documentation,
 * not execution order — the executing order lives in `runDeletes` and is
 * children-before-parents so every count is exact.
 */
export const SWEPT_MODELS: readonly SweptModel[] = [
  // Knowledge substrate — CUSTOMER kind only, through the store seam.
  { model: 'KnowledgeDocument', via: 'knowledge-store' },
  { model: 'Embedding', via: 'knowledge-store' },
  // Integrations + webhooks.
  { model: 'WebhookEvent', via: 'prisma' },
  { model: 'WebhookSubscription', via: 'prisma' },
  { model: 'IntegrationCredential', via: 'prisma' },
  { model: 'IntegrationHealthCheck', via: 'prisma' },
  { model: 'RetryableAction', via: 'prisma' },
  // Work + activity.
  { model: 'WorkApprovalQueueItem', via: 'prisma' },
  { model: 'HandoffLogEntry', via: 'prisma' },
  { model: 'SkillRun', via: 'prisma' },
  { model: 'SkillConfig', via: 'prisma' },
  { model: 'SkillScheduleWindow', via: 'prisma' },
  { model: 'WorkspacePauseConfig', via: 'prisma' },
  { model: 'WorkspaceSkillInstallation', via: 'prisma' },
  { model: 'WorkThresholdConfig', via: 'prisma' },
  { model: 'WorkspaceBriefing', via: 'prisma' },
  { model: 'WorkspaceLifecycleEvent', via: 'prisma' },
  { model: 'OnboardingState', via: 'prisma' },
  // Conversation + memory.
  { model: 'ChatMessage', via: 'prisma' },
  { model: 'ChatThread', via: 'prisma' },
  { model: 'PlainoConversation', via: 'prisma' },
  { model: 'WorkspaceMemoryEntry', via: 'prisma' },
  { model: 'MemoryAuditLog', via: 'prisma' },
  { model: 'WorkspaceStorageConfig', via: 'prisma' },
  // Preferences + compliance.
  { model: 'WorkspacePreference', via: 'prisma' },
  { model: 'PreferenceSignal', via: 'prisma' },
  { model: 'PreferenceFeedback', via: 'prisma' },
  { model: 'ComplianceFlag', via: 'prisma' },
  { model: 'CounselRedline', via: 'prisma' },
  { model: 'CapabilityProposal', via: 'prisma' },
  { model: 'CreatorBrief', via: 'prisma' },
  // People + org.
  { model: 'TeamMembership', via: 'prisma', keyedOn: 'team.workspaceId' },
  { model: 'Team', via: 'prisma' },
  { model: 'DisciplineHead', via: 'prisma' },
  // Support.
  { model: 'SupportTicketMessage', via: 'prisma' },
  { model: 'SupportTicket', via: 'prisma' },
  { model: 'SupportRequest', via: 'prisma' },
  // Client portal — end-client PII (emails, encrypted message bodies,
  // uploaded documents). None of these carry a `workspaceId` of their own;
  // they are keyed through PortalConfig, which does.
  { model: 'PortalMessage', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalCaseEvent', via: 'prisma', keyedOn: 'case.portalConfig.workspaceId' },
  { model: 'PortalThread', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalSession', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalInvite', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalDocument', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalCase', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalClient', via: 'prisma', keyedOn: 'portalConfig.workspaceId' },
  { model: 'PortalConfig', via: 'prisma' },
  // Audit + guarantee ledger.
  { model: 'AuditLog', via: 'prisma' },
  { model: 'TimeSavingsEntry', via: 'prisma' },
  // Soft pointer, no FK.
  { model: 'Inquiry', via: 'prisma', keyedOn: 'convertedWorkspaceId' },
];

/**
 * Workspace-scoped tables the teardown deliberately PRESERVES. Each entry
 * is a ruling, not an oversight — the coverage test refuses an empty
 * reason. Disclosed to the customer on the closure screen.
 */
export const PRESERVED_MODELS: readonly { model: string; reason: string }[] = [
  {
    model: 'Workspace',
    reason:
      'Billing/tax shell. Refund reconciliation needs the Stripe ids on this row; ' +
      'closure is a state on the workspace, not a row deletion.',
  },
  {
    model: 'Membership',
    reason:
      'Part of the preserved workspace shell — who was on the account is billing ' +
      'history. Carries no tenant content of its own.',
  },
  {
    model: 'Subscription',
    reason: 'Tax record. Stripe subscription/customer ids survive closure.',
  },
  {
    model: 'BillingEvent',
    reason: 'Tax record — the Stripe webhook ledger behind every charge.',
  },
  {
    model: 'WorkspaceInvoice',
    reason: 'Tax record — issued invoices must remain queryable after closure.',
  },
  {
    model: 'LlmUsageRecord',
    reason:
      'Billing record, not customer content: token counts, model name, cost, and ' +
      '`stripeReportedAt` — the source of truth for metered usage reported to ' +
      'Stripe. No prompt/response text is stored on the row. Preserved on the same ' +
      'footing as Subscription / BillingEvent / WorkspaceInvoice so a closure ' +
      'cannot erase the basis of an already-issued (or in-flight) usage charge.',
  },
];

/**
 * Models that are neither workspace-scoped nor reachable from a swept
 * model. Listed with a reason so the coverage gate can prove the schema is
 * fully classified rather than silently ignoring anything it doesn't
 * recognise.
 */
export const OUT_OF_SCOPE_MODELS: readonly { model: string; reason: string }[] = [
  {
    model: 'User',
    reason:
      'User-scoped, not workspace-scoped. A person may belong to several ' +
      'workspaces; account deletion is a separate path.',
  },
  {
    model: 'MagicLinkToken',
    reason: 'User-scoped auth artifact (cascades from User), short-TTL + single-use.',
  },
  {
    model: 'WebAuthnCredential',
    reason: 'User-scoped passkey (cascades from User), not workspace tenant data.',
  },
  {
    model: 'PushDevice',
    reason: 'User-scoped device registration (cascades from User).',
  },
  {
    model: 'LeadCapture',
    reason:
      'Operator-global marketing lead surface. Rows predate (and are not owned by) ' +
      'any workspace.',
  },
  {
    model: 'OpsFlag',
    reason:
      'Operator-global kill-switch store, keyed on flag name. MUST survive teardown: ' +
      'the walk-away executor guards its money movement with a once-per-lifetime ' +
      'OpsFlag, so deleting it would re-arm a refund the customer already took.',
  },
  {
    model: 'ComplianceCounselSignoff',
    reason:
      'Per-VERTICAL counsel sign-off (unique on verticalSlug), explicitly not ' +
      'per-workspace — the row has no workspaceId. Shared across every workspace ' +
      'in the vertical.',
  },
  {
    model: 'OutreachProspect',
    reason:
      'Operator-global design-partner CRM. Prospects are not customers, so there is ' +
      'no workspace to scope to.',
  },
  {
    model: 'OutreachTouch',
    reason: 'Cascade child of OutreachProspect — same operator-global scope.',
  },
];

export interface TearDownWorkspaceDataArgs {
  workspaceId: string;
  /** Override the knowledge store. Tests inject `TestKnowledgeStore`. */
  store?: IKnowledgeStore;
  /** Optional pre-built transaction client. Defaults to opening a new
   *  `withSystemContext` tx. Tests pass the fake-prisma client here. */
  client?: Prisma.TransactionClient;
}

export interface TearDownWorkspaceDataResult {
  customerEmbeddingsDeleted: number;
  workApprovalsDeleted: number;
  handoffsDeleted: number;
  webhookEventsDeleted: number;
  webhookSubscriptionsDeleted: number;
  integrationCredentialsDeleted: number;
  preferenceSignalsDeleted: number;
  workspacePreferencesDeleted: number;
  inquiriesDeleted: number;
  // pfd-4 — teardown gaps the 2026-06-10 signup-to-go audit named. These
  // tables are workspace-scoped tenant data that the prior teardown left
  // behind (they cascade from Workspace, but teardown preserves the
  // Workspace row, so the cascade never fired — orphaned PII).
  skillConfigsDeleted: number;
  skillScheduleWindowsDeleted: number;
  pauseConfigsDeleted: number;
  skillRunsDeleted: number;
  plainoConversationsDeleted: number;
  chatThreadsDeleted: number;
  chatMessagesDeleted: number;
  memoryEntriesDeleted: number;
  briefingsDeleted: number;
  skillInstallationsDeleted: number;
  thresholdsDeleted: number;
  complianceFlagsDeleted: number;
  counselRedlinesDeleted: number;
  lifecycleEventsDeleted: number;
  preferenceFeedbackDeleted: number;
  // Account-close hard-deletes the customer's audit log too (Conner,
  // 2026-06-18): "your data is yours; we delete on cancel." Billing rows
  // (Subscription / WorkspaceInvoice) are preserved separately for tax.
  auditLogsDeleted: number;
  // guarantee (2026-06-17) — the trial-guarantee time-savings ledger.
  // Workspace-scoped tenant data with a Workspace cascade FK; because
  // teardown PRESERVES the Workspace row, the cascade never fires, so it
  // is purged explicitly (same reasoning as the pfd-4 tables above).
  timeSavingsEntriesDeleted: number;

  // 2026-08-01 deletion audit — the remaining uncovered tables. Same root
  // cause as the pfd-4 batch: every one of these cascades from Workspace,
  // and teardown preserves the Workspace row, so the cascade never fired.
  onboardingStatesDeleted: number;
  integrationHealthChecksDeleted: number;
  retryableActionsDeleted: number;
  supportRequestsDeleted: number;
  supportTicketsDeleted: number;
  supportTicketMessagesDeleted: number;
  storageConfigsDeleted: number;
  memoryAuditLogsDeleted: number;
  teamsDeleted: number;
  teamMembershipsDeleted: number;
  disciplineHeadsDeleted: number;
  creatorBriefsDeleted: number;
  capabilityProposalsDeleted: number;

  // Client-portal tree. These rows hold END-CLIENT PII — the SMB owner's
  // buyers / legal clients / tax clients: their email addresses, their
  // AES-256-GCM message bodies, and the documents they uploaded. They
  // cascade from PortalConfig, which cascades from Workspace, so with the
  // Workspace row preserved NONE of it was being deleted. Keyed through
  // PortalConfig because none of the children carry a workspaceId.
  portalConfigsDeleted: number;
  portalClientsDeleted: number;
  portalCasesDeleted: number;
  portalCaseEventsDeleted: number;
  portalInvitesDeleted: number;
  portalSessionsDeleted: number;
  portalThreadsDeleted: number;
  portalMessagesDeleted: number;
  portalDocumentsDeleted: number;
}

/**
 * Workspace teardown — delete all of a workspace's tenant data. Caller
 * is expected to be an explicit admin action (no auto-fire). FK delete
 * order:
 *
 *   1. WebhookEvent      → no children
 *   2. WebhookSubscription → cascades to WebhookEvent (already cleared)
 *   3. IntegrationCredential → cascades to WebhookSubscription
 *      (already cleared); deleted explicitly so any orphans purge
 *   4. KnowledgeDocument (CUSTOMER kind, this workspace) → cascades to
 *      Embedding (`Embedding.documentId → KnowledgeDocument.id ON DELETE
 *      CASCADE` per migration line 82)
 *   5. WorkApprovalQueueItem — independent, workspaceId-scoped
 *   6. HandoffLogEntry — independent
 *   7. PreferenceSignal — independent (must precede WorkspacePreference
 *      out of habit; no FK between them in this schema, but the audit
 *      log dependency ordering reads naturally signals→aggregate)
 *   8. WorkspacePreference — 1:1 with Workspace; independent table
 *   9. Inquiry (convertedWorkspaceId == workspaceId) — soft pointer; no
 *      FK, plain UUID column. Deleted because the row carries PII
 *      (name, email, needs) belonging to a person who is closing their
 *      workspace.
 *  10. SupportTicketMessage → SupportTicket. Messages carry a
 *      denormalized workspaceId AND cascade from the ticket; deleted
 *      first so the count is the real number of rows removed rather than
 *      whatever the cascade left.
 *  11. TeamMembership → Team. TeamMembership has no workspaceId of its
 *      own (it is keyed through `team`), so it is deleted via a relation
 *      filter before its parent — again for an exact count.
 *  12. The portal tree, deepest-first, all keyed through
 *      `portalConfig.workspaceId` (no portal child carries a
 *      workspaceId):
 *        PortalMessage → PortalCaseEvent → PortalThread → PortalSession
 *        → PortalInvite → PortalDocument → PortalCase → PortalClient
 *        → PortalConfig
 *      Every edge in that tree is `onDelete: Cascade`, so the order is
 *      about accurate per-table counts, not about avoiding an FK error —
 *      a schema-wide sweep confirmed ZERO Restrict/NoAction foreign keys
 *      (all 92 relations are explicitly Cascade or SetNull), so no delete
 *      here can be blocked by a referencing row.
 *
 * Workspace + Membership rows themselves stay put (with no tenant data) so
 * the workspace's billing history (`Subscription`, `WorkspaceInvoice`,
 * `BillingEvent`) remains queryable for tax/compliance. Everything else the
 * customer owns — including their own `AuditLog` activity trail — is
 * hard-deleted (Conner, 2026-06-18: "your data is yours; we delete on
 * cancel"). A future full hard-delete of the Workspace/Membership/billing
 * shell would need to coordinate with billing reconciliation and is out of
 * scope here.
 */
export async function tearDownWorkspaceData(
  args: TearDownWorkspaceDataArgs,
): Promise<TearDownWorkspaceDataResult> {
  if (!args.workspaceId) {
    throw new Error('tearDownWorkspaceData requires a workspaceId');
  }
  const { workspaceId } = args;
  const store = args.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);

  // The knowledge tables (KnowledgeDocument + Embedding) go through the
  // IKnowledgeStore; everything else goes through Prisma directly.
  const customer = await store.delete({
    allWorkspaceCustomerDocs: { workspaceId },
  });
  const customerEmbeddingsDeleted = customer.ok ? customer.value.deleted : 0;

  const runDeletes = async (
    tx: Prisma.TransactionClient,
  ): Promise<Omit<TearDownWorkspaceDataResult, 'customerEmbeddingsDeleted'>> => {
    // WebhookEvent first — explicitly, even though the schema cascades
    // from WebhookSubscription. Explicit count makes the audit precise.
    const webhookEventsDeleted = (
      await tx.webhookEvent.deleteMany({ where: { workspaceId } })
    ).count;
    const webhookSubscriptionsDeleted = (
      await tx.webhookSubscription.deleteMany({ where: { workspaceId } })
    ).count;
    const integrationCredentialsDeleted = (
      await tx.integrationCredential.deleteMany({ where: { workspaceId } })
    ).count;
    const workApprovalsDeleted = (
      await tx.workApprovalQueueItem.deleteMany({ where: { workspaceId } })
    ).count;
    const handoffsDeleted = (
      await tx.handoffLogEntry.deleteMany({ where: { workspaceId } })
    ).count;
    const preferenceSignalsDeleted = (
      await tx.preferenceSignal.deleteMany({ where: { workspaceId } })
    ).count;
    const workspacePreferencesDeleted = (
      await tx.workspacePreference.deleteMany({ where: { workspaceId } })
    ).count;
    // Inquiry has no FK on Workspace; convertedWorkspaceId is a soft
    // pointer set during operator triage. Delete-by-soft-pointer.
    const inquiriesDeleted = (
      await tx.inquiry.deleteMany({ where: { convertedWorkspaceId: workspaceId } })
    ).count;

    // pfd-4 — teardown gaps the audit named. Every one of these is
    // workspace-scoped tenant data with a Workspace cascade FK. Because
    // teardown PRESERVES the Workspace row (for audit/billing history),
    // the cascade never fires, so these have to be purged explicitly.
    // ChatMessage cascades from ChatThread, but we delete it first for an
    // accurate count + to be robust if a thread row is missing.
    const skillRunsDeleted = (
      await tx.skillRun.deleteMany({ where: { workspaceId } })
    ).count;
    const skillConfigsDeleted = (
      await tx.skillConfig.deleteMany({ where: { workspaceId } })
    ).count;
    const skillScheduleWindowsDeleted = (
      await tx.skillScheduleWindow.deleteMany({ where: { workspaceId } })
    ).count;
    const pauseConfigsDeleted = (
      await tx.workspacePauseConfig.deleteMany({ where: { workspaceId } })
    ).count;
    const chatMessagesDeleted = (
      await tx.chatMessage.deleteMany({ where: { workspaceId } })
    ).count;
    const chatThreadsDeleted = (
      await tx.chatThread.deleteMany({ where: { workspaceId } })
    ).count;
    const plainoConversationsDeleted = (
      await tx.plainoConversation.deleteMany({ where: { workspaceId } })
    ).count;
    const memoryEntriesDeleted = (
      await tx.workspaceMemoryEntry.deleteMany({ where: { workspaceId } })
    ).count;
    const briefingsDeleted = (
      await tx.workspaceBriefing.deleteMany({ where: { workspaceId } })
    ).count;
    const skillInstallationsDeleted = (
      await tx.workspaceSkillInstallation.deleteMany({ where: { workspaceId } })
    ).count;
    const thresholdsDeleted = (
      await tx.workThresholdConfig.deleteMany({ where: { workspaceId } })
    ).count;
    const complianceFlagsDeleted = (
      await tx.complianceFlag.deleteMany({ where: { workspaceId } })
    ).count;
    const counselRedlinesDeleted = (
      await tx.counselRedline.deleteMany({ where: { workspaceId } })
    ).count;
    const lifecycleEventsDeleted = (
      await tx.workspaceLifecycleEvent.deleteMany({ where: { workspaceId } })
    ).count;
    const preferenceFeedbackDeleted = (
      await tx.preferenceFeedback.deleteMany({ where: { workspaceId } })
    ).count;
    // Audit log — the customer's own activity trail. Hard-deleted on close so
    // nothing of theirs lingers. Billing rows (Subscription / WorkspaceInvoice
    // / BillingEvent) are intentionally NOT deleted here — they are the tax
    // record and survive closure, as disclosed on the closure screen.
    const auditLogsDeleted = (
      await tx.auditLog.deleteMany({ where: { workspaceId } })
    ).count;
    const timeSavingsEntriesDeleted = (
      await tx.timeSavingsEntry.deleteMany({ where: { workspaceId } })
    ).count;

    // ── 2026-08-01 deletion audit — remaining uncovered tables ──────────
    // Same root cause as pfd-4: each of these cascades from Workspace, and
    // teardown preserves the Workspace row, so the cascade never fired.

    // Independent, workspaceId-scoped. No children among the swept set.
    const onboardingStatesDeleted = (
      await tx.onboardingState.deleteMany({ where: { workspaceId } })
    ).count;
    const integrationHealthChecksDeleted = (
      await tx.integrationHealthCheck.deleteMany({ where: { workspaceId } })
    ).count;
    // RetryableAction payloads reconstruct in-flight customer work (record
    // ids, draft bodies) — tenant content, not just queue plumbing.
    const retryableActionsDeleted = (
      await tx.retryableAction.deleteMany({ where: { workspaceId } })
    ).count;
    // WorkspaceStorageConfig holds the customer's BYO object-store
    // credentials (AES-GCM envelopes of the S3 access/secret key and the
    // KMS key ref). Highest-sensitivity row in this batch.
    const storageConfigsDeleted = (
      await tx.workspaceStorageConfig.deleteMany({ where: { workspaceId } })
    ).count;
    const memoryAuditLogsDeleted = (
      await tx.memoryAuditLog.deleteMany({ where: { workspaceId } })
    ).count;
    const disciplineHeadsDeleted = (
      await tx.disciplineHead.deleteMany({ where: { workspaceId } })
    ).count;
    // Support: the customer's own words about their problems, plus the
    // point-in-time workspace context snapshot on the ticket. Messages
    // first (they cascade from the ticket) for an exact count.
    const supportTicketMessagesDeleted = (
      await tx.supportTicketMessage.deleteMany({ where: { workspaceId } })
    ).count;
    const supportTicketsDeleted = (
      await tx.supportTicket.deleteMany({ where: { workspaceId } })
    ).count;
    const supportRequestsDeleted = (
      await tx.supportRequest.deleteMany({ where: { workspaceId } })
    ).count;
    // CreatorBrief.workspaceId is OPTIONAL — NULL means platform-level
    // agentplain brand work with no owner. Scoping the delete to the
    // workspace leaves those operator-global rows untouched by
    // construction.
    const creatorBriefsDeleted = (
      await tx.creatorBrief.deleteMany({ where: { workspaceId } })
    ).count;
    // CapabilityProposal.workspaceId is optional with onDelete: SetNull.
    // We DELETE the workspace's rows rather than mirroring the FK's
    // SetNull, because a workspace-tagged proposal is workspace-DERIVED
    // content: the drift sweep (lib/feedback/store.ts#createDriftProposal)
    // synthesises the body from that workspace's PreferenceFeedback rows,
    // which this teardown deletes. Nulling the pointer would leave an
    // orphan artifact derived from data the customer just asked us to
    // erase. The SetNull FK exists to protect PLATFORM-level proposals
    // (workspaceId NULL) from a workspace hard-delete — and those are
    // untouched here, since the filter is `workspaceId = <this one>`.
    const capabilityProposalsDeleted = (
      await tx.capabilityProposal.deleteMany({ where: { workspaceId } })
    ).count;

    // Teams: TeamMembership carries no workspaceId — it is reached through
    // `team`. Deleted explicitly (not left to the Team cascade) so the
    // count is real.
    const teamMembershipsDeleted = (
      await tx.teamMembership.deleteMany({ where: { team: { workspaceId } } })
    ).count;
    const teamsDeleted = (
      await tx.team.deleteMany({ where: { workspaceId } })
    ).count;

    // ── Client portal ───────────────────────────────────────────────────
    // The heaviest PII in the schema and, until this pass, entirely
    // un-swept: end-client email addresses, AES-256-GCM message bodies,
    // uploaded documents, live session tokens. Nothing below PortalConfig
    // carries a workspaceId, so every child is keyed through the
    // `portalConfig` relation (or `case.portalConfig` for PortalCaseEvent,
    // whose only FK is to PortalCase). Deepest-first for exact counts.
    const portalMessagesDeleted = (
      await tx.portalMessage.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalCaseEventsDeleted = (
      await tx.portalCaseEvent.deleteMany({
        where: { case: { portalConfig: { workspaceId } } },
      })
    ).count;
    const portalThreadsDeleted = (
      await tx.portalThread.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalSessionsDeleted = (
      await tx.portalSession.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalInvitesDeleted = (
      await tx.portalInvite.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    // TODO(orphan-blob): PortalDocument.blobUrl points at Vercel Blob when
    // PORTAL_STORAGE=blob. The row goes away here but the object does not —
    // `lib/portal/storage.ts` exposes a put-only port (`PortalStorage`) and
    // `@vercel/blob` is an optional, lazily-imported package that is not
    // installed today, so there is no delete seam to call. The DEFAULT
    // adapter is RefStorage, which persists nothing externally (`durable:
    // false`), so in the current shipping posture there are no orphans.
    // Closing this properly means adding `delete()` to the PortalStorage
    // port + a seam-injectable purge here — a `lib/portal` change, out of
    // scope for this deletion pass and tracked separately rather than
    // half-built.
    const portalDocumentsDeleted = (
      await tx.portalDocument.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalCasesDeleted = (
      await tx.portalCase.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalClientsDeleted = (
      await tx.portalClient.deleteMany({ where: { portalConfig: { workspaceId } } })
    ).count;
    const portalConfigsDeleted = (
      await tx.portalConfig.deleteMany({ where: { workspaceId } })
    ).count;

    return {
      workApprovalsDeleted,
      handoffsDeleted,
      webhookEventsDeleted,
      webhookSubscriptionsDeleted,
      integrationCredentialsDeleted,
      preferenceSignalsDeleted,
      workspacePreferencesDeleted,
      inquiriesDeleted,
      skillConfigsDeleted,
      skillScheduleWindowsDeleted,
      pauseConfigsDeleted,
      skillRunsDeleted,
      plainoConversationsDeleted,
      chatThreadsDeleted,
      chatMessagesDeleted,
      memoryEntriesDeleted,
      briefingsDeleted,
      skillInstallationsDeleted,
      thresholdsDeleted,
      complianceFlagsDeleted,
      counselRedlinesDeleted,
      lifecycleEventsDeleted,
      preferenceFeedbackDeleted,
      auditLogsDeleted,
      timeSavingsEntriesDeleted,
      onboardingStatesDeleted,
      integrationHealthChecksDeleted,
      retryableActionsDeleted,
      supportRequestsDeleted,
      supportTicketsDeleted,
      supportTicketMessagesDeleted,
      storageConfigsDeleted,
      memoryAuditLogsDeleted,
      teamsDeleted,
      teamMembershipsDeleted,
      disciplineHeadsDeleted,
      creatorBriefsDeleted,
      capabilityProposalsDeleted,
      portalConfigsDeleted,
      portalClientsDeleted,
      portalCasesDeleted,
      portalCaseEventsDeleted,
      portalInvitesDeleted,
      portalSessionsDeleted,
      portalThreadsDeleted,
      portalMessagesDeleted,
      portalDocumentsDeleted,
    };
  };

  const tableDeletes = args.client
    ? await runDeletes(args.client)
    : await withSystemContext((tx) => runDeletes(tx));

  return { customerEmbeddingsDeleted, ...tableDeletes };
}
