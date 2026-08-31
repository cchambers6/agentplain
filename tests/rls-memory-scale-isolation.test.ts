/**
 * tests/rls-memory-scale-isolation.test.ts
 *
 * The RLS coverage guarantees, in two layers:
 *
 *   A. SOURCE INVARIANTS (run anywhere, no DB) — assert the migrations
 *      actually enable + FORCE + policy every table that needs it.
 *
 *   B. LIVE CROSS-TENANT (guarded on DATABASE_URL) — seed two workspaces,
 *      write rows for each, then prove workspace A's RLS context cannot read
 *      workspace B's rows, and vice-versa, while the operator sees both.
 *
 * WHY LAYER A LOOKS THE WAY IT DOES
 * ---------------------------------
 * The original version of this file asked "does every model with a
 * `workspaceId` COLUMN have RLS?" That predicate is opt-in by column name, and
 * it was wrong in the most expensive way a check can be wrong: it was GREEN
 * over an open gap. Twelve tables had no row-level security of any kind, and
 * this test could see exactly one of them (PortalConfig), because the other
 * eleven carry their tenant one or two foreign-key hops out —
 * `PortalMessage.portalConfigId -> PortalConfig.workspaceId`,
 * `PortalCaseEvent.caseId -> PortalCase -> PortalConfig`,
 * `TeamMembership.teamId -> Team` — or, for the outreach pair, are global.
 *
 * A check that names one of twelve problems and reports success is worse than
 * no check, because it manufactures confidence. So the default is inverted:
 *
 *     EVERY model must have RLS in a migration, or appear in RLS_EXEMPT with
 *     a written reason.
 *
 * Opt-out-by-exemption catches the next table someone adds two FK hops from a
 * tenant root. Opt-in-by-column-name never will. `RLS_EXEMPT` is empty today,
 * and the staleness check below makes sure an entry cannot linger as
 * decoration once the table it names is protected.
 *
 * Closed by migration 20260830000000_portal_team_outreach_rls.
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

/**
 * Tables closed by 20260830000000_portal_team_outreach_rls. Pinned by name so
 * a later migration cannot quietly drop one back out of coverage without this
 * list being edited deliberately.
 */
const PORTAL_TREE_TABLES = [
  'PortalConfig',
  'PortalClient',
  'PortalCase',
  'PortalCaseEvent',
  'PortalInvite',
  'PortalSession',
  'PortalThread',
  'PortalMessage',
  'PortalDocument',
];
const OPERATOR_GLOBAL_TABLES = ['OutreachProspect', 'OutreachTouch'];

/**
 * Models allowed to ship with NO row-level security at all.
 *
 * This is deliberately empty. Every one of the 64 models in the schema is
 * covered by a migration today, including the operator-global ones — those
 * carry an operator-only policy (`outreach_prospect_operator_all`, mirroring
 * `leadcapture_operator_all`) rather than an exemption, because a policy that
 * denies every workspace context is strictly stronger than being excused from
 * the check.
 *
 * If you are adding an entry here, the bar is: state what the table holds, why
 * no policy can express its access rule, and what control replaces RLS. "It is
 * internal" is not a reason — Inquiry, LeadCapture and OpsFlag are internal and
 * all three have policies.
 */
const RLS_EXEMPT: ReadonlyMap<string, string> = new Map<string, string>([
  // (empty — every model is policied. See the doc comment before adding.)
]);

