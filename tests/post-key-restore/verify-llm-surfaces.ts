#!/usr/bin/env tsx
/**
 * tests/post-key-restore/verify-llm-surfaces.ts
 *
 * POST-KEY-RESTORE VERIFICATION HARNESS
 * ======================================
 * Run this after restoring the Anthropic API key to confirm every
 * LLM-dependent surface in agentplain is actually live, not silently
 * running on a test stub or being caught by a stale sentinel.
 *
 * ── QUICK START ──────────────────────────────────────────────────────────
 * After restoring ANTHROPIC_API_KEY (remove the sk-ant-PAUSED-… sentinel
 * and set the real key), run:
 *
 *   BASE_URL=https://app.agentplain.com \
 *   LIVE_PROVIDER_CHECK=true \
 *   npx tsx tests/post-key-restore/verify-llm-surfaces.ts
 *
 * Output is a mobile-readable checklist table:
 *
 *   ✓ PASS    provider-key-state    — Key is set and is NOT the sentinel
 *   ✓ PASS    sentinel-layer        — Real completion received (model=..., tokens=1)
 *   ✓ PASS    plaino-chat-marketing — Real reply received (142 chars, degraded=false)
 *   … (21 surfaces total)
 *   SUMMARY: 21 PASS | 0 BLOCKED | 0 SKIP | 0 FAIL
 *
 * ── ENV VARS ─────────────────────────────────────────────────────────────
 * Required always:
 *   (none — the script runs safely with no env; everything becomes SKIP or
 *   BLOCKED and the table still renders)
 *
 * Optional — unlock more checks:
 *   ANTHROPIC_API_KEY  — the restored real key (NOT the sentinel)
 *   LIVE_PROVIDER_CHECK=true — spend one cheap token per provider-level check
 *   BASE_URL           — e.g. https://app.agentplain.com — unlock HTTP smoke checks
 *   SURFACE_IDS        — comma-separated list of surface IDs to run (default: all)
 *
 * ── HOW TO READ THE OUTPUT ───────────────────────────────────────────────
 * PASS    — real signal confirmed; this surface is live
 * BLOCKED — sentinel/budget/flag stopped the call. After key restore this
 *           should flip to PASS. If BLOCKED persists after restore, the
 *           sentinel value may still be in env on the deployment.
 * SKIP    — prerequisite missing (no BASE_URL, no liveProviderCheck).
 *           Not a failure — just means you need to set the env var.
 * FAIL    — unexpected error. Action required.
 *
 * ── WHAT THIS DOES NOT TEST ──────────────────────────────────────────────
 * - Database writes (Prisma operations within skills)
 * - Inngest function triggers or retries
 * - End-to-end value loop (use tests/skills-loop-e2e.test.ts for that)
 * - Auth flows (the support-mode chat check returns SKIP without a session)
 * Honest limits: the /api/chat support-mode check requires an authenticated
 * session cookie. Without one, it returns SKIP (not FAIL).
 *
 * ── EXTENSIBILITY ────────────────────────────────────────────────────────
 * When tonight's unmerged branches land on main (cv/cpa-close-live-data,
 * cv/general-invoice-chase, cv/home-services-estimates, cv/realty-first-touch),
 * they add entries to lib/llm/restore-checklist.ts. This script picks them
 * up automatically — no changes needed here.
 */

import {
  LLM_SURFACE_REGISTRY,
  type VerifyOptions,
  type VerifyResult,
  type VerifyStatus,
  type LlmSurface,
} from '@/lib/llm/restore-checklist';

// ── Config ────────────────────────────────────────────────────────────────

const opts: VerifyOptions = {
  liveProviderCheck: process.env.LIVE_PROVIDER_CHECK === 'true',
  baseUrl: process.env.BASE_URL?.replace(/\/$/, '') ?? undefined,
};

const filterIds = process.env.SURFACE_IDS
  ? process.env.SURFACE_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

// ── Table rendering ───────────────────────────────────────────────────────

const STATUS_ICON: Record<VerifyStatus, string> = {
  PASS: '✓',
  BLOCKED: '○',
  SKIP: '–',
  FAIL: '✗',
};

const STATUS_LABEL: Record<VerifyStatus, string> = {
  PASS: 'PASS   ',
  BLOCKED: 'BLOCKED',
  SKIP: 'SKIP   ',
  FAIL: 'FAIL   ',
};

interface RunResult {
  surface: LlmSurface;
  result: VerifyResult;
}

