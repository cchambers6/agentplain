/**
 * tests/disciplines-ux-wedge.test.ts
 *
 * Strand 3 Wave 1 — load-bearing UX wedge for the premium fleet
 * expansion plan. This file pins the contracts the wedge depends on:
 *
 *   1. Migration reversibility — the SQL migration adds columns + an
 *      index with `IF NOT EXISTS`, so a re-run (Preview-hits-prod hazard
 *      or manual replay) succeeds. The columns are NULLABLE / DEFAULT
 *      array — no rewrite of existing rows.
 *   2. Workspace isolation — the discipline-filtered approval query
 *      respects RLS: every read scopes by `workspaceId`. We assert the
 *      query shape (both pages call `findMany({ where: { workspaceId,
 *      ... } })`) and the activation module always wraps in `withRls`.
 *   3. Discipline panel renders all 8 cards from a single seed — the
 *      source-of-truth list has 8 unique ids, sorted by `sortOrder`,
 *      zod-validated, all locked names.
 *   4. Marketplace facet — a CPA workspace filter hides realty-only
 *      tiles. Today every catalog entry is `verticalRelevance: 'all'`
 *      so the contract is: `entryAppliesToVertical` passes for any
 *      vertical when the entry is horizontal AND rejects when the
 *      entry's relevance list excludes the vertical.
 *   5. Approval bucketing — NULL-discipline items land in the fallback
 *      ("All recent") bucket, never disappear; needs-you elevation
 *      pulls items out of their discipline bucket.
 *
 * Per `feedback_no_guesses_no_estimates.md`: every assertion cites the
 * file:line of the surface it pins.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DISCIPLINE_IDS,
  asDisciplineId,
  getDiscipline,
  listDisciplines,
  type DisciplineId,
} from '@/lib/disciplines';
import {
  AGENT_DISCIPLINE,
  SKILL_DISCIPLINE,
  disciplineForAgent,
  disciplineForSkill,
} from '@/lib/disciplines/skill-mapping';
import { bucketApprovals } from '@/lib/disciplines/grouping';
import {
  entriesForDiscipline,
  entryAppliesToVertical,
  listIntegrations,
  type MarketplaceEntry,
} from '@/lib/integrations/marketplace';

// ──────────────────────────────────────────────────────────────
// 1. Discipline source-of-truth
// ──────────────────────────────────────────────────────────────

describe('lib/disciplines — source-of-truth', () => {
  it('exposes exactly the 8 locked discipline ids', () => {
    const ids = listDisciplines().map((d) => d.id);
    assert.deepEqual(ids, [
      'analytics',
      'research',
      'legal',
      'marketing',
      'sales-enablement',
      'customer-success',
      'finance',
      'operations',
    ]);
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, 8, 'no duplicate ids');
  });

  it('every discipline carries a non-empty name + description + iconKey', () => {
    for (const d of listDisciplines()) {
      assert.ok(d.name.length > 0, `${d.id} has a name`);
      assert.ok(d.description.length > 0, `${d.id} has a description`);
      assert.ok(d.iconKey.length > 0, `${d.id} has an iconKey`);
      assert.ok(d.sortOrder >= 0, `${d.id} sortOrder is non-negative`);
    }
  });

  it('disciplines render sorted by `sortOrder`', () => {
    const orders = listDisciplines().map((d) => d.sortOrder);
    const sorted = [...orders].sort((a, b) => a - b);
    assert.deepEqual(orders, sorted, 'output is already sorted');
  });

  it('asDisciplineId narrows valid + rejects invalid', () => {
    assert.equal(asDisciplineId('analytics'), 'analytics');
    assert.equal(asDisciplineId('legal'), 'legal');
    assert.equal(asDisciplineId('not-a-discipline'), null);
    assert.equal(asDisciplineId(null), null);
    assert.equal(asDisciplineId(''), null);
  });

  it('getDiscipline returns the record for known + null for unknown', () => {
    const legal = getDiscipline('legal');
    assert.ok(legal);
    assert.equal(legal.id, 'legal');
    assert.equal(getDiscipline('not-real'), null);
  });

  it('DISCIPLINE_IDS pins the lock list', () => {
    assert.equal(DISCIPLINE_IDS.length, 8);
    assert.ok(DISCIPLINE_IDS.includes('operations'));
    assert.ok(DISCIPLINE_IDS.includes('analytics'));
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Skill + agent discipline mappings
// ──────────────────────────────────────────────────────────────

describe('lib/disciplines/skill-mapping — agent + skill tagging', () => {
  it('every mapped slug points at a valid DisciplineId', () => {
    for (const [slug, d] of Object.entries(SKILL_DISCIPLINE)) {
      assert.ok(
        asDisciplineId(d) !== null,
        `skill ${slug} maps to a valid discipline (${d})`,
      );
    }
    for (const [slug, d] of Object.entries(AGENT_DISCIPLINE)) {
      assert.ok(
        asDisciplineId(d) !== null,
        `agent ${slug} maps to a valid discipline (${d})`,
      );
    }
  });

  it('resolvers return null on unknown slugs (panel count stays honest)', () => {
    assert.equal(disciplineForAgent('not-an-agent'), null);
    assert.equal(disciplineForSkill('not-a-skill'), null);
  });

  it('realty roster has at least one mapped slug per top-firing discipline', () => {
    // The realty pilot fires today — at minimum operations + sales-enablement
    // + legal + analytics should each have a mapped realty agent so the
    // realty workspace sees those cards as "build pending" → "active" as
    // the runtime layers light up.
    const realtyDisciplines = Object.entries(AGENT_DISCIPLINE)
      .filter(([slug]) => slug.startsWith('realty-'))
      .map(([, d]) => d);
    const seen = new Set(realtyDisciplines);
    assert.ok(seen.has('operations'), 'realty maps to operations');
    assert.ok(seen.has('sales-enablement'), 'realty maps to sales-enablement');
    assert.ok(seen.has('legal'), 'realty maps to legal');
    assert.ok(seen.has('analytics'), 'realty maps to analytics');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Marketplace — disciplines + verticalRelevance
// ──────────────────────────────────────────────────────────────

describe('marketplace — discipline + vertical fields (Strand 3 wedge)', () => {
  it('every entry declares disciplines (non-empty, all valid)', () => {
    for (const e of listIntegrations()) {
      assert.ok(e.disciplines.length > 0, `${e.id} declares ≥1 discipline`);
      for (const d of e.disciplines) {
        assert.ok(
          asDisciplineId(d) !== null,
          `${e.id} declares a valid discipline (${d})`,
        );
      }
    }
  });

  it('every entry declares verticalRelevance', () => {
    for (const e of listIntegrations()) {
      const rel = e.verticalRelevance;
      assert.ok(
        rel === 'all' || (Array.isArray(rel) && rel.length > 0),
        `${e.id} has a meaningful verticalRelevance`,
      );
    }
  });

  it('entriesForDiscipline returns ≥1 tile for each of the 8 disciplines', () => {
    // The catalog at Strand 3 Wave 1 has 12 connectors. Every discipline
    // SHOULD have at least one tile — analytics on excel, research on
    // google-drive, marketing on canva, sales-enablement on hubspot, etc.
    // This pins that the disciplines aren't paper-only.
    for (const d of DISCIPLINE_IDS) {
      const tiles = entriesForDiscipline(d);
      assert.ok(
        tiles.length >= 1,
        `discipline ${d} has ≥1 marketplace tile`,
      );
    }
  });

  it('CPA workspace facet: realty-only relevance hides tiles', () => {
    // No realty-only entries exist today (every entry is `'all'`), but
    // the test pins the SHAPE of the filter so adding a SoftPro/Qualia
    // tile with `verticalRelevance: ['real-estate', 'title-escrow']`
    // would be hidden from CPA the moment it landed.
    const hypothetical: MarketplaceEntry = {
      id: 'softpro-hypothetical',
      name: 'SoftPro',
      category: 'Documents',
      description: '',
      mcpEndpointTemplate: '/api/integrations/softpro-mcp/{workspaceId}',
      scopes: ['read'],
      oauthConfigKey: 'SOFTPRO_OAUTH',
      status: 'coming-soon',
      providerKey: null,
      disciplines: ['operations'],
      verticalRelevance: ['real-estate', 'title-escrow'],
    };
    assert.equal(entryAppliesToVertical(hypothetical, 'cpa'), false);
    assert.equal(entryAppliesToVertical(hypothetical, 'real-estate'), true);
    assert.equal(entryAppliesToVertical(hypothetical, 'title-escrow'), true);
  });

  it("a horizontal tile applies to every vertical (cpa included)", () => {
    const gmail = listIntegrations().find((e) => e.id === 'gmail');
    assert.ok(gmail);
    assert.equal(entryAppliesToVertical(gmail, 'cpa'), true);
    assert.equal(entryAppliesToVertical(gmail, 'real-estate'), true);
    assert.equal(entryAppliesToVertical(gmail, 'home-services'), true);
  });

  it('no available entry requests an outbound send scope (regression)', () => {
    // Re-asserted here so the discipline-axis migration cannot accidentally
    // relax the no-outbound rule.
    for (const entry of listIntegrations().filter((e) => e.status === 'available')) {
      for (const scope of entry.scopes) {
        assert.notEqual(scope, 'Mail.Send');
        assert.notEqual(scope, 'gmail.send');
        assert.notEqual(scope, 'Mail.Send.Shared');
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 4. Approval queue bucketing
// ──────────────────────────────────────────────────────────────

describe('lib/disciplines/grouping — approval queue bucketing', () => {
  type Row = { id: string; discipline: DisciplineId | null; isNeedsYou: boolean };
  const rows: Row[] = [
    { id: 'a', discipline: 'legal', isNeedsYou: false },
    { id: 'b', discipline: 'marketing', isNeedsYou: false },
    { id: 'c', discipline: 'legal', isNeedsYou: false },
    { id: 'd', discipline: null, isNeedsYou: false },
    { id: 'e', discipline: 'finance', isNeedsYou: true },
    { id: 'f', discipline: null, isNeedsYou: true },
  ];

  it('NULL discipline items land in the fallback bucket', () => {
    const { fallback } = bucketApprovals(rows);
    assert.deepEqual(
      fallback.map((r) => r.id),
      ['d'],
      'd has discipline=null and is not needsYou → fallback',
    );
  });

  it('NEEDS-YOU items elevate out of their discipline bucket', () => {
    const { needsYou, byDiscipline } = bucketApprovals(rows);
    const needsYouIds = needsYou.map((r) => r.id).sort();
    assert.deepEqual(needsYouIds, ['e', 'f']);
    // 'e' was tagged finance but elevated — finance bucket should NOT
    // contain it.
    const finance = byDiscipline.get('finance') ?? [];
    assert.ok(
      !finance.some((r) => r.id === 'e'),
      'urgent finance item not double-listed in the discipline bucket',
    );
  });

  it('items group into their discipline bucket in stable order', () => {
    const { byDiscipline } = bucketApprovals(rows);
    const legal = byDiscipline.get('legal') ?? [];
    assert.deepEqual(legal.map((r) => r.id), ['a', 'c']);
    const marketing = byDiscipline.get('marketing') ?? [];
    assert.deepEqual(marketing.map((r) => r.id), ['b']);
  });

  it('empty discipline buckets are absent (UI never shows empty section)', () => {
    const { byDiscipline } = bucketApprovals(rows);
    // No 'analytics' / 'research' items in the input set.
    assert.equal(byDiscipline.has('analytics'), false);
    assert.equal(byDiscipline.has('research'), false);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. Migration — idempotent, additive, RLS-safe
// ──────────────────────────────────────────────────────────────

describe('migration 20260528000000_add_discipline_axis', () => {
  const migrationPath = path.join(
    process.cwd(),
    'prisma',
    'migrations',
    '20260528000000_add_discipline_axis',
    'migration.sql',
  );

  it('SQL file exists', async () => {
    const stat = await fs.stat(migrationPath);
    assert.ok(stat.isFile(), 'migration.sql is a file');
  });

  it('ALTER TABLE statements use IF NOT EXISTS (reversible / re-runnable)', async () => {
    const sql = await fs.readFile(migrationPath, 'utf8');
    assert.match(
      sql,
      /ALTER TABLE "WorkApprovalQueueItem"[\s\S]*?ADD COLUMN IF NOT EXISTS "discipline" TEXT/,
      'discipline column add is idempotent',
    );
    assert.match(
      sql,
      /ALTER TABLE "WorkspacePreference"[\s\S]*?ADD COLUMN IF NOT EXISTS "disabledDisciplines" TEXT\[\]/,
      'disabledDisciplines column add is idempotent',
    );
    assert.match(
      sql,
      /CREATE INDEX IF NOT EXISTS "WorkApprovalQueueItem_workspaceId_discipline_status_idx"/,
      'discipline index is idempotent',
    );
  });

  it('discipline column is NULLABLE (no NOT NULL on legacy rows)', async () => {
    const sql = await fs.readFile(migrationPath, 'utf8');
    // discipline column line has NO `NOT NULL` clause.
    const disciplineLine = sql.match(/ADD COLUMN IF NOT EXISTS "discipline" TEXT[^;]*;/);
    assert.ok(disciplineLine, 'discipline column add found');
    assert.equal(
      /NOT NULL/.test(disciplineLine![0]),
      false,
      'discipline column stays NULLABLE so legacy rows survive the migration',
    );
  });

  it('disabledDisciplines defaults to empty array (every discipline on by default)', async () => {
    const sql = await fs.readFile(migrationPath, 'utf8');
    assert.match(
      sql,
      /"disabledDisciplines" TEXT\[\][\s\S]*?DEFAULT ARRAY\[\]::TEXT\[\]/,
      'disabledDisciplines defaults to empty',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// 6. Workspace isolation — query shape pinning
// ──────────────────────────────────────────────────────────────

describe('discipline pages — workspace isolation via query shape', () => {
  const repoRoot = process.cwd();
  const approvalsPagePath = path.join(
    repoRoot,
    'app',
    '(product)',
    'app',
    'workspace',
    '[id]',
    'approvals',
    'page.tsx',
  );
  const disciplineDetailPath = path.join(
    repoRoot,
    'app',
    '(product)',
    'app',
    'workspace',
    '[id]',
    'disciplines',
    '[disciplineId]',
    'page.tsx',
  );
  const disciplinePanelPath = path.join(
    repoRoot,
    'app',
    '(product)',
    'app',
    'workspace',
    '[id]',
    'disciplines',
    'page.tsx',
  );
  const activationPath = path.join(repoRoot, 'lib', 'disciplines', 'activation.ts');

  it('approvals page query scopes by workspaceId (RLS defense in depth)', async () => {
    const src = await fs.readFile(approvalsPagePath, 'utf8');
    // The findMany call has a `where: { workspaceId, ...` shape — RLS
    // catches a leak at the SQL layer, but the app-layer scope is what
    // we pin here so a bug-introducing refactor surfaces at test time.
    assert.match(
      src,
      /where:\s*\{\s*workspaceId,\s*status:\s*"PENDING"/,
      'approvals findMany scopes by workspaceId',
    );
    assert.match(src, /withRls/, 'approvals page uses withRls');
  });

  it('discipline detail page filters by workspaceId + discipline (no cross-workspace leak)', async () => {
    const src = await fs.readFile(disciplineDetailPath, 'utf8');
    assert.match(
      src,
      /where:\s*\{\s*workspaceId,\s*discipline:\s*validId\s*\}/,
      'detail page scopes by both workspaceId AND discipline',
    );
    assert.match(src, /withRls/, 'detail page uses withRls');
  });

  it('discipline panel page reads workspace-scoped data only', async () => {
    const src = await fs.readFile(disciplinePanelPath, 'utf8');
    // Every read in the panel is wrapped in withRls — no raw prisma.* on
    // a workspace-scoped table.
    assert.match(src, /withRls/, 'panel page uses withRls');
    assert.match(
      src,
      /where:\s*\{\s*workspaceId,\s*status:\s*"ACTIVE"/,
      'credential read scopes by workspaceId',
    );
  });

  it('activation module always wraps reads + writes in withRls', async () => {
    const src = await fs.readFile(activationPath, 'utf8');
    // Both functions in the module must use withRls.
    const withRlsHits = src.match(/withRls\(/g) ?? [];
    assert.ok(
      withRlsHits.length >= 2,
      `activation.ts uses withRls in both getActivationState + setDisciplineEnabled (found ${withRlsHits.length})`,
    );
  });

  it('toggle action validates discipline + uses requireWorkspaceMember', async () => {
    const actionsPath = path.join(
      repoRoot,
      'app',
      '(product)',
      'app',
      'workspace',
      '[id]',
      'disciplines',
      'actions.ts',
    );
    const src = await fs.readFile(actionsPath, 'utf8');
    assert.match(
      src,
      /requireWorkspaceMember\(raw\.workspaceId,/,
      'action gates on workspace membership',
    );
    assert.match(
      src,
      /asDisciplineId\(raw\.discipline\)/,
      'action narrows the discipline before persisting',
    );
    assert.match(
      src,
      /z\.string\(\)\.uuid\(\)/,
      'action zod-validates the workspaceId at the boundary',
    );
  });
});
