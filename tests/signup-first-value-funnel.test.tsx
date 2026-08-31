import { test } from "node:test";
import assert from "node:assert/strict";
// `React` must be in SCOPE, not merely imported for its types: the tsx test
// runner uses the CLASSIC JSX factory and does not honour the "jsx":
// "react-jsx" in tests/tsconfig.test.json, so `<div/>` compiles to
// `React.createElement(...)`. Without this the module throws
// `ReferenceError: React is not defined` before a single assertion runs.
import React from "react";
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
  // Matched on the CARD's ring utility (`ring-2 ring-clay …`), not the bare
  // token. Every card now also contains `focus-visible:ring-clay` on the
  // ApprovalHandoff buttons, which is a focus affordance on a button and not
  // a highlight on the card — a bare /ring-clay/ negative assertion collides
  // with it and reports a highlight that is not being drawn.
  assert.match(highlighted, /ring-2 ring-clay/);
  assert.doesNotMatch(normal, /ring-2 ring-clay/);
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

test("FIX 4 — StuckHelpLink deep-links the help surface with the step encoded in subject", () => {
  const html = render(
    <StuckHelpLink workspaceId="ws_9" subject="Stuck connecting a tool" />,
  );
  // The workspace help surface is /support/new. This assertion used to name
  // /help, a route that does not exist under app/(product)/app/workspace/[id]
  // and would have 404'd the customer at the exact moment they said they were
  // stuck. It went unnoticed because nothing ran the .tsx suite — see
  // tools/test-gate.mjs, which now does.
  assert.match(html, /\/app\/workspace\/ws_9\/support\/new\?subject=/);
  // Space-encoded subject so the help form arrives pre-named.
  assert.match(html, /Stuck%20connecting%20a%20tool/);
  assert.match(html, /a real person reads every note/i);
});
