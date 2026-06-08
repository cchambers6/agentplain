import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainoAvatar } from "@/components/ui/ap";

// PlainoAvatar is the production successor to the old hairline-SVG scaffold:
// it now renders the real illustrated head-icon raster with a plain <img>
// (next/image would throw under bare node:test renderToStaticMarkup). These
// tests lock the contract: it is an <img>, it points at the shipped head-icon
// asset, and the a11y label flips with `decorative`.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("PlainoAvatar renders a plain <img> pointing at the head-icon asset", () => {
  const html = render(<PlainoAvatar />);
  assert.match(html, /<img/);
  assert.match(html, /\/brand\/plaino-system\/head-icon\.png/);
});

test("PlainoAvatar is decorative by default (hidden from assistive tech)", () => {
  const html = render(<PlainoAvatar />);
  assert.match(html, /aria-hidden="true"/);
  // No standalone label when paired with the name text elsewhere.
  assert.doesNotMatch(html, /aria-label="Plaino"/);
});

test("PlainoAvatar exposes role=img + aria-label when standing alone", () => {
  const html = render(<PlainoAvatar decorative={false} />);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Plaino"/);
});

test("PlainoAvatar size maps to a px box (md → 32)", () => {
  const html = render(<PlainoAvatar size="md" />);
  assert.match(html, /width="32"/);
  assert.match(html, /height="32"/);
});

test("PlainoAvatar keeps the pose prop in its contract (no throw, emitted as data-pose)", () => {
  const html = render(<PlainoAvatar pose="herd" tone="clay" className="shrink-0" />);
  assert.match(html, /data-pose="herd"/);
  assert.match(html, /shrink-0/);
});
