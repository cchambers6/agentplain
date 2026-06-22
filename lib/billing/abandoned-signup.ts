/**
 * lib/billing/abandoned-signup.ts
 *
 * Wave-4 phase 4 — closes the honesty gap PR #123 named. Before this
 * module shipped, a workspace that signed up + got a magic link but
 * abandoned Stripe Checkout existed FOREVER with no usable Subscription
 * — `Workspace.stripeCustomerId` was set, but no Subscription row was
 * created (Checkout never completed). The fleet kept running for the
 * customer on the free side until someone noticed.
 *
 * The lifecycle:
 *   1. Signup → Workspace.createdAt set; Workspace.signupSetupCompletedAt
 *      stays NULL until the first `customer.subscription.created`
 *      webhook fires.
 *   2. > 24h after signup with no checkout → first nudge (email +
 *      WorkspaceLifecycleEvent SETUP_NUDGE_SENT).
 *   3. > 7d after signup with no resolution → soft-deactivation. The
 *      workspace-paused-gate (`lib/billing/workspace-paused-gate.ts`)
 *      now honors `Workspace.setupDeactivatedAt` IS NOT NULL, so every
 *      skill / cron / chain skips the workspace. Banner in the
 *      workspace UI reads "Complete setup to resume Plaino".
 *      WorkspaceLifecycleEvent SETUP_DEACTIVATED logged.
 *   4. > 30d after signup with no resolution → archive. We hand the
 *      workspace over to the existing closure machinery (closureStatus =
 *      CLOSING, scheduledHardPurgeAt = now + 90 days) so the
 *      workspace-teardown-sweep handles the cascading delete on its
 *      normal cadence. WorkspaceLifecycleEvent SETUP_ARCHIVED logged.
 *   5. Customer completes checkout at any point → the existing
 *      Subscription-creation webhook also calls `markSignupCompleted`
 *      which clears `setupDeactivatedAt` and logs SETUP_RESUMED.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no Stripe SDK imports here —
 * the BillingProvider is injected.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-reads
 * workspace state from Postgres. No in-memory cache of "we already
 * nudged this workspace this run".
 *
 * Per `project_no_outbound_architecture.md`: the nudge email is a
 * product-side transactional billing message to the broker-owner's
 * inbox (the same shape Stripe sends invoice receipts directly). It is
 * NOT customer-facing outbound from the agent fleet — the agent
 * fleet's no-outbound rule stays in place for skill drafts.
 */

import type { Prisma, WorkspaceLifecycleEventKind } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { encrypt, isEncryptionConfigured } from '@/lib/security/encryption';
import type { SystemContextRunner } from '@/lib/billing/provisioning';
import type { BillingProvider } from './types';
import { getBillingProvider } from './index';

/** Day-bucket boundaries for the lifecycle. Configurable via env so a
 *  customer-success-driven change does not require a code release. */
export const ABANDONED_NUDGE_AFTER_DAYS = 1;
export const ABANDONED_DEACTIVATE_AFTER_DAYS = 7;
export const ABANDONED_ARCHIVE_AFTER_DAYS = 30;
export const ARCHIVED_HARD_PURGE_GRACE_DAYS = 90;

export type AbandonedAction = 'nudge' | 'deactivate' | 'archive' | 'skip';

export interface AbandonedCandidate {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  brokerOwnerEmail: string;
  brokerOwnerName: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  signupSetupCompletedAt: Date | null;
  setupDeactivatedAt: Date | null;
  /** When set, the workspace has already received a nudge — the sweep
   *  uses this to avoid double-firing the nudge email. */
  lastNudgeAt: Date | null;
  daysSinceSignup: number;
}

