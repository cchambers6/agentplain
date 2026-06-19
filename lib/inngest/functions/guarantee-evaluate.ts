// Daily cron: the Day-7 trial-guarantee evaluation.
//
// For each workspace that has reached the evaluation day (default 7 days
// since signup), sum the time the fleet saved and compare to the bar
// (default 5 hours). If the fleet cleared the bar, record it and move on.
// If it didn't, email the broker-owner the walk-away offer — one tap to a
// full refund + data deletion — and surface the same offer in-app (the
// workspace overview computes eligibility live, so it shows even if this
// cron is paused).
//
// Per feedback_no_silent_vendor_lock + project_no_outbound_architecture:
// agentplain does not send outbound on a customer's behalf, but a
// product-side guarantee notice to the broker-owner's own inbox is in
// scope — same shape as the trial-expiration warning cron next door.
// Email rides the lib/email adapter, not a direct SDK.
//
// IDEMPOTENT: a once-per-lifetime OpsFlag guard (GUARANTEE_EVALUATED_<id>)
// means a workspace is evaluated exactly once. Per
// feedback_cold_start_safe_agents every fire re-reads the ledger from
// Postgres; the guard is a durable flag row.

import type { Prisma } from '@prisma/client';
import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import type { SystemContextRunner } from '@/lib/billing/provisioning';
import type { OpsFlagStore } from '@/lib/ops/flag-store';
import { env } from '@/lib/env';
import { readSavedTimeSummary } from '@/lib/guarantee/saved-time';
import {
  barHoursToMinutes,
  evaluateGuarantee,
  formatMinutes,
} from '@/lib/guarantee/evaluation';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const GUARANTEE_EVALUATE_FUNCTION_ID = 'agentplain-guarantee-evaluate';
// 07:00 ET-ish (UTC 11:00) — staggered an hour after the trial-warning
// cron so the two daily billing notices don't fire in the same minute.
export const GUARANTEE_EVALUATE_CRON = '0 11 * * *';

export function evaluatedGuardFlagName(workspaceId: string): string {
  return `GUARANTEE_EVALUATED_${workspaceId}`;
}
export function walkAwayOfferedFlagName(workspaceId: string): string {
  return `GUARANTEE_WALKAWAY_OFFERED_${workspaceId}`;
}

export interface GuaranteeCandidate {
  workspaceId: string;
  workspaceName: string;
  brokerOwnerEmail: string | null;
  ageDays: number;
}

