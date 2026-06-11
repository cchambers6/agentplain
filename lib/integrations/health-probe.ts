/**
 * lib/integrations/health-probe.ts
 *
 * Per-workspace, per-integration health probe seam (pfd-2 integration
 * self-heal). Answers ONE honest question for a connected integration: "can
 * agentplain still reach this account right now, and HOW did we verify it?"
 *
 * The signup-to-go audit flagged "health = credential status only" as
 * misleading — a stored token can read ACTIVE while the vendor 500s every
 * actual call. So this seam LABELS each result with the KIND of check it ran:
 *
 *   - REAL_READ        — we issued a real, cheap, read-only call through the
 *                        existing adapter and it returned data. The strongest
 *                        signal; the customer surface can say "we last read
 *                        your inbox 3h ago".
 *   - CREDENTIAL_ONLY  — no cheap real read is wired for this provider (or the
 *                        only safe check is a token refresh), so we verified the
 *                        credential/token is still valid (an OAuth refresh
 *                        round-trip, or — for API-key providers that never
 *                        refresh — the credential row being ACTIVE + present).
 *                        Honest about the weaker guarantee.
 *
 * Two implementations (feedback_runner_portability): `LiveIntegrationHealthProbe`
 * (real adapter calls + the existing getProvider() refresh path) and
 * `TestIntegrationHealthProbe` (scriptable, no network) for the cron's tests.
 *
 * Per feedback_no_silent_vendor_lock: vendor specifics stay inside the adapters
 * this seam calls; the cron speaks only this interface.
 *
 * Per project_no_outbound_architecture.md: every probe is READ-ONLY — a refresh
 * or a list call, never a send/mutate.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): the live probe resolves the
 * credential from the DB on every call; it holds no token cache.
 */

