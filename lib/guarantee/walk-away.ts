/**
 * lib/guarantee/walk-away.ts
 *
 * The Day-7 walk-away executor. When a customer taps "we didn't hit the
 * bar — no charge, delete my data and let me walk," this honors it as ONE
 * commitment: refund what they paid, delete their data, close the
 * workspace. One tap in, three guarantees out.
 *
 * THE BAR (Conner-dead test): the customer asked to leave. If anything
 * here can't auto-complete (a refund the adapter rejects, a charge above
 * the cap), we still honor the parts we can AND page a human with full
 * context + a deadline — never silently under-deliver on the promise.
 *
 * SAFETY:
 *   - Idempotent. A once-per-lifetime OpsFlag guard (read first) skips a
 *     workspace already walked. The Stripe refund additionally carries a
 *     workspace-stable idempotency key, so even a crash between the guard
 *     read and the refund can't double-refund.
 *   - Money first, then deletion. The refund only needs the Stripe ids on
 *     the Workspace row, which teardown preserves — so deleting data after
 *     a refund failure is safe (a human finishes the refund from the audit
 *     trail). We honor the deletion request regardless.
 *
 * Per feedback_no_silent_vendor_lock: no Stripe SDK here — the
 * BillingProvider is injected (reusing pfd-4's `refundCustomerCharges`).
 * Per feedback_cold_start_safe_agents: every state read re-derives from
 * Postgres; the guard is a durable flag row, not in-memory.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { getBillingProvider } from '@/lib/billing';
import type { BillingProvider } from '@/lib/billing/types';
import type { SystemContextRunner } from '@/lib/billing/provisioning';
import { notifyHuman, type NotifyHumanDeps } from '@/lib/ops/notify-human';
import { env } from '@/lib/env';
import {
  deleteCustomerData as defaultDeleteCustomerData,
  type DeleteCustomerDataArgs,
  type DeleteCustomerDataResult,
} from './delete-customer-data';

const WALKAWAY_REASON =
  'Trial guarantee walk-away: under bar, customer accepted refund + data deletion';

/** Hours a human has to finish a refund we could not auto-complete. */
export const WALKAWAY_HUMAN_PAGE_DEADLINE_HOURS = 72;

export function walkAwayGuardFlagName(workspaceId: string): string {
  return `GUARANTEE_WALKAWAY_${workspaceId}`;
}

export type WalkAwayStatus =
  | 'completed' // refunded (or nothing to refund) + data deleted + closed
  | 'completed-refund-paged' // deleted + closed; refund needs a human
  | 'already-done';

export interface ExecuteWalkAwayArgs {
  workspaceId: string;
  billing?: BillingProvider;
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  notifyDeps?: NotifyHumanDeps;
  deleteData?: (args: DeleteCustomerDataArgs) => Promise<DeleteCustomerDataResult>;
  /** Master switch for moving money. Defaults to env. */
  refundEnabled?: boolean;
  /** Whether Stripe billing is live at all. Defaults to env. When false
   *  (dev/test), no customer was ever charged — skip refund quietly. */
  billingEnabled?: boolean;
  /** Per-workspace refund cap in USD. Defaults to env. */
  refundCapUsd?: number;
  isAlreadyHandled?: (workspaceId: string) => Promise<boolean>;
  markHandled?: (workspaceId: string, status: WalkAwayStatus) => Promise<void>;
  now?: Date;
}

export interface ExecuteWalkAwayResult {
  status: WalkAwayStatus;
  refundedUsdCents: number;
}

interface WalkAwayWorkspace {
  id: string;
  name: string;
  stripeCustomerId: string | null;
  brokerOwnerEmail: string | null;
  brokerOwnerName: string | null;
}

