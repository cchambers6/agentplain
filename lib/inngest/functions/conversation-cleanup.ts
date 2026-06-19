/**
 * Inngest cron: conversation-cleanup sweep.
 *
 * Daily at 04:10 UTC, delete Plaino chat threads (and their messages) that
 * have aged past their workspace's retention window. This is the enforcement
 * arm of the data-minimization commitment: chat is session-scoped by default
 * and only kept longer when the customer opts in. See
 * `lib/plaino/conversation-cleanup.ts` for the per-workspace logic and
 * `lib/plaino/chat-retention.ts` for the window resolution.
 *
 * Early-morning UTC so it runs in the quiet window across US time zones.
 * Per `feedback_cold_start_safe_agents` the sweep holds no in-memory state.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import {
  logConversationCleanup,
  runConversationCleanup,
} from '@/lib/plaino/conversation-cleanup';

export const CONVERSATION_CLEANUP_FUNCTION_ID =
  'agentplain-conversation-cleanup-sweep';
/** Daily at 04:10 UTC — quiet window across US time zones. */
export const CONVERSATION_CLEANUP_CRON = '10 4 * * *';
export const CONVERSATION_CLEANUP_TRIGGER_EVENT =
  'agentplain/conversation-cleanup.requested';

export const conversationCleanupSweepFn = inngest.createFunction(
  {
    id: CONVERSATION_CLEANUP_FUNCTION_ID,
    name: 'agentplain conversation cleanup sweep',
    triggers: [
      { cron: CONVERSATION_CLEANUP_CRON },
      { event: CONVERSATION_CLEANUP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(CONVERSATION_CLEANUP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: CONVERSATION_CLEANUP_FUNCTION_ID,
          schedule: CONVERSATION_CLEANUP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: CONVERSATION_CLEANUP_FUNCTION_ID },
            async () => {
              getLogger().info('conversation-cleanup sweep started', {
                boundary: 'inngest',
                function_id: CONVERSATION_CLEANUP_FUNCTION_ID,
              });
              const out = await runConversationCleanup();
              logConversationCleanup(out);
              return out;
            },
          ),
      ),
    ),
);
