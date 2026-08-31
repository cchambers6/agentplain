/**
 * lib/tenancy/schema-graph.ts
 *
 * The impure half: turns `prisma/schema.prisma` and `prisma/migrations/**` into
 * the plain data `tenant-reachability.ts` consumes.
 *
 * Kept separate from the checkers on purpose. The checkers have to be callable
 * with synthetic fixtures to prove they can fail; a checker that reads the
 * filesystem itself can only ever be run against reality, and a check that has
 * only ever been run against a passing input has never been shown to work.
 *
 * Parsing is textual rather than via `@prisma/internals` because this must run
 * in the same fast, dependency-light lane as the other gates. The parser is
 * therefore the weakest link in the standard, which is why the coverage report
 * names it and why `assertParserSaw()` below refuses to let a silently-empty
 * parse read as a clean bill of health.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { SchemaModelLike } from './tenant-reachability';

export interface ParsedSchema {
  models: SchemaModelLike[];
  /** Models keyed by name, for callers that want to inspect the graph. */
  byName: Map<string, SchemaModelLike>;
}

const MODEL_RE = /^model\s+(\w+)\s*\{/;
const MAP_RE = /@@map\("([^"]+)"\)/;
/**
 * Owning-side relation. Matches `field  Target  @relation(fields: [x], ...)`
 * and its optional/`?` form. The `fields:` clause is what distinguishes the
 * side that HOLDS the foreign key from the back-relation list, and only the
 * holding side is an edge for reachability.
 */
const OWNING_RELATION_RE =
  /^\s*\w+\s+(\w+)\??\s+@relation\((?=[^)]*\bfields\s*:)/;

export function parseSchema(schemaText: string): ParsedSchema {
  const lines = schemaText.split(/\r?\n/);
  const models: SchemaModelLike[] = [];

  let current: { model: string; table: string; fkTargets: string[] } | null =
    null;

  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '');

    const start = MODEL_RE.exec(line);
    if (start) {
      current = { model: start[1], table: start[1], fkTargets: [] };
      continue;
    }
    if (!current) continue;

    if (/^\}/.test(line)) {
      models.push({
        model: current.model,
        table: current.table,
        fkTargets: [...new Set(current.fkTargets)],
      });
      current = null;
      continue;
    }

    const mapped = MAP_RE.exec(line);
    if (mapped) {
      current.table = mapped[1];
      continue;
    }

    const rel = OWNING_RELATION_RE.exec(line);
    if (rel) current.fkTargets.push(rel[1]);
  }

  return { models, byName: new Map(models.map((m) => [m.model, m])) };
}

const RLS_RE =
  /ALTER\s+TABLE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+(?:ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY/gi;

/** Tables named by an ENABLE/FORCE ROW LEVEL SECURITY statement in any migration. */
export function parseRlsTables(migrationSqlTexts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const sql of migrationSqlTexts) {
    for (const m of sql.matchAll(RLS_RE)) out.add(m[1]);
  }
  return out;
}

export function readMigrationSql(migrationsDir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(migrationsDir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const dir = join(migrationsDir, entry);
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    try {
      out.push(readFileSync(join(dir, 'migration.sql'), 'utf8'));
    } catch {
      // A migration directory without a migration.sql is not a parse failure.
    }
  }
  return out;
}

