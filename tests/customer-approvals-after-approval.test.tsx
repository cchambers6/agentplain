/**
 * THE CONSUMER'S PATH, AFTER APPROVAL.
 *
 * The defect this file exists to prevent is not a wrong query — it is a
 * BROKEN SCREEN. Approving an item used to remove the customer's only way to
 * get the work: the approvals page queried `status: "PENDING"` only, so the
 * card carrying the copy / download / mailto handoff vanished the instant the
 * row left PENDING, and the artifact frozen at approval time to replace it had
 * no reader in production.
 *
 * A test that only asserted the query shape would pass while the screen stayed
 * broken. So these assertions are made against RENDERED MARKUP, on the
 * accepted path, and they check the two things a customer actually needs:
 *
 *   1. The handoff control is still THERE after approval.
 *   2. It carries the STORED body — the text frozen when they said yes — and
 *      not a fresh re-derivation from a payload that may have moved since.
 *
 * (2) is the one with teeth. Every fixture below deliberately makes the stored
 * artifact and the live re-derivation DIFFERENT, so a regression to
 * re-deriving flips the assertion instead of quietly producing equivalent
 * output. A fixture where both agree would pass under the bug.
 *
 * Reports `examined N of M` and fails at zero.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
// See tests/customer-approvals.test.tsx: the tsx runner compiles JSX with the
// CLASSIC factory, so `React` must be a VALUE in scope or the fragments below
// throw `ReferenceError: React is not defined` before any assertion runs.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalCard,
  type ApprovalRow,
} from "@/app/(product)/app/workspace/[id]/approvals/ApprovalCard";
import { ApprovedHandoffSection } from "@/app/(product)/app/workspace/[id]/approvals/ApprovedHandoffSection";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import type { ApprovalArtifact } from "@/lib/approvals/artifact";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

/** The text a LIVE re-derivation would produce — i.e. what the payload says
 *  NOW. If this string appears in the handoff, something re-derived. */
const DRIFTED_BODY = "DRIFTED-REDERIVED-BODY-mutated-after-approval";

/** The text frozen at approval time — what the customer actually said yes to.
 *  This is what must appear. */
const FROZEN_BODY = "FROZEN-AT-APPROVAL-the-text-the-owner-approved";

function rendered(over: Partial<RenderedApproval> = {}): RenderedApproval {
  return {
    kindLabel: "Reply draft",
    title: "142 Peachtree Ave",
    recipientLine: "To: jane@buyer.example.com    Re: 142 Peachtree Ave",
    recipients: ["jane@buyer.example.com"],
    body: [DRIFTED_BODY],
    editableBody: DRIFTED_BODY,
    ...over,
  };
}

function row(over: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    id: "appr_accepted_1",
    agentSlug: "realty-buyer-inquiry-router",
    kind: "BUYER_INQUIRY_REPLY_DRAFT",
    discipline: null,
    proposedAtIso: "2026-09-01T13:00:00.000Z",
    rendered: rendered(),
    ...over,
  };
}

function storedArtifact(over: Partial<ApprovalArtifact> = {}): ApprovalArtifact {
  return {
    kind: "BUYER_INQUIRY_REPLY_DRAFT" as ApprovalArtifact["kind"],
    subject: "142 Peachtree Ave",
    recipient: "jane@buyer.example.com",
    refs: [],
    blocks: [FROZEN_BODY],
    provenanceBlocks: [],
    filename: "plaino-buyer-inquiry-reply-draft.txt",
    modes: ["copy", "download", "mailto"],
    ...over,
  };
}

describe("after approval, the handoff is still reachable", () => {
  it("a decided card still renders the take-it-with-you control", () => {
    const html = render(
      <ApprovalCard
        row={row()}
        artifact={storedArtifact()}
        decided
        decidedAtIso="2026-09-02T09:00:00.000Z"
      />,
    );
    // The control itself — the thing that used to disappear on approve.
    assert.match(html, /data-approval-handoff/);
    assert.match(html, /take it with you/i);
    assert.match(html, /copy/i);
    assert.match(html, /download \.txt/i);
  });

  it("the section renders nothing when there is nothing accepted", () => {
    assert.equal(render(<ApprovedHandoffSection rows={[]} />), "");
  });

  it("the section renders the accepted row end to end", () => {
    const html = render(
      <ApprovedHandoffSection
        rows={[
          {
            row: row(),
            artifact: storedArtifact(),
            artifactSource: "stored",
            decidedAtIso: "2026-09-02T09:00:00.000Z",
          },
        ]}
      />,
    );
    assert.match(html, /data-approved-handoff/);
    assert.match(html, /data-approval-handoff/);
    assert.ok(
      html.includes(FROZEN_BODY),
      "the accepted section must carry the frozen body",
    );
  });
});

