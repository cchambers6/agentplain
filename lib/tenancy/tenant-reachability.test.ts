/**
 * lib/tenancy/tenant-reachability.test.ts
 *
 * THE TENANT ISOLATION STANDARD. This file is the gate.
 *
 * Three kinds of assertion live here, and all three are load-bearing:
 *
 *   1. PRODUCTION assertions — bind the checkers to the real parsed schema and
 *      the real migrations, apply the ratchet, and fail on anything not
 *      accepted-and-dated. This is what blocks a merge.
 *   2. DELIBERATE-FAILURE assertions — feed each checker a synthetic fixture
 *      built to violate it and assert it reports the violation. Without these,
 *      a checker that silently stopped working would look exactly like a clean
 *      schema. An unfired check and a broken check are indistinguishable, and
 *      that indistinguishability is the bug.
 *   3. BLINDNESS assertions — assert the parser actually saw the schema. The
 *      specific way this standard dies is a parser that returns zero models
 *      after a Prisma syntax change: every loop iterates nothing, every
 *      assertion passes, and the gate goes green over a file it never read.
 *
 * Every deliberate-failure fixture carries a near-miss control (the same
 * shape, one field changed so it is legal) so each checker is proven to
 * DISCRIMINATE rather than to fire on everything handed to it.
 *
 * Convention borrowed wholesale from lib/claims/capability-claims.test.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkTenantReachability,
  checkSystemContextBudget,
  computeTenantReachable,
  summariseReachability,
  type SchemaModelLike,
  type TenancyInput,
} from './tenant-reachability';
import {
  parseSchema,
  parseRlsTables,
  readMigrationSql,
  scanSystemContext,
  assertParserSaw,
} from './schema-graph';
import {
  applyTenancyRatchet,
  GLOBAL_TABLES,
  KNOWN_TENANCY_DRIFT,
  SYSTEM_CONTEXT_BUDGET,
} from './known-tenancy-drift';
import { formatTenancyViolations, formatCoverage } from './types';

const REPO_ROOT = process.cwd();
const ROOT_MODEL = 'Workspace';

/**
 * Floors re-measured 2026-08-31 against origin/main @ 5c03712.
 * These exist so a broken parser fails loudly instead of passing quietly.
 *
 * The floors themselves are unchanged; only the measured values beside them
 * moved, and the RLS one moved a long way. PR #467 (merged `f6e2b52`) took RLS
 * coverage from 52 tables to all 64 — every model in prisma/schema.prisma now
 * carries ENABLE + FORCE + at least one policy, which is why
 * KNOWN_TENANCY_DRIFT is empty below.
 */
const MODEL_FLOOR = 60; // 64 measured (unchanged)
const RLS_TABLE_FLOOR = 48; // 64 measured (was 52 at 4bc42b5, before #467)
const SOURCE_FILE_FLOOR = 1200; // 1,418 measured (was 1,474 at 4bc42b5)

