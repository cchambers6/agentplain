/**
 * tests/rls-memory-scale-isolation.test.ts
 *
 * The memory-scale RLS guarantees, in two layers:
 *
 *   A. SOURCE INVARIANTS (run anywhere, no DB) — assert the migrations
 *      actually enable + FORCE + policy the right tables:
 *        1. EVERY model with a workspaceId column has RLS enabled (the
 *           pre-existing gap on DisciplineHead / SkillRun / SkillScheduleWindow
 *           / Team / WorkspaceLifecycleEvent / WorkspacePauseConfig is closed).
 *        2. The 6 gap tables + the 2 new tables each have ENABLE + FORCE +
 *           at least one CREATE POLICY.
 *        3. The "every policied table is FORCEd" invariant still holds with
 *           the new policies (table-owner bypass closer).
 *
 *   B. LIVE CROSS-TENANT (guarded on DATABASE_URL) — seed two workspaces,
 *      write rows to a new table (MemoryAuditLog) and a newly-policied gap
 *      table (Team) for each, then prove workspace A's RLS context cannot
 *      read workspace B's rows, and vice-versa, while the operator sees both.
 *
 * Layer A is the regression lock; layer B is the end-to-end proof.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations');
const SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma');

const GAP_TABLES = [
  'DisciplineHead',
  'SkillRun',
  'SkillScheduleWindow',
  'Team',
  'WorkspaceLifecycleEvent',
  'WorkspacePauseConfig',
];
const NEW_TABLES = ['WorkspaceStorageConfig', 'MemoryAuditLog'];

async function allMigrationSql(): Promise<string> {
  const out: string[] = [];
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const f = path.join(MIGRATIONS_DIR, e.name, 'migration.sql');
      try {
        out.push(await fs.readFile(f, 'utf8'));
      } catch {
        /* no migration.sql in dir */
      }
    }
  }
  return out.join('\n');
}

function tablesMatching(sql: string, re: RegExp): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, 'gi');
  while ((m = r.exec(sql)) !== null) set.add(m[1]);
  return set;
}

describe('memory-scale RLS — source invariants', () => {
  it('every model with a workspaceId column has RLS enabled in a migration', async () => {
    const schema = await fs.readFile(SCHEMA, 'utf8');
    const sql = await allMigrationSql();
    const enabled = tablesMatching(
      sql,
      /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/,
    );

    const wsModels: string[] = [];
    const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
    let m: RegExpExecArray | null;
    while ((m = modelRe.exec(schema)) !== null) {
      if (/\n\s*workspaceId\s+String/.test(m[2])) wsModels.push(m[1]);
    }

    const missing = wsModels.filter((t) => !enabled.has(t)).sort();
    assert.deepEqual(
      missing,
      [],
      `customer-scoped models (workspaceId) WITHOUT RLS — add ENABLE ROW LEVEL SECURITY + a policy:\n${missing
        .map((t) => `  ${t}`)
        .join('\n')}`,
    );
    assert.ok(wsModels.length > 20, 'sanity: expected many workspaceId models');
  });

  it('the 6 previously-unprotected tables + 2 new tables each have ENABLE + FORCE + a policy', async () => {
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
    const forced = tablesMatching(sql, /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/);
    const policied = tablesMatching(sql, /CREATE\s+POLICY\s+"[^"]+"\s+ON\s+"([A-Za-z0-9_]+)"/);

    for (const t of [...GAP_TABLES, ...NEW_TABLES]) {
      assert.ok(enabled.has(t), `${t} is missing ENABLE ROW LEVEL SECURITY`);
      assert.ok(forced.has(t), `${t} is missing FORCE ROW LEVEL SECURITY`);
      assert.ok(policied.has(t), `${t} is missing a CREATE POLICY`);
    }
  });

  it('every policied table is FORCEd (table-owner bypass closer holds with new policies)', async () => {
    const sql = await allMigrationSql();
    const policied = tablesMatching(sql, /CREATE\s+POLICY\s+"[^"]+"\s+ON\s+"([A-Za-z0-9_]+)"/);
    const forced = tablesMatching(sql, /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/);
    const missing = [...policied].filter((t) => !forced.has(t)).sort();
    assert.deepEqual(missing, [], `policied-but-unforced tables:\n${missing.map((t) => `  ${t}`).join('\n')}`);
  });
});

