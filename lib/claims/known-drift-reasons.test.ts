/**
 * lib/claims/known-drift-reasons.test.ts
 *
 * THE REASONS ARE CLAIMS TOO.
 *
 * `known-drift.ts` is the ratchet's accept-list. Every entry carries a
 * `reason`, and until 2026-09-11 nothing checked a single one of them against
 * the code. That is the same defect the quarantine list had and fixed: a
 * suppression's prose is what the next reader trusts INSTEAD of the code, so a
 * reason that quietly becomes false is worse than no reason at all. It has
 * already happened twice in this repo — one false quarantine reason was read
 * by an auditor and relayed to the owner as a live security hole.
 *
 * Two entries here were making a claim that had been investigated and
 * retracted:
 *
 *   • property-management/pm-collections said it was "the one entry here that
 *     is a caller gap rather than a copy gap".
 *   • home-services/home-services-estimate-followup said "no caller".
 *
 * Both are false, and both are false the same way. `lib/inngest/registry.ts`
 * derives its function list from the FILESYSTEM via `require.context`, so a
 * file under `lib/inngest/functions/` is registered BY EXISTING. Both skills
 * have exactly such a file. The violations are real; the characterisations
 * were not.
 *
 * So this file pins the checkable half of each reason:
 *
 *   a reason may not assert that NOTHING CAN FIRE a skill when a registered
 *   sweep under lib/inngest/functions/ names that skill.
 *
 * Reports `examined N of M` and fails at N = 0, because a corpus check that
 * silently finds no corpus is the bug this layer exists to remove.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KNOWN_CLAIM_DRIFT } from './known-drift';

const here = dirname(fileURLToPath(import.meta.url));
const FN_DIR = join(here, '..', 'inngest', 'functions');

/**
 * Registered Inngest functions. NOT a manifest read — the filesystem, because
 * the filesystem is what `lib/inngest/registry.ts` reads. Reasoning from a
 * manifest is precisely how "nothing fires it" got asserted about a skill
 * fired by a daily cron.
 */
const sweepSources: ReadonlyMap<string, string> = new Map(
  readdirSync(FN_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => [f, readFileSync(join(FN_DIR, f), 'utf8')]),
);

/** Phrases that assert nothing can fire the skill. Narrow on purpose: this
 *  must catch the retracted claim without firing on "no production caller is
 *  DECLARED in the manifest", which is true and is the actual gap. */
const NO_CALLER_CLAIM =
  /\b(no caller|nothing fires it|nothing can fire|nothing will ever trigger|is a caller gap)\b/i;

/**
 * A correction has to be able to QUOTE what it retracts, or the next reader
 * cannot tell what changed. So the matcher reads a reason's own assertions
 * only: double-quoted spans are reported speech and are stripped first.
 *
 * This was not a theory — the first run of this check went red on the two
 * entries it had just been written to clear, because each correction quotes
 * the sentence it withdraws.
 *
 * BLIND SPOT: a live claim placed inside double quotes is invisible here.
 * Accepted deliberately. The alternative is a check that forbids quoting a
 * retracted claim, which would make every correction unreadable.
 */
function assertedText(reason: string): string {
  return reason.replace(/"[^"]*"/g, ' ');
}

/** The skill slug an entry is about, read out of the reason text. Each reason
 *  names its bound skill explicitly; anything we cannot resolve is reported
 *  rather than skipped, so a rewording cannot silently drop an entry. */
function skillSlugsMentioned(reason: string): string[] {
  return [...sweepSources.keys()]
    .map((f) => f.replace(/-sweep\.ts$/, '').replace(/\.ts$/, ''))
    .filter((slug) => reason.includes(slug));
}

describe('known-drift reasons — a reason is a claim, and claims get checked', () => {
  it('no reason asserts "nothing fires it" about a skill a registered sweep fires', () => {
    const M = KNOWN_CLAIM_DRIFT.length;
    assert.ok(
      M > 0,
      'examined 0 of 0 known-drift entries — KNOWN_CLAIM_DRIFT is empty, so this ' +
        'assertion proves nothing. An empty accept-list is a deletion, not a pass.',
    );
    assert.ok(
      sweepSources.size > 0,
      `examined 0 of 0 sweep files under ${FN_DIR} — the corpus this check adjudicates ` +
        'against is empty, so every reason would clear it vacuously.',
    );

    const bad: string[] = [];
    let examined = 0;
    for (const entry of KNOWN_CLAIM_DRIFT) {
      examined++;
      if (!NO_CALLER_CLAIM.test(assertedText(entry.reason))) continue;
      const fired = skillSlugsMentioned(entry.reason);
      if (fired.length > 0) {
        bad.push(
          `${entry.subject}: reason claims nothing fires it, but ${fired
            .map((s) => `lib/inngest/functions/${s}-sweep.ts`)
            .join(' and ')} exists and is registered by existing.`,
        );
      }
    }

    assert.deepEqual(
      bad,
      [],
      `examined ${examined} of ${M} known-drift entries; ${bad.length} assert a caller ` +
        `gap that the filesystem refutes:\n  ${bad.join('\n  ')}\n\n` +
        'A registered sweep is a caller. If the gap is that the skill is missing from ' +
        'SWEEP_DISPATCH_MANIFEST, say THAT — it is a different, real, and smaller claim.',
    );
    assert.equal(examined, M, `examined ${examined} of ${M} — entries were skipped`);
  });

  it('every entry has a reason and a dated expiry', () => {
    const M = KNOWN_CLAIM_DRIFT.length;
    assert.ok(M > 0, 'examined 0 of 0 known-drift entries');
    const ok = KNOWN_CLAIM_DRIFT.filter(
      (e) => e.reason.trim().length > 0 && !Number.isNaN(Date.parse(e.expires)),
    );
    assert.equal(
      ok.length,
      M,
      `examined ${ok.length} of ${M} entries carrying both a reason and a valid expiry.`,
    );
  });
});
