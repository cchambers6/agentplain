/**
 * lib/plaino/support-chat-inputs.test.ts
 *
 * Pins the support chat's pre-generation requirements check, and in
 * particular the line it exists to draw: an EMPTY grounding load is not a
 * failed one. Over-refusing here would be its own bug — a workspace with
 * nothing saved yet must still get answers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSupportChatInputs } from './support-chat-inputs';

const BANNED = [
  'line',
  'reaching',
  'endpoint',
  'api',
  'stack',
  'http',
  '500',
  'request',
  'fetch',
  'server',
  'token',
  'anthropic',
];

describe('checkSupportChatInputs — proceeds when the turn is still answerable', () => {
  it('all inputs available → no refusal', () => {
    assert.equal(
      checkSupportChatInputs({
        workspaceFound: true,
        snapshotFailed: false,
        knowledgeFailed: false,
      }),
      null,
    );
  });

  it('snapshot failed but knowledge is fine → no refusal', () => {
    assert.equal(
      checkSupportChatInputs({
        workspaceFound: true,
        snapshotFailed: true,
        knowledgeFailed: false,
      }),
      null,
    );
  });

  it('knowledge failed but the snapshot is fine → no refusal', () => {
    assert.equal(
      checkSupportChatInputs({
        workspaceFound: true,
        snapshotFailed: false,
        knowledgeFailed: true,
      }),
      null,
    );
  });

  it('empty-but-ok knowledge is NOT a failure — a new workspace still gets answers', () => {
    // knowledgeFailed=false is what a `{ ok: true, hits: [] }` lookup
    // produces. Nothing matched; the prompt's honest path handles it.
    assert.equal(
      checkSupportChatInputs({
        workspaceFound: true,
        snapshotFailed: false,
        knowledgeFailed: false,
      }),
      null,
    );
  });
});

describe('checkSupportChatInputs — refuses when nothing is grounded', () => {
  it('workspace row missing → report naming it', () => {
    const report = checkSupportChatInputs({
      workspaceFound: false,
      snapshotFailed: false,
      knowledgeFailed: false,
    });
    assert.ok(report, 'expected a missing-inputs report');
    assert.equal(report.surface, 'SUPPORT_CHAT');
    assert.deepEqual(
      report.missing.map((m) => m.key),
      ['workspace'],
    );
  });

  it('both grounding loads failed → report naming both', () => {
    const report = checkSupportChatInputs({
      workspaceFound: true,
      snapshotFailed: true,
      knowledgeFailed: true,
    });
    assert.ok(report);
    assert.deepEqual(
      report.missing.map((m) => m.key),
      ['capability_snapshot', 'knowledge'],
    );
  });

  it('everything down → all three gaps, workspace first', () => {
    const report = checkSupportChatInputs({
      workspaceFound: false,
      snapshotFailed: true,
      knowledgeFailed: true,
    });
    assert.ok(report);
    assert.deepEqual(
      report.missing.map((m) => m.key),
      ['workspace', 'capability_snapshot', 'knowledge'],
    );
  });

  it('the notice names what Plaino can’t see and offers the hand-off', () => {
    const report = checkSupportChatInputs({
      workspaceFound: true,
      snapshotFailed: true,
      knowledgeFailed: true,
    });
    assert.ok(report);
    const notice = report.customerNotice;
    for (const gap of report.missing) {
      assert.ok(
        notice.includes(gap.label),
        `owner notice should name "${gap.key}" in their words: ${notice}`,
      );
    }
    assert.match(notice, /email/i);
    assert.match(notice, /follow up/i);
    assert.ok(!notice.includes('!'), `notice raised its voice: ${notice}`);
  });

  it('every refusal notice passes the no-jargon list', () => {
    const cases = [
      { workspaceFound: false, snapshotFailed: false, knowledgeFailed: false },
      { workspaceFound: true, snapshotFailed: true, knowledgeFailed: true },
      { workspaceFound: false, snapshotFailed: true, knowledgeFailed: true },
    ];
    for (const c of cases) {
      const report = checkSupportChatInputs(c);
      assert.ok(report);
      const lower = report.customerNotice.toLowerCase();
      for (const term of BANNED) {
        assert.ok(
          !lower.includes(term),
          `refusal copy leaked dev jargon "${term}": ${report.customerNotice}`,
        );
      }
    }
  });

  it('the operator note names the machine keys', () => {
    const report = checkSupportChatInputs({
      workspaceFound: false,
      snapshotFailed: true,
      knowledgeFailed: true,
    });
    assert.ok(report);
    for (const key of ['workspace', 'capability_snapshot', 'knowledge']) {
      assert.ok(report.operatorNote.includes(key), report.operatorNote);
    }
  });
});
