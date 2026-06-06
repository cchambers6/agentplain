// Wave-2 per-skill config — readers + writers.
//
// One row per workspace × skillSlug in `SkillConfig`. The
// configJson column is encrypted with the v1 envelope because the
// customer will inevitably surface PII (sender allowlists, paralegal
// emails). Each typed config interface has a `default*` constant; the
// reader applies defaults on missing/malformed keys so older shapes
// forward-compat cleanly.
//
// Per `feedback_runner_portability.md`: every reader takes an optional
// systemContext runner so the unit tests don't need Postgres.
//
// Per `feedback_no_silent_vendor_lock`: encryption goes through
// `lib/security/encryption`; this file never touches the SDK.
//
// Per `feedback_cold_start_safe_agents.md`: callers (cron sweeps)
// re-read on every fire. No in-memory cache.

import type { Prisma } from "@prisma/client";
import type { DbTransactionClient } from "@/lib/db";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/security/encryption";

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

// ── Per-skill typed configs ───────────────────────────────────────────

export interface FollowUpChaserConfig {
  /** Days a thread must be stale before the chaser nudges. The skill's
   *  default in `lib/skills/follow-up-chaser-general` is 4; the customer
   *  may raise to 7+ for relationships that mature slower (escrow,
   *  enterprise sales) or drop to 2 for time-sensitive operations. */
  staleAfterDays: number;
  /** Hard cap on nudges per workspace per run. Higher = more drafts in
   *  /approvals each hour. Default 5. */
  maxNudgesPerRun: number;
  /** The voice of the nudge body. `professional` (default) keeps the
   *  original wording; `warm` softens it; `firm` makes the ask direct.
   *  Live — `lib/skills/follow-up-chaser-general/skill.ts` selects the
   *  nudge line by tone on every fire. */
  nudgeTone: "professional" | "warm" | "firm";
}

export const DEFAULT_FOLLOW_UP_CHASER_CONFIG: FollowUpChaserConfig = {
  staleAfterDays: 4,
  maxNudgesPerRun: 5,
  nudgeTone: "professional",
};

export interface InboxTriageConfig {
  /** Extra keywords that force a message to urgent / needs-decision.
   *  The skill merges these into its URGENT_CUES list on every fire so
   *  the customer's own escalation vocabulary becomes load-bearing. */
  priorityKeywords: string[];
  /** Sender allowlist. A message from one of these senders is forced to
   *  `urgent` so it tops the queue regardless of body cues. Live — the
   *  classifier in `inbox-triage-general/skill.ts` matches on every
   *  fire (exact address, `@domain.com`, or bare `domain.com`). */
  flagFromSenders: string[];
  /** Sender denylist. A message from one of these senders is demoted to
   *  `noise` (no auto-ack). Live — same classifier. The allowlist wins
   *  if a sender appears on both. */
  autoArchiveSenders: string[];
}

export const DEFAULT_INBOX_TRIAGE_CONFIG: InboxTriageConfig = {
  priorityKeywords: [],
  flagFromSenders: [],
  autoArchiveSenders: [],
};

export interface ChiefOfStaffConfig {
  /** Default meeting length the scheduler proposes (minutes). The
   *  skill's default is 30. */
  defaultMeetingMinutes: number;
  /** Business-hours window in 24h clock. Default 9:00 → 17:00. The
   *  scheduler refuses to propose slots outside this window. */
  businessHoursStart: number;
  businessHoursEnd: number;
  /** Minutes of breathing room kept on each side of a busy event when
   *  the scheduler searches for open slots. Live — `findOpenSlots` in
   *  `chief-of-staff-scheduler/skill.ts` pads every busy interval by
   *  this many minutes before proposing a slot. Default 15. */
  bufferMinutes: number;
}

export const DEFAULT_CHIEF_OF_STAFF_CONFIG: ChiefOfStaffConfig = {
  defaultMeetingMinutes: 30,
  businessHoursStart: 9,
  businessHoursEnd: 17,
  bufferMinutes: 15,
};

// ── Skill slugs the config supports ───────────────────────────────────

export const FOLLOW_UP_CHASER_SLUG = "follow-up-chaser-general" as const;
export const INBOX_TRIAGE_SLUG = "inbox-triage-general" as const;
export const CHIEF_OF_STAFF_SLUG = "chief-of-staff-scheduler" as const;

/** Per-skill "live-config" surface — which keys the running skill
 *  honors today. Used by the settings UI to badge fields as
 *  "live"/"saved-only" without lying. */
export const SKILL_CONFIG_LIVE_KEYS: Record<string, ReadonlyArray<string>> = {
  [FOLLOW_UP_CHASER_SLUG]: ["staleAfterDays", "maxNudgesPerRun", "nudgeTone"],
  [INBOX_TRIAGE_SLUG]: [
    "priorityKeywords",
    "flagFromSenders",
    "autoArchiveSenders",
  ],
  [CHIEF_OF_STAFF_SLUG]: [
    "defaultMeetingMinutes",
    "businessHoursStart",
    "businessHoursEnd",
    "bufferMinutes",
  ],
};

// ── Generic reader/writer ─────────────────────────────────────────────

export interface ReadSkillConfigOpts {
  systemContext?: SystemContextRunner;
}

async function readRawConfig(
  workspaceId: string,
  skillSlug: string,
  opts: ReadSkillConfigOpts = {},
): Promise<Record<string, unknown> | null> {
  const ctx = opts.systemContext ?? defaultWithSystemContext;
  const row = await ctx((tx) =>
    tx.skillConfig.findUnique({
      where: {
        workspaceId_skillSlug: { workspaceId, skillSlug },
      },
      select: { configJson: true },
    }),
  );
  if (!row) return null;
  try {
    const plaintext = decrypt(row.configJson);
    const parsed = JSON.parse(plaintext) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    // A malformed config must not crash the skill fire. Surface in logs
    // for ops triage and return null so the caller applies defaults.
    console.warn(
      `readSkillConfig(${workspaceId}, ${skillSlug}): could not decode — ${
        err instanceof Error ? err.message : String(err)
      }. Applying defaults.`,
    );
    return null;
  }
}