const SYSTEM_CONTEXT_RE = /withSystemContext\s*\(/g;

/**
 * Strip `//` and block comments before counting.
 *
 * Without this the scanner counts prose. It found that out the hard way: the
 * first run of the budget check failed at 376/375 because THIS module and its
 * sibling `known-tenancy-drift.ts` mention `withSystemContext()` in their own
 * doc comments. A checker that counts its own documentation as evidence is the
 * same defect as a guard test that compares a module against itself — it
 * measures the observer, not the system. Comments are stripped, and
 * `lib/tenancy` is excluded from its own scan.
 *
 * Deliberately naive: this is not a lexer, and a `//` inside a string literal
 * will truncate that line. That is acceptable for counting call sites (it can
 * only ever undercount a line that also contains a real call, which the
 * budget's own regression test would surface) and is named in the blind-spot
 * list rather than left implicit.
 */
export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export interface SystemContextScan {
  callSitesByFile: Map<string, number>;
  filesScanned: number;
}

/**
 * The directories that are actually shipped source. Everything else in the
 * checkout is out of scope.
 *
 * This is an ALLOWLIST rather than a denylist, and that choice is the whole
 * point. The first version of this scanner denied `node_modules` and `.next`
 * and walked the rest of the checkout — which on a working machine contains
 * ~25 sibling worktree directories (`agentplain-*`, `wt-*`) each holding a
 * full copy of the repo. It reported 11,242 call sites across 42,629 files,
 * a number roughly 25x the truth, and it would have been just as confidently
 * wrong in the other direction on a clean CI checkout where those directories
 * do not exist. A budget that reads differently on two machines is not a
 * budget. An allowlist cannot drift that way: an unlisted directory is not
 * scanned, and a new top-level source directory has to be added here on
 * purpose (which `assertParserSaw` will demand, loudly, if it is forgotten).
 */
export const SOURCE_ROOTS: readonly string[] = [
  'app',
  'lib',
  'components',
  'scripts',
  'tools',
  'chiron',
  'inngest',
  'middleware.ts',
];

/**
 * Count `withSystemContext(` call sites across the declared source roots.
 *
 * Excludes the definition site (`lib/db/rls.ts`) and tests. Tests are excluded
 * because a test that exercises the bypass is not a production bypass, and
 * counting them would make the budget rise every time somebody adds coverage —
 * punishing exactly the behaviour the budget exists to encourage.
 */
export function scanSystemContext(
  rootDir: string,
  opts: { exclude?: readonly RegExp[]; roots?: readonly string[] } = {},
): SystemContextScan {
  const exclude = opts.exclude ?? [
    /node_modules/,
    /[\\/]\.next[\\/]/,
    /[\\/]\.git[\\/]/,
    /[\\/]lib[\\/]db[\\/]rls\.ts$/,
    // The checker must not count itself. See stripComments() above.
    /[\\/]lib[\\/]tenancy[\\/]/,
    /\.test\.tsx?$/,
    /[\\/]__tests__[\\/]/,
  ];
  const roots = opts.roots ?? SOURCE_ROOTS;

  const callSitesByFile = new Map<string, number>();
  let filesScanned = 0;

  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (exclude.some((re) => re.test(full))) continue;
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      filesScanned += 1;
      let text: string;
      try {
        text = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const n = [...stripComments(text).matchAll(SYSTEM_CONTEXT_RE)].length;
      if (n > 0) {
        callSitesByFile.set(full.slice(rootDir.length + 1).replace(/\\/g, '/'), n);
      }
    }
  };

  for (const r of roots) walk(join(rootDir, r));
  return { callSitesByFile, filesScanned };
}

/**
 * Refuse to let an empty parse read as a clean result.
 *
 * This is the specific way this standard would go blind: a Prisma syntax
 * change, a moved file, or a bad regex makes the parser return zero models,
 * every downstream loop iterates nothing, and the gate goes green over a
 * schema it never read. `parsedCount` is asserted against a floor recorded
 * when the standard was written, so the parser breaking is a loud failure
 * rather than a silent pass.
 */
export function assertParserSaw(
  parsedCount: number,
  floor: number,
  what: string,
): void {
  if (parsedCount < floor) {
    throw new Error(
      `tenancy parser saw only ${parsedCount} ${what}, below the recorded floor of ${floor}. ` +
        `This is a broken parser, not a clean schema — a check that reads nothing passes everything. ` +
        `Fix the parser in lib/tenancy/schema-graph.ts, or lower the floor deliberately if ${what} really were removed.`,
    );
  }
}