function loadProduction(): TenancyInput {
  const schema = parseSchema(
    readFileSync(join(REPO_ROOT, 'prisma/schema.prisma'), 'utf8'),
  );
  const rlsTables = parseRlsTables(
    readMigrationSql(join(REPO_ROOT, 'prisma/migrations')),
  );

  assertParserSaw(schema.models.length, MODEL_FLOOR, 'Prisma models');
  assertParserSaw(rlsTables.size, RLS_TABLE_FLOOR, 'RLS-enabled tables');

  return {
    models: schema.models,
    rlsTables,
    declaredGlobal: GLOBAL_TABLES,
    rootModel: ROOT_MODEL,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Production assertions — the gate
// ─────────────────────────────────────────────────────────────────────────

describe('tenant isolation — production schema', () => {
  it('every table reachable from Workspace has row-level security, except accepted-and-dated debt', () => {
    const input = loadProduction();
    const report = checkTenantReachability(input);
    const ratchet = applyTenancyRatchet(report.violations, new Date());

    assert.equal(
      ratchet.unaccepted.length,
      0,
      `\nNEW tenant-isolation gap — a table reachable from ${ROOT_MODEL} has no RLS policy, ` +
        `or a table with no tenant path is undeclared:\n${formatTenancyViolations(ratchet.unaccepted)}\n\n` +
        `Coverage: ${formatCoverage(report.coverage)}\n\n` +
        `If this is deliberate, add a dated entry to KNOWN_TENANCY_DRIFT or GLOBAL_TABLES ` +
        `in lib/tenancy/known-tenancy-drift.ts. Do not delete this assertion.\n`,
    );
  });

  it('no accepted tenant-isolation debt has passed its expiry', () => {
    const input = loadProduction();
    const ratchet = applyTenancyRatchet(
      checkTenantReachability(input).violations,
      new Date(),
    );

    assert.equal(
      ratchet.expired.length,
      0,
      `\nAccepted tenant-isolation debt is past its expiry date and must now be fixed or ` +
        `re-argued with a new date:\n` +
        ratchet.expired
          .map((e) => `  • ${e.subject} (expired ${e.expires})\n      ${e.reason}`)
          .join('\n') +
        '\n',
    );
  });

  it('the accepted-debt list has not rotted — every entry still describes a real gap', () => {
    const input = loadProduction();
    const ratchet = applyTenancyRatchet(
      checkTenantReachability(input).violations,
      new Date(),
    );

    assert.equal(
      ratchet.stale.length,
      0,
      `\nKNOWN_TENANCY_DRIFT accepts violations that no longer occur. The gap was fixed and ` +
        `the acceptance was left behind, where it will silently suppress a future regression ` +
        `on the same table:\n` +
        ratchet.stale.map((e) => `  • ${e.subject} — remove this entry`).join('\n') +
        '\n',
    );
  });

  it('reports its coverage — the count is part of the result, not a footnote', () => {
    const input = loadProduction();
    const report = checkTenantReachability(input);
    const summary = summariseReachability(input);

    // The check must examine every model. A check that examines a subset and
    // reports success is the exact failure this standard replaces.
    assert.equal(
      report.coverage.examined,
      report.coverage.total,
      'the tenant-isolation check must examine every model in the schema',
    );
    assert.ok(
      report.coverage.total >= MODEL_FLOOR,
      `coverage total ${report.coverage.total} is below the recorded floor ${MODEL_FLOOR} — the parser is broken`,
    );
    assert.ok(
      report.coverage.blindTo.length >= 3,
      'the check must state what it cannot see; an empty blind-spot list is a claim of omniscience',
    );

    // Recorded so a reviewer sees the shape of the graph in the test output
    // rather than having to trust a sentence in a PR description.
    assert.ok(
      summary.reachable > 0 && summary.rlsProtected > 0,
      `implausible summary: ${JSON.stringify(summary)}`,
    );
  });

  it('every model with no tenant path is declared global, and no declaration is fiction', () => {
    const input = loadProduction();
    const reachable = computeTenantReachable(input.models, ROOT_MODEL);
    const tables = new Set(input.models.map((m) => m.table));

    for (const [table] of GLOBAL_TABLES) {
      assert.ok(
        tables.has(table),
        `GLOBAL_TABLES declares "${table}" but no model maps to that table — remove the entry`,
      );
      const model = input.models.find((m) => m.table === table)!;
      assert.ok(
        !reachable.has(model.model),
        `GLOBAL_TABLES declares "${table}" tenant-free, but ${model.model} reaches ${ROOT_MODEL} — it needs a policy, not a declaration`,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. The RLS bypass budget
// ─────────────────────────────────────────────────────────────────────────

describe('tenant isolation — withSystemContext bypass budget', () => {
  it('the operator-context bypass surface has not grown past its recorded budget', () => {
    const scan = scanSystemContext(REPO_ROOT);
    assertParserSaw(scan.filesScanned, SOURCE_FILE_FLOOR, 'source files');

    const report = checkSystemContextBudget({
      callSitesByFile: scan.callSitesByFile,
      budget: SYSTEM_CONTEXT_BUDGET,
      filesScanned: scan.filesScanned,
    });

    assert.equal(
      report.violations.length,
      0,
      `\n${formatTenancyViolations(report.violations)}\n\nCoverage: ${formatCoverage(report.coverage)}\n`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Deliberate-failure fixtures — proof each checker CAN fail
// ─────────────────────────────────────────────────────────────────────────

const WORKSPACE: SchemaModelLike = {
  model: 'Workspace',
  table: 'Workspace',
  fkTargets: [],
};

function fixture(models: SchemaModelLike[], rls: string[], global: [string, string][] = []): TenancyInput {
  return {
    models: [WORKSPACE, ...models],
    rlsTables: new Set(rls),
    declaredGlobal: new Map(global),
    rootModel: 'Workspace',
  };
}

describe('tenant isolation — deliberate failure fixtures', () => {
  it('fires on a directly-linked table with no RLS', () => {
    const v = checkTenantReachability(
      fixture([{ model: 'Leaky', table: 'Leaky', fkTargets: ['Workspace'] }], ['Workspace']),
    ).violations;

    assert.equal(v.length, 1);
    assert.equal(v[0].check, 'tenant-reachable-without-rls');
    assert.equal(v[0].subject, 'Leaky');
  });

  it('NEAR MISS: does not fire on the same table once RLS is enabled', () => {
    const v = checkTenantReachability(
      fixture([{ model: 'Leaky', table: 'Leaky', fkTargets: ['Workspace'] }], ['Workspace', 'Leaky']),
    ).violations;

    assert.deepEqual(v, [], 'checker fires on a protected table — it is not discriminating');
  });

  it('fires THREE HOPS OUT — this is the case the column-name test could not see', () => {
    // Mirrors PortalMessage -> PortalThread -> PortalConfig -> Workspace.
    // None of Deep/Mid carries a workspaceId column in this fixture, exactly
    // as PortalClient and PortalMessage do not in the real schema.
    const v = checkTenantReachability(
      fixture(
        [
          { model: 'Near', table: 'Near', fkTargets: ['Workspace'] },
          { model: 'Mid', table: 'Mid', fkTargets: ['Near'] },
          { model: 'Deep', table: 'Deep', fkTargets: ['Mid'] },
        ],
        ['Workspace', 'Near', 'Mid'],
      ).valueOf() as TenancyInput,
    ).violations;

    assert.equal(v.length, 1, 'the three-hop table must be flagged');
    assert.equal(v[0].subject, 'Deep');
  });

  it('NEAR MISS: an identically-deep table IS clean when the far end is unlinked', () => {
    const v = checkTenantReachability(
      fixture(
        [
          { model: 'Near', table: 'Near', fkTargets: [] }, // link to Workspace removed
          { model: 'Mid', table: 'Mid', fkTargets: ['Near'] },
          { model: 'Deep', table: 'Deep', fkTargets: ['Mid'] },
        ],
        ['Workspace'],
        [
          ['Near', 'fixture'],
          ['Mid', 'fixture'],
          ['Deep', 'fixture'],
        ],
      ),
    ).violations;

    assert.deepEqual(v, [], 'unlinked-and-declared tables must not be flagged as tenant leaks');
  });

  it('fires on an unclassified table with no tenant path — silence is not a pass', () => {
    const v = checkTenantReachability(
      fixture([{ model: 'Orphan', table: 'Orphan', fkTargets: [] }], ['Workspace']),
    ).violations;

    assert.equal(v.length, 1);
    assert.equal(v[0].check, 'undeclared-global-table');
    assert.equal(v[0].subject, 'Orphan');
  });

  it('NEAR MISS: the same orphan passes once it is declared global with a reason', () => {
    const v = checkTenantReachability(
      fixture(
        [{ model: 'Orphan', table: 'Orphan', fkTargets: [] }],
        ['Workspace'],
        [['Orphan', 'genuinely global in this fixture']],
      ),
    ).violations;

    assert.deepEqual(v, []);
  });

  it('fires when a global declaration is contradicted by a new foreign key', () => {
    const v = checkTenantReachability(
      fixture(
        [{ model: 'WasGlobal', table: 'WasGlobal', fkTargets: ['Workspace'] }],
        ['Workspace', 'WasGlobal'],
        [['WasGlobal', 'stale declaration']],
      ),
    ).violations;

    assert.equal(v.length, 1);
    assert.equal(v[0].check, 'stale-global-declaration');
  });

  it('terminates on a foreign-key cycle instead of hanging', () => {
    const v = checkTenantReachability(
      fixture(
        [
          { model: 'A', table: 'A', fkTargets: ['B'] },
          { model: 'B', table: 'B', fkTargets: ['A'] },
        ],
        ['Workspace'],
        [
          ['A', 'cycle fixture'],
          ['B', 'cycle fixture'],
        ],
      ),
    ).violations;

    assert.deepEqual(v, [], 'a pure cycle reaches no root and both nodes are declared');
  });

  it('fires when the bypass budget is exceeded, and not when it is met exactly', () => {
    const over = checkSystemContextBudget({
      callSitesByFile: new Map([['a.ts', 3], ['b.ts', 1]]),
      budget: 3,
      filesScanned: 10,
    });
    assert.equal(over.violations.length, 1);
    assert.equal(over.violations[0].check, 'system-context-budget');

    const exact = checkSystemContextBudget({
      callSitesByFile: new Map([['a.ts', 3], ['b.ts', 1]]),
      budget: 4,
      filesScanned: 10,
    });
    assert.deepEqual(exact.violations, [], 'budget met exactly must pass');
  });

  it('the ratchet expires accepted debt on the day after its expiry', () => {
    const violation = {
      check: 'tenant-reachable-without-rls' as const,
      subject: 'PortalMessage',
      detail: 'fixture',
      remedy: 'fixture',
    };
    const known = [
      {
        check: 'tenant-reachable-without-rls' as const,
        subject: 'PortalMessage',
        reason: 'fixture',
        expires: '2026-11-09',
      },
    ];

    const before = applyTenancyRatchet([violation], new Date('2026-11-08'), known);
    assert.deepEqual(before.unaccepted, []);
    assert.deepEqual(before.expired, []);

    const after = applyTenancyRatchet([violation], new Date('2026-11-10'), known);
    assert.equal(after.expired.length, 1, 'expired debt must fail the gate');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Blindness assertions — proof the parser read something
// ─────────────────────────────────────────────────────────────────────────

describe('tenant isolation — the parser is not blind', () => {
  it('assertParserSaw throws when the parse comes back empty', () => {
    assert.throws(
      () => assertParserSaw(0, 60, 'Prisma models'),
      /broken parser/,
      'an empty parse must be an error, not a pass',
    );
  });

  it('the real schema parse clears its recorded floors', () => {
    const input = loadProduction();
    assert.ok(input.models.length >= MODEL_FLOOR);
    assert.ok(input.rlsTables.size >= RLS_TABLE_FLOOR);
  });

  it('the parser resolves a known multi-hop chain in the real schema', () => {
    // If the @relation regex breaks, fkTargets go empty, nothing is reachable,
    // and every assertion above passes vacuously. This pins one real chain.
    const input = loadProduction();
    const byName = new Map(input.models.map((m) => [m.model, m]));
    const portalMessage = byName.get('PortalMessage');
    assert.ok(portalMessage, 'PortalMessage missing from the parse');
    assert.ok(
      portalMessage!.fkTargets.includes('PortalThread'),
      `PortalMessage should hold an FK to PortalThread; parsed [${portalMessage!.fkTargets.join(', ')}]`,
    );
    assert.ok(
      computeTenantReachable(input.models, ROOT_MODEL).has('PortalMessage'),
      'PortalMessage must resolve as tenant-reachable through the FK chain',
    );
  });

  it('the accepted-debt list is itemized, reasoned and dated — no wildcards', () => {
    // KNOWN_TENANCY_DRIFT is EMPTY as of 2026-08-31 and that is the correct
    // state: PR #467 (merged `f6e2b52`) closed all ten entries it used to
    // carry. This assertion previously read `KNOWN_TENANCY_DRIFT.length > 0`,
    // which now fails.
    //
    // It is REPLACED rather than deleted. The `> 0` was load-bearing: a shape
    // check that loops over an empty array passes without examining anything,
    // and "found nothing wrong" then becomes indistinguishable from "looked at
    // nothing" — the exact blind spot this whole file exists to close, and one
    // this repo has shipped before. So the non-vacuity requirement stays; it
    // just moves off the drift list, which is legitimately empty, and onto the
    // things that must never be empty.
    let examined = 0;
    for (const e of KNOWN_TENANCY_DRIFT) {
      examined += 1;
      assert.ok(e.subject.length > 0 && !e.subject.includes('*'), `wildcard subject: ${e.subject}`);
      assert.ok(e.reason.length > 40, `reason too thin to be a decision: ${e.subject}`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(e.expires), `bad expiry on ${e.subject}`);
    }
    assert.equal(
      examined,
      KNOWN_TENANCY_DRIFT.length,
      'the shape loop did not visit every accepted entry — this check is not seeing what it claims to',
    );

    // GLOBAL_TABLES must never be empty. Every model with no FK path to
    // Workspace has to be declared here, and the schema does contain such
    // models (User, Inquiry, the outreach pair, ...). An empty map would mean
    // the register had been emptied or the import had broken, and the loop
    // below would then pass having classified nothing.
    assert.ok(
      GLOBAL_TABLES.size > 0,
      'GLOBAL_TABLES is empty — the classification loop below would pass without examining anything',
    );
    let classified = 0;
    for (const [table, reason] of GLOBAL_TABLES) {
      classified += 1;
      assert.ok(reason.length > 40, `GLOBAL_TABLES["${table}"] needs a real reason, not a label`);
    }
    assert.equal(classified, GLOBAL_TABLES.size, 'the global-table loop did not visit every declaration');
  });
});
