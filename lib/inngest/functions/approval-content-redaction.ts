/**
 * Inngest cron: approval-content-redaction sweep.
 *
 * Daily at 04:20 UTC, redact the CONTENT of approval-queue items that were
 * decided more than 7 days ago. The item survives for the customer's audit
 * record (what kind of work, when, who decided); the draft body and any
 * referenced customer data are replaced with a structural stub. See
 * `lib/approvals/content-ephemerality.ts`.
 *
 * Only DECIDED items past the window are touched, so the live approval flow
 * (which reads payloads at decision time) is never affected.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { redactExpiredApprovalContent } from '@/lib/approvals/content-ephemerality';

export const APPROVAL_REDACTION_FUNCTION_ID =
  'agentplain-approval-content-redaction-sweep';
/** Daily at 04:20 UTC — just after conversation-cleanup. */
export const APPROVAL_REDACTION_CRON = '20 4 * * *';
export const APPROVAL_REDACTION_TRIGGER_EVENT =
  'agentplain/approval-content-redaction.requested';

export const approvalContentRedactionSweepFn = inngest.createFunction(
  {
    id: APPROVAL_REDACTION_FUNCTION_ID,
    name: 'agentplain approval content redaction sweep',
    triggers: [
      { cron: APPROVAL_REDACTION_CRON },
      { event: APPROVAL_REDACTION_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(APPROVAL_REDACTION_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: APPROVAL_REDACTION_FUNCTION_ID,
          schedule: APPROVAL_REDACTION_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: APPROVAL_REDACTION_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: APPROVAL_REDACTION_FUNCTION_ID,
              });
              logger.info('approval-content-redaction sweep started');
              const out = await redactExpiredApprovalContent();
              logger.info('approval-content-redaction sweep finished', {
                candidates_scanned: out.candidatesScanned,
                redacted: out.redacted,
                already_redacted: out.alreadyRedacted,
              });
              return out;
            },
          ),
      ),
    ),
);
