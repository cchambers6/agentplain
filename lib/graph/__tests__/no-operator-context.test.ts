/**
 * lib/graph/__tests__/no-operator-context.test.ts
 *
 * SOURCE INVARIANT (runs anywhere, no DB): nothing under lib/graph/ may
 * reach for the operator identity.
 *
 * WHY THIS IS A TEST AND NOT A CODE REVIEW NOTE
 *
 *   `PrismaLedgerFetcher` and `PrismaConflictApprovalSink` both open
 *   their RLS transaction with the operator flag set. For those two it is
 *   arguably load-bearing - they run from a sweep with no session. But
 *   that flag is the context that bypasses workspace isolation, and the
 *   entity graph is per-customer data with an explicit `tenantId` on
 *   every single call. There is no operation in this layer that
 *   legitimately needs to see across tenants, so the copy-paste that
 *   would put one there needs to fail loudly rather than review-slowly.
 *
 *   (This comment deliberately does not spell either needle out. The
 *   first draft did, and the self-coverage assertion below caught it -
 *   which is the assertion doing its job, so it stays.)
 *
 *   Modelled on tests/rls-memory-scale-isolation.test.ts layer A: read
 *   the source, assert the invariant over it, and make the check itself
 *   testable so it cannot be green over nothing.
 *
 * WHY THE NEEDLES ARE BUILT FROM PIECES
 *
 *   If the forbidden strings appeared as literals in this file, this file
 *   would match its own scan, and the usual fix - excluding the scanner
 *   from the scan - opens a hole exactly where someone would hide
 *   something. Assembling the needles at runtime lets the scan cover
 *   every file under lib/graph/ INCLUDING this one.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** lib/graph - the directory this invariant covers. */
const GRAPH_DIR = path.resolve(__dirname, '..');

/**
 * Forbidden patterns, assembled so no literal occurrence exists in this
 * file. `\s*` around the colon so a reformat cannot slip one past.
 */
const FORBIDDEN: ReadonlyArray<{ label: string; re: RegExp }> = [
  {
    label: ['with', 'SystemContext'].join(''),
    re: new RegExp(['with', 'SystemContext'].join('')),
  },
  {
    label: ['isOperator', ': true'].join(''),
    re: new RegExp(['isOperator', '\\s*:\\s*true'].join('')),
  },
];

interface SourceFile {
  relPath: string;
  text: string;
}

async function readGraphSources(dir = GRAPH_DIR): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await readGraphSources(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    out.push({
      relPath: path.relative(GRAPH_DIR, full).split(path.sep).join('/'),
      text: await fs.readFile(full, 'utf8'),
    });
  }
  return out;
}

describe('lib/graph - no operator context', () => {
  it('the scan actually reads files (a green run over an empty set is a failure)', async () => {
    const files = await readGraphSources();
    assert.ok(
      files.length >= 7,
      `expected the lib/graph sources, found ${files.length}`,
    );
    const names = files.map((f) => f.relPath).sort();
    for (const expected of [
      'apply.ts',
      'normalize.ts',
      'projections.ts',
      'provenance.ts',
      'store.ts',
      'types.ts',
      '__tests__/no-operator-context.test.ts',
      '__tests__/party-graph-slice.test.ts',
    ]) {
      assert.ok(names.includes(expected), `scan missed ${expected}`);
    }
  });

  it('the matcher catches what it claims to catch', () => {
    // If the needles were corrupted in transit the file scan would report
    // clean over a real violation. Prove the patterns work on synthetic
    // text before trusting them on the real text.
    const bad = [
      'await ' + ['with', 'SystemContext'].join('') + '(async (tx) => {});',
      'const ctx = { ' + ['isOperator', ': true'].join('') + ' };',
      'const ctx = { ' + ['isOperator', ' :  true'].join('') + ' };',
    ];
    for (const sample of bad) {
      assert.ok(
        FORBIDDEN.some((f) => f.re.test(sample)),
        `matcher missed: ${sample}`,
      );
    }
    const good = 'const ctx = { tenantId, isOperator: false };';
    assert.ok(!FORBIDDEN.some((f) => f.re.test(good)));
  });

  it('no file under lib/graph reaches for the operator identity', async () => {
    const files = await readGraphSources();
    const violations: string[] = [];
    for (const file of files) {
      for (const forbidden of FORBIDDEN) {
        if (forbidden.re.test(file.text)) {
          violations.push(`${file.relPath}: ${forbidden.label}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      `lib/graph must scope every read and write by tenantId. Found: ${violations.join(', ')}`,
    );
  });

  it('covers itself - the scanner is inside the scanned set', async () => {
    const files = await readGraphSources();
    const self = files.find(
      (f) => f.relPath === '__tests__/no-operator-context.test.ts',
    );
    assert.ok(self, 'this file must be in its own scan');
    // Belt and braces: prove the needles are absent as literals here, so
    // the previous assertion passing is a fact about lib/graph and not an
    // artifact of this file being skipped.
    for (const forbidden of FORBIDDEN) {
      assert.equal(forbidden.re.test(self.text), false);
    }
  });
});
