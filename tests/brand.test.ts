import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokens, colorHex } from "@/lib/brand/tokens";

// Canonical agentplain brand standards v0.
// Source: C:\flatsbo\outputs\install_now\memory\agentplain_brand\agentplain_brand_standards_v0.md
// These tests pin spec-canonical values; derived tokens are pinned to current
// implementation but flagged as derived so they're cheap to update.

describe("brand tokens — canonical (spec §4)", () => {
  it("paper is #F7F4ED", () => {
    assert.equal(tokens.colors.paper.hex, "#F7F4ED");
    assert.equal(tokens.colors.paper.derived, undefined);
  });
  it("ink is #1A1A1F", () => {
    assert.equal(tokens.colors.ink.hex, "#1A1A1F");
    assert.equal(tokens.colors.ink.derived, undefined);
  });
  it("clay is #B65D3A (primary accent — never moss)", () => {
    assert.equal(tokens.colors.clay.hex, "#B65D3A");
    assert.equal(tokens.colors.clay.derived, undefined);
  });
  it("moss is #3F5C3F (verified-only — never primary accent)", () => {
    assert.equal(tokens.colors.moss.hex, "#3F5C3F");
    assert.equal(tokens.colors.moss.derived, undefined);
  });
  it("flag is #B43A3A (error/compliance utility only)", () => {
    assert.equal(tokens.colors.flag.hex, "#B43A3A");
    assert.equal(tokens.colors.flag.derived, undefined);
  });
  it("mute is #8C8478 (warm secondary text, not cool slate)", () => {
    assert.equal(tokens.colors.mute.hex, "#8C8478");
    assert.equal(tokens.colors.mute.derived, undefined);
  });
});

describe("brand tokens — typography (spec §3)", () => {
  it("display family is Source Serif 4 (V0 dev — not Cormorant)", () => {
    assert.equal(tokens.typography.displayFamily, "Source Serif 4");
  });
  it("sans family is Inter", () => {
    assert.equal(tokens.typography.sansFamily, "Inter");
  });
  it("mono family is JetBrains Mono", () => {
    assert.equal(tokens.typography.monoFamily, "JetBrains Mono");
  });
});

describe("brand tokens — locked strings (spec §1, §2)", () => {
  it("wordmark is `agentplain` lowercase, no space, no hyphen", () => {
    assert.equal(tokens.wordmark, "agentplain");
  });
  it("tagline is the locked form 'Intelligence rooted in reality.' (no mid-period; locked 2026-05-11 per project_agentplain_mission_and_positioning.md)", () => {
    assert.equal(tokens.tagline, "Intelligence rooted in reality.");
  });
  it("version is v0", () => {
    assert.equal(tokens.version, "v0");
  });
});

describe("brand tokens — derived utilities flagged correctly", () => {
  for (const key of ["paperDeep", "inkSoft", "clayDeep", "rule"] as const) {
    it(`${key} is flagged derived`, () => {
      assert.equal(tokens.colors[key].derived, true);
    });
  }
});

describe("colorHex — tailwind consumption surface", () => {
  it("exposes every token under its tailwind-class name", () => {
    assert.equal(colorHex.paper, "#F7F4ED");
    assert.equal(colorHex.ink, "#1A1A1F");
    assert.equal(colorHex.clay, "#B65D3A");
    assert.equal(colorHex.moss, "#3F5C3F");
    assert.equal(colorHex.flag, "#B43A3A");
    assert.equal(colorHex.mute, "#8C8478");
    assert.equal(colorHex["paper-deep"], "#EDE9DE");
    assert.equal(colorHex["ink-soft"], "#2E2E33");
    assert.equal(colorHex["clay-deep"], "#9A4D2F");
    assert.equal(colorHex.rule, "#E0DAC9");
  });
  it("does not expose flatsbo-leaked tokens (signal / amber / slate)", () => {
    const banned = ["signal", "signal-deep", "amber", "slate", "slate-soft"];
    for (const name of banned) {
      assert.equal(
        (colorHex as Record<string, string>)[name],
        undefined,
        `${name} must not appear in colorHex — it is flatsbo-leaked`,
      );
    }
  });
});
