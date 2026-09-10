/**
 * lib/graph/provenance.ts
 *
 * The provenance ladder and the two predicates that make it load-bearing.
 *
 * An enum nobody branches on is decoration. Provenance earns its place by
 * gating two decisions:
 *
 *   1. `mayOverwrite` - whether an incoming write is allowed to replace
 *      the label / attributes / provenance already on a node. A CONNECTOR
 *      row read from the customer's own system of record is not
 *      downgraded by a later approval-minted guess at the same party.
 *
 *   2. `isEmbeddable` - whether the record is strong enough to be
 *      asserted downstream (indexed, embedded, or used as the basis of a
 *      stated conclusion). INFERRED is not. A machine guess may raise a
 *      question; it may never assert.
 *
 * Both are pure. Neither touches I/O.
 */

import type { Provenance } from './types';

/**
 * Strength order. Higher wins.
 *
 * CONNECTOR outranks CUSTOMER because a connector read is re-derivable
 * from a system the customer already trusts, while typed input goes stale
 * silently. APPROVED sits below both because it is a human decision about
 * one artifact, not a statement about the world. INFERRED is the floor.
 */
export const PROVENANCE_RANK: Readonly<Record<Provenance, number>> = {
  CONNECTOR: 4,
  CUSTOMER: 3,
  APPROVED: 2,
  INFERRED: 1,
};

/** Every provenance value, strongest first. Handy for exhaustive tests. */
export const PROVENANCE_ORDER: readonly Provenance[] = [
  'CONNECTOR',
  'CUSTOMER',
  'APPROVED',
  'INFERRED',
];

/**
 * May an `incoming` write replace the mutable fields of a record that is
 * currently at `existing`?
 *
 * Equal rank overwrites: a fresh CONNECTOR read is allowed to refresh a
 * CONNECTOR node's label. Lower rank does not: the write still lands (the
 * store advances `lastSeenAt` so we keep the corroboration signal) but it
 * leaves label, attributes and provenance alone.
 */
export function mayOverwrite(
  existing: Provenance,
  incoming: Provenance,
): boolean {
  return PROVENANCE_RANK[incoming] >= PROVENANCE_RANK[existing];
}

/**
 * Is this record strong enough to be asserted downstream?
 *
 * True for CONNECTOR, CUSTOMER and APPROVED - each traces to a human or a
 * system the customer authorized. False for INFERRED.
 *
 * The word "embeddable" is the original framing (do not put it in the
 * vector index), but the predicate is broader than embeddings: it is the
 * general "is this good enough to state as fact" gate. Consumers that
 * cannot drop an INFERRED record must instead escalate it - see the
 * status mapping in GraphLedgerFetcher, where a non-embeddable party is
 * routed to the strictest conflict branch rather than deleted.
 */
export function isEmbeddable(p: Provenance): boolean {
  return p !== 'INFERRED';
}
