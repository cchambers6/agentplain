/**
 * scripts/verify-knowledge-seed.ts
 *
 * Ad-hoc verification: assemble the seed corpus, write it to the
 * in-memory test store, and run a battery of sample queries. Prints
 * top-3 results + similarity scores per query so the per-query coverage
 * of the substrate is visible at a glance.
 *
 * Run:
 *   KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test \
 *     npx tsx scripts/verify-knowledge-seed.ts
 *
 * Distinct from `scripts/seed-knowledge.ts` (which writes to whichever
 * store env points at — pgvector for prod). This script always uses the
 * test store + deterministic embedder so it's safe to run anywhere with
 * no DB and no OPENAI_API_KEY.
 *
 * Per `feedback_persistence_discipline.md`: every claim of "indexed" in
 * the human-readable refresh report needs a SELECT count behind it. For
 * the prod DB that's a SQL query; for this verification it's a search()
 * call against the same pipeline the prod store uses.
 */

import { TestEmbeddingProvider, TestKnowledgeStore } from '@/lib/knowledge';
import { TEST_OPERATOR_CONTEXT } from '@/lib/knowledge/test-store';
import { buildSeedAssembly } from '@/lib/knowledge/seed-data';
import type { ContextKind } from '@/lib/knowledge/types';

interface SampleQuery {
  label: string;
  query: string;
  contextKinds?: ContextKind[];
  verticalSlug?: string;
  /** A case-insensitive substring expected to appear in the top-1 hit's title. */
  expectedTitleContains?: string;
}

const QUERIES: SampleQuery[] = [
  {
    label: 'CPA vertical — what does it do',
    query:
      'What does the CPA vertical do? Tax preparer JTBD daily struggles audit prep client pipeline coordination.',
    contextKinds: ['VERTICAL'],
    verticalSlug: 'cpa',
    expectedTitleContains: 'CPA',
  },
  {
    label: 'Architecture — five-skill value loop / substrate',
    query:
      'How do skill agents compose the value loop? Read categorize coordinate schedule draft skills runner pipeline.',
    contextKinds: ['SKILL'],
    expectedTitleContains: 'Skills architecture',
  },
  {
    label: 'Mortgage RESPA Section 8 anti-kickback',
    query:
      'RESPA Section 8 mortgage anti-kickback unearned fees referral compensation settlement service.',
    contextKinds: ['COMPLIANCE'],
    verticalSlug: 'mortgage',
    expectedTitleContains: 'RESPA Section 8',
  },
  {
    label: 'Real-estate fair-housing protected classes (legacy fixture)',
    query:
      'fair housing act protected classes HUD discrimination listing copy advertising language',
    contextKinds: ['COMPLIANCE'],
    verticalSlug: 'real-estate',
    expectedTitleContains: 'Fair Housing Act',
  },
];

async function main() {
  const embedder = new TestEmbeddingProvider();
  const store = new TestKnowledgeStore(embedder);
  store.setContext(TEST_OPERATOR_CONTEXT);

  const assembly = buildSeedAssembly();
  console.log(
    `Plan: SKILL=${assembly.skill.length} VERTICAL=${assembly.vertical.length} COMPLIANCE=${assembly.compliance.length}\n`,
  );

  let failures = 0;
  for (const row of [...assembly.skill, ...assembly.vertical, ...assembly.compliance]) {
    const r = await store.upsert(row);
    if (!r.ok) {
      failures += 1;
      console.error(`upsert failed for ${row.sourceId}: [${r.error.code}] ${r.error.message}`);
    }
  }
  console.log(`Upsert pass complete. failures=${failures}\n`);

  for (const q of QUERIES) {
    const search = await store.search({
      query: q.query,
      k: 3,
      contextKinds: q.contextKinds,
      verticalSlug: q.verticalSlug,
    });
    console.log(`Q: ${q.label}`);
    console.log(`   query: "${q.query.slice(0, 100)}…"`);
    if (q.contextKinds) console.log(`   contextKinds: ${q.contextKinds.join(', ')}`);
    if (q.verticalSlug) console.log(`   verticalSlug: ${q.verticalSlug}`);
    if (!search.ok) {
      console.log(`   ERROR [${search.error.code}] ${search.error.message}\n`);
      continue;
    }
    if (search.value.length === 0) {
      console.log(`   (no hits)\n`);
      continue;
    }
    for (const [i, hit] of search.value.entries()) {
      console.log(
        `   #${i + 1} sim=${hit.similarity.toFixed(4)} vertical=${hit.verticalSlug ?? '-'} sourceId=${hit.sourceId}`,
      );
      console.log(`        title: ${hit.title}`);
    }
    if (q.expectedTitleContains) {
      const needle = q.expectedTitleContains.toLowerCase();
      const top = search.value[0];
      const topMatch = top.title.toLowerCase().includes(needle);
      const anyMatch = search.value.some((h) => h.title.toLowerCase().includes(needle));
      console.log(
        `   expected title contains "${q.expectedTitleContains}": top=${topMatch ? 'OK' : 'no'}, any-of-3=${anyMatch ? 'OK' : 'MISS'}`,
      );
    }
    console.log();
  }
}

main().catch((err) => {
  console.error('verify-knowledge-seed: uncaught', err);
  process.exit(1);
});
