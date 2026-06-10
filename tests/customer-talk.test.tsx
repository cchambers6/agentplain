import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { PersistedChatMessage } from "@/lib/plaino";
import {
  ChatBubble,
  DegradedNotice,
  TalkEmptyState,
  TalkThread,
  formatTimestamp,
  type InstructionState,
} from "@/app/(product)/app/workspace/[id]/talk/talk-view";

// State-render coverage for the talk surface — the primary client-fleet
// interaction. talk-view is DB-free (page.tsx owns the chat store), so
// every turn variant and the degraded/empty states render here without a
// database.

const WS = "ws_test";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function msg(over: Partial<PersistedChatMessage> = {}): PersistedChatMessage {
  return {
    id: over.id ?? "m1",
    threadId: over.threadId ?? "t1",
    workspaceId: over.workspaceId ?? WS,
    role: over.role ?? "plaino",
    body: over.body ?? "Here's what I found.",
    metadata: over.metadata ?? null,
    createdAt: over.createdAt ?? new Date("2026-06-05T13:00:00Z"),
  };
}

test("empty state invites the first message and explains what Plaino does", () => {
  const html = render(<TalkEmptyState />);
  assert.match(html, /Plaino&#x27;s waiting at the workspace door|Plaino's waiting/i);
  assert.match(html, /the draft lands in your approval queue/i);
});

test("degraded state shows a calm offline notice; operator note gated", () => {
  const customer = render(
    <DegradedNotice
      customerNotice="Plaino is briefly offline. Your fleet keeps running."
      operatorNotice="Set ENCRYPTION_KEY + ANTHROPIC_API_KEY."
      isOperator={false}
    />,
  );
  assert.match(customer, /Plaino is offline/i);
  assert.match(customer, /briefly offline/i);
  assert.doesNotMatch(customer, /ENCRYPTION_KEY/); // operator-only, hidden

  const operator = render(
    <DegradedNotice
      customerNotice="Plaino is briefly offline."
      operatorNotice="Set ENCRYPTION_KEY + ANTHROPIC_API_KEY."
      isOperator={true}
    />,
  );
  assert.match(operator, /operator only/i);
  assert.match(operator, /ENCRYPTION_KEY/);
});

test("customer turn renders as 'You' with no provenance footer", () => {
  const html = render(
    <ChatBubble
      message={msg({ role: "customer", body: "Can you check 142 Peachtree?" })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  assert.match(html, /You/);
  assert.match(html, /142 Peachtree/);
});

test("REGISTER turn links to the drafted reply once it lands", () => {
  const message = msg({
    metadata: { kind: "REGISTER", supportRequestId: "sr_1" },
  });
  const html = render(
    <TalkThread
      messages={[message]}
      workspaceId={WS}
      draftedSet={new Set(["sr_1"])}
      instructionStateMap={new Map()}
    />,
  );
  assert.match(html, /drafted reply in your approval queue/i);
});

test("INSTRUCT tile reflects awaiting_review vs drafting", () => {
  const message = msg({
    metadata: { kind: "INSTRUCT", instructionApprovalId: "appr_1", targetDiscipline: "client comms" },
  });
  const ready = render(
    <TalkThread
      messages={[message]}
      workspaceId={WS}
      draftedSet={new Set()}
      instructionStateMap={new Map<string, InstructionState>([["appr_1", "awaiting_review"]])}
    />,
  );
  assert.match(ready, /draft ready for review/i);

  const drafting = render(
    <TalkThread
      messages={[message]}
      workspaceId={WS}
      draftedSet={new Set()}
      instructionStateMap={new Map()}
    />,
  );
  assert.match(drafting, /drafting now/i);
});

test("DECLINE_HONESTLY turn names the gap instead of pretending", () => {
  const html = render(
    <ChatBubble
      message={msg({
        body: "I can't reach your CRM yet.",
        metadata: { kind: "DECLINE_HONESTLY", namedGap: "CRM not connected" },
      })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  assert.match(html, /fetch yet: CRM not connected/i);
});

test("citations render as a provenance line under a Plaino turn", () => {
  const html = render(
    <ChatBubble
      message={msg({
        metadata: {
          citations: [{ title: "Listing agreement.pdf", sourceUrl: "https://x/y" }],
        },
      })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  assert.match(html, /cited:/i);
  assert.match(html, /Listing agreement\.pdf/);
});

test("formatTimestamp produces a short, human date", () => {
  const out = formatTimestamp(new Date("2026-06-05T13:05:00Z"));
  assert.match(out, /Jun/);
});

test("a Plaino turn renders its additive metadata.card beneath the prose", () => {
  const html = render(
    <ChatBubble
      message={msg({
        body: "Here's what I'd tackle first.",
        metadata: {
          card: {
            type: "next-steps",
            steps: [
              {
                label: "Every lead gets a first touch in 5 minutes — see it run",
                href: `/app/workspace/${WS}/approvals`,
                weight: "primary",
                why: "Plaino drafts the first touch — you approve",
              },
            ],
          },
        },
      })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  // Prose body is always present (additive rule).
  assert.match(html, /tackle first/);
  // The card's step renders as a real deep-link with a text label.
  assert.match(html, /Suggested next steps/);
  assert.match(html, /Every lead gets a first touch in 5 minutes/);
  assert.match(html, new RegExp(`href="/app/workspace/${WS}/approvals"`));
});

test("a Plaino turn with no card degrades to text-only (renders nothing extra)", () => {
  const html = render(
    <ChatBubble
      message={msg({ body: "Just a plain answer.", metadata: { kind: "ANSWER" } })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  assert.match(html, /Just a plain answer/);
  assert.doesNotMatch(html, /Suggested next steps/);
});

test("a malformed metadata.card never throws — degrades silently", () => {
  const html = render(
    <ChatBubble
      message={msg({ body: "Body.", metadata: { card: { type: "bogus" } } })}
      showDraftedLink={false}
      instructionState={null}
      workspaceId={WS}
    />,
  );
  assert.match(html, /Body\./);
  assert.doesNotMatch(html, /Suggested next steps/);
});
