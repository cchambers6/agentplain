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
 *      IntegrationCredential, WorkspacePreference + PreferenceSignal, and
 *      Inquiry rows whose `convertedWorkspaceId` matches. Runs under
 *      `withSystemContext` so RLS policy `FORCE`-mode writes pass.
 *      Callable-only by design — wired to nothing autoexec; an admin
 *      action or workspace-closure UI is the intended caller. Other
 *      context kinds in the knowledge substrate are shared and stay put.
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
    };
  };

  const tableDeletes = args.client
    ? await runDeletes(args.client)
    : await withSystemContext((tx) => runDeletes(tx));

  return { customerEmbeddingsDeleted, ...tableDeletes };
}