describe("the STORED artifact wins over a live re-derivation", () => {
  // Each case pairs a rendered payload that has MOVED with the artifact frozen
  // at approval time. The stored text must win in every one.
  const CASES: ReadonlyArray<[string, ApprovalRow, ApprovalArtifact]> = [
    ["a plain reply draft", row(), storedArtifact()],
    [
      "a row whose body was emptied after approval",
      row({ rendered: rendered({ body: [], editableBody: "" }) }),
      storedArtifact(),
    ],
    [
      "a row whose recipient changed after approval",
      row({
        rendered: rendered({
          recipients: ["someone-else@evil.example.com"],
          recipientLine: "To: someone-else@evil.example.com",
        }),
      }),
      storedArtifact(),
    ],
    [
      "a row carrying admin structure",
      row({
        kind: "ADMIN_VERIFICATION_CODE",
        rendered: rendered({
          admin: {
            fromDisplay: "Acme Billing",
            subject: "Your code",
            category: "verification-code",
            verificationCode: "123456",
            priority: "normal",
          } as RenderedApproval["admin"],
        }),
      }),
      storedArtifact({ blocks: [FROZEN_BODY], modes: ["copy", "download"] }),
    ],
  ];

  it("the handoff text is the stored body, never the drifted one", () => {
    let examined = 0;
    const regressed: string[] = [];

    for (const [label, r, artifact] of CASES) {
      examined += 1;
      const html = render(
        <ApprovalCard
          row={r}
          artifact={artifact}
          decided
          decidedAtIso="2026-09-02T09:00:00.000Z"
        />,
      );
      // The handoff keeps the exact artifact text in an off-screen textarea,
      // so the markup IS the clipboard payload. Asserting on it is asserting
      // on what the customer actually receives.
      if (!html.includes(FROZEN_BODY)) {
        regressed.push(`${label}: stored body missing`);
      }
      if (html.includes(`data-artifact-text="" value="${DRIFTED_BODY}`)) {
        regressed.push(`${label}: handoff carried the re-derived body`);
      }
    }

    assert.ok(examined > 0, "examined nothing -- the input set was empty");
    assert.equal(examined, CASES.length, `examined ${examined} of ${CASES.length}`);
    assert.ok(examined >= 4, `examined ${examined}, expected at least 4`);
    assert.deepEqual(
      regressed,
      [],
      `the card re-derived instead of using the stored artifact: ${regressed.join(" ;; ")}`,
    );
  });

  it("a pending card still derives live — nothing is frozen yet", () => {
    // The other direction. Omitting `artifact` must NOT start yielding empty
    // handoffs: a pending row has no stored artifact and deriving is correct.
    const html = render(<ApprovalCard row={row()} />);
    assert.match(html, /data-approval-handoff/);
    assert.ok(
      html.includes(DRIFTED_BODY),
      "a pending card must derive its artifact from the current payload",
    );
  });
});

describe("a decided card does not claim anything was sent", () => {
  const CHROME = [
    "Awaiting your approval — Plaino will send this envelope. Nothing has been sent.",
  ];

  it("drops the pending-state promise once decided", () => {
    const html = render(
      <ApprovalCard
        row={row({ rendered: rendered({ chrome: CHROME }) })}
        artifact={storedArtifact()}
        decided
        decidedAtIso="2026-09-02T09:00:00.000Z"
      />,
    );
    assert.ok(
      !html.includes("Awaiting your approval"),
      "chrome is a promise about a PENDING card and must not survive the decision",
    );
  });

  it("still shows that promise on a pending card, where it is true", () => {
    const html = render(
      <ApprovalCard row={row({ rendered: rendered({ chrome: CHROME }) })} />,
    );
    assert.ok(
      html.includes("Awaiting your approval"),
      "the pending card is exactly where the promise belongs",
    );
  });

  it("never says sent or delivered, and says who does the sending", () => {
    const html = render(
      <ApprovedHandoffSection
        rows={[
          {
            row: row({ rendered: rendered({ persisted: true }) }),
            artifact: storedArtifact(),
            artifactSource: "stored",
            decidedAtIso: "2026-09-02T09:00:00.000Z",
          },
        ]}
      />,
    );
    // The non-negotiable. Nothing in the executor registry reaches outside our
    // own database, so any claim of a send is false.
    const FALSE_CLAIMS = [
      /\bwe sent\b/i,
      /\bhas been sent\b/i,
      /\bwas sent\b/i,
      /\bsent on your behalf\b/i,
      /\bdelivered\b/i,
      /\bwe emailed\b/i,
    ];
    let examined = 0;
    const found: string[] = [];
    for (const re of FALSE_CLAIMS) {
      examined += 1;
      if (re.test(html)) found.push(String(re));
    }
    assert.equal(examined, FALSE_CLAIMS.length, `examined ${examined} of ${FALSE_CLAIMS.length}`);
    assert.deepEqual(found, [], `the accepted lane claimed a send: ${found.join(", ")}`);

    // And it states the true thing positively, rather than merely avoiding
    // the false one.
    assert.match(html, /ready to send from your account/i);
    assert.match(html, /did not send them/i);
    assert.match(html, /data-approval-decided/);
  });

  it("replaces the persistence note's approve-to-send instruction", () => {
    const html = render(
      <ApprovalCard
        row={row({ rendered: rendered({ persisted: false }) })}
        artifact={storedArtifact()}
        decided
      />,
    );
    assert.ok(
      !html.includes("Approve to send it through"),
      "an instruction to approve is stale AND misleading under an approved item",
    );
  });
});

describe("the legacy re-derivation is labelled, not passed off as the record", () => {
  it("a legacy row says so; a stored row does not", () => {
    const legacy = render(
      <ApprovedHandoffSection
        rows={[
          {
            row: row(),
            artifact: storedArtifact(),
            artifactSource: "legacy-rederived",
            decidedAtIso: "2026-09-02T09:00:00.000Z",
          },
        ]}
      />,
    );
    const stored = render(
      <ApprovedHandoffSection
        rows={[
          {
            row: row(),
            artifact: storedArtifact(),
            artifactSource: "stored",
            decidedAtIso: "2026-09-02T09:00:00.000Z",
          },
        ]}
      />,
    );
    assert.match(legacy, /data-legacy-artifact/);
    assert.ok(
      !stored.includes("data-legacy-artifact"),
      "a frozen record must not be labelled as a rebuild",
    );
  });
});
