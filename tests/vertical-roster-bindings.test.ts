import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getAllVerticals } from "@/lib/verticals";
import { SKILL_CATALOG } from "@/lib/skills/registry";
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
  /** Roster slug for the Compliance Sentinel card, when this vertical's
   *  corpus ships literal-match triggers and the inbox loop runs the
   *  scanner against drafts. */
  complianceSlug?: string;
  expectedLive: number;
  expectedRooting: number;
}

const EXPECTED_LIVE_OWNS: Record<string, VerticalBinding> = {
  "real-estate": {
    buyerInquirySlug: "realty-buyer-inquiry-router",
    schedulingSlug: "realty-showing-scheduler",
    // Sentinel goes live this PR — the HUD literal-trigger list scans
    // every draft body + subject and writes a COMPLIANCE_FLAG approval
    // attributed to this slug when matches fire.
    complianceSlug: "realty-compliance-sentinel",
    expectedLive: 3,
    expectedRooting: 4,
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
    // law-intake-onboarding goes live this PR via the deterministic
    // intake-conflict-screen skill (boundSkill — works on a JSON-stub
    // ledger today, binds to Clio / MyCase MCPs when they ship).
    expectedLive: 1,
    expectedRooting: 6,
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
    // ria-performance-reporter goes live this PR via the ria-client-update-
    // draft skill (boundSkill — JSON-stub portfolio snapshot today, binds
    // to Orion / Black Diamond / Tamarac MCPs when they ship). Never
    // renders dollar amounts; every figure is an advisor merge field.
    expectedLive: 1,
    expectedRooting: 6,
  },
  "home-services": {
    buyerInquirySlug: "home-services-lead-router",
    expectedLive: 1,
    expectedRooting: 6,
  },
  "title-escrow": {
    // title-doc-chase goes live this PR via the title-escrow-closing-doc-
    // chase skill (boundSkill — JSON-stub closing file today, binds to
    // SoftPro / Qualia / RamQuest MCPs when they ship). Title status +
    // wire-instructions confirmation always defer to operator merge fields.
    expectedLive: 1,
    expectedRooting: 6,
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

  it("live agents declare either owns[] (inbox-loop) or boundSkill (skill-direct)", () => {
    // A card is LIVE through one of two pathways:
    //   - owns[]: the inbox loop attributes a work bucket to this slug, OR
    //   - boundSkill: a catalog-registered, test-gated skill backs it.
    // Both axes raise the bar for what counts as "live" — see the
    // vertical-depth brief (2026-05-22) "no hollow shells" rule.
    const catalogSlugs = new Set(SKILL_CATALOG.map((s) => s.slug));
    for (const vertical of getAllVerticals()) {
      for (const agent of vertical.agentRoster ?? []) {
        if (agent.runtime !== "live") continue;
        const ownsClaimed = (agent.owns?.length ?? 0) > 0;
        const skillBound = typeof agent.boundSkill === "string" && agent.boundSkill.length > 0;
        assert.ok(
          ownsClaimed || skillBound,
          `${vertical.slug}/${agent.slug} is live but declares neither owns[] nor boundSkill`,
        );
        if (skillBound) {
          assert.ok(
            catalogSlugs.has(agent.boundSkill!),
            `${vertical.slug}/${agent.slug} boundSkill "${agent.boundSkill}" is not in SKILL_CATALOG`,
          );
        }
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

  it("each vertical's compliance binding (if any) maps to the expected sentinel slug", () => {
    for (const vertical of getAllVerticals()) {
      const expected = EXPECTED_LIVE_OWNS[vertical.slug];
      if (!expected.complianceSlug) {
        // Sentinel hasn't been promoted to live for this vertical yet — its
        // roster card (when present) must remain rooting with a truthful note.
        const liveSentinel = (vertical.agentRoster ?? []).find(
          (a) => a.runtime === "live" && (a.owns?.includes("compliance-check") ?? false),
        );
        assert.equal(
          liveSentinel,
          undefined,
          `${vertical.slug} should NOT bind compliance-check but ${liveSentinel?.slug ?? ""} does`,
        );
        continue;
      }
      const owner = (vertical.agentRoster ?? []).find(
        (a) => a.slug === expected.complianceSlug,
      );
      assert.ok(owner, `${vertical.slug}: ${expected.complianceSlug} missing from roster`);
      assert.equal(owner!.runtime, "live" as AgentRuntimeStatus);
      assert.ok(owner!.owns?.includes("compliance-check"));
    }
  });
});
