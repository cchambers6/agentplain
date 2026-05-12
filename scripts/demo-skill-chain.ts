/**
 * scripts/demo-skill-chain.ts
 *
 * Quick-look invocation of the skill chain on two fixture inputs.
 * Used to produce the sample categorization + draft output that ships
 * in the PR description.
 *
 * Run: `npx tsx scripts/demo-skill-chain.ts`
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this script
 * demonstrates the loop shape on mock data so a reader can scan output
 * quality before Conner connects Gmail.
 */

import { FixtureMessageFetcher, buildWebhookEventFromFixture } from '@/lib/skills/fixture-fetcher';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { CORPUS } from '@/tests/fixtures/webhook-events/_corpus';
import type { Vertical } from '@prisma/client';

async function demo(fixtureId: string, vertical: Vertical) {
  const f = CORPUS.find((c) => c.id === fixtureId);
  if (!f) throw new Error(`fixture not found: ${fixtureId}`);
  const r = await runSkillChain({
    workspace: { id: 'ws-demo', slug: 'demo', name: 'demo', vertical },
    event: buildWebhookEventFromFixture(f),
    fetcher: new FixtureMessageFetcher(f),
    persister: new RecordingDraftPersister(),
    llm: new TestLlmProvider(),
    writeLog: false,
  });
  console.log('\n=== fixture:', fixtureId, '— vertical:', vertical, '===');
  console.log(JSON.stringify({
    category: r.outcome.category,
    schedule: r.outcome.scheduledProposal,
    draft: r.outcome.draft,
    steps: r.record.steps.map((s) => ({ step: s.step, ok: s.ok, summary: s.summary })),
  }, null, 2));
}

async function main() {
  await demo('re-01-buyer-inquiry', 'REAL_ESTATE');
  await demo('re-02-listing-consult-scheduling', 'REAL_ESTATE');
  await demo('cpa-01-irs-notice', 'CPA');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
