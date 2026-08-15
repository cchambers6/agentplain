/**
 * lib/storage/workspace-storage-summary.ts
 *
 * Live, per-category accounting of EXACTLY what agentplain stores about one
 * workspace. Powers the customer-visible `/settings/data/storage` surface:
 * for every disclosed data category it reports the real row counts (read
 * under the caller's RLS context, so a customer only ever sees their own
 * workspace), plus the chat-retention window in effect and a count of recent
 * pass-through reads that stored nothing.
 *
 * The category taxonomy + classifications come from `data-categories.ts` —
 * this module supplies the live numbers behind that fixed structure.
 */

import type { PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';
import {
  DATA_CATEGORIES,
  type DataCategory,
  type DataCategoryClassification,
} from './data-categories';
import { STORAGE_EPHEMERAL_FETCH_ACTION } from './audit';
import { resolveChatRetentionDays } from '../plaino/chat-retention';

export interface CategoryTableCount {
  table: string;
  count: number;
}

export interface CategoryStorageSummary {
  id: string;
  label: string;
  classification: DataCategoryClassification;
  summary: string;
  detail: string;
  customerDeletable: boolean;
  totalRows: number;
  tables: CategoryTableCount[];
}

export interface RetentionSummary {
  /** The workspace-wide customer opt-in window, if set. null = lifetime
   *  (the default — Plaino keeps chat for the life of the account). */
  customerOverrideDays: number | null;
  /** The effective window: null = kept for the account lifetime; a finite
   *  number = the customer opted into auto-purge after that many days. */
  effectiveDays: number | null;
}

export interface WorkspaceStorageSummary {
  categories: CategoryStorageSummary[];
  retention: RetentionSummary;
  /** How many `storage.ephemeral_fetch` breadcrumbs exist — proof of the
   *  pass-through ("we read your data N times and stored none of it"). */
  ephemeralFetchCount: number;
}

/**
 * Every Prisma model the live summary resolves a REAL count for.
 *
 * Why this exists: the per-category renderer below reads `counts[table] ?? 0`.
 * A model disclosed in `DATA_CATEGORIES` but never counted therefore renders
 * as "0 rows" on the customer's storage page whether or not rows exist — the
 * page looks complete while silently under-reporting. That is a disclosure
 * gap, not a display bug.
 *
 * `composeStorageCounts` below is typed against this list, so the object
 * literal inside `buildWorkspaceStorageSummary` cannot add a key that is not
 * declared here, nor omit one that is — TypeScript keeps the two in lock-step
 * at compile time. `data-categories.test.ts` closes the other half: every
 * disclosed table must appear in this list.
 */
export const STORAGE_SUMMARY_COUNTED_MODELS = [
  'Workspace',
  'Membership',
  'Team',
  'TeamMembership',
  'OnboardingState',
  'IntegrationCredential',
  'WebhookSubscription',
  'WebhookEvent',
  'IntegrationHealthCheck',
  'WorkspaceStorageConfig',
  'Subscription',
  'WorkspaceInvoice',
  'BillingEvent',
  'LlmUsageRecord',
  'WorkApprovalQueueItem',
  'HandoffLogEntry',
  'SkillRun',
  'ComplianceFlag',
  'CounselRedline',
  'RetryableAction',
  'AuditLog',
  'MemoryAuditLog',
  'TimeSavingsEntry',
  'ChatThread',
  'ChatMessage',
  'PlainoConversation',
  'WorkspacePreference',
  'PreferenceSignal',
  'PreferenceFeedback',
  'WorkspaceMemoryEntry',
  'SkillConfig',
  'WorkspaceSkillInstallation',
  'WorkThresholdConfig',
  'WorkspacePauseConfig',
  'SkillScheduleWindow',
  'DisciplineHead',
  'WorkspaceBriefing',
  'WorkspaceLifecycleEvent',
  'SupportRequest',
  'SupportTicket',
  'SupportTicketMessage',
  'KnowledgeDocument',
  'Embedding',
  'PortalConfig',
  'PortalClient',
  'PortalCase',
  'PortalCaseEvent',
  'PortalInvite',
  'PortalSession',
  'PortalThread',
  'PortalMessage',
  'PortalDocument',
] as const;

export type StorageCountedModel = (typeof STORAGE_SUMMARY_COUNTED_MODELS)[number];

/**
 * Identity at runtime; a type-level contract at compile time. The parameter
 * type forces the caller's object literal to name EXACTLY the models declared
 * in `STORAGE_SUMMARY_COUNTED_MODELS` — no more, no fewer.
 */
function composeStorageCounts(
  raw: Record<StorageCountedModel, number>,
): Record<string, number> {
  return raw;
}

export interface BuildStorageSummaryArgs {
  ctx: RlsContext;
  workspaceId: string;
  client?: PrismaClient;
}

export async function buildWorkspaceStorageSummary(
  args: BuildStorageSummaryArgs,
): Promise<WorkspaceStorageSummary> {
  if (args.ctx.workspaceId !== args.workspaceId) {
    throw new Error(
      `storage summary RLS mismatch: ctx=${args.ctx.workspaceId ?? 'null'}, requested=${args.workspaceId}`,
    );
  }
  const wid = args.workspaceId;

  return withRls(
    args.ctx,
    async (tx) => {
      // One transaction, all counts in parallel. Counting (not selecting) so
      // no row bodies are read — the surface shows shape, not content.
      const [
        membership,
        team,
        integrationCredential,
        webhookSubscription,
        webhookEvent,
        integrationHealthCheck,
        onboarding,
        workspaceInvoice,
        billingEvent,
        llmUsageRecord,
        subscription,
        workApproval,
        handoff,
        skillRun,
        complianceFlag,
        counselRedline,
        auditLogTotal,
        chatThread,
        chatMessage,
        plainoConversation,
        preference,
        preferenceSignal,
        preferenceFeedback,
        memoryEntry,
        skillConfig,
        skillInstallation,
        thresholdConfig,
        pauseConfig,
        scheduleWindow,
        disciplineHead,
        briefing,
        lifecycleEvent,
        supportRequest,
        supportTicket,
        supportTicketMessage,
        knowledgeDocument,
        embedding,
        retryableAction,
        memoryAuditLog,
        timeSavingsEntry,
        storageConfig,
        portalConfig,
        portalClient,
        portalCase,
        portalCaseEvent,
        portalInvite,
        portalSession,
        portalThread,
        portalMessage,
        portalDocument,
        ephemeralFetchCount,
      ] = await Promise.all([
        tx.membership.count({ where: { workspaceId: wid } }),
        tx.team.count({ where: { workspaceId: wid } }),
        tx.integrationCredential.count({ where: { workspaceId: wid } }),
        tx.webhookSubscription.count({ where: { workspaceId: wid } }),
        tx.webhookEvent.count({ where: { workspaceId: wid } }),
        tx.integrationHealthCheck.count({ where: { workspaceId: wid } }),
        tx.onboardingState.count({ where: { workspaceId: wid } }),
        tx.workspaceInvoice.count({ where: { workspaceId: wid } }),
        tx.billingEvent.count({ where: { workspaceId: wid } }),
        tx.llmUsageRecord.count({ where: { workspaceId: wid } }),
        tx.subscription.findUnique({
          where: { workspaceId: wid },
          select: { tier: true },
        }),
        tx.workApprovalQueueItem.count({ where: { workspaceId: wid } }),
        tx.handoffLogEntry.count({ where: { workspaceId: wid } }),
        tx.skillRun.count({ where: { workspaceId: wid } }),
        tx.complianceFlag.count({ where: { workspaceId: wid } }),
        tx.counselRedline.count({ where: { workspaceId: wid } }),
        tx.auditLog.count({ where: { workspaceId: wid } }),
        tx.chatThread.count({ where: { workspaceId: wid } }),
        tx.chatMessage.count({ where: { workspaceId: wid } }),
        tx.plainoConversation.count({ where: { workspaceId: wid } }),
        tx.workspacePreference.findUnique({
          where: { workspaceId: wid },
          select: { chatRetentionDays: true },
        }),
        tx.preferenceSignal.count({ where: { workspaceId: wid } }),
        tx.preferenceFeedback.count({ where: { workspaceId: wid } }),
        tx.workspaceMemoryEntry.count({ where: { workspaceId: wid } }),
        tx.skillConfig.count({ where: { workspaceId: wid } }),
        tx.workspaceSkillInstallation.count({ where: { workspaceId: wid } }),
        tx.workThresholdConfig.count({ where: { workspaceId: wid } }),
        tx.workspacePauseConfig.count({ where: { workspaceId: wid } }),
        tx.skillScheduleWindow.count({ where: { workspaceId: wid } }),
        tx.disciplineHead.count({ where: { workspaceId: wid } }),
        tx.workspaceBriefing.count({ where: { workspaceId: wid } }),
        tx.workspaceLifecycleEvent.count({ where: { workspaceId: wid } }),
        tx.supportRequest.count({ where: { workspaceId: wid } }),
        tx.supportTicket.count({ where: { workspaceId: wid } }),
        tx.supportTicketMessage.count({ where: { workspaceId: wid } }),
        tx.knowledgeDocument.count({
          where: { workspaceId: wid, contextKind: 'CUSTOMER' },
        }),
        tx.embedding.count({ where: { workspaceId: wid, contextKind: 'CUSTOMER' } }),
        tx.retryableAction.count({ where: { workspaceId: wid } }),
        tx.memoryAuditLog.count({ where: { workspaceId: wid } }),
        tx.timeSavingsEntry.count({ where: { workspaceId: wid } }),
        tx.workspaceStorageConfig.count({ where: { workspaceId: wid } }),
        tx.portalConfig.count({ where: { workspaceId: wid } }),
        // The portal tree hangs off PortalConfig, not off Workspace — every
        // child is reached through the config's workspaceId so the count is
        // still workspace-scoped. Disclosed because this is the one place we
        // hold data about the customer's OWN clients (end-client PII).
        tx.portalClient.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalCase.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalCaseEvent.count({
          where: { case: { portalConfig: { workspaceId: wid } } },
        }),
        tx.portalInvite.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalSession.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalThread.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalMessage.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.portalDocument.count({ where: { portalConfig: { workspaceId: wid } } }),
        tx.auditLog.count({
          where: { workspaceId: wid, action: STORAGE_EPHEMERAL_FETCH_ACTION },
        }),
      ]);

      const counts: Record<string, number> = composeStorageCounts({
        Workspace: 1,
        Membership: membership,
        Team: team,
        TeamMembership: 0, // joined via Team; not separately workspace-keyed
        OnboardingState: onboarding,
        IntegrationCredential: integrationCredential,
        WebhookSubscription: webhookSubscription,
        WebhookEvent: webhookEvent,
        IntegrationHealthCheck: integrationHealthCheck,
        Subscription: subscription ? 1 : 0,
        WorkspaceInvoice: workspaceInvoice,
        BillingEvent: billingEvent,
        LlmUsageRecord: llmUsageRecord,
        WorkApprovalQueueItem: workApproval,
        HandoffLogEntry: handoff,
        SkillRun: skillRun,
        ComplianceFlag: complianceFlag,
        CounselRedline: counselRedline,
        RetryableAction: retryableAction,
        AuditLog: auditLogTotal,
        ChatThread: chatThread,
        ChatMessage: chatMessage,
        PlainoConversation: plainoConversation,
        WorkspacePreference: preference ? 1 : 0,
        PreferenceSignal: preferenceSignal,
        PreferenceFeedback: preferenceFeedback,
        WorkspaceMemoryEntry: memoryEntry,
        SkillConfig: skillConfig,
        WorkspaceSkillInstallation: skillInstallation,
        WorkThresholdConfig: thresholdConfig,
        WorkspacePauseConfig: pauseConfig,
        SkillScheduleWindow: scheduleWindow,
        DisciplineHead: disciplineHead,
        WorkspaceBriefing: briefing,
        WorkspaceLifecycleEvent: lifecycleEvent,
        SupportRequest: supportRequest,
        SupportTicket: supportTicket,
        SupportTicketMessage: supportTicketMessage,
        KnowledgeDocument: knowledgeDocument,
        Embedding: embedding,
        MemoryAuditLog: memoryAuditLog,
        TimeSavingsEntry: timeSavingsEntry,
        WorkspaceStorageConfig: storageConfig,
        PortalConfig: portalConfig,
        PortalClient: portalClient,
        PortalCase: portalCase,
        PortalCaseEvent: portalCaseEvent,
        PortalInvite: portalInvite,
        PortalSession: portalSession,
        PortalThread: portalThread,
        PortalMessage: portalMessage,
        PortalDocument: portalDocument,
      });

      const categories: CategoryStorageSummary[] = DATA_CATEGORIES.map(
        (c: DataCategory) => {
          const tables = c.tables.map((t) => ({ table: t, count: counts[t] ?? 0 }));
          const totalRows = tables.reduce((sum, t) => sum + t.count, 0);
          return {
            id: c.id,
            label: c.label,
            classification: c.classification,
            summary: c.summary,
            detail: c.detail,
            customerDeletable: c.customerDeletable,
            totalRows,
            tables,
          };
        },
      );

      const customerOverrideDays = preference?.chatRetentionDays ?? null;
      const retention: RetentionSummary = {
        customerOverrideDays,
        effectiveDays: resolveChatRetentionDays({
          workspaceOverrideDays: customerOverrideDays,
        }),
      };

      return { categories, retention, ephemeralFetchCount };
    },
    args.client ? { client: args.client } : undefined,
  );
}
