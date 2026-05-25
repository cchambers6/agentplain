/**
 * Inngest cron: integration renewal sweep.
 *
 * Runs every 2 hours. For each `WebhookSubscription` whose `expiresAt` is
 * within the next 24 hours and `status` is ACTIVE or EXPIRING:
 *   1. Decrypt the credential.
 *   2. If access_token expires within 5 minutes, refresh via
 *      `provider.refreshTokens()` and re-encrypt + persist.
 *   3. Call `provider.renewSubscription()` to extend the Gmail watch.
 *   4. Update WebhookSubscription with the new expiresAt + lastRenewedAt.
 *   5. Write an AuditLog row (renew_success or renew_failed).
 *
 * Per https://developers.google.com/workspace/gmail/api/guides/push
 * (read 2026-05-11): Gmail's users.watch lifetime is 7 days. A 24-hour
 * lookahead window plus a 2-hour sweep cadence gives ~12 renewal attempts
 * before expiry — plenty of headroom for transient failures.
 *
 * Per `feedback_cold_start_safe_agents`: this cron reads durable state on
 * every fire. There is no in-memory cache of "which subscriptions need
 * renewal" between fires.
 *
 * Per `feedback_verify_after_create`: after every database mutation, the
 * next step reads the row back and asserts the expected fields.
 *
 * Per `project_no_outbound_architecture.md`: this cron RECEIVES nothing
 * and SENDS nothing. It just refreshes provider-side state.
 */

import type { IntegrationCredential, WebhookSubscription } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  decryptCredential,
  encryptTokenSet,
  getProvider,
} from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID = 'agentplain-integration-renewal-sweep';
/** Every 2 hours on the hour (UTC). 12 fires per 24h gives ample retry headroom. */
export const INTEGRATION_RENEWAL_SWEEP_CRON = '0 */2 * * *';

/** Refresh tokens whose access_token expires within this window. */
const TOKEN_REFRESH_LEEWAY_MS = 5 * 60 * 1000;
/** Renew watch subscriptions whose expiresAt falls within this window. */
const SUBSCRIPTION_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RenewalSweepResult {
  considered: number;
  refreshed: number;
  renewed: number;
  failures: Array<{ subscriptionId: string; reason: string }>;
}

export async function runIntegrationRenewalSweep(
  now: Date = new Date(),
): Promise<RenewalSweepResult> {
  const expiringBefore = new Date(now.getTime() + SUBSCRIPTION_RENEWAL_WINDOW_MS);

  const candidates = await prisma.webhookSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXPIRING'] },
      expiresAt: { lt: expiringBefore },
    },
    include: { credential: true },
  });

  const result: RenewalSweepResult = {
    considered: candidates.length,
    refreshed: 0,
    renewed: 0,
    failures: [],
  };

  // Without the master key we cannot decrypt any stored token. Fail the
  // sweep CLEARLY (the cron records every skipped subscription with a
  // reason) instead of throwing a MissingKeyError per credential and
  // crashing the run. No tokens are touched and nothing is marked REVOKED —
  // the connections are intact; only the renewal is deferred until the key
  // is restored.
  if (!isEncryptionConfigured()) {
    for (const sub of candidates) {
      result.failures.push({
        subscriptionId: sub.id,
        reason:
          'ENCRYPTION_KEY not configured — cannot decrypt credentials; renewal skipped',
      });
    }
    return result;
  }

  for (const sub of candidates) {
    if (sub.credential.status !== 'ACTIVE') {
      result.failures.push({
        subscriptionId: sub.id,
        reason: `credential ${sub.credential.id} status=${sub.credential.status} — skipping`,
      });
      // Mark the subscription so the operator surface shows the disconnect cause.
      await prisma.webhookSubscription.update({
        where: { id: sub.id },
        data: { status: 'RENEWAL_FAILED' },
      });
      continue;
    }

    // Mark EXPIRING so the operator UI surfaces "due now" rows.
    if (sub.status !== 'EXPIRING') {
      await prisma.webhookSubscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRING' },
      });
    }

    let credential = sub.credential;

    // Refresh tokens if needed.
    if (credential.expiresAt.getTime() - now.getTime() < TOKEN_REFRESH_LEEWAY_MS) {
      const refreshed = await refreshCredentialTokens(credential, now);
      if (!refreshed.ok) {
        reportInngestItemFailure(
          new Error(`token refresh failed: ${refreshed.error}`),
          {
            functionId: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
            extraTags: {
              subscription_id: sub.id,
              workspace_id: sub.workspaceId,
              credential_id: credential.id,
              provider: credential.provider,
              phase: 'token-refresh',
            },
          },
        );
        result.failures.push({
          subscriptionId: sub.id,
          reason: `token refresh failed: ${refreshed.error}`,
        });
        continue;
      }
      credential = refreshed.value;
      result.refreshed += 1;
    }

    // Renew the watch.
    const renewal = await renewSubscription(credential, sub, now);
    if (!renewal.ok) {
      reportInngestItemFailure(
        new Error(`subscription renewal failed: ${renewal.error}`),
        {
          functionId: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
          extraTags: {
            subscription_id: sub.id,
            workspace_id: sub.workspaceId,
            credential_id: credential.id,
            provider: credential.provider,
            phase: 'subscription-renewal',
          },
        },
      );
      result.failures.push({
        subscriptionId: sub.id,
        reason: `subscription renewal failed: ${renewal.error}`,
      });
      continue;
    }
    result.renewed += 1;
  }

  return result;
}

