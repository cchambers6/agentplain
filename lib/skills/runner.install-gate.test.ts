/**
 * lib/skills/runner.install-gate.test.ts
 *
 * Wave-3 phase 3 — marketplace install gate on the office-admin
 * classifier inside runSkillChain.
 *
 * The runner now accepts `installedSkillSlugs: ReadonlySet<string>`. When
 * the set is supplied AND does NOT contain `office-admin`, the office-
 * admin classify step is skipped honestly — no LLM call, no admin row,
 * the step is recorded as "skipped — office-admin skill uninstalled".
 *
 * Backwards compat: when `installedSkillSlugs` is `undefined`, the
 * runner falls back to the previous behavior (always runs office-admin
 * unless a discipline disabled it).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent, Workspace } from '@prisma/client';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { skillOk, type SkillResult } from './types';
import type {
  MessageFetcher,
  DraftPersister,
  ParsedMessage,
} from './types';
import { runSkillChain } from './runner';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000333';

class StubFetcher implements MessageFetcher {
  readonly name = 'stub' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchMessagesForEvent(_event: WebhookEvent) {
    return skillOk(this.messages);
  }
  async fetchThreadMessages(
    _threadId: string,
  ): Promise<SkillResult<ParsedMessage[]>> {
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
    slug: 'install-gate-test',
    name: 'Install Gate Test',
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
    subject: 'Question about listing',
    bodyText: 'Hi! Could you tell me how the process works?',
    snippet: 'Hi! Could you',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date(),
    labels: ['INBOX'],
  };
}

describe('runSkillChain — install gate', () => {
  it('skips office-admin classify when office-admin is uninstalled', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      installedSkillSlugs: new Set(), // empty = nothing installed
      writeLog: false,
    });
    const adminStep = result.record.steps.find(
      (s) => s.step === 'office-admin-classify',
    );
    assert.ok(adminStep, 'office-admin-classify step should be recorded');
    assert.match(
      adminStep!.summary,
      /office-admin skill uninstalled/i,
      'skip summary names the install reason',
    );
    assert.equal(
      result.outcome.officeAdmin,
      null,
      'no office-admin classification should be produced',
    );
  });

  it('runs office-admin classify when the skill IS in the installed set', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      installedSkillSlugs: new Set(['office-admin']),
      writeLog: false,
    });
    const adminStep = result.record.steps.find(
      (s) => s.step === 'office-admin-classify',
    );
    assert.ok(adminStep);
    assert.equal(
      adminStep!.summary.includes('uninstalled'),
      false,
      'office-admin should NOT be skipped when installed',
    );
  });

  it('runs office-admin classify when installedSkillSlugs is undefined (back-compat)', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      // installedSkillSlugs omitted — back-compat for legacy callers.
      writeLog: false,
    });
    const adminStep = result.record.steps.find(
      (s) => s.step === 'office-admin-classify',
    );
    assert.ok(adminStep);
    assert.equal(
      adminStep!.summary.includes('uninstalled'),
      false,
      'omitted installedSkillSlugs falls back to "installed"',
    );
  });

  it('discipline-disabled wins over install gate when both apply', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildDraftNeededMessage()]),
      persister: new StubPersister(),
      llm,
      disabledDisciplineIds: ['operations'],
      installedSkillSlugs: new Set(), // uninstalled too
      writeLog: false,
    });
    const adminStep = result.record.steps.find(
      (s) => s.step === 'office-admin-classify',
    );
    assert.ok(adminStep);
    assert.match(
      adminStep!.summary,
      /operations discipline disabled/,
      'discipline gate fires first',
    );
  });
});
