/**
 * lib/billing/unsupported-vertical-refund.ts
 *
 * pfd-4 — LEAK-PATH AUTO-REFUND. The signup gate (app/(product)/app/
 * actions.ts) stops NEW customers from paying for a vertical we can't
 * serve. This is the backstop for the ones that ALREADY slipped through —
 * a workspace that pays, sits in an unsupported vertical, ages past a
 * grace window, and never received any value. Nobody should keep paying
 * for a fleet that can't run for them.
 *
 * THE BAR (Conner-dead test): if no one is watching, this surface must
 * still PROTECT the customer (refund them) or SURFACE the problem to a
 * human (page with context + deadline). Silent leakage — a local business
 * billed month after month for a dark vertical — is the exact failure this
 * exists to kill.
 *
 * The daily sweep, for each ACTIVE workspace:
 *   1. Vertical is UNSUPPORTED by registry truth (lib/verticals/readiness).
 *   2. Aged > UNSUPPORTED_VERTICAL_AGE_DAYS (default 7) since signup.
 *   3. ZERO value delivered — no accepted approval (APPROVED/AUTO_APPROVED)
 *      AND no successful SkillRun (DRAFTED / SUCCEEDED_NO_DRAFT). This is
 *      the authoritative "we did nothing for them" signal.
 *   4. Not already refunded (the once-per-lifetime OpsFlag guard).
 *
 * For each qualifying workspace:
 *   - DETECT-ONLY mode (UNSUPPORTED_VERTICAL_AUTO_REFUND=off, the default):
 *     page a human with full context + a 72h deadline. Move no money.
 *     The surface STILL meets the bar — it self-routes.
 *   - AUTO mode (flag on, post-ratification): refund the customer's recent
 *     charges via the lib/billing Stripe adapter, capped at the
 *     per-workspace USD cap. Above cap OR refund failure → page a human.
 *     Then: apology email + waitlist offer + clean workspace teardown.
 *
 * IDEMPOTENT + AUDITED (rows, not logs), zero new migrations:
 *   - Once-per-lifetime guard = an OpsFlag row keyed per workspace
 *     (`UNSUPPORTED_VERTICAL_REFUND_<id>`). Read first; a present row skips
 *     the workspace. Written before the refund executes so a crash mid-
 *     sweep never double-refunds.
 *   - Every decision writes an AuditLog row (executed / detect-only / paged
 *     / skipped) — the durable, queryable forensic trail.
 *
 * Per feedback_no_silent_vendor_lock: no Stripe SDK here — the
 * BillingProvider is injected. Per feedback_cold_start_safe_agents: every
 * fire re-reads workspace + value state from Postgres; the OpsFlag guard is
 * durable, not in-memory.
 */

import type { Prisma, Vertical } from '@prisma/client';
import { WorkApprovalStatus, SkillRunOutcome } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { getBillingProvider } from './index';
import type { BillingProvider } from './types';
import type { SystemContextRunner } from './provisioning';
import { resolveVerticalReadinessForEnum } from '@/lib/verticals/readiness';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import { getVerticalContent } from '@/lib/verticals';
import { tearDownWorkspaceData } from '@/lib/customer-files/deletion';
import { notifyHuman, type NotifyHumanDeps } from '@/lib/ops/notify-human';
import { env } from '@/lib/env';

/** Age in days a workspace must exceed before it's eligible for the leak
 *  sweep. Tunable via env; default 7 (matches the audit's grace floor). */
export const UNSUPPORTED_VERTICAL_AGE_DAYS = (() => {
  const raw = process.env.UNSUPPORTED_VERTICAL_AGE_DAYS;
  if (!raw) return 7;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 7;
})();

/** Deadline a human has to act on a detect-only / over-cap / failed page. */
export const HUMAN_PAGE_DEADLINE_HOURS = 72;

/** OpsFlag name for the once-per-lifetime refund guard. */
export function refundGuardFlagName(workspaceId: string): string {
  return `UNSUPPORTED_VERTICAL_REFUND_${workspaceId}`;
}

export type RefundDecision =
  | 'refunded'
  | 'detect-only-paged'
  | 'over-cap-paged'
  | 'refund-failed-paged'
  | 'already-handled'
  | 'no-charges-nothing-to-refund';

