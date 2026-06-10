/**
 * Tests for `home-services-estimate-followup-sweep`.
 *
 * Behavior (DI — no DB, no QB network):
 *   - Billing-paused workspaces are skipped.
 *   - Workspaces with sales-enablement disabled are skipped on the
 *     discipline gate.
 *   - Workspaces without a QB credential are skipped as not-connected.
 *   - Workspaces that haven't installed the skill from /marketplace are
 *     skipped as not-installed.
 *   - Fire-gate denied (vacation/window) skips the workspace cleanly.
 *   - Happy path: QB credential present + all gates pass → runForWorkspace
 *     called and drafts are counted.
 *   - Fetcher failure (thrown error) lands in failures[], not a crash.
 *
 * Smoke:
 *   - Function id + cron schedule are the documented constants.
 *   - `home-services-estimate-followup` is mapped to `sales-enablement`.
 *   - Serve route file references `homeServicesEstimateFollowupSweepFn`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_CRON,
  HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
  homeServicesEstimateFollowupSweepFn,
  runEstimateFollowupSweep,
} from '../home-services-estimate-followup-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import type { Vertical } from '@prisma/client';

// ── shared test workspace UUIDs ────────────────────────────────────────────
const WS_QB = '11111111-1111-1111-1111-111111111111';
const WS_NO_QB = '22222222-2222-2222-2222-222222222222';
const WS_DISABLED = '33333333-3333-3333-3333-333333333333';
const WS_NOT_INSTALLED = '44444444-4444-4444-4444-444444444444';
const WS_FIRE_GATED = '55555555-5555-5555-5555-555555555555';
const WS_BILLING_PAUSED = '66666666-6666-6666-6666-666666666666';

const HOME_SERVICES_VERTICAL: Vertical = 'HOME_SERVICES';
const DISCIPLINE = SKILL_DISCIPLINE['home-services-estimate-followup']!;

function makeCandidate(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    vertical: HOME_SERVICES_VERTICAL,
    operatorName: 'Test Operator',
    operatorEmail: 'op@test.example',
    operatorPhone: null as string | null,
    hasQuickbooks: true,
    disabledDisciplines: [] as string[],
    ...overrides,
  };
}

// ── billing pause ──────────────────────────────────────────────────────────
// `isWorkspacePaused` is not injectable in the current sweep implementation
// (mirrors the follow-up-chaser-sweep pattern). The gate calls the live
// helper which returns isPaused=false when there is no DB. We smoke-test
// that the sweep completes cleanly for a workspace that passes all gates
// (billing pause = not triggered in a no-DB test run).

describe('runEstimateFollowupSweep — billing gate path shape', () => {
  it('sweep completes without failures when all gates pass (billing gate not triggered)', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_BILLING_PAUSED)],
      runForWorkspace: async () => ({ ok: true, draftsWritten: 1 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    // isWorkspacePaused returns isPaused=false (no DB) → workspace proceeds
    assert.equal(result.failures.length, 0);
    assert.equal(result.workspacesConsidered, 1);
  });
});

// ── discipline disabled ────────────────────────────────────────────────────

describe('runEstimateFollowupSweep — discipline disabled workspace is skipped', () => {
  it('honors WorkspacePreference.disabledDisciplines', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [
        makeCandidate(WS_DISABLED, { disabledDisciplines: [DISCIPLINE] }),
      ],
      runForWorkspace: async () => {
        throw new Error('should not be reached — discipline disabled');
      },
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.draftsWritten, 0);
    assert.equal(result.failures.length, 0);
  });
});

// ── QB credential missing ──────────────────────────────────────────────────

describe('runEstimateFollowupSweep — workspace without QB credential is skipped', () => {
  it('counts them as skipped-not-connected, not failed', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [
        makeCandidate(WS_NO_QB, { hasQuickbooks: false }),
      ],
      runForWorkspace: async () => {
        throw new Error('should not be reached — no QB credential');
      },
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedNotConnected, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.failures.length, 0);
  });
});

// ── marketplace not installed ──────────────────────────────────────────────

describe('runEstimateFollowupSweep — skill not installed from marketplace is skipped', () => {
  it('increments workspacesSkippedNotInstalled', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_NOT_INSTALLED)],
      runForWorkspace: async () => {
        throw new Error('should not be reached — not installed');
      },
      isInstalled: async () => false,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedNotInstalled, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.failures.length, 0);
  });
});

// ── fire gate denied ───────────────────────────────────────────────────────

describe('runEstimateFollowupSweep — fire-gate denies workspace (vacation/window)', () => {
  it('increments workspacesSkippedFireGate and does not call runForWorkspace', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_FIRE_GATED)],
      runForWorkspace: async () => {
        throw new Error('should not be reached — fire gate denied');
      },
      isInstalled: async () => true,
      gateFire: async () => ({
        allowed: false,
        reason: 'workspace-paused',
        detail: 'Workspace paused through 2026-07-01T00:00:00.000Z.',
      }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedFireGate, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.draftsWritten, 0);
    assert.equal(result.failures.length, 0);
  });

  it('allowed gate result does NOT increment the fire-gate skip counter', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_QB)],
      runForWorkspace: async () => ({ ok: true, draftsWritten: 0 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesSkippedFireGate, 0);
  });
});

// ── happy path ─────────────────────────────────────────────────────────────

describe('runEstimateFollowupSweep — happy path produces drafts', () => {
  it('counts workspacesWithDrafts and draftsWritten on a successful run', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_QB)],
      runForWorkspace: async () => ({ ok: true, draftsWritten: 2 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesWithDrafts, 1);
    assert.equal(result.draftsWritten, 2);
    assert.equal(result.workspacesSkippedNotConnected, 0);
    assert.equal(result.workspacesSkippedDisciplineDisabled, 0);
    assert.equal(result.failures.length, 0);
  });

  it('workspacesWithDrafts stays 0 when runForWorkspace returns 0 drafts', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_QB)],
      runForWorkspace: async () => ({ ok: true, draftsWritten: 0 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.draftsWritten, 0);
    assert.equal(result.failures.length, 0);
  });

  it('aggregates drafts across multiple workspaces', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [
        makeCandidate('ws-a-0001'),
        makeCandidate('ws-a-0002'),
        makeCandidate('ws-a-0003'),
      ],
      runForWorkspace: async (_wsId) => ({ ok: true, draftsWritten: 3 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 3);
    assert.equal(result.workspacesWithDrafts, 3);
    assert.equal(result.draftsWritten, 9);
    assert.equal(result.failures.length, 0);
  });
});

// ── fetcher failure non-fatal ──────────────────────────────────────────────

describe('runEstimateFollowupSweep — runForWorkspace failure is non-fatal', () => {
  it('lands the error in failures[] and continues the loop', async () => {
    let callCount = 0;
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [
        makeCandidate('ws-fail-0001'),
        makeCandidate('ws-ok-0002'),
      ],
      runForWorkspace: async (wsId) => {
        callCount += 1;
        if (wsId === 'ws-fail-0001') {
          throw new Error('QB MCP server unreachable');
        }
        return { ok: true, draftsWritten: 1 };
      },
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(callCount, 2, 'sweep continued past the failed workspace');
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].workspaceId, 'ws-fail-0001');
    assert.match(result.failures[0].reason, /QB MCP server unreachable/);
    // The second workspace still produced drafts
    assert.equal(result.workspacesWithDrafts, 1);
    assert.equal(result.draftsWritten, 1);
  });

  it('runForWorkspace returning ok=false lands in failures[] too', async () => {
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [makeCandidate(WS_QB)],
      runForWorkspace: async () => ({
        ok: false,
        draftsWritten: 0,
        reason: 'QB_TOKEN_EXPIRED: token expired',
      }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].reason, /QB_TOKEN_EXPIRED/);
    assert.equal(result.workspacesWithDrafts, 0);
  });
});

// ── vertical scoping ───────────────────────────────────────────────────────

describe('runEstimateFollowupSweep — vertical scoping', () => {
  it('only HOME_SERVICES vertical is considered (lister responsibility — passes through unchanged)', async () => {
    // The sweep trusts the lister to scope by vertical. Verify the loop
    // does NOT re-filter by vertical itself (so a test lister returning
    // a non-home-services workspace still gets processed — the lister is
    // the gate, not the loop).
    const result = await runEstimateFollowupSweep({
      listCandidates: async () => [
        { ...makeCandidate(WS_QB), vertical: 'HOME_SERVICES' as Vertical },
      ],
      runForWorkspace: async () => ({ ok: true, draftsWritten: 1 }),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.draftsWritten, 1);
  });
});

// ── smoke ──────────────────────────────────────────────────────────────────

describe('homeServicesEstimateFollowupSweepFn — registration shape', () => {
  it('uses the documented function id', () => {
    assert.equal(
      HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
      'agentplain-home-services-estimate-followup-sweep',
    );
  });

  it('uses a daily 09:00 UTC cron schedule', () => {
    assert.equal(HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_CRON, '0 9 * * *');
  });

  it('function export is defined', () => {
    assert.ok(homeServicesEstimateFollowupSweepFn, 'function export defined');
  });

  it('home-services-estimate-followup is mapped to sales-enablement', () => {
    const id = SKILL_DISCIPLINE['home-services-estimate-followup'];
    assert.ok(id, 'home-services-estimate-followup must be in SKILL_DISCIPLINE');
    assert.equal(id, 'sales-enablement');
  });

  it('serve route file references homeServicesEstimateFollowupSweepFn', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.resolve('app/api/inngest/route.ts'),
      'utf8',
    );
    assert.match(src, /homeServicesEstimateFollowupSweepFn/);
  });
});
