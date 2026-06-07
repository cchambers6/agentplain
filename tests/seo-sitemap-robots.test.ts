import { describe, it } from "node:test";
import assert from "node:assert/strict";

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { VERTICAL_SLUGS } from "@/lib/verticals";

// Sitemap + robots hygiene guards for the SEO/marketing pack.

describe("seo — sitemap", () => {
  const entries = sitemap();
  const byUrl = new Map(entries.map((e) => [e.url, e]));

  it("includes the homepage at priority 1.0 and the privacy/terms/security trio at 0.3", () => {
    assert.equal(byUrl.get("https://agentplain.com/")?.priority, 1.0);
    for (const p of ["/privacy", "/terms", "/security"]) {
      assert.equal(
        byUrl.get(`https://agentplain.com${p}`)?.priority,
        0.3,
        `${p} must be priority 0.3`,
      );
    }
  });

  it("lists pricing + verticals index at 0.9 and every vertical page at 0.9", () => {
    assert.equal(byUrl.get("https://agentplain.com/pricing")?.priority, 0.9);
    assert.equal(byUrl.get("https://agentplain.com/verticals")?.priority, 0.9);
    for (const slug of VERTICAL_SLUGS) {
      assert.equal(
        byUrl.get(`https://agentplain.com/${slug}`)?.priority,
        0.9,
        `vertical ${slug} must be priority 0.9`,
      );
    }
  });

  it("stamps lastModified = 2026-06-06 on every entry", () => {
    for (const e of entries) {
      assert.equal(e.lastModified, "2026-06-06", `${e.url} lastmod drift`);
    }
  });

  it("leaks NO operator/app/api routes into the sitemap", () => {
    for (const e of entries) {
      for (const bad of ["/operator", "/app/", "/api/", "/promo"]) {
        assert.ok(
          !e.url.includes(bad),
          `${e.url} must not appear in the sitemap (gated/internal surface)`,
        );
      }
    }
  });
});

describe("seo — robots", () => {
  const r = robots();
  const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules!;
  const disallow = ([] as string[]).concat(rule.disallow ?? []);
  const allow = ([] as string[]).concat(rule.allow ?? []);

  it("disallows operator/app/api/promo and allows /api/og + the sitemap link", () => {
    for (const d of ["/api/", "/app/", "/operator/", "/promo/"]) {
      assert.ok(disallow.includes(d), `robots must disallow ${d}`);
    }
    assert.ok(allow.includes("/api/og"), "robots must carve out /api/og");
    assert.equal(r.sitemap, "https://agentplain.com/sitemap.xml");
  });
});
