import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  organizationJsonLd,
  softwareApplicationJsonLd,
  serviceJsonLd,
  verticalServiceJsonLd,
  verticalProductJsonLd,
  verticalBreadcrumbJsonLd,
  faqPageJsonLd,
  ROI_BAND,
  ROI_FRAME,
  BASE_URL,
} from "@/lib/seo/structured-data";
import { alternatesFor, hreflangLanguages } from "@/lib/seo/metadata";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { FAQ_ITEMS } from "@/components/FAQ";
import { pricingFaqItems } from "@/components/FAQ";

// SEO/marketing pack regression guards. The load-bearing invariants:
//   - the retired 107× ROI claim never appears in any structured-data payload
//   - every per-vertical multiplier stays at/under the 50× cap
//   - structured data is VENDOR-INVISIBLE: no AI model/provider name appears
//     (2026-06-11 rule — the sanctioned disclosure home is the privacy/security
//     subprocessor list, not crawler-facing JSON-LD)
//   - canonical + hreflang stub are emitted for marketing routes

function deepStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => deepStrings(v, out));
  else if (obj && typeof obj === "object")
    Object.values(obj as Record<string, unknown>).forEach((v) =>
      deepStrings(v, out),
    );
  return out;
}

describe("seo — Organization + SoftwareApplication", () => {
  it("Organization frames agentplain as a managed AI fleet (vendor-generic)", () => {
    const org = organizationJsonLd();
    assert.equal(org["@type"], "Organization");
    const blob = deepStrings(org).join(" ").toLowerCase();
    assert.ok(
      blob.includes("managed ai fleet") || blob.includes("run for you"),
      "Organization must frame agentplain as a managed, run-for-you AI fleet",
    );
  });

  it("SoftwareApplication declares no AI vendor (no isBasedOn model node)", () => {
    const app = softwareApplicationJsonLd();
    assert.equal(app["@type"], "SoftwareApplication");
    // 2026-06-11: the isBasedOn Claude/Anthropic node was removed — the
    // underlying model is not named in crawler-facing structured data.
    assert.ok(app.isBasedOn === undefined, "must NOT declare an isBasedOn model node");
    // Offers span the self-serve ladder; must be a real price band.
    const offers = app.offers as Record<string, unknown>;
    assert.equal(offers["@type"], "AggregateOffer");
    assert.ok((offers.lowPrice as number) >= 99, "low price floor is $99/seat");
    assert.ok((offers.highPrice as number) >= (offers.lowPrice as number));
  });

  it("is vendor-invisible — no AI model/provider name in any payload", () => {
    const blob = [
      organizationJsonLd(),
      softwareApplicationJsonLd(),
      serviceJsonLd(),
      ...getAllVerticals().map(verticalServiceJsonLd),
      ...getAllVerticals().map(verticalProductJsonLd),
    ]
      .flatMap((p) => deepStrings(p))
      .join(" ")
      .toLowerCase();
    for (const vendor of ["claude", "anthropic", "chatgpt", "openai", "gpt-"]) {
      assert.ok(!blob.includes(vendor), `vendor name leaked into JSON-LD: "${vendor}"`);
    }
  });
});

describe("seo — per-vertical Product payloads", () => {
  it("emits a Product with the softened ROI band for every vertical", () => {
    for (const v of getAllVerticals()) {
      const product = verticalProductJsonLd(v);
      assert.equal(product["@type"], "Product");
      const props = product.additionalProperty as Array<Record<string, unknown>>;
      const band = props.find((p) => p.name === "ROI band");
      assert.ok(band, `${v.slug} missing ROI band property`);
      assert.equal(band!.value, ROI_BAND);
      const desc = product.description as string;
      assert.ok(desc.includes(ROI_FRAME), `${v.slug} Product desc missing ROI frame`);
    }
  });

  it("the retired 107× claim never appears, and no multiplier exceeds 50×", () => {
    for (const v of getAllVerticals()) {
      const blob = deepStrings(verticalProductJsonLd(v)).join(" ");
      assert.ok(!blob.includes("107"), `${v.slug} Product payload contains 107`);
      // Every NNx token in the vertical multiplier must be ≤ 50.
      const nums = (v.roi.multiplier.match(/(\d+)\s*[x×]/gi) ?? []).map((m) =>
        parseInt(m, 10),
      );
      for (const n of nums) {
        assert.ok(n <= 50, `${v.slug} multiplier ${n}x exceeds the 50× cap`);
      }
    }
  });

  it("self-serve tiers carry a price Offer; quote-based Max omits it", () => {
    for (const v of getAllVerticals()) {
      const product = verticalProductJsonLd(v);
      if (v.tier === "max") {
        assert.equal(
          product.offers,
          undefined,
          `${v.slug} is Max (quoted) — must NOT publish an invented seat price`,
        );
      } else {
        const offers = product.offers as Record<string, unknown>;
        assert.ok(offers, `${v.slug} self-serve tier must publish an Offer`);
        assert.equal(offers["@type"], "AggregateOffer");
        assert.ok((offers.lowPrice as number) > 0);
      }
    }
  });
});

describe("seo — FAQ payloads + breadcrumbs", () => {
  it("homepage FAQPage mirrors all FAQ_ITEMS", () => {
    const faq = faqPageJsonLd(FAQ_ITEMS);
    assert.equal(faq["@type"], "FAQPage");
    assert.equal(
      (faq.mainEntity as unknown[]).length,
      FAQ_ITEMS.length,
      "FAQPage must mirror every visible FAQ item",
    );
  });

  it("pricing FAQ subset is non-empty and all tagged pricing", () => {
    const items = pricingFaqItems();
    assert.ok(items.length >= 3, "expected the pricing FAQ subset to be populated");
    assert.ok(items.every((i) => i.topic === "pricing"));
  });

  it("breadcrumb resolves Home → Verticals → {Vertical} with absolute items", () => {
    const v = getVerticalContent("real-estate")!;
    const bc = verticalBreadcrumbJsonLd(v);
    const items = bc.itemListElement as Array<Record<string, unknown>>;
    assert.equal(items.length, 3);
    assert.equal(items[2].item, `${BASE_URL}/real-estate`);
  });
});

describe("seo — canonical + hreflang stub", () => {
  it("canonical is self-referential and normalized", () => {
    assert.deepEqual(alternatesFor("/pricing").canonical, "/pricing");
    assert.deepEqual(alternatesFor("/").canonical, "/");
    // trailing slash stripped except root
    assert.deepEqual(alternatesFor("/about/").canonical, "/about");
  });

  it("hreflang stub emits x-default + en-US absolute URLs, no live variants yet", () => {
    const langs = hreflangLanguages("/real-estate");
    assert.equal(langs["x-default"], `${BASE_URL}/real-estate`);
    assert.equal(langs["en-US"], `${BASE_URL}/real-estate`);
    // No en-GB/en-AU until the variants actually ship.
    assert.equal(langs["en-GB"], undefined);
    assert.equal(langs["en-AU"], undefined);
  });
});
