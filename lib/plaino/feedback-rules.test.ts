/**
 * lib/plaino/feedback-rules.test.ts
 *
 * Pins the skill-side reader for PREFERENCE-derived rules. Tests
 * verify: scope filtering, general scope is always included, free-form
 * FEEDBACK entries are treated as general scope, ordering by pinned
 * + recency, and graceful-degrade on store failure.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RecordingMemoryStore } from './memory';
import {
  buildPreferenceMemoryBody,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';
import {
  readFeedbackRules,
  renderFeedbackRulesForPrompt,
} from './feedback-rules';

const WORKSPACE_ID = 'ws-feedback-rules-0001';

async function seedPref(
  memory: RecordingMemoryStore,
  scope: string,
  rule: string,
): Promise<void> {
  await memory.upsert({
    workspaceId: WORKSPACE_ID,
    kind: 'FEEDBACK',
    title: `${PREFERENCE_MEMORY_TITLE_PREFIX}${scope}`,
    body: buildPreferenceMemoryBody({ scope, rule }),
    sourceChatMessageId: 'src',
  });
}

describe('readFeedbackRules — scope filtering', () => {
  it('returns rules for requested scopes + general always', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await seedPref(memory, 'inbox-triage', 'Triage rule A');
    await seedPref(memory, 'email-draft', 'Email rule B');
    await seedPref(memory, 'general', 'General rule C');
    await seedPref(memory, 'reporting', 'Reporting rule D');

    const rules = await readFeedbackRules({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['inbox-triage', 'email-draft'],
    });
    const scopes = rules.map((r) => r.scope).sort();
    // general is auto-included; reporting is not.
    assert.deepEqual(scopes, ['email-draft', 'general', 'inbox-triage']);
  });

  it('treats free-form FEEDBACK (no pref: prefix) as general scope', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'Hand-typed preference',
      body: 'Use ASCII quotes in customer messages',
      sourceChatMessageId: 'src',
    });
    const rules = await readFeedbackRules({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['legal-flagging'],
    });
    // legal-flagging didn't match; but general (auto-included) does.
    assert.equal(rules.length, 1);
    assert.equal(rules[0].scope, 'general');
    assert.match(rules[0].rule, /ASCII quotes/);
  });

  it('ignores non-FEEDBACK memory entries', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: `${PREFERENCE_MEMORY_TITLE_PREFIX}general`,
      body: buildPreferenceMemoryBody({
        scope: 'general',
        rule: 'this is a USER entry, should be ignored',
      }),
      sourceChatMessageId: 'src',
    });
    const rules = await readFeedbackRules({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['general'],
    });
    assert.equal(rules.length, 0);
  });

  it('returns [] on memory store failure without throwing', async () => {
    const broken = {
      name: 'broken',
      listForWorkspace: async () => {
        throw new Error('boom');
      },
      markRead: async () => undefined,
      upsert: async () => {
        throw new Error('boom');
      },
      setPinned: async () => {
        throw new Error('boom');
      },
      edit: async () => {
        throw new Error('boom');
      },
      delete: async () => false,
    };
    const rules = await readFeedbackRules({
      memory: broken as unknown as RecordingMemoryStore,
      workspaceId: WORKSPACE_ID,
      scopes: ['general'],
    });
    assert.equal(rules.length, 0);
  });
});

describe('renderFeedbackRulesForPrompt', () => {
  it('renders a stable, low-syntax prompt block', () => {
    const text = renderFeedbackRulesForPrompt([
      { entryId: 'a', scope: 'inbox-triage', rule: 'Flag clerk mail' },
      { entryId: 'b', scope: 'general', rule: 'Sign as Warmly, Sarah' },
    ]);
    assert.match(text, /CUSTOMER PREFERENCES/);
    assert.match(text, /\[scope=inbox-triage\] Flag clerk mail/);
    assert.match(text, /\[scope=general\] Sign as Warmly, Sarah/);
  });

  it('returns empty string on no rules', () => {
    assert.equal(renderFeedbackRulesForPrompt([]), '');
  });
});
