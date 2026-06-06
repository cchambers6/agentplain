/**
 * Unit tests for the customer-feedback drift aggregation (pure logic — no
 * DB). Covers the tally → threshold → proposal-body → week-summary chain
 * the sweep and the briefings section both compose.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  tallyBySkillAndCategory,
  tallyByCategory,
  selectDriftGroups,
  driftMarker,
  buildProposalBody,
  summarizeWorkspaceWeek,
} from './drift';
import { DRIFT_PROPOSAL_THRESHOLD, type PreferenceFeedbackView } from './types';

function fb(
  targetSkillSlug: string,
  category: PreferenceFeedbackView['category'],
): Pick<PreferenceFeedbackView, 'targetSkillSlug' | 'category'> {
  return { targetSkillSlug, category };
}

describe('tallyBySkillAndCategory', () => {
  it('groups by (skill, category) and sorts by count desc', () => {
    const rows = [
      fb('follow-up-chaser', 'tone'),
      fb('follow-up-chaser', 'tone'),
      fb('follow-up-chaser', 'tone'),
      fb('follow-up-chaser', 'length'),
      fb('content-calendar', 'structure'),
    ];
    const tallies = tallyBySkillAndCategory(rows);
    assert.equal(tallies.length, 3);
    assert.deepEqual(tallies[0], {
      targetSkillSlug: 'follow-up-chaser',
      category: 'tone',
      count: 3,
    });
  });

  it('is deterministic for ties (skill then category order)', () => {
    const rows = [
      fb('b-skill', 'length'),
      fb('a-skill', 'tone'),
    ];
    const tallies = tallyBySkillAndCategory(rows);
    assert.equal(tallies[0].targetSkillSlug, 'a-skill');
    assert.equal(tallies[1].targetSkillSlug, 'b-skill');
  });
});

describe('tallyByCategory', () => {
  it('totals per category in display order', () => {
    const rows = [
      fb('x', 'length'),
      fb('y', 'tone'),
      fb('z', 'tone'),
    ];
    const byCat = tallyByCategory(rows);
    // tone comes before length in FEEDBACK_CATEGORIES order
    assert.deepEqual(byCat, [
      { category: 'tone', count: 2 },
      { category: 'length', count: 1 },
    ]);
  });
});

describe('selectDriftGroups', () => {
  it('keeps only groups at or above the threshold', () => {
    const tallies = tallyBySkillAndCategory([
      fb('s1', 'tone'),
      fb('s1', 'tone'),
      fb('s1', 'tone'),
      fb('s2', 'length'),
      fb('s2', 'length'),
    ]);
    const groups = selectDriftGroups(tallies, DRIFT_PROPOSAL_THRESHOLD);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].targetSkillSlug, 's1');
    assert.equal(groups[0].count, 3);
  });
});

describe('buildProposalBody', () => {
  it('embeds the stable drift marker for idempotency', () => {
    const body = buildProposalBody({
      targetSkillSlug: 'follow-up-chaser',
      category: 'tone',
      count: 4,
      weekStartIso: '2026-05-27T00:00:00.000Z',
      weekEndIso: '2026-06-03T00:00:00.000Z',
    });
    assert.ok(body.includes(driftMarker('follow-up-chaser', 'tone')));
    assert.ok(body.includes('4×'));
    assert.ok(body.toLowerCase().includes('voice block'));
  });
});

describe('summarizeWorkspaceWeek', () => {
  it('produces counts + the considering groups for the briefings section', () => {
    const rows = [
      fb('follow-up-chaser', 'tone'),
      fb('follow-up-chaser', 'tone'),
      fb('follow-up-chaser', 'tone'),
      fb('content-calendar', 'length'),
    ];
    const summary = summarizeWorkspaceWeek(rows);
    assert.equal(summary.totalCorrections, 4);
    assert.equal(summary.considering.length, 1);
    assert.equal(summary.considering[0].targetSkillSlug, 'follow-up-chaser');
    assert.equal(summary.considering[0].category, 'tone');
  });

  it('zero corrections → empty summary, nothing considered', () => {
    const summary = summarizeWorkspaceWeek([]);
    assert.equal(summary.totalCorrections, 0);
    assert.deepEqual(summary.byCategory, []);
    assert.deepEqual(summary.considering, []);
  });
});