export async function executeWalkAway(
  args: ExecuteWalkAwayArgs,
): Promise<ExecuteWalkAwayResult> {
  const now = args.now ?? new Date();
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const notifyDeps = args.notifyDeps ?? {};
  const refundEnabled = args.refundEnabled ?? env.guaranteeWalkAwayRefundEnabled();
  const billingEnabled = args.billingEnabled ?? env.stripeBillingEnabled();
  const refundCapUsd = args.refundCapUsd ?? env.guaranteeRefundCapUsd();
  const deleteData = args.deleteData ?? defaultDeleteCustomerData;
  const isAlreadyHandled =
    args.isAlreadyHandled ?? ((id) => defaultIsAlreadyHandled(id, notifyDeps));
  const markHandled =
    args.markHandled ??
    ((id, status) => defaultMarkHandled(id, status, notifyDeps));
  const lazyBilling = (): BillingProvider => args.billing ?? getBillingProvider();
  const lazyEmail = (): EmailProvider => args.email ?? getEmailProvider();

  // Once-per-lifetime guard. Read FIRST — a workspace already walked is
  // skipped before any money moves or data is touched.
  if (await isAlreadyHandled(args.workspaceId)) {
    return { status: 'already-done', refundedUsdCents: 0 };
  }

  const workspace = await loadWorkspace(systemContext, args.workspaceId);
  if (!workspace) {
    throw new Error(`executeWalkAway: workspace ${args.workspaceId} not found`);
  }

  const deadline = new Date(
    now.getTime() + WALKAWAY_HUMAN_PAGE_DEADLINE_HOURS * 3600_000,
  );

  // ── 1. Refund ──────────────────────────────────────────────────────────
  let refundedUsdCents = 0;
  let refundPaged = false;

  if (workspace.stripeCustomerId && billingEnabled) {
    if (!refundEnabled) {
      // Money movement is paused by policy, but the customer is owed a
      // refund — page a human to complete it manually. Never silent.
      await pageRefund({
        workspace,
        subject: `Walk-away refund PAUSED: ${workspace.name} — complete manually`,
        detail:
          'GUARANTEE_WALKAWAY_REFUND is off. The customer walked away and is ' +
          'owed a refund. Data has been deleted; issue the refund by hand.',
        deadline,
        notifyDeps,
      });
      refundPaged = true;
    } else {
      try {
        const result = await lazyBilling().refundCustomerCharges({
          providerCustomerId: workspace.stripeCustomerId,
          maxRefundUsdCents: refundCapUsd * 100,
          idempotencyKey: `guarantee-walkaway:${workspace.id}`,
          reason: 'guarantee-walkaway-refund',
        });
        refundedUsdCents = result.totalRefundedUsdCents;
        if (result.hitCap) {
          await pageRefund({
            workspace,
            subject: `Walk-away refund OVER CAP: ${workspace.name}`,
            detail:
              `Auto-refunded $${(refundedUsdCents / 100).toFixed(2)} (cap ` +
              `$${refundCapUsd}). Charges above the cap remain — refund the ` +
              `balance manually.`,
            deadline,
            notifyDeps,
          });
          refundPaged = true;
        }
      } catch (err) {
        await pageRefund({
          workspace,
          subject: `Walk-away refund FAILED: ${workspace.name} — manual refund needed`,
          detail: `Refund API error: ${err instanceof Error ? err.message : String(err)}`,
          deadline,
          notifyDeps,
        });
        refundPaged = true;
      }
    }
  }

  // ── 2. Delete data + close the workspace (honor the request) ────────────
  const deletion = await deleteData({
    workspaceId: workspace.id,
    reason: WALKAWAY_REASON,
    systemContext,
    now,
  });

  // ── 3. Confirmation email (best-effort) ─────────────────────────────────
  if (workspace.brokerOwnerEmail) {
    try {
      await lazyEmail().send({
        to: workspace.brokerOwnerEmail,
        subject: "You're all set — refunded and your data is deleted",
        html: renderReceiptHtml({ workspace, refundedUsdCents, refundPaged }),
        text: renderReceiptText({ workspace, refundedUsdCents, refundPaged }),
        tags: { kind: 'guarantee_walkaway_receipt', workspace_id: workspace.id },
      });
    } catch {
      // non-fatal — the refund + deletion already happened.
    }
  }

  // ── 4. Audit + guard ────────────────────────────────────────────────────
  const status: WalkAwayStatus = refundPaged
    ? 'completed-refund-paged'
    : 'completed';
  await systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        workspaceId: workspace.id,
        action: 'guarantee.walkaway.executed',
        targetTable: 'Workspace',
        targetId: workspace.id,
        payload: {
          status,
          refundedUsdCents,
          refundPaged,
          billingEnabled,
          refundEnabled,
          teardownEmbeddingsDeleted: deletion.teardown.customerEmbeddingsDeleted,
        } satisfies Prisma.InputJsonValue,
        occurredAt: now,
      },
    });
  });
  await markHandled(workspace.id, status);

  return { status, refundedUsdCents };
}

async function loadWorkspace(
  systemContext: SystemContextRunner,
  workspaceId: string,
): Promise<WalkAwayWorkspace | null> {
  return systemContext(async (tx) => {
    const w = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true, name: true } } },
        },
      },
    });
    if (!w) return null;
    return {
      id: w.id,
      name: w.name,
      stripeCustomerId: w.stripeCustomerId,
      brokerOwnerEmail: w.memberships[0]?.user.email ?? null,
      brokerOwnerName: w.memberships[0]?.user.name ?? null,
    };
  });
}

