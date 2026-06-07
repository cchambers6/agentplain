// Wave-2 per-skill config — reader/writer + per-skill defaults.
//
// Covers:
//   1. writeSkillConfig encrypts the JSON body (v1 envelope), upserts
//      the row, writes an audit log entry.
//   2. The per-skill readers apply defaults on missing/malformed
//      configs, clamp out-of-range numbers, fall back to safe sentinels
//      for invalid enum values.
//   3. End-to-end round-trip — write the config, read it back, every
//      field round-trips. Confirms encryption + JSON.parse compose.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CHIEF_OF_STAFF_SLUG,
  DEFAULT_CHIEF_OF_STAFF_CONFIG,
  DEFAULT_FOLLOW_UP_CHASER_CONFIG,
  DEFAULT_INBOX_TRIAGE_CONFIG,
  FOLLOW_UP_CHASER_SLUG,
  INBOX_TRIAGE_SLUG,
  readChiefOfStaffConfig,
  readFollowUpChaserConfig,
  readInboxTriageConfig,
  SKILL_CONFIG_LIVE_KEYS,
  writeSkillConfig,
} from "@/lib/skills/config";
import { decrypt, isEncrypted } from "@/lib/security/encryption";

// Encryption requires a master key. Pin a deterministic one for tests.
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY =
    "1111111111111111111111111111111111111111111111111111111111111111";
}

interface FakeRow {
  workspaceId: string;
  skillSlug: string;
  configJson: string;
  configuredByUserId: string | null;
}

const buildStore = () => {
  const rows: FakeRow[] = [];
  const audits: Array<{ action: string; targetId?: string | null }> = [];
  const fakeTx = {
    skillConfig: {
      findUnique: async (args: {
        where: {
          workspaceId_skillSlug: { workspaceId: string; skillSlug: string };
        };
        select?: unknown;
      }) => {
        const found = rows.find(
          (r) =>
            r.workspaceId === args.where.workspaceId_skillSlug.workspaceId &&
            r.skillSlug === args.where.workspaceId_skillSlug.skillSlug,
        );
        return found ?? null;
      },
      upsert: async (args: {
        where: {
          workspaceId_skillSlug: { workspaceId: string; skillSlug: string };
        };
        create: FakeRow;
        update: Partial<FakeRow>;
      }) => {
        const existing = rows.find(
          (r) =>
            r.workspaceId === args.where.workspaceId_skillSlug.workspaceId &&
            r.skillSlug === args.where.workspaceId_skillSlug.skillSlug,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return { id: `sc_${rows.indexOf(existing) + 1}` };
        }
        rows.push(args.create);
        return { id: `sc_${rows.length}` };
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

describe("writeSkillConfig — encrypts JSON, upserts row, audits", () => {
  it("creates the row with an encrypted body + audit row", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: FOLLOW_UP_CHASER_SLUG,
      config: { staleAfterDays: 7, maxNudgesPerRun: 3, nudgeTone: "warm" },
      configuredByUserId: "u1",
      systemContext: store.systemContext as never,
    });
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].workspaceId, "ws_x");
    assert.equal(store.rows[0].skillSlug, FOLLOW_UP_CHASER_SLUG);
    assert.ok(
      isEncrypted(store.rows[0].configJson),
      "configJson must be v1-envelope encrypted at rest",
    );
    const plaintext = JSON.parse(decrypt(store.rows[0].configJson));
    assert.equal(plaintext.staleAfterDays, 7);
    assert.equal(plaintext.maxNudgesPerRun, 3);
    assert.equal(plaintext.nudgeTone, "warm");
    assert.equal(store.audits.length, 1);
    assert.equal(store.audits[0].action, "skill_config.saved");
  });

  it("upserts on second write — single row, latest payload wins", async () => {
    const store = buildStore();
    const ctx = store.systemContext;
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: FOLLOW_UP_CHASER_SLUG,
      config: { staleAfterDays: 7, maxNudgesPerRun: 3, nudgeTone: "warm" },
      configuredByUserId: "u1",
      systemContext: ctx as never,
    });
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: FOLLOW_UP_CHASER_SLUG,
      config: { staleAfterDays: 14, maxNudgesPerRun: 7, nudgeTone: "firm" },
      configuredByUserId: "u1",
      systemContext: ctx as never,
    });
    assert.equal(store.rows.length, 1);
    const plaintext = JSON.parse(decrypt(store.rows[0].configJson));
    assert.equal(plaintext.staleAfterDays, 14);
  });
});

