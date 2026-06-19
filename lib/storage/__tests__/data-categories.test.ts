/**
 * Invariant tests for the data-minimization commitment.
 *
 * The load-bearing guarantee: EVERY workspace-scoped Prisma model (anything
 * with a `workspaceId` column) is either disclosed in the data-category
 * taxonomy OR on an explicit, justified exclusion list. Nothing about a
 * customer can be stored without appearing on the "what we store" surface —
 * a new model with a workspaceId fails this test until it's classified.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DATA_CATEGORIES,
  customerDeletableCategories,
  disclosedStoredModels,
} from '../data-categories';
import { PURGEABLE_CATEGORIES } from '../category-purge';

/**
 * Models that carry a workspaceId but are intentionally NOT customer-facing
 * storage — operator-internal records the customer never owns. Each MUST have
 * a documented reason; the surface deliberately omits them.
 */
const EXCLUDED_FROM_SURFACE: Record<string, string> = {
  CapabilityProposal:
    'operator-only skill-development queue (Notion-canonical mirror); customer roles never query it',
  CreatorBrief: 'operator creative-handoff record; not customer-owned data',
};

function modelsWithWorkspaceId(): string[] {
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const src = readFileSync(schemaPath, 'utf8');
  const models: string[] = [];
  const modelRe = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(src)) !== null) {
    const [, name, body] = m;
    if (/\n\s*workspaceId\s+/.test(body)) models.push(name);
  }
  return models;
}

describe('data-category taxonomy invariants', () => {
  it('discloses every workspace-scoped model (no silent storage)', () => {
    const disclosed = disclosedStoredModels();
    const undisclosed = modelsWithWorkspaceId().filter(
      (name) => !disclosed.has(name) && !(name in EXCLUDED_FROM_SURFACE),
    );
    assert.deepEqual(
      undisclosed,
      [],
      `These models have a workspaceId but are neither disclosed in DATA_CATEGORIES ` +
        `nor on the documented exclusion list: ${undisclosed.join(', ')}. ` +
        `Add each to a data category (and count it in workspace-storage-summary) ` +
        `or to EXCLUDED_FROM_SURFACE with a reason.`,
    );
  });

  it('every excluded model is genuinely absent from the disclosed set', () => {
    const disclosed = disclosedStoredModels();
    for (const name of Object.keys(EXCLUDED_FROM_SURFACE)) {
      assert.equal(disclosed.has(name), false, `${name} is both excluded and disclosed`);
    }
  });

  it('has stable, unique category ids', () => {
    const ids = DATA_CATEGORIES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate category id');
  });

  it('the ephemeral (connector-data) category stores nothing', () => {
    const ephemeral = DATA_CATEGORIES.filter((c) => c.classification === 'ephemeral');
    assert.equal(ephemeral.length, 1);
    assert.deepEqual(ephemeral[0].tables, []);
    assert.equal(ephemeral[0].customerDeletable, false);
  });

  it('every purgeable category is a real, customer-deletable category', () => {
    const deletableIds = new Set(customerDeletableCategories().map((c) => c.id));
    for (const p of PURGEABLE_CATEGORIES) {
      assert.equal(
        deletableIds.has(p),
        true,
        `purgeable category "${p}" is not marked customerDeletable in the taxonomy`,
      );
    }
  });
});
