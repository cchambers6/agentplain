/**
 * lib/team/playbook-generator.test.ts — pins the deterministic markdown
 * output for a sample CPA shop.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { generatePlaybook, type PlaybookInput } from './playbook-generator';
import { getRolePreset } from './role-presets';

const cpaPreset = getRolePreset('CPA');
const bookkeeperSeat = cpaPreset.roles.find((r) => r.key === 'bookkeeper')!;

const input: PlaybookInput = {
  workspaceName: 'Summit Tax & Books',
  partnerName: 'Plaino',
  vertical: 'CPA',
  newHirePreset: bookkeeperSeat,
  members: [
    {
      label: 'Dana (Owner)',
      role: 'OWNER',
      leadsDisciplines: [],
      decisionCount: 12,
    },
    {
      label: 'Pat (Bookkeeper)',
      role: 'MEMBER',
      leadsDisciplines: ['finance'],
      decisionCount: 30,
    },
  ],
  voiceSummary: 'Warm, precise, never salesy.',
};

describe('generatePlaybook', () => {
  const md = generatePlaybook(input);

  it('opens with the workspace welcome', () => {
    assert.ok(md.startsWith('# Welcome to Summit Tax & Books'));
  });

  it('describes the new hire role with access level', () => {
    assert.match(md, /## Your role: Bookkeeper/);
    assert.match(md, /\*\*Access level:\*\* Member/);
  });

  it('lists teammates and what they lead', () => {
    assert.match(md, /\*\*Pat \(Bookkeeper\)\*\*/);
    assert.match(md, /leads Finance/i);
    assert.match(md, /handled 30 items/);
  });

  it('explains the routing rules', () => {
    assert.match(md, /## How work reaches you/);
    assert.match(md, /URGENT/);
    assert.match(md, /BILLING/);
  });

  it('uses the provided voice summary', () => {
    assert.match(md, /Warm, precise, never salesy\./);
  });

  it('includes a first-week checklist and the preset footer', () => {
    assert.match(md, /## Your first week/);
    assert.match(md, /- \[ \]/);
    assert.match(md, /CPA \/ accounting shop preset/);
  });

  it('falls back to default voice when none given', () => {
    const md2 = generatePlaybook({ ...input, voiceSummary: null });
    assert.match(md2, /drafts everything customer-facing/);
  });

  it('handles an empty roster gracefully', () => {
    const md3 = generatePlaybook({ ...input, members: [], newHirePreset: null });
    assert.match(md3, /No teammates on the roster yet/);
  });
});