// =====================================================================
// Live cross-tenant isolation (requires a real Postgres with the migrations
// applied). Skipped when DATABASE_URL is absent so the suite stays green in
// DB-free CI; runs locally / in the deploy-time smoke pass.
// =====================================================================
const RUN_DB = !!process.env.DATABASE_URL;

describe('memory-scale RLS — live cross-tenant isolation', { skip: !RUN_DB }, () => {
  it('workspace A cannot read workspace B rows in a new table OR a gap table', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { withRls, withSystemContext } = await import('@/lib/db/rls');

    const suffix = process.hrtime.bigint().toString(36);
    const slugA = `rls-mem-a-${suffix}`;
    const slugB = `rls-mem-b-${suffix}`;
    let idA = '';
    let idB = '';

    try {
      // Seed two workspaces as operator.
      const a = await withSystemContext((tx) =>
        tx.workspace.create({ data: { name: 'RLS A', slug: slugA }, select: { id: true } }),
      );
      const b = await withSystemContext((tx) =>
        tx.workspace.create({ data: { name: 'RLS B', slug: slugB }, select: { id: true } }),
      );
      idA = a.id;
      idB = b.id;

      const ctxA = { userId: null, workspaceId: idA, isOperator: false };
      const ctxB = { userId: null, workspaceId: idB, isOperator: false };

      // Gap table (Team): one row per workspace.
      await withSystemContext((tx) =>
        tx.team.create({ data: { workspaceId: idA, name: 'Team A' } }),
      );
      await withSystemContext((tx) =>
        tx.team.create({ data: { workspaceId: idB, name: 'Team B' } }),
      );

      // New table (MemoryAuditLog): one row per workspace.
      await withSystemContext((tx) =>
        tx.memoryAuditLog.create({
          data: {
            workspaceId: idA,
            actorType: 'SYSTEM',
            actorId: 's',
            action: 'READ',
            recordType: 'WorkspaceMemoryEntry',
            recordId: 'x',
            intent: 'test',
            source: 'test',
          },
        }),
      );
      await withSystemContext((tx) =>
        tx.memoryAuditLog.create({
          data: {
            workspaceId: idB,
            actorType: 'SYSTEM',
            actorId: 's',
            action: 'READ',
            recordType: 'WorkspaceMemoryEntry',
            recordId: 'x',
            intent: 'test',
            source: 'test',
          },
        }),
      );

      // A's context sees ONLY A's rows.
      const teamsSeenByA = await withRls(ctxA, (tx) => tx.team.findMany({ select: { workspaceId: true } }));
      assert.ok(teamsSeenByA.length >= 1);
      for (const t of teamsSeenByA) assert.equal(t.workspaceId, idA, 'Team RLS leaked a foreign row to A');

      const auditSeenByA = await withRls(ctxA, (tx) =>
        tx.memoryAuditLog.findMany({ select: { workspaceId: true } }),
      );
      for (const r of auditSeenByA) assert.equal(r.workspaceId, idA, 'MemoryAuditLog RLS leaked to A');

      // B's context sees ONLY B's rows.
      const teamsSeenByB = await withRls(ctxB, (tx) => tx.team.findMany({ select: { workspaceId: true } }));
      for (const t of teamsSeenByB) assert.equal(t.workspaceId, idB, 'Team RLS leaked a foreign row to B');

      // Operator sees both.
      const allTeams = await withSystemContext((tx) =>
        tx.team.findMany({ where: { workspaceId: { in: [idA, idB] } }, select: { id: true } }),
      );
      assert.equal(allTeams.length, 2, 'operator should see both workspaces');
    } finally {
      // Cleanup (cascade drops Team + MemoryAuditLog).
      if (idA) await withSystemContext((tx) => tx.workspace.delete({ where: { id: idA } })).catch(() => {});
      if (idB) await withSystemContext((tx) => tx.workspace.delete({ where: { id: idB } })).catch(() => {});
      await prisma.$disconnect().catch(() => {});
    }
  });
});
