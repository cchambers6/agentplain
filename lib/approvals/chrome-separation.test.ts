/**
 * lib/approvals/chrome-separation.test.ts
 *
 * The check that REPLACES the card-chrome regexes.
 *
 * PR #465 stripped card chrome out of the handoff artifact with per-kind
 * regexes run over `RenderedApproval.body` -- i.e. over the customer's own
 * prose. It went four audit rounds and was parked ("no fourth regex tune")
 * after it silently deleted a customer's paragraph.
 *
 * Chrome is now a NAMED FIELD (`RenderedApproval.chrome`) and the artifact
 * builder simply does not read it. There is nothing left to pattern-match, so
 * the class of defect is gone -- but the SEPARATION has to be enforced
 * somewhere, or a future render site quietly puts a chrome sentence back into
 * `body` and the artifact starts lying again.
 *
 * This suite is that enforcement, and it is anchored to the PRODUCER: it
 * drives the real `renderApprovalPayload` across every WorkApprovalKind and
 * asserts the separation holds, in both directions.
 *
 * It reports `examined N of M` and fails when N is zero, because "found
 * nothing" and "examined nothing" are otherwise indistinguishable -- an
 * assertion over an empty input set passes green while checking nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkApprovalKind } from '@prisma/client';

import { renderApprovalPayload } from '@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload';
import { buildApprovalArtifact } from './artifact';

/** All 30, from the Prisma enum. A 31st kind that is not added here is
 *  invisible to this check, so keep it in step with prisma/schema.prisma. */
const ALL_KINDS: readonly WorkApprovalKind[] = [
  'COMPLIANCE_FLAG',
  'LISTING_RECOMMENDATION',
  'BUYER_INQUIRY_REPLY_DRAFT',
  'PRICING_RECOMMENDATION',
  'ADMIN_VERIFICATION_CODE',
  'ADMIN_PASSWORD_RESET',
  'ADMIN_TRIAL_ENDING',
  'ADMIN_BILLING_NOTICE',
  'ADMIN_SECURITY_ALERT',
  'CHIEF_OF_STAFF_MEETING',
  'CHIEF_OF_STAFF_REPLY_DRAFT',
  'CHIEF_OF_STAFF_TODO',
  'INBOX_TRIAGE',
  'FOLLOW_UP_NUDGE',
  'PROCESS_DOC_DRAFT',
  'SUPPORT_HANDLER_REPLY_DRAFT',
  'PLAINO_INSTRUCTION',
  'LEAD_TRIAGE',
  'ANALYTICS_PULSE',
  'RESEARCH_BRIEF',
  'CONTENT_CALENDAR',
  'COMPLIANCE_DIGEST',
  'FINANCE_PULSE',
  'ACTIVATION_DRAFT',
  'DOCUSIGN_SEND_ENVELOPE',
  'DOCUSIGN_VOID_ENVELOPE',
  'CONNECTOR_WRITE_ACTION',
  'VOICE_CALL_ACTION_ITEM',
  'VOICE_RECORDING_CONSENT',
  'PORTAL_CLIENT_MESSAGE',
] as const;

/** The kinds whose renderer emits a pending-state promise. */
const CHROME_EMITTING_KINDS: readonly WorkApprovalKind[] = [
  'DOCUSIGN_SEND_ENVELOPE',
  'DOCUSIGN_VOID_ENVELOPE',
  'CONNECTOR_WRITE_ACTION',
  'PORTAL_CLIENT_MESSAGE',
  'VOICE_RECORDING_CONSENT',
] as const;

/**
 * ASCII-safe fragments of the five chrome sentences. Deliberately fragments
 * rather than whole literals: the sentences contain em dashes, and settling an
 * encoding question with a pasted literal is how a mojibake check once
 * reported zero occurrences on a file that had one.
 */
const CHROME_MARKERS = [
  'Awaiting your approval',
  'Nothing has been sent',
  'Nothing has been voided',
  'Nothing has happened in',
  'Recording stays off until you approve it here',
] as const;

function containsChrome(lines: readonly string[]): string | null {
  for (const line of lines) {
    for (const marker of CHROME_MARKERS) {
      if (line.includes(marker)) return `${marker} | in: ${line}`;
    }
  }
  return null;
}

