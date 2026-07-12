/**
 * Inngest cron: approval-notification digest sweep.
 *
 * Weekday mornings (~8:30am ET). The counterpart of the immediate
 * approval-ready email in `lib/push/notify.ts`: partners whose
 * `approvalEmailMode` is 'business_hours' or 'digest' have their
 * after-hours (or all) pings HELD rather than sent — this sweep is what
 * delivers them, as one "N drafts are waiting" summary. Held is delayed,
 * never lost: the summary is derived from the durable PENDING queue, so
 * anything still waiting gets counted no matter when it landed
 * (feedback_cold_start_safe_agents — no held-notification table, no
 * in-memory state; the queue itself is the state).
 *
 * Workspaces on the default 'always' mode are skipped — they already got
 * an email per draft; a second morning summary would be noise.
 *
 * Idempotent per (workspace, UTC day) via an AuditLog row, so a cron
 * retry never double-emails.
 *
 * Per `project_no_outbound_architecture.md`: this is a product-side email
 * to the customer's OWN inbox about their own queue.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { getEmailProvider } from '@/lib/email';
import type { EmailProvider } from '@/lib/email';
import { env } from '@/lib/env';
import {
  asApprovalEmailMode,
  renderApprovalReadyEmail,
} from '@/lib/notifications/approval-ready-email';
import { servicePartnerForWorkspace } from '@/lib/onboarding/service-partner';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const APPROVAL_DIGEST_FUNCTION_ID = 'agentplain-approval-digest-sweep';
/** Weekdays 12:30 UTC ≈ 8:30am ET (EDT) — after the weekly-report Friday
 *  fire so the two morning emails keep a stable order. */
export const APPROVAL_DIGEST_CRON = '30 12 * * 1-5';
export const APPROVAL_DIGEST_TRIGGER_EVENT =
  'agentplain/approval-digest-sweep.requested';
export const APPROVAL_DIGEST_SENT_ACTION = 'approval_digest.sent';

type SystemContextRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

export interface ApprovalDigestSweepResult {
  workspacesConsidered: number;
  digestsSent: number;
  skippedImmediateMode: number;
  skippedNothingPending: number;
  skippedAlreadySentToday: number;
  skippedNoRecipient: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface DigestCandidate {
  id: string;
  name: string;
  approvalEmailMode: string | null;
  pendingCount: number;
  brokerOwnerEmails: string[];
}

export interface RunApprovalDigestSweepArgs {
  /** Override the candidate lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<DigestCandidate[]>;
  systemContext?: SystemContextRunner;
  email?: EmailProvider;
  appOrigin?: string;
  now?: Date;
}

export async function runApprovalDigestSweep(
  args: RunApprovalDigestSweepArgs = {},
): Promise<ApprovalDigestSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const systemContext = args.systemContext ?? withSystemContext;
  const now = args.now ?? new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const origin = (args.appOrigin ?? env.appPublicOrigin()).replace(/\/$/, '');

  const candidates = await listCandidates();
  const result: ApprovalDigestSweepResult = {
    workspacesConsidered: candidates.length,
    digestsSent: 0,
    skippedImmediateMode: 0,
    skippedNothingPending: 0,
    skippedAlreadySentToday: 0,
    skippedNoRecipient: 0,
    failures: [],
  };

  for (const ws of candidates) {
    try {
      // 'always' partners were emailed per draft as each landed.
      if (asApprovalEmailMode(ws.approvalEmailMode) === 'always') {
        result.skippedImmediateMode += 1;
        continue;
      }
      if (ws.pendingCount === 0) {
        result.skippedNothingPending += 1;
        continue;
      }
      if (ws.brokerOwnerEmails.length === 0) {
        result.skippedNoRecipient += 1;
        continue;
      }
      const already = await systemContext((tx) =>
        tx.auditLog.findFirst({
          where: {
            workspaceId: ws.id,
            action: APPROVAL_DIGEST_SENT_ACTION,
            targetId: dayKey,
          },
          select: { id: true },
        }),
      );
      if (already) {
        result.skippedAlreadySentToday += 1;
        continue;
      }

      const rendered = renderApprovalReadyEmail({
        count: ws.pendingCount,
        workspaceName: ws.name,
        partner: servicePartnerForWorkspace(ws.id),
        approvalsUrl: `${origin}/app/workspace/${ws.id}/approvals`,
        flavor: 'digest',
      });
      const email = args.email ?? getEmailProvider();
      for (const to of ws.brokerOwnerEmails) {
        await email.send({
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          tags: { kind: 'approval_digest', workspace_id: ws.id },
        });
      }

      await systemContext((tx) =>
        tx.auditLog.create({
          data: {
            workspaceId: ws.id,
            action: APPROVAL_DIGEST_SENT_ACTION,
            targetTable: 'WorkApprovalQueueItem',
            targetId: dayKey,
            payload: {
              pendingCount: ws.pendingCount,
              to: ws.brokerOwnerEmails,
            } satisfies Prisma.InputJsonValue,
          },
        }),
      );
      result.digestsSent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: APPROVAL_DIGEST_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'send-digest' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function defaultListCandidates(): Promise<DigestCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        closureStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        preference: { select: { approvalEmailMode: true } },
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          select: { user: { select: { email: true } } },
        },
        _count: {
          select: {
            workApprovalItems: { where: { status: 'PENDING' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      approvalEmailMode: ws.preference?.approvalEmailMode ?? null,
      pendingCount: ws._count.workApprovalItems,
      brokerOwnerEmails: ws.memberships
        .map((m) => m.user.email)
        .filter((e): e is string => typeof e === 'string' && e.length > 0),
    }));
  });
}

export const approvalDigestSweepFn = inngest.createFunction(
  {
    id: APPROVAL_DIGEST_FUNCTION_ID,
    name: 'agentplain approval-notification morning digest',
    triggers: [
      { cron: APPROVAL_DIGEST_CRON },
      { event: APPROVAL_DIGEST_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(APPROVAL_DIGEST_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: APPROVAL_DIGEST_FUNCTION_ID,
          schedule: APPROVAL_DIGEST_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: APPROVAL_DIGEST_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: APPROVAL_DIGEST_FUNCTION_ID,
              });
              logger.info('approval digest sweep started');
              const out = await runApprovalDigestSweep();
              logger.info('approval digest sweep finished', {
                considered: out.workspacesConsidered,
                digests_sent: out.digestsSent,
                skipped_immediate_mode: out.skippedImmediateMode,
                skipped_nothing_pending: out.skippedNothingPending,
                skipped_already_sent_today: out.skippedAlreadySentToday,
                skipped_no_recipient: out.skippedNoRecipient,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
