// Wave-2 skill marketplace — reader / writer + install gate.
//
// Covers:
//   1. `isSkillInstalledByDefault` — live skills installed for matching
//      vertical or 'all'; schema-only never installed by default.
//   2. `resolveInstallationStatus` — combines catalog runtime + the
//      customer's explicit install / uninstall row into one effective
//      `installed` flag. customerExplicit reflects whether the row
//      exists.
//   3. `installSkill` / `uninstallSkill` — upserts the row, writes
//      audit. Re-install clears `disabledAt`.
//   4. `isSkillInstalledForWorkspace` — the runtime gate. live skill
//      no row → default rule decides; live skill disabledAt → false;
//      live skill row no disabledAt → true; unknown slug → false.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Vertical } from "@prisma/client";

import {
  installSkill,
  isSkillInstalledByDefault,
  isSkillInstalledForWorkspace,
  resolveInstallationStatus,
  uninstallSkill,
} from "@/lib/skills/marketplace";
import { SKILL_CATALOG } from "@/lib/skills/registry";

interface FakeRow {
  workspaceId: string;
  skillSlug: string;
  installedAt: Date;
  installedByUserId: string | null;
  disabledAt: Date | null;
}

const buildStore = () => {
  const rows: FakeRow[] = [];
  const audits: Array<{ action: string; targetId?: string | null }> = [];
  const fakeTx = {
    workspaceSkillInstallation: {
      findMany: async (args: { where: { workspaceId: string } }) => {
        return rows.filter((r) => r.workspaceId === args.where.workspaceId);
      },
      findUnique: async (args: {
        where: {
          workspaceId_skillSlug: { workspaceId: string; skillSlug: string };
        };
      }) => {
        return (
          rows.find(
            (r) =>
              r.workspaceId === args.where.workspaceId_skillSlug.workspaceId &&
              r.skillSlug === args.where.workspaceId_skillSlug.skillSlug,
          ) ?? null
        );
      },
      upsert: async (args: {
        where: {
          workspaceId_skillSlug: { workspaceId: string; skillSlug: string };
        };
        create: Partial<FakeRow> & {
          workspaceId: string;
          skillSlug: string;
        };
        update: Partial<FakeRow>;
      }) => {
        const existing = rows.find(
          (r) =>
            r.workspaceId === args.where.workspaceId_skillSlug.workspaceId &&
            r.skillSlug === args.where.workspaceId_skillSlug.skillSlug,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return { id: `sk_${rows.indexOf(existing) + 1}` };
        }
        // Mirror Prisma defaults: installedAt = now(), disabledAt = null.
        // The fake otherwise drops these fields when the caller's `create`
        // omits them — and then `row.disabledAt === null` reads
        // `undefined === null` = false, breaking the gate.
        const row: FakeRow = {
          installedByUserId: null,
          installedAt: new Date(),
          disabledAt: null,
          ...args.create,
        };
        rows.push(row);
        return { id: `sk_${rows.length}` };
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; targetId?: string | null } }) => {
        audits.push(data);
      },
    },
  };
  const systemContext = async <T,>(fn: (tx: unknown) => Promise<T>) =>
    fn(fakeTx);
  return { rows, audits, systemContext };
};

const REAL_ESTATE: Vertical = "REAL_ESTATE";
const CPA: Vertical = "CPA";

describe("isSkillInstalledByDefault — default-install rule", () => {
  it("LIVE 'all'-vertical skill: installed by default for every workspace", () => {
    const entry = SKILL_CATALOG.find((s) => s.slug === "office-admin")!;
    assert.equal(isSkillInstalledByDefault(entry, "real-estate"), true);
    assert.equal(isSkillInstalledByDefault(entry, "cpa"), true);
    assert.equal(isSkillInstalledByDefault(entry, null), true);
  });

  it("LIVE per-vertical skill: installed only for the matching vertical", () => {
    const entry = SKILL_CATALOG.find(
      (s) => s.slug === "lead-triage-realestate",
    )!;
    assert.equal(isSkillInstalledByDefault(entry, "real-estate"), true);
    assert.equal(isSkillInstalledByDefault(entry, "cpa"), false);
  });

  // The function itself doesn't gate on runtime — resolveInstallationStatus
  // does. The rule pin here ensures vertical matching stays the only axis.
});

