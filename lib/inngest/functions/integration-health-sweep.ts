/**
 * Inngest cron: daily per-integration health sweep (pfd-2 integration self-heal).
 *
 * THE BAR (if Conner died tomorrow): a local-business owner whose Gmail token
 * expired must find out FROM US — with a one-click fix — within 24h, not from
 * three weeks of silently-missing drafts. This cron is that surface.
 *
 * Once a day, for every ACTIVE integration credential a workspace has connected,
 * it probes the integration THROUGH the existing adapter (a real read where one
 * is wired, otherwise a credential/token-validity check — LABELLED honestly per
 * the signup-to-go audit's "health = credential status only is misleading"
 * finding). Then per outcome:
 *
 *   HEALTHY      → persist HEALTHY; if it was previously UNHEALTHY, clear the
 *                  breakage (un-banner) AND resume that workspace+provider's
 *                  retry queue so held/blocked work flushes on recovery.
 *   UNHEALTHY    → persist UNHEALTHY (+ unhealthySince anchor); the in-app
 *                  banner reads this row. Email the workspace owner ONCE per
 *                  breakage (notifiedAt de-dupe — calm copy, not daily spam).
 *                  If broken > 72h, escalate via pageHuman(warn) ONCE so a
 *                  human knows customers are sitting broken.
 *   not_connected→ skip (no credential — nothing to check).
 *   indeterminate→ record but do NOT banner/email/page — we can't conclude the
 *                  integration is broken (transient error, encryption key
 *                  absent). Failing loud here would false-alarm the customer.
 *
 * Per project_no_outbound_architecture.md: every probe is read-only; the only
 * outbound is the reconnect EMAIL to the owner (a RECEIVE-shape transactional
 * notice, the same channel trial warnings + operator pages use).
 *
 * Cold-start safe: reads credentials + health rows from the DB on every fire.
 */

import type { IntegrationProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { getEmailProvider, type EmailProvider } from '@/lib/email';
import { pageHuman as defaultPageHuman } from '@/lib/ops/page-human';
import {
  LiveIntegrationHealthProbe,
  type IntegrationHealthProbe,
  type HealthProbeOutcome,
} from '@/lib/integrations/health-probe';
import {
  PrismaHealthStore,
  type HealthStore,
} from '@/lib/integrations/health-store';
import type { RetryStore } from '@/lib/integrations/retry-store';
import {
  resumeRetryableActions,
  type RetryHandlerRegistry,
} from '@/lib/integrations/retry-queue';
import { buildRetryHandlerRegistry } from '@/lib/integrations/retry-handlers';
import {
  entryForProviderKey,
  type MarketplaceProviderKey,
} from '@/lib/integrations/marketplace';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const INTEGRATION_HEALTH_SWEEP_FUNCTION_ID =
  'agentplain-integration-health-sweep';
/** Daily at 09:00 UTC. Manually triggerable any time. */
export const INTEGRATION_HEALTH_SWEEP_CRON = '0 9 * * *';
export const INTEGRATION_HEALTH_REQUESTED_EVENT =
  'agentplain/integration-health.requested';

/** A broken integration that's been broken longer than this escalates to a
 *  human (warn) — customers have been sitting broken too long for the
 *  self-serve reconnect email to be enough. */
export const ESCALATE_AFTER_MS = 72 * 60 * 60 * 1000;

/** One ACTIVE credential a workspace has connected. */
interface ConnectedIntegration {
  workspaceId: string;
  workspaceName: string;
  provider: IntegrationProvider;
  ownerEmail: string | null;
}

export interface HealthSweepReport {
  considered: number;
  healthy: number;
  unhealthy: number;
  recovered: number;
  indeterminate: number;
  notConnected: number;
  emailsSent: number;
  escalated: number;
  resumedActions: number;
  failures: Array<{ workspaceId: string; provider: string; reason: string }>;
}

export interface HealthSweepDeps {
  listConnected?: () => Promise<ConnectedIntegration[]>;
  probe?: IntegrationHealthProbe;
  store?: HealthStore;
  /** Retry-queue store for the recovery resume path. Defaults to Prisma. */
  retryStore?: RetryStore;
  email?: EmailProvider;
  page?: typeof defaultPageHuman;
  registry?: RetryHandlerRegistry;
  appOrigin?: string;
  now?: Date;
}

/**
 * Testable core. Never throws — a per-integration failure is captured in the
 * report and the sweep continues to the next.
 */
export async function runIntegrationHealthSweep(
  deps: HealthSweepDeps = {},
): Promise<HealthSweepReport> {
  const listConnected = deps.listConnected ?? defaultListConnected;
  const probe = deps.probe ?? new LiveIntegrationHealthProbe();
  const store = deps.store ?? new PrismaHealthStore();
  const email = deps.email ?? getEmailProvider();
  const page = deps.page ?? defaultPageHuman;
  const registry = deps.registry ?? buildRetryHandlerRegistry();
  const now = deps.now ?? new Date();
  const appOrigin = (
    deps.appOrigin ??
    process.env.APP_PUBLIC_ORIGIN ??
    'http://localhost:3000'
  ).replace(/\/$/, '');

  const connected = await listConnected();
  const report: HealthSweepReport = {
    considered: connected.length,
    healthy: 0,
    unhealthy: 0,
    recovered: 0,
    indeterminate: 0,
    notConnected: 0,
    emailsSent: 0,
    escalated: 0,
    resumedActions: 0,
    failures: [],
  };

  for (const integ of connected) {
    try {
      const outcome = await probe.probe(integ.workspaceId, integ.provider);
      const handled = await applyOutcome({
        integ,
        outcome,
        now,
        appOrigin,
        store,
        retryStore: deps.retryStore,
        email,
        page,
        registry,
      });
      report.healthy += handled.healthy ? 1 : 0;
      report.unhealthy += handled.unhealthy ? 1 : 0;
      report.recovered += handled.recovered ? 1 : 0;
      report.indeterminate += handled.indeterminate ? 1 : 0;
      report.notConnected += handled.notConnected ? 1 : 0;
      report.emailsSent += handled.emailed ? 1 : 0;
      report.escalated += handled.escalated ? 1 : 0;
      report.resumedActions += handled.resumed;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: INTEGRATION_HEALTH_SWEEP_FUNCTION_ID,
        extraTags: {
          workspace_id: integ.workspaceId,
          provider: integ.provider,
          phase: 'probe',
        },
      });
      report.failures.push({
        workspaceId: integ.workspaceId,
        provider: integ.provider,
        reason,
      });
    }
  }
  return report;
}

