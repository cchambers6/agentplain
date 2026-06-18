// Portal unit coverage: slug/filename normalization, ref storage (non-durable),
// cookie TTL, the new approval render, and the branded shell SSR.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizeSlug } from "@/lib/portal/config";
import { sanitizeFilename } from "@/lib/portal/documents";
import { RefStorage } from "@/lib/portal/storage";
import { buildPortalCookieOpts } from "@/lib/portal/identity";
import { renderApprovalPayload } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";
import { PortalShell } from "@/components/portal/PortalShell";
import type { PortalBrand } from "@/lib/portal/config";

describe("normalizeSlug", () => {
  it("lowercases and strips unsafe characters", () => {
    assert.equal(normalizeSlug("  Smith & Co.  "), "smith-co");
    assert.equal(normalizeSlug("Daly_Law/Firm"), "daly-law-firm");
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators and leading dots", () => {
    const cleaned = sanitizeFilename("../../etc/passwd");
    assert.doesNotMatch(cleaned, /[\\/]/, "no path separators survive");
    assert.doesNotMatch(cleaned, /^\./, "no leading dot (no traversal)");
    assert.equal(sanitizeFilename("my report.pdf"), "my_report.pdf");
  });
  it("never returns empty", () => {
    assert.equal(sanitizeFilename("..."), "upload");
  });
});

describe("RefStorage", () => {
  it("returns a non-durable ref URL (keeps ref docs non-downloadable)", async () => {
    const stored = await new RefStorage().put({
      pathname: "portal/cfg/case/file.pdf",
      contentType: "application/pdf",
      data: new Uint8Array([1, 2, 3]),
    });
    assert.equal(stored.durable, false);
    assert.match(stored.url, /^ref:\/\/portal\//);
  });
});

describe("buildPortalCookieOpts", () => {
  it("is httpOnly, lax, with a 30-day default maxAge", () => {
    const opts = buildPortalCookieOpts();
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, "lax");
    assert.equal(opts.path, "/");
    assert.equal(opts.maxAge, 30 * 24 * 60 * 60);
  });
});

describe("renderApprovalPayload — PORTAL_CLIENT_MESSAGE", () => {
  it("renders recipient + drafted body + an awaiting-approval line", () => {
    const rendered = renderApprovalPayload("PORTAL_CLIENT_MESSAGE", {
      type: "portal_message",
      toClientEmail: "dana@example.com",
      body: "Here's the update you asked for.",
    });
    assert.equal(rendered.kindLabel, "message to your client");
    assert.match(rendered.recipientLine ?? "", /dana@example\.com/);
    assert.ok(rendered.body.some((l) => /only after you approve/i.test(l)));
    assert.ok(rendered.body.some((l) => /update you asked for/i.test(l)));
    assert.equal(rendered.editableBody, "Here's the update you asked for.");
  });
});

describe("PortalShell SSR", () => {
  const brand: PortalBrand = {
    portalConfigId: "cfg-1",
    slug: "daly-law",
    brandName: "Daly Law",
    brandColor: "#2E5A3A",
    brandLogoUrl: null,
  };

  it("renders the owner's brand name + accent and a quiet agentplain footer", () => {
    const html = renderToStaticMarkup(
      createElement(PortalShell, { brand, clientName: "Dana" }, "child-content"),
    );
    assert.match(html, /Daly Law/);
    assert.match(html, /#2E5A3A/);
    assert.match(html, /Signed in as Dana/);
    assert.match(html, /Secured by agentplain/);
    assert.match(html, /child-content/);
  });

  it("rejects a non-hex brand color (no CSS injection)", () => {
    const html = renderToStaticMarkup(
      createElement(
        PortalShell,
        { brand: { ...brand, brandColor: "red; background:url(x)" } },
        "x",
      ),
    );
    // Falls back to clay; the injected string never reaches the style attr.
    assert.doesNotMatch(html, /background:url\(x\)/);
    assert.match(html, /#B65D3A/);
  });
});
