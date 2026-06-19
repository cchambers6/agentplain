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
        tx.auditLog.count({
          where: { workspaceId: wid, action: STORAGE_EPHEMERAL_FETCH_ACTION },
        }),
      ]);

      const counts: Record<string, number> = {
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
      };

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