interface ApplyOutcomeFlags {
  healthy: boolean;
  unhealthy: boolean;
  recovered: boolean;
  indeterminate: boolean;
  notConnected: boolean;
  emailed: boolean;
  escalated: boolean;
  resumed: number;
}

async function applyOutcome(ctx: {
  integ: ConnectedIntegration;
  outcome: HealthProbeOutcome;
  now: Date;
  appOrigin: string;
  store: HealthStore;
  retryStore?: RetryStore;
  email: EmailProvider;
  page: typeof defaultPageHuman;
  registry: RetryHandlerRegistry;
}): Promise<ApplyOutcomeFlags> {
  const { integ, outcome, now, store } = ctx;
  const flags: ApplyOutcomeFlags = {
    healthy: false,
    unhealthy: false,
    recovered: false,
    indeterminate: false,
    notConnected: false,
    emailed: false,
    escalated: false,
    resumed: 0,
  };

  if (outcome.status === 'not_connected') {
    flags.notConnected = true;
    return flags;
  }

  if (outcome.status === 'indeterminate') {
    // Record the attempt but do NOT change the customer-facing breakage state —
    // we can't conclude it's broken. Touch lastCheckedAt + lastError only.
    flags.indeterminate = true;
    await store.upsert(integ.workspaceId, integ.provider, {
      lastCheckedAt: now,
      lastError: outcome.detail,
    });
    return flags;
  }

  // Read the prior row to detect transitions (recovery / first breakage).
  const prior = await store.get(integ.workspaceId, integ.provider);

  if (outcome.status === 'healthy') {
    flags.healthy = true;
    const wasUnhealthy = prior?.status === 'UNHEALTHY';
    await store.upsert(integ.workspaceId, integ.provider, {
      status: 'HEALTHY',
      checkKind: outcome.kind,
      lastCheckedAt: now,
      // Clear the breakage bookkeeping on recovery so a FUTURE breakage
      // re-notifies + can re-escalate.
      lastError: null,
      unhealthySince: null,
      notifiedAt: null,
      escalatedAt: null,
    });
    if (wasUnhealthy) {
      flags.recovered = true;
      // The integration just came back — flush this workspace+provider's
      // retry queue so held/blocked work resumes immediately on reconnect.
      const resume = await resumeRetryableActions({
        workspaceId: integ.workspaceId,
        provider: integ.provider,
        registry: ctx.registry,
        store: ctx.retryStore,
        now,
        onDeadLetter: (row, reason) =>
          ctx.page({
            severity: 'warn',
            summary: `Queued ${row.actionKind} could not complete for ${integ.workspaceName}`,
            details:
              `A retryable action (${row.actionKind}, ${integ.provider}) for workspace ` +
              `${integ.workspaceName} (${integ.workspaceId}) dead-lettered: ${reason}. ` +
              `The customer sees a note on their integrations page. A human should ` +
              `check whether the work needs to be re-done manually.`,
            source: 'integration-health-sweep',
            workspaceId: integ.workspaceId,
          }),
      }).catch(() => ({ resolved: 0 }) as { resolved: number });
      flags.resumed = resume.resolved;
    }
    return flags;
  }

  // ── outcome.status === 'unhealthy' ──────────────────────────────────────
  flags.unhealthy = true;
  const firstBreakage = prior?.status !== 'UNHEALTHY';
  const unhealthySince = firstBreakage ? now : (prior?.unhealthySince ?? now);

  await store.upsert(integ.workspaceId, integ.provider, {
    status: 'UNHEALTHY',
    checkKind: outcome.kind,
    lastCheckedAt: now,
    lastError: outcome.detail,
    // Anchor the breakage on the FIRST unhealthy check; keep it on repeats.
    unhealthySince,
  });

  // Email the owner ONCE per breakage (notifiedAt de-dupe). A breakage that
  // already notified (prior.notifiedAt set + still broken) does NOT re-email.
  const alreadyNotified = !firstBreakage && prior?.notifiedAt != null;
  if (!alreadyNotified && integ.ownerEmail) {
    await sendReconnectEmail({
      to: integ.ownerEmail,
      integ,
      detail: outcome.detail,
      appOrigin: ctx.appOrigin,
      email: ctx.email,
    });
    flags.emailed = true;
    await store.upsert(integ.workspaceId, integ.provider, { notifiedAt: now });
  }

  // Escalate to a human ONCE if broken > 72h (escalatedAt de-dupe).
  const brokenForMs = now.getTime() - unhealthySince.getTime();
  const alreadyEscalated = prior?.escalatedAt != null;
  if (brokenForMs >= ESCALATE_AFTER_MS && !alreadyEscalated) {
    await ctx.page({
      severity: 'warn',
      summary: `${displayName(integ.provider)} broken > 72h for ${integ.workspaceName}`,
      details:
        `Workspace ${integ.workspaceName} (${integ.workspaceId}) has had its ` +
        `${displayName(integ.provider)} integration UNHEALTHY since ` +
        `${unhealthySince.toISOString()} — over 72 hours. We emailed the owner a ` +
        `reconnect link, but it hasn't been fixed. The customer's killer workflow ` +
        `for this integration is silently not firing. Reach out directly + check ` +
        `whether queued work is piling up in their retry queue.\n\n` +
        `Last probe error: ${outcome.detail}`,
      source: 'integration-health-sweep',
      workspaceId: integ.workspaceId,
    });
    flags.escalated = true;
    await store.upsert(integ.workspaceId, integ.provider, { escalatedAt: now });
  }

  return flags;
}

