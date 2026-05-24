/**
 * tests/realty-fleet-binding.test.ts
 *
 * Pins the P0 fix: the realty fleet's 7 roster slugs are bound to a
 * truthful runtime status so the `/agents` cards RESOLVE instead of
 * spinning "rooting in" forever.
 *
 * "Resolved" is machine-checked here as: every realty roster entry
 * declares a `runtime` ∈ {live, rooting}; live entries own a known
 * loop-work bucket; rooting entries state what they're waiting on; and
 * the attribution buckets each map to exactly one live agent (no
 * ambiguity, so a run can never light up two cards).
 *
 * The companion proof that LIVE agents actually accrue real activity
 * lives in `tests/skills-persist-artifacts.test.ts` (a buyer-inquiry run
 * → realty-buyer-inquiry-router; a scheduling run → realty-showing-
 * scheduler). Together they prove 0/7 → 7/7 resolved, 2 live + 5 rooting.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getVerticalContent } from "@/lib/verticals";
import type { AgentLoopWork, AgentRosterEntry } from "@/lib/verticals/types";

const ALL_WORK: AgentLoopWork[] = ["buyer-inquiry", "scheduling", "compliance-check"];

function realtyRoster(): AgentRosterEntry[] {
  const roster = getVerticalContent("real-estate")?.agentRoster;
  assert.ok(roster, "real-estate roster missing");
  return roster!;
}

describe("realty fleet binding — every card resolves (0/7 → 7/7)", () => {
  it("has exactly 7 capabilities, all with a declared runtime status", () => {
    const roster = realtyRoster();
    assert.equal(roster.length, 7, "expected the 7-agent realty fleet");
    const resolved = roster.filter(
      (a) => a.runtime === "live" || a.runtime === "rooting",
    );
    assert.equal(
      resolved.length,
      7,
      "every realty agent must declare runtime ∈ {live, rooting} — no perpetual spinner",
    );
  });

  it("live agents own at least one known loop-work bucket", () => {
    for (const a of realtyRoster().filter((x) => x.runtime === "live")) {
      assert.ok(a.owns && a.owns.length > 0, `${a.slug} live but owns nothing`);
      for (const w of a.owns!) {
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

  it("documents the live/rooting split this PR ships (3 live, 4 rooting)", () => {
    const roster = realtyRoster();
    const live = roster.filter((a) => a.runtime === "live").map((a) => a.slug);
    const rooting = roster.filter((a) => a.runtime === "rooting").map((a) => a.slug);
    assert.deepEqual(
      live.sort(),
      [
        "realty-buyer-inquiry-router",
        "realty-compliance-sentinel",
        "realty-showing-scheduler",
      ],
      "live set changed — update the binding doc + this assertion together",
    );
    assert.equal(rooting.length, 4, "expected 4 rooting capabilities");
  });
});
