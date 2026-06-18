/**
 * lib/team/routing.test.ts — pins the context-aware routing rules against
 * a synthetic team. Pure-core only (no DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { routeWork, type RosterMember } from './routing';

// Synthetic CPA shop: owner, bookkeeper (finance head), admin.
const OWNER = 'u-owner';
const BOOKKEEPER = 'u-bookkeeper';
const ADMIN = 'u-admin';
const STAFF = 'u-staff';

const roster: RosterMember[] = [
  { userId: OWNER, role: 'OWNER' },
  { userId: BOOKKEEPER, role: 'MEMBER' },
  { userId: ADMIN, role: 'ADMIN' },
  { userId: STAFF, role: 'MEMBER' },
];

const heads = new Map<string, string>([
  ['finance', BOOKKEEPER],
  ['legal', STAFF],
]);

describe('routeWork', () => {
  it('routes URGENT to the owner, beating everything else', () => {
    const d = routeWork(
      { tags: ['URGENT'], discipline: 'finance' },
      roster,
      heads,
    );
    assert.equal(d.targetUserId, OWNER);
    assert.equal(d.rule, 'urgent-to-owner');
  });

  it('honors the urgent flag the same as the URGENT tag', () => {
    const d = routeWork({ urgent: true }, roster, heads);
    assert.equal(d.targetUserId, OWNER);
    assert.equal(d.rule, 'urgent-to-owner');
  });

  it('routes an explicit intake assignment to that staff member', () => {
    const d = routeWork(
      { assignedStaffUserId: STAFF, discipline: 'finance' },
      roster,
      heads,
    );
    assert.equal(d.targetUserId, STAFF);
    assert.equal(d.rule, 'intake-assigned-staff');
  });

  it('ignores an assignment to a non-member and falls through', () => {
    const d = routeWork(
      { assignedStaffUserId: 'u-ghost', discipline: 'finance' },
      roster,
      heads,
    );
    assert.equal(d.targetUserId, BOOKKEEPER);
    assert.equal(d.rule, 'discipline-head');
  });

  it('routes a BILLING tag to the finance (bookkeeper) head', () => {
    const d = routeWork({ tags: ['BILLING'] }, roster, heads);
    assert.equal(d.targetUserId, BOOKKEEPER);
    assert.equal(d.rule, 'tag-to-discipline-head');
    assert.equal(d.via, 'BILLING');
  });

  it('normalizes lowercase / unknown tags', () => {
    const d = routeWork({ tags: ['billing', 'nonsense'] }, roster, heads);
    assert.equal(d.targetUserId, BOOKKEEPER);
    assert.equal(d.rule, 'tag-to-discipline-head');
  });

  it('routes by discipline when no tag matches', () => {
    const d = routeWork({ discipline: 'legal' }, roster, heads);
    assert.equal(d.targetUserId, STAFF);
    assert.equal(d.rule, 'discipline-head');
  });

  it('leaves work unrouted when no rule applies', () => {
    const d = routeWork({ discipline: 'marketing' }, roster, heads);
    assert.equal(d.targetUserId, null);
    assert.equal(d.rule, 'unrouted');
  });

  it('does not route to a head who is no longer a member', () => {
    const headsGone = new Map([['finance', 'u-departed']]);
    const d = routeWork({ tags: ['BILLING'] }, roster, headsGone);
    assert.equal(d.targetUserId, null);
    assert.equal(d.rule, 'unrouted');
  });

  it('urgent on an empty roster falls through to unrouted', () => {
    const d = routeWork({ urgent: true }, [], heads);
    assert.equal(d.targetUserId, null);
    assert.equal(d.rule, 'unrouted');
  });
});