describe('card chrome is separated from body BY FIELD, for every kind', () => {
  it('no renderer puts a chrome sentence into `body`', () => {
    let examined = 0;
    const offenders: string[] = [];

    for (const kind of ALL_KINDS) {
      // Empty payload: whatever appears in `body` was emitted by the
      // RENDERER itself, never by a customer. That is what makes this a
      // producer-anchored check rather than a prose scan.
      const rendered = renderApprovalPayload(kind, {});
      examined += 1;
      const hit = containsChrome(rendered.body);
      if (hit) offenders.push(`${kind}: ${hit}`);
    }

    assert.ok(examined > 0, 'examined nothing -- the input set was empty');
    assert.equal(examined, ALL_KINDS.length, `examined ${examined} of ${ALL_KINDS.length}`);
    assert.deepEqual(offenders, [], `chrome leaked into body: ${offenders.join(' ;; ')}`);
  });

  it('the five chrome-emitting kinds DO populate `chrome`', () => {
    let examined = 0;
    for (const kind of CHROME_EMITTING_KINDS) {
      const rendered = renderApprovalPayload(kind, {});
      examined += 1;
      assert.ok(
        rendered.chrome && rendered.chrome.length > 0,
        `${kind} must emit its pending-state promise in \`chrome\``,
      );
      assert.ok(
        containsChrome(rendered.chrome!),
        `${kind}'s chrome field must actually carry the promise sentence`,
      );
    }
    assert.equal(examined, 5, `examined ${examined} of 5`);
  });

  it('every other kind emits no chrome at all', () => {
    const emitting = new Set<string>(CHROME_EMITTING_KINDS);
    let examined = 0;
    for (const kind of ALL_KINDS) {
      if (emitting.has(kind)) continue;
      examined += 1;
      const rendered = renderApprovalPayload(kind, {});
      assert.equal(
        rendered.chrome ?? undefined,
        undefined,
        `${kind} should not carry chrome`,
      );
    }
    assert.equal(examined, ALL_KINDS.length - 5, `examined ${examined} of 25`);
  });
});

describe('the artifact never carries chrome, for any kind', () => {
  it('buildApprovalArtifact output is chrome-free across all 30 kinds', () => {
    let examined = 0;
    const offenders: string[] = [];

    for (const kind of ALL_KINDS) {
      const rendered = renderApprovalPayload(kind, {});
      const artifact = buildApprovalArtifact(kind, rendered);
      examined += 1;
      const hit = containsChrome(artifact.blocks);
      if (hit) offenders.push(`${kind}: ${hit}`);
    }

    assert.equal(examined, ALL_KINDS.length, `examined ${examined} of ${ALL_KINDS.length}`);
    assert.deepEqual(offenders, []);
  });
});

describe('THE defect that parked PR #465', () => {
  it('customer prose opening with the chrome words survives into the artifact', () => {
    // The exact body from the parked spec. Under the regex scheme this
    // paragraph was silently deleted from copy, download AND mailto, with
    // nothing on screen showing the gap.
    const prose =
      'Awaiting your approval on the revised scope, we are holding the crew until Friday.';

    const rendered = renderApprovalPayload('PORTAL_CLIENT_MESSAGE', {
      toClientEmail: 'client@example.com',
      body: prose,
    });

    assert.ok(
      rendered.body.some((b) => b.includes('holding the crew until Friday')),
      'the renderer must keep the customer paragraph in body',
    );

    const artifact = buildApprovalArtifact('PORTAL_CLIENT_MESSAGE', rendered);
    const text = artifact.blocks.join('\n');

    assert.match(
      text,
      /Awaiting your approval on the revised scope, we are holding the crew until Friday\./,
      'the customer paragraph must survive verbatim into the artifact',
    );

    // ... while the CARD's own promise, which is a different sentence living
    // in a different field, does not.
    assert.doesNotMatch(text, /your client sees this reply only after you approve it/);
  });

  it('a portal message that is ONLY chrome-shaped prose is still carried', () => {
    const rendered = renderApprovalPayload('PORTAL_CLIENT_MESSAGE', {
      toClientEmail: 'client@example.com',
      body: 'Nothing has been sent to the county yet. Awaiting your approval.',
    });
    const artifact = buildApprovalArtifact('PORTAL_CLIENT_MESSAGE', rendered);
    assert.match(
      artifact.blocks.join('\n'),
      /Nothing has been sent to the county yet\. Awaiting your approval\./,
    );
  });
});
