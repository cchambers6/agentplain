/**
 * tests/realty-fleet-binding.test.ts
 *
 * Pins the P0 fix: every realty roster slug is bound to a truthful
 * runtime status so the `/agents` cards RESOLVE instead of spinning
 * "rooting in" forever.
 *
 * "Resolved" is machine-checked here as: every realty roster entry
 * declares a `runtime` ∈ {live, rooting}; live entries either own a
 * known loop-work bucket (inbox-loop attribution) OR bind a catalog-
 * registered, test-gated skill (skill-direct attribution); rooting
 * entries state what they're waiting on; and the inbox-loop buckets
 * each map to exactly one live agent (no ambiguity).
 *
 * The companion proof that LIVE agents actually accrue real activity
 * lives in `tests/skills-persist-artifacts.test.ts` (a buyer-inquiry run
 * → realty-buyer-inquiry-router; a scheduling run → realty-showing-
 * scheduler).
 *
 * 2026-05-25 update: the horizontal `realty-chief-of-staff` card joined
 * the roster, bound to the catalog `chief-of-staff-scheduler` skill —
 * raises the realty fleet to 8 entries (4 live, 4 rooting).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getVerticalContent } from "@/lib/verticals";
import { SKILL_CATALOG } from "@/lib/skills/registry";
import type { AgentLoopWork, AgentRosterEntry } from "@/lib/verticals/types";

const ALL_WORK: AgentLoopWork[] = ["buyer-inquiry", "scheduling", "compliance-check"];

function realtyRoster(): AgentRosterEntry[] {
  const roster = getVerticalContent("real-estate")?.agentRoster;
  assert.ok(roster, "real-estate roster missing");
  return roster!;
}

describe("realty fleet binding — every card resolves", () => {
  it("has exactly 8 capabilities, all with a declared runtime status", () => {
    const roster = realtyRoster();
    assert.equal(roster.length, 8, "expected the 8-agent realty fleet");
    const resolved = roster.filter(
      (a) => a.runtime === "live" || a.runtime === "rooting",
    );
    assert.equal(
      resolved.length,
      8,
      "every realty agent must declare runtime ∈ {live, rooting} — no perpetual spinner",
    );
  });

  it("live agents own a known loop-work bucket OR bind a catalog skill", () => {
    const catalogSlugs = new Set(SKILL_CATALOG.map((s) => s.slug));
    for (const a of realtyRoster().filter((x) => x.runtime === "live")) {
      const ownsKnown = (a.owns ?? []).length > 0;
      const bindsCatalog =
        typeof a.boundSkill === "string" && catalogSlugs.has(a.boundSkill);
      assert.ok(
        ownsKnown || bindsCatalog,
        `${a.slug} is live but declares neither owns[] nor boundSkill`,
      );
      for (const w of a.owns ?? []) {
        assert.ok(ALL_WORK.includes(w), `${a.slug} owns unknown work "${w}"`);
      }
    }
  });

  it("rooting agents carry a truthful note (no implied imminence)", () => {
    for (const a of realtyRoster().filter((x) => x.runtime === "rooting")) {
      assert.ok(
        a.rootingNote && a.rootingNote.trim().length > 0,
        `${a.slug} is rooting but has no rootingNote`,
      );
      assert.ok(!a.owns, `${a.slug} is rooting but claims owned work`);
    }
  });

  it("each loop-work bucket maps to exactly one live agent (unambiguous attribution)", () => {
    const roster = realtyRoster();
    for (const work of ALL_WORK) {
      const owners = roster.filter(
        (a) => a.runtime === "live" && (a.owns?.includes(work) ?? false),
      );
      assert.equal(
        owners.length,
        1,
        `loop-work "${work}" must be owned by exactly one live agent, got ${owners.length}`,
      );
    }
  });

  it("documents the live/rooting split this PR ships (4 live, 4 rooting)", () => {
    const roster = realtyRoster();
    const live = roster.filter((a) => a.runtime === "live").map((a) => a.slug);
    const rooting = roster.filter((a) => a.runtime === "rooting").map((a) => a.slug);
    assert.deepEqual(
      live.sort(),
      [
        "realty-buyer-inquiry-router",
        "realty-chief-of-staff",
        "realty-compliance-sentinel",
        "realty-showing-scheduler",
      ],
      "live set changed — update the binding doc + this assertion together",
    );
    assert.equal(rooting.length, 4, "expected 4 rooting capabilities");
  });
});