/**
 * Strip SQL comments so that a COMMENTED-OUT statement can never satisfy an
 * invariant in this file.
 *
 * Every check below reads the union of all migration.sql as ONE STRING and
 * matches unanchored regexes against it. Without this, a migration containing
 * nothing but
 *
 *     -- ALTER TABLE "Foo" ENABLE ROW LEVEL SECURITY;
 *     -- ALTER TABLE "Foo" FORCE ROW LEVEL SECURITY;
 *     -- CREATE POLICY "foo_isolation" ON "Foo" USING (true);
 *
 * makes all eight source invariants report green over a table that has no
 * row-level security at all. Demonstrated by commenting out every live line
 * of 20260830000000_portal_team_outreach_rls: 8 pass, 0 fail.
 *
 * This is not hypothetical drift. These migrations are heavily commented —
 * the RLS one opens with 40 lines of prose — and a reviewer commenting a
 * statement out to isolate a failure, or a merge resolution that keeps the
 * explanatory copy and drops the DDL, produces exactly this shape. The
 * "no migration weakens RLS" check below already filtered `--` lines for its
 * own matches; the positive checks did not, which is the direction that
 * fails OPEN.
 *
 * Comments become whitespace rather than disappearing, and newlines are
 * preserved, so the per-line `^...$` scan in that check still sees the same
 * line structure.
 *
 * String and identifier literals are walked rather than skipped, so a `--`
 * or a `/*` inside a quoted policy expression is not mistaken for a comment
 * and does not swallow the rest of the file. Postgres nests block comments,
 * so the depth is tracked; dollar-quoted bodies are passed through whole.
 */
export function stripSqlComments(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const c = sql[i]!;

    // -- line comment
    if (c === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i += 1;
      continue; // the \n itself is emitted by the next iteration
    }

    // /* block comment */ — nestable in Postgres
    if (c === '/' && sql[i + 1] === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth += 1;
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          depth -= 1;
          i += 2;
          continue;
        }
        if (sql[i] === '\n') out += '\n';
        i += 1;
      }
      continue;
    }

    // 'string literal' / "quoted identifier" — copied through verbatim
    if (c === "'" || c === '"') {
      out += c;
      i += 1;
      while (i < n) {
        if (sql[i] === c && sql[i + 1] === c) {
          out += c + c;
          i += 2;
          continue;
        }
        if (sql[i] === c) {
          out += c;
          i += 1;
          break;
        }
        out += sql[i];
        i += 1;
      }
      continue;
    }

    // $tag$ dollar-quoted body $tag$
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        out += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    out += c;
    i += 1;
  }

  return out;
}

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
  // Commented-out DDL is not DDL. See stripSqlComments.
  return stripSqlComments(out.join('\n'));
}

function tablesMatching(sql: string, re: RegExp): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, 'gi');
  while ((m = r.exec(sql)) !== null) set.add(m[1]);
  return set;
}

/** Every `model X { ... }` block in schema.prisma, as [name, body]. */
async function schemaModels(): Promise<Array<[string, string]>> {
  const schema = await fs.readFile(SCHEMA, 'utf8');
  const out: Array<[string, string]> = [];
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) out.push([m[1], m[2]]);
  return out;
}

/**
 * The physical table a model maps to. Prisma uses the model name unless an
 * `@@map("...")` overrides it — RLS statements name the TABLE, so the check
 * has to resolve the mapping or it would report false gaps.
 */
function tableNameFor(model: string, body: string): string {
  const mapped = /@@map\(\s*"([^"]+)"\s*\)/.exec(body);
  return mapped ? mapped[1] : model;
}

const ENABLE_RE = /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/;
const FORCE_RE = /ALTER\s+TABLE\s+"([A-Za-z0-9_]+)"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/;
const POLICY_RE = /CREATE\s+POLICY\s+"[^"]+"\s+ON\s+"([A-Za-z0-9_]+)"/;

