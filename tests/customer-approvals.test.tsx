import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalCard,
  formatRelativeTime,
  type ApprovalRow,
} from "@/app/(product)/app/workspace/[id]/approvals/ApprovalCard";
import { ApprovalRowItem } from "@/app/(product)/app/workspace/[id]/approvals/ApprovalRowItem";
import { ApRootedEmptyState, ApRootedLoader } from "@/components/ui/ap";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

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
