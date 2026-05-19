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
  /** Optional substring expected somewhere in the top-1 hit's BODY. Lets a
   *  doctrine query assert the specific phrase a customer-facing answer
   *  needs to surface (e.g. the three-tier pricing ladder, the plains
   *  brand semantic, the marketplace connect framing). */
  expectedBodyContains?: string;
}

const QUERIES: SampleQuery[] = [
  // Original seed-coverage queries kept from 2026-05-14 refresh.
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
  // 2026-05-18 doctrine diagnostic queries. Each maps to a customer-facing
  // question and asserts the substrate returns the CURRENT answer rather
  // than the model's training-prior generic. CROSS_CUSTOMER scope so the
  // query lands on doctrine, not the per-vertical content.
  {
    label: 'Doctrine — what is the pricing?',
    query:
      "What's your pricing? How much does agentplain cost per seat? Tiers Regular Partner Max ladder.",
    contextKinds: ['CROSS_CUSTOMER'],
    expectedTitleContains: 'pricing',
    expectedBodyContains: 'Regular',
  },
  {
    label: 'Doctrine — brand semantic (plain vs plane)',
    query:
      "Is plain pronounced plane? agentplain brand meaning. agent plus what? rooted heartland prairie.",
    contextKinds: ['CROSS_CUSTOMER'],
    expectedTitleContains: 'plain',
    expectedBodyContains: 'plains',
  },
  {
    label: 'Doctrine — how do customers connect Gmail?',
    query:
      'How do customers connect Gmail? Integration marketplace OAuth click connect MCP server workspace.',
    contextKinds: ['CROSS_CUSTOMER'],
    expectedTitleContains: 'MCP',
    expectedBodyContains: 'marketplace',
  },
  {
    label: 'Doctrine — do you serve dentists / non-named verticals?',
    query:
      'Do you serve dentists? Salons restaurants gyms? Local business outside the ten verticals on-ramp /general.',
    contextKinds: ['CROSS_CUSTOMER'],
    expectedTitleContains: 'on-ramp',
    expectedBodyContains: '/general',
  },
];

async function main() {
  const embedder = new TestEmbeddingProvider();
  const store = new TestKnowledgeStore(embedder);
  store.setContext(TEST_OPERATOR_CONTEXT);

  const assembly = buildSeedAssembly();
  console.log(
    `Plan: SKILL=${assembly.skill.length} VERTICAL=${assembly.vertical.length} COMPLIANCE=${assembly.compliance.length} CROSS_CUSTOMER=${assembly.crossCustomer.length}\n`,
  );

  let failures = 0;
  for (const row of [
    ...assembly.skill,
    ...assembly.vertical,
    ...assembly.compliance,
    ...assembly.crossCustomer,
  ]) {
    const r = await store.upsert(row);
    if (!r.ok) {
      failures += 1;
      console.error(`upsert failed for ${row.sourceId}: [${r.error.code}] ${r.error.message}`);
    }
  }
  console.log(`Upsert pass complete. failures=${failures}\n`);

  for (const q of QUERIES) {
    // k=5 across the board so the verify output shows enough of the
    // retrieval window to confirm the substrate is discoverable, not
    // just whether the deterministic test embedder happened to put
    // the "ideal" doctrine doc at position 1. Production uses the
    // OpenAI embedder where top-1 is semantically meaningful; here
    // the substantive check is "did the right doc appear in the top
    // few against the same rows production will see?"
    const search = await store.search({
      query: q.query,
      k: 5,
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
        `   #${i + 1} sim=${hit.similarity.toFixed(4)} vertical=${hit.verticalSlug ?? '-'} documentId=${hit.documentId ?? '-'}`,
      );
      console.log(`        title: ${hit.title}`);
    }
    // Print a short body excerpt of the top-1 hit so the verbatim
    // returned chunk is visible in the script output. Per
    // `feedback_no_guesses_no_estimates.md`, the re-seed doc cites
    // actual returned chunk content, not "should return".
    const top = search.value[0];
    const excerpt = top.body.replace(/\s+/g, ' ').slice(0, 260);
    console.log(`        body[0:260]: ${excerpt}${top.body.length > 260 ? '…' : ''}`);
    if (q.expectedTitleContains) {
      const needle = q.expectedTitleContains.toLowerCase();
      const topMatch = top.title.toLowerCase().includes(needle);
      const anyMatch = search.value.some((h) => h.title.toLowerCase().includes(needle));
      console.log(
        `   expected title contains "${q.expectedTitleContains}": top=${topMatch ? 'OK' : 'no'}, any-of-${search.value.length}=${anyMatch ? 'OK' : 'MISS'}`,
      );
    }
    if (q.expectedBodyContains) {
      const needle = q.expectedBodyContains.toLowerCase();
      const topBodyMatch = top.body.toLowerCase().includes(needle);
      const anyBodyMatch = search.value.some((h) => h.body.toLowerCase().includes(needle));
      console.log(
        `   expected body contains "${q.expectedBodyContains}": top=${topBodyMatch ? 'OK' : 'no'}, any-of-${search.value.length}=${anyBodyMatch ? 'OK' : 'MISS'}`,
      );
    }
    console.log();
  }
}

main().catch((err) => {
  console.error('verify-knowledge-seed: uncaught', err);
  process.exit(1);
});
