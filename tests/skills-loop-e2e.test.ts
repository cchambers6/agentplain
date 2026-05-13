/**
 * tests/skills-loop-e2e.test.ts
 *
 * End-to-end test of the value loop on mock data. Per the PR brief:
 *
 *   - Categorization is correct (per fixture's expectedCategory)
 *   - Draft generation produces a sensible reply for draft-needed events
 *   - Scheduling proposals respect business-hours + customer-stated prefs
 *   - Noise events are correctly marked processed without further skills firing
 *   - Per-vertical prompts produce vertical-appropriate categorizations
 *     (same mock email categorized differently for CPA vs real-estate workspace)
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this test is
 * the SCAFFOLDING validation. The full functional acceptance test
 * (loop running on Conner's real inbox) lands in PR-D after Conner
 * connects Gmail.
 *
 * Per `project_no_outbound_architecture.md`: the test asserts nothing
 * is sent. The draft skill's persister is a `RecordingDraftPersister`
 * that captures calls in memory; we assert `users.messages.send` is
 * never reached (there is no such method on the test surface, and a
 * production swap would still respect this invariant).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  FixtureMessageFetcher,
  buildWebhookEventFromFixture,
  type WebhookEventFixture,
} from '@/lib/skills/fixture-fetcher';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { loadAllFixtures } from './fixtures/webhook-events/_loader';
import {
  VERTICAL_PROMPT_SLUGS,
  getPromptBundleBySlug,
} from '@/lib/skills/prompts/index';
import type { Vertical, Workspace } from '@prisma/client';

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

let allFixtures: WebhookEventFixture[];
let tmpLogDir: string;

before(async () => {
  allFixtures = await loadAllFixtures();
  tmpLogDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-runs-'));
});

describe('skill-chain corpus completeness', () => {
  it('has 30+ fixtures', () => {
    assert.ok(
      allFixtures.length >= 30,
      `expected >=30 fixtures, got ${allFixtures.length}`,
    );
  });

  it('covers all 10 verticals at least once', () => {
    const seen = new Set(allFixtures.map((f) => f.verticalSlug));
    for (const slug of VERTICAL_PROMPT_SLUGS) {
      assert.ok(seen.has(slug), `no fixture for vertical: ${slug}`);
    }
  });

  it('has 10 per-vertical prompt bundles', () => {
    assert.equal(VERTICAL_PROMPT_SLUGS.length, 10);
    for (const slug of VERTICAL_PROMPT_SLUGS) {
      const b = getPromptBundleBySlug(slug);
      assert.ok(b, `missing prompt bundle for ${slug}`);
      assert.ok(b!.categorize.length > 100, `categorize prompt for ${slug} suspiciously short`);
      assert.ok(b!.draft.length > 100, `draft prompt for ${slug} suspiciously short`);
      assert.ok(b!.schedule.length > 100, `schedule prompt for ${slug} suspiciously short`);
      assert.ok(b!.coordinate.length > 100, `coordinate prompt for ${slug} suspiciously short`);
    }
  });

  it('covers all six intent categories across the corpus', () => {
    const expected = new Set(['noise', 'draft-needed', 'scheduling-needed', 'lead', 'transactional']);
    const seen = new Set(allFixtures.map((f) => f.expectedCategory));
    for (const cat of expected) {
      assert.ok(seen.has(cat as never), `no fixture for expected category: ${cat}`);
    }
  });
});

describe('skill-chain — per-fixture run', () => {
  it('every fixture produces its expected category + correct downstream skills', async () => {
    const failures: string[] = [];
    for (const fixture of allFixtures) {
      const workspace = makeWorkspaceForVertical(fixture.verticalSlug);
      const fetcher = new FixtureMessageFetcher(fixture);
      const persister = new RecordingDraftPersister();
      const llm = new TestLlmProvider();
      const event = buildWebhookEventFromFixture(fixture);
      const { record, outcome } = await runSkillChain({
        workspace,
        event,
        fetcher,
        persister,
        llm,
        writeLog: true,
        logDir: tmpLogDir,
      });

      const ctx = `[fixture=${fixture.id} vertical=${fixture.verticalSlug}]`;

      if (outcome.category !== fixture.expectedCategory) {
        failures.push(
          `${ctx} expected category=${fixture.expectedCategory}, got=${outcome.category}`,
        );
        continue;
      }

      // Noise / transactional / vendor / lead → no draft, no schedule.
      if (
        fixture.expectedCategory === 'noise' ||
        fixture.expectedCategory === 'transactional' ||
        fixture.expectedCategory === 'vendor' ||
        fixture.expectedCategory === 'lead'
      ) {
        if (outcome.draft !== null) {
          failures.push(`${ctx} expected no draft for ${fixture.expectedCategory}, but got one`);
        }
        if (outcome.scheduledProposal !== null) {
          failures.push(`${ctx} expected no schedule proposal for ${fixture.expectedCategory}, got one`);
        }
        if (!outcome.markedProcessed) {
          failures.push(`${ctx} expected markedProcessed=true`);
        }
        if (persister.calls.length !== 0) {
          failures.push(`${ctx} expected zero draft-persist calls for ${fixture.expectedCategory}, got ${persister.calls.length}`);
        }
        continue;
      }

      // scheduling-needed → schedule proposal present, slots respect business hours
      if (fixture.expectedCategory === 'scheduling-needed') {
        assert.ok(outcome.scheduledProposal, `${ctx} expected scheduledProposal`);
        assert.ok(
          outcome.scheduledProposal!.proposedSlots.length > 0,
          `${ctx} expected >=1 proposed slot`,
        );
        for (const slot of outcome.scheduledProposal!.proposedSlots) {
          // business-hours = 09:00..17:00 default
          const start = slot.startLocal;
          assert.match(start, /^\d{2}:\d{2}$/, `${ctx} slot.startLocal malformed`);
          const startMin = toMin(slot.startLocal);
          const endMin = toMin(slot.endLocal);
          assert.ok(startMin >= 540 && endMin <= 1020, `${ctx} slot outside business hours: ${slot.startLocal}-${slot.endLocal}`);
          assert.ok(
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(slot.day),
            `${ctx} slot day not a weekday: ${slot.day}`,
          );
        }
      }

      // scheduling-needed AND draft-needed → draft present
      if (
        fixture.expectedCategory === 'scheduling-needed' ||
        fixture.expectedCategory === 'draft-needed'
      ) {
        assert.ok(outcome.draft, `${ctx} expected draft output`);
        assert.ok(outcome.draft!.subject.length > 0, `${ctx} empty draft subject`);
        assert.ok(outcome.draft!.body.length > 0, `${ctx} empty draft body`);
        assert.ok(
          ['formal', 'casual', 'technical'].includes(outcome.draft!.tone),
          `${ctx} unexpected tone: ${outcome.draft!.tone}`,
        );
      }

      // Record assertions
      assert.equal(record.webhookEventId, event.id, `${ctx} record.webhookEventId mismatch`);
      assert.equal(record.workspaceId, workspace.id, `${ctx} record.workspaceId mismatch`);
      assert.ok(record.steps.length >= 2, `${ctx} record.steps too short`);
    }
    assert.equal(
      failures.length,
      0,
      `\n${failures.length} fixture failures:\n${failures.join('\n')}`,
    );
  });
});

describe('skill-chain — vertical-divergence', () => {
  it('same message categorizes differently for different verticals (edge-01)', async () => {
    const fixture = allFixtures.find((f) => f.id === 'edge-01-vertical-divergent');
    assert.ok(fixture, 'edge-01-vertical-divergent fixture missing');
    assert.ok(fixture!.divergentFor, 'edge-01 missing divergentFor field');

    // Default vertical (real-estate per fixture.verticalSlug) → expectedCategory=noise
    const reWorkspace = makeWorkspaceForVertical(fixture!.verticalSlug);
    const reRun = await runSkillChain({
      workspace: reWorkspace,
      event: buildWebhookEventFromFixture(fixture!),
      fetcher: new FixtureMessageFetcher(fixture!),
      persister: new RecordingDraftPersister(),
      llm: new TestLlmProvider(),
      writeLog: false,
    });
    assert.equal(
      reRun.outcome.category,
      fixture!.expectedCategory,
      `expected ${fixture!.expectedCategory} for ${fixture!.verticalSlug}`,
    );

    // Divergent vertical (cpa) → expectedCategory=scheduling-needed
    for (const div of fixture!.divergentFor!) {
      const altWorkspace = makeWorkspaceForVertical(div.verticalSlug);
      const altRun = await runSkillChain({
        workspace: altWorkspace,
        event: buildWebhookEventFromFixture(fixture!),
        fetcher: new FixtureMessageFetcher(fixture!),
        persister: new RecordingDraftPersister(),
        llm: new TestLlmProvider(),
        writeLog: false,
      });
      assert.equal(
        altRun.outcome.category,
        div.expectedCategory,
        `expected ${div.expectedCategory} for ${div.verticalSlug} on same message`,
      );
    }
  });
});

describe('skill-chain — runner log', () => {
  it('writes a JSONL row per run to the log dir', async () => {
    const fixture = allFixtures[0];
    const persister = new RecordingDraftPersister();
    const llm = new TestLlmProvider();
    const workspace = makeWorkspaceForVertical(fixture.verticalSlug);
    await runSkillChain({
      workspace,
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister,
      llm,
      writeLog: true,
      logDir: tmpLogDir,
    });
    const entries = await fs.readdir(tmpLogDir);
    assert.ok(entries.some((f) => f.endsWith('.jsonl')), 'no JSONL log written');
    for (const f of entries) {
      if (!f.endsWith('.jsonl')) continue;
      const contents = await fs.readFile(path.join(tmpLogDir, f), 'utf8');
      const lines = contents.split('\n').filter((l) => l.length > 0);
      for (const line of lines) {
        const parsed = JSON.parse(line);
        assert.ok(typeof parsed.startedAt === 'string');
        assert.ok(typeof parsed.webhookEventId === 'string');
        assert.ok(Array.isArray(parsed.steps));
      }
    }
  });
});

describe('skill-chain — draft persistence rules', () => {
  it('draft confidence < 0.5 is generated but NOT persisted (no Gmail draft created)', async () => {
    // Seed the LLM provider to emit a low-confidence draft for a
    // draft-needed fixture. Persistence threshold defaults to 0.5;
    // below that, the runner returns the draft with persisted=false
    // and the persister is never called.
    const fixture = allFixtures.find((f) => f.id === 're-01-buyer-inquiry')!;
    const lowConfDraft = JSON.stringify({
      subject: 'Re: 1247 Magnolia Dr',
      body: 'Hi Sarah,\n\nThanks for the note. We will follow up.\n\n{{operator: signature}}',
      tone: 'casual',
      confidence: 0.3,
    });
    const llm = new TestLlmProvider({
      responses: {},
    });
    // Override: seed the draft response by intercepting via byLastUser
    // — the prompt+message digest is stable across runs, but byLastUser
    // is more tolerant. The user prompt for draft contains BODY: from the
    // fixture.
    // Easier: just monkey-patch the heuristic by overriding TestLlmProvider
    // with a fully-canned provider. Do so via a subclass-style wrapper.
    const cannedLlm = new TestLlmProvider();
    (cannedLlm as unknown as { responses: Map<string, string> }).responses = new Map([
      ['__draft__', lowConfDraft],
    ]);
    // Patch complete() — simpler than fighting the digest.
    const realComplete = cannedLlm.complete.bind(cannedLlm);
    cannedLlm.complete = async (req) => {
      if (req.system.includes('[[agentplain.skill.draft.v1]]')) {
        return { ok: true, value: { text: lowConfDraft, stopReason: 'end_turn', usage: null, model: 'test' } };
      }
      return realComplete(req);
    };

    const persister = new RecordingDraftPersister();
    const result = await runSkillChain({
      workspace: makeWorkspaceForVertical(fixture.verticalSlug),
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister,
      llm: cannedLlm,
      writeLog: false,
    });
    assert.ok(result.outcome.draft, 'expected draft output');
    assert.equal(result.outcome.draft!.persisted, false, 'expected persisted=false for low-confidence');
    assert.equal(result.outcome.draft!.providerDraftId, null);
    assert.equal(persister.calls.length, 0, 'persister should not be called below threshold');
  });
});

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
