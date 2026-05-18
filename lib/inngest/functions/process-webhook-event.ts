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
import { withSystemContext } from '@/lib/db';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { GmailMessageAdapter } from '@/lib/skills/gmail-fetcher';
import { runSkillChain } from '@/lib/skills/runner';
import {
  persistSkillRunArtifacts,
  summarizeOutcome,
} from '@/lib/skills/persist-artifacts';

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
    where: { processed: false },
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
    try {
      const adapter = new GmailMessageAdapter({ workspaceId: workspace.id });
      const { record, outcome } = await runSkillChain({
        workspace,
        event,
        fetcher: adapter,
        persister: adapter,
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
      processUnprocessedWebhookEvents(),
    ),
);
