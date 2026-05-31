/**
 * lib/auth/roles.test.ts
 *
 * Pins the wave-6 role policy:
 *   * Legacy values (BROKER_OWNER, AGENT) map to OWNER / MEMBER.
 *   * Tier ordering is correct.
 *   * The action × role matrix matches the spec table in roles.ts.
 *
 * Single-owner workspaces (today's reality for every Phase-1 workspace)
 * MUST keep working — a BROKER_OWNER membership row still passes every
 * gate the policy lifts onto OWNER.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  asRoleTier,
  canPerform,
  roleAtLeast,
  roleLabel,
  RoleTier,
  type RoleAction,
} from './roles';

describe('lib/auth/roles', () => {
  it('treats BROKER_OWNER and OWNER as the same tier', () => {
    assert.equal(asRoleTier('BROKER_OWNER'), RoleTier.OWNER);
    assert.equal(asRoleTier('OWNER'), RoleTier.OWNER);
  });

  it('treats AGENT and MEMBER as the same tier', () => {
    assert.equal(asRoleTier('AGENT'), RoleTier.MEMBER);
    assert.equal(asRoleTier('MEMBER'), RoleTier.MEMBER);
  });

  it('orders tiers viewer < member < admin < owner', () => {
    assert.ok(RoleTier.VIEWER < RoleTier.MEMBER);
    assert.ok(RoleTier.MEMBER < RoleTier.ADMIN);
    assert.ok(RoleTier.ADMIN < RoleTier.OWNER);
  });

  it('roleAtLeast — strict floors', () => {
    assert.equal(roleAtLeast('VIEWER', RoleTier.MEMBER), false);
    assert.equal(roleAtLeast('MEMBER', RoleTier.MEMBER), true);
    assert.equal(roleAtLeast('MEMBER', RoleTier.ADMIN), false);
    assert.equal(roleAtLeast('ADMIN', RoleTier.OWNER), false);
    assert.equal(roleAtLeast('OWNER', RoleTier.OWNER), true);
    assert.equal(roleAtLeast('BROKER_OWNER', RoleTier.OWNER), true);
  });

  it('action matrix — owner can do everything', () => {
    const actions: RoleAction[] = [
      'workspace.read',
      'work.approve',
      'skill.configure',
      'workspace.settings.write',
      'roster.write',
      'discipline.head.assign',
      'roster.write.owner',
      'billing.write',
      'workspace.delete',
    ];
    for (const a of actions) {
      assert.equal(canPerform('OWNER', a), true, `OWNER must do ${a}`);
      assert.equal(canPerform('BROKER_OWNER', a), true, `BROKER_OWNER must do ${a}`);
    }
  });

  it('action matrix — admin cannot do owner-only actions', () => {
    assert.equal(canPerform('ADMIN', 'workspace.read'), true);
    assert.equal(canPerform('ADMIN', 'work.approve'), true);
    assert.equal(canPerform('ADMIN', 'skill.configure'), true);
    assert.equal(canPerform('ADMIN', 'workspace.settings.write'), true);
    assert.equal(canPerform('ADMIN', 'roster.write'), true);
    assert.equal(canPerform('ADMIN', 'discipline.head.assign'), false);
    assert.equal(canPerform('ADMIN', 'roster.write.owner'), false);
    assert.equal(canPerform('ADMIN', 'billing.write'), false);
    assert.equal(canPerform('ADMIN', 'workspace.delete'), false);
  });

  it('action matrix — member can approve work + read but cannot configure', () => {
    assert.equal(canPerform('MEMBER', 'workspace.read'), true);
    assert.equal(canPerform('MEMBER', 'work.approve'), true);
    assert.equal(canPerform('MEMBER', 'skill.configure'), false);
    assert.equal(canPerform('MEMBER', 'workspace.settings.write'), false);
    assert.equal(canPerform('MEMBER', 'roster.write'), false);
    // AGENT legacy reads as member — same matrix.
    assert.equal(canPerform('AGENT', 'work.approve'), true);
    assert.equal(canPerform('AGENT', 'skill.configure'), false);
  });

  it('action matrix — viewer cannot perform any write action', () => {
    assert.equal(canPerform('VIEWER', 'workspace.read'), true);
    assert.equal(canPerform('VIEWER', 'work.approve'), false);
    assert.equal(canPerform('VIEWER', 'skill.configure'), false);
    assert.equal(canPerform('VIEWER', 'workspace.settings.write'), false);
    assert.equal(canPerform('VIEWER', 'roster.write'), false);
    assert.equal(canPerform('VIEWER', 'billing.write'), false);
  });

  it('roleLabel — surfaces human-readable strings', () => {
    assert.equal(roleLabel('OWNER'), 'Owner');
    assert.equal(roleLabel('BROKER_OWNER'), 'Owner');
    assert.equal(roleLabel('ADMIN'), 'Admin');
    assert.equal(roleLabel('MEMBER'), 'Member');
    assert.equal(roleLabel('AGENT'), 'Member');
    assert.equal(roleLabel('VIEWER'), 'Viewer');
  });
});
