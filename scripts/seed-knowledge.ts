/**
 * scripts/seed-knowledge.ts
 *
 * Seed the knowledge substrate with the SKILL / VERTICAL / COMPLIANCE
 * corpora defined in `lib/knowledge/seed-data.ts`.
 *
 * Idempotent — re-running updates rows in place (sourceType + sourceId
 * form the natural key). Customer + cross-customer remain empty;
 * customers seed their own knowledge on tool connect, and cross-customer
 * patterns derive offline.
 *
 * Run:
 *   npx tsx scripts/seed-knowledge.ts
 *
 * Env requirements:
 *   * `DATABASE_URL` (any connection — pool or direct works for seeds)
 *   * `OPENAI_API_KEY` (production embedding) OR set
 *     `KNOWLEDGE_EMBEDDING_PROVIDER=test` to seed with the deterministic
 *     test embedder (handy for preview branches without a paid OpenAI key).
 *
 * Cost (production embedder, text-embedding-3-small @ $0.02/1M tokens):
 *   ~60 docs × ~500 tokens each ≈ 30k tokens ≈ $0.0006 per full re-seed.
 */

import { buildSeedAssembly } from '@/lib/knowledge/seed-data';
import { getEmbeddingProvider, getKnowledgeStore } from '@/lib/knowledge';
import type { KnowledgeUpsertInput } from '@/lib/knowledge/types';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db/rls';

interface PerKindCount {
  attempted: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

async function seedBucket(
  label: string,
  rows: KnowledgeUpsertInput[],
): Promise<PerKindCount> {
  const counts: PerKindCount = { attempted: 0, created: 0, updated: 0, failed: 0, errors: [] };
  const store = getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
  for (const row of rows) {
    counts.attempted += 1;
    const res = await store.upsert(row);
    if (!res.ok) {
      counts.failed += 1;
      counts.errors.push(`${row.sourceId ?? row.title}: [${res.error.code}] ${res.error.message}`);
      continue;
    }
    if (res.value.created) counts.created += 1;
    else counts.updated += 1;
  }
  console.log(
    `  ${label.padEnd(12)} attempted=${counts.attempted} created=${counts.created} updated=${counts.updated} failed=${counts.failed}`,
  );
  if (counts.errors.length > 0) {
    for (const e of counts.errors) console.log(`    ! ${e}`);
  }
  return counts;
}

async function main() {
  const embedder = getEmbeddingProvider();
  console.log(`Embedder: ${embedder.name} (model=${embedder.model}, dim=${embedder.dimensions})`);

  const assembly = buildSeedAssembly();
  console.log(
    `Plan: SKILL=${assembly.skill.length} VERTICAL=${assembly.vertical.length} COMPLIANCE=${assembly.compliance.length} CROSS_CUSTOMER=${assembly.crossCustomer.length}`,
  );
  console.log(
    `Compliance corpus: ${assembly.diagnostics.skippedUnverifiedCompliance} unverified entries skipped (placeholder text — counsel red-line gates them in).`,
  );
  for (const [slug, count] of Object.entries(assembly.diagnostics.verifiedComplianceByVertical)) {
    const skipped = assembly.diagnostics.unverifiedComplianceByVertical[slug] ?? 0;
    console.log(`    ${slug.padEnd(20)} verified=${count}  skipped=${skipped}`);
  }

  const start = Date.now();
  const skillCounts = await seedBucket('SKILL', assembly.skill);
  const verticalCounts = await seedBucket('VERTICAL', assembly.vertical);
  const complianceCounts = await seedBucket('COMPLIANCE', assembly.compliance);
  const crossCustomerCounts = await seedBucket('CROSS_CUSTOMER', assembly.crossCustomer);
  const elapsed = Date.now() - start;

  const totalFailed =
    skillCounts.failed +
    verticalCounts.failed +
    complianceCounts.failed +
    crossCustomerCounts.failed;
  console.log(
    `\nDone in ${elapsed}ms. Total failures: ${totalFailed}. ` +
      `Customer empty (intentional — fills on tool connect).`,
  );
  if (totalFailed > 0) {
    console.error(
      'Seed completed with failures — see error lines above. Exiting with non-zero status.',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('seed-knowledge: uncaught', err);
  process.exit(1);
});
