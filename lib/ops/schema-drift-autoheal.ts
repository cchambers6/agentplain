/**
 * lib/ops/schema-drift-autoheal.ts
 *
 * Wave-7 schema-drift auto-heal — solves pride theme #19 (kill the
 * `HUSKY=0` jailbreak for raw-SQL index migrations).
 *
 * ── The problem this exists to remove ──
 * GIN/trgm + pgvector indexes are created via raw SQL in a migration
 * (`CREATE INDEX ... USING gin (... gin_trgm_ops)`), because Prisma's
 * schema language has no representation for those index types. The result:
 * `prisma migrate diff` reports the index as drift (it appears in the DB /
 * migrations but not in `schema.prisma`), surfacing as a `DROP INDEX "..."`
 * line in the diff. `check-schema-drift` then fails because that line isn't
 * in `prisma/schema-drift-baseline.sql`. The documented manual fix
 * (`project_schema_drift_baseline_for_raw_indexes`) is to append the
 * `DROP INDEX` line to the baseline — but until someone does that by hand,
 * the only way to land the migration is the `HUSKY=0` bypass, which is
 * exactly the jailbreak that lets *un-baselined* drift slip through.
 *
 * ── The narrow, safe fix ──
 * This module auto-heals ONLY the known raw-index pattern: when the current
 * diff differs from the baseline solely by ADDED `-- DropIndex` /
 * `DROP INDEX "..."` statement pairs (the exact shape a new raw index
 * produces), it computes the healed baseline with those pairs inserted into
 * the baseline's existing DropIndex section.
 *
 * It deliberately does NOT heal anything else. If the diff has ANY other
 * new statement (a forgotten `ALTER TABLE`, a dropped column, a renamed
 * index, a REMOVED DropIndex line, etc.), `analyzeDrift` returns
 * `kind: 'unhealable'` and the caller fails loudly — the drift gate stays
 * as strict as before. We never weaken the check; we only automate the one
 * append the docs already prescribe.
 *
 * Idempotent: re-running against an already-healed baseline returns
 * `kind: 'clean'` (current === baseline) — no duplicate DROP INDEX lines.
 *
 * Pure + dependency-free so it unit-tests without a shadow Postgres: the
 * `check-schema-drift.ts` script supplies the two normalized SQL strings.
 */

/** One raw-index drop the diff wants but the baseline lacks. */
export interface DropIndexStatement {
  /** The index name inside the quotes, e.g. `Foo_bar_trgm_idx`. */
  indexName: string;
  /** The exact two-line block: `-- DropIndex\nDROP INDEX "<name>";`. */
  block: string;
}

export type DriftAnalysis =
  | { kind: 'clean' }
  | {
      kind: 'healable';
      /** The DropIndex pairs to add to the baseline. */
      added: DropIndexStatement[];
      /** The new baseline content (normalized, trailing newline). */
      healedBaseline: string;
    }
  | {
      kind: 'unhealable';
      /** Human-readable reason the diff can't be auto-healed. */
      reason: string;
    };

/**
 * A single logical statement parsed from normalized Prisma diff SQL. Prisma
 * emits each statement as a `-- <Marker>` comment line followed by one or
 * more SQL lines, separated by blank lines. We group on the marker lines.
 */
interface SqlStatement {
  /** The `-- DropIndex` style marker (without the leading `-- `). */
  marker: string;
  /** Full normalized text of the statement block (marker + body), no
   *  trailing newline. */
  text: string;
  /** SQL body lines (everything after the marker line). */
  body: string[];
}

/**
 * Split normalized diff SQL into statement blocks. A block starts at a
 * `-- <Marker>` line and runs until the next marker line (blank lines
 * between blocks are dropped). Lines before the first marker (there should
 * be none in Prisma output) are ignored.
 */
export function parseStatements(normalizedSql: string): SqlStatement[] {
  const lines = normalizedSql.split('\n');
  const statements: SqlStatement[] = [];
  let current: SqlStatement | null = null;

  for (const raw of lines) {
    const line = raw;
    const markerMatch = /^-- (.+)$/.exec(line.trim());
    if (markerMatch) {
      if (current) statements.push(finalize(current));
      current = { marker: markerMatch[1], text: line.trim(), body: [] };
      continue;
    }
    if (line.trim() === '') continue; // drop inter-block blanks
    if (current) {
      current.body.push(line);
      current.text += `\n${line}`;
    }
    // A non-marker, non-blank line before any marker is malformed Prisma
    // output; ignore it rather than guess.
  }
  if (current) statements.push(finalize(current));
  return statements;
}

function finalize(s: SqlStatement): SqlStatement {
  return s;
}

/** Stable identity for a statement so we can set-difference baseline vs
 *  current. Uses the full normalized text (marker + body). */
function statementKey(s: SqlStatement): string {
  return s.text;
}

const DROP_INDEX_BODY = /^DROP INDEX "([^"]+)";$/;

/**
 * Analyze the difference between the current diff and the checked-in
 * baseline.
 *
 *   - `clean`      — current === baseline (incl. an already-healed baseline,
 *     so this is the idempotent re-run path).
 *   - `healable`   — the ONLY difference is added DropIndex pairs. Returns
 *     the healed baseline with them inserted into the DropIndex section.
 *   - `unhealable` — anything else (other added statements, or any removed
 *     statement). The caller must fail loudly.
 */
