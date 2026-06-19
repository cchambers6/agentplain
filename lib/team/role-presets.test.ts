/**
 * lib/team/role-presets.test.ts — validates the per-vertical presets are
 * well-formed and cover the verticals the mission named.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VERTICAL_ROLE_PRESETS,
  GENERAL_ROLE_PRESET,
  getRolePreset,
  listRolePresets,
  bespokePresetCount,
} from './role-presets';
import { listDisciplines } from '@/lib/disciplines';
import { ROUTING_TAGS } from './routing-tags';

const VALID_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
const DISCIPLINE_IDS = new Set(listDisciplines().map((d) => d.id));
const TAG_SET = new Set(ROUTING_TAGS);

describe('role-presets', () => {
  it('every preset has exactly one OWNER seat first', () => {
    for (const preset of listRolePresets()) {
      assert.ok(preset.roles.length >= 2, `${preset.label} needs ≥2 seats`);
      assert.equal(preset.roles[0].baseRole, 'OWNER', `${preset.label} seat 0`);
      const owners = preset.roles.filter((r) => r.baseRole === 'OWNER');
      assert.equal(owners.length, 1, `${preset.label} has one owner`);
    }
  });

  it('all baseRoles, disciplines, and routing tags are valid', () => {
    for (const preset of listRolePresets()) {
      for (const r of preset.roles) {
        assert.ok(VALID_ROLES.has(r.baseRole), `bad role ${r.baseRole}`);
        for (const d of r.disciplines) {
          assert.ok(DISCIPLINE_IDS.has(d), `bad discipline ${d} in ${r.key}`);
        }
        for (const t of r.routingTags) {
          assert.ok(TAG_SET.has(t), `bad tag ${t} in ${r.key}`);
        }
      }
    }
  });

  it('role keys are unique within each preset', () => {
    for (const preset of listRolePresets()) {
      const keys = preset.roles.map((r) => r.key);
      assert.equal(new Set(keys).size, keys.length, `${preset.label} dup keys`);
    }
  });

  it('covers the verticals named in the mission', () => {
    const verticals = new Set(VERTICAL_ROLE_PRESETS.map((p) => p.vertical));
    for (const v of ['CPA', 'PROPERTY_MANAGEMENT', 'LAW', 'REAL_ESTATE'] as const) {
      assert.ok(verticals.has(v), `missing preset for ${v}`);
    }
  });

  it('CPA shop matches the owner-CPA + bookkeeper + admin shape', () => {
    const cpa = getRolePreset('CPA');
    const titles = cpa.roles.map((r) => r.title.toLowerCase());
    assert.ok(titles.some((t) => t.includes('cpa')));
    assert.ok(titles.some((t) => t.includes('bookkeeper')));
    const bookkeeper = cpa.roles.find((r) => r.key === 'bookkeeper');
    assert.ok(bookkeeper?.routingTags.includes('BILLING'));
    assert.ok(bookkeeper?.disciplines.includes('finance'));
  });

  it('falls back to GENERAL for null / unknown vertical', () => {
    assert.equal(getRolePreset(null).label, GENERAL_ROLE_PRESET.label);
  });

  it('exposes a bespoke preset count (≥ the 4 named verticals)', () => {
    assert.ok(bespokePresetCount() >= 4);
    assert.equal(bespokePresetCount(), VERTICAL_ROLE_PRESETS.length);
  });
});
