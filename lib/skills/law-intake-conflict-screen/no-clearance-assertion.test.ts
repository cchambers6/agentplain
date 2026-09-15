/**
 * lib/skills/law-intake-conflict-screen/no-clearance-assertion.test.ts
 *
 * The rule this pins, in Conner's words: "Be super careful to never write
 * legal advice. We handle the business running stuff."
 *
 * The boundary is RETRIEVAL vs CONCLUSION. Reporting what a deterministic
 * name pass matched is retrieval and is ours. Asserting that a conflict
 * check cleared, that no conflicts exist, or that the firm may take the
 * representation is a conclusion a licensed professional is paid to make
 * and carries liability for. It is never ours.
 *
 * A conclusion does not stop being a conclusion because a human approves
 * it. Approval covers SENDING. Drafting the verdict and asking for a
 * rubber stamp is worse than not drafting it, because that is precisely
 * what it invites.
 *
 * What escaped before this test existed, at origin/main:
 *   - lib/onboarding/demo-data.ts, the LAW activation draft:
 *     "I have reviewed the details of your matter and run our conflict
 *      check — we are clear to represent you"
 *   - lib/skills/law-intake-conflict-screen/engagement-letter.ts, in a
 *     letter addressed to the client:
 *     "No conflicts were identified on the automated pass"
 *
 * Reporting discipline (see the repo's `examined N of M` standard): this
 * file asserts a per-root minimum on the number of rendered strings it
 * collected and FAILS when a root collects zero. A corpus-driven check
 * that silently collects nothing passes vacuously and proves nothing.
 */

import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { renderEngagementLetter } from './engagement-letter';
import { JsonLedgerFetcher } from './json-fetcher';
import type { LedgerEntry, ProspectiveIntake } from './types';
import { buildActivationDraft, demoDatasetFor } from '../../onboarding/demo-data';

const WORKSPACE_ID = 'ws-law-clearance-guard';

/**
 * Sentences that assert a conflict-check outcome, a clearance, or fitness
 * to represent. Hedged forms ("appears to be clear", "no conflicts
 * detected") are conclusions too and are banned on the same footing —
 * the fix for a verdict is removal, not qualification.
 */
const CLEARANCE_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'clear-to-represent', re: /\bclear(ed)?\s+to\s+(represent|proceed|accept|take|engage)\b/i },
  { name: 'can-take-this-on', re: /\b(we|I)\s+(can|are able to)\s+take\s+(this|the matter|your matter)\s+on\b/i },
  { name: 'no-conflicts', re: /\bno\s+(potential\s+|apparent\s+)?conflicts?\b/i },
  { name: 'conflict-free', re: /\bconflict[-\s]free\b/i },
  { name: 'screen-is-clear', re: /\bconflict\s+(screen|check)[^.\n]{0,24}\bclear(ed|s)?\b/i },
  { name: 'screen-clear-heading', re: /\b(screen|check)\s*[—–:-]\s*clear\b/i },
  { name: 'result-clear', re: /\bresult:\s*clear\b/i },
  { name: 'appears-clear', re: /\bappears?\s+to\s+be\s+(clear|conflict)/i },
  { name: 'may-represent', re: /\b(the firm|we|you)\s+may\s+(represent|accept the representation)\b/i },
];

interface Rendered {
  root: string;
  unit: string;
  text: string;
}

const corpus: Rendered[] = [];
function collect(root: string, unit: string, text: string | null | undefined): void {
  // Deliberately NOT wrapped in try/catch. A corpus builder that swallows
  // an error returns [] and turns the whole standard into a silent no-op.
  if (typeof text !== 'string') {
    throw new Error(`corpus builder produced a non-string for ${root}/${unit}`);
  }
  corpus.push({ root, unit, text });
}

function intake(overrides: Partial<ProspectiveIntake> = {}): ProspectiveIntake {
  return {
    matterId: 'matter-9001',
    prospectName: 'Priya Raman',
    prospectEmail: 'priya.raman@example.com',
    opposingParties: ['Cobb Logistics LLC'],
    matterDescription: 'Contract review for a small business sale.',
    responsibleAttorney: { name: 'Sarah Hill', email: 'sarah@firm.example' },
    ...overrides,
  };
}

const UNRELATED: LedgerEntry[] = [
  { clientName: 'Hartwell Trust', status: 'active', matterLabel: 'estate plan' },
];
const DIRECT: LedgerEntry[] = [
  { clientName: 'Priya Raman', status: 'active', matterLabel: 'prior matter' },
];
const ACTIVE_ADVERSE: LedgerEntry[] = [
  { clientName: 'Cobb Logistics LLC', status: 'active', matterLabel: 'Reyes v. Cobb' },
];
const FORMER_ADVERSE: LedgerEntry[] = [
  { clientName: 'Cobb Logistics LLC', status: 'closed', matterLabel: 'closed lease matter' },
];


const NOTICE_SCENARIOS: ReadonlyArray<{ unit: string; ledger: LedgerEntry[] }> = [
  { unit: 'no-ledger-match', ledger: UNRELATED },
  { unit: 'former-adverse-match', ledger: FORMER_ADVERSE },
  { unit: 'active-adverse-match', ledger: ACTIVE_ADVERSE },
  { unit: 'direct-match', ledger: DIRECT },
  { unit: 'empty-ledger-unscreened', ledger: [] },
];