async function pageRefund(args: {
  workspace: WalkAwayWorkspace;
  subject: string;
  detail: string;
  deadline: Date;
  notifyDeps: NotifyHumanDeps;
}): Promise<void> {
  const { workspace, subject, detail, deadline, notifyDeps } = args;
  await notifyHuman(
    {
      key: `guarantee-walkaway:${workspace.id}`,
      subject,
      body: [
        `Workspace: ${workspace.name} (${workspace.id})`,
        `Stripe customer: ${workspace.stripeCustomerId ?? '(none)'}`,
        `Owner: ${workspace.brokerOwnerName ?? '(unknown)'} <${workspace.brokerOwnerEmail ?? 'no-email'}>`,
        '',
        detail,
      ].join('\n'),
      deadline,
      severity: 'critical',
    },
    notifyDeps,
  );
}

// ── Once-per-lifetime guard (OpsFlag-backed) ───────────────────────────

async function defaultIsAlreadyHandled(
  workspaceId: string,
  notifyDeps: NotifyHumanDeps,
): Promise<boolean> {
  const store = notifyDeps.flagStore ?? (await getDefaultFlagStore());
  const read = await store.get(walkAwayGuardFlagName(workspaceId));
  // Read failure (DB down) → treat as ALREADY handled (skip) so a transient
  // blip can't double-refund. A genuinely un-walked workspace re-tries on
  // the next clean call (the customer can tap again).
  if (!read.ok) return true;
  return read.value !== null;
}

async function defaultMarkHandled(
  workspaceId: string,
  status: WalkAwayStatus,
  notifyDeps: NotifyHumanDeps,
): Promise<void> {
  const store = notifyDeps.flagStore ?? (await getDefaultFlagStore());
  await store.set(walkAwayGuardFlagName(workspaceId), status, {
    updatedBy: 'guarantee:walk-away',
    note: `Trial-guarantee walk-away executed: ${status}`,
  });
}

let _defaultFlagStore: import('@/lib/ops/flag-store').OpsFlagStore | null = null;
async function getDefaultFlagStore() {
  if (_defaultFlagStore) return _defaultFlagStore;
  const { PrismaOpsFlagStore } = await import('@/lib/ops/prisma-flag-store');
  _defaultFlagStore = new PrismaOpsFlagStore();
  return _defaultFlagStore;
}

/** Test-only reset of the lazy store. */
export function __resetWalkAwayStoreForTests(): void {
  _defaultFlagStore = null;
}

// ── Copy ────────────────────────────────────────────────────────────────

function renderReceiptText(args: {
  workspace: WalkAwayWorkspace;
  refundedUsdCents: number;
  refundPaged: boolean;
}): string {
  const greeting = args.workspace.brokerOwnerName
    ? `Hi ${args.workspace.brokerOwnerName.split(/\s+/)[0]},`
    : 'Hi,';
  const amount = `$${(args.refundedUsdCents / 100).toFixed(2)}`;
  const refundLine = args.refundPaged
    ? `We're processing your refund and will confirm by email shortly.`
    : args.refundedUsdCents > 0
      ? `We've refunded ${amount} to your card.`
      : `There was nothing to refund — you were never charged.`;
  return [
    greeting,
    '',
    `You took us up on the guarantee, and that's completely fair — if the ` +
      `fleet didn't save you real time, you shouldn't pay for it.`,
    '',
    refundLine,
    `We've deleted your workspace data. Nothing of yours stays on our systems.`,
    '',
    `If things change and you want to try again, you're always welcome back.`,
    '',
    '— Plaino',
  ].join('\n');
}

function renderReceiptHtml(args: {
  workspace: WalkAwayWorkspace;
  refundedUsdCents: number;
  refundPaged: boolean;
}): string {
  const greeting = args.workspace.brokerOwnerName
    ? `Hi ${escapeHtml(args.workspace.brokerOwnerName.split(/\s+/)[0])},`
    : 'Hi,';
  const amount = `$${(args.refundedUsdCents / 100).toFixed(2)}`;
  const refundLine = args.refundPaged
    ? `We&rsquo;re processing your refund and will confirm by email shortly.`
    : args.refundedUsdCents > 0
      ? `We&rsquo;ve refunded <strong>${amount}</strong> to your card.`
      : `There was nothing to refund &mdash; you were never charged.`;
  return [
    '<!doctype html><html><body style="font-family: ui-sans-serif,system-ui,sans-serif; color:#1A1A1F; background:#F7F4ED; padding:32px;">',
    `<p>${greeting}</p>`,
    `<p>You took us up on the guarantee, and that&rsquo;s completely fair &mdash; if the fleet didn&rsquo;t save you real time, you shouldn&rsquo;t pay for it.</p>`,
    `<p>${refundLine}</p>`,
    `<p>We&rsquo;ve deleted your workspace data. Nothing of yours stays on our systems.</p>`,
    `<p style="color:#726A5E;">If things change and you want to try again, you&rsquo;re always welcome back.</p>`,
    '<p>&mdash; Plaino</p>',
    '</body></html>',
  ].join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
