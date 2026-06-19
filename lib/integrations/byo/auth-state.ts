/**
 * lib/integrations/byo/auth-state.ts
 *
 * Per-tool auth state for Customer-Brought connections: current health, last
 * successful call, and last error — derived purely from an
 * `IntegrationCredential` row + the clock. The BYO UI and the integration
 * self-heal layer read this to decide what to show and whether to nudge.
 */

import { getMarketplaceEntry } from '../marketplace';
import type {
  ByoConnectionHealth,
  ByoConnectionState,
  ByoCredentialView,
} from './types';

/** OAuth tokens within this window of expiry are flagged `expiring`. */
export const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Optional signals the caller may have observed out-of-band (a last successful
 * call timestamp, a recent error) that aren't columns on the credential row.
 * Both default to absent.
 */
export interface ByoHealthSignals {
  lastSuccessfulCallAt?: Date | null;
  lastError?: string | null;
}

/**
 * Derive connection state from a credential's status + expiry. Pure.
 *
 *   no credential            → not-connected
 *   status REVOKED           → revoked
 *   status ERROR             → error
 *   status EXPIRED           → expired
 *   ACTIVE, past expiry       → expired (the row lags; the token is dead)
 *   ACTIVE, expiring < 24h    → expiring
 *   ACTIVE, healthy           → connected
 */
export function connectionStateFor(
  cred: ByoCredentialView | null,
  now: Date,
): ByoConnectionState {
  if (!cred) return 'not-connected';
  switch (cred.status) {
    case 'REVOKED':
      return 'revoked';
    case 'ERROR':
      return 'error';
    case 'EXPIRED':
      return 'expired';
    default:
      break;
  }
  // status ACTIVE — cross-check the clock.
  if (cred.expiresAt) {
    const msToExpiry = cred.expiresAt.getTime() - now.getTime();
    if (msToExpiry <= 0) return 'expired';
    if (msToExpiry <= EXPIRING_SOON_MS) return 'expiring';
  }
  return 'connected';
}

/** Build the full health record for one BYO credential. */
export function connectionHealthFor(
  integrationId: string,
  cred: ByoCredentialView | null,
  now: Date,
  signals: ByoHealthSignals = {},
): ByoConnectionHealth | null {
  const entry = getMarketplaceEntry(integrationId);
  if (!entry || entry.providerKey === null) return null;
  return {
    integrationId,
    provider: entry.providerKey,
    accountEmail: cred?.accountEmail ?? null,
    state: connectionStateFor(cred, now),
    lastSuccessfulCallAt: signals.lastSuccessfulCallAt ?? null,
    lastError: signals.lastError ?? null,
    expiresAt: cred?.expiresAt ?? null,
  };
}

/** Whether a state is one a customer needs to act on (reconnect/rotate). */
export function needsAttention(state: ByoConnectionState): boolean {
  return state === 'expired' || state === 'revoked' || state === 'error';
}

/** Customer-vocabulary label for a connection state. */
export const CONNECTION_STATE_LABEL: Record<ByoConnectionState, string> = {
  connected: 'Connected',
  expiring: 'Connected — renewing soon',
  expired: 'Reconnect needed',
  revoked: 'Disconnected',
  error: 'Needs a look',
  'not-connected': 'Not connected',
};