/** The customer-recognizable name for a provider, from the marketplace entry. */
function displayName(provider: IntegrationProvider): string {
  const entry = entryForProviderKey(provider as NonNullable<MarketplaceProviderKey>);
  return entry?.name ?? provider;
}

/** The reconnect landing page for a provider — the marketplace integrations
 *  pane scoped to the workspace, the existing reconnect surface. */
function reconnectUrl(
  provider: IntegrationProvider,
  workspaceId: string,
  appOrigin: string,
): string {
  const entry = entryForProviderKey(provider as NonNullable<MarketplaceProviderKey>);
  const base = `${appOrigin}/app/workspace/${workspaceId}/integrations`;
  return entry ? `${base}/${entry.id}` : base;
}

async function sendReconnectEmail(args: {
  to: string;
  integ: ConnectedIntegration;
  detail: string;
  appOrigin: string;
  email: EmailProvider;
}): Promise<void> {
  const name = displayName(args.integ.provider);
  const url = reconnectUrl(args.integ.provider, args.integ.workspaceId, args.appOrigin);
  const subject = `Reconnect ${name} so Plaino can keep working`;
  // Calm, plain copy — never alarmist. The customer should feel handled, not
  // scolded. One clear next step.
  const text = [
    `Hi,`,
    ``,
    `Plaino lost its connection to your ${name} account, so the work that runs`,
    `through it (drafts, triage, sync) is on hold for ${args.integ.workspaceName}.`,
    ``,
    `Nothing is lost — anything Plaino was about to do is queued and will run the`,
    `moment you reconnect.`,
    ``,
    `Reconnect ${name}: ${url}`,
    ``,
    `It takes about a minute. If you've changed accounts or no longer use ${name},`,
    `you can ignore this — just let us know and we'll stop checking.`,
    ``,
    `— Plaino`,
  ].join('\n');
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;color:#1A1A1F;background:#F7F4ED;padding:24px;">
  <h2 style="font-weight:600;margin:0 0 16px;">Reconnect ${escapeHtml(name)} so Plaino can keep working</h2>
  <p style="font-size:15px;line-height:1.55;margin:0 0 14px;">Plaino lost its connection to your ${escapeHtml(name)} account, so the work that runs through it — drafts, triage, sync — is on hold for ${escapeHtml(args.integ.workspaceName)}.</p>
  <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">Nothing is lost. Anything Plaino was about to do is queued and will run the moment you reconnect.</p>
  <p style="margin:0 0 20px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1A1A1F;color:#F7F4ED;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Reconnect ${escapeHtml(name)}</a></p>
  <p style="font-size:13px;color:#8C8478;line-height:1.5;margin:0;">It takes about a minute. If you've changed accounts or no longer use ${escapeHtml(name)}, you can ignore this — just reply and we'll stop checking.</p>
</body></html>`;
  await args.email.send({
    to: args.to,
    subject,
    html,
    text,
    tags: {
      kind: 'integration_reconnect',
      workspace_id: args.integ.workspaceId,
      provider: args.integ.provider,
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Every ACTIVE integration credential across all workspaces, with the
 * workspace name + broker-owner email for the reconnect notice. Runs under the
 * system context (cron). One row per (workspace, provider) — if a workspace has
 * two GOOGLE accounts we still probe both via findFirst's most-recent pick at
 * probe time, so we de-dupe on (workspace, provider) here.
 */
async function defaultListConnected(): Promise<ConnectedIntegration[]> {
  return withSystemContext(async (tx) => {
    const creds = await tx.integrationCredential.findMany({
      where: {
        status: 'ACTIVE',
        workspace: { closureStatus: 'ACTIVE' },
      },
      select: {
        workspaceId: true,
        provider: true,
        workspace: {
          select: {
            name: true,
            memberships: {
              where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { user: { select: { email: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
    const seen = new Set<string>();
    const out: ConnectedIntegration[] = [];
    for (const c of creds) {
      const key = `${c.workspaceId}:${c.provider}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        workspaceId: c.workspaceId,
        workspaceName: c.workspace?.name ?? 'your workspace',
        provider: c.provider,
        ownerEmail: c.workspace?.memberships[0]?.user.email ?? null,
      });
    }
    return out;
  });
}

export const integrationHealthSweepFn = inngest.createFunction(
  {
    id: INTEGRATION_HEALTH_SWEEP_FUNCTION_ID,
    name: 'agentplain integration health sweep',
    triggers: [
      { cron: INTEGRATION_HEALTH_SWEEP_CRON },
      { event: INTEGRATION_HEALTH_REQUESTED_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(INTEGRATION_HEALTH_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: INTEGRATION_HEALTH_SWEEP_FUNCTION_ID,
          schedule: INTEGRATION_HEALTH_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: INTEGRATION_HEALTH_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: INTEGRATION_HEALTH_SWEEP_FUNCTION_ID,
              });
              logger.info('integration health sweep started');
              const report = await runIntegrationHealthSweep();
              logger.info('integration health sweep finished', {
                considered: report.considered,
                healthy: report.healthy,
                unhealthy: report.unhealthy,
                recovered: report.recovered,
                emails_sent: report.emailsSent,
                escalated: report.escalated,
                resumed: report.resumedActions,
                failed: report.failures.length,
              });
              return report;
            },
          ),
      ),
    ),
);
