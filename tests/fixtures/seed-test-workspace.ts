/**
 * tests/fixtures/seed-test-workspace.ts
 *
 * THIS FILE HAS TWO INDEPENDENT CONCERNS:
 *
 *   A. The marketplace MCP smoke-suite seed (original — lines below).
 *   B. The seeded-login E2E harness seed (appended at the bottom under the
 *      "SEEDED-LOGIN E2E HARNESS" banner). The harness builds + applies a
 *      clearly-marked TEST workspace (slug prefix `e2e-test-`) with an
 *      owner, completed onboarding, integration credentials, a briefing,
 *      and staged approval-queue rows so every auth-gated product surface
 *      renders NON-EMPTY for end-to-end verification. See
 *      `tests/e2e/smoke-authenticated.ts` for the runnable harness.
 *
 * They share this file because both describe "the designated test
 * workspace"; they do not share state. The two `TEST_WORKSPACE_ID`
 * constants are distinct (the smoke suite's is a fixed UUID consumed by the
 * in-memory MCP servers; the harness derives its workspace id from a seed
 * key — see `buildSeedPlan`).
 *
 * ── Concern A: marketplace MCP smoke suite ──────────────────────────────────
 *
 * Designated test-workspace seed for the marketplace MCP smoke suite
 * (`lib/integrations/__tests__/marketplace-smoke.test.ts`), Stream B.1.1.
 *
 * Two distinct things live here, kept apart on purpose:
 *
 *   1. A stable workspace id + fixture seeds that the *test-impl* MCP
 *      servers consume. These need NO database and NO network — the
 *      `Test*McpServer` classes are pure in-memory (verified in each
 *      connector's `test-server.ts`). This is what makes the smoke suite
 *      run green in CI without provisioning anything.
 *
 *   2. `hasProvisionedCredential()` — the gate for the *prod-impl* path.
 *      Per `feedback_integration_acceptance_is_functional.md`, the real
 *      bar is the value loop running against a connected workspace's
 *      stored credential. We do NOT fake that: if no IntegrationCredential
 *      row exists (or there is no reachable database at all), the prod
 *      real-data test SKIPS with a clear message instead of passing on a
 *      fixture and pretending it proved the loop.
 *
 * Honesty note (see the wave-1 PR description): provisioning a real
 * encrypted IntegrationCredential row for CI is a *follow-up*. It needs a
 * test database + the ENCRYPTION_KEY rail + a verified User/Workspace
 * seed against the live Prisma schema — none of which this environment
 * has. Rather than write a seeder against schema fields we have not
 * verified (which would violate `feedback_no_guesses_no_estimates.md`),
 * we expose the probe and leave the DB seeder as an explicit TODO.
 */

import type { MarketplaceProviderKey } from '@/lib/integrations/marketplace';

/**
 * Stable workspace id used across the smoke suite. Standard UUID v4 shape
 * so it passes the `UUID_RE` the MCP route handlers enforce, in case a
 * future test drives the HTTP route instead of the in-process client.
 */
export const TEST_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/** A second workspace id, used to assert cross-workspace scoping rejects. */
export const OTHER_WORKSPACE_ID = '00000000-0000-4000-8000-0000000000ff';

/**
 * Does a real, provisioned IntegrationCredential row exist for this
 * provider in the test workspace?
 *
 * Returns `false` — never throws — when:
 *   - there is no reachable database (no DATABASE_URL in this env),
 *   - the Prisma client cannot be loaded,
 *   - or no matching row exists.
 *
 * The smoke suite treats `false` as "skip the prod real-data leg" rather
 * than a failure. The Prisma client is imported lazily so that merely
 * loading this fixture never drags in database/env validation at module
 * load time (the suite must import cleanly with no env configured).
 */
export async function hasProvisionedCredential(
  providerKey: MarketplaceProviderKey,
  workspaceId: string = TEST_WORKSPACE_ID,
): Promise<boolean> {
  if (!providerKey) return false;
  if (!process.env.DATABASE_URL) return false;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const row = await prisma.integrationCredential.findFirst({
        where: { workspaceId, provider: providerKey, status: 'ACTIVE' },
        select: { id: true },
      });
      return row != null;
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch {
    // No DB, no client, or query failed — the honest answer for a smoke
    // gate is "not provisioned", which routes the caller to SKIP.
    return false;
  }
}

