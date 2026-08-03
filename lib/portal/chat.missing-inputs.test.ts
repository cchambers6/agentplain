/**
 * lib/portal/chat.missing-inputs.test.ts
 *
 * Pins the portal draft's pre-generation requirements check.
 *
 * Scope note: `checkPortalDraftInputs` is deliberately PURE so the policy
 * can be pinned without a database. The wiring inside
 * `runPortalChatTurn()` — persist the client's message, THEN check, THEN
 * (only if the check passes) call the model — is DB-bound: it opens
 * `withSystemContext` transactions against Prisma on every path, so it is
 * exercised by the portal integration suite rather than here. What this
 * file guarantees is the decision itself, which is the part that can
 * silently regress into "draft on nothing".
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPortalDraftInputs, type PortalChatContext } from './chat';

function ctx(overrides: Partial<PortalChatContext> = {}): PortalChatContext {
  return {
    portalConfigId: 'pc_1',
    workspaceId: 'ws_1',
    clientId: 'cl_1',
    clientEmail: 'client@example.com',
    brandName: 'Peachtree Realty',
    threadId: 'th_1',
    ...overrides,
  };
}

describe('checkPortalDraftInputs — proceeds when the draft has something to stand on', () => {
  it('case-scoped with both title and status → no refusal', () => {
    const report = checkPortalDraftInputs(
      ctx({ caseId: 'case_1', caseTitle: '1420 Oak Ridge closing', caseStatus: 'under contract' }),
    );
    assert.equal(report, null);
  });

  it('case-scoped with only a title → no refusal (one fact is enough)', () => {
    assert.equal(
      checkPortalDraftInputs(ctx({ caseId: 'case_1', caseTitle: '1420 Oak Ridge closing' })),
      null,
    );
  });

  it('case-scoped with only a status → no refusal', () => {
    assert.equal(
      checkPortalDraftInputs(ctx({ caseId: 'case_1', caseStatus: 'under contract' })),
      null,
    );
  });

  it('a general (caseless) thread is exempt — it never promised case facts', () => {
    assert.equal(checkPortalDraftInputs(ctx({ caseId: null })), null);
    assert.equal(checkPortalDraftInputs(ctx()), null);
    // Even with nothing else set: no case scope, no requirement.
    assert.equal(
      checkPortalDraftInputs(ctx({ caseId: null, caseTitle: null, caseStatus: null })),
      null,
    );
  });
});

describe('checkPortalDraftInputs — refuses when the case is a blank', () => {
  it('case-scoped with both absent → names exactly the two gaps', () => {
    const report = checkPortalDraftInputs(ctx({ caseId: 'case_1' }));
    assert.ok(report, 'expected a missing-inputs report');
    assert.equal(report.kind, 'MISSING_INPUTS');
    assert.equal(report.surface, 'PORTAL_CHAT');
    assert.deepEqual(
      report.missing.map((m) => m.key),
      ['case_title', 'case_status'],
    );
  });

  it('treats empty strings and whitespace as absent', () => {
    const report = checkPortalDraftInputs(
      ctx({ caseId: 'case_1', caseTitle: '', caseStatus: '   ' }),
    );
    assert.ok(report, 'blank case fields are not case facts');
    assert.equal(report.missing.length, 2);
  });

  it('the client-facing notice is calm, branded, and gap-free', () => {
    const report = checkPortalDraftInputs(ctx({ caseId: 'case_1' }));
    assert.ok(report);
    const notice = report.customerNotice;
    // Same posture as the DRAFT_FAILED path: message received, person coming.
    assert.match(notice, /Peachtree Realty/);
    assert.match(notice, /follow up/i);
    assert.ok(!notice.includes('!'), `notice raised its voice: ${notice}`);
    // The end-client is never handed the internal gap list.
    for (const gap of report.missing) {
      assert.ok(
        !notice.includes(gap.label) && !notice.includes(gap.key),
        `client notice leaked the gap "${gap.key}"`,
      );
    }
    for (const banned of ['line', 'api', 'server', 'request', 'stack', 'fetch']) {
      assert.ok(
        !notice.toLowerCase().includes(banned),
        `client notice leaked dev jargon "${banned}": ${notice}`,
      );
    }
  });

  it('the operator note names the machine keys', () => {
    const report = checkPortalDraftInputs(ctx({ caseId: 'case_1' }));
    assert.ok(report);
    assert.match(report.operatorNote, /case_title/);
    assert.match(report.operatorNote, /case_status/);
  });
});
