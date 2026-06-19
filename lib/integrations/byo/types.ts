/**
 * lib/integrations/byo/types.ts
 *
 * Customer-Brought (BYO) integration framework — shared types.
 *
 * A BYO integration is a customer account agentplain plugs into. The customer
 * owns the credential and pays their own vendor; agentplain charges $0 for the
 * connection. This framework governs the four things that matter once a BYO
 * credential exists:
 *
 *   1. Scope grants     — how much the customer lets us DO with the account
 *                          (read-only / read+write / write-with-approval).
 *   2. Auth state        — current connection health, last successful call,
 *                          last error.
 *   3. Rotation reminders — for pasted API keys (which don't auto-refresh),
 *                          a 90-day nudge to rotate.
 *   4. Revocation         — a one-tap plan to remove the credential + the
 *                          customer data we ingested through it.
 *
 * Everything here is pure data + pure functions. The DB reads/writes stay at
 * the existing seams (`withRls`, the disconnect server action) per
 * `feedback_cold_start_safe_agents.md` — this layer never holds state.
 */

/**
 * How much the customer authorizes us to DO with a BYO account. Ordered from
 * least to most capable. Per `project_no_outbound_architecture.md`, nothing
 * agentplain sends ever leaves without the customer's hand on it — so the
 * most-capable level is `write-with-approval`, never an unattended `write`.
 *
 *   'read-only'           — we read the account; we never write back.
 *   'read-write'          — we read AND write non-outbound records back
 *                           (CRM notes, tags, file versions). No message ever
 *                           sends to a third party from this level.
 *   'write-with-approval' — same as read-write, but every mutating action is
 *                           staged into /approvals and waits for the customer.
 *                           This is the safe default for any connector that can
 *                           originate an outbound-shaped action.
 */
export type ByoScopeLevel = 'read-only' | 'read-write' | 'write-with-approval';

/** Least → most capable, used for comparisons and the "at most" ceiling. */
export const BYO_SCOPE_ORDER: readonly ByoScopeLevel[] = [
  'read-only',
  'read-write',
  'write-with-approval',
];

/** The discrete action classes a scope level gates. */
export type ByoAction = 'read' | 'write' | 'outbound';

/**
 * A customer's chosen scope grant for one BYO integration. Persisted by the
 * caller (today: `IntegrationCredential.providerMetadata.scopeGrant`); this
 * type is the in-memory shape the framework reasons over.
 */
export interface ByoScopeGrant {
  integrationId: string;
  level: ByoScopeLevel;
  grantedByUserId: string;
  grantedAt: Date;
}

/** Current connection health for one BYO credential. */
export type ByoConnectionState =
  | 'connected' // ACTIVE, token unexpired
  | 'expiring' // ACTIVE but token expires soon (OAuth refresh window)
  | 'expired' // token past expiry, refresh needed
  | 'revoked' // customer or vendor revoked the grant
  | 'error' // last call failed for a non-auth reason
  | 'not-connected'; // no credential row yet

export interface ByoConnectionHealth {
  integrationId: string;
  /** The `IntegrationProvider` value on the credential row (a provider-key
   *  string such as 'GOOGLE' or 'FOLLOW_UP_BOSS'). */
  provider: string;
  accountEmail: string | null;
  state: ByoConnectionState;
  /** Last time a call through this credential succeeded, if ever. */
  lastSuccessfulCallAt: Date | null;
  /** Human-readable last error, if the connection is unhealthy. */
  lastError: string | null;
  /** Token expiry (OAuth) or sentinel far-future (API-key). */
  expiresAt: Date | null;
}

/** Rotation status for a pasted API-key credential. */
export type RotationStatus = 'ok' | 'due-soon' | 'overdue';

export interface RotationReminder {
  integrationId: string;
  /** The `IntegrationProvider` value on the credential row (a provider-key
   *  string such as 'GOOGLE' or 'FOLLOW_UP_BOSS'). */
  provider: string;
  accountEmail: string | null;
  /** Age of the credential in whole days since it was created/last rotated. */
  ageDays: number;
  /** Days until (negative = past) the 90-day rotation point. */
  dueInDays: number;
  status: RotationStatus;
}

/**
 * The plan a one-tap revocation executes. Pure description — the existing
 * disconnect server action carries it out (deletes the credential, then the
 * customer data ingested through it, then audits both). Kept here so the BYO
 * UI can preview "what disconnecting removes" before the customer confirms.
 */
export interface RevocationPlan {
  integrationId: string;
  /** The `IntegrationProvider` value on the credential row (a provider-key
   *  string such as 'GOOGLE' or 'FOLLOW_UP_BOSS'). */
  provider: string;
  /** What the customer is told gets removed, in order. */
  removes: string[];
  /** What is deliberately KEPT (the audit trail). */
  retains: string[];
}

/**
 * The minimal credential shape the BYO framework reads. A structural subset of
 * the Prisma `IntegrationCredential` row, so callers can pass a narrowed
 * `select` without coupling this layer to Prisma.
 */
export interface ByoCredentialView {
  /** The `IntegrationProvider` value on the credential row (a provider-key
   *  string such as 'GOOGLE' or 'FOLLOW_UP_BOSS'). */
  provider: string;
  accountEmail: string | null;
  status: string; // 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR'
  expiresAt: Date | null;
  createdAt: Date;
  lastRefreshedAt: Date | null;
}
