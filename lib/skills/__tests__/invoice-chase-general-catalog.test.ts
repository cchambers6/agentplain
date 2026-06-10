/**
 * lib/skills/__tests__/invoice-chase-general-catalog.test.ts
 *
 * THE GAP TEST for the invoice-chase-general silent no-op (pfd-8).
 *
 * The audit found invoice-chase-general (PR #203) shipped with its daily
 * sweep wired into route.ts, BUT was ABSENT from SKILL_CATALOG. The sweep
 * calls `isSkillInstalledForWorkspace`, which returns FALSE for any skill
 * not in the catalog → every workspace skipped on every tick, zero error.
 *
 * This test asserts the catalog entry now exists AND that the install check
 * resolves a fresh general workspace to INSTALLED (not skipped) — exactly
 * the assertion that would have failed before this wave.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SKILL_CATALOG, getSkillCatalogEntry } from '../registry';
import { isSkillInstalledForWorkspace } from '../marketplace';

describe('invoice-chase-general — present + live in SKILL_CATALOG', () => {
  it('has a catalog entry', () => {
    const entry = getSkillCatalogEntry('invoice-chase-general');
    assert.ok(entry, 'invoice-chase-general MUST be in SKILL_CATALOG');
    assert.equal(entry!.vertical, 'all');
  });

  it('is runtime:live (else the daily sweep silently skips every workspace)', () => {
    const entry = getSkillCatalogEntry('invoice-chase-general');
    assert.equal(entry!.runtime, 'live');
  });

  it('appears exactly once in the catalog', () => {
    const matches = SKILL_CATALOG.filter((s) => s.slug === 'invoice-chase-general');
    assert.equal(matches.length, 1);
  });
});

describe('invoice-chase-general — the sweep does NOT skip an installed general workspace', () => {
  it('isSkillInstalledForWorkspace resolves true for a fresh GENERAL workspace (no install row)', async () => {
    // No WorkspaceSkillInstallation row → falls through to the
    // install-by-default rule. For a vertical:'all' + runtime:'live' skill
    // that rule returns TRUE. BEFORE this wave (skill absent from the
    // catalog) the same call returned FALSE → the original silent gap.
    const installed = await isSkillInstalledForWorkspace({
      workspaceId: 'ws-general-1',
      // GENERAL is not in the Vertical enum's serveable set, but the skill
      // is vertical:'all' so the install rule does not branch on it. Any
      // Vertical value exercises the same default-install path.
      workspaceVertical: 'CPA',
      skillSlug: 'invoice-chase-general',
      systemContext: async (cb) =>
        cb({
          // No install row for this workspace+skill.
          workspaceSkillInstallation: {
            findUnique: async () => null,
          },
        } as never),
    });
    assert.equal(
      installed,
      true,
      'a fresh workspace must be auto-installed for the live, vertical:all ' +
        'invoice-chase-general skill — otherwise the sweep silently skips it',
    );
  });
});