export interface GuaranteeEvaluateResult {
  workspacesConsidered: number;
  metBar: number;
  walkAwayOffered: number;
  alreadyEvaluated: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunGuaranteeEvaluateArgs {
  listCandidates?: () => Promise<GuaranteeCandidate[]>;
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  flagStore?: OpsFlagStore;
  barMinutes?: number;
  evaluationDays?: number;
  appOrigin?: string;
  now?: Date;
}

/**
 * Sweep entry point. Reads candidates, evaluates each against the bar,
 * routes met / under-bar, and guards each with the once-per-lifetime
 * evaluated flag. Failures are counted, never thrown — one bad workspace
 * can't strand the sweep.
 */
export async function runGuaranteeEvaluate(
  args: RunGuaranteeEvaluateArgs = {},
): Promise<GuaranteeEvaluateResult> {
  const now = args.now ?? new Date();
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const evaluationDays = args.evaluationDays ?? env.guaranteeEvaluationDays();
  const barMinutes = args.barMinutes ?? barHoursToMinutes(env.guaranteeBarHours());
  const appOrigin =
    args.appOrigin ?? process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:3000';
  const listCandidates =
    args.listCandidates ??
    (() => defaultListCandidates(systemContext, evaluationDays, now));
  const flagStore = args.flagStore ?? (await getDefaultFlagStore());
  const lazyEmail = (): EmailProvider => args.email ?? getEmailProvider();

  const candidates = await listCandidates();
  const result: GuaranteeEvaluateResult = {
    workspacesConsidered: candidates.length,
    metBar: 0,
    walkAwayOffered: 0,
    alreadyEvaluated: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      // Once-per-lifetime guard. Read first.
      const guard = await flagStore.get(
        evaluatedGuardFlagName(candidate.workspaceId),
      );
      if (!guard.ok || guard.value !== null) {
        // Read failure → skip this tick (conservative); already-set → done.
        result.alreadyEvaluated += 1;
        continue;
      }

      const summary = await systemContext((tx) =>
        readSavedTimeSummary(tx, candidate.workspaceId, now),
      );
      const evaluation = evaluateGuarantee({
        totalMinutesSaved: summary.totalMinutes,
        barMinutes,
        ageDays: candidate.ageDays,
        evaluationDays,
      });

      if (evaluation.meetsBar) {
        await writeAudit({
          systemContext,
          workspaceId: candidate.workspaceId,
          action: 'guarantee.evaluated.met',
          payload: {
            totalMinutes: summary.totalMinutes,
            barMinutes,
            ageDays: candidate.ageDays,
          },
          now,
        });
        result.metBar += 1;
      } else {
        // Under bar — surface the walk-away. The in-app card is the
        // primary surface (computed live); this flag + email are the nudge.
        await flagStore.set(walkAwayOfferedFlagName(candidate.workspaceId), 'offered', {
          updatedBy: 'guarantee:evaluate',
          note: `Under bar at day ${candidate.ageDays}: ${summary.totalMinutes}/${barMinutes} min`,
        });
        if (candidate.brokerOwnerEmail) {
          await lazyEmail().send({
            to: candidate.brokerOwnerEmail,
            subject: "About your agentplain trial — our guarantee",
            html: renderOfferHtml({ candidate, summary, barMinutes, appOrigin }),
            text: renderOfferText({ candidate, summary, barMinutes, appOrigin }),
            tags: {
              kind: 'guarantee_walkaway_offer',
              workspace_id: candidate.workspaceId,
            },
          });
        }
        await writeAudit({
          systemContext,
          workspaceId: candidate.workspaceId,
          action: 'guarantee.evaluated.below_bar.walkaway_offered',
          payload: {
            totalMinutes: summary.totalMinutes,
            barMinutes,
            deficitMinutes: evaluation.deficitMinutes,
            ageDays: candidate.ageDays,
            emailed: candidate.brokerOwnerEmail != null,
          },
          now,
        });
        result.walkAwayOffered += 1;
      }

      // Mark evaluated (terminal for both branches).
      await flagStore.set(evaluatedGuardFlagName(candidate.workspaceId), 'evaluated', {
        updatedBy: 'guarantee:evaluate',
        note: evaluation.meetsBar ? 'met-bar' : 'walk-away-offered',
      });
    } catch (err) {
      result.failures.push({
        workspaceId: candidate.workspaceId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function defaultListCandidates(
  systemContext: SystemContextRunner,
  evaluationDays: number,
  now: Date,
): Promise<GuaranteeCandidate[]> {
  return systemContext(async (tx) => {
    const ageCutoff = new Date(
      now.getTime() - evaluationDays * 24 * 60 * 60 * 1000,
    );
    const workspaces = await tx.workspace.findMany({
      where: {
        closureStatus: 'ACTIVE',
        signupSetupCompletedAt: { not: null },
        createdAt: { lte: ageCutoff },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
    });
    return workspaces.map((w) => ({
      workspaceId: w.id,
      workspaceName: w.name,
      brokerOwnerEmail: w.memberships[0]?.user.email ?? null,
      ageDays: Math.floor(
        (now.getTime() - w.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      ),
    }));
  });
}

async function writeAudit(args: {
  systemContext: SystemContextRunner;
  workspaceId: string;
  action: string;
  payload: Record<string, unknown>;
  now: Date;
}): Promise<void> {
  await args.systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorUserId: null,
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

let _defaultFlagStore: OpsFlagStore | null = null;
async function getDefaultFlagStore(): Promise<OpsFlagStore> {
  if (_defaultFlagStore) return _defaultFlagStore;
  const { PrismaOpsFlagStore } = await import('@/lib/ops/prisma-flag-store');
  _defaultFlagStore = new PrismaOpsFlagStore();
  return _defaultFlagStore;
}

/** Test-only reset of the lazy store. */
export function __resetGuaranteeEvaluateStoreForTests(): void {
  _defaultFlagStore = null;
}

export const guaranteeEvaluateFn = inngest.createFunction(
  {
    id: GUARANTEE_EVALUATE_FUNCTION_ID,
    name: 'agentplain Day-7 guarantee evaluation',
    triggers: [{ cron: GUARANTEE_EVALUATE_CRON }],
  },
  async () =>
    runWithDisableGate(GUARANTEE_EVALUATE_FUNCTION_ID, () =>
      withCronMonitor(
        { slug: GUARANTEE_EVALUATE_FUNCTION_ID, schedule: GUARANTEE_EVALUATE_CRON },
        () =>
          withInngestErrorReporting(
            { functionId: GUARANTEE_EVALUATE_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: GUARANTEE_EVALUATE_FUNCTION_ID,
              });
              logger.info('guarantee evaluation sweep started');
              const out = await runGuaranteeEvaluate();
              for (const f of out.failures) {
                reportInngestItemFailure(new Error(f.reason), {
                  functionId: GUARANTEE_EVALUATE_FUNCTION_ID,
                  extraTags: { workspace_id: f.workspaceId },
                });
              }
              logger.info('guarantee evaluation sweep finished', { ...out });
              return out;
            },
          ),
      ),
    ),
);

// ── Copy ────────────────────────────────────────────────────────────────

function renderOfferText(args: {
  candidate: GuaranteeCandidate;
  summary: { totalMinutes: number };
  barMinutes: number;
  appOrigin: string;
}): string {
  const workspaceUrl = `${args.appOrigin.replace(/\/$/, '')}/app/workspace/${args.candidate.workspaceId}`;
  const saved = formatMinutes(args.summary.totalMinutes);
  return [
    'Hi,',
    '',
    `You're a week into your agentplain trial, and we keep a promise: if the ` +
      `fleet hasn't clearly saved you time, you walk away — full refund, and ` +
      `we delete your data. No hoops.`,
    '',
    `So far the fleet has saved you about ${saved}. That's below the bar we ` +
      `hold ourselves to, so the choice is yours:`,
    '',
    `• Keep going — connect more of your tools and give the fleet more to do.`,
    `• Walk away — one tap, full refund, data deleted.`,
    '',
    `Both options are on your workspace: ${workspaceUrl}`,
    '',
    '— Plaino, your service partner at agentplain',
  ].join('\n');
}

function renderOfferHtml(args: {
  candidate: GuaranteeCandidate;
  summary: { totalMinutes: number };
  barMinutes: number;
  appOrigin: string;
}): string {
  const workspaceUrl = `${args.appOrigin.replace(/\/$/, '')}/app/workspace/${args.candidate.workspaceId}`;
  const saved = formatMinutes(args.summary.totalMinutes);
  return [
    '<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1A1F; background:#F7F4ED; padding:32px;">',
    `<h2 style="font-weight:500;">About your agentplain trial</h2>`,
    `<p>You&rsquo;re a week in, and we keep a promise: if the fleet hasn&rsquo;t clearly saved you time, you walk away &mdash; full refund, and we delete your data. No hoops.</p>`,
    `<p>So far the fleet has saved you about <strong>${saved}</strong>. That&rsquo;s below the bar we hold ourselves to, so the choice is yours:</p>`,
    `<p><a href="${workspaceUrl}" style="display:inline-block; padding:12px 20px; background:#1A1A1F; color:#F7F4ED; text-decoration:none; font-weight:500;">Open your workspace</a></p>`,
    `<p style="font-size:13px; color:#726A5E;">Keep going by connecting more tools, or take the one-tap walk-away. Either way, it&rsquo;s your call.</p>`,
    `<p style="font-size:13px; color:#726A5E;">Plaino, your service partner at agentplain</p>`,
    '</body></html>',
  ].join('');
}
