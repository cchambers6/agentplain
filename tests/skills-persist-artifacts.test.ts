/**
 * tests/skills-persist-artifacts.test.ts
 *
 * Pins the contract for `lib/skills/persist-artifacts.ts` — the writer
 * that turns a SkillRunRecord into customer-visible HandoffLogEntry +
 * WorkApprovalQueueItem rows.
 *
 * Coverage:
 *   - One HandoffLogEntry per step in the record (no duplicates, no
 *     skips). Per-step payload shape verified.
 *   - WorkApprovalQueueItem created exactly when outcome.draft exists,
 *     and never otherwise. Payload contains subject + body so the
 *     /approvals page can render it without the raw-JSON dump.
 *   - Each run is end-to-end: build a SkillRunRecord with the real
 *     runner against a fixture, then persist via an in-memory stub
 *     Prisma client and assert the writes.
 *
 * Per `feedback_no_guesses_no_estimates.md`: assertions check the exact
 * fields the workspace overview + agents page + /approvals query so a
 * field rename surfaces here.
 *
 * Per the loop-closure brief: this test is the proof the second
 * load-bearing fix actually closes the gap audit §1 row 5 + row 6
 * identified ("zero callers anywhere" for both writers).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FixtureMessageFetcher, buildWebhookEventFromFixture } from '@/lib/skills/fixture-fetcher';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import {
  persistSkillRunArtifacts,
  summarizeOutcome,
} from '@/lib/skills/persist-artifacts';
import { loadAllFixtures } from './fixtures/webhook-events/_loader';
import type { Vertical, Workspace } from '@prisma/client';
import type { SkillRunRecord } from '@/lib/skills/types';

const VERTICAL_TO_ENUM: Record<string, Vertical> = {
  'real-estate': 'REAL_ESTATE',
  mortgage: 'MORTGAGE',
  insurance: 'INSURANCE',
  'property-management': 'PROPERTY_MANAGEMENT',
  'title-escrow': 'TITLE_ESCROW',
  recruiting: 'RECRUITING',
  'home-services': 'HOME_SERVICES',
  cpa: 'CPA',
  law: 'LAW',
  ria: 'RIA',
};

function makeWorkspaceForVertical(slug: string): Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'> {
  return {
    id: `00000000-0000-0000-0000-${slug.replace(/[^a-z]/g, '').padEnd(12, '0').slice(0, 12)}`,
    slug,
    name: `${slug} workspace`,
    vertical: VERTICAL_TO_ENUM[slug],
  };
}

/** In-memory stub of the Prisma TransactionClient surface persist-artifacts uses. */
function makeStubTx() {
  const handoffRows: Array<Record<string, unknown>> = [];
  const approvalRows: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const tx = {
    handoffLogEntry: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        for (const row of args.data) handoffRows.push(row);
        return { count: args.data.length };
      },
    },
    workApprovalQueueItem: {
      create: async (args: { data: Record<string, unknown>; select?: { id?: boolean } }) => {
        const id = `approval-${nextId++}`;
        const row = { ...args.data, id };
        approvalRows.push(row);
        if (args.select?.id) return { id };
        return row;
      },
    },
  };
  return { tx, handoffRows, approvalRows };
}

async function runAndPersist(fixtureId: string) {
  const fixtures = await loadAllFixtures();
  const fixture = fixtures.find((f) => f.id === fixtureId);
  assert.ok(fixture, `fixture not found: ${fixtureId}`);
  const workspace = makeWorkspaceForVertical(fixture!.verticalSlug);
  const event = buildWebhookEventFromFixture(fixture!);
  const { record } = await runSkillChain({
    workspace,
    event,
    fetcher: new FixtureMessageFetcher(fixture!),
    persister: new RecordingDraftPersister(),
    llm: new TestLlmProvider(),
    writeLog: false,
  });

  const { tx, handoffRows, approvalRows } = makeStubTx();
  const result = await persistSkillRunArtifacts({
    workspaceId: workspace.id,
    record,
    client: tx as never,
  });
  return { workspace, record, handoffRows, approvalRows, result };
}