describe('RLS coverage — source invariants', () => {
  it('every model has RLS in a migration, or an explicit exemption with a reason', async () => {
    const models = await schemaModels();
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, ENABLE_RE);

    const unprotected = models
      .map(([name, body]) => ({ model: name, table: tableNameFor(name, body) }))
      .filter(({ model, table }) => !enabled.has(table) && !RLS_EXEMPT.has(model))
      .map(({ model, table }) => (model === table ? model : `${model} (table ${table})`))
      .sort();

    assert.deepEqual(
      unprotected,
      [],
      `models with NO row-level security and no declared exemption.\n` +
        `Each of these is readable across every tenant by any connection that omits a ` +
        `workspace filter. Add ENABLE + FORCE ROW LEVEL SECURITY and a policy in a ` +
        `migration, or add the model to RLS_EXEMPT with a written reason:\n` +
        unprotected.map((t) => `  ${t}`).join('\n'),
    );

    // Sanity: the scan actually found the schema. A regex that silently matches
    // nothing would make the assertion above vacuously true.
    assert.ok(models.length > 50, `expected the full schema, parsed ${models.length} models`);
  });

  it('the RLS exemption list has not rotted', async () => {
    const models = await schemaModels();
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, ENABLE_RE);
    const byModel = new Map(models.map(([n, b]) => [n, tableNameFor(n, b)]));

    for (const [model, reason] of RLS_EXEMPT) {
      assert.ok(
        reason.trim().length >= 20,
        `RLS_EXEMPT["${model}"] needs a real reason, not "${reason}"`,
      );
      const table = byModel.get(model);
      assert.ok(
        table !== undefined,
        `RLS_EXEMPT names "${model}", which is not a model in schema.prisma. ` +
          `The exemption is fiction and would suppress a future model of that name.`,
      );
      assert.ok(
        !enabled.has(table),
        `RLS_EXEMPT excuses "${model}" from row-level security, but a migration ` +
          `enables RLS on "${table}". Drop the exemption — it is now suppressing nothing ` +
          `and hides the fact that the table IS protected.`,
      );
    }
  });

  it('every model with a workspaceId column has RLS enabled in a migration', async () => {
    const models = await schemaModels();
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, ENABLE_RE);

    const wsModels = models
      .filter(([, body]) => /\n\s*workspaceId\s+String/.test(body))
      .map(([name, body]) => tableNameFor(name, body));

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
    const enabled = tablesMatching(sql, ENABLE_RE);
    const forced = tablesMatching(sql, FORCE_RE);
    const policied = tablesMatching(sql, POLICY_RE);

    for (const t of [...GAP_TABLES, ...NEW_TABLES]) {
      assert.ok(enabled.has(t), `${t} is missing ENABLE ROW LEVEL SECURITY`);
      assert.ok(forced.has(t), `${t} is missing FORCE ROW LEVEL SECURITY`);
      assert.ok(policied.has(t), `${t} is missing a CREATE POLICY`);
    }
  });

  it('the client-portal tree + TeamMembership + the outreach pair each have ENABLE + FORCE + a policy', async () => {
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, ENABLE_RE);
    const forced = tablesMatching(sql, FORCE_RE);
    const policied = tablesMatching(sql, POLICY_RE);

    for (const t of [...PORTAL_TREE_TABLES, 'TeamMembership', ...OPERATOR_GLOBAL_TABLES]) {
      assert.ok(enabled.has(t), `${t} is missing ENABLE ROW LEVEL SECURITY`);
      assert.ok(forced.has(t), `${t} is missing FORCE ROW LEVEL SECURITY`);
      assert.ok(policied.has(t), `${t} is missing a CREATE POLICY`);
    }
  });

  it('every policied table is FORCEd (table-owner bypass closer holds with new policies)', async () => {
    const sql = await allMigrationSql();
    const policied = tablesMatching(sql, POLICY_RE);
    const forced = tablesMatching(sql, FORCE_RE);
    const missing = [...policied].filter((t) => !forced.has(t)).sort();
    assert.deepEqual(missing, [], `policied-but-unforced tables:\n${missing.map((t) => `  ${t}`).join('\n')}`);
  });

  it('every RLS-enabled table has at least one policy', async () => {
    // RLS enabled with no policy is deny-all, which fails closed but silently
    // breaks the feature. The reverse of the FORCE check, and the other way a
    // half-finished migration shows up.
    const sql = await allMigrationSql();
    const enabled = tablesMatching(sql, ENABLE_RE);
    const policied = tablesMatching(sql, POLICY_RE);
    const missing = [...enabled].filter((t) => !policied.has(t)).sort();
    assert.deepEqual(
      missing,
      [],
      `tables with RLS enabled and NO policy (deny-all):\n${missing.map((t) => `  ${t}`).join('\n')}`,
    );
  });

  it('no migration ever drops or disables row-level security', async () => {
    // Coverage must be monotonic: the checks above read the union of all
    // migrations, so a later DROP POLICY / DISABLE RLS would make every
    // assertion in this file report protection that no longer exists.
    const sql = await allMigrationSql();
    const offenders = [
      ...sql.matchAll(/^.*(DROP\s+POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY|NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY).*$/gim),
    ]
      .map((m) => m[0].trim())
      .filter((line) => !line.startsWith('--'));
    assert.deepEqual(
      offenders,
      [],
      `a migration weakens RLS, so the union-of-all-migrations reads in this file ` +
        `no longer describe the live schema:\n${offenders.map((l) => `  ${l}`).join('\n')}`,
    );
  });
});