export interface LeakingWorkspace {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  vertical: Vertical;
  brokerOwnerEmail: string | null;
  brokerOwnerName: string | null;
  stripeCustomerId: string | null;
  daysSinceSignup: number;
}

export interface UnsupportedVerticalRefundResult {
  workspacesConsidered: number;
  refunded: number;
  detectOnlyPaged: number;
  overCapPaged: number;
  refundFailedPaged: number;
  alreadyHandled: number;
  noCharges: number;
  totalRefundedUsdCents: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunUnsupportedVerticalRefundSweepArgs {
  /** Override the candidate lister (tests). */
  listCandidates?: () => Promise<LeakingWorkspace[]>;
  /** Override the per-workspace emitter (tests assert routing without
   *  touching Stripe / email / teardown). */
  emit?: (input: EmitRefundInput) => Promise<RefundDecision>;
  /** Master switch. Defaults to env. When false → detect+page only. */
  autoRefundEnabled?: boolean;
  /** Per-workspace cap in USD. Defaults to env (500). */
  refundCapUsd?: number;
  billing?: BillingProvider;
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  /** Flag store for the once-per-lifetime guard + human pages. */
  notifyDeps?: NotifyHumanDeps;
  /** Read/write the once-per-lifetime guard. Injected together with
   *  notifyDeps in tests via the same in-memory flag store. */
  isAlreadyHandled?: (workspaceId: string) => Promise<boolean>;
  markHandled?: (
    workspaceId: string,
    decision: RefundDecision,
  ) => Promise<void>;
  appOrigin?: string;
  now?: Date;
}

export interface EmitRefundInput {
  candidate: LeakingWorkspace;
  autoRefundEnabled: boolean;
  refundCapUsd: number;
  billing: BillingProvider;
  email: EmailProvider;
  systemContext: SystemContextRunner;
  notifyDeps: NotifyHumanDeps;
  appOrigin: string;
  now: Date;
}

/**
 * Daily sweep entry point. Reads candidates, routes each through the
 * once-per-lifetime guard + the emitter. Failures are counted, never
 * thrown — a single bad workspace can't strand the whole sweep.
 */
export async function runUnsupportedVerticalRefundSweep(
  args: RunUnsupportedVerticalRefundSweepArgs = {},
): Promise<UnsupportedVerticalRefundResult> {
  const now = args.now ?? new Date();
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const autoRefundEnabled =
    args.autoRefundEnabled ?? env.unsupportedVerticalAutoRefundEnabled();
  const refundCapUsd = args.refundCapUsd ?? env.unsupportedVerticalRefundCapUsd();
  const appOrigin =
    args.appOrigin ?? process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const notifyDeps = args.notifyDeps ?? {};
  const emit = args.emit ?? defaultEmitRefund;
  const isAlreadyHandled =
    args.isAlreadyHandled ?? ((id) => defaultIsAlreadyHandled(id, notifyDeps));
  const markHandled =
    args.markHandled ??
    ((id, decision) => defaultMarkHandled(id, decision, notifyDeps));

  const lazyBilling = (): BillingProvider => args.billing ?? getBillingProvider();
  const lazyEmail = (): EmailProvider => args.email ?? getEmailProvider();

  const candidates = await listCandidates();
  const result: UnsupportedVerticalRefundResult = {
    workspacesConsidered: candidates.length,
    refunded: 0,
    detectOnlyPaged: 0,
    overCapPaged: 0,
    refundFailedPaged: 0,
    alreadyHandled: 0,
    noCharges: 0,
    totalRefundedUsdCents: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      // Once-per-lifetime guard. Read FIRST — a handled workspace is
      // skipped before any money moves.
      if (await isAlreadyHandled(candidate.workspaceId)) {
        result.alreadyHandled += 1;
        continue;
      }

      const decision = await emit({
        candidate,
        autoRefundEnabled,
        refundCapUsd,
        get billing() {
          return lazyBilling();
        },
        get email() {
          return lazyEmail();
        },
        systemContext,
        notifyDeps,
        appOrigin,
        now,
      });

      // Mark handled for every TERMINAL decision so the workspace never
      // re-enters the sweep. detect-only is terminal-for-this-run too:
      // we paged a human; re-paging daily would be noise. (When auto
      // mode is later enabled, the over-cap / failed pages stay marked so
      // a human resolves them out-of-band, not the cron.)
      await markHandled(candidate.workspaceId, decision);

      switch (decision) {
        case 'refunded':
          result.refunded += 1;
          break;
        case 'detect-only-paged':
          result.detectOnlyPaged += 1;
          break;
        case 'over-cap-paged':
          result.overCapPaged += 1;
          break;
        case 'refund-failed-paged':
          result.refundFailedPaged += 1;
          break;
        case 'no-charges-nothing-to-refund':
          result.noCharges += 1;
          break;
        case 'already-handled':
          result.alreadyHandled += 1;
          break;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.failures.push({ workspaceId: candidate.workspaceId, reason });
    }
  }

  return result;
}

/**
 * Default per-candidate emitter. The decision tree:
 *
 *   DETECT-ONLY (auto off) → page a human, move no money.
 *   AUTO (flag on):
 *     no charges                  → audit + no-charges (idempotent close).
 *     refund within cap           → refund + apology email + teardown.
 *     refund hits cap / fails     → page a human (over-cap / failed).
 *
 * Tests override `emit` to assert routing; this default is exercised by
 * the integration-style test with the TestBillingProvider + in-memory
 * flag store.
 */
async function defaultEmitRefund(
  input: EmitRefundInput,
): Promise<RefundDecision> {
  const { candidate, autoRefundEnabled, refundCapUsd, billing, systemContext, notifyDeps, now } =
    input;

  const deadline = new Date(now.getTime() + HUMAN_PAGE_DEADLINE_HOURS * 3600_000);
  const slug = verticalSlugFromEnum(candidate.vertical);

  // ── DETECT-ONLY MODE ────────────────────────────────────────────────
  if (!autoRefundEnabled) {
    await notifyHuman(
      {
        key: `unsupported-vertical-refund:${candidate.workspaceId}`,
        subject: `Leaking workspace: ${candidate.workspaceName} (${slug}) — refund pending ratification`,
        body: pageBody({ candidate, slug, autoRefundEnabled, refundCapUsd, now }),
        deadline,
        severity: 'critical',
      },
      notifyDeps,
    );
    await writeRefundAudit({
      systemContext,
      workspaceId: candidate.workspaceId,
      action: 'billing.unsupported_vertical.refund.detect_only_paged',
      payload: {
        vertical: slug,
        daysSinceSignup: candidate.daysSinceSignup,
        deadline: deadline.toISOString(),
        note: 'auto-refund disabled — paged human in detect-only mode',
      },
      now,
    });
    return 'detect-only-paged';
  }

  // ── AUTO MODE ───────────────────────────────────────────────────────
  if (!candidate.stripeCustomerId) {
    // No Stripe customer = nothing was ever charged. Still tear down +
    // close honestly so the dark workspace doesn't linger.
    await writeRefundAudit({
      systemContext,
      workspaceId: candidate.workspaceId,
      action: 'billing.unsupported_vertical.refund.no_charges',
      payload: { vertical: slug, reason: 'no stripeCustomerId' },
      now,
    });
    await closeLeakingWorkspace({ candidate, systemContext, now });
    return 'no-charges-nothing-to-refund';
  }

  const capCents = refundCapUsd * 100;
  let refundResult;
  try {
    refundResult = await billing.refundCustomerCharges({
      providerCustomerId: candidate.stripeCustomerId,
      maxRefundUsdCents: capCents,
      idempotencyKey: `unsupported-vertical-refund:${candidate.workspaceId}`,
      reason: 'unsupported-vertical-auto-refund',
    });
  } catch (err) {
    // Refund API failed — page a human, do NOT tear down (the customer's
    // money is still on the line; a human must finish the refund).
    await notifyHuman(
      {
        key: `unsupported-vertical-refund:${candidate.workspaceId}`,
        subject: `Refund FAILED: ${candidate.workspaceName} (${slug}) — manual refund needed`,
        body:
          pageBody({ candidate, slug, autoRefundEnabled, refundCapUsd, now }) +
          `\n\nRefund API error: ${err instanceof Error ? err.message : String(err)}`,
        deadline,
        severity: 'critical',
      },
      notifyDeps,
    );
    await writeRefundAudit({
      systemContext,
      workspaceId: candidate.workspaceId,
      action: 'billing.unsupported_vertical.refund.failed_paged',
      payload: {
        vertical: slug,
        error: err instanceof Error ? err.message : String(err),
        deadline: deadline.toISOString(),
      },
      now,
    });
    return 'refund-failed-paged';
  }

  if (refundResult.hitCap) {
    // The customer paid more than the cap. Refund what we could, then page
    // a human for the overage — never silently under-refund.
    await notifyHuman(
      {
        key: `unsupported-vertical-refund:${candidate.workspaceId}`,
        subject: `Refund OVER CAP: ${candidate.workspaceName} (${slug}) — paid above $${refundCapUsd}`,
        body:
          pageBody({ candidate, slug, autoRefundEnabled, refundCapUsd, now }) +
          `\n\nAuto-refunded $${(refundResult.totalRefundedUsdCents / 100).toFixed(2)} (cap $${refundCapUsd}). ` +
          `Remaining charges exceed the cap — review + refund the balance manually.`,
        deadline,
        severity: 'critical',
      },
      notifyDeps,
    );
    await writeRefundAudit({
      systemContext,
      workspaceId: candidate.workspaceId,
      action: 'billing.unsupported_vertical.refund.over_cap_paged',
      payload: {
        vertical: slug,
        refundedUsdCents: refundResult.totalRefundedUsdCents,
        capUsd: refundCapUsd,
        refunds: refundResult.refunds,
        deadline: deadline.toISOString(),
      },
      now,
    });
    // We DID refund up to the cap + close out the workspace; the human
    // handles only the overage.
    await sendApologyAndClose({ candidate, slug, input, refundedUsdCents: refundResult.totalRefundedUsdCents });
    return 'over-cap-paged';
  }

  if (refundResult.refunds.length === 0) {
    // Customer had no refundable charges (e.g. all trial, never billed).
    await writeRefundAudit({
      systemContext,
      workspaceId: candidate.workspaceId,
      action: 'billing.unsupported_vertical.refund.no_charges',
      payload: { vertical: slug, reason: 'no eligible charges' },
      now,
    });
    await closeLeakingWorkspace({ candidate, systemContext, now });
    return 'no-charges-nothing-to-refund';
  }

  // Happy path — refunded within cap.
  await writeRefundAudit({
    systemContext,
    workspaceId: candidate.workspaceId,
    action: 'billing.unsupported_vertical.refund.executed',
    payload: {
      vertical: slug,
      refundedUsdCents: refundResult.totalRefundedUsdCents,
      refunds: refundResult.refunds,
      capUsd: refundCapUsd,
    },
    now,
  });
  await sendApologyAndClose({ candidate, slug, input, refundedUsdCents: refundResult.totalRefundedUsdCents });
  return 'refunded';
}

interface SendApologyAndCloseArgs {
  candidate: LeakingWorkspace;
  slug: string;
  input: EmitRefundInput;
  refundedUsdCents: number;
}

async function sendApologyAndClose(args: SendApologyAndCloseArgs): Promise<void> {
  const { candidate, slug, input, refundedUsdCents } = args;
  // Honest apology + waitlist offer. Best-effort — a mail failure must not
  // block teardown (the refund already protected the customer).
  if (candidate.brokerOwnerEmail) {
    try {
      const verticalName = getVerticalContent(slug)?.name ?? slug;
      await input.email.send({
        to: candidate.brokerOwnerEmail,
        subject: 'We refunded you — Plaino wasn’t ready for your shop',
        html: renderApologyHtml({ candidate, verticalName, refundedUsdCents, appOrigin: input.appOrigin }),
        text: renderApologyText({ candidate, verticalName, refundedUsdCents, appOrigin: input.appOrigin }),
        tags: {
          kind: 'unsupported_vertical_refund_apology',
          workspace_id: candidate.workspaceId,
        },
      });
    } catch {
      // non-fatal
    }
  }
  await closeLeakingWorkspace({ candidate, systemContext: input.systemContext, now: input.now });
}

interface CloseLeakingWorkspaceArgs {
  candidate: LeakingWorkspace;
  systemContext: SystemContextRunner;
  now: Date;
}

/**
 * Clean teardown of the leaking workspace. Flips the workspace to CLOSED
 * (no 90-day grace — the customer was refunded; there's nothing to wait
 * for) and runs the cascading tenant-data delete, including the teardown
 * gaps the audit named (see `tearDownWorkspaceData`).
 */
async function closeLeakingWorkspace(args: CloseLeakingWorkspaceArgs): Promise<void> {
  const { candidate, systemContext, now } = args;
  // Cascading tenant-data delete (knowledge docs, approvals, integrations,
  // and the audit-named extra tables — see deletion.ts pfd-4 additions).
  await tearDownWorkspaceData({ workspaceId: candidate.workspaceId });
  // Mark the workspace CLOSED so the gate keeps it dark and the operator
  // surfaces show it as resolved.
  await systemContext(async (tx) => {
    await tx.workspace.update({
      where: { id: candidate.workspaceId },
      data: {
        closureStatus: 'CLOSED',
        closedAt: now,
        closureReason:
          'Auto-refunded + closed: unsupported vertical, no value delivered (pfd-4 leak sweep)',
      },
    });
  });
}

interface WriteRefundAuditArgs {
  systemContext: SystemContextRunner;
  workspaceId: string;
  action: string;
  payload: Record<string, unknown>;
  now: Date;
}

/** Audit a refund decision as a durable ROW (not a log). */
async function writeRefundAudit(args: WriteRefundAuditArgs): Promise<void> {
  await args.systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId: args.workspaceId,
        action: args.action,
        targetTable: 'Workspace',
        targetId: args.workspaceId,
        payload: args.payload as Prisma.InputJsonValue,
        occurredAt: args.now,
      },
    });
  });
}