export function analyzeDrift(
  currentNorm: string,
  baselineNorm: string,
): DriftAnalysis {
  if (currentNorm === baselineNorm) {
    return { kind: 'clean' };
  }

  const currentStmts = parseStatements(currentNorm);
  const baselineStmts = parseStatements(baselineNorm);

  const baselineKeys = new Set(baselineStmts.map(statementKey));
  const currentKeys = new Set(currentStmts.map(statementKey));

  // Removed statements (in baseline, not in current) are NEVER auto-healable
  // — that means a piece of intentional drift disappeared, which is a real
  // schema change the operator must reconcile by hand.
  const removed = baselineStmts.filter((s) => !currentKeys.has(statementKey(s)));
  if (removed.length > 0) {
    return {
      kind: 'unhealable',
      reason:
        `Baseline statements vanished from the current diff (${removed.length}): ` +
        removed.map((s) => s.marker).join(', ') +
        '. This is a real schema change — reconcile by hand, do not auto-heal.',
    };
  }

  // Added statements (in current, not in baseline). For auto-heal, EVERY
  // added statement must be a `-- DropIndex` / `DROP INDEX "..."` pair.
  const added = currentStmts.filter((s) => !baselineKeys.has(statementKey(s)));
  if (added.length === 0) {
    // Same statement set but different normalized text — ordering or some
    // other non-statement difference. Don't guess; fail loud.
    return {
      kind: 'unhealable',
      reason:
        'Diff differs from baseline but no statements were added or removed ' +
        '(likely a reordering or formatting change). Reconcile by hand.',
    };
  }

  const nonDropIndex = added.filter(
    (s) =>
      s.marker !== 'DropIndex' ||
      s.body.length !== 1 ||
      !DROP_INDEX_BODY.test(s.body[0].trim()),
  );
  if (nonDropIndex.length > 0) {
    return {
      kind: 'unhealable',
      reason:
        `Diff adds ${nonDropIndex.length} non-DropIndex statement(s): ` +
        nonDropIndex.map((s) => s.marker).join(', ') +
        '. Only raw-index DROP INDEX drift is auto-healable — fail loud.',
    };
  }

  const addedDrops: DropIndexStatement[] = added.map((s) => {
    const m = DROP_INDEX_BODY.exec(s.body[0].trim());
    return {
      indexName: m ? m[1] : '<unknown>',
      block: `-- DropIndex\n${s.body[0].trim()}`,
    };
  });

  // The healed baseline IS the current diff verbatim. Because the ONLY
  // difference is added DropIndex pairs (nothing removed, nothing else
  // added), the current normalized diff is by construction the correct
  // new baseline — and using it guarantees a byte-exact re-verify (the
  // gate's compare is `currentNorm === baselineNorm`). This also makes the
  // heal idempotent: a re-run sees `currentNorm === baselineNorm` → clean.
  // We keep `insertDropIndexBlocks` exported + tested for callers that want
  // to splice into an arbitrary baseline, but the gate path uses the exact
  // diff so it can never drift from Prisma's own statement ordering.
  return { kind: 'healable', added: addedDrops, healedBaseline: currentNorm };
}

/**
 * Insert new DropIndex blocks into the baseline.
 *
 * Strategy: keep it append-at-end-of-DropIndex-section deterministic. The
 * baseline groups its DropIndex statements together (lines 88-101 today).
 * We insert the new blocks immediately AFTER the last existing
 * `DROP INDEX "...";` line. If the baseline has no DropIndex section yet,
 * we append the blocks at the very end (still valid — order of unrelated
 * statements in the baseline doesn't affect the byte-equal compare because
 * the same order is produced by `prisma migrate diff` on the next run; the
 * regen-from-scratch path via `--update-baseline` remains the canonical
 * ordering source). The result is re-normalized by the caller's compare.
 */
export function insertDropIndexBlocks(
  baselineNorm: string,
  blocks: DropIndexStatement[],
): string {
  if (blocks.length === 0) return baselineNorm;

  // De-dupe against any DROP INDEX already present (idempotency guard) and
  // against duplicates within the incoming set.
  const seen = new Set<string>();
  const existing = new Set(
    [...baselineNorm.matchAll(/^DROP INDEX "([^"]+)";$/gm)].map((m) => m[1]),
  );
  const toAdd = blocks.filter((b) => {
    if (existing.has(b.indexName) || seen.has(b.indexName)) return false;
    seen.add(b.indexName);
    return true;
  });
  if (toAdd.length === 0) return baselineNorm;

  const addition = toAdd.map((b) => b.block).join('\n\n');

  const lines = baselineNorm.split('\n');
  // Find the index of the LAST `DROP INDEX "...";` line.
  let lastDropLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^DROP INDEX "[^"]+";$/.test(lines[i].trim())) lastDropLine = i;
  }

  if (lastDropLine === -1) {
    // No DropIndex section — append at end.
    const trimmed = baselineNorm.replace(/\n+$/, '');
    return `${trimmed}\n\n${addition}\n`;
  }

  // Insert after the last DROP INDEX line, with a blank-line separator.
  const before = lines.slice(0, lastDropLine + 1).join('\n');
  const after = lines.slice(lastDropLine + 1).join('\n');
  const stitched = `${before}\n\n${addition}${after ? `\n${after}` : ''}`;
  // Ensure a single trailing newline.
  return stitched.replace(/\n+$/, '') + '\n';
}
