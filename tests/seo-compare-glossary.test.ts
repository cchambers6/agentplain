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

  it("pricing claims cite only the locked $99–$299 ladder (+ cited regulatory figures)", () => {
    // Seat prices must be the locked ladder. The single non-price figure
    // allowed is the HUD first-offense fair-housing civil penalty — a cited
    // regulatory amount (24 CFR 180.671, 2025 inflation adjustment), sourced
    // in docs/marketing/compare-pages-2026-07-08/RESEARCH-NOTES.md. Any new
    // dollar figure needs a source note there before it lands here.
    const ALLOWED = ["$99", "$199", "$299", "$26,262"];
    for (const c of getAllComparisons()) {
      const blob = deepStrings(c).join(" ");
      const dollars = blob.match(/\$[\d,]+/g) ?? [];
      for (const d of dollars) {
        assert.ok(ALLOWED.includes(d), `${c.slug} cites an unsourced figure ${d}`);
      }
    }
  });

  it("ships the Georgia real-estate vendor comparisons (2026-07-08 wave)", () => {
    for (const slug of ["follow-up-boss", "sierra", "boldtrail"]) {
      const c = getComparison(slug);
      assert.ok(c, `missing vendor comparison: ${slug}`);
      // The ratified vendor-page frame: shared pain, specific gaps, the
      // run-for-you explainer, and the intro-call CTA the outbound emails
      // drive to.
      assert.ok(c!.sharedPain && c!.sharedPain.length > 100, `${slug} missing shared-pain intro`);
      assert.ok((c!.cantDo?.length ?? 0) >= 3, `${slug} needs ≥3 specific gaps`);
      assert.ok((c!.runForYou?.length ?? 0) >= 2, `${slug} missing run-for-you section`);
      assert.equal(c!.bookingCta, true, `${slug} must use the booking CTA`);
      assert.equal(c!.rows.length, 5, `${slug} table must be the 5 ratified dimensions`);
      // Integration honesty: these vendors are roadmap, not wired. The word
      // "integrate" may appear only in an FAQ that answers honestly ("Not
      // directly today").
      const faqIntegration = c!.faq.find((f) => /integrat/i.test(f.q));
      if (faqIntegration) {
        assert.ok(
          /not directly today/i.test(faqIntegration.a),
          `${slug} integration FAQ must answer honestly`,
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