export interface WriteSkillConfigInput {
  workspaceId: string;
  skillSlug: string;
  config: Record<string, unknown>;
  configuredByUserId: string | null;
  systemContext?: SystemContextRunner;
}

/**
 * Persists a skill config row, encrypting the JSON body with the v1
 * envelope. Idempotent: upsert on `(workspaceId, skillSlug)`.
 */
export async function writeSkillConfig(
  input: WriteSkillConfigInput,
): Promise<{ ok: true; id: string }> {
  const ctx = input.systemContext ?? defaultWithSystemContext;
  const ciphertext = encrypt(JSON.stringify(input.config));
  const row = await ctx(async (tx) => {
    const persisted = await tx.skillConfig.upsert({
      where: {
        workspaceId_skillSlug: {
          workspaceId: input.workspaceId,
          skillSlug: input.skillSlug,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        skillSlug: input.skillSlug,
        configJson: ciphertext,
        configuredByUserId: input.configuredByUserId,
      },
      update: {
        configJson: ciphertext,
        configuredByUserId: input.configuredByUserId,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.configuredByUserId,
        action: "skill_config.saved",
        targetTable: "SkillConfig",
        targetId: persisted.id,
        payload: {
          skillSlug: input.skillSlug,
        } satisfies Prisma.InputJsonValue,
      },
    });
    return persisted;
  });
  return { ok: true, id: row.id };
}

// ── Per-skill typed readers (apply defaults) ──────────────────────────

export async function readFollowUpChaserConfig(
  workspaceId: string,
  opts: ReadSkillConfigOpts = {},
): Promise<FollowUpChaserConfig> {
  const raw = await readRawConfig(workspaceId, FOLLOW_UP_CHASER_SLUG, opts);
  if (!raw) return { ...DEFAULT_FOLLOW_UP_CHASER_CONFIG };
  return {
    staleAfterDays: positiveIntOrDefault(
      raw.staleAfterDays,
      DEFAULT_FOLLOW_UP_CHASER_CONFIG.staleAfterDays,
      1,
      90,
    ),
    maxNudgesPerRun: positiveIntOrDefault(
      raw.maxNudgesPerRun,
      DEFAULT_FOLLOW_UP_CHASER_CONFIG.maxNudgesPerRun,
      1,
      100,
    ),
    nudgeTone: oneOfOrDefault(
      raw.nudgeTone,
      ["professional", "warm", "firm"] as const,
      DEFAULT_FOLLOW_UP_CHASER_CONFIG.nudgeTone,
    ),
  };
}

export async function readInboxTriageConfig(
  workspaceId: string,
  opts: ReadSkillConfigOpts = {},
): Promise<InboxTriageConfig> {
  const raw = await readRawConfig(workspaceId, INBOX_TRIAGE_SLUG, opts);
  if (!raw) return { ...DEFAULT_INBOX_TRIAGE_CONFIG };
  return {
    priorityKeywords: stringListOrDefault(
      raw.priorityKeywords,
      DEFAULT_INBOX_TRIAGE_CONFIG.priorityKeywords,
    ),
    flagFromSenders: stringListOrDefault(
      raw.flagFromSenders,
      DEFAULT_INBOX_TRIAGE_CONFIG.flagFromSenders,
    ),
    autoArchiveSenders: stringListOrDefault(
      raw.autoArchiveSenders,
      DEFAULT_INBOX_TRIAGE_CONFIG.autoArchiveSenders,
    ),
  };
}

export async function readChiefOfStaffConfig(
  workspaceId: string,
  opts: ReadSkillConfigOpts = {},
): Promise<ChiefOfStaffConfig> {
  const raw = await readRawConfig(workspaceId, CHIEF_OF_STAFF_SLUG, opts);
  if (!raw) return { ...DEFAULT_CHIEF_OF_STAFF_CONFIG };
  const start = positiveIntOrDefault(
    raw.businessHoursStart,
    DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursStart,
    0,
    23,
  );
  const endRaw = positiveIntOrDefault(
    raw.businessHoursEnd,
    DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursEnd,
    1,
    24,
  );
  // Defense: end must be > start; fall back to default end if not.
  const end = endRaw > start ? endRaw : DEFAULT_CHIEF_OF_STAFF_CONFIG.businessHoursEnd;
  return {
    defaultMeetingMinutes: positiveIntOrDefault(
      raw.defaultMeetingMinutes,
      DEFAULT_CHIEF_OF_STAFF_CONFIG.defaultMeetingMinutes,
      5,
      240,
    ),
    businessHoursStart: start,
    businessHoursEnd: end,
    bufferMinutes: positiveIntOrDefault(
      raw.bufferMinutes,
      DEFAULT_CHIEF_OF_STAFF_CONFIG.bufferMinutes,
      0,
      120,
    ),
  };
}

// ── Parse helpers ─────────────────────────────────────────────────────

function positiveIntOrDefault(
  v: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const i = Math.round(v);
  if (i < min || i > max) return fallback;
  return i;
}

function oneOfOrDefault<T extends readonly string[]>(
  v: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof v !== "string") return fallback;
  return (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

function stringListOrDefault(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v
    .filter((s) => typeof s === "string")
    .map((s) => (s as string).trim())
    .filter((s) => s.length > 0)
    .slice(0, 100);
}
