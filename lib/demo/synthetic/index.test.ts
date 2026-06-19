import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Vertical } from "@prisma/client";
import {
  syntheticDatasetFor,
  VERTICALS_WITH_BESPOKE_DEMO,
} from "./index";

const BESPOKE: Vertical[] = ["REAL_ESTATE", "CPA", "LAW", "PROPERTY_MANAGEMENT"];

describe("synthetic · resolver", () => {
  it("resolves a bespoke dataset per authored vertical", () => {
    for (const v of BESPOKE) {
      assert.equal(syntheticDatasetFor(v).vertical, v, `vertical ${v}`);
    }
  });

  it("falls back to general for null / unmapped", () => {
    assert.equal(syntheticDatasetFor(null).vertical, null);
    assert.equal(syntheticDatasetFor("MORTGAGE").vertical, null);
  });

  it("exposes the bespoke set", () => {
    assert.deepEqual([...VERTICALS_WITH_BESPOKE_DEMO].sort(), [...BESPOKE].sort());
  });
});

describe("synthetic · honesty", () => {
  const verticals: Array<Vertical | null> = [...BESPOKE, null];

  for (const v of verticals) {
    it(`${v ?? "general"} uses only @example.com placeholders`, () => {
      const d = syntheticDatasetFor(v);
      for (const c of d.clients) {
        assert.match(c.email, /@example\.com$/, `${c.name} email`);
      }
      assert.ok(d.sourceLabel.length > 0, "sourceLabel present");
    });
  }

  it("messages reference real clients where present", () => {
    const re = syntheticDatasetFor("REAL_ESTATE");
    assert.ok(re.messages.length > 0);
    const names = new Set(re.clients.map((c) => c.name));
    assert.ok(names.has(re.messages[0]!.from));
  });
});
