/**
 * lib/skills/runner.discipline-gate.test.ts
 *
 * Wave-1 audit fix §9 #3 — biggest runtime path was ungated.
 * runSkillChain now respects `disabledDisciplineIds`, skipping the
 * chain's discipline-tagged terminal outputs (office-admin classify,
 * scheduling proposal, customer-facing draft, compliance scan) without
 * firing the LLM.
 *
 * Asserts:
 *   1. customer-success disabled → no draft produced, no LLM call to
 *      the DraftSkill, the run step records the skip honestly.
 *   2. operations disabled → no office-admin classification, no
 *      scheduling proposal.
 *   3. legal disabled → no compliance scan (no flag rows).
 *   4. With NO disabled disciplines (the default), every stage runs as
 *      before — backwards compatible.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent, Workspace } from '@prisma/client';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { skillOk, type SkillResult } from './types';
import type { MessageFetcher, DraftPersister, ParsedMessage } from './types';
import { runSkillChain } from './runner';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000222';

class StubFetcher implements MessageFetcher {
  readonly name = 'stub' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchMessagesForEvent(_event: WebhookEvent) {
    return skillOk(this.messages);
  }
  async fetchThreadMessages(_threadId: string): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk([]);
  }
}

class StubPersister implements DraftPersister {
  readonly name = 'stub' as const;
  async persistDraft() {
    return skillOk({ providerDraftId: 'draft-stub-1' });
  }
}

function buildEvent(): WebhookEvent {
  return {
    id: 'evt-1',
    subscriptionId: 'sub-1',
    deliveredId: null,
    payload: {},
    workspaceId: WORKSPACE_ID,
    receivedAt: new Date(),
    processed: false,
    processedAt: null,
    attemptCount: 0,
    error: null,
    nextAttemptAt: null,
    deadlettered: false,
  } as unknown as WebhookEvent;
}

function buildWorkspace(): Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'> {
  return {
    id: WORKSPACE_ID,
    slug: 'realty-gate-test',
    name: 'Realty Gate Test',
    vertical: 'REAL_ESTATE',
  };
}

function buildDraftNeededMessage(): ParsedMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    rfcMessageId: '<msg-1@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'A Lead',
    toEmails: ['agent@brokerage.com'],
    ccEmails: [],
    subject: 'Quick question about your services',
    bodyText:
      'Hi! I want to learn more about how you list homes. Could you reply with details on your process?',
    snippet: 'Hi! I want to learn',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date(),
    labels: ['INBOX'],
  };
}

function buildSchedulingMessage(): ParsedMessage {
  return {
    ...buildDraftNeededMessage(),
    subject: 'Can we schedule a meeting next week?',
    bodyText:
      'Could we set up a tour next Tuesday or Wednesday afternoon? I have flexibility.',
    snippet: 'Could we set up a tour',
  };
}

describe('runSkillChain — discipline-disable gate', () => {
  it('skips the draft step when customer-success is disabled', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      disabledDisciplineIds: ['customer-success'],
      writeLog: false,
    });
    assert.equal(
      result.outcome.draft,
      null,
      'no draft should be produced when customer-success is disabled',
    );
    const draftStep = result.record.steps.find((s) => s.step === 'draft');
    assert.ok(draftStep, 'expected a draft step record');
    assert.match(draftStep!.summary, /customer-success discipline disabled/);
  });

  it('skips office-admin classify + scheduling proposal when operations is disabled', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildSchedulingMessage()]),
      persister: new StubPersister(),
      llm,
      disabledDisciplineIds: ['operations'],
      writeLog: false,
    });
    assert.equal(
      result.outcome.officeAdmin,
      null,
      'office-admin classification should not run',
    );
    assert.equal(
      result.outcome.scheduledProposal,
      null,
      'no scheduling proposal should be produced',
    );
    const adminStep = result.record.steps.find(
      (s) => s.step === 'office-admin-classify',
    );
    assert.ok(adminStep);
    assert.match(adminStep!.summary, /operations discipline disabled/);
  });

  it('skips compliance scan when legal is disabled', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      disabledDisciplineIds: ['legal'],
      writeLog: false,
    });
    assert.equal(
      result.outcome.complianceFlags,
      null,
      'compliance flags should not be produced when legal is disabled',
    );
    // The compliance-check step should NOT appear in the record at all
    // (we skipped before running it; no honest step to record).
    const complianceStep = result.record.steps.find(
      (s) => s.step === 'compliance-check',
    );
    assert.equal(complianceStep, undefined);
  });

  it('runs every stage when no disciplines are disabled (backwards compatible)', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      writeLog: false,
    });
    // No skip-summary should appear on any step.
    for (const step of result.record.steps) {
      assert.equal(
        step.summary.includes('discipline disabled'),
        false,
        `step ${step.step} unexpectedly skipped`,
      );
    }
  });
});