describe("resolveInstallationStatus — composes runtime + row", () => {
  it("LIVE skill, no row, matching vertical → installed=true, customerExplicit=false", async () => {
    const store = buildStore();
    const status = await resolveInstallationStatus({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      systemContext: store.systemContext as never,
    });
    const office = status.find((s) => s.slug === "office-admin");
    assert.ok(office);
    assert.equal(office?.installed, true);
    assert.equal(office?.customerExplicit, false);
    const lead = status.find((s) => s.slug === "lead-triage-realestate");
    assert.equal(lead?.installed, true);
    assert.equal(lead?.customerExplicit, false);
  });

  it("LIVE per-vertical skill on wrong vertical → installed=false (default rule)", async () => {
    const store = buildStore();
    const status = await resolveInstallationStatus({
      workspaceId: "ws_cpa",
      workspaceVertical: CPA,
      systemContext: store.systemContext as never,
    });
    const lead = status.find((s) => s.slug === "lead-triage-realestate");
    assert.equal(lead?.installed, false);
    assert.equal(lead?.customerExplicit, false);
  });

  it("SCHEMA-ONLY skill, no row → installed=false (default rule never installs schema-only)", async () => {
    const store = buildStore();
    const status = await resolveInstallationStatus({
      workspaceId: "ws_re",
      workspaceVertical: REAL_ESTATE,
      systemContext: store.systemContext as never,
    });
    const inv = status.find(
      (s) => s.slug === "invoice-chasing-realestate",
    );
    assert.equal(inv?.runtime, "schema-only");
    assert.equal(inv?.installed, false);
    assert.equal(inv?.customerExplicit, false);
  });

  it("LIVE skill with disabledAt → installed=false, customerExplicit=true", async () => {
    const store = buildStore();
    await uninstallSkill({
      workspaceId: "ws_re",
      skillSlug: "follow-up-chaser-general",
      installedByUserId: "u1",
      systemContext: store.systemContext as never,
    });
    const status = await resolveInstallationStatus({
      workspaceId: "ws_re",
      workspaceVertical: REAL_ESTATE,
      systemContext: store.systemContext as never,
    });
    const followUp = status.find((s) => s.slug === "follow-up-chaser-general");
    assert.equal(followUp?.installed, false);
    assert.equal(followUp?.customerExplicit, true);
  });

  it("SCHEMA-ONLY skill the customer installed → installed=true (gate honest)", async () => {
    const store = buildStore();
    await installSkill({
      workspaceId: "ws_re",
      skillSlug: "invoice-chasing-realestate",
      installedByUserId: "u1",
      systemContext: store.systemContext as never,
    });
    const status = await resolveInstallationStatus({
      workspaceId: "ws_re",
      workspaceVertical: REAL_ESTATE,
      systemContext: store.systemContext as never,
    });
    const inv = status.find((s) => s.slug === "invoice-chasing-realestate");
    assert.equal(inv?.installed, true);
    assert.equal(inv?.customerExplicit, true);
  });
});

describe("installSkill / uninstallSkill — round-trip + audit", () => {
  it("install then uninstall then re-install flips disabledAt correctly", async () => {
    const store = buildStore();
    await installSkill({
      workspaceId: "ws_x",
      skillSlug: "month-end-close-cpa",
      installedByUserId: "u1",
      systemContext: store.systemContext as never,
    });
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].disabledAt, null);

    await uninstallSkill({
      workspaceId: "ws_x",
      skillSlug: "month-end-close-cpa",
      installedByUserId: "u1",
      systemContext: store.systemContext as never,
    });
    assert.equal(store.rows.length, 1, "uninstall must upsert in place");
    assert.ok(store.rows[0].disabledAt, "disabledAt should be set after uninstallSkill");
    assert.ok((store.rows[0].disabledAt as Date) instanceof Date);

    await installSkill({
      workspaceId: "ws_x",
      skillSlug: "month-end-close-cpa",
      installedByUserId: "u2",
      systemContext: store.systemContext as never,
    });
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].disabledAt, null, "re-install clears disabledAt");
    assert.equal(store.rows[0].installedByUserId, "u2");

    const actions = store.audits.map((a) => a.action);
    assert.deepEqual(actions, [
      "skill.installed",
      "skill.uninstalled",
      "skill.installed",
    ]);
  });

  it("throws on unknown skill slug", async () => {
    const store = buildStore();
    await assert.rejects(
      installSkill({
        workspaceId: "ws_x",
        skillSlug: "does-not-exist",
        installedByUserId: null,
        systemContext: store.systemContext as never,
      }),
      /unknown skill/,
    );
  });
});

