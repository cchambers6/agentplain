/**
 * Inngest function: process unprocessed WebhookEvent rows.
 *
 * For each `WebhookEvent` with `processed=false`, the function:
 *   1. Loads the WebhookSubscription + IntegrationCredential
 *   2. Builds a GmailMessageAdapter (production MessageFetcher + DraftPersister)
 *   3. Runs the skill chain via `lib/skills/runner.ts`
 *   4. Marks the WebhookEvent processed (or records the error for retry)
 *
 * **DECLARED, NOT CRON-ACTIVE.** Per the PR brief: this function ships
 * with NO `triggers` so it does not fire automatically. Conner flips
 * the cron on post-GCP by adding a `cron` entry to the function config
 * once Gmail is OAuth-connected. The function shape + skill wiring is
 * what we want validated before the live data arrives.
 *
 * Per `feedback_cold_start_safe_agents.md`: the function reads durable
 * state on every fire. There is no in-memory cache across runs.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the function imports
 * `GmailMessageAdapter` (which speaks `MessageFetcher` + `DraftPersister`)
 * and the skill runner; it never imports `googleapis` directly.
 *
 * Per `project_no_outbound_architecture.md`: every code path here is
 * read or draft. The Gmail adapter has no send method exposed.
 */

import { prisma } from '@/lib/db/prisma';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { GmailMessageAdapter } from '@/lib/skills/gmail-fetcher';
import { runSkillChain } from '@/lib/skills/runner';

export const PROCESS_WEBHOOK_EVENT_FUNCTION_ID = 'agentplain-process-webhook-event';

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
      const adapter = new GmailMessageAdapter({ credential });
      const { record } = await runSkillChain({
        workspace,
        event,
        fetcher: adapter,
        persister: adapter,
      });
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: workspace.id,
          action: 'skills.loop.completed',
          targetTable: 'WebhookEvent',
          targetId: event.id,
          payload: {
            category: record.outcome.category,
            draftPersisted: record.outcome.draft?.persisted ?? false,
            steps: record.steps.map((s) => ({ step: s.step, ok: s.ok })),
          },
        },
      });
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
 * Inngest function — DECLARED, NOT TRIGGERED. To activate post-GCP:
 *
 *   1. Add a `triggers: [{ cron: '*\\u002f5 * * * *' }]` (or event trigger)
 *      to the createFunction call below.
 *   2. Set `INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT=false` (or
 *      leave unset). The disable-gate defaults to active.
 *   3. Confirm Conner's Gmail is OAuth-connected (`IntegrationCredential`
 *      row exists, `WebhookSubscription` is ACTIVE).
 *
 * Leaving the trigger empty means Inngest registers the function but
 * never fires it on its own. It can still be invoked via the dev
 * console for smoke-testing once Gmail is connected.
 */
/**
 * Event-only trigger — Conner adds a `{ cron: ... }` here once Gmail is
 * connected. The event trigger means the function is callable via
 * `inngest.send({ name: 'agentplain/process-webhook-event.requested' })`
 * for smoke-testing on demand, but does NOT fire on a schedule.
 */
export const PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT = 'agentplain/process-webhook-event.requested';

export const processWebhookEventFn = inngest.createFunction(
  {
    id: PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
    name: 'agentplain process unprocessed WebhookEvent rows',
    triggers: [{ event: PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT }],
  },
  async () =>
    runWithDisableGate(PROCESS_WEBHOOK_EVENT_FUNCTION_ID, () =>
      processUnprocessedWebhookEvents(),
    ),
);
