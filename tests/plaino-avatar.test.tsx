import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainoAvatar } from "@/components/ui/ap";

// PlainoAvatar is now a DEPRECATED SHIM over PlainoStatus — the live-state
// pose family (Conner two-family ratification 2026-06-10; see
// docs/brand/icon-families.md). It renders a plain <img> pose raster, mapping
// its legacy pose prop to a PlainoStatus state. These tests lock the shim
// contract: it is an <img>, each pose resolves to its pose PNG, and the a11y
// label flips with `decorative`.

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("PlainoAvatar renders a plain <img> pointing at the default pose raster", () => {
  const html = render(<PlainoAvatar />);
  assert.match(html, /<img/);
  // Default pose 'sit' → the sitting-alert pose raster.
  assert.match(html, /\/brand\/plaino-system\/poses\/sitting-alert\.png/);
});

test("PlainoAvatar is decorative by default (hidden from assistive tech)", () => {
  const html = render(<PlainoAvatar />);
  assert.match(html, /aria-hidden="true"/);
  // No standalone label when paired with the name text elsewhere.
  assert.doesNotMatch(html, /alt="Plaino is/);
});

test("PlainoAvatar announces the live state when standing alone", () => {
  const html = render(<PlainoAvatar decorative={false} pose="fetch" />);
  assert.doesNotMatch(html, /aria-hidden/);
  assert.match(html, /alt="Plaino is fetching"/);
});

test("PlainoAvatar size maps to a px box (md → 32)", () => {
  const html = render(<PlainoAvatar size="md" />);
  assert.match(html, /width="32"/);
  assert.match(html, /height="32"/);
});

test("PlainoAvatar maps pose='herd' to the herding pose raster", () => {
  const html = render(<PlainoAvatar pose="herd" tone="clay" className="shrink-0" />);
  assert.match(html, /data-plaino-state="herding"/);
  assert.match(html, /\/brand\/plaino-system\/poses\/herding\.png/);
  assert.match(html, /shrink-0/);
});
