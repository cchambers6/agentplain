/**
 * lib/integrations/byo/index.ts
 *
 * Customer-Brought (BYO) integration framework — public surface.
 *
 * A BYO integration is a customer account agentplain plugs into: the customer
 * owns the credential, pays their own vendor, and agentplain charges $0 for the
 * connection. This framework governs scope grants, auth-state/health, 90-day
 * key-rotation reminders, and revocation planning. Every marketplace tile is
 * BYO by nature (see `lib/integrations/sourcing.ts`).
 *
 * Pages and routes import from here, not from the sub-modules, so the framework
 * has one seam.
 */

export type {
  ByoScopeLevel,
  ByoAction,
  ByoScopeGrant,
  ByoConnectionState,
  ByoConnectionHealth,
  RotationStatus,
  RotationReminder,
  RevocationPlan,
  ByoCredentialView,
} from './types';
export { BYO_SCOPE_ORDER } from './types';

export {
  scopeRank,
  scopeLevelAllows,
  requiresApproval,
  defaultScopeLevel,
  effectiveScopeLevel,
  naturalCeiling,
  offerableScopeLevels,
  SCOPE_LEVEL_LABEL,
  SCOPE_LEVEL_EXPLAINER,
} from './scope-grants';

export {
  ROTATION_INTERVAL_DAYS,
  ROTATION_WARN_DAYS,
  needsRotationReminder,
  rotationStatusFor,
  rotationReminderFor,
  rotationRemindersDue,
} from './rotation';

export {
  EXPIRING_SOON_MS,
  connectionStateFor,
  connectionHealthFor,
  needsAttention,
  CONNECTION_STATE_LABEL,
  type ByoHealthSignals,
} from './auth-state';

export { planRevocation } from './revocation';
