/**
 * lib/claims/known-drift.ts
 *
 * The ratchet. Same semantics the brand-gate and voice-gate baselines already
 * use in this repo: only NEW violations fail. It exists because a gate that is
 * red the day it lands gets ignored, and an ignored gate is worse than no gate
 * — it reads as coverage.
 *
 * What makes this different from "baseline it and forget":
 *
 *   • Every entry is ITEMIZED. There is no count, no wildcard, no
 *     `--all`-style suppression. A new violation on the same file, or a
 *     reworded one, does not match an accepted subject and fails.
 *   • Every entry carries a REASON and an EXPIRES date. Past the expiry the
 *     check fails on the accepted entry too. Debt here cannot go quiet; it
 *     comes back and asks again.
 *   • An entry whose violation has been FIXED also fails (stale-acceptance
 *     check), so the list cannot rot into fiction.
 *
 * Adding an entry is a deliberate, dated statement that this specific lie is
 * shipping on purpose until a specific day. It is not a way to make a test
 * green.
 */

import type { ClaimCheckId, ClaimViolation } from './types';

export interface KnownDriftEntry {
  check: ClaimCheckId;
  /** Must equal `ClaimViolation.subject` exactly. */
  subject: string;
  /** Why this ships un-fixed. Name the blocking decision, not "TODO". */
  reason: string;
  /** ISO date. After this, the gate fails on this entry. */
  expires: string;
}

/**
 * Accepted, dated drift as of 2026-08-11.
 *
 * The seven roster entries below are one finding, not seven: each vertical's
 * flagship fleet card is `runtime: 'live'` with a `boundSkill` whose skill has
 * no production caller, so `/app/workspace/[id]/agents` renders "Watching —
 * ready when triggered" for a capability nothing can trigger.
 *
 * They are NOT fixed here on purpose. The honest fix is to flip each card to
 * `runtime: 'rooting'` with a `rootingNote`, which changes what seven paying
 * verticals see in-product and re-baselines the expected live/rooting counts
 * in `tests/vertical-roster-bindings.test.ts`. That is a product-copy call,
 * not a gate call, and folding it into the PR that introduces the gate would
 * bury it. The expiry forces it back onto the board.
 */
export const KNOWN_CLAIM_DRIFT: readonly KnownDriftEntry[] = [
  {
    check: 'roster-capability',
    subject: 'mortgage/mortgage-document-chase',
    reason:
      'Card is live+bound to mortgage-document-chase (catalog runtime schema-only, no caller). Fix is to flip the card to rooting — a product-copy change across 7 verticals, tracked separately from the gate that found it.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'insurance/insurance-coi-generator',
    reason:
      'Card is live+bound to insurance-coi-request (catalog runtime schema-only, no caller). Same remediation batch as mortgage/mortgage-document-chase.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'property-management/pm-collections',
    reason:
      'Card is live+bound to property-management-rent-collection-chase, which IS catalog-live but is declared in neither SWEEP_DISPATCH_MANIFEST nor NON_SWEEP_LIVE_SKILLS. lib/skills/__tests__/registry-truth.test.ts independently fails on the same gap — this is the one entry here that is a caller gap rather than a copy gap.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'title-escrow/title-doc-chase',
    reason:
      'Card is live+bound to title-escrow-closing-doc-chase (catalog runtime schema-only, no caller). Same remediation batch.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'recruiting/recruiting-candidate-status-update',
    reason:
      'Card is live+bound to recruiting-candidate-status-update (catalog runtime schema-only, no caller). Same remediation batch.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'home-services/home-services-estimate-followup',
    reason:
      'Card is live+bound to home-services-estimate-followup (catalog runtime schema-only, no caller). Same remediation batch.',
    expires: '2026-11-09',
  },
  {
    check: 'roster-capability',
    subject: 'ria/ria-performance-reporter',
    reason:
      'Card is live+bound to ria-client-update-draft (catalog runtime schema-only, no caller). Same remediation batch.',
    expires: '2026-11-09',
  },
];

export interface RatchetResult {
  /** Violations with no accepted entry — these fail the gate. */
  unaccepted: ClaimViolation[];
  /** Accepted entries whose expiry has passed — these fail the gate too. */
  expired: KnownDriftEntry[];
  /** Accepted entries with no matching violation — the list has rotted. */
  stale: KnownDriftEntry[];
}

function key(check: ClaimCheckId, subject: string): string {
  return `${check}::${subject}`;
}

/**
 * Apply the ratchet. `today` is injected so the expiry behaviour is testable
 * without waiting three months.
 */
export function applyRatchet(
  violations: readonly ClaimViolation[],
  today: Date,
  known: readonly KnownDriftEntry[] = KNOWN_CLAIM_DRIFT,
): RatchetResult {
  const knownByKey = new Map(known.map((e) => [key(e.check, e.subject), e]));
  const seen = new Set<string>();

  const unaccepted: ClaimViolation[] = [];
  for (const v of violations) {
    const k = key(v.check, v.subject);
    seen.add(k);
    if (!knownByKey.has(k)) unaccepted.push(v);
  }

  const expired = known.filter((e) => new Date(e.expires) < today);
  const stale = known.filter((e) => !seen.has(key(e.check, e.subject)));

  return { unaccepted, expired, stale };
}
