import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Citation, CitationList } from "@/components/chat/Citation";

// Render coverage for the chat Citation component (components/chat/Citation).
// The modal is closed at SSR, so the initial markup shows the chip (the
// legal citation, with jurisdiction) but NOT the source link — that lives
// behind the click-to-open dialog. These assertions pin that contract.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("Citation chip shows the legal citation + jurisdiction, dialog button", () => {
  const html = render(
    <Citation
      source={{
        title: "Georgia broker license requirements",
        citation: "O.C.G.A. § 43-40-8",
        jurisdiction: "GA",
        sourceUrl: "https://law.justia.com/x",
        body: "A broker must...",
        similarity: 0.91,
      }}
    />,
  );
  assert.match(html, /O\.C\.G\.A\. § 43-40-8/);
  assert.match(html, /\(GA\)/);
  assert.match(html, /aria-haspopup="dialog"/);
  // Closed modal: the source URL is NOT in the initial markup.
  assert.ok(!html.includes("law.justia.com/x"));
});

test("Citation falls back to the title when there is no citation", () => {
  const html = render(
    <Citation source={{ title: "How approvals work", sourceUrl: null }} />,
  );
  assert.match(html, /How approvals work/);
});

test("CitationList renders a cited: provenance row", () => {
  const html = render(
    <CitationList
      sources={[
        { title: "GA broker license", citation: "O.C.G.A. § 43-40-8", jurisdiction: "GA" },
        { title: "Self-employment tax", citation: "IRS Pub 334", jurisdiction: "US" },
      ]}
    />,
  );
  assert.match(html, /cited:/i);
  assert.match(html, /O\.C\.G\.A\. § 43-40-8/);
  assert.match(html, /IRS Pub 334/);
});

test("CitationList renders nothing when empty", () => {
  assert.equal(render(<CitationList sources={[]} />), "");
});
