/**
 * lib/skills/draft.missing-inputs.test.ts
 *
 * Pins the reply-draft chain's pre-generation requirements check.
 *
 * Two invariants, and the second is the load-bearing one:
 *
 *   1. Complete inputs still produce a real draft — the check must not
 *      over-refuse, or the whole value loop goes quiet.
 *   2. Zero grounding produces a HELD result, and the LLM stub asserts it
 *      was never called. "No LLM call on the refusal path" is not a
 *      performance note: an ungrounded draft above the persist threshold
 *      lands in the broker's real Gmail Drafts, one tap from send. The
 *      held result's confidence of 0 is what makes that structurally
 *      impossible, so it is asserted explicitly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LlmProvider } from '../llm/types';
import { DraftSkill, RecordingDraftPersister } from './draft';
import { getPromptBundleByEnum } from './prompts/index';
import type { ParsedMessage } from './types';

const PROMPTS = getPromptBundleByEnum('REAL_ESTATE');

function inbound(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'm1',
    threadId: 't1',
    rfcMessageId: null,
    fromEmail: 'buyer@example.com',
    fromName: 'Dana Buyer',
    toEmails: ['broker@example.com'],
    ccEmails: [],
    subject: 'Question about 1420 Oak Ridge',
    bodyText: 'Is the house still available? Could we see it this week?',
    snippet: 'Is the house still available?',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date('2026-08-01T12:00:00Z'),
    labels: ['INBOX'],
    ...overrides,
  };
}

/** Answers with a valid draft, and counts how many times it was asked. */
function respondingLlm(): { provider: LlmProvider; calls: () => number } {
  let calls = 0;
  const provider = {
    name: 'test',
    complete: async () => {
      calls += 1;
      return {
        ok: true as const,
        value: {
          text: JSON.stringify({
            subject: 'Re: Question about 1420 Oak Ridge',
            body: 'Happy to get you in this week. Thursday afternoon works.',
            tone: 'casual',
            confidence: 0.82,
          }),
          modelName: 'test',
        },
      };
    },
  } as unknown as LlmProvider;
  return { provider, calls: () => calls };
}

/** Fails the test on any call. The refusal path must never reach here. */
function forbiddenLlm(): LlmProvider {
  return {
    name: 'test',
    complete: async () => {
      assert.fail(
        'DraftSkill called the model on the refusal path — a zero-grounding fire must hold, not generate',
      );
    },
  } as unknown as LlmProvider;
}

describe('DraftSkill — complete inputs still draft', () => {
  it('grounded fire → real draft, LLM called once, persisted', async () => {
    const { provider, calls } = respondingLlm();
    const persister = new RecordingDraftPersister();
    const res = await new DraftSkill(provider).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister,
      thread: {
        threadId: 't1',
        summary: 'Buyer asked about 1420 Oak Ridge twice this week.',
        referencedThreadIds: [],
        priorMessages: [],
      },
      grounding: { customerContextSnippetCount: 2, preferencesPresent: true },
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(calls(), 1);
    assert.equal(res.value.held, undefined);
    assert.equal(res.value.missing, undefined);
    assert.equal(res.value.persisted, true);
    assert.equal(res.value.confidence, 0.82);
    assert.equal(persister.calls.length, 1);
  });

  it('a single surviving input is enough — a thread summary alone proceeds', async () => {
    const { provider, calls } = respondingLlm();
    const res = await new DraftSkill(provider).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister: new RecordingDraftPersister(),
      thread: {
        threadId: 't1',
        summary: 'Buyer has toured two other listings this month.',
        referencedThreadIds: [],
        priorMessages: [],
      },
      grounding: { customerContextSnippetCount: 0, preferencesPresent: false },
    });
    assert.equal(res.ok, true);
    assert.equal(calls(), 1);
  });

  it('proposed slots alone are enough to proceed', async () => {
    const { provider, calls } = respondingLlm();
    const res = await new DraftSkill(provider).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister: new RecordingDraftPersister(),
      schedule: {
        needsResponse: true,
        proposedSlots: [{ day: 'thursday', startLocal: '14:00', endLocal: '14:30' }],
        reasoning: 'Buyer asked for this week.',
        confidence: 0.7,
      },
      grounding: { customerContextSnippetCount: 0, preferencesPresent: false },
    });
    assert.equal(res.ok, true);
    assert.equal(calls(), 1);
  });

  it('omitted grounding skips the check entirely — a silent caller never over-refuses', async () => {
    const { provider, calls } = respondingLlm();
    const res = await new DraftSkill(provider).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister: new RecordingDraftPersister(),
      // No `grounding`, no thread, no schedule.
    });
    assert.equal(res.ok, true);
    assert.equal(calls(), 1);
  });
});

describe('DraftSkill — zero grounding holds instead of drafting', () => {
  async function heldRun() {
    const persister = new RecordingDraftPersister();
    const res = await new DraftSkill(forbiddenLlm()).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister,
      grounding: { customerContextSnippetCount: 0, preferencesPresent: false },
    });
    return { res, persister };
  }

  it('returns ok with a held draft, and never calls the model', async () => {
    const { res } = await heldRun();
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.held, true);
  });

  it('confidence is 0 and persisted is false — it cannot reach Gmail Drafts', async () => {
    const { res, persister } = await heldRun();
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.confidence, 0);
    assert.equal(res.value.persisted, false);
    assert.equal(res.value.providerDraftId, null);
    // The persistence port was never touched.
    assert.equal(persister.calls.length, 0);
  });

  it('names all four gaps by key', async () => {
    const { res } = await heldRun();
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.deepEqual(
      (res.value.missing ?? []).map((m) => m.key),
      ['customer_context', 'preferences', 'thread_summary', 'schedule'],
    );
  });

  it('the body is an operator hold note, not a sendable reply', async () => {
    const { res } = await heldRun();
    assert.ok(res.ok);
    if (!res.ok) return;
    const body = res.value.body;
    assert.match(body, /^\[HELD/);
    assert.match(body, /not a reply to send/i);
    // Every gap is named in the customer's own words.
    for (const gap of res.value.missing ?? []) {
      assert.ok(body.includes(gap.label), `hold note omitted "${gap.key}"`);
    }
    // And the terse operator line carries the keys.
    assert.match(body, /missing_inputs\[reply_draft\]/);
  });

  it('the subject is Re: the inbound subject, without double-prefixing', async () => {
    const { res } = await heldRun();
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.subject, 'Re: Question about 1420 Oak Ridge');

    const already = await new DraftSkill(forbiddenLlm()).run({
      message: inbound({ subject: 'Re: Question about 1420 Oak Ridge' }),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister: new RecordingDraftPersister(),
      grounding: { customerContextSnippetCount: 0, preferencesPresent: false },
    });
    assert.ok(already.ok);
    if (!already.ok) return;
    assert.equal(already.value.subject, 'Re: Question about 1420 Oak Ridge');
  });

  it('a blank-string thread summary counts as absent', async () => {
    const res = await new DraftSkill(forbiddenLlm()).run({
      message: inbound(),
      prompts: PROMPTS,
      workspaceId: 'ws_1',
      persister: new RecordingDraftPersister(),
      thread: {
        threadId: 't1',
        summary: '   ',
        referencedThreadIds: [],
        priorMessages: [],
      },
      grounding: { customerContextSnippetCount: 0, preferencesPresent: false },
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.held, true);
  });
});
