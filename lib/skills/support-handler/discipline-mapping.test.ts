/**
 * lib/skills/support-handler/discipline-mapping.test.ts
 *
 * Pins the support-handler → customer-success mapping. The /approvals
 * page groups by discipline; if this mapping ever drifts, support
 * drafts fall into the "All recent" fallback bucket (NULL discipline)
 * and the operator's queue loses its grouping. Catch the regression
 * here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SKILL_DISCIPLINE, disciplineForSkill } from '../../disciplines/skill-mapping';
import { SUPPORT_HANDLER_AGENT_SLUG } from './prisma-approval-sink';

describe('support-handler discipline mapping', () => {
  it('SKILL_DISCIPLINE has a customer-success entry for support-handler', () => {
    assert.equal(SKILL_DISCIPLINE['support-handler'], 'customer-success');
  });
  it('the constant agentSlug matches the mapping key', () => {
    assert.equal(SUPPORT_HANDLER_AGENT_SLUG, 'support-handler');
    assert.equal(disciplineForSkill(SUPPORT_HANDLER_AGENT_SLUG), 'customer-success');
  });
});