describe("isSkillInstalledForWorkspace — runtime gate", () => {
  it("LIVE 'all' skill, no row, any vertical → true", async () => {
    const store = buildStore();
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      skillSlug: "office-admin",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, true);
  });

  it("LIVE per-vertical, no row, wrong vertical → false", async () => {
    const store = buildStore();
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: CPA,
      skillSlug: "lead-triage-realestate",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, false);
  });

  it("LIVE skill with disabledAt → false", async () => {
    const store = buildStore();
    await uninstallSkill({
      workspaceId: "ws_x",
      skillSlug: "follow-up-chaser-general",
      installedByUserId: null,
      systemContext: store.systemContext as never,
    });
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      skillSlug: "follow-up-chaser-general",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, false);
  });

  it("unknown slug → false (defensive)", async () => {
    const store = buildStore();
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      skillSlug: "nonexistent-skill",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, false);
  });

  it("SCHEMA-ONLY skill, no row → false (default rule never installs schema-only)", async () => {
    const store = buildStore();
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      skillSlug: "invoice-chasing-realestate",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, false);
  });

  it("SCHEMA-ONLY skill the customer installed → true (gate trusts the customer)", async () => {
    const store = buildStore();
    await installSkill({
      workspaceId: "ws_x",
      skillSlug: "invoice-chasing-realestate",
      installedByUserId: null,
      systemContext: store.systemContext as never,
    });
    const ok = await isSkillInstalledForWorkspace({
      workspaceId: "ws_x",
      workspaceVertical: REAL_ESTATE,
      skillSlug: "invoice-chasing-realestate",
      systemContext: store.systemContext as never,
    });
    assert.equal(ok, true);
  });
});

describe("runtime catalog — LIVE / schema-only distribution matches the audit", () => {
  it("LIVE skills match the post-wave-3 catalog", () => {
    const live = SKILL_CATALOG.filter((s) => s.runtime === "live").map(
      (s) => s.slug,
    );
    // Six pre-wave-3 horizontals + wave-1 vertical lead-triage-realestate
    // + the four wave-3 discipline-wrap skills (analytics / research /
    // marketing / legal). Each is registered as `live` because there is
    // a production caller wired today — see lib/inngest/functions/* for
    // analytics-pulse, content-calendar, compliance-watch crons + the
    // instruction-handler dispatch for research-on-demand.
    assert.deepEqual(
      live.sort(),
      [
        "analytics-weekly-pulse-general",
        "chief-of-staff-scheduler",
        "compliance-watch-general",
        "content-calendar-drafter-general",
        "follow-up-chaser-general",
        "inbox-triage-general",
        "lead-triage-realestate",
        "office-admin",
        "process-doc-drafter-general",
        "research-on-demand-general",
        "support-handler",
      ].sort(),
    );
  });

  it("remaining 10 vertical skills are SCHEMA-ONLY", () => {
    const schemaOnly = SKILL_CATALOG.filter(
      (s) => (s.runtime ?? "schema-only") === "schema-only",
    ).map((s) => s.slug);
    assert.equal(schemaOnly.length, 10, "10 schema-only vertical skills");
    for (const slug of schemaOnly) {
      assert.notEqual(slug, "lead-triage-realestate");
      assert.notEqual(slug, "office-admin");
    }
  });
});
