/**
 * tests/observability-sentry-scrub.test.ts
 *
 * Asserts that the Sentry beforeSend scrubber strips customer content
 * (BODY: blocks, INBOUND MESSAGE BODY: blocks, email addresses, known
 * content-bearing object keys) from any event the SDK would ship.
 *
 * Also exercises the patched error paths that previously embedded raw
 * LLM responses or customer content in their error messages:
 *   - lib/skills/categorize.ts parseCategorizationJson
 *   - lib/skills/draft.ts parseDraftJson
 *   - lib/skills/office-admin/classifier.ts parseClassificationJson
 *   - lib/skills/runner.ts redactSkillRunRecord (JSONL audit redaction)
 *
 * Per the data-privacy audit (PR #91 must-close #3): customer content
 * must not reach Sentry or the on-disk JSONL audit log. The scrubber
 * is the last-line-of-defense; the patched call sites are the primary
 * fix. This test covers both.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  scrubSentryEvent,
  scrubString,
  scrubObject,
} from '@/lib/observability/sentry-scrub';
import { redactSkillRunRecord } from '@/lib/skills/runner';
import type { SkillRunRecord } from '@/lib/skills/types';

// ── Helpers ─────────────────────────────────────────────────────────────

const SAMPLE_EMAIL = 'jane.doe+filter@buyer-domain.example.com';
const SAMPLE_BODY = [
  'Hello, this is the inbound message body.',
  '',
  'It contains sensitive customer content like account numbers 1234-5678.',
  'Please do not log this anywhere.',
].join('\n');

const SAMPLE_DRAFT_BODY = [
  "Hi Jane,",
  "",
  "Thanks for reaching out. We can look at Tuesday at 2pm or",
  "Wednesday at 10am. Either works for me.",
  "",
  "Best,",
  "Conner",
].join('\n');

function eventLooksScrubbed(event: { message?: string; exception?: any; extra?: any; breadcrumbs?: any[] }): void {
  // No raw email addresses anywhere.
  assert.ok(
    !JSON.stringify(event).includes(SAMPLE_EMAIL),
    'event still includes the raw email address',
  );
  // No BODY: markers (they should have been stripped along with the block).
  assert.ok(
    !JSON.stringify(event).includes(SAMPLE_BODY.slice(0, 40)),
    'event still includes the raw body block',
  );
}

// ── scrubString ─────────────────────────────────────────────────────────

describe('scrubString', () => {
  it('redacts email addresses to a fixed token', () => {
    const input = `Failed to send to ${SAMPLE_EMAIL} after 3 retries`;
    const out = scrubString(input);
    assert.ok(!out.includes(SAMPLE_EMAIL));
    assert.ok(out.includes('[redacted-email]'));
  });

  it('strips a BODY: block to end-of-string (our prompt templates put body last)', () => {
    const input = [
      'categorize response was not JSON',
      'FROM: someone@example.com',
      'SUBJECT: Quote request',
      '',
      'BODY:',
      SAMPLE_BODY,
    ].join('\n');
    const out = scrubString(input);
    assert.ok(!out.includes('account numbers 1234-5678'));
    assert.ok(!out.includes('Please do not log this anywhere.'));
    assert.ok(out.includes('[redacted-body]'));
    // Header lines BEFORE the marker still scrubbed for emails but
    // otherwise preserved — operators need to see what shape of error.
    assert.ok(out.includes('categorize response was not JSON'));
    assert.ok(out.includes('SUBJECT: Quote request'));
  });

  it('strips an INBOUND MESSAGE BODY: block', () => {
    const input = `Draft prompt:\nINBOUND MESSAGE BODY:\n${SAMPLE_BODY}`;
    const out = scrubString(input);
    assert.ok(!out.includes('account numbers 1234-5678'));
    assert.ok(out.includes('[redacted-body]'));
  });

  it('truncates strings beyond the max length', () => {
    const big = 'x'.repeat(5000);
    const out = scrubString(big);
    assert.ok(out.length <= 1024 + '…[truncated]'.length);
    assert.ok(out.endsWith('…[truncated]'));
  });

  it('redacts multiple email addresses in one string', () => {
    const a = 'alice@example.com';
    const b = 'bob+work@buyer.co.uk';
    const input = `cc list: ${a}, ${b}, ${a}`;
    const out = scrubString(input);
    assert.ok(!out.includes(a));
    assert.ok(!out.includes(b));
    assert.equal(out.match(/\[redacted-email\]/g)?.length, 3);
  });
});

// ── scrubObject ─────────────────────────────────────────────────────────

describe('scrubObject', () => {
  it('wholesale-redacts known content-bearing keys', () => {
    const obj = {
      workspaceId: 'ws_abc',
      draftId: 'd_123',
      body: SAMPLE_DRAFT_BODY,
      subject: 'Re: Quote request',
      snippet: 'Quote response body...',
      tone: 'casual',
    };
    const out = scrubObject(obj);
    assert.equal(out.workspaceId, 'ws_abc');
    assert.equal(out.draftId, 'd_123');
    assert.equal(out.body, '[redacted-body]');
    assert.equal(out.subject, '[redacted-body]');
    assert.equal(out.snippet, '[redacted-body]');
    assert.equal(out.tone, 'casual');
  });

  it('recursively scrubs nested objects', () => {
    const obj = {
      outer: {
        nested: {
          body: SAMPLE_DRAFT_BODY,
          identifier: 'keep-me',
        },
        log: `Sender ${SAMPLE_EMAIL} replied with: hi`,
      },
    };
    const out = scrubObject(obj);
    const outer = out.outer as Record<string, unknown>;
    const nested = outer.nested as Record<string, unknown>;
    assert.equal(nested.body, '[redacted-body]');
    assert.equal(nested.identifier, 'keep-me');
    assert.ok(typeof outer.log === 'string');
    assert.ok(!(outer.log as string).includes(SAMPLE_EMAIL));
  });
});

// ── scrubSentryEvent ────────────────────────────────────────────────────

describe('scrubSentryEvent', () => {
  it('scrubs the top-level message + exception values + breadcrumbs + extra', () => {
    const event = {
      // Message uses a BODY: marker — the prompt-template shape, last-in.
      message: `categorize response was not JSON — got: BODY:\n${SAMPLE_BODY}`,
      exception: {
        values: [
          { value: `draft response not JSON — sender ${SAMPLE_EMAIL}` },
        ],
      },
      // Customer content lands in structured slots (breadcrumb data,
      // extra.draft.body) — these get wholesale-redacted by the
      // content-key list, even when the string itself has no marker.
      breadcrumbs: [
        { message: `received message from ${SAMPLE_EMAIL}`, data: { body: SAMPLE_BODY } },
      ],
      extra: {
        draft: { body: SAMPLE_DRAFT_BODY, draftId: 'd_xyz' },
        log: `cc'd ${SAMPLE_EMAIL}`,
      },
    };
    const out = scrubSentryEvent(event);
    eventLooksScrubbed(out);
    // Exception value: email redacted.
    assert.ok(out.exception?.values?.[0]?.value?.includes('[redacted-email]'));
    // Breadcrumb message: email redacted.
    assert.ok(out.breadcrumbs?.[0]?.message?.includes('[redacted-email]'));
    // Breadcrumb data.body: wholesale-replaced via content-key.
    const crumbData = out.breadcrumbs?.[0]?.data as Record<string, unknown>;
    assert.equal(crumbData.body, '[redacted-body]');
    // Extra.draft.body: wholesale-replaced; draftId stayed.
    const extra = out.extra as Record<string, unknown>;
    const draft = extra.draft as Record<string, unknown>;
    assert.equal(draft.body, '[redacted-body]');
    assert.equal(draft.draftId, 'd_xyz');
    // Extra.log: email redacted but rest of string preserved.
    assert.ok(typeof extra.log === 'string');
    assert.ok((extra.log as string).includes('[redacted-email]'));
  });

  it('preserves operational fields unchanged', () => {
    const event = {
      message: 'workspace_id ws_abc123 failed to load',
      extra: { workspaceId: 'ws_abc123', durationMs: 412, status: 'failed' },
    };
    const out = scrubSentryEvent(event);
    assert.equal(out.message, 'workspace_id ws_abc123 failed to load');
    const extra = out.extra as Record<string, unknown>;
    assert.equal(extra.workspaceId, 'ws_abc123');
    assert.equal(extra.durationMs, 412);
    assert.equal(extra.status, 'failed');
  });
});

// ── Patched error paths ─────────────────────────────────────────────────

describe('patched error paths do not embed customer content', () => {
  it('categorize parse error: response text is NOT in the error message', async () => {
    const { CategorizeSkill } = await import('@/lib/skills/categorize');
    const { getPromptBundleByEnum } = await import('@/lib/skills/prompts/index');

    // Hand-crafted LLM provider that returns a string containing the
    // sample body where JSON was expected. The skill should produce a
    // PARSE_ERROR whose message DOES NOT include the body text.
    const echoBody = `not-json content ${SAMPLE_BODY}`;
    const llm = {
      name: 'test-echo',
      complete: async () => ({ ok: true, value: { text: echoBody, modelName: 'test' } }),
    } as any;
    const skill = new CategorizeSkill(llm);
    const prompts = getPromptBundleByEnum('REAL_ESTATE');
    const res = await skill.run({
      message: {
        id: 'm1',
        threadId: 't1',
        rfcMessageId: null,
        fromEmail: SAMPLE_EMAIL,
        fromName: 'Jane',
        toEmails: [],
        ccEmails: [],
        subject: 'test',
        bodyText: SAMPLE_BODY,
        snippet: 'snippet',
        references: [],
        inReplyTo: null,
        attachments: [],
        receivedAt: new Date('2026-05-26T12:00:00Z'),
        labels: [],
      },
      prompts,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'PARSE_ERROR');
      assert.ok(!res.error.message.includes('account numbers 1234-5678'));
      assert.ok(!res.error.message.includes(SAMPLE_BODY.slice(0, 40)));
      assert.ok(res.error.message.includes('responseLen='));
    }
  });

  it('draft parse error: response text is NOT in the error message', async () => {
    const { DraftSkill, RecordingDraftPersister } = await import('@/lib/skills/draft');
    const { getPromptBundleByEnum } = await import('@/lib/skills/prompts/index');

    const echoBody = `not-json ${SAMPLE_DRAFT_BODY}`;
    const llm = {
      name: 'test-echo',
      complete: async () => ({ ok: true, value: { text: echoBody, modelName: 'test' } }),
    } as any;
    const skill = new DraftSkill(llm);
    const prompts = getPromptBundleByEnum('REAL_ESTATE');
    const res = await skill.run({
      message: {
        id: 'm1',
        threadId: 't1',
        rfcMessageId: null,
        fromEmail: SAMPLE_EMAIL,
        fromName: 'Jane',
        toEmails: [],
        ccEmails: [],
        subject: 'test',
        bodyText: SAMPLE_BODY,
        snippet: 'snippet',
        references: [],
        inReplyTo: null,
        attachments: [],
        receivedAt: new Date('2026-05-26T12:00:00Z'),
        labels: [],
      },
      prompts,
      workspaceId: 'ws_test',
      persister: new RecordingDraftPersister(),
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'PARSE_ERROR');
      assert.ok(!res.error.message.includes('Tuesday at 2pm'));
      assert.ok(!res.error.message.includes(SAMPLE_DRAFT_BODY.slice(0, 40)));
      assert.ok(res.error.message.includes('responseLen='));
    }
  });
});

// ── redactSkillRunRecord ────────────────────────────────────────────────

describe('redactSkillRunRecord (JSONL audit redaction)', () => {
  it('strips draft body + subject while keeping identifiers + timings', () => {
    const record: SkillRunRecord = {
      startedAt: '2026-05-26T12:00:00.000Z',
      finishedAt: '2026-05-26T12:00:03.500Z',
      durationMs: 3500,
      workspaceId: 'ws_test',
      workspaceSlug: 'test-ws',
      verticalSlug: 'real-estate',
      webhookEventId: 'evt_123',
      llmProviderName: 'anthropic',
      fetcherName: 'gmail',
      persisterName: 'gmail-drafts',
      steps: [
        {
          step: 'read',
          ok: true,
          summary: 'fetched 1 message',
          durationMs: 120,
        },
        {
          step: 'categorize',
          ok: true,
          summary: `intent=draft-needed conf=0.92 — sender asked about ${SAMPLE_BODY.slice(0, 40)}`,
          durationMs: 800,
        },
      ],
      outcome: {
        category: 'draft-needed',
        threadId: 'thr_abc',
        scheduledProposal: null,
        draft: {
          draftId: 'd_xyz',
          providerDraftId: 'gmail_d_xyz',
          subject: 'Re: Quote request',
          body: SAMPLE_DRAFT_BODY,
          tone: 'casual',
          confidence: 0.88,
          persisted: true,
        },
        markedProcessed: true,
        officeAdmin: null,
        officeAdminPayload: null,
        complianceFlags: null,
      },
    };
    const redacted = redactSkillRunRecord(record);
    const serialized = JSON.stringify(redacted);

    // Customer content gone.
    assert.ok(!serialized.includes('Tuesday at 2pm'));
    assert.ok(!serialized.includes('Re: Quote request'));
    assert.ok(!serialized.includes(SAMPLE_BODY.slice(0, 40)));
    assert.ok(!serialized.includes('Conner'));

    // Identifiers, timings, status preserved.
    assert.equal(redacted.workspaceId, 'ws_test');
    assert.equal(redacted.webhookEventId, 'evt_123');
    assert.equal(redacted.outcome.draft?.draftId, 'd_xyz');
    assert.equal(redacted.outcome.draft?.providerDraftId, 'gmail_d_xyz');
    assert.equal(redacted.outcome.draft?.tone, 'casual');
    assert.equal(redacted.outcome.draft?.confidence, 0.88);
    assert.equal(redacted.outcome.draft?.persisted, true);
    assert.equal(redacted.outcome.category, 'draft-needed');
    assert.equal(redacted.steps[0].step, 'read');
    assert.equal(redacted.steps[0].durationMs, 120);
    assert.equal(redacted.steps[1].step, 'categorize');
    assert.equal(redacted.steps[1].ok, true);
  });

  it('redacts compliance flag matchedText + excerpt', () => {
    const record: SkillRunRecord = {
      startedAt: '2026-05-26T12:00:00.000Z',
      finishedAt: '2026-05-26T12:00:01.000Z',
      durationMs: 1000,
      workspaceId: 'ws_test',
      workspaceSlug: 'test-ws',
      verticalSlug: 'real-estate',
      webhookEventId: 'evt_124',
      llmProviderName: 'anthropic',
      fetcherName: 'gmail',
      persisterName: 'gmail-drafts',
      steps: [],
      outcome: {
        category: 'draft-needed',
        threadId: 'thr_abc',
        scheduledProposal: null,
        draft: null,
        markedProcessed: true,
        officeAdmin: null,
        officeAdminPayload: null,
        complianceFlags: [
          {
            flagId: 'flag_1',
            ruleId: 'fairhousing-familial-status',
            ruleTitle: 'Familial status discrimination',
            category: 'familial-status',
            matchedPhrase: 'no children',
            matchedText: 'no children allowed in this home',
            start: 50,
            end: 82,
            excerpt: '...we prefer no children allowed in this home, sorry...',
            source: 'body',
            citation: {
              source: 'Fair Housing Act',
              url: null,
              section: '§ 3604',
            } as any,
          },
        ],
      },
    };
    const redacted = redactSkillRunRecord(record);
    const serialized = JSON.stringify(redacted);
    // The literal draft text that triggered the flag is gone, but the
    // rule identity stays so operators still see which rule fired.
    assert.ok(!serialized.includes('no children allowed in this home'));
    assert.ok(serialized.includes('fairhousing-familial-status'));
    assert.ok(serialized.includes('no children')); // matchedPhrase (corpus rule, not customer text)
    assert.equal(redacted.outcome.complianceFlags?.[0].matchedText, '[redacted]');
    assert.equal(redacted.outcome.complianceFlags?.[0].excerpt, '[redacted]');
  });
});