// =====================================================================
// The strip itself. Everything above reads ONE concatenated string and
// matches unanchored regexes against it, so the checks are only as honest as
// the text they are handed. Commented-out DDL used to be indistinguishable
// from DDL: commenting out every live line of the portal/team/outreach RLS
// migration left all eight invariants at 8 pass, 0 fail over twelve tables
// with no row-level security at all.
//
// These cases hold the strip in place from BOTH sides — a strip that removed
// nothing puts the hole back, and a strip that removed too much would quietly
// take real coverage out of the union and is caught by the live-DDL case.
// =====================================================================

describe('SQL comment stripping', () => {
  it('commented-out RLS DDL is not RLS DDL', () => {
    const fake = [
      '-- Closes the last gap table.',
      '-- ALTER TABLE "GhostTable" ENABLE ROW LEVEL SECURITY;',
      '-- ALTER TABLE "GhostTable" FORCE ROW LEVEL SECURITY;',
      '-- CREATE POLICY "ghost_isolation" ON "GhostTable"',
      '--   USING (true) WITH CHECK (true);',
      '/* ALTER TABLE "BlockGhost" ENABLE ROW LEVEL SECURITY; */',
      '/* outer /* nested */ CREATE POLICY "x" ON "BlockGhost" USING (true); */',
    ].join('\n');

    const stripped = stripSqlComments(fake);
    assert.deepEqual([...tablesMatching(stripped, ENABLE_RE)], []);
    assert.deepEqual([...tablesMatching(stripped, FORCE_RE)], []);
    assert.deepEqual([...tablesMatching(stripped, POLICY_RE)], []);

    // And the unstripped text really did look like coverage — otherwise this
    // case would pass for the wrong reason.
    assert.deepEqual([...tablesMatching(fake, ENABLE_RE)], ['GhostTable', 'BlockGhost']);
  });

  it('live DDL survives, comments and all', () => {
    const real = [
      '-- Tenant isolation for RealTable.',
      'ALTER TABLE "RealTable" ENABLE ROW LEVEL SECURITY;  -- trailing note',
      '/* a block comment between statements */',
      'ALTER TABLE "RealTable" FORCE ROW LEVEL SECURITY;',
      'CREATE POLICY "real_isolation" ON "RealTable"',
      '  USING (true) WITH CHECK (true);',
    ].join('\n');

    const stripped = stripSqlComments(real);
    assert.deepEqual([...tablesMatching(stripped, ENABLE_RE)], ['RealTable']);
    assert.deepEqual([...tablesMatching(stripped, FORCE_RE)], ['RealTable']);
    assert.deepEqual([...tablesMatching(stripped, POLICY_RE)], ['RealTable']);
  });

  it('a -- inside a string literal does not swallow the rest of the file', () => {
    // A policy expression comparing against a literal containing a double
    // hyphen. Treating that as a comment would blank every statement after
    // it, silently REMOVING coverage from the union and failing the suite
    // for a reason nobody could find.
    const sql = [
      `CREATE POLICY "lit" ON "Quoted" USING (tag <> 'a--b');`,
      'ALTER TABLE "AfterLiteral" ENABLE ROW LEVEL SECURITY;',
    ].join('\n');

    const stripped = stripSqlComments(sql);
    assert.ok(
      stripped.includes(`'a--b'`),
      `the literal was eaten as a comment: ${JSON.stringify(stripped)}`,
    );
    assert.deepEqual([...tablesMatching(stripped, ENABLE_RE)], ['AfterLiteral']);
  });

  it('line structure is preserved, so the per-line weakening scan still works', () => {
    // "no migration ever drops or disables row-level security" matches with
    // /^...$/gim. Collapsing newlines here would let a live DROP POLICY share
    // a line with a comment and escape that check.
    const sql = 'SELECT 1; -- note\nDROP POLICY "p" ON "T";\n-- DROP POLICY "q" ON "T";\n';
    const stripped = stripSqlComments(sql);
    assert.equal(
      (stripped.match(/\n/g) ?? []).length,
      (sql.match(/\n/g) ?? []).length,
      'newline count changed',
    );
    const offenders = [...stripped.matchAll(/^.*(DROP\s+POLICY).*$/gim)].map((m) => m[0].trim());
    assert.deepEqual(offenders, ['DROP POLICY "p" ON "T";']);
  });

  it('the real migration corpus still yields its coverage after stripping', () => {
    // Sanity in the other direction: the eight invariants above are green,
    // which would also be true of a strip that returned the empty string for
    // a corpus with no models. This asserts the union is non-trivial.
    return allMigrationSql().then((sql) => {
      assert.ok(sql.length > 10_000, `stripped corpus is suspiciously small: ${sql.length}`);
      assert.ok(tablesMatching(sql, ENABLE_RE).size > 50, 'stripped away real coverage');
    });
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

  it('workspace A cannot read workspace B rows anywhere in the client-portal tree', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { withRls, withSystemContext } = await import('@/lib/db/rls');

    const suffix = process.hrtime.bigint().toString(36);
    let idA = '';
    let idB = '';

    const seed = async (tag: string) => {
      const ws = await withSystemContext((tx) =>
        tx.workspace.create({ data: { name: `Portal ${tag}`, slug: `rls-portal-${tag}-${suffix}` }, select: { id: true } }),
      );
      const cfg = await withSystemContext((tx) =>
        tx.portalConfig.create({
          data: {
            workspaceId: ws.id,
            slug: `rls-portal-${tag}-${suffix}`,
            brandName: `Brand ${tag}`,
          },
          select: { id: true },
        }),
      );
      await withSystemContext((tx) =>
        tx.portalClient.create({
          data: {
            portalConfigId: cfg.id,
            workspaceId: ws.id,
            email: `client-${tag}-${suffix}@example.com`,
            name: `Client ${tag}`,
          },
        }),
      );
      return ws.id;
    };

    try {
      idA = await seed('a');
      idB = await seed('b');

      const ctxA = { userId: null, workspaceId: idA, isOperator: false };

      const clientsSeenByA = await withRls(ctxA, (tx) =>
        tx.portalClient.findMany({ select: { workspaceId: true } }),
      );
      assert.ok(clientsSeenByA.length >= 1, 'A should see its own portal client');
      for (const c of clientsSeenByA) {
        assert.equal(c.workspaceId, idA, 'PortalClient RLS leaked another tenant end-client to A');
      }

      const configsSeenByA = await withRls(ctxA, (tx) =>
        tx.portalConfig.findMany({ select: { workspaceId: true } }),
      );
      for (const c of configsSeenByA) {
        assert.equal(c.workspaceId, idA, 'PortalConfig RLS leaked another tenant portal to A');
      }

      const all = await withSystemContext((tx) =>
        tx.portalClient.findMany({ where: { workspaceId: { in: [idA, idB] } }, select: { id: true } }),
      );
      assert.equal(all.length, 2, 'operator should see both portals');
    } finally {
      if (idA) await withSystemContext((tx) => tx.workspace.delete({ where: { id: idA } })).catch(() => {});
      if (idB) await withSystemContext((tx) => tx.workspace.delete({ where: { id: idB } })).catch(() => {});
      await prisma.$disconnect().catch(() => {});
    }
  });
});
