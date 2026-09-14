/**
 * The accepted lane's plumbing.
 *
 * Two things are under test and they fail in opposite directions:
 *
 *  1. `ACCEPTED_APPROVAL_STATUSES` must agree with `isAcceptedStatus`. If the
 *     list and the predicate drift, the approvals page's `status: { in: ... }`
 *     stops matching rows the rest of the system considers accepted -- and it
 *     does so SILENTLY, by showing fewer rows. There is no error to notice.
 *
 *  2. `readStoredApprovalArtifact` must return the frozen artifact when one is
 *     there and `null` -- never a half-built object -- when it is not. A
 *     half-built artifact is the dangerous failure: it renders as a handoff
 *     control over missing content, which is an empty box wearing a checkmark.
 *
 * Reports `examined N of M` and fails at zero, because an assertion over an
 * empty input set passes green while checking nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkApprovalStatus } from '@prisma/client';
import {
  ACCEPTED_APPROVAL_STATUSES,
  isAcceptedStatus,
} from '../executors';
import {
  ARTIFACT_PAYLOAD_KEY,
  ARTIFACT_SCHEMA_VERSION,
} from '../executors/artifact-handoff';
import { readStoredApprovalArtifact } from '../stored-artifact';

/** Every status, read from the PRODUCER -- the generated Prisma enum, which
 *  is a runtime value and not merely a type. Anchoring here rather than
 *  hand-copying the list means a status added to schema.prisma arrives in this
 *  suite automatically and forces a decision about whether it is accepted,
 *  instead of being silently outside the corpus. */
const ALL_STATUSES: readonly string[] = Object.values(WorkApprovalStatus);

function validArtifact(over: Record<string, unknown> = {}) {
  return {
    kind: 'BUYER_INQUIRY_REPLY_DRAFT',
    subject: '142 Peachtree Ave',
    recipient: 'jane@buyer.example.com',
    refs: [{ label: 'Listing 142 Peachtree', href: 'https://example.com/l/1' }],
    blocks: ['Hi Jane — yes, it is still on the market.'],
    provenanceBlocks: [],
    filename: 'plaino-buyer-inquiry-reply-draft.txt',
    modes: ['copy', 'download', 'mailto'],
    ...over,
  };
}

function envelope(artifact: unknown, v: unknown = ARTIFACT_SCHEMA_VERSION) {
  return { [ARTIFACT_PAYLOAD_KEY]: { v, fingerprint: 'abc123', artifact } };
}

describe('the accepted status class has ONE definition', () => {
  it('the list and the predicate agree, in both directions', () => {
    let examined = 0;
    for (const status of ALL_STATUSES) {
      examined += 1;
      const inList = (ACCEPTED_APPROVAL_STATUSES as readonly string[]).includes(
        status,
      );
      assert.equal(
        inList,
        isAcceptedStatus(status),
        `${status}: list says ${inList}, predicate disagrees`,
      );
    }
    assert.ok(examined > 0, 'examined nothing -- the input set was empty');
    assert.equal(
      examined,
      ALL_STATUSES.length,
      `examined ${examined} of ${ALL_STATUSES.length}`,
    );
    // Absolute floor. An equality against a corpus that shrank to one still
    // passes; the enum has five members and a corpus smaller than that means
    // the instrument broke, not that the schema did.
    assert.ok(examined >= 5, `examined ${examined}, expected the full enum (>=5)`);
  });

  it('AUTO_APPROVED is in the list, so a query built from it cannot drop threshold-accepted rows', () => {
    // The specific regression this guards: a page hand-rolling ["APPROVED"].
    assert.ok(
      (ACCEPTED_APPROVAL_STATUSES as readonly string[]).includes(
        'AUTO_APPROVED',
      ),
      'AUTO_APPROVED missing — every machine-accepted row would vanish from the customer surface',
    );
    assert.equal(ACCEPTED_APPROVAL_STATUSES.length, 2);
  });
});

