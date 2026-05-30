/**
 * lib/skills/runner.feedback-rules.test.ts
 *
 * Wave-1 audit fix §9 #1 + companion — end-to-end proof that
 * `runSkillChain` inlines customer-set PREFERENCE rules (FEEDBACK
 * WorkspaceMemoryEntry rows with `pref:<scope>` titles) into the
 * prompts every chain skill sends to the LLM.
 *
 * Before this PR the only consumer of FEEDBACK memory was the /talk
 * dispatcher; the email-loop fleet skipped them. This test asserts the
 * connection lands.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent, Workspace } from '@prisma/client';
import { RecordingMemoryStore } from '@/lib/plaino/memory/recording-memory-store';
import { buildPreferenceMemoryBody } from '@/lib/plaino/preference-memory';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { skillOk, type SkillResult } from './types';
import type { MessageFetcher, DraftPersister, ParsedMessage } from './types';
import { runSkillChain } from './runner';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000111';

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
    slug: 'realty-runner-test',
    name: 'Realty Runner Test',
    vertical: 'REAL_ESTATE',
  };
}

function buildMessage(): ParsedMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    rfcMessageId: '<msg-1@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'A Lead',
    toEmails: ['agent@brokerage.com'],
    ccEmails: [],
    subject: 'Want to schedule a tour',
    bodyText:
      'Hi! Looking to tour the property next week. We are preapproved. Could you suggest some times?',
    snippet: 'Hi! Looking to tour',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date(),
    labels: ['INBOX'],
  };
}

function collectPromptText(llm: TestLlmProvider): string {
  // The TestLlmProvider exposes `calls` — concatenate every system +
  // user message text to one haystack the assertion can grep.
  const parts: string[] = [];
  for (const call of llm.calls) {
    const sys = call.request.system;
    if (typeof sys === 'string') {
      parts.push(sys);
    } else if (sys) {
      parts.push(JSON.stringify(sys));
    }
    for (const m of call.request.messages) {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      parts.push(content);
    }
  }
  return parts.join('\n');
}

describe('runSkillChain — feedback rules wired into the LLM prompt', () => {
  it('inlines a pref:inbox-triage rule into the prompts the chain sends to the LLM', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:inbox-triage',
      body: buildPreferenceMemoryBody({
        scope: 'inbox-triage',
        rule: 'Treat any mention of MLS as urgent buyer interest',
      }),
      sourceChatMessageId: null,
    });
    const llm = new TestLlmProvider();
    await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildMessage()]),
      persister: new StubPersister(),
      llm,
      memory,
      writeLog: false,
    });
    const allText = collectPromptText(llm);
    assert.match(
      allText,
      /CUSTOMER PREFERENCES/,
      'expected the rules header to appear in at least one LLM call',
    );
    assert.match(
      allText,
      /Treat any mention of MLS as urgent buyer interest/,
      'expected the FEEDBACK rule text to appear in at least one LLM call',
    );
  });

  it('omits the rules header entirely when the workspace has no FEEDBACK rules', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const llm = new TestLlmProvider();
    await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildMessage()]),
      persister: new StubPersister(),
      llm,
      memory,
      writeLog: false,
    });
    const allText = collectPromptText(llm);
    assert.equal(
      allText.includes('CUSTOMER PREFERENCES'),
      false,
      'no rules → no header (honesty bar)',
    );
  });

  it('runs cleanly when no memory store is passed (backwards compatible)', async () => {
    const llm = new TestLlmProvider();
    const result = await runSkillChain({
      workspace: buildWorkspace(),
      event: buildEvent(),
      fetcher: new StubFetcher([buildMessage()]),
      persister: new StubPersister(),
      llm,
      writeLog: false,
    });
    const allText = collectPromptText(llm);
    assert.equal(allText.includes('CUSTOMER PREFERENCES'), false);
    assert.ok(result.outcome.category, 'expected a category from the chain');
  });
});
