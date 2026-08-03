/**
 * lib/guarantee/delete-customer-data.ts
 *
 * GDPR-clean customer-data removal for the trial-guarantee walk-away.
 * When a customer takes the Day-7 walk-away ("no charge — delete my data
 * and let me leave"), this is the deletion half of honoring it.
 *
 * It does NOT reinvent the cascade. The workspace-teardown machinery
 * already enumerates every workspace-scoped tenant table and deletes it
 * under operator RLS (lib/customer-files/deletion.ts#tearDownWorkspaceData
 * — extended in this PR to include the time-savings ledger). This module
 * orchestrates that proven path + flips the workspace to CLOSED so it
 * stays dark, and writes a durable audit row. One job, reusing the
 * GDPR-clean primitive rather than a second, drift-prone delete list.
 *
 * What gets deleted (via tearDownWorkspaceData): every workspace-scoped
 * row carrying customer data — knowledge docs + embeddings, approvals,
 * handoffs, webhook events + subscriptions, integration credentials
 * (OAuth tokens), integration health + retry queues, onboarding state,
 * chat threads + messages, memory entries + the memory access audit log,
 * BYO storage config (encrypted S3/KMS keys), briefings, preferences,
 * compliance flags, counsel redlines, capability proposals + creator
 * briefs tagged to the workspace, teams + team memberships, discipline
 * heads, support requests and support tickets + their threads, the whole
 * client-portal tree (portal config, end clients, cases + timeline
 * events, invites, sessions, threads, encrypted messages, uploaded
 * documents), the customer's own AuditLog trail, the time-savings
 * ledger, and converted Inquiry PII. The authoritative list is the
 * `SWEPT_MODELS` manifest in lib/customer-files/deletion.ts, which a
 * DMMF-derived coverage test holds to the Prisma schema.
 *
 * What is PRESERVED by design: the Workspace + Membership rows (now empty
 * of tenant data) and the Subscription / BillingEvent / WorkspaceInvoice /
 * LlmUsageRecord billing history. Refund reconciliation needs the Stripe
 * ids on the Workspace row and the metered-usage rows behind any charge
 * already reported to Stripe. This mirrors the existing closure path
 * (lib/customer-data/closure.ts) — closure is a state on the workspace,
 * not a row deletion. Note the workspace's own AuditLog rows ARE deleted
 * (Conner, 2026-06-18: "your data is yours; we delete on cancel"); the
 * durable record of the deletion itself is the audit row written below,
 * after the sweep.
 *
 * Per feedback_no_quick_fixes: the right fix is reusing the audited
 * teardown, not a hand-rolled `prisma.deleteMany` per table that drifts
 * out of sync the next time a tenant table is added.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import type { SystemContextRunner } from '@/lib/billing/provisioning';
import {
  tearDownWorkspaceData,
  type TearDownWorkspaceDataResult,
} from '@/lib/customer-files/deletion';

export interface DeleteCustomerDataArgs {
  workspaceId: string;
  /** Free-text reason stamped on the workspace closure + audit row. */
  reason: string;
  /** Override the system-context runner (tests). */
  systemContext?: SystemContextRunner;
  /** Override the teardown primitive (tests). Defaults to the real
   *  audited cascade. */
  tearDown?: typeof tearDownWorkspaceData;
  now?: Date;
}

export interface DeleteCustomerDataResult {
  workspaceId: string;
  /** Per-table deletion counts from the cascade — surfaced for the audit
   *  payload so the deletion is provable after the fact. */
  teardown: TearDownWorkspaceDataResult;
  closedAt: Date;
}

/**
 * Delete a workspace's customer data and mark it CLOSED. Idempotent at
 * the data layer (the cascade deletes are deleteMany — a second run finds
 * nothing and the workspace is already CLOSED). Callers that move money
 * (the walk-away executor) guard the whole operation with a once-per-
 * lifetime OpsFlag; this primitive stays focused on the deletion.
 */
export async function deleteCustomerData(
  args: DeleteCustomerDataArgs,
): Promise<DeleteCustomerDataResult> {
  if (!args.workspaceId) {
    throw new Error('deleteCustomerData requires a workspaceId');
  }
  const now = args.now ?? new Date();
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const tearDown = args.tearDown ?? tearDownWorkspaceData;

  // 1. Cascade-delete every workspace-scoped tenant row (the GDPR-clean
  //    primitive). Runs under operator RLS internally.
  const teardown = await tearDown({ workspaceId: args.workspaceId });

  // 2. Flip the workspace to CLOSED (no grace window — the customer asked
  //    to leave now) and write the durable audit row, in one tx.
  await systemContext(async (tx) => {
    await tx.workspace.update({
      where: { id: args.workspaceId },
      data: {
        closureStatus: 'CLOSED',
        closedAt: now,
        closureReason: args.reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        workspaceId: args.workspaceId,
        action: 'guarantee.customer_data_deleted',
        targetTable: 'Workspace',
        targetId: args.workspaceId,
        payload: {
          reason: args.reason,
          teardown: teardown as unknown as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonValue,
        occurredAt: now,
      },
    });
  });

  return { workspaceId: args.workspaceId, teardown, closedAt: now };
}
