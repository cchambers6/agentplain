import { test } from "node:test";
import assert from "node:assert/strict";
// `React` must be in SCOPE, not merely imported for its types. The test:ui
// runner (tsx, loading these .tsx files as CJS) compiles JSX with the CLASSIC
// factory — it does not honour the `"jsx": "react-jsx"` in
// tests/tsconfig.test.json, so `<div/>` becomes `React.createElement(...)` and
// the module throws `ReferenceError: React is not defined` before a single
// test runs. Verified against origin/main: every one of the 14 .tsx files in
// the test:ui list fails this way today. This import fixes THIS file; the
// runner defect is reported separately.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalCard,
  formatRelativeTime,
  type ApprovalRow,
} from "@/app/(product)/app/workspace/[id]/approvals/ApprovalCard";
import { ApprovalRowItem } from "@/app/(product)/app/workspace/[id]/approvals/ApprovalRowItem";
import { ApprovedHandoffShelf } from "@/app/(product)/app/workspace/[id]/approvals/ApprovedHandoffShelf";
import { ApRootedEmptyState, ApRootedLoader } from "@/components/ui/ap";
import {
  renderApprovalPayload,
  type RenderedApproval,
} from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import {
  buildApprovalArtifact,
  renderArtifactText,
} from "@/lib/approvals/artifact";

// State-render coverage for the approval queue — the value-loop terminus.
// ApprovalCard is DB-free (action controls arrive via the `footer` slot),
// so every card variant renders here without a database.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function row(rendered: RenderedApproval, over: Partial<ApprovalRow> = {}): ApprovalRow {
  return {
    id: over.id ?? "appr_1",
    agentSlug: over.agentSlug ?? "buyer-inquiry-router",
    kind: over.kind ?? "DRAFT_REPLY",
    discipline: over.discipline ?? null,
    proposedAtIso: over.proposedAtIso ?? "2026-06-05T13:00:00.000Z",
    rendered,
  };
}

const FOOTER = (
  <>
    <button type="submit">approve</button>
    <button type="button">reject</button>
  </>
);

test("draft card shows provenance: which agent, which kind, herded by Plaino", () => {
  const html = render(
    <ApprovalCard
      row={row({
        kindLabel: "Reply draft",
        recipientLine: "To: jane@buyer.com",
        inboundSummary: "Is 142 Peachtree still available?",
        body: ["Hi Jane — yes, it's still on the market."],
        persisted: true,
      })}
      footer={FOOTER}
    />,
  );
  assert.match(html, /drafted by/i);
  // agentDisplayLabel maps "buyer-inquiry-router" → "Buyer Inquiry Router"
  assert.match(html, /Buyer Inquiry Router/);
  assert.match(html, /herded in by Plaino/i);
  // Source it read is surfaced.
  assert.match(html, /In reply to:/i);
  assert.match(html, /142 Peachtree/);
  // Footer (action controls) renders.
  assert.match(html, /approve/);
});

test("below-threshold draft surfaces the held-for-review notice", () => {
  const html = render(
    <ApprovalCard
      row={row({ kindLabel: "Reply draft", body: ["draft"], persisted: false })}
    />,
  );
  assert.match(html, /Held for your review/i);
  assert.match(html, /did not write to your Gmail Drafts/i);
});

test("scheduling card renders proposed slots", () => {
  const html = render(
    <ApprovalCard
      row={row({
        kindLabel: "Showing proposal",
        body: ["Two times that fit your calendar:"],
        proposedSlots: [
          { day: "tuesday", startLocal: "10:30", endLocal: "11:00" },
          { day: "thursday", startLocal: "14:00", endLocal: "14:30" },
        ],
      })}
    />,
  );
  assert.match(html, /proposed slots/i);
  assert.match(html, /Tuesday 10:30/);
});

test("admin verification-code card shows the code prominently + safe-handling copy", () => {
  const html = render(
    <ApprovalCard
      row={row({
        kindLabel: "Verification code",
        body: [],
        admin: {
          category: "verification-code",
          priority: "critical",
          confidence: 0.92,
          fromDisplay: "Zillow <no-reply@zillow.com>",
          subject: "Your code",
          verificationCode: "481920",
        },
      })}
    />,
  );
  assert.match(html, /481920/);
  assert.match(html, /We do not enter the code anywhere on your behalf/i);
});

test("empty state explains why nothing is waiting (page copy)", () => {
  const html = render(
    <ApRootedEmptyState
      motif="lone-tree"
      reality="Nothing waiting on you."
      change="Plaino is sitting ready, fetching from your connected sources and herding work as it surfaces. New decisions land here as they cross your threshold."
    />,
  );
  assert.match(html, /Nothing waiting on you/i);
  assert.match(html, /cross your threshold/i);
});

test("loading state renders a contextual loader, not a blank screen", () => {
  const html = render(
    <ApRootedLoader kind="reading-queue" label="Pulling the decisions queue…" />,
  );
  assert.match(html, /Pulling the decisions queue/i);
  assert.match(html, /role="status"/);
});

