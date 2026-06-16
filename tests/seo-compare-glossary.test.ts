import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COMPARISON_SLUGS,
  getAllComparisons,
  getComparison,
} from "@/lib/marketing/comparisons";
import { GLOSSARY_TERMS } from "@/lib/marketing/glossary";
import {
  organizationJsonLd,
  webSiteJsonLd,
  breadcrumbJsonLd,
  definedTermSetJsonLd,
  faqPageJsonLd,
  BASE_URL,
} from "@/lib/seo/structured-data";
import sitemap from "@/app/sitemap";

function deepStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => deepStrings(v, out));
  else if (obj && typeof obj === "object")
    Object.values(obj as Record<string, unknown>).forEach((v) => deepStrings(v, out));
  return out;
}

describe("aeo — comparison pages", () => {
  it("ships the four task-specified comparisons", () => {
    for (const slug of ["diy", "chatgpt", "hiring-an-assistant", "agency"]) {
      assert.ok(getComparison(slug), `missing comparison: ${slug}`);
    }
  });

  it("every comparison is honest — names where the alternative wins first", () => {
    for (const c of getAllComparisons()) {
      assert.ok(c.whereAlternativeWins.length >= 2, `${c.slug} must concede ≥2 alternative strengths`);
      assert.ok(c.whereAgentplainWins.length >= 2, `${c.slug} missing agentplain strengths`);
      assert.ok(c.rows.length >= 4, `${c.slug} needs a substantive side-by-side`);
      assert.ok(c.directAnswer.length > 150, `${c.slug} directAnswer too thin`);
      assert.ok(c.faq.length >= 3, `${c.slug} needs ≥3 FAQ items`);
      for (const item of c.faq) {
        assert.ok(item.q.trim().endsWith("?"), `${c.slug} FAQ q not a question: ${item.q}`);
        assert.ok(item.a.trim().length > 60, `${c.slug} FAQ answer too short`);
      }
    }
  });

  it("never names the AI model that powers agentplain (Claude/Anthropic)", () => {
    for (const c of getAllComparisons()) {
      const blob = deepStrings(c).join(" ").toLowerCase();
      for (const banned of ["claude", "anthropic"]) {
        assert.ok(!blob.includes(banned), `${c.slug} names banned vendor "${banned}"`);
      }
    }
  });

  it("only the chatgpt comparison may name ChatGPT/OpenAI (the compared competitor)", () => {
    for (const c of getAllComparisons()) {
      const blob = deepStrings(c).join(" ").toLowerCase();
      const namesCompetitor = blob.includes("chatgpt") || blob.includes("openai");
      if (c.slug !== "chatgpt") {
        assert.ok(!namesCompetitor, `${c.slug} should not name ChatGPT/OpenAI`);
      }
    }
  });

  it("pricing claims cite only the locked $99–$299 ladder", () => {
    for (const c of getAllComparisons()) {
      const blob = deepStrings(c).join(" ");
      // Any dollar figure mentioned must be one of the locked seat prices.
      const dollars = blob.match(/\$\d+/g) ?? [];
      for (const d of dollars) {
        assert.ok(
          ["$99", "$199", "$299"].includes(d),
          `${c.slug} cites a non-ladder price ${d}`,
        );
      }
    }
  });

  it("comparison breadcrumb + FAQ JSON-LD are well-formed", () => {
    const c = getComparison("diy")!;
    const bc = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
      { name: c.navLabel, path: `/compare/${c.slug}` },
    ]);
    const items = bc.itemListElement as Array<Record<string, unknown>>;
    assert.equal(items.length, 3);
    assert.equal(items[0].item, `${BASE_URL}/`);
    assert.equal(items[2].item, `${BASE_URL}/compare/diy`);
    const faq = faqPageJsonLd(c.faq);
    assert.equal((faq.mainEntity as unknown[]).length, c.faq.length);
  });
});

describe("aeo — glossary", () => {
  it("defines the positioning terms agentplain wants to own", () => {
    const slugs = GLOSSARY_TERMS.map((t) => t.slug);
    for (const required of [
      "service-partner",
      "ai-service-partnership",
      "run-for-you-vs-diy",
      "the-fleet",
      "draft-then-approve",
    ]) {
      assert.ok(slugs.includes(required), `glossary missing required term: ${required}`);
    }
    assert.ok(GLOSSARY_TERMS.length >= 8, "expected a substantive glossary");
  });

  it("every term has a quotable definition and no banned vendor name", () => {
    for (const t of GLOSSARY_TERMS) {
      assert.ok(t.definition.length > 80, `${t.slug} definition too thin`);
      const blob = `${t.term} ${t.definition}`.toLowerCase();
      for (const banned of ["claude", "anthropic", "chatgpt", "openai"]) {
        assert.ok(!blob.includes(banned), `${t.slug} names vendor "${banned}"`);
      }
    }
  });

  it("DefinedTermSet emits one DefinedTerm per glossary entry", () => {
    const set = definedTermSetJsonLd(GLOSSARY_TERMS);
    assert.equal(set["@type"], "DefinedTermSet");
    const terms = set.hasDefinedTerm as Array<Record<string, unknown>>;
    assert.equal(terms.length, GLOSSARY_TERMS.length);
    assert.equal(terms[0]["@type"], "DefinedTerm");
  });
});

describe("seo — Organization logo + WebSite node", () => {
  it("Organization now carries a real logo asset", () => {
    const org = organizationJsonLd();
    const logo = org.logo as Record<string, unknown>;
    assert.equal(logo["@type"], "ImageObject");
    assert.ok(String(logo.url).startsWith(BASE_URL), "logo must be an absolute agentplain URL");
  });

  it("WebSite node points back to the Organization, no fake SearchAction", () => {
    const site = webSiteJsonLd();
    assert.equal(site["@type"], "WebSite");
    assert.equal(site.potentialAction, undefined, "no SearchAction — there is no site search");
    assert.ok((site.publisher as Record<string, unknown>)["@id"], "must reference the Organization");
  });
});

describe("seo — sitemap includes the AEO surfaces", () => {
  it("enumerates /compare, /glossary, and every comparison page", () => {
    const urls = sitemap().map((e) => e.url);
    assert.ok(urls.includes(`${BASE_URL}/compare`), "missing /compare");
    assert.ok(urls.includes(`${BASE_URL}/glossary`), "missing /glossary");
    for (const slug of COMPARISON_SLUGS) {
      assert.ok(urls.includes(`${BASE_URL}/compare/${slug}`), `missing /compare/${slug}`);
    }
  });

  it("never leaks a gated route", () => {
    const urls = sitemap().map((e) => e.url);
    for (const u of urls) {
      assert.ok(!/\/(app|operator|api|promo)(\/|$)/.test(u.replace(BASE_URL, "")), `gated route leaked: ${u}`);
    }
  });
});
