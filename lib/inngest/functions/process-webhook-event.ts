/**
 * Inngest function: process unprocessed WebhookEvent rows.
 *
 * For each `WebhookEvent` with `processed=false`, the function:
 *   1. Loads the WebhookSubscription + IntegrationCredential
 *   2. Builds a GmailMessageAdapter (production MessageFetcher + DraftPersister)
 *   3. Runs the skill chain via `lib/skills/runner.ts`
 *   4. Persists the artifacts (HandoffLogEntry rows + WorkApprovalQueueItem
 *      when a draft was produced) via `lib/skills/persist-artifacts.ts`
 *   5. Marks the WebhookEvent processed (or records the error for retry)
 *
 * Cron: every 5 minutes. Gmail Pub/Sub pushes typically arrive within
 * seconds; the 5-minute sweep ensures backlog drains promptly without
 * pummeling the LLM provider on every single Pub/Sub callback.
 *
 * Per `feedback_cold_start_safe_agents.md`: the function reads durable
 * state on every fire. There is no in-memory cache across runs.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the function imports
 * `GmailMessageAdapter` (which now wraps the Gmail MCP server — see
 * `lib/integrations/gmail-mcp/`) and the skill runner; it never imports
 * `googleapis` directly. The MCP-first migration (Phase A) confines all
 * Gmail SDK calls to `lib/integrations/google/` + `lib/integrations/gmail-mcp/server.ts`.
 *
 * Per `project_no_outbound_architecture.md`: every code path here is
 * read or draft. The Gmail adapter has no send method exposed.
 */

import { prisma } from '@/lib/db/prisma';
import { withSystemContext, SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { GmailMessageAdapter } from '@/lib/skills/gmail-fetcher';
import { OutlookMessageAdapter } from '@/lib/skills/outlook-fetcher';
import { runSkillChain } from '@/lib/skills/runner';
import {
  persistSkillRunArtifacts,
  summarizeOutcome,
} from '@/lib/skills/persist-artifacts';
import type { DraftPersister, MessageFetcher } from '@/lib/skills/types';
import { getWorkspacePreference } from '@/lib/preferences';
import { retrieveCustomerContext } from '@/lib/customer-files';

export const PROCESS_WEBHOOK_EVENT_FUNCTION_ID = 'agentplain-process-webhook-event';
/** Every 5 minutes (UTC). Drains backlog without hammering the LLM. */
export const PROCESS_WEBHOOK_EVENT_CRON = '*/5 * * * *';
/** On-demand trigger for smoke-testing from the Inngest dev console. */
export const PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT = 'agentplain/process-webhook-event.requested';

export interface ProcessWebhookEventResult {
  considered: number;
  succeeded: number;
  failures: Array<{ webhookEventId: string; reason: string }>;
}

/**
 * Sweep unprocessed WebhookEvent rows and run the skill chain on each.
 * Returns a summary the cron framework can log.
 *
 * `limit` caps how many events one sweep processes. Default 25 — small
 * enough that one fire stays under any provider rate-limit budget,
 * large enough that a backlog drains in a few fires.
 */
export async function processUnprocessedWebhookEvents(
  limit: number = 25,
): Promise<ProcessWebhookEventResult> {
  const events = await prisma.webhookEvent.findMany({
    // This processor runs the EMAIL skill chain (read → categorize → draft),
    // so it only consumes Gmail/Outlook push events. Other providers
    // (DocuSign Connect, etc.) land WebhookEvent rows for audit/replay but
    // are drained by their own consumers, not this one.
    where: { processed: false, subscription: { provider: { in: ['GOOGLE', 'M365'] } } },
    orderBy: { receivedAt: 'asc' },
    take: limit,
    include: {
      subscription: {
        include: {
          credential: true,
          workspace: {
            select: { id: true, slug: true, name: true, vertical: true },
          },
        },
      },
    },
  });
  const result: ProcessWebhookEventResult = {
    considered: events.length,
    succeeded: 0,
    failures: [],
  };
  for (const event of events) {
    const credential = event.subscription.credential;
    const workspace = event.subscription.workspace;
    if (!credential || credential.status !== 'ACTIVE' || !workspace) {
      result.failures.push({
        webhookEventId: event.id,
        reason: `credential or workspace unavailable (status=${credential?.status})`,
      });
      continue;
    }
    // Type-narrow + defend: the query already filters to email providers, so
    // this guard is unreachable in practice — it keeps the call site sound if
    // the query filter ever drifts.
    if (credential.provider !== 'GOOGLE' && credential.provider !== 'M365') {
      result.failures.push({
        webhookEventId: event.id,
        reason: `non-email provider ${credential.provider} is not handled by the email skill chain`,
      });
      continue;
    }
    try {
      const adapter = buildAdapterForProvider(credential.provider, workspace.id);

      // Read durable state per fire (no in-memory cache between events —
      // feedback_cold_start_safe_agents.md).
      const workspacePreferences = await getWorkspacePreference(
        SYSTEM_OPERATOR_CONTEXT,
        workspace.id,
      );

      // Customer-context retrieval runs after ReadSkill resolves —
      // pass a resolver so the runner uses the real message body as the
      // query, not the Pub/Sub envelope. Best-effort: a retrieval error
      // never fails the loop (the runner swallows).
      const customerContextResolver = async (query: string) =>
        retrieveCustomerContext({ workspaceId: workspace.id, query });

      const { record, outcome } = await runSkillChain({
        workspace,
        event,
        fetcher: adapter,
        persister: adapter,
        workspacePreferences,
        customerContextResolver,
      });

      const artifacts = await persistSkillRunArtifacts({
        workspaceId: workspace.id,
        record,
      });

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: null,
        },
      });
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            workspaceId: workspace.id,
            action: 'skills.loop.completed',
            targetTable: 'WebhookEvent',
            targetId: event.id,
            payload: {
              summary: summarizeOutcome(outcome),
              handoffsWritten: artifacts.handoffsWritten,
              approvalsWritten: artifacts.approvalsWritten,
              approvalId: artifacts.approvalId,
              steps: record.steps.map((s) => ({ step: s.step, ok: s.ok })),
            },
          },
        }),
      );
      result.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Per-event capture: this is the load-bearing path that previously
      // went silent when the skill chain or adapter threw mid-batch. Tag
      // with workspace + event ids so Sentry's "issues by tag" view groups
      // by workspace and the cron sweep stays loud, not lossy.
      reportInngestItemFailure(err, {
        functionId: PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
        extraTags: {
          webhook_event_id: event.id,
          workspace_id: workspace.id,
          provider: credential.provider,
        },
      });
      result.failures.push({ webhookEventId: event.id, reason: message });
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { error: message },
      });
    }
  }
  return result;
}