describe("readFollowUpChaserConfig — defaults + round-trip + clamping", () => {
  it("returns defaults when no row exists", async () => {
    const store = buildStore();
    const c = await readFollowUpChaserConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    assert.deepEqual(c, DEFAULT_FOLLOW_UP_CHASER_CONFIG);
  });

  it("round-trips written config exactly", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: FOLLOW_UP_CHASER_SLUG,
      config: { staleAfterDays: 14, maxNudgesPerRun: 8, nudgeTone: "firm" },
      configuredByUserId: null,
      systemContext: store.systemContext as never,
    });
    const c = await readFollowUpChaserConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    assert.equal(c.staleAfterDays, 14);
    assert.equal(c.maxNudgesPerRun, 8);
    assert.equal(c.nudgeTone, "firm");
  });

  it("clamps out-of-range numbers + invalid enum values", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: FOLLOW_UP_CHASER_SLUG,
      // out of range + invalid enum
      config: { staleAfterDays: 9999, maxNudgesPerRun: -1, nudgeTone: "snarky" },
      configuredByUserId: null,
      systemContext: store.systemContext as never,
    });
    const c = await readFollowUpChaserConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    // Out-of-range falls back to the typed default; invalid enum same.
    assert.equal(c.staleAfterDays, DEFAULT_FOLLOW_UP_CHASER_CONFIG.staleAfterDays);
    assert.equal(c.maxNudgesPerRun, DEFAULT_FOLLOW_UP_CHASER_CONFIG.maxNudgesPerRun);
    assert.equal(c.nudgeTone, DEFAULT_FOLLOW_UP_CHASER_CONFIG.nudgeTone);
  });
});

describe("readInboxTriageConfig — list normalization", () => {
  it("trims + dedups + drops non-string entries from priorityKeywords", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: INBOX_TRIAGE_SLUG,
      config: {
        priorityKeywords: ["  closing today  ", "", "wire failed", 42, null],
        flagFromSenders: [],
        autoArchiveSenders: [],
      },
      configuredByUserId: null,
      systemContext: store.systemContext as never,
    });
    const c = await readInboxTriageConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    assert.deepEqual(c.priorityKeywords, ["closing today", "wire failed"]);
  });

  it("non-array fields fall back to empty lists", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: INBOX_TRIAGE_SLUG,
      // Malformed shape
      config: { priorityKeywords: "not an array" },
      configuredByUserId: null,
      systemContext: store.systemContext as never,
    });
    const c = await readInboxTriageConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    assert.deepEqual(c, DEFAULT_INBOX_TRIAGE_CONFIG);
  });
});

describe("readChiefOfStaffConfig — business hours guard", () => {
  it("falls back when end <= start (corrupted config)", async () => {
    const store = buildStore();
    await writeSkillConfig({
      workspaceId: "ws_x",
      skillSlug: CHIEF_OF_STAFF_SLUG,
      config: {
        defaultMeetingMinutes: 45,
        businessHoursStart: 18,
        businessHoursEnd: 9, // earlier than start — invalid
        bufferMinutes: 10,
      },
      configuredByUserId: null,
      systemContext: store.systemContext as never,
    });
    const c = await readChiefOfStaffConfig("ws_x", {
      systemContext: store.systemContext as never,
    });
    assert.equal(c.businessHoursStart, 18);
    // End falls back to the default rather than accept end <= start.
    assert.equal(c.businessHoursEnd, DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursEnd);
    assert.equal(c.defaultMeetingMinutes, 45);
  });
});

describe("SKILL_CONFIG_LIVE_KEYS — honesty registry matches the runtime wiring", () => {
  it("declares which fields the running skill honors today", () => {
    // Pin the surface so a refactor that drops a runtime reader trips
    // this test. When you wire a new field, add it here AND to the
    // skill's runtime caller — the UI badge follows automatically.
    assert.deepEqual(SKILL_CONFIG_LIVE_KEYS[FOLLOW_UP_CHASER_SLUG], [
      "staleAfterDays",
      "maxNudgesPerRun",
      "nudgeTone",
    ]);
    assert.deepEqual(SKILL_CONFIG_LIVE_KEYS[INBOX_TRIAGE_SLUG], [
      "priorityKeywords",
      "flagFromSenders",
      "autoArchiveSenders",
    ]);
    assert.deepEqual(SKILL_CONFIG_LIVE_KEYS[CHIEF_OF_STAFF_SLUG], [
      "defaultMeetingMinutes",
      "businessHoursStart",
      "businessHoursEnd",
      "bufferMinutes",
    ]);
  });
});