function renderHeader(): void {
  console.log('');
  console.log('POST-KEY-RESTORE VERIFICATION HARNESS');
  console.log('======================================');
  console.log(`  LIVE_PROVIDER_CHECK : ${opts.liveProviderCheck ? 'YES (spending ~1 token per provider check)' : 'NO  (env-state checks only, no tokens)'}`);
  console.log(`  BASE_URL            : ${opts.baseUrl ?? '(not set — HTTP checks will SKIP)'}`);
  console.log(`  ANTHROPIC_API_KEY   : ${describeKey(process.env.ANTHROPIC_API_KEY)}`);
  console.log(`  Surfaces to check   : ${filterIds ? filterIds.join(', ') : 'ALL (' + LLM_SURFACE_REGISTRY.length + ')'}`);
  console.log('');
}

function describeKey(key?: string): string {
  if (!key || key.trim().length === 0) return '(not set)';
  if (key.startsWith('sk-ant-PAUSED-')) return `sentinel active (${key.slice(0, 26)}…)`;
  return `set (${key.slice(0, 10)}…)`;
}

function renderRow(r: RunResult): void {
  const icon = STATUS_ICON[r.result.status];
  const label = STATUS_LABEL[r.result.status];
  const latency = r.result.latencyMs !== undefined ? ` [${r.result.latencyMs}ms]` : '';
  const id = r.surface.id.padEnd(36);
  const detail = r.result.detail;
  console.log(`  ${icon} ${label}  ${id}  ${detail}${latency}`);
}

function renderSummary(results: RunResult[]): void {
  const counts: Record<VerifyStatus, number> = { PASS: 0, BLOCKED: 0, SKIP: 0, FAIL: 0 };
  for (const r of results) counts[r.result.status]++;

  console.log('');
  console.log('─'.repeat(80));
  console.log(
    `  SUMMARY: ${counts.PASS} PASS | ${counts.BLOCKED} BLOCKED | ${counts.SKIP} SKIP | ${counts.FAIL} FAIL`
  );
  console.log('');

  if (counts.BLOCKED > 0) {
    console.log('  BLOCKED surfaces will become PASS after key restore + redeploy.');
    console.log('  If any remain BLOCKED after restore, the sentinel may still be set in Vercel env.');
  }
  if (counts.FAIL > 0) {
    console.log('  FAIL surfaces need attention — see detail above for each.');
  }
  if (counts.SKIP > 0 && !opts.baseUrl) {
    console.log('  Set BASE_URL=https://app.agentplain.com to unlock HTTP smoke checks.');
  }
  if (counts.SKIP > 0 && !opts.liveProviderCheck) {
    console.log('  Set LIVE_PROVIDER_CHECK=true to unlock provider-level token checks.');
  }
  console.log('');

  // Exit non-zero when there are FAILs so CI/scripts can gate on it.
  if (counts.FAIL > 0) {
    process.exit(1);
  }
}

function groupByArea(results: RunResult[]): Map<string, RunResult[]> {
  const map = new Map<string, RunResult[]>();
  for (const r of results) {
    const group = map.get(r.surface.area) ?? [];
    group.push(r);
    map.set(r.surface.area, group);
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  renderHeader();

  const surfaces = filterIds
    ? LLM_SURFACE_REGISTRY.filter((s) => filterIds.includes(s.id))
    : LLM_SURFACE_REGISTRY;

  if (surfaces.length === 0) {
    console.error('  ERROR: No surfaces matched SURFACE_IDS filter.');
    process.exit(1);
  }

  // Run all verifications (sequentially to avoid provider rate limits)
  const runResults: RunResult[] = [];
  const groups = groupByArea([...surfaces].map((s) => ({ surface: s, result: { status: 'SKIP' as const, detail: 'pending' } })));

  for (const [area, _] of groups) {
    const areaLabel = area.toUpperCase().replace(/-/g, ' ');
    console.log(`  ── ${areaLabel} ${'─'.repeat(Math.max(0, 60 - areaLabel.length))}`);

    const areaSurfaces = surfaces.filter((s) => s.area === area);
    for (const surface of areaSurfaces) {
      let result: VerifyResult;
      try {
        result = await surface.verify(opts);
      } catch (err) {
        result = {
          status: 'FAIL',
          detail: `verify() threw: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      const runResult: RunResult = { surface, result };
      runResults.push(runResult);
      renderRow(runResult);
    }
    console.log('');
  }

  renderSummary(runResults);
}

main().catch((err) => {
  console.error('HARNESS CRASHED:', err);
  process.exit(2);
});
