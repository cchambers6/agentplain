/**
 * lib/integrations/byo/scope-grants.ts
 *
 * Scope grants for Customer-Brought integrations: the customer chooses how
 * much each connection is allowed to DO. Pure functions over the scope-level
 * lattice — no IO.
 */

import type { MarketplaceEntry } from '../marketplace';
import {
  BYO_SCOPE_ORDER,
  type ByoAction,
  type ByoScopeGrant,
  type ByoScopeLevel,
} from './types';

/** Rank of a scope level in the least→most-capable order. */
export function scopeRank(level: ByoScopeLevel): number {
  return BYO_SCOPE_ORDER.indexOf(level);
}

/**
 * Whether a scope level permits an action class.
 *
 *   read-only           → read
 *   read-write          → read, write, outbound (outbound still routes through
 *                          /approvals at the runtime — the grant permits it,
 *                          the approval queue gates the firing)
 *   write-with-approval → read, write, outbound (identical capability surface;
 *                          the difference is the grant DEMANDS the approval
 *                          step, where read-write merely allows it)
 */
export function scopeLevelAllows(
  level: ByoScopeLevel,
  action: ByoAction,
): boolean {
  if (action === 'read') return true; // every level can read
  // write + outbound require at least read-write
  return scopeRank(level) >= scopeRank('read-write');
}

/**
 * Does this grant force every mutation through the approval queue? True for
 * `write-with-approval`; `read-write` permits the runtime to auto-fire bounded
 * actions (still subject to the per-workspace auto-execute flag). `read-only`
 * has nothing to gate.
 */
export function requiresApproval(level: ByoScopeLevel): boolean {
  return level === 'write-with-approval';
}

/**
 * The default scope level we propose for a connection at connect time.
 *
 * Default to the SAFE ceiling: any connector that can originate an outbound-
 * shaped action defaults to `write-with-approval`, so a fresh connection never
 * auto-fires before the customer has opted into it. Pure-read connectors
 * (notify/mirror surfaces like Slack and Notion, tagged `non-critical`) default
 * to `read-only` — they hold no system-of-record, so write access isn't needed
 * out of the gate.
 */
export function defaultScopeLevel(entry: MarketplaceEntry): ByoScopeLevel {
  // Notify/mirror connectors don't own a record — start them read-only.
  if (entry.criticality === 'non-critical') return 'read-only';
  // A connector that declares scopes and none of them can write → read-only.
  if (isReadOnlyByScopes(entry)) return 'read-only';
  // Everything else can mutate or originate outbound → safe ceiling.
  return 'write-with-approval';
}

/** Heuristic: does a declared scope string grant write/outbound capability? */
function isWriteScope(scope: string): boolean {
  return /(write|modify|compose|send|create|update|manage|delete)/.test(
    scope.toLowerCase(),
  );
}

/**
 * A connector is read-only by its scopes when it declares at least one scope
 * and NONE of them can write. Connectors with an empty (decorative) scope
 * array — the api-key connectors whose write capability lives in the adapter,
 * not the catalog — fall through to the safe write ceiling, never silently
 * read-only.
 */
function isReadOnlyByScopes(entry: MarketplaceEntry): boolean {
  return entry.scopes.length > 0 && !entry.scopes.some(isWriteScope);
}

/**
 * Resolve the effective scope level for an integration: the customer's grant
 * if present, else the proposed default. A grant can only be AT MOST the
 * connector's natural ceiling — a read-only connector can't be granted write.
 */
export function effectiveScopeLevel(
  entry: MarketplaceEntry,
  grant: ByoScopeGrant | null,
): ByoScopeLevel {
  const ceiling = naturalCeiling(entry);
  if (!grant) return min(defaultScopeLevel(entry), ceiling);
  return min(grant.level, ceiling);
}

/**
 * The most-capable level a connector can ever be granted. A connector that
 * only declares read scopes can never be granted write/outbound, no matter
 * what a stale grant row says.
 */
export function naturalCeiling(entry: MarketplaceEntry): ByoScopeLevel {
  if (isReadOnlyByScopes(entry)) return 'read-only';
  return 'write-with-approval';
}

/** Return the lower (less-capable) of two scope levels. */
export function min(a: ByoScopeLevel, b: ByoScopeLevel): ByoScopeLevel {
  return scopeRank(a) <= scopeRank(b) ? a : b;
}

/** Human-facing label for a scope level (customer vocabulary, not engineer). */
export const SCOPE_LEVEL_LABEL: Record<ByoScopeLevel, string> = {
  'read-only': 'Read only',
  'read-write': 'Read + write back',
  'write-with-approval': 'Read + write, approval required',
};

/** One-line plain-language explanation per scope level. */
export const SCOPE_LEVEL_EXPLAINER: Record<ByoScopeLevel, string> = {
  'read-only':
    'We read this account to surface what needs you. We never write anything back.',
  'read-write':
    'We read and write back notes, tags, and file versions. Nothing sends to a third party without you.',
  'write-with-approval':
    'We read and draft, and every change waits in your approvals queue until you say go.',
};

/** The scope levels a given connector can offer (read-only up to its ceiling). */
export function offerableScopeLevels(
  entry: MarketplaceEntry,
): readonly ByoScopeLevel[] {
  const ceiling = naturalCeiling(entry);
  return BYO_SCOPE_ORDER.filter((l) => scopeRank(l) <= scopeRank(ceiling));
}