describe('persistSkillRunArtifacts — HandoffLogEntry writes', () => {
  it('writes one HandoffLogEntry per recorded step', async () => {
    // draft-needed run produces at least read + categorize + coordinate + draft + mark-processed
    const { record, handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    assert.equal(
      handoffRows.length,
      record.steps.length,
      `expected ${record.steps.length} HandoffLogEntry rows, got ${handoffRows.length}`,
    );
  });

  it('attributes a buyer-inquiry run to the owning roster agent as the trace root', async () => {
    // re-01 is draft-needed → owned by realty-buyer-inquiry-router, so the
    // trace root (and thus the agents-page groupBy(fromAgent) count) resolves
    // to that capability instead of the synthetic "inbound" label.
    const { handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    assert.ok(handoffRows.length > 0, 'expected handoff rows');
    assert.equal(handoffRows[0].fromAgent, 'realty-buyer-inquiry-router');
  });

  it('attributes a scheduling run to the showing scheduler', async () => {
    const { handoffRows } = await runAndPersist('re-02-listing-consult-scheduling');
    assert.ok(handoffRows.length > 0, 'expected handoff rows');
    assert.equal(handoffRows[0].fromAgent, 'realty-showing-scheduler');
  });

  it('falls back to synthetic "inbound" when no roster agent owns the run', async () => {
    // A noise run produces no owned work, so it is NOT attributed to any
    // capability — it must not inflate a card's count.
    const fixtures = await loadAllFixtures();
    const noiseFixture = fixtures.find((f) => f.expectedCategory === 'noise');
    assert.ok(noiseFixture, 'expected at least one noise fixture');
    const { handoffRows } = await runAndPersist(noiseFixture!.id);
    assert.equal(handoffRows[0].fromAgent, 'inbound');
  });

  it('each row carries the webhook event id as relatedSubjectId', async () => {
    const { record, handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    for (const row of handoffRows) {
      assert.equal(row.relatedSubjectTable, 'WebhookEvent');
      assert.equal(row.relatedSubjectId, record.webhookEventId);
    }
  });

  it('occurredAt timestamps strictly increase so the overview orders correctly', async () => {
    const { handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    for (let i = 1; i < handoffRows.length; i++) {
      const prev = (handoffRows[i - 1].occurredAt as Date).getTime();
      const cur = (handoffRows[i].occurredAt as Date).getTime();
      assert.ok(cur > prev, `row ${i} occurredAt not strictly after row ${i - 1}`);
    }
  });

  it('payload contains the step summary so the UI can show it', async () => {
    const { handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    for (const row of handoffRows) {
      const payload = row.payload as Record<string, unknown>;
      assert.equal(typeof payload.step, 'string');
      assert.equal(typeof payload.summary, 'string');
      assert.equal(typeof payload.ok, 'boolean');
    }
  });

  it('noise events still write at least read + categorize + mark-processed rows', async () => {
    // Pottery Barn / Redfin / Experian etc. — noise fixtures
    const fixtures = await loadAllFixtures();
    const noiseFixture = fixtures.find((f) => f.expectedCategory === 'noise');
    assert.ok(noiseFixture, 'expected at least one noise fixture');
    const { handoffRows } = await runAndPersist(noiseFixture!.id);
    const steps = handoffRows.map((r) => (r.payload as Record<string, unknown>).step as string);
    assert.ok(steps.includes('read'), 'noise run missing read handoff');
    assert.ok(steps.includes('categorize'), 'noise run missing categorize handoff');
    assert.ok(steps.includes('mark-processed'), 'noise run missing mark-processed handoff');
  });
});

describe('persistSkillRunArtifacts — WorkApprovalQueueItem writes', () => {
  it('writes a WorkApprovalQueueItem when outcome.draft exists', async () => {
    const { approvalRows, record, result } = await runAndPersist('re-01-buyer-inquiry');
    assert.equal(result.approvalsWritten, 1, 'expected one approval row for draft-needed fixture');
    assert.equal(approvalRows.length, 1);
    const row = approvalRows[0];
    assert.equal(row.kind, 'BUYER_INQUIRY_REPLY_DRAFT');
    assert.equal(row.refTable, 'WebhookEvent');
    assert.equal(row.refId, record.webhookEventId);
    assert.equal(row.status, 'PENDING');
    // Attributed to the owning capability so its /agents card resolves.
    assert.equal(row.agentSlug, 'realty-buyer-inquiry-router');
  });

  it('payload carries subject + body so /approvals can render without raw JSON', async () => {
    const { approvalRows } = await runAndPersist('re-01-buyer-inquiry');
    const payload = approvalRows[0].payload as Record<string, unknown>;
    assert.equal(typeof payload.subject, 'string', 'payload.subject must be string');
    assert.equal(typeof payload.body, 'string', 'payload.body must be string');
    assert.ok((payload.subject as string).length > 0, 'subject empty');
    assert.ok((payload.body as string).length > 0, 'body empty');
    assert.equal(typeof payload.confidence, 'number');
    assert.equal(typeof payload.persisted, 'boolean');
    assert.equal(typeof payload.tone, 'string');
  });

  it('writes ZERO approval rows for a noise fixture (no draft produced)', async () => {
    const fixtures = await loadAllFixtures();
    const noiseFixture = fixtures.find((f) => f.expectedCategory === 'noise');
    assert.ok(noiseFixture);
    const { approvalRows, result } = await runAndPersist(noiseFixture!.id);
    assert.equal(result.approvalsWritten, 0);
    assert.equal(approvalRows.length, 0);
  });

  it('payload carries the inbound + categorization summary so the approver sees context', async () => {
    const { approvalRows } = await runAndPersist('re-01-buyer-inquiry');
    const payload = approvalRows[0].payload as Record<string, unknown>;
    assert.equal(typeof payload.inboundSummary, 'string');
    assert.equal(typeof payload.categorizationSummary, 'string');
  });
});

describe('persistSkillRunArtifacts — return shape', () => {
  it('handoffsWritten matches the actual row count', async () => {
    const { result, handoffRows } = await runAndPersist('re-01-buyer-inquiry');
    assert.equal(result.handoffsWritten, handoffRows.length);
  });

  it('approvalId is non-null when a draft was produced', async () => {
    const { result } = await runAndPersist('re-01-buyer-inquiry');
    assert.ok(result.approvalId, 'approvalId missing on draft-producing run');
  });

  it('approvalId is null for a noise run', async () => {
    const fixtures = await loadAllFixtures();
    const noiseFixture = fixtures.find((f) => f.expectedCategory === 'noise');
    assert.ok(noiseFixture);
    const { result } = await runAndPersist(noiseFixture!.id);
    assert.equal(result.approvalId, null);
  });
});

describe('summarizeOutcome — audit-log helper', () => {
  it('renders a draft run summary with category + draft state + confidence', () => {
    const text = summarizeOutcome({
      category: 'draft-needed',
      threadId: 'thr-x',
      scheduledProposal: null,
      draft: {
        draftId: 'd-1',
        providerDraftId: 'gmail-d-1',
        subject: 'Re: hi',
        body: 'body',
        tone: 'casual',
        confidence: 0.78,
        persisted: true,
      },
      markedProcessed: true,
      officeAdmin: null,
      officeAdminPayload: null,
    });
    assert.match(text, /category=draft-needed/);
    assert.match(text, /draft=persisted/);
    assert.match(text, /conf=0\.78/);
  });

  it('renders a noise run summary with no draft fields', () => {
    const text = summarizeOutcome({
      category: 'noise',
      threadId: null,
      scheduledProposal: null,
      draft: null,
      markedProcessed: true,
      officeAdmin: null,
      officeAdminPayload: null,
    });
    assert.match(text, /category=noise/);
    assert.doesNotMatch(text, /draft=/);
    assert.doesNotMatch(text, /conf=/);
  });
});

describe('runSkillChain → persistSkillRunArtifacts contract', () => {
  it('SkillRunRecord shape exposes everything persist-artifacts needs', async () => {
    // Compile-time + runtime check that the runner's record shape contains
    // what persist-artifacts reads. If runner.ts drops a field, this trips.
    const fixtures = await loadAllFixtures();
    const fixture = fixtures.find((f) => f.expectedCategory === 'draft-needed');
    assert.ok(fixture);
    const workspace = makeWorkspaceForVertical(fixture!.verticalSlug);
    const { record } = await runSkillChain({
      workspace,
      event: buildWebhookEventFromFixture(fixture!),
      fetcher: new FixtureMessageFetcher(fixture!),
      persister: new RecordingDraftPersister(),
      llm: new TestLlmProvider(),
      writeLog: false,
    });
    const r: SkillRunRecord = record;
    assert.equal(typeof r.webhookEventId, 'string');
    assert.equal(typeof r.workspaceId, 'string');
    assert.equal(typeof r.verticalSlug, 'string');
    assert.ok(Array.isArray(r.steps));
    assert.ok(r.outcome, 'outcome missing');
  });
});
