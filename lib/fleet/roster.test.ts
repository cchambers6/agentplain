/**
 * Structure invariants for the internal media fleet roster.
 *
 * The roster is the source of truth the operator panel + docs read, so these
 * tests pin the shape: the 19-agent count, the class/tier split, referential
 * integrity of every reporting line, and the locked `marketing` discipline.
 * A drift here (a typo'd reportsTo, a stray discipline) would silently mis-render
 * the org chart — these assertions turn that into a failing test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  listMediaFleet,
  getMediaAgent,
  listMediaByTier,
  directReportsOf,
  listMediaCrons,
  MEDIA_FLEET_IDS,
  MEDIA_DISCIPLINE,
} from './roster';

describe('media fleet roster', () => {
  it('has 19 agents: 3 leadership + 8 platform + 8 creative', () => {
    const fleet = listMediaFleet();
    assert.equal(fleet.length, 19);
    assert.equal(listMediaByTier('leadership').length, 3);
    assert.equal(listMediaByTier('platform').length, 8);
    assert.equal(listMediaByTier('creative').length, 8);
  });

  it('every agent lives in the marketing discipline (not a 9th discipline)', () => {
    for (const a of listMediaFleet()) {
      assert.equal(a.discipline, MEDIA_DISCIPLINE);
      assert.equal(a.discipline, 'marketing');
    }
  });

  it('leadership is Class B; every specialist is Class C', () => {
    for (const a of listMediaFleet()) {
      if (a.tier === 'leadership') assert.equal(a.fleetClass, 'B');
      else assert.equal(a.fleetClass, 'C');
    }
  });

  it('every reporting line resolves up the chain to the CEO tier', () => {
    const slugs = new Set(MEDIA_FLEET_IDS as readonly string[]);
    for (const a of listMediaFleet()) {
      const resolvesInFleet = slugs.has(a.reportsTo);
      const resolvesExternal = a.reportsTo === 'b2b-ceo';
      assert.ok(
        resolvesInFleet || resolvesExternal,
        `${a.slug} reportsTo unknown manager ${a.reportsTo}`,
      );
    }
  });

  it('the Head of Media reports to the CEO tier; the other two leads report to the Head', () => {
    assert.equal(getMediaAgent('media-head')?.reportsTo, 'b2b-ceo');
    assert.equal(getMediaAgent('media-creative-director')?.reportsTo, 'media-head');
    assert.equal(getMediaAgent('media-director')?.reportsTo, 'media-head');
  });

  it('platform specialists report to the Media Director', () => {
    for (const a of listMediaByTier('platform')) {
      assert.equal(a.reportsTo, 'media-director');
    }
  });

  it('the creative-maker pool reports to the Creative Director', () => {
    const makers = directReportsOf('media-creative-director');
    const makerSlugs = makers.map((a) => a.slug).sort();
    assert.deepEqual(makerSlugs, [
      'media-copywriter-direct',
      'media-copywriter-longform',
      'media-static-designer',
      'media-video-producer',
      'media-voice-producer',
    ]);
  });

  it('no agent has a slug collision and ids are stable', () => {
    assert.equal(new Set(MEDIA_FLEET_IDS).size, MEDIA_FLEET_IDS.length);
    assert.ok(MEDIA_FLEET_IDS.includes('media-head'));
    assert.ok(MEDIA_FLEET_IDS.includes('media-analytics-attribution'));
  });

  it('every agent declares at least one tool and one owned output', () => {
    for (const a of listMediaFleet()) {
      assert.ok(a.primaryTools.length >= 1, `${a.slug} has no tools`);
      assert.ok(a.ownedOutputs.length >= 1, `${a.slug} has no outputs`);
    }
  });

  it('exposes exactly three standing crons', () => {
    assert.equal(listMediaCrons().length, 3);
  });
});
