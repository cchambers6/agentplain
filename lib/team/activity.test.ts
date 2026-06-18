/**
 * lib/team/activity.test.ts — pins the role-based visibility rule. The
 * security-relevant assertion: a staff member never receives a teammate's
 * activity row.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  visibleActivityFor,
  canSeeAllActivity,
  type ActivityEntry,
} from './activity';

const OWNER = 'u-owner';
const STAFF = 'u-staff';
const OTHER = 'u-other';

function entry(id: string, actor: string, assigned?: string): ActivityEntry {
  return {
    id,
    actorUserId: actor,
    actorLabel: actor,
    summary: 'did a thing',
    discipline: null,
    occurredAt: new Date(0),
    assignedUserId: assigned ?? null,
  };
}

const entries: ActivityEntry[] = [
  entry('1', OWNER),
  entry('2', STAFF),
  entry('3', OTHER, STAFF), // handled by other, assigned to staff
  entry('4', OTHER),
];

describe('visibleActivityFor', () => {
  it('managers + owners see everything', () => {
    assert.equal(visibleActivityFor('OWNER', OWNER, entries).length, 4);
    assert.equal(visibleActivityFor('ADMIN', 'u-mgr', entries).length, 4);
    assert.equal(visibleActivityFor('BROKER_OWNER', OWNER, entries).length, 4);
  });

  it('staff sees only their own + items assigned to them', () => {
    const visible = visibleActivityFor('MEMBER', STAFF, entries);
    const ids = visible.map((e) => e.id).sort();
    assert.deepEqual(ids, ['2', '3']);
  });

  it('staff never receives a teammate-only row (PII guard)', () => {
    const visible = visibleActivityFor('MEMBER', STAFF, entries);
    assert.ok(!visible.some((e) => e.id === '1'), 'owner row leaked');
    assert.ok(!visible.some((e) => e.id === '4'), 'other-only row leaked');
  });

  it('viewer sees only their own', () => {
    const visible = visibleActivityFor('VIEWER', OTHER, entries);
    assert.deepEqual(visible.map((e) => e.id).sort(), ['3', '4']);
  });
});

describe('canSeeAllActivity', () => {
  it('is true only for ADMIN and above', () => {
    assert.equal(canSeeAllActivity('OWNER'), true);
    assert.equal(canSeeAllActivity('ADMIN'), true);
    assert.equal(canSeeAllActivity('MEMBER'), false);
    assert.equal(canSeeAllActivity('VIEWER'), false);
  });
});
