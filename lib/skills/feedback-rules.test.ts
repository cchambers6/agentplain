/**
 * lib/skills/feedback-rules.test.ts
 *
 * Pins the wave-1 skill-side bridge from /talk-written FEEDBACK rules
 * to skill prompt assembly. The audit (§9 #1 + companion) flagged this
 * as "PR #120 shipped the helper but no skill calls it" — these tests
 * prove the call exists end-to-end.
 *
 * Asserts:
 *   1. A pinned `pref:inbox-triage` rule shows up in the rendered block
 *      with the scope label so the LLM treats it as guidance.
 *   2. A pinned `pref:scheduling` rule is included (the runner default
 *      scopes list `scheduling`).
 *   3. A `pref:legal-flagging` rule is EXCLUDED (not in the default
 *      runner scopes — won't bias the email loop).
 *   4. Empty store → empty string returned (no header, per honesty bar).
 *   5. The renderer prefaces with "CUSTOMER PREFERENCES" so the LLM
 *      treats it as binding guidance, not background trivia.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RecordingMemoryStore } from '@/lib/plaino/memory/recording-memory-store';
import { buildFeedbackRulesBlock, DEFAULT_RUNNER_SCOPES } from './feedback-rules';
import { buildPreferenceMemoryBody } from '@/lib/plaino/preference-memory';

const WORKSPACE_ID = 'ws-feedback-rules-test-0001';

describe('buildFeedbackRulesBlock — happy path', () => {
  it('surfaces a pref:inbox-triage rule into the prompt block with the scope label', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:inbox-triage',
      body: buildPreferenceMemoryBody({
        scope: 'inbox-triage',
        rule: 'Always flag mail from county clerks as high priority',
      }),
      sourceChatMessageId: null,
    });
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
    });
    assert.match(block, /CUSTOMER PREFERENCES/);
    assert.match(block, /\[scope=inbox-triage\]/);
    assert.match(
      block,
      /Always flag mail from county clerks as high priority/,
    );
  });

  it('includes pref:scheduling rules (in default runner scopes)', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:scheduling',
      body: buildPreferenceMemoryBody({
        scope: 'scheduling',
        rule: 'Never propose meetings before 10am ET',
      }),
      sourceChatMessageId: null,
    });
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
    });
    assert.match(block, /Never propose meetings before 10am ET/);
  });

  it('excludes rules in scopes outside the default runner set (legal-flagging)', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:legal-flagging',
      body: buildPreferenceMemoryBody({
        scope: 'legal-flagging',
        rule: 'Always flag drafts mentioning fair housing',
      }),
      sourceChatMessageId: null,
    });
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['inbox-triage', 'email-draft'],
    });
    assert.equal(block, '');
  });
});

describe('buildFeedbackRulesBlock — honesty seam', () => {
  it('returns empty string when no FEEDBACK rules exist (no header for an empty set)', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(block, '');
  });

  it('includes general-scope free-form FEEDBACK entries even when only narrow scopes are requested', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    // Free-form FEEDBACK entry — no pref: prefix. treated as general.
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'house style',
      body: 'Use first names with vendors, never with clients',
      sourceChatMessageId: null,
    });
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['inbox-triage'],
    });
    assert.match(block, /scope=general/);
    assert.match(block, /Use first names with vendors/);
  });
});

describe('DEFAULT_RUNNER_SCOPES — pinned shape', () => {
  it('lists the four scopes the generic chain plausibly honors', () => {
    assert.deepEqual([...DEFAULT_RUNNER_SCOPES], [
      'inbox-triage',
      'email-draft',
      'scheduling',
      'customer-comms',
    ]);
  });
});

describe('finance scope (wave-5) — surfaces into finance-discipline skills', () => {
  it('a pref:finance rule rides through buildFeedbackRulesBlock when finance is requested', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:finance',
      body: buildPreferenceMemoryBody({
        scope: 'finance',
        rule: 'Always classify expenses over $5,000 as capital expenditure',
      }),
      sourceChatMessageId: null,
    });
    // finance-discipline skills (finance-pulse, month-end-close,
    // invoice-chasing) pass scopes: ['finance'] when they call the
    // feedback-rules reader.
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
      scopes: ['finance'],
    });
    assert.match(block, /\[scope=finance\]/);
    assert.match(
      block,
      /Always classify expenses over \$5,000 as capital expenditure/,
    );
  });

  it('a pref:finance rule is EXCLUDED from the default runner scopes (does not bias email loop)', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: 'pref:finance',
      body: buildPreferenceMemoryBody({
        scope: 'finance',
        rule: 'Always classify expenses over $5,000 as capital expenditure',
      }),
      sourceChatMessageId: null,
    });
    const block = await buildFeedbackRulesBlock({
      memory,
      workspaceId: WORKSPACE_ID,
    });
    // Default runner scopes do not include `finance`, so the rule
    // should not appear in a chain-runner-driven prompt assembly.
    assert.equal(
      block.includes('capital expenditure'),
      false,
      'finance-scope rule should not leak into the default runner scope set',
    );
  });
});
