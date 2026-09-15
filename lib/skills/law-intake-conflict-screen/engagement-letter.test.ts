/**
 * lib/skills/law-intake-conflict-screen/engagement-letter.test.ts
 *
 * Pins the deterministic engagement-letter template rendering.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderEngagementLetter } from './engagement-letter';
import type { ProspectiveIntake } from './types';

function intake(overrides: Partial<ProspectiveIntake> = {}): ProspectiveIntake {
  return {
    matterId: 'matter-2026-0042',
    prospectName: 'Jane Roe',
    prospectEmail: 'jane.roe@example.com',
    opposingParties: [],
    matterDescription: 'Wrongful termination claim against former employer.',
    responsibleAttorney: { name: 'Sarah Hill', email: 'sarah@firm.example' },
    ...overrides,
  };
}

const FIXED_NOW = new Date('2026-06-09T12:00:00.000Z');

describe('engagement-letter — basic rendering', () => {
  it('returns a draft with matterId, prospectName, and a non-empty body', () => {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: { firmName: 'Hill & Associates', stateOfPractice: 'Georgia' },
      now: FIXED_NOW,
    });
    assert.equal(letter.matterId, 'matter-2026-0042');
    assert.equal(letter.prospectName, 'Jane Roe');
    assert.ok(letter.body.length > 200, 'body should be a full letter');
    assert.ok(letter.draftId.length > 0, 'draftId must be set');
  });

  it('includes firm name, prospect name, and responsible attorney', () => {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: { firmName: 'Hill & Associates', stateOfPractice: 'Georgia' },
      now: FIXED_NOW,
    });
    assert.ok(letter.body.includes('Hill & Associates'), 'firm name in body');
    assert.ok(letter.body.includes('Jane Roe'), 'prospect name in body');
    assert.ok(letter.body.includes('Sarah Hill'), 'responsible attorney in body');
    assert.ok(letter.body.includes('Georgia'), 'state of practice in body');
  });

  it('states NO conflict-screen outcome to the client', () => {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: null,
      now: FIXED_NOW,
    });
    // This letter is addressed to the prospective client and signed by
    // the attorney. Whether the firm may take a matter is the attorney's
    // professional determination; software must not assert it to a
    // client, and an attorney approving a send is not the same as the
    // attorney having made that determination. The deterministic match
    // report stays in the internal attorney notice, which is never sent
    // to the client. See no-clearance-assertion.test.ts for the corpus.
    assert.ok(
      !/conflict/i.test(letter.body),
      `client-facing engagement letter must not mention the conflict screen at all; body was:\n${letter.body}`,
    );
    assert.ok(
      letter.body.includes('matter-2026-0042'),
      'letter must include the matter id for audit trail',
    );
  });

  it('uses {{operator: ...}} placeholders when firmContext is null', () => {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: null,
      now: FIXED_NOW,
    });
    assert.ok(
      letter.body.includes('{{operator:'),
      'letter must carry operator merge fields when firm context absent',
    );
  });

  it('includes fee and scope {{operator: ...}} placeholders regardless of firmContext', () => {
    const letter = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: { firmName: 'Hill & Associates' },
      now: FIXED_NOW,
    });
    assert.ok(
      letter.body.includes('{{operator: fee arrangement'),
      'fee arrangement must stay as operator placeholder',
    );
  });

  it('two calls produce different draftIds (randomUUID)', () => {
    const a = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: null,
      now: FIXED_NOW,
    });
    const b = renderEngagementLetter({
      intake: intake(),
      matterId: 'matter-2026-0042',
      firmContext: null,
      now: FIXED_NOW,
    });
    assert.notEqual(a.draftId, b.draftId, 'each call must produce a unique draftId');
  });
});
