/**
 * tests/quarantine-expiry.test.ts
 *
 * THE ANTI-CLIFF STANDARD.
 *
 * `tools/test-gate.mjs` validates that each quarantine entry has a reason, a
 * class and a `matches` signature, and it fails once an entry is past its
 * expiry. What nothing checked until 2026-09-11 is the SHAPE of the expiry
 * set — and the shape was one date.
 *
 * All 35 suppressions shared the single top-level `expires: 2026-11-09`. On
 * that morning the entire list fails at once. A wall of 35 simultaneous
 * failures does not get reviewed entry by entry; it gets re-dated in one
 * commit, which is the precise outcome an expiry date exists to prevent. The
 * gate's own prose names the blanket re-date as the failure mode and then
 * offered no other affordance.
 *
 * These assertions are about the DISTRIBUTION, not any individual date, so
 * they keep holding as entries are fixed and deleted:
 *
 *   • every entry carries its own expiry,
 *   • no entry's expiry is later than the list-wide cap (staggering may pull a
 *     suppression forward, never push it out — that would be weakening it),
 *   • the dates are spread, and no single day carries enough of the list to be
 *     a cliff again.
 *
 * Every count below is reported as `examined N of M` and fails at N = 0, for
 * the reason this whole file exists: a check that passes over an empty corpus
 * is indistinguishable from a check that works.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface QuarantineEntry {
  class: string;
  file: string;
  test: string;
  matches: string;
  reason: string;
  expires: string;
}

interface Quarantine {
  expires: string;
  entries: QuarantineEntry[];
}

const here = dirname(fileURLToPath(import.meta.url));
const quarantinePath = join(here, 'quarantine.json');
const q: Quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8'));
const M = q.entries.length;

/** The N = 0 guard, asserted first and separately so every count below it
 *  is known to be over a non-empty corpus. */
function assertCorpusIsReal(): void {
  assert.ok(
    M > 0,
    'examined 0 of 0 quarantine entries. tests/quarantine.json parsed but is empty, ' +
      'so every assertion in this file would pass vacuously. If the list really is ' +
      'empty, delete this file and say so; do not let it stand as green.',
  );
}

describe('quarantine expiries — no cliff', () => {
  it('every entry carries its own expiry, and it is a real date', () => {
    assertCorpusIsReal();
    const dated = q.entries.filter(
      (e) => typeof e.expires === 'string' && !Number.isNaN(Date.parse(e.expires)),
    );
    assert.equal(
      dated.length,
      M,
      `examined ${dated.length} of ${M} quarantine entries with a valid own "expires". ` +
        `${M - dated.length} rely on the top-level date, which is how 35 suppressions ` +
        `came to share one cliff.`,
    );
  });

  it('no entry expires later than the list-wide cap', () => {
    assertCorpusIsReal();
    const cap = new Date(q.expires);
    assert.ok(!Number.isNaN(cap.getTime()), `top-level "expires" is not a date: ${q.expires}`);

    const over = q.entries.filter((e) => new Date(e.expires) > cap);
    assert.deepEqual(
      over.map((e) => `${e.expires} ${e.file} :: ${e.test}`),
      [],
      `examined ${M} of ${M} entries; ${over.length} expire after the cap ${q.expires}. ` +
        'Restructuring expiries may not weaken a suppression. Pulling a date forward is ' +
        'the whole point; pushing one out is the thing the standing rule forbids.',
    );
  });

  it('the expiries are staggered — no single day is a cliff', () => {
    assertCorpusIsReal();

    const byDate = new Map<string, number>();
    for (const e of q.entries) byDate.set(e.expires, (byDate.get(e.expires) ?? 0) + 1);

    const distinct = byDate.size;
    assert.ok(
      distinct > 1,
      `examined ${M} of ${M} entries and found ${distinct} distinct expiry date(s). ` +
        `Every suppression falls off on ${q.entries[0]?.expires} together. A list that ` +
        'expires all at once gets bulk-extended, not reviewed — which is the failure ' +
        'the date is supposed to prevent.',
    );

    // Proportional, so it survives entries being fixed and deleted. A third of
    // the list landing on one morning is already a wall.
    const budget = Math.ceil(M / 3);
    const worst = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];
    assert.ok(
      worst[1] <= budget,
      `examined ${M} of ${M} entries across ${distinct} dates; ${worst[1]} of them ` +
        `expire on ${worst[0]} alone, over the budget of ${budget} (one third). ` +
        'That is a cliff re-forming. Spread the remediation units out.',
    );
  });

  it('every entry still carries a non-empty `matches` pin', () => {
    // Not an expiry property, but the same class of defect and the same file:
    // a suppression with no signature is one a DIFFERENT failure can inherit.
    // Asserted here so the pin and the date are checked by the same standard.
    assertCorpusIsReal();
    const pinned = q.entries.filter(
      (e) => typeof e.matches === 'string' && e.matches.trim().length > 0,
    );
    assert.equal(
      pinned.length,
      M,
      `examined ${pinned.length} of ${M} quarantine entries with a non-empty "matches". ` +
        `${M - pinned.length} suppress by name alone, so an unrelated failure in the same ` +
        'test would inherit the entry in silence.',
    );
  });
});