describe('readStoredApprovalArtifact returns the FROZEN artifact', () => {
  it('reads back exactly what the executor stored', () => {
    const artifact = readStoredApprovalArtifact(envelope(validArtifact()));
    assert.ok(artifact, 'a well-formed stored artifact must be readable');
    assert.deepEqual(artifact.blocks, [
      'Hi Jane — yes, it is still on the market.',
    ]);
    assert.equal(artifact.recipient, 'jane@buyer.example.com');
    assert.deepEqual(artifact.modes, ['copy', 'download', 'mailto']);
    assert.equal(artifact.refs.length, 1);
    assert.equal(artifact.refs[0]!.href, 'https://example.com/l/1');
  });

  it('keeps optional fields absent rather than inventing them', () => {
    const artifact = readStoredApprovalArtifact(
      envelope(validArtifact({ subject: undefined, recipient: undefined })),
    );
    assert.ok(artifact);
    assert.equal(artifact.subject, undefined);
    assert.equal(artifact.recipient, undefined);
  });

  it('drops a ref href that is not a string rather than emitting "undefined"', () => {
    const artifact = readStoredApprovalArtifact(
      envelope(validArtifact({ refs: [{ label: 'Bare ref' }] })),
    );
    assert.ok(artifact);
    assert.deepEqual(artifact.refs, [{ label: 'Bare ref' }]);
  });
});

describe('a malformed stored artifact yields null, never a half-built one', () => {
  // Each case is a payload that must NOT produce an artifact. Returning null
  // routes the caller to the legacy re-derivation, which is a weaker record
  // but a COMPLETE one. Returning a partial object would render a handoff
  // control over missing content.
  const REJECTED: ReadonlyArray<[string, unknown]> = [
    ['null payload', null],
    ['undefined payload', undefined],
    ['a string payload', 'nope'],
    ['an array payload', []],
    ['payload with no artifact key', { somethingElse: 1 }],
    ['envelope that is not an object', { [ARTIFACT_PAYLOAD_KEY]: 'nope' }],
    ['a future schema version', envelope(validArtifact(), 2)],
    // Built literally rather than via `envelope(..., undefined)`: that helper
    // has a default, so passing undefined would silently produce a VALID
    // envelope and the case would assert nothing. (It did, until this suite
    // caught it.)
    [
      'a missing schema version',
      { [ARTIFACT_PAYLOAD_KEY]: { fingerprint: 'abc123', artifact: validArtifact() } },
    ],
    ['a string schema version', envelope(validArtifact(), '1')],
    ['artifact that is not an object', envelope('nope')],
    ['blocks missing', envelope(validArtifact({ blocks: undefined }))],
    ['blocks empty', envelope(validArtifact({ blocks: [] }))],
    ['blocks not an array', envelope(validArtifact({ blocks: 'text' }))],
    ['blocks holding a non-string', envelope(validArtifact({ blocks: ['a', 7] }))],
    ['modes missing', envelope(validArtifact({ modes: undefined }))],
    ['modes empty', envelope(validArtifact({ modes: [] }))],
    ['modes holding an unknown mode', envelope(validArtifact({ modes: ['copy', 'send'] }))],
    ['kind missing', envelope(validArtifact({ kind: undefined }))],
    ['filename missing', envelope(validArtifact({ filename: undefined }))],
    ['filename empty', envelope(validArtifact({ filename: '' }))],
    ['refs not an array', envelope(validArtifact({ refs: 'nope' }))],
    ['a ref with no label', envelope(validArtifact({ refs: [{ href: 'x' }] }))],
    ['provenanceBlocks not an array', envelope(validArtifact({ provenanceBlocks: 'x' }))],
    ['subject of the wrong type', envelope(validArtifact({ subject: 42 }))],
    ['recipient of the wrong type', envelope(validArtifact({ recipient: ['a@b.c'] }))],
  ];

  it('every malformed shape returns null', () => {
    let examined = 0;
    const leaked: string[] = [];

    for (const [label, payload] of REJECTED) {
      examined += 1;
      const got = readStoredApprovalArtifact(payload);
      if (got !== null) leaked.push(label);
    }

    assert.ok(examined > 0, 'examined nothing -- the input set was empty');
    assert.equal(
      examined,
      REJECTED.length,
      `examined ${examined} of ${REJECTED.length}`,
    );
    // A floor as well as an equality: an equality against a corpus that was
    // accidentally emptied still passes, and this suite's whole job is to be
    // unable to pass while checking nothing.
    assert.ok(examined >= 20, `examined ${examined}, expected at least 20`);
    assert.deepEqual(leaked, [], `these malformed shapes produced an artifact: ${leaked.join(', ')}`);
  });

  it('never throws, for any of them', () => {
    let examined = 0;
    for (const [, payload] of REJECTED) {
      examined += 1;
      assert.doesNotThrow(() => readStoredApprovalArtifact(payload));
    }
    assert.equal(examined, REJECTED.length, `examined ${examined} of ${REJECTED.length}`);
  });
});
