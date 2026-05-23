import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getAllVerticals } from "@/lib/verticals";
import type { AgentLoopWork, AgentRuntimeStatus } from "@/lib/verticals/types";

// Proof-of-resolved-counts test for the AgentRosterEntry runtime contract.
//
// Each vertical's roster declares which capabilities are wired into the V1
// inbox loop (`runtime: 'live'` + `owns: [...]`) and which are rooting
// pending an integration (`runtime: 'rooting'` + `rootingNote`). This
// table is the canonical truth; the content files are checked against it
// so a content edit cannot silently move a vertical out of binding.
//
// EXPECTED_LIVE_OWNS records exactly which roster slug owns each loop-work
// bucket per vertical. The persist-artifacts attribution resolver
// (lib/skills/persist-artifacts.ts → resolveOwningAgentSlug) finds the
// single `live` agent whose `owns` includes the run's bucket and stamps
// that slug as the trace root + approval agentSlug. When the table below
// claims a binding, `groupBy(fromAgent)` on the HandoffLogEntry table
// resolves real counts to that slug — the /agents card is no longer a
// "rooting in" spinner.
//
// A vertical with no entry for a bucket is honest: the inbox loop still
// runs (drafts land in Approvals), but no roster card claims that work —
// it falls back to SKILL_CHAIN_AGENT_SLUG. We do NOT pretend a capability
// is live when its runtime is still gated on an integration.

interface VerticalBinding {
  buyerInquirySlug?: string;
  schedulingSlug?: string;
  expectedLive: number;
  expectedRooting: number;
}

const EXPECTED_LIVE_OWNS: Record<string, VerticalBinding> = {
  "real-estate": {
    buyerInquirySlug: "realty-buyer-inquiry-router",
    schedulingSlug: "realty-showing-scheduler",
    expectedLive: 2,
    expectedRooting: 5,
  },
  mortgage: {
    buyerInquirySlug: "mortgage-borrower-triage",
    expectedLive: 1,
    expectedRooting: 6,
  },
  cpa: {
    buyerInquirySlug: "cpa-client-inbound",
    expectedLive: 1,
    expectedRooting: 6,
  },
  law: {
    // No roster agent maps to a live loop bucket today — every capability
    // depends on a matter-management surface. Inbox-loop drafts attribute
    // to the SKILL_CHAIN_AGENT_SLUG fallback; honest, not hollow.
    expectedLive: 0,
    expectedRooting: 7,
  },
  insurance: {
    buyerInquirySlug: "insurance-inbound-triage",
    expectedLive: 1,
    expectedRooting: 6,
  },
  recruiting: {
    buyerInquirySlug: "recruiting-outreach",
    schedulingSlug: "recruiting-scheduler",
    expectedLive: 2,
    expectedRooting: 5,
  },
  "property-management": {
    buyerInquirySlug: "pm-tenant-inbound",
    expectedLive: 1,
    expectedRooting: 6,
  },
  ria: {
    // Roster is meeting-cycle focused — no clean inbox classifier. All
    // capabilities root on a portfolio / CRM / planning system connection.
    expectedLive: 0,
    expectedRooting: 7,
  },
  "home-services": {
    buyerInquirySlug: "home-services-lead-router",
    expectedLive: 1,
    expectedRooting: 6,
  },
  "title-escrow": {
    // File Intake parses source documents, not inbound email — not a fit
    // for the buyer-inquiry bucket. All seven root on production-system /
    // title-plant / underwriter-portal connections.
    expectedLive: 0,
    expectedRooting: 7,
  },
};