test("formatRelativeTime: humanizes recent timestamps", () => {
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
  assert.match(formatRelativeTime(fiveMinAgo), /min ago/);
  assert.equal(formatRelativeTime(now.toISOString()), "just now");
});

test("confidence chip surfaces how sure Plaino is", () => {
  const html = render(
    <ApprovalCard
      row={row({ kindLabel: "Reply draft", body: ["draft"], confidence: 0.92 })}
    />,
  );
  assert.match(html, /high confidence/i);
  assert.match(html, /92%/);
});

test("low confidence: Plaino actively asks for your eyes", () => {
  const html = render(
    <ApprovalCard
      row={row({ kindLabel: "Reply draft", body: ["draft"], confidence: 0.3 })}
    />,
  );
  assert.match(html, /needs your eyes/i);
  assert.match(html, /eyes on this one/i);
});

test("reasoning renders as 'why Plaino drafted this' — not a black box", () => {
  const html = render(
    <ApprovalCard
      row={row({
        kindLabel: "Reply draft",
        body: ["draft"],
        reasoning: "This buyer asks about timelines, so I led with the closing date.",
      })}
    />,
  );
  assert.match(html, /why plaino drafted this/i);
  assert.match(html, /led with the closing date/i);
});

test("sources render what Plaino read, with a link when present", () => {
  const html = render(
    <ApprovalCard
      row={row({
        kindLabel: "Reply draft",
        body: ["draft"],
        sources: [
          { label: "Buildium lease #123", href: "https://example.com/lease/123" },
          { label: "Ledger entry 4/15" },
        ],
      })}
    />,
  );
  assert.match(html, /what plaino read/i);
  assert.match(html, /Buildium lease #123/);
  assert.match(html, /href="https:\/\/example\.com\/lease\/123"/);
  assert.match(html, /Ledger entry 4\/15/);
});

test("embedded card drops the outer paper-card chrome (renders inside the sheet)", () => {
  const html = render(
    <ApprovalCard
      row={row({ kindLabel: "Reply draft", body: ["draft"], confidence: 0.9 })}
      embedded
    />,
  );
  // Still shows provenance + confidence...
  assert.match(html, /herded in by Plaino/i);
  assert.match(html, /high confidence/i);
});

test("list row: scannable title, time-to-approve, and a batch checkbox in batch mode", () => {
  const noop = () => {};
  const html = render(
    <ApprovalRowItem
      row={row(
        { kindLabel: "Reply draft", title: "Lease renewal for 123 Main St", body: ["short draft"], confidence: 0.9 },
        { kind: "BUYER_INQUIRY_REPLY_DRAFT" },
      )}
      onOpen={noop}
      onApprove={noop}
      onReject={noop}
      batchMode
      selectable
      selected={false}
      onToggleSelect={noop}
    />,
  );
  assert.match(html, /Lease renewal for 123 Main St/);
  assert.match(html, /to approve/i);
  assert.match(html, /high confidence/i);
  assert.match(html, /type="checkbox"/);
});

// ── Handoff: the customer leaves with the work ───────────────────────────
// Approving used to set a status and nothing else — the drafted text stayed
// trapped in the queue and the customer retyped it by hand. These cover the
// control that carries it out, and the shelf that keeps it reachable after
// the item stops being PENDING.

/** Pull the artifact text back out of the markup and un-escape it. */
function artifactTextFromMarkup(html: string): string | null {
  const m = /<textarea[^>]*data-artifact-text[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
  if (!m) return null;
  return m[1]!
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

test("approval card carries a handoff control with the exact artifact text", () => {
  const rendered = renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
    to: "jane@buyer.example.com",
    subject: "142 Peachtree Ave — still available?",
    draft: "Hi Jane — 142 Peachtree is still on the market.",
    confidence: 0.91,
  });
  const html = render(
    <ApprovalCard row={row(rendered, { kind: "BUYER_INQUIRY_REPLY_DRAFT" })} />,
  );

  // The control is present, named in the customer's terms.
  assert.match(html, /data-approval-handoff/);
  assert.match(html, /take it with you/i);
  assert.match(html, />copy</);
  assert.match(html, /download \.txt/);

  // And it carries the artifact — byte-for-byte what `copy` puts on the
  // clipboard and what `download` writes to the .txt.
  const expected = renderArtifactText(
    buildApprovalArtifact("BUYER_INQUIRY_REPLY_DRAFT", rendered),
  );
  assert.equal(artifactTextFromMarkup(html), expected);
  assert.match(expected, /Subject: 142 Peachtree Ave/);
  assert.match(expected, /To: jane@buyer\.example\.com/);
  assert.match(expected, /still on the market/);
});

test("handoff offers the customer's own mail app only when there is an address", () => {
  const withAddress = render(
    <ApprovalCard
      row={row(
        renderApprovalPayload("FOLLOW_UP_NUDGE", {
          subject: "Re: the Riverside proposal",
          body: "Circling back on the Riverside proposal.",
          toEmails: ["sam@riverside.example.com"],
        }),
        { kind: "FOLLOW_UP_NUDGE" },
      )}
    />,
  );
  assert.match(withAddress, /open in your mail app/i);
  assert.match(withAddress, /href="mailto:sam%40riverside\.example\.com\?/);
  // The no-outbound promise is restated exactly where the temptation is.
  assert.match(withAddress, /You press send — we never do/i);

  const withoutAddress = render(
    <ApprovalCard
      row={row(
        renderApprovalPayload("PROCESS_DOC_DRAFT", {
          title: "New client intake SOP",
          body: "1. Log the inquiry in the CRM within one business hour.",
        }),
        { kind: "PROCESS_DOC_DRAFT" },
      )}
    />,
  );
  assert.doesNotMatch(withoutAddress, /mailto:/);
  assert.match(withoutAddress, /download \.txt/);
});

test("closed-loop kinds get copy only — no handoff competing with the execution", () => {
  const html = render(
    <ApprovalCard
      row={row(
        renderApprovalPayload("DOCUSIGN_SEND_ENVELOPE", {
          emailSubject: "Listing agreement — 142 Peachtree Ave",
          source: "template",
          templateId: "tpl_listing_agreement_v4",
          recipientEmails: ["seller@example.com"],
        }),
        { kind: "DOCUSIGN_SEND_ENVELOPE" },
      )}
    />,
  );
  assert.match(html, />copy</);
  // A real address is on the card and it still gets no mailto: the envelope
  // is sent by DocuSign on approval, not by the customer's mail client.
  assert.doesNotMatch(html, /download \.txt/);
  assert.doesNotMatch(html, /mailto:/);
});

test("approving does not take the work away: the approved shelf keeps it in reach", () => {
  const html = render(
    <ApprovedHandoffShelf
      rows={[
        {
          id: "appr_9",
          kind: "BUYER_INQUIRY_REPLY_DRAFT",
          decidedAtIso: new Date(Date.now() - 4 * 60_000).toISOString(),
          rendered: renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
            to: "jane@buyer.example.com",
            subject: "142 Peachtree Ave — still available?",
            draft: "Hi Jane — 142 Peachtree is still on the market.",
          }),
        },
      ]}
    />,
  );
  assert.match(html, /approved — ready to hand off/i);
  assert.match(html, /min ago/);
  assert.match(html, /data-approval-handoff/);
  assert.match(html, />copy</);
  assert.match(html, /still on the market/);
});

