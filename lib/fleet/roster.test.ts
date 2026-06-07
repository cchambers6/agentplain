/**
 * Structure invariants for agentplain's internal GTM fleet roster.
 *
 * The roster is split into two peer disciplines — Creative (production) and
 * Media (distribution) — both inside the locked `marketing` customer
 * discipline. These tests pin the shape: the per-arm counts, the class/tier
 * split, referential integrity of every reporting line, the two discipline
 * heads reporting to the CEO tier as peers, and the locked `marketing`
 * discipline. A drift here (a typo'd reportsTo, a stray discipline, a maker
 * landing back under Media) would silently mis-render the org chart — these
 * assertions turn that into a failing test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  listCreativeFleet,
  listMediaFleet,
  getFleetAgent,
  getMediaAgent,
  listCreativeByTier,
  listMediaByTier,
  directReportsOf,
  listCreativeCrons,
  listMediaCrons,
  listAllCrons,
  CREATIVE_FLEET_IDS,
  MEDIA_FLEET_IDS,
  MARKETING_DISCIPLINE,
} from './roster';

describe('GTM fleet roster — arm split', () => {
  it('Creative has 7 agents: 1 leadership + 6 production (5 makers + router)', () => {
    assert.equal(listCreativeFleet().length, 7);
    assert.equal(listCreativeByTier('leadership').length, 1);
    assert.equal(listCreativeByTier('production').length, 6);
  });

  it('Media has 13 agents: 2 leadership + 8 platform + 3 earned', () => {
    assert.equal(listMediaFleet().length, 13);
    assert.equal(listMediaByTier('leadership').length, 2);
    assert.equal(listMediaByTier('platform').length, 8);
    assert.equal(listMediaByTier('earned').length, 3);
  });

  it('every agent in both arms lives in the marketing discipline (not a 9th discipline)', () => {
    for (const a of [...listCreativeFleet(), ...listMediaFleet()]) {
      assert.equal(a.discipline, MARKETING_DISCIPLINE);
      assert.equal(a.discipline, 'marketing');
    }
  });

  it('every agent carries the arm matching the list it came from', () => {
    for (const a of listCreativeFleet()) assert.equal(a.arm, 'creative');
    for (const a of listMediaFleet()) assert.equal(a.arm, 'media');
  });

  it('leadership is Class B; every specialist is Class C', () => {
    for (const a of [...listCreativeFleet(), ...listMediaFleet()]) {
      if (a.tier === 'leadership') assert.equal(a.fleetClass, 'B');
      else assert.equal(a.fleetClass, 'C');
    }
  });

  it('the two discipline heads report to the CEO tier as peers', () => {
    assert.equal(getFleetAgent('creative-director')?.reportsTo, 'b2b-ceo');
    assert.equal(getFleetAgent('media-head')?.reportsTo, 'b2b-ceo');
  });

  it('the Media Director reports to the Head of Media', () => {
    assert.equal(getFleetAgent('media-director')?.reportsTo, 'media-head');
  });

  it('the creative maker pool + router report to the Creative Director', () => {
    const reports = directReportsOf('creative-director').map((a) => a.slug).sort();
    assert.deepEqual(reports, [
      'creative-copywriter-direct',
      'creative-copywriter-longform',
      'creative-router',
      'creative-static-designer',
      'creative-video-producer',
      'creative-voice-producer',
    ]);
  });

  it('platform + earned specialists report to the Media Director', () => {
    for (const a of [...listMediaByTier('platform'), ...listMediaByTier('earned')]) {
      assert.equal(a.reportsTo, 'media-director');
    }
  });

  it('every reporting line resolves up the chain to the CEO tier', () => {
    const slugs = new Set([...CREATIVE_FLEET_IDS, ...MEDIA_FLEET_IDS] as readonly string[]);
    for (const a of [...listCreativeFleet(), ...listMediaFleet()]) {
      assert.ok(
        slugs.has(a.reportsTo) || a.reportsTo === 'b2b-ceo',
        `${a.slug} reportsTo unknown manager ${a.reportsTo}`,
      );
    }
  });

  it('no slug collision across the whole fleet; key slugs are stable', () => {
    const all = [...CREATIVE_FLEET_IDS, ...MEDIA_FLEET_IDS];
    assert.equal(new Set(all).size, all.length);
    assert.ok(CREATIVE_FLEET_IDS.includes('creative-director'));
    assert.ok(CREATIVE_FLEET_IDS.includes('creative-router'));
    assert.ok(MEDIA_FLEET_IDS.includes('media-head'));
    assert.ok(MEDIA_FLEET_IDS.includes('media-analytics-attribution'));
  });

  it('no maker slug leaked back under the media- prefix', () => {
    for (const id of MEDIA_FLEET_IDS) {
      assert.ok(
        !/static-designer|video-producer|voice-producer|copywriter|creative-director|creative-router/.test(id),
        `${id} is a maker — it must live in the Creative arm`,
      );
    }
  });

  it('getMediaAgent is a back-compat alias that resolves across both arms', () => {
    assert.equal(getMediaAgent('creative-director')?.arm, 'creative');
    assert.equal(getMediaAgent('media-head')?.arm, 'media');
  });

  it('every agent declares at least one tool and one owned output', () => {
    for (const a of [...listCreativeFleet(), ...listMediaFleet()]) {
      assert.ok(a.primaryTools.length >= 1, `${a.slug} has no tools`);
      assert.ok(a.ownedOutputs.length >= 1, `${a.slug} has no outputs`);
    }
  });

  it('exposes 1 creative cron + 2 media crons = 3 total', () => {
    assert.equal(listCreativeCrons().length, 1);
    assert.equal(listMediaCrons().length, 2);
    assert.equal(listAllCrons().length, 3);
  });

  it('the weekly creative review is owned by the Creative Director', () => {
    const cron = listCreativeCrons()[0];
    assert.equal(cron.ownerSlug, 'creative-director');
  });
});
