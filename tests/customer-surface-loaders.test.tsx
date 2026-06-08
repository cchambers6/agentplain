import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import MarketplaceLoading from "@/app/(product)/app/workspace/[id]/marketplace/loading";
import MemoryLoading from "@/app/(product)/app/workspace/[id]/talk/memory/loading";
import HelpLoading from "@/app/(product)/app/workspace/[id]/help/loading";

// Wave-9 — loading-skeleton coverage for the three navigable,
// data-fetching customer surfaces that #149's render-state pass missed:
// the skill marketplace, the Plaino memory shelf, and the help/support
// front door. Each does an async DB read before render, so on navigation
// Next streams a fallback; without a loading.tsx the customer sees a bare
// frame. Each fallback uses the shared ApRootedLoader with contextual
// copy per design language §3.6 (what's happening, not "Loading…").
//
// These render renderToStaticMarkup-safe — no DB, no client hooks — so
// the contract holds in node:test.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("marketplace loader names what's being read, not a generic spinner", () => {
  const html = render(<MarketplaceLoading />);
  // contextual copy
  assert.match(html, /Reading your fleet/i);
  // never a generic spinner word
  assert.doesNotMatch(html, /Loading…|Loading\.\.\./i);
  // a11y live-region from ApRootedLoader
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
});

test("memory loader names the memory shelf and is a11y live", () => {
  const html = render(<MemoryLoading />);
  assert.match(html, /Opening what Plaino remembers/i);
  assert.doesNotMatch(html, /Loading…|Loading\.\.\./i);
  assert.match(html, /role="status"/);
});

test("help loader names reaching the service partner and is a11y live", () => {
  const html = render(<HelpLoading />);
  assert.match(html, /Reaching your service partner/i);
  assert.doesNotMatch(html, /Loading…|Loading\.\.\./i);
  assert.match(html, /role="status"/);
});