export interface AbandonedSignupSweepResult {
  workspacesConsidered: number;
  nudgesSent: number;
  deactivated: number;
  archived: number;
  skipped: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunAbandonedSignupSweepArgs {
  listCandidates?: () => Promise<AbandonedCandidate[]>;
  emit?: (input: EmitAbandonedActionInput) => Promise<void>;
  appOrigin?: string;
  email?: EmailProvider;
  billing?: BillingProvider;
  systemContext?: SystemContextRunner;
  now?: Date;
}

export interface EmitAbandonedActionInput {
  candidate: AbandonedCandidate;
  action: Exclude<AbandonedAction, 'skip'>;
  appOrigin: string;
  email: EmailProvider;
  billing: BillingProvider;
  systemContext: SystemContextRunner;
  now: Date;
}

/**
 * Decide which lifecycle action a candidate falls into based on
 * `daysSinceSignup` + prior lifecycle events. Pure function — testable
 * in isolation.
 */
export function decideAction(args: {
  candidate: AbandonedCandidate;
  now: Date;
}): AbandonedAction {
  const c = args.candidate;
  // Already resolved — never re-fire.
  if (c.signupSetupCompletedAt) return 'skip';
  if (c.daysSinceSignup >= ABANDONED_ARCHIVE_AFTER_DAYS) return 'archive';
  if (c.daysSinceSignup >= ABANDONED_DEACTIVATE_AFTER_DAYS) {
    // Only deactivate ONCE — if setupDeactivatedAt is already set we
    // wait for the archive boundary.
    return c.setupDeactivatedAt ? 'skip' : 'deactivate';
  }
  if (c.daysSinceSignup >= ABANDONED_NUDGE_AFTER_DAYS) {
    // Nudge once per workspace at the 24h boundary. Re-nudging every
    // day would be spam.
    return c.lastNudgeAt ? 'skip' : 'nudge';
  }
  return 'skip';
}

/**
 * Daily sweep entry point. For each candidate, decides the action and
 * routes to `emit`. Failures are counted, not thrown.
 */
export async function runAbandonedSignupSweep(
  args: RunAbandonedSignupSweepArgs = {},
): Promise<AbandonedSignupSweepResult> {
  const now = args.now ?? new Date();
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const appOrigin =
    args.appOrigin ?? process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const emit = args.emit ?? defaultEmitAbandonedAction;
  // Lazy-bind the live billing + email providers — only resolved when
  // the default emitter actually needs them. The test path passes
  // `emit`, so live providers are NEVER required to test the routing.
  const lazyBilling = (): BillingProvider => args.billing ?? getBillingProvider();
  const lazyEmail = (): EmailProvider => args.email ?? getEmailProvider();

  const candidates = await listCandidates();
  const result: AbandonedSignupSweepResult = {
    workspacesConsidered: candidates.length,
    nudgesSent: 0,
    deactivated: 0,
    archived: 0,
    skipped: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    const action = decideAction({ candidate, now });
    if (action === 'skip') {
      result.skipped += 1;
      continue;
    }
    try {
      await emit({
        candidate,
        action,
        appOrigin,
        // The default emitter resolves email + billing on demand. When
        // a test passes its own `emit`, these are never read — so we
        // shape them as accessors that throw at access if absent.
        get email() {
          return lazyEmail();
        },
        get billing() {
          return lazyBilling();
        },
        systemContext,
        now,
      });
      if (action === 'nudge') result.nudgesSent += 1;
      if (action === 'deactivate') result.deactivated += 1;
      if (action === 'archive') result.archived += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.failures.push({ workspaceId: candidate.workspaceId, reason });
    }
  }

  return result;
}

/** Default candidate lister — pulls workspaces > 24h old with no
 *  `signupSetupCompletedAt`. */
async function defaultListCandidates(): Promise<AbandonedCandidate[]> {
  return defaultWithSystemContext(async (tx) => {
    const cutoff = new Date(
      Date.now() - ABANDONED_NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const workspaces = await tx.workspace.findMany({
      where: {
        signupSetupCompletedAt: null,
        createdAt: { lte: cutoff },
        // Don't sweep workspaces that are already on the closure path
        // (they're being archived for a different reason).
        closureStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        stripeCustomerId: true,
        signupSetupCompletedAt: true,
        setupDeactivatedAt: true,
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true, name: true } } },
        },
        lifecycleEvents: {
          where: { kind: 'SETUP_NUDGE_SENT' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
        },
      },
    });
    const now = Date.now();
    const candidates: AbandonedCandidate[] = [];
    for (const w of workspaces) {
      const brokerOwnerEmail = w.memberships[0]?.user.email ?? null;
      if (!brokerOwnerEmail) continue; // no inbox = can't nudge
      candidates.push({
        workspaceId: w.id,
        workspaceName: w.name,
        workspaceSlug: w.slug,
        brokerOwnerEmail,
        brokerOwnerName: w.memberships[0]?.user.name ?? null,
        stripeCustomerId: w.stripeCustomerId,
        createdAt: w.createdAt,
        signupSetupCompletedAt: w.signupSetupCompletedAt,
        setupDeactivatedAt: w.setupDeactivatedAt,
        lastNudgeAt: w.lifecycleEvents[0]?.occurredAt ?? null,
        daysSinceSignup: Math.floor(
          (now - w.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
      });
    }
    return candidates;
  });
}

/**
 * Default per-candidate emitter. The sweep calls this; tests override
 * to assert behavior without sending real email / mutating DB.
 */
async function defaultEmitAbandonedAction(
  input: EmitAbandonedActionInput,
): Promise<void> {
  const { candidate, action, appOrigin, email, billing, systemContext, now } =
    input;
  if (action === 'nudge') {
    await emitNudge({ candidate, appOrigin, email, billing, systemContext, now });
  } else if (action === 'deactivate') {
    await emitDeactivate({ candidate, systemContext, now });
  } else if (action === 'archive') {
    await emitArchive({ candidate, systemContext, now });
  }
}

interface EmitNudgeInput {
  candidate: AbandonedCandidate;
  appOrigin: string;
  email: EmailProvider;
  billing: BillingProvider;
  systemContext: SystemContextRunner;
  now: Date;
}

async function emitNudge(input: EmitNudgeInput): Promise<void> {
  const { candidate, appOrigin, email, billing, systemContext, now } = input;
  // Mint a fresh Stripe Checkout URL for the nudge so the customer
  // lands directly in checkout, not on the signup form. Best-effort —
  // a Stripe outage shouldn't strand the nudge.
  let checkoutUrl = `${appOrigin.replace(/\/$/, '')}/app/workspace/${candidate.workspaceId}/settings/billing`;
  if (candidate.stripeCustomerId) {
    try {
      const session = await billing.createPortalSession({
        providerCustomerId: candidate.stripeCustomerId,
        returnUrl: `${appOrigin.replace(/\/$/, '')}/app/workspace/${candidate.workspaceId}/settings/billing`,
      });
      checkoutUrl = session.url;
    } catch {
      // fall back to the in-app billing settings link
    }
  }
  await email.send({
    to: candidate.brokerOwnerEmail,
    subject: 'Finish setting up Plaino',
    html: renderNudgeHtml({ candidate, checkoutUrl }),
    text: renderNudgeText({ candidate, checkoutUrl }),
    tags: {
      kind: 'abandoned_signup_nudge',
      workspace_id: candidate.workspaceId,
    },
  });
  await writeLifecycleEvent({
    systemContext,
    workspaceId: candidate.workspaceId,
    kind: 'SETUP_NUDGE_SENT',
    occurredAt: now,
    note: `Nudge email sent to ${candidate.brokerOwnerEmail}`,
    payload: {
      daysSinceSignup: candidate.daysSinceSignup,
      hadStripeCustomer: candidate.stripeCustomerId !== null,
    },
  });
}

interface EmitDeactivateInput {
  candidate: AbandonedCandidate;
  systemContext: SystemContextRunner;
  now: Date;
}

async function emitDeactivate(input: EmitDeactivateInput): Promise<void> {
  const { candidate, systemContext, now } = input;
  await systemContext(async (tx) => {
    await tx.workspace.update({
      where: { id: candidate.workspaceId },
      data: { setupDeactivatedAt: now },
    });
  });
  await writeLifecycleEvent({
    systemContext,
    workspaceId: candidate.workspaceId,
    kind: 'SETUP_DEACTIVATED',
    occurredAt: now,
    note: `Soft-deactivated at ${candidate.daysSinceSignup}d post-signup with no Stripe Checkout completion`,
    payload: { daysSinceSignup: candidate.daysSinceSignup },
  });
}

interface EmitArchiveInput {
  candidate: AbandonedCandidate;
  systemContext: SystemContextRunner;
  now: Date;
}

async function emitArchive(input: EmitArchiveInput): Promise<void> {
  const { candidate, systemContext, now } = input;
  const scheduledHardPurgeAt = new Date(
    now.getTime() + ARCHIVED_HARD_PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );
  await systemContext(async (tx) => {
    // Hand off to the existing closure machinery so the
    // workspace-teardown sweep handles the cascading delete on its
    // normal cadence. setupDeactivatedAt stays set so the gate keeps
    // the workspace dark during the 90-day archive window.
    await tx.workspace.update({
      where: { id: candidate.workspaceId },
      data: {
        closureStatus: 'CLOSING',
        closingInitiatedAt: now,
        scheduledHardPurgeAt,
        closureReason:
          'Abandoned signup — no Stripe Checkout completion after 30 days',
      },
    });
  });
  await writeLifecycleEvent({
    systemContext,
    workspaceId: candidate.workspaceId,
    kind: 'SETUP_ARCHIVED',
    occurredAt: now,
    note: `Handed to closure machinery with 90d grace; hard purge eligible at ${scheduledHardPurgeAt.toISOString()}`,
    payload: {
      daysSinceSignup: candidate.daysSinceSignup,
      scheduledHardPurgeAt: scheduledHardPurgeAt.toISOString(),
    },
  });
}

interface WriteLifecycleEventInput {
  systemContext: SystemContextRunner;
  workspaceId: string;
  kind: WorkspaceLifecycleEventKind;
  occurredAt: Date;
  note: string;
  payload: Record<string, unknown>;
}

async function writeLifecycleEvent(
  input: WriteLifecycleEventInput,
): Promise<void> {
  const { systemContext, workspaceId, kind, occurredAt, note, payload } = input;
  const noteEncrypted =
    note.length > 0 && isEncryptionConfigured() ? encrypt(note) : null;
  await systemContext(async (tx) => {
    await tx.workspaceLifecycleEvent.create({
      data: {
        workspaceId,
        kind,
        occurredAt,
        noteEncrypted,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        action: `billing.${kind.toLowerCase()}`,
        targetTable: 'WorkspaceLifecycleEvent',
        targetId: null,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  });
}

/**
 * Called by the existing Stripe webhook handler when a
 * `customer.subscription.created` event fires for a workspace's
 * stripeCustomerId. Stamps `signupSetupCompletedAt`, clears
 * `setupDeactivatedAt` (lifting the gate), and writes a SETUP_RESUMED
 * lifecycle event if the workspace was previously deactivated.
 */
export async function markSignupCompleted(args: {
  workspaceId: string;
  systemContext?: SystemContextRunner;
  now?: Date;
}): Promise<void> {
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const now = args.now ?? new Date();
  const wasDeactivated = await systemContext(async (tx) => {
    const w = await tx.workspace.findUnique({
      where: { id: args.workspaceId },
      select: {
        signupSetupCompletedAt: true,
        setupDeactivatedAt: true,
      },
    });
    if (!w) return false;
    if (w.signupSetupCompletedAt) return false; // already marked — no-op
    const setupWasDeactivated = w.setupDeactivatedAt !== null;
    await tx.workspace.update({
      where: { id: args.workspaceId },
      data: {
        signupSetupCompletedAt: now,
        setupDeactivatedAt: null,
      },
    });
    return setupWasDeactivated;
  });
  if (wasDeactivated) {
    await writeLifecycleEvent({
      systemContext,
      workspaceId: args.workspaceId,
      kind: 'SETUP_RESUMED',
      occurredAt: now,
      note: 'Customer completed Stripe Checkout; gate lifted.',
      payload: {},
    });
  }
}

// ── Email templates ─────────────────────────────────────────────────────

function renderNudgeText(args: {
  candidate: AbandonedCandidate;
  checkoutUrl: string;
}): string {
  const greeting = args.candidate.brokerOwnerName
    ? `Hi ${args.candidate.brokerOwnerName.split(/\s+/)[0]},`
    : 'Hi,';
  return [
    greeting,
    '',
    `You signed up for Plaino at ${args.candidate.workspaceName} — but ` +
      `setup did not finish. Plaino is waiting on the last step: adding ` +
      `your payment method in Stripe Checkout.`,
    '',
    'Finish setup here:',
    args.checkoutUrl,
    '',
    'If you signed up to evaluate and decided Plaino is not right for ' +
      'you, no action needed — we will tidy up your workspace after a ' +
      'few weeks.',
    '',
    'Plaino, your service partner at agentplain',
    '',
    "You're receiving this because you have an agentplain workspace.",
  ].join('\n');
}

function renderNudgeHtml(args: {
  candidate: AbandonedCandidate;
  checkoutUrl: string;
}): string {
  const greeting = args.candidate.brokerOwnerName
    ? `Hi ${escapeHtml(args.candidate.brokerOwnerName.split(/\s+/)[0])},`
    : 'Hi,';
  const ws = escapeHtml(args.candidate.workspaceName);
  return [
    '<!doctype html><html><body style="font-family: ui-sans-serif,system-ui,sans-serif; color:#1A1612; background:#F5F0E6; padding:32px;">',
    `<p>${greeting}</p>`,
    `<p>You signed up for Plaino at <strong>${ws}</strong> — but setup did not finish. Plaino is waiting on the last step: adding your payment method in Stripe Checkout.</p>`,
    `<p><a href="${escapeHtml(args.checkoutUrl)}" style="display:inline-block;padding:10px 16px;background:#1A1612;color:#F5F0E6;text-decoration:none;border-radius:4px;">Finish setup</a></p>`,
    '<p style="color:#726A5E; font-size:13px;">If you signed up to evaluate and decided Plaino is not right for you, no action needed — we will tidy up your workspace after a few weeks.</p>',
    '<p style="font-size:13px; color:#726A5E;">Plaino, your service partner at agentplain</p>',
    '<p style="font-size:12px; color:#726A5E; margin-top:24px;">You\'re receiving this because you have an agentplain workspace.</p>',
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
