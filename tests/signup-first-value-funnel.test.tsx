import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalCard,
  type ApprovalRow,
} from "@/app/(product)/app/workspace/[id]/approvals/ApprovalCard";
import { FirstFireWatch } from "@/app/(product)/app/workspace/[id]/onboarding/FirstFireWatch";
import { StuckHelpLink } from "@/components/onboarding/StuckHelpLink";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

// Block I — signup → first-value funnel hardening. State-render coverage for
// the DB-free pieces of the magic-moment path. The server-action-bound list
// (ApprovalsList) is exercised by the broader UI suite; here we lock the leaf
// behaviors that previously broke the funnel.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function row(
  rendered: RenderedApproval,
  over: Partial<ApprovalRow> = {},
): ApprovalRow {
  return {
    id: over.id ?? "appr_1",
    agentSlug: over.agentSlug ?? "buyer-inquiry-router",
    kind: over.kind ?? "DRAFT_REPLY",
    discipline: over.discipline ?? null,
    proposedAtIso: over.proposedAtIso ?? "2026-06-05T13:00:00.000Z",
    rendered,
  };
}

test("FIX 3 — focused approval card renders the clay highlight ring", () => {
  const base = row({ kindLabel: "Reply draft", body: ["draft body"] });
  const highlighted = render(<ApprovalCard row={base} highlighted />);
  const normal = render(<ApprovalCard row={base} />);
  assert.match(highlighted, /ring-clay/);
  assert.doesNotMatch(normal, /ring-clay/);
});

test("FIX 2 — first-fire skipped/failed row links the ABSOLUTE approvals queue", () => {
  // A relative "approvals" href resolved to /onboarding/approvals = 404 at the
  // magic moment. The fallback button must carry the workspace-rooted path.
  const html = render(
    <FirstFireWatch
      workspaceId="ws_123"
      initial={{
        picked: [
          { slug: "inbox-triage-general", name: "Inbox Triage", status: "skipped" },
        ],
        resolved: true,
        requestedAt: "2026-06-13T13:00:00.000Z",
      }}
    />,
  );
  assert.match(html, /\/app\/workspace\/ws_123\/approvals/);
  // The broken relative form must be gone.
  assert.doesNotMatch(html, /href="approvals"/);
});

test("FIX 2 — drafted row deep-links to the specific queue item (focus param)", () => {
  const html = render(
    <FirstFireWatch
      workspaceId="ws_123"
      initial={{
        picked: [
          {
            slug: "inbox-triage-general",
            name: "Inbox Triage",
            status: "drafted",
            queueItemHref:
              "/app/workspace/ws_123/approvals?focus=appr_55",
          },
        ],
        resolved: true,
        requestedAt: "2026-06-13T13:00:00.000Z",
      }}
    />,
  );
  assert.match(html, /\/app\/workspace\/ws_123\/approvals\?focus=appr_55/);
});

test("FIX 4 — StuckHelpLink deep-links /help with the step encoded in subject", () => {
  const html = render(
    <StuckHelpLink workspaceId="ws_9" subject="Stuck connecting a tool" />,
  );
  assert.match(html, /\/app\/workspace\/ws_9\/help\?subject=/);
  // Space-encoded subject so the help form arrives pre-named.
  assert.match(html, /Stuck%20connecting%20a%20tool/);
  assert.match(html, /a real person reads every note/i);
});
