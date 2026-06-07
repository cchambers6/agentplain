import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acceptanceCriteriaFor,
  brandSnapshot,
  buildBriefPacket,
  BRAND_GUARDRAILS,
} from "./packet";

describe("brandSnapshot", () => {
  it("freezes the locked wordmark + tagline", () => {
    const s = brandSnapshot();
    assert.equal(s.wordmark, "agentplain");
    assert.equal(s.tagline, "Intelligence rooted in reality.");
  });

  it("names Plaino as the service partner", () => {
    assert.equal(brandSnapshot().servicePartner.name, "Plaino");
  });

  it("carries the core palette with real hex values", () => {
    const clay = brandSnapshot().palette.find((c) => c.name === "clay");
    assert.equal(clay?.hex, "#B65D3A");
  });
});

describe("BRAND_GUARDRAILS", () => {
  it("encodes the plain-never-plane rule", () => {
    assert.ok(
      BRAND_GUARDRAILS.some((g) => /plain.*never.*plane/i.test(g)),
      "guardrails must ban the plane wordplay",
    );
  });

  it("encodes the no-synthetic-faces rule", () => {
    assert.ok(
      BRAND_GUARDRAILS.some((g) => /synthetic|AI-generated/i.test(g)),
    );
  });
});

describe("acceptanceCriteriaFor", () => {
  it("includes the base criteria for every kind", () => {
    const c = acceptanceCriteriaFor("OTHER");
    assert.ok(c.some((x) => /source files delivered/i.test(x)));
  });

  it("adds brand-mark-specific criteria for BRAND_MARK", () => {
    const c = acceptanceCriteriaFor("BRAND_MARK");
    assert.ok(c.some((x) => /16px favicon/i.test(x)));
    assert.ok(c.some((x) => /robot-dog/i.test(x)));
  });

  it("appends extra criteria when provided", () => {
    const c = acceptanceCriteriaFor("OTHER", ["must ship by Friday"]);
    assert.ok(c.includes("must ship by Friday"));
  });
});

describe("buildBriefPacket", () => {
  it("prepends the direction to the guardrails", () => {
    const p = buildBriefPacket({
      kind: "MASCOT_ILLUSTRATION",
      direction: "Plaino sitting, head tilted, reviewing a document",
    });
    assert.match(p.guardrails[0], /^Direction: Plaino sitting/);
  });

  it("uses per-kind delivery defaults", () => {
    const p = buildBriefPacket({ kind: "BRAND_MARK", direction: "x" });
    assert.ok(p.delivery.formats.some((f) => /SVG/.test(f)));
    assert.ok(p.delivery.constraints.some((c) => /16px/.test(c)));
  });

  it("honors delivery overrides", () => {
    const p = buildBriefPacket({
      kind: "OTHER",
      direction: "x",
      delivery: { formats: ["GIF"] },
    });
    assert.deepEqual(p.delivery.formats, ["GIF"]);
  });

  it("defaults references to empty", () => {
    const p = buildBriefPacket({ kind: "OTHER", direction: "x" });
    assert.deepEqual(p.references, []);
  });

  it("carries supplied references through", () => {
    const p = buildBriefPacket({
      kind: "HERO_ILLUSTRATION",
      direction: "x",
      references: [{ ref: "blob://north.png", role: "north-star" }],
    });
    assert.equal(p.references[0].role, "north-star");
  });
});
