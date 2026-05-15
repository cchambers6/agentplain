/**
 * scripts/inspect-knowledge-substrate.ts
 *
 * Read-only inspection of the live knowledge substrate. Reports:
 *
 *   - row count by ContextKind
 *   - distinct sourceType values + their per-kind counts
 *   - distinct verticalSlug values for VERTICAL/COMPLIANCE rows
 *   - top sourceTypes for each kind (so you can see whether the latest
 *     re-seed has landed)
 *
 * Backs `feedback_persistence_discipline.md` — every claim of "indexed"
 * needs a SELECT count behind it.
 *
 * Run:
 *   npx tsx scripts/inspect-knowledge-substrate.ts
 *
 * Requires DATABASE_URL pointing at the live Postgres. Read-only — uses
 * the Prisma client directly (bypassing RLS context, which is fine for
 * operator-side inspection).
 */

import { PrismaClient } from '@prisma/client';

interface CountRow {
  contextkind: string;
  sourcetype: string;
  n: bigint;
}

interface VerticalRow {
  contextkind: string;
  verticalslug: string | null;
  n: bigint;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rowCounts = await prisma.$queryRawUnsafe<CountRow[]>(
      `SELECT
         "contextKind"::text AS contextkind,
         "sourceType"          AS sourcetype,
         count(*)              AS n
       FROM "Embedding"
       GROUP BY "contextKind", "sourceType"
       ORDER BY "contextKind", "sourceType"`,
    );

    const totals: Record<string, number> = {};
    console.log(`\n--- Embedding rows by (contextKind, sourceType) ---`);
    for (const r of rowCounts) {
      const n = Number(r.n);
      totals[r.contextkind] = (totals[r.contextkind] ?? 0) + n;
      console.log(`  ${r.contextkind.padEnd(15)} ${r.sourcetype.padEnd(28)} ${n}`);
    }

    console.log(`\n--- Totals by ContextKind ---`);
    for (const k of ['SKILL', 'CUSTOMER', 'VERTICAL', 'CROSS_CUSTOMER', 'COMPLIANCE']) {
      console.log(`  ${k.padEnd(15)} ${totals[k] ?? 0}`);
    }
    const grand = Object.values(totals).reduce((a, b) => a + b, 0);
    console.log(`  ${'TOTAL'.padEnd(15)} ${grand}`);

    const verticalRows = await prisma.$queryRawUnsafe<VerticalRow[]>(
      `SELECT
         d."contextKind"::text AS contextkind,
         d."verticalSlug"      AS verticalslug,
         count(e.id)           AS n
       FROM "KnowledgeDocument" d
       LEFT JOIN "Embedding" e ON e."documentId" = d.id
       WHERE d."contextKind" IN ('VERTICAL', 'COMPLIANCE')
       GROUP BY d."contextKind", d."verticalSlug"
       ORDER BY d."contextKind", d."verticalSlug"`,
    );
    console.log(`\n--- VERTICAL / COMPLIANCE coverage by verticalSlug ---`);
    for (const r of verticalRows) {
      console.log(
        `  ${r.contextkind.padEnd(12)} ${(r.verticalslug ?? '(null)').padEnd(22)} ${Number(r.n)}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('inspect-knowledge-substrate: uncaught', err);
  process.exit(1);
});