const FIRM_CONTEXT_VARIANTS = ['with-firm-context', 'without-firm-context'] as const;

/**
 * Populate `corpus`. Runs in a `before` hook rather than at module scope
 * because the transform target is CJS and top-level await is unavailable.
 * It throws rather than returning a partial corpus — the `examined N of M`
 * assertion below is the second line of defence, not the first.
 */
async function buildCorpus(): Promise<void> {
  for (const scenario of NOTICE_SCENARIOS) {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      intake: intake(),
      fetcher: new JsonLedgerFetcher({
        workspaceId: WORKSPACE_ID,
        ledger: scenario.ledger,
      }),
    });
    if (!res.ok) {
      throw new Error(`runSkill failed for ${scenario.unit}: ${res.error.message}`);
    }
    collect('attorney-notice', `${scenario.unit}/subject`, res.value.attorneyNotice.subject);
    collect('attorney-notice', `${scenario.unit}/body`, res.value.attorneyNotice.body);
  }

  for (const variant of FIRM_CONTEXT_VARIANTS) {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-9001',
      firmContext:
        variant === 'with-firm-context'
          ? {
              firmName: 'Hill & Associates',
              firmAddress: '1 Peachtree St, Atlanta, GA',
              stateOfPractice: 'Georgia',
            }
          : null,
      now: new Date('2026-09-14T12:00:00Z'),
    });
    collect('engagement-letter', variant, letter.body);
  }

  const lawDataset = demoDatasetFor('LAW');
  for (const record of lawDataset.records) {
    const draft = buildActivationDraft({
      vertical: 'LAW',
      record,
      businessName: 'Hill & Associates',
      savedMinutes: lawDataset.savedMinutes,
    });
    collect('activation-draft', `${record.demoId}/subject`, draft.subject);
    collect('activation-draft', `${record.demoId}/body`, draft.body);
    collect('demo-record', `${record.demoId}/title`, record.title);
    collect('demo-record', `${record.demoId}/summary`, record.summary);
    collect('demo-record', `${record.demoId}/context`, record.contextLines.join('\n'));
  }
}

/** Per-root floors. A single global floor once let an entire tree be
 *  deleted while the suite stayed green; roots are counted independently. */
const ROOT_MINIMUMS: Readonly<Record<string, number>> = {
  'attorney-notice': 10,
  'engagement-letter': 2,
  'activation-draft': 4,
  'demo-record': 6,
};

describe('law skill: no rendered draft asserts a conflict-check conclusion', () => {
  before(buildCorpus);

  it('examined N of M - the corpus is non-empty and meets every per-root floor', () => {
    const examined = corpus.length;
    const expected = Object.values(ROOT_MINIMUMS).reduce((a, b) => a + b, 0);

    assert.ok(
      examined > 0,
      `examined 0 of ${expected} - the corpus collected nothing. A check ` +
        'that looked at nothing proves nothing; fix the builder before ' +
        'trusting a green result.',
    );

    for (const [root, minimum] of Object.entries(ROOT_MINIMUMS)) {
      const n = corpus.filter((c) => c.root === root).length;
      assert.ok(
        n >= minimum,
        `root "${root}": examined ${n} of ${minimum} minimum. Either a ` +
          'renderer was removed or the builder stopped reaching it.',
      );
    }

    const roots = new Set(corpus.map((c) => c.root));
    assert.equal(
      roots.size,
      Object.keys(ROOT_MINIMUMS).length,
      `examined ${examined} strings across ${roots.size} roots; expected ` +
        `${Object.keys(ROOT_MINIMUMS).length} roots.`,
    );

    console.log(
      `examined ${examined} of ${expected} minimum rendered strings across ` +
        `${roots.size} roots: ${[...roots].join(', ')}`,
    );
  });

  for (const pattern of CLEARANCE_PATTERNS) {
    it(`no rendered string matches "${pattern.name}"`, () => {
      assert.ok(corpus.length > 0, 'corpus is empty - nothing was examined');
      const offenders = corpus
        .filter((c) => pattern.re.test(c.text))
        .map((c) => {
          const m = pattern.re.exec(c.text);
          const at = m ? Math.max(0, m.index - 70) : 0;
          const excerpt = m ? c.text.slice(at, m.index + m[0].length + 70) : '';
          return `  ${c.root}/${c.unit}: ...${excerpt.replace(/\n/g, ' ')}...`;
        });

      assert.deepEqual(
        offenders,
        [],
        `examined ${corpus.length} rendered strings; ${offenders.length} ` +
          'assert a conflict-check conclusion.\n' +
          'Remove the sentence. Do not hedge it - "appears to be clear" and\n' +
          '"no conflicts detected" are conclusions too. The shape that is\n' +
          'ours is retrieval: "N names in your ledger resemble this party -\n' +
          'review before you accept the matter."\n' +
          offenders.join('\n'),
      );
    });
  }
});