// ── Test-impl fixture seeds ────────────────────────────────────────────────
//
// Each connector's `Test*McpServer` ships sensible default fixtures, so the
// smoke suite mostly relies on those. We export a couple of explicit seeds
// where the suite needs a *known* id to round-trip (Excel needs a workbook
// id; the default workbook id is internal to the test server).

/**
 * A known Excel workbook the smoke test reads against. Shapes match
 * `TestExcelSeed` (verified in `excel-mcp/test-server.ts`).
 */
export const EXCEL_TEST_WORKBOOK_ID = 'wb-smoke-001';

export function excelSmokeSeed() {
  return {
    workbooks: [
      {
        id: EXCEL_TEST_WORKBOOK_ID,
        sheets: [
          {
            id: 'sheet-pnl',
            name: 'P&L',
            cells: [
              ['Month', 'Revenue', 'Cost'],
              ['Apr', 12000, 4000],
              ['May', 14500, 4200],
            ] as Array<Array<string | number | boolean | null>>,
          },
        ],
      },
    ],
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  SEEDED-LOGIN E2E HARNESS (Concern B)
// ════════════════════════════════════════════════════════════════════════════
//
// WHY THIS EXISTS
// ---------------
// Every product surface (approvals queue, onboarding wizard, briefings,
// workspace home) is auth-gated behind an iron-session membership check. That
// makes preview/Playwright verification impossible from the outside: a fresh
// preview has no signed-in user, no workspace, and no rows, so the surfaces
// all render their empty states. Tests go green without anyone ever SEEING the
// real surface populated.
//
// This section seeds a clearly-marked TEST workspace (slug prefix
// `e2e-test-`) with an owner user, an active BROKER_OWNER membership, completed
// onboarding, a couple of provisioned IntegrationCredential rows, a briefing,
// and 2–3 staged WorkApprovalQueueItem rows of kinds that exist on `main`
// (FOLLOW_UP_NUDGE, LEAD_TRIAGE, SUPPORT_HANDLER_REPLY_DRAFT) — enough to render
// approvals / onboarding / briefings / home NON-EMPTY. `mint-session.ts` then
// mints a session for the owner and `tests/e2e/smoke-authenticated.ts` walks
// the auth-gated routes with that session, asserting the seeded markers appear.
//
// DESIGN
// ------
// Two layers, kept apart so the logic is testable offline (there is NO
// DATABASE_URL in local/CI — that's why `build:no-migrate` exists):
//
//   1. Pure BUILDERS (`buildSeedPlan`) — deterministic, no DB, no env. Given a
//      seed key they produce the exact row shapes (ids, slug, payloads) the
//      seed will write. Unit-tested with NO database. Idempotency is
//      structural: every id is derived deterministically from the seed key
//      (a UUIDv5 namespaced hash), so a re-run targets the SAME rows.
//
//   2. The DB layer (`seedTestWorkspace` / `teardownTestWorkspace`) takes an
//      INJECTABLE prisma-like client (defaults to the repo singleton) and
//      applies the plan through upserts + the repo's payload-crypto helpers.
//      The injectable client is what lets the offline tests exercise the apply
//      logic against an in-memory fake with zero database.
//
// GUARD (refuse to run against production)
// ----------------------------------------
// `seedTestWorkspace` REFUSES unless BOTH hold:
//   - `ALLOW_E2E_SEED=yes` (explicit operator opt-in), AND
//   - the target DB does not look like production: NOT carrying the
//     `E2E_SEED_FORBID=1` brake, and its existing non-test workspace count is
//     at or below `E2E_SEED_MAX_EXISTING_WORKSPACES` (default 50).
// The threshold stops a fat-fingered prod DATABASE_URL: a real production DB
// has many real workspaces; a dev/preview DB has few. See `evaluateSeedGuard`.
//
// No secrets are committed. The encryption key + session secret come from env
// at run time; this file only references their names.

import { createHash } from 'node:crypto';
import { encryptPayloadForWrite } from '@/lib/security/payload-crypto';
import { encrypt } from '@/lib/security/encryption';

/** Slug prefix that marks a workspace as harness-owned. Teardown + the
 *  production guard both key off this prefix so a real customer workspace is
 *  never touched. */
export const E2E_SLUG_PREFIX = 'e2e-test-';

/** Default seed key. Override per-run with the `key` option so several
 *  isolated test workspaces can coexist (e.g. one per preview). */
export const DEFAULT_SEED_KEY = 'default';

/** Default ceiling on pre-existing non-test workspaces before the guard
 *  treats the target as production-like and refuses. */
export const DEFAULT_MAX_EXISTING_WORKSPACES = 50;

// ── Deterministic id derivation ─────────────────────────────────────────────
//
// Every row id is a UUIDv5 (namespaced SHA-1) of `${seedKey}:${slot}`. Same
// inputs → same UUID, so re-running the seed targets the SAME rows — `upsert`
// makes the write a no-op on re-run. Structural idempotency, no find-or-create
// race.

// Fixed namespace UUID for the harness (frozen so ids are stable across
// machines). Not a secret — it only namespaces derived ids.
const HARNESS_NAMESPACE = '6f4d2a10-1c3b-4e57-9a8d-7b2e5c0f1a93';

/** RFC-4122 v5 UUID (SHA-1, name-based) of `name` under the harness
 *  namespace. Deterministic and collision-resistant for our slot strings. */
export function deterministicUuid(name: string): string {
  const nsBytes = Buffer.from(HARNESS_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(nsBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── Seed plan shape (pure data — no DB, no env) ──────────────────────────────

export interface SeedUserRow {
  id: string;
  email: string;
  name: string;
  isOperator: boolean;
}

export interface SeedWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  vertical: 'REAL_ESTATE';
  verticalTier: 'REGULAR';
}

export interface SeedMembershipRow {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'BROKER_OWNER';
  status: 'ACTIVE';
}

export interface SeedOnboardingRow {
  id: string;
  workspaceId: string;
  currentStep: 'done';
  completedSteps: string[];
  completedAt: Date;
}

export interface SeedPreferenceRow {
  id: string;
  workspaceId: string;
  draftingTone: string;
  categorizationNotes: string;
  calendarWindow: string;
}

export interface SeedCredentialRow {
  id: string;
  workspaceId: string;
  provider: 'GOOGLE' | 'FOLLOW_UP_BOSS';
  accountId: string;
  accountEmail: string;
  /** Plaintext token to be encrypted at apply time (never persisted raw). */
  accessTokenPlaintext: string;
  scopes: string[];
  expiresAt: Date;
}

export interface SeedApprovalRow {
  id: string;
  workspaceId: string;
  agentSlug: string;
  kind: 'FOLLOW_UP_NUDGE' | 'LEAD_TRIAGE' | 'SUPPORT_HANDLER_REPLY_DRAFT';
  refTable: string;
  refId: string;
  discipline: string | null;
  status: 'PENDING';
  /** Marker string the smoke test greps for in the rendered surface. */
  marker: string;
  /** Cleartext payload — encrypted at apply time via the repo helper. */
  payload: Record<string, unknown>;
}

export interface SeedBriefingRow {
  id: string;
  workspaceId: string;
  forDate: string;
  /** Cleartext body — encrypted at apply time. */
  bodyPlaintext: string;
  marker: string;
  status: 'READY';
}

export interface SeedPlan {
  seedKey: string;
  user: SeedUserRow;
  workspace: SeedWorkspaceRow;
  membership: SeedMembershipRow;
  onboarding: SeedOnboardingRow;
  preference: SeedPreferenceRow;
  credentials: SeedCredentialRow[];
  approvals: SeedApprovalRow[];
  briefing: SeedBriefingRow;
  /** Every marker string the smoke harness can assert against, by surface. */
  markers: {
    workspaceName: string;
    ownerEmail: string;
    approvals: string[];
    briefing: string;
  };
}

export interface BuildSeedPlanOptions {
  /** Isolation key — distinct keys yield distinct, non-colliding seeds. */
  key?: string;
  /** Override the briefing date (default: a fixed recent UTC date so the
   *  briefing renders deterministically). */
  forDate?: string;
}

/**
 * Build the full seed plan for a key. Pure + deterministic — no DB, no env.
 * Re-calling with the same key returns structurally identical ids/markers,
 * which is what makes `seedTestWorkspace` idempotent.
 */
export function buildSeedPlan(options: BuildSeedPlanOptions = {}): SeedPlan {
  const seedKey = options.key ?? DEFAULT_SEED_KEY;
  const ns = (slot: string) => deterministicUuid(`${seedKey}:${slot}`);

  const workspaceId = ns('workspace');
  const userId = ns('user');
  const slug = `${E2E_SLUG_PREFIX}${seedKey}`;
  const ownerEmail = `e2e-owner+${seedKey}@agentplain-e2e.test`;
  const workspaceName = `E2E Harness Brokerage (${seedKey})`;
  const forDate = options.forDate ?? '2026-06-09';

  const user: SeedUserRow = {
    id: userId,
    email: ownerEmail,
    name: 'E2E Owner',
    isOperator: false,
  };

  const workspace: SeedWorkspaceRow = {
    id: workspaceId,
    name: workspaceName,
    slug,
    vertical: 'REAL_ESTATE',
    verticalTier: 'REGULAR',
  };

  const membership: SeedMembershipRow = {
    id: ns('membership'),
    userId,
    workspaceId,
    role: 'BROKER_OWNER',
    status: 'ACTIVE',
  };

  const onboarding: SeedOnboardingRow = {
    id: ns('onboarding'),
    workspaceId,
    currentStep: 'done',
    completedSteps: [
      'confirm_details',
      'connect_integration',
      'pick_skills',
      'set_preferences',
      'first_fire_watch',
    ],
    completedAt: new Date(`${forDate}T12:00:00.000Z`),
  };

  const preference: SeedPreferenceRow = {
    id: ns('preference'),
    workspaceId,
    draftingTone: 'warm-professional',
    categorizationNotes:
      "Treat any message referencing 'pre-approved' as a hot buyer.",
    calendarWindow: '9-5 weekdays',
  };

  const credentials: SeedCredentialRow[] = [
    {
      id: ns('cred-google'),
      workspaceId,
      provider: 'GOOGLE',
      accountId: `e2e-google-${seedKey}`,
      accountEmail: `e2e-inbox+${seedKey}@agentplain-e2e.test`,
      accessTokenPlaintext: 'E2E_FAKE_GOOGLE_ACCESS_TOKEN',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      expiresAt: new Date(`${forDate}T23:59:59.000Z`),
    },
    {
      id: ns('cred-fub'),
      workspaceId,
      provider: 'FOLLOW_UP_BOSS',
      accountId: `e2e-fub-${seedKey}`,
      accountEmail: `e2e-crm+${seedKey}@agentplain-e2e.test`,
      accessTokenPlaintext: 'E2E_FAKE_FUB_API_KEY',
      scopes: [],
      // FUB is an API-key provider — far-future sentinel expiry.
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    },
  ];

  // Three approvals across distinct kinds + disciplines so the approvals
  // surface renders multiple cards. The `marker` is a unique string the
  // renderer surfaces (it pulls `body`/`subject`/`leadName` out of the
  // payload) so the smoke test can grep the rendered HTML / JSON for proof
  // the row is present.
  const followUpMarker = `E2E-FOLLOWUP-${seedKey}`;
  const leadMarker = `E2E-LEAD-${seedKey}`;
  const supportMarker = `E2E-SUPPORT-${seedKey}`;

  const approvals: SeedApprovalRow[] = [
    {
      id: ns('approval-followup'),
      workspaceId,
      agentSlug: 'follow-up-chaser-general',
      kind: 'FOLLOW_UP_NUDGE',
      refTable: 'e2e_seed',
      refId: ns('approval-followup-ref'),
      discipline: 'customer',
      status: 'PENDING',
      marker: followUpMarker,
      payload: {
        subject: `Following up — ${followUpMarker}`,
        body: `Hi there — just circling back on your inquiry. ${followUpMarker}`,
        toEmails: [`buyer+${seedKey}@agentplain-e2e.test`],
        confidence: 0.82,
        stage: 'first',
        ageDays: 4,
        reasoning: 'No reply 4 days after the initial send.',
      },
    },
    {
      id: ns('approval-lead'),
      workspaceId,
      agentSlug: 'lead-triage-realestate',
      kind: 'LEAD_TRIAGE',
      refTable: 'e2e_seed',
      refId: ns('approval-lead-ref'),
      discipline: 'customer',
      status: 'PENDING',
      marker: leadMarker,
      payload: {
        leadName: leadMarker,
        category: 'hot',
        scores: { motivation: 0.9, timeline: 0.8, preapproval: 0.7 },
        routing: {
          type: 'specific-agent',
          rationale: 'Pre-approved buyer, 30-day timeline.',
        },
        firstTouchDraft: {
          subject: `Welcome — ${leadMarker}`,
          body: `Thanks for reaching out about the listing. ${leadMarker}`,
          confidence: 0.78,
        },
      },
    },
    {
      id: ns('approval-support'),
      workspaceId,
      agentSlug: 'support-handler',
      kind: 'SUPPORT_HANDLER_REPLY_DRAFT',
      refTable: 'e2e_seed',
      refId: ns('approval-support-ref'),
      discipline: 'customer',
      status: 'PENDING',
      marker: supportMarker,
      payload: {
        subject: `Re: your question — ${supportMarker}`,
        body: `Happy to help. Here's how to reset your password. ${supportMarker}`,
        confidence: 'high',
        suggestedAction: 'approve-and-send',
        reasoning: 'Direct match in the knowledge base.',
        citations: [{ title: 'Password reset guide', similarity: 0.91 }],
      },
    },
  ];

  const briefingMarker = `E2E-BRIEFING-${seedKey}`;
  const briefing: SeedBriefingRow = {
    id: ns('briefing'),
    workspaceId,
    forDate,
    bodyPlaintext:
      `Plaino's read on your week. ${briefingMarker}\n\n` +
      '3 drafts are waiting in your approvals queue: a follow-up nudge, a hot lead, and a support reply.',
    marker: briefingMarker,
    status: 'READY',
  };

  return {
    seedKey,
    user,
    workspace,
    membership,
    onboarding,
    preference,
    credentials,
    approvals,
    briefing,
    markers: {
      workspaceName,
      ownerEmail,
      approvals: [followUpMarker, leadMarker, supportMarker],
      briefing: briefingMarker,
    },
  };
}

// ── Production guard ─────────────────────────────────────────────────────────

export interface SeedGuardEnv {
  ALLOW_E2E_SEED?: string;
  E2E_SEED_FORBID?: string;
  E2E_SEED_MAX_EXISTING_WORKSPACES?: string;
}

export interface SeedGuardResult {
  allowed: boolean;
  reason: string;
}

/**
 * Decide whether seeding is permitted. Pure (offline-testable): takes the env
 * snapshot + the current non-test workspace count and returns a verdict.
 * `seedTestWorkspace` calls this with the live count and THROWS on a deny.
 */
export function evaluateSeedGuard(
  env: SeedGuardEnv,
  existingNonTestWorkspaceCount: number,
  maxExisting: number = DEFAULT_MAX_EXISTING_WORKSPACES,
): SeedGuardResult {
  if (env.ALLOW_E2E_SEED !== 'yes') {
    return {
      allowed: false,
      reason:
        "ALLOW_E2E_SEED is not 'yes'. Set ALLOW_E2E_SEED=yes to opt in (NEVER on production).",
    };
  }
  if (env.E2E_SEED_FORBID === '1') {
    return {
      allowed: false,
      reason:
        'E2E_SEED_FORBID=1 is set on this database — seeding is hard-blocked here (production brake).',
    };
  }
  const limit = parseMaxExisting(
    env.E2E_SEED_MAX_EXISTING_WORKSPACES,
    maxExisting,
  );
  if (existingNonTestWorkspaceCount > limit) {
    return {
      allowed: false,
      reason:
        `target DB has ${existingNonTestWorkspaceCount} non-test workspaces (> ${limit}); ` +
        'it looks like production. Refusing to seed. Raise E2E_SEED_MAX_EXISTING_WORKSPACES ' +
        'only if you are CERTAIN this is a disposable DB.',
    };
  }
  return { allowed: true, reason: 'ok' };
}

function parseMaxExisting(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ── DB layer (injectable client) ─────────────────────────────────────────────
//
// We type the client structurally to exactly the surface the seed touches. The
// repo's `prisma` singleton satisfies it; an in-memory fake in the unit tests
// satisfies it too — that's what lets the apply logic run with no DB.

export interface SeedDelegate {
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}

export interface SeedClient {
  user: SeedDelegate;
  workspace: SeedDelegate;
  membership: SeedDelegate;
  onboardingState: SeedDelegate;
  workspacePreference: SeedDelegate;
  integrationCredential: SeedDelegate;
  workApprovalQueueItem: SeedDelegate;
  workspaceBriefing: SeedDelegate;
}

/** Encrypt-at-apply hook. Defaults to the repo helpers; overridable so the
 *  offline tests can inject a deterministic stand-in and skip the env key. */
export interface SeedCrypto {
  encryptPayload: (payload: unknown) => unknown;
  encryptString: (plaintext: string) => string;
}

const REPO_CRYPTO: SeedCrypto = {
  encryptPayload: (payload) => encryptPayloadForWrite(payload),
  encryptString: (plaintext) => encrypt(plaintext),
};

export interface SeedRunOptions extends BuildSeedPlanOptions {
  client: SeedClient;
  crypto?: SeedCrypto;
  /** Env snapshot for the guard (defaults to process.env). */
  env?: SeedGuardEnv;
  maxExisting?: number;
}

export interface SeedRunResult {
  plan: SeedPlan;
  workspaceId: string;
  userId: string;
  slug: string;
}

/**
 * Assert seeding is allowed against `client`'s database; throws otherwise.
 * Counts non-test workspaces (slug NOT starting with the harness prefix) so a
 * DB already holding harness rows from a prior run isn't counted against the
 * production threshold.
 */
export async function assertSeedAllowed(
  client: SeedClient,
  env: SeedGuardEnv = process.env as SeedGuardEnv,
  maxExisting: number = DEFAULT_MAX_EXISTING_WORKSPACES,
): Promise<void> {
  const nonTestCount = await client.workspace.count({
    where: { slug: { not: { startsWith: E2E_SLUG_PREFIX } } },
  });
  const verdict = evaluateSeedGuard(env, nonTestCount, maxExisting);
  if (!verdict.allowed) {
    throw new Error(`[e2e-seed] refused: ${verdict.reason}`);
  }
}

/**
 * Apply the seed plan idempotently. Every write is an upsert keyed on the
 * deterministic id (or the natural unique key), so a re-run is a no-op /
 * refresh rather than a duplicate. Returns the plan so the caller (mint +
 * smoke) can read the ids and markers without rebuilding.
 */
export async function seedTestWorkspace(
  options: SeedRunOptions,
): Promise<SeedRunResult> {
  const env = options.env ?? (process.env as SeedGuardEnv);
  await assertSeedAllowed(options.client, env, options.maxExisting);

  const plan = buildSeedPlan({ key: options.key, forDate: options.forDate });
  const crypto = options.crypto ?? REPO_CRYPTO;
  const c = options.client;
  const now = new Date();

  await c.user.upsert({
    where: { id: plan.user.id },
    create: {
      id: plan.user.id,
      email: plan.user.email,
      name: plan.user.name,
      isOperator: plan.user.isOperator,
    },
    update: { email: plan.user.email, name: plan.user.name },
  });

  await c.workspace.upsert({
    where: { id: plan.workspace.id },
    create: {
      id: plan.workspace.id,
      name: plan.workspace.name,
      slug: plan.workspace.slug,
      vertical: plan.workspace.vertical,
      verticalTier: plan.workspace.verticalTier,
    },
    update: { name: plan.workspace.name, slug: plan.workspace.slug },
  });

  await c.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: plan.user.id,
        workspaceId: plan.workspace.id,
      },
    },
    create: {
      id: plan.membership.id,
      userId: plan.membership.userId,
      workspaceId: plan.membership.workspaceId,
      role: plan.membership.role,
      status: plan.membership.status,
    },
    update: { role: plan.membership.role, status: plan.membership.status },
  });

  await c.onboardingState.upsert({
    where: { workspaceId: plan.onboarding.workspaceId },
    create: {
      id: plan.onboarding.id,
      workspaceId: plan.onboarding.workspaceId,
      currentStep: plan.onboarding.currentStep,
      completedSteps: plan.onboarding.completedSteps,
      completedAt: plan.onboarding.completedAt,
    },
    update: {
      currentStep: plan.onboarding.currentStep,
      completedSteps: plan.onboarding.completedSteps,
      completedAt: plan.onboarding.completedAt,
    },
  });

  await c.workspacePreference.upsert({
    where: { workspaceId: plan.preference.workspaceId },
    create: {
      id: plan.preference.id,
      workspaceId: plan.preference.workspaceId,
      draftingTone: plan.preference.draftingTone,
      categorizationNotes: plan.preference.categorizationNotes,
      calendarWindow: plan.preference.calendarWindow,
    },
    update: {
      draftingTone: plan.preference.draftingTone,
      categorizationNotes: plan.preference.categorizationNotes,
      calendarWindow: plan.preference.calendarWindow,
    },
  });

  for (const cred of plan.credentials) {
    const accessTokenEncrypted = crypto.encryptString(cred.accessTokenPlaintext);
    await c.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cred.workspaceId,
          provider: cred.provider,
          accountId: cred.accountId,
        },
      },
      create: {
        id: cred.id,
        workspaceId: cred.workspaceId,
        provider: cred.provider,
        accountId: cred.accountId,
        accountEmail: cred.accountEmail,
        accessTokenEncrypted,
        scopes: cred.scopes,
        expiresAt: cred.expiresAt,
        status: 'ACTIVE',
      },
      update: {
        accessTokenEncrypted,
        accountEmail: cred.accountEmail,
        status: 'ACTIVE',
      },
    });
  }

  for (const approval of plan.approvals) {
    const payload = crypto.encryptPayload(approval.payload);
    await c.workApprovalQueueItem.upsert({
      where: { id: approval.id },
      create: {
        id: approval.id,
        workspaceId: approval.workspaceId,
        agentSlug: approval.agentSlug,
        kind: approval.kind,
        refTable: approval.refTable,
        refId: approval.refId,
        discipline: approval.discipline,
        status: approval.status,
        payload,
        proposedAt: now,
      },
      update: { payload, status: approval.status },
    });
  }

  const briefingBody = crypto.encryptString(plan.briefing.bodyPlaintext);
  await c.workspaceBriefing.upsert({
    where: {
      workspaceId_forDate: {
        workspaceId: plan.briefing.workspaceId,
        forDate: plan.briefing.forDate,
      },
    },
    create: {
      id: plan.briefing.id,
      workspaceId: plan.briefing.workspaceId,
      forDate: plan.briefing.forDate,
      body: briefingBody,
      status: plan.briefing.status,
    },
    update: { body: briefingBody, status: plan.briefing.status },
  });

  return {
    plan,
    workspaceId: plan.workspace.id,
    userId: plan.user.id,
    slug: plan.workspace.slug,
  };
}

/**
 * Remove every row the seed created for `key`. Child tables are FK-bound to
 * the workspace with `onDelete: Cascade`, so deleting the workspace removes
 * approvals / onboarding / preference / credentials / briefing. The
 * harness-only user row (email under the `agentplain-e2e.test` domain) is
 * deleted explicitly; its membership cascades from the workspace delete. Safe
 * to call when nothing was seeded (deleteMany on no match is a no-op).
 */
export async function teardownTestWorkspace(
  client: SeedClient,
  options: BuildSeedPlanOptions = {},
): Promise<void> {
  const plan = buildSeedPlan({ key: options.key, forDate: options.forDate });
  await client.workspace.deleteMany({ where: { id: plan.workspace.id } });
  await client.user.deleteMany({ where: { id: plan.user.id } });
}