describe("vertical roster bindings", () => {
  it("every ratified vertical declares an agentRoster", () => {
    for (const vertical of getAllVerticals()) {
      assert.ok(
        vertical.agentRoster && vertical.agentRoster.length > 0,
        `vertical ${vertical.slug} must declare a non-empty agentRoster`,
      );
    }
  });

  it("every roster entry has a runtime binding (live or rooting) — no legacy unbound entries", () => {
    for (const vertical of getAllVerticals()) {
      for (const agent of vertical.agentRoster ?? []) {
        assert.ok(
          agent.runtime === "live" || agent.runtime === "rooting",
          `${vertical.slug}/${agent.slug} must declare runtime ("live" | "rooting"); got ${String(agent.runtime)}`,
        );
      }
    }
  });

  it("live agents declare a non-empty owns list", () => {
    for (const vertical of getAllVerticals()) {
      for (const agent of vertical.agentRoster ?? []) {
        if (agent.runtime !== "live") continue;
        assert.ok(
          agent.owns && agent.owns.length > 0,
          `${vertical.slug}/${agent.slug} is live but missing owns[]`,
        );
      }
    }
  });

  it("rooting agents declare a rootingNote (honest waiting reason)", () => {
    for (const vertical of getAllVerticals()) {
      for (const agent of vertical.agentRoster ?? []) {
        if (agent.runtime !== "rooting") continue;
        assert.ok(
          agent.rootingNote && agent.rootingNote.length > 0,
          `${vertical.slug}/${agent.slug} is rooting but missing rootingNote`,
        );
      }
    }
  });

  it("each loop-work bucket is claimed by at most one live agent per vertical", () => {
    // Multiple live agents claiming the same bucket would make the
    // resolveOwningAgentSlug attribution ambiguous (`.find()` returns the
    // first match — silently dropping the others). Enforce single-claim.
    for (const vertical of getAllVerticals()) {
      const claims = new Map<AgentLoopWork, string[]>();
      for (const agent of vertical.agentRoster ?? []) {
        if (agent.runtime !== "live") continue;
        for (const work of agent.owns ?? []) {
          const list = claims.get(work) ?? [];
          list.push(agent.slug);
          claims.set(work, list);
        }
      }
      for (const [work, slugs] of claims) {
        assert.equal(
          slugs.length,
          1,
          `${vertical.slug} has ${slugs.length} live agents claiming ${work}: ${slugs.join(", ")}`,
        );
      }
    }
  });

  it("each vertical matches its expected live/rooting counts (resolved-count proof)", () => {
    for (const vertical of getAllVerticals()) {
      const expected = EXPECTED_LIVE_OWNS[vertical.slug];
      assert.ok(expected, `EXPECTED_LIVE_OWNS missing entry for ${vertical.slug}`);
      const live = (vertical.agentRoster ?? []).filter(
        (a) => a.runtime === "live",
      );
      const rooting = (vertical.agentRoster ?? []).filter(
        (a) => a.runtime === "rooting",
      );
      assert.equal(
        live.length,
        expected.expectedLive,
        `${vertical.slug}: expected ${expected.expectedLive} live, got ${live.length} (${live.map((a) => a.slug).join(", ")})`,
      );
      assert.equal(
        rooting.length,
        expected.expectedRooting,
        `${vertical.slug}: expected ${expected.expectedRooting} rooting, got ${rooting.length}`,
      );
    }
  });

  it("each vertical's buyer-inquiry binding (if any) maps to the expected slug", () => {
    for (const vertical of getAllVerticals()) {
      const expected = EXPECTED_LIVE_OWNS[vertical.slug];
      if (!expected.buyerInquirySlug) {
        // Should have no live agent claiming buyer-inquiry.
        const claimant = (vertical.agentRoster ?? []).find(
          (a) => a.runtime === "live" && (a.owns?.includes("buyer-inquiry") ?? false),
        );
        assert.equal(
          claimant,
          undefined,
          `${vertical.slug} should NOT bind buyer-inquiry but ${claimant?.slug ?? ""} does`,
        );
        continue;
      }
      const owner = (vertical.agentRoster ?? []).find(
        (a) => a.slug === expected.buyerInquirySlug,
      );
      assert.ok(owner, `${vertical.slug}: ${expected.buyerInquirySlug} missing from roster`);
      assert.equal(
        owner!.runtime,
        "live" as AgentRuntimeStatus,
        `${vertical.slug}/${expected.buyerInquirySlug} must be live to own buyer-inquiry`,
      );
      assert.ok(
        owner!.owns?.includes("buyer-inquiry"),
        `${vertical.slug}/${expected.buyerInquirySlug} must list buyer-inquiry in owns`,
      );
    }
  });

  it("each vertical's scheduling binding (if any) maps to the expected slug", () => {
    for (const vertical of getAllVerticals()) {
      const expected = EXPECTED_LIVE_OWNS[vertical.slug];
      if (!expected.schedulingSlug) {
        const claimant = (vertical.agentRoster ?? []).find(
          (a) => a.runtime === "live" && (a.owns?.includes("scheduling") ?? false),
        );
        assert.equal(
          claimant,
          undefined,
          `${vertical.slug} should NOT bind scheduling but ${claimant?.slug ?? ""} does`,
        );
        continue;
      }
      const owner = (vertical.agentRoster ?? []).find(
        (a) => a.slug === expected.schedulingSlug,
      );
      assert.ok(owner, `${vertical.slug}: ${expected.schedulingSlug} missing from roster`);
      assert.equal(owner!.runtime, "live" as AgentRuntimeStatus);
      assert.ok(owner!.owns?.includes("scheduling"));
    }
  });
});