test("the approved shelf renders nothing when nothing was recently approved", () => {
  assert.equal(render(<ApprovedHandoffShelf rows={[]} />), "");
});

/** The decoded `href` of the "open in your mail app" link, if present. */
function mailtoHrefFromMarkup(html: string): string | null {
  const m = /href="(mailto:[^"]*)"/.exec(html);
  if (!m) return null;
  return m[1]!.replace(/&amp;/g, "&");
}

test("an address written into the SUBJECT never lands on the card's To: line", () => {
  // The subject of a reply draft comes from an email a stranger sent. It used
  // to be scanned for addresses along with the addressee, so writing an
  // address into a subject line put the writer on the customer's To: header.
  const html = render(
    <ApprovalCard
      row={row(
        renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
          to: "jane@buyer.example.com",
          subject: "Please copy my agent bob@attacker.example.com on this",
          draft: "Hi Jane — 142 Peachtree is still on the market.",
        }),
        { kind: "BUYER_INQUIRY_REPLY_DRAFT" },
      )}
    />,
  );

  const href = mailtoHrefFromMarkup(html)!;
  const to = decodeURIComponent(/^mailto:([^?]*)/.exec(href)![1]!);
  assert.equal(to, "jane@buyer.example.com");
  assert.doesNotMatch(to, /attacker/);
});

test("the pre-filled email to a third party carries no internal rationale", () => {
  // "Why this was drafted: …" is Plaino's note to the CUSTOMER about their
  // counterparty. It belongs in the copy and the .txt; it used to ride along
  // in the mailto body, which is an email addressed to that counterparty.
  const html = render(
    <ApprovalCard
      row={row(
        renderApprovalPayload("CHIEF_OF_STAFF_REPLY_DRAFT", {
          subject: "Re: vendor contract renewal",
          body: "We are good to renew at the current terms.",
          toEmails: ["ops@vendor.example.com"],
          reasoning: "The vendor asked for a renewal decision by end of week.",
        }),
        { kind: "CHIEF_OF_STAFF_REPLY_DRAFT" },
      )}
    />,
  );

  const href = mailtoHrefFromMarkup(html)!;
  const body = decodeURIComponent(/[?&]body=([^&]*)/.exec(href)![1]!);
  assert.match(body, /good to renew at the current terms/);
  assert.doesNotMatch(body, /Why this was drafted/);
  assert.doesNotMatch(body, /end of week/);

  // The customer's own copy still explains itself.
  const copyText = artifactTextFromMarkup(html)!;
  assert.match(copyText, /Why this was drafted: The vendor asked/);
});