import type { IntegrationProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { decryptCredential, getProvider } from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';

/** What kind of verification a probe performed. Stored verbatim so the
 *  customer-facing status is honest about what we actually exercised. */
export type HealthCheckKind = 'REAL_READ' | 'CREDENTIAL_ONLY';

export type HealthProbeOutcome =
  /** The integration is reachable. `kind` says whether we proved it with a
   *  real read or only a credential check. */
  | { status: 'healthy'; kind: HealthCheckKind }
  /** The vendor rejected the credential, the grant was revoked, or a read
   *  4xx'd in a way that needs the customer to reconnect. Actionable. */
  | { status: 'unhealthy'; kind: HealthCheckKind; detail: string }
  /** No ACTIVE credential row exists for this provider in this workspace —
   *  there is nothing to check (not a failure; the cron skips it). */
  | { status: 'not_connected' }
  /** The check itself could not run (e.g. ENCRYPTION_KEY absent so we can't
   *  decrypt the token). NOT a customer-facing breakage — we cannot conclude
   *  the integration is broken, so we must not banner/email the customer. */
  | { status: 'indeterminate'; detail: string };

export interface IntegrationHealthProbe {
  /** Probe one provider for one workspace. Never throws — a probe that errors
   *  internally returns `indeterminate` (we don't KNOW it's broken). */
  probe(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<HealthProbeOutcome>;
}

/**
 * OAuth providers whose health we verify with a token-refresh round-trip via
 * the existing `getProvider()` adapter. A refresh is the cheapest authenticated
 * read these providers offer through a wired adapter, and it exercises the very
 * credential the killer workflows depend on. Labelled CREDENTIAL_ONLY (it
 * proves the token, not a data read).
 *
 * Only GOOGLE + M365 flow through `getProvider()` (see lib/integrations/types.ts
 * — the other providers run through their own MCP servers). For everything else
 * we fall back to the credential-validity check below.
 */
const GETPROVIDER_REFRESHABLE: ReadonlySet<IntegrationProvider> = new Set([
  'GOOGLE',
  'M365',
] as IntegrationProvider[]);

export class LiveIntegrationHealthProbe implements IntegrationHealthProbe {
  async probe(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<HealthProbeOutcome> {
    // Resolve the most-recently-updated credential row for this provider.
    const credential = await withSystemContext((tx) =>
      tx.integrationCredential.findFirst({
        where: { workspaceId, provider },
        orderBy: { updatedAt: 'desc' },
      }),
    ).catch(() => null);

    if (!credential) {
      return { status: 'not_connected' };
    }

    // A credential the renewal sweep already marked REVOKED/EXPIRED/ERROR is a
    // KNOWN breakage — surface it as unhealthy without re-probing the vendor.
    if (credential.status !== 'ACTIVE') {
      return {
        status: 'unhealthy',
        kind: 'CREDENTIAL_ONLY',
        detail: `credential status is ${credential.status} (set by the renewal sweep) — reconnect required`,
      };
    }

    // OAuth providers: a refresh round-trip is the authoritative reachability
    // check through the wired adapter. Needs the master key to decrypt.
    if (GETPROVIDER_REFRESHABLE.has(provider)) {
      if (!isEncryptionConfigured()) {
        return {
          status: 'indeterminate',
          detail: 'ENCRYPTION_KEY not configured — cannot decrypt the token to probe',
        };
      }
      try {
        const decrypted = decryptCredential(credential);
        if (!decrypted.refreshToken) {
          // No refresh token to exercise. The token being present + ACTIVE +
          // not yet expired is the most we can honestly claim.
          const stillValid = credential.expiresAt.getTime() > Date.now();
          return stillValid
            ? { status: 'healthy', kind: 'CREDENTIAL_ONLY' }
            : {
                status: 'unhealthy',
                kind: 'CREDENTIAL_ONLY',
                detail: 'access token expired and no refresh token is stored',
              };
        }
        const refreshed = await getProvider(
          provider as 'GOOGLE' | 'M365',
        ).refreshTokens({
          refreshToken: decrypted.refreshToken,
          accountEmail: decrypted.accountEmail,
          accountId: decrypted.accountId,
        });
        if (refreshed.ok) {
          return { status: 'healthy', kind: 'CREDENTIAL_ONLY' };
        }
        if (
          refreshed.error.code === 'GRANT_REVOKED' ||
          refreshed.error.code === 'TOKEN_EXPIRED' ||
          refreshed.error.code === 'UNAUTHORIZED'
        ) {
          return {
            status: 'unhealthy',
            kind: 'CREDENTIAL_ONLY',
            detail: `${refreshed.error.code}: ${refreshed.error.message}`,
          };
        }
        // A transient/network/rate-limit failure is NOT a customer breakage —
        // we cannot conclude the integration is broken, so stay indeterminate.
        return {
          status: 'indeterminate',
          detail: `${refreshed.error.code}: ${refreshed.error.message}`,
        };
      } catch (err) {
        return {
          status: 'indeterminate',
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // API-key + MCP-served providers (FUB, Sierra, QuickBooks, Slack, HubSpot,
    // Salesforce, Notion, TaxDome, Karbon, Buildium, Qualia, …). These don't
    // flow through getProvider(); a real read would require constructing each
    // MCP server here, which couples this seam to every adapter's surface. For
    // the daily check we verify the credential is present + ACTIVE + (for
    // refreshing providers) not past expiry — labelled CREDENTIAL_ONLY so the
    // weaker guarantee is honest. A REAL_READ probe per provider is a wired
    // follow-up (see the PR body's "known limits").
    const notExpired = credential.expiresAt.getTime() > Date.now();
    // API-key providers pin expiresAt far in the future (sentinel), so the
    // not-expired check passes for them — correct: their key doesn't expire.
    return notExpired
      ? { status: 'healthy', kind: 'CREDENTIAL_ONLY' }
      : {
          status: 'unhealthy',
          kind: 'CREDENTIAL_ONLY',
          detail: 'access token past expiry and the renewal sweep has not refreshed it',
        };
  }
}

/** Scriptable in-memory probe for tests — no network, no DB. Keyed by
 *  `${workspaceId}:${provider}`; falls back to `not_connected`. */
export class TestIntegrationHealthProbe implements IntegrationHealthProbe {
  constructor(
    private readonly outcomes: Record<string, HealthProbeOutcome> = {},
  ) {}
  private key(workspaceId: string, provider: IntegrationProvider): string {
    return `${workspaceId}:${provider}`;
  }
  async probe(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<HealthProbeOutcome> {
    return this.outcomes[this.key(workspaceId, provider)] ?? { status: 'not_connected' };
  }
}