/**
 * Pick the right MessageFetcher/DraftPersister for the credential's
 * provider. Both adapters speak the same `MessageFetcher` + `DraftPersister`
 * interfaces; the runner does not care which side it gets.
 *
 * New providers (Phase B+) plug in here without changing the runner.
 */
function buildAdapterForProvider(
  provider: 'GOOGLE' | 'M365',
  workspaceId: string,
): MessageFetcher & DraftPersister {
  switch (provider) {
    case 'GOOGLE':
      return new GmailMessageAdapter({ workspaceId });
    case 'M365':
      return new OutlookMessageAdapter({ workspaceId });
    default: {
      const _exhaustive: never = provider;
      throw new Error(`buildAdapterForProvider: unsupported provider ${_exhaustive}`);
    }
  }
}

/**
 * Inngest function — fires on a 5-minute cron AND on the on-demand
 * `agentplain/process-webhook-event.requested` event (use from the dev
 * console to drain queued events ahead of the next tick).
 *
 * Disable-gate: set `INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT=true`
 * to pause without redeploying.
 */
export const processWebhookEventFn = inngest.createFunction(
  {
    id: PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
    name: 'agentplain process unprocessed WebhookEvent rows',
    triggers: [
      { cron: PROCESS_WEBHOOK_EVENT_CRON },
      { event: PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(PROCESS_WEBHOOK_EVENT_FUNCTION_ID, () =>
      withInngestErrorReporting(
        { functionId: PROCESS_WEBHOOK_EVENT_FUNCTION_ID },
        () => processUnprocessedWebhookEvents(),
      ),
    ),
);
