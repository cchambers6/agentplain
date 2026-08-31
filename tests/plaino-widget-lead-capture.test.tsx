import { test } from "node:test";
import assert from "node:assert/strict";
// This file had NO `React` import at all until the .tsx pass of the test
// gate started running it. The tsx runner compiles JSX with the CLASSIC
// factory and does not honour `"jsx": "react-jsx"` from
// tests/tsconfig.test.json, so `<div/>` becomes `React.createElement(...)`
// and `React` has to be a VALUE in scope. Without this line the module
// throws `ReferenceError: React is not defined` before a single assertion
// runs.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadCapturePanel } from "@/components/marketing/PlainoWidget";

// The lead hand-off auto-expands when a turn degrades. We render the panel
// directly (it's DB-free and prop-driven) to pin the expanded vs collapsed
// shapes without simulating a fetch — the parent flips `forceExpand` from
// the route's `expandLeadCapture` flag.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("forceExpand renders the email field already open", () => {
  const html = render(
    <LeadCapturePanel
      conversationId={null}
      sourcePage="/"
      forceExpand={true}
    />,
  );
  assert.match(html, /type="email"/);
  assert.match(html, /you@business\.com/);
  assert.match(html, /leave your email/i);
  // Not the collapsed call-to-action.
  assert.doesNotMatch(html, /want a person to follow up\?/i);
});

test("without forceExpand it stays the collapsed call-to-action", () => {
  const html = render(
    <LeadCapturePanel
      conversationId={null}
      sourcePage="/"
      forceExpand={false}
    />,
  );
  assert.match(html, /want a person to follow up\?/i);
  assert.doesNotMatch(html, /type="email"/);
});