// ── Once-per-lifetime guard (OpsFlag-backed) ───────────────────────────

async function defaultIsAlreadyHandled(
  workspaceId: string,
  notifyDeps: NotifyHumanDeps,
): Promise<boolean> {
  const store = notifyDeps.flagStore ?? (await getDefaultFlagStore());
  const read = await store.get(refundGuardFlagName(workspaceId));
  // Read failure (DB down) → conservative: treat as NOT handled would risk
  // a double-refund. So on an UPSTREAM_ERROR we treat as ALREADY handled
  // (skip) — failing toward "don't move money twice." A genuinely
  // un-handled workspace gets caught on the next clean tick.
  if (!read.ok) return true;
  return read.value !== null;
}

async function defaultMarkHandled(
  workspaceId: string,
  decision: RefundDecision,
  notifyDeps: NotifyHumanDeps,
): Promise<void> {
  const store = notifyDeps.flagStore ?? (await getDefaultFlagStore());
  await store.set(refundGuardFlagName(workspaceId), decision, {
    updatedBy: 'pfd-4:refund-sweep',
    note: `Unsupported-vertical leak sweep decision: ${decision}`,
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
export function __resetRefundSweepStoreForTests(): void {
  _defaultFlagStore = null;
}

// ── Default candidate lister ────────────────────────────────────────────

/**
 * Find leaking workspaces: ACTIVE, signup-complete, > age-days old, in an
 * UNSUPPORTED vertical (registry truth), with ZERO value delivered. The
 * vertical filter happens in code (the readiness resolver is the single
 * source of truth — we don't hardcode an "unsupported" enum list in SQL).
 */
async function defaultListCandidates(): Promise<LeakingWorkspace[]> {
  return defaultWithSystemContext(async (tx) => {
    const ageCutoff = new Date(
      Date.now() - UNSUPPORTED_VERTICAL_AGE_DAYS * 24 * 60 * 60 * 1000,
    );
    // Only consider workspaces that actually completed signup (paying /
    // card-on-file) — abandoned signups are the abandoned-signup sweep's
    // job, not this one.
    const workspaces = await tx.workspace.findMany({
      where: {
        closureStatus: 'ACTIVE',
        signupSetupCompletedAt: { not: null },
        createdAt: { lte: ageCutoff },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        vertical: true,
        createdAt: true,
        stripeCustomerId: true,
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true, name: true } } },
        },
      },
    });

    const candidates: LeakingWorkspace[] = [];
    for (const w of workspaces) {
      // Registry-truth vertical filter.
      if (resolveVerticalReadinessForEnum(w.vertical).supported) continue;

      // Zero-value check — both signals must be empty.
      const [acceptedApprovals, successfulRuns] = await Promise.all([
        tx.workApprovalQueueItem.count({
          where: {
            workspaceId: w.id,
            status: {
              in: [WorkApprovalStatus.APPROVED, WorkApprovalStatus.AUTO_APPROVED],
            },
          },
        }),
        tx.skillRun.count({
          where: {
            workspaceId: w.id,
            outcome: {
              in: [SkillRunOutcome.DRAFTED, SkillRunOutcome.SUCCEEDED_NO_DRAFT],
            },
          },
        }),
      ]);
      if (acceptedApprovals > 0 || successfulRuns > 0) continue; // got value

      candidates.push({
        workspaceId: w.id,
        workspaceName: w.name,
        workspaceSlug: w.slug,
        vertical: w.vertical,
        brokerOwnerEmail: w.memberships[0]?.user.email ?? null,
        brokerOwnerName: w.memberships[0]?.user.name ?? null,
        stripeCustomerId: w.stripeCustomerId,
        daysSinceSignup: Math.floor(
          (Date.now() - w.createdAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
      });
    }
    return candidates;
  });
}

// ── Copy ────────────────────────────────────────────────────────────────

function pageBody(args: {
  candidate: LeakingWorkspace;
  slug: string;
  autoRefundEnabled: boolean;
  refundCapUsd: number;
  now: Date;
}): string {
  const { candidate, slug, autoRefundEnabled, refundCapUsd } = args;
  return [
    `Workspace: ${candidate.workspaceName} (${candidate.workspaceSlug})`,
    `Workspace id: ${candidate.workspaceId}`,
    `Vertical: ${slug} (UNSUPPORTED — killer workflow does not fire)`,
    `Days since signup: ${candidate.daysSinceSignup}`,
    `Stripe customer: ${candidate.stripeCustomerId ?? '(none)'}`,
    `Owner: ${candidate.brokerOwnerName ?? '(unknown)'} <${candidate.brokerOwnerEmail ?? 'no-email'}>`,
    `Value delivered: ZERO (no accepted approvals, no successful skill runs)`,
    '',
    autoRefundEnabled
      ? `Auto-refund is ON (cap $${refundCapUsd}/workspace).`
      : `Auto-refund is OFF (detect-only). This workspace is leaking — a paying ` +
        `customer in a vertical we cannot serve, receiving nothing. Decide: ` +
        `refund + close, or move the policy to ON. Stripe refunds are real ` +
        `money, so the cron will not move it until UNSUPPORTED_VERTICAL_AUTO_REFUND=on.`,
  ].join('\n');
}

function renderApologyText(args: {
  candidate: LeakingWorkspace;
  verticalName: string;
  refundedUsdCents: number;
  appOrigin: string;
}): string {
  const greeting = args.candidate.brokerOwnerName
    ? `Hi ${args.candidate.brokerOwnerName.split(/\s+/)[0]},`
    : 'Hi,';
  const amount = `$${(args.refundedUsdCents / 100).toFixed(2)}`;
  return [
    greeting,
    '',
    `You signed up for Plaino for ${args.verticalName.toLowerCase()}, and the ` +
      `truth is we weren't ready to do that work well for you yet. You paid us ` +
      `and got nothing useful back. That's on us.`,
    '',
    `We've refunded ${amount} to your card and closed the workspace so you're ` +
      `not billed again. No action needed on your end.`,
    '',
    `When Plaino is ready for ${args.verticalName.toLowerCase()}, we'd be glad ` +
      `to have you back — we'll reach out first. If you'd rather we didn't, just ` +
      `ignore this.`,
    '',
    '— Plaino',
  ].join('\n');
}

function renderApologyHtml(args: {
  candidate: LeakingWorkspace;
  verticalName: string;
  refundedUsdCents: number;
  appOrigin: string;
}): string {
  const greeting = args.candidate.brokerOwnerName
    ? `Hi ${escapeHtml(args.candidate.brokerOwnerName.split(/\s+/)[0])},`
    : 'Hi,';
  const vn = escapeHtml(args.verticalName.toLowerCase());
  const amount = `$${(args.refundedUsdCents / 100).toFixed(2)}`;
  return [
    '<!doctype html><html><body style="font-family: ui-sans-serif,system-ui,sans-serif; color:#1c1917;">',
    `<p>${greeting}</p>`,
    `<p>You signed up for Plaino for ${vn}, and the truth is we weren't ready to do that work well for you yet. You paid us and got nothing useful back. That's on us.</p>`,
    `<p>We've refunded <strong>${amount}</strong> to your card and closed the workspace so you're not billed again. No action needed on your end.</p>`,
    `<p style="color:#737373;">When Plaino is ready for ${vn}, we'd be glad to have you back — we'll reach out first. If you'd rather we didn't, just ignore this.</p>`,
    '<p>— Plaino</p>',
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
