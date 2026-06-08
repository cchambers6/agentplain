/**
 * lib/ops/schema-drift-autoheal.test.ts
 *
 * Wave-7 theme #19 — proves the raw-index drift auto-heal:
 *   (e1) appends the right DROP INDEX into the baseline,
 *   (e2) is idempotent (re-run = clean, no duplicate lines),
 *   (e3) refuses ANY non-raw-index drift (fails loud — gate not weakened).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeDrift,
  insertDropIndexBlocks,
  parseStatements,
} from './schema-drift-autoheal';

// A small but realistic baseline: a DropIndex section + an AddForeignKey.
const BASELINE = [
  '-- DropIndex',
  'DROP INDEX "Embedding_vector_cosine_idx";',
  '',
  '-- DropIndex',
  'DROP INDEX "SkillRun_discipline_trgm_idx";',
  '',
  '-- AddForeignKey',
  'ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
  '',
].join('\n');

/** The current diff = baseline + one NEW raw-index DROP INDEX pair. */
const CURRENT_WITH_NEW_INDEX = [
  '-- DropIndex',
  'DROP INDEX "Embedding_vector_cosine_idx";',
  '',
  '-- DropIndex',
  'DROP INDEX "SkillRun_discipline_trgm_idx";',
  '',
  '-- DropIndex',
  'DROP INDEX "WorkApprovalQueueItem_agentSlug_trgm_idx";',
  '',
  '-- AddForeignKey',
  'ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
  '',
].join('\n');

describe('parseStatements', () => {
  it('groups marker + body into statement blocks', () => {
    const stmts = parseStatements(BASELINE);
    assert.equal(stmts.length, 3);
    assert.equal(stmts[0].marker, 'DropIndex');
    assert.equal(stmts[0].body[0], 'DROP INDEX "Embedding_vector_cosine_idx";');
    assert.equal(stmts[2].marker, 'AddForeignKey');
  });
});

describe('analyzeDrift — clean', () => {
  it('identical strings → clean (idempotent re-run path)', () => {
    const a = analyzeDrift(BASELINE, BASELINE);
    assert.equal(a.kind, 'clean');
  });
});

describe('analyzeDrift — healable (e1)', () => {
  it('only-new-DropIndex → healable, reports the added index', () => {
    const a = analyzeDrift(CURRENT_WITH_NEW_INDEX, BASELINE);
    assert.equal(a.kind, 'healable');
    if (a.kind !== 'healable') return;
    assert.equal(a.added.length, 1);
    assert.equal(a.added[0].indexName, 'WorkApprovalQueueItem_agentSlug_trgm_idx');
    // The healed baseline must contain the new DROP INDEX line...
    assert.match(a.healedBaseline, /DROP INDEX "WorkApprovalQueueItem_agentSlug_trgm_idx";/);
    // ...and still contain the pre-existing ones + the FK.
    assert.match(a.healedBaseline, /DROP INDEX "Embedding_vector_cosine_idx";/);
    assert.match(a.healedBaseline, /Embedding_workspaceId_fkey/);
  });

  it('(e2) IDEMPOTENT: re-analyzing healedBaseline vs current → clean', () => {
    const first = analyzeDrift(CURRENT_WITH_NEW_INDEX, BASELINE);
    assert.equal(first.kind, 'healable');
    if (first.kind !== 'healable') return;
    // The healed baseline should now byte-equal the current diff.
    const second = analyzeDrift(CURRENT_WITH_NEW_INDEX, first.healedBaseline);
    assert.equal(second.kind, 'clean');
  });

  it('(e2) insertDropIndexBlocks does not duplicate an already-present index', () => {
    const out = insertDropIndexBlocks(BASELINE, [
      {
        indexName: 'Embedding_vector_cosine_idx',
        block: '-- DropIndex\nDROP INDEX "Embedding_vector_cosine_idx";',
      },
    ]);
    const matches = [...out.matchAll(/DROP INDEX "Embedding_vector_cosine_idx";/g)];
    assert.equal(matches.length, 1, 'must not duplicate an existing DROP INDEX');
  });
});

describe('analyzeDrift — unhealable (e3, gate not weakened)', () => {
  it('a new non-DropIndex statement (forgotten ALTER TABLE) → unhealable', () => {
    const current = [
      BASELINE.trimEnd(),
      '',
      '-- AlterTable',
      'ALTER TABLE "Workspace" ADD COLUMN "newCol" TEXT;',
      '',
    ].join('\n');
    const a = analyzeDrift(current, BASELINE);
    assert.equal(a.kind, 'unhealable');
    if (a.kind === 'unhealable') {
      assert.match(a.reason, /non-DropIndex/);
    }
  });

  it('a REMOVED baseline statement → unhealable', () => {
    // current = baseline minus the FK line (a real schema change).
    const current = [
      '-- DropIndex',
      'DROP INDEX "Embedding_vector_cosine_idx";',
      '',
      '-- DropIndex',
      'DROP INDEX "SkillRun_discipline_trgm_idx";',
      '',
    ].join('\n');
    const a = analyzeDrift(current, BASELINE);
    assert.equal(a.kind, 'unhealable');
    if (a.kind === 'unhealable') {
      assert.match(a.reason, /vanished/);
    }
  });

  it('a DropIndex AND a non-DropIndex added together → unhealable (all-or-nothing)', () => {
    const current = [
      CURRENT_WITH_NEW_INDEX.trimEnd(),
      '',
      '-- AlterTable',
      'ALTER TABLE "Workspace" ADD COLUMN "x" TEXT;',
      '',
    ].join('\n');
    const a = analyzeDrift(current, BASELINE);
    assert.equal(a.kind, 'unhealable');
  });
});