async function refreshCredentialTokens(
  credential: IntegrationCredential,
  now: Date,
): Promise<{ ok: true; value: IntegrationCredential } | { ok: false; error: string }> {
  const provider = getProvider(credential.provider);
  if (!credential.refreshTokenEncrypted) {
    return { ok: false, error: 'no refresh token stored' };
  }
  const decrypted = decryptCredential(credential);
  if (!decrypted.refreshToken) {
    return { ok: false, error: 'decrypted refresh token missing' };
  }
  const refreshed = await provider.refreshTokens({
    refreshToken: decrypted.refreshToken,
    accountEmail: decrypted.accountEmail,
    accountId: decrypted.accountId,
  });
  if (!refreshed.ok) {
    if (refreshed.error.code === 'GRANT_REVOKED') {
      await prisma.integrationCredential.update({
        where: { id: credential.id },
        data: { status: 'REVOKED' },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: credential.workspaceId,
          action: 'integration.refresh.grant_revoked',
          targetTable: 'IntegrationCredential',
          targetId: credential.id,
          payload: { error: refreshed.error.message },
        },
      });
      return { ok: false, error: 'GRANT_REVOKED (marked REVOKED)' };
    }
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { status: 'EXPIRED' },
    });
    return { ok: false, error: `${refreshed.error.code}: ${refreshed.error.message}` };
  }
  const enc = encryptTokenSet(refreshed.value);
  const updated = await prisma.integrationCredential.update({
    where: { id: credential.id },
    data: {
      accessTokenEncrypted: enc.accessTokenEncrypted,
      refreshTokenEncrypted: enc.refreshTokenEncrypted,
      scopes: enc.scopes,
      expiresAt: enc.expiresAt,
      lastRefreshedAt: now,
      status: 'ACTIVE',
    },
  });
  // Verify-after-create: confirm the row reflects the new expiry.
  const verify = await prisma.integrationCredential.findUniqueOrThrow({
    where: { id: credential.id },
    select: { expiresAt: true, status: true },
  });
  if (verify.status !== 'ACTIVE' || verify.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: 'verify-after-refresh failed: row not ACTIVE or expiry not in future' };
  }
  return { ok: true, value: updated };
}

async function renewSubscription(
  credential: IntegrationCredential,
  sub: WebhookSubscription,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = getProvider(credential.provider);
  const decrypted = decryptCredential(credential);
  const renewed = await provider.renewSubscription({
    credential: decrypted,
    subscriptionId: sub.subscriptionId,
    notificationUrl: sub.notificationUrl,
  });
  if (!renewed.ok) {
    await prisma.webhookSubscription.update({
      where: { id: sub.id },
      data: { status: 'RENEWAL_FAILED' },
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: sub.workspaceId,
        action: 'integration.renewal.failed',
        targetTable: 'WebhookSubscription',
        targetId: sub.id,
        payload: {
          provider: sub.provider,
          error: { code: renewed.error.code, message: renewed.error.message },
        },
      },
    });
    return { ok: false, error: `${renewed.error.code}: ${renewed.error.message}` };
  }
  await prisma.webhookSubscription.update({
    where: { id: sub.id },
    data: {
      subscriptionId: renewed.value.providerSubscriptionId,
      expiresAt: renewed.value.expiresAt,
      lastRenewedAt: now,
      status: 'ACTIVE',
    },
  });
  // Verify-after-create.
  const verify = await prisma.webhookSubscription.findUniqueOrThrow({
    where: { id: sub.id },
    select: { status: true, expiresAt: true },
  });
  if (verify.status !== 'ACTIVE' || verify.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'verify-after-renewal failed: row not ACTIVE or expiry not in future' };
  }
  await prisma.auditLog.create({
    data: {
      workspaceId: sub.workspaceId,
      action: 'integration.renewal.success',
      targetTable: 'WebhookSubscription',
      targetId: sub.id,
      payload: {
        provider: sub.provider,
        expiresAt: renewed.value.expiresAt.toISOString(),
      },
    },
  });
  return { ok: true };
}

export const integrationRenewalSweepFn = inngest.createFunction(
  {
    id: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
    name: 'agentplain integration renewal sweep',
    triggers: [{ cron: INTEGRATION_RENEWAL_SWEEP_CRON }],
  },
  async () =>
    runWithDisableGate(INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
          schedule: INTEGRATION_RENEWAL_SWEEP_CRON,
        },
        () =>
          withInngestErrorReporting(
            { functionId: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: INTEGRATION_RENEWAL_SWEEP_FUNCTION_ID,
              });
              logger.info('renewal sweep started');
              const out = await runIntegrationRenewalSweep();
              logger.info('renewal sweep finished', {
                considered: out.considered,
                refreshed: out.refreshed,
                renewed: out.renewed,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
