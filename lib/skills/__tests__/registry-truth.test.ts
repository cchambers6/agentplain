/**
 * lib/skills/__tests__/registry-truth.test.ts
 *
 * THE CI GUARD that makes silent registry no-ops impossible (pfd-8).
 *
 * The 2026-06-10 signup-to-go audit found the same class of bug twice in
 * one build night: a skill ships code-complete, but the SKILL_CATALOG seam
 * silently no-ops it — `isSkillInstalledForWorkspace` returns false, every
 * workspace is skipped on every cron tick, and ZERO error surfaces anywhere.
 *
 * This suite turns all three faces of that bug into a failing test, driven
 * by the SWEEP_DISPATCH_MANIFEST (the single source of truth for which
 * sweep fires which skill). A NEW sweep added without a manifest row, or a
 * manifest row pointing at a dark/unregistered skill, fails the build:
 *
 *   Invariant 1 — every sweep-dispatched skill resolves to a SKILL_CATALOG
 *                 entry with runtime:'live'. (A sweep dispatching a skill
 *                 absent from the catalog, or one that isn't live, would
 *                 silently no-op via isSkillInstalledForWorkspace.)
 *   Invariant 2 — every manifest Inngest function's id() matches the
 *                 declared functionId AND is registered in route.ts. (A
 *                 sweep that exists but isn't wired into serve() never ticks.)
 *   Invariant 3 — every runtime:'live' catalog skill is accounted for as
 *                 either sweep-dispatched (manifest) or non-sweep
 *                 caller-covered (NON_SWEEP_LIVE_SKILLS). (A live skill with
 *                 no caller is the (c) gap — live in the catalog, dark in
 *                 production.)
 *   Invariant 4 — every SKILLS_WITH_PRODUCTION_CALLER skill has a live
 *                 catalog entry (the readiness manifest can't claim a caller
 *                 for a dark skill).
 *
 * Runs in the normal node:test suite, so it gates every push.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SKILL_CATALOG } from '../registry';
import {
  SWEEP_DISPATCH_MANIFEST,
  NON_SWEEP_LIVE_SKILLS,
} from '../sweep-dispatch-manifest';
import { SKILLS_WITH_PRODUCTION_CALLER } from '../../verticals/readiness';

// The real Inngest function objects — imported so we can read their actual
// id() and assert it against the manifest's declared functionId.
import { invoiceChaseGeneralSweepFn } from '../../inngest/functions/invoice-chase-general-sweep';
import { monthEndCloseCpaSweepFn } from '../../inngest/functions/month-end-close-cpa-sweep';
import { lawConflictScreenSweepFn } from '../../inngest/functions/law-intake-conflict-screen-sweep';
import { complianceWatchSweepFn } from '../../inngest/functions/compliance-watch-sweep';
import { analyticsPulseSweepFn } from '../../inngest/functions/analytics-weekly-pulse-sweep';
import { contentCalendarSweepFn } from '../../inngest/functions/content-calendar-drafter-sweep';
import { financePulseSweepFn } from '../../inngest/functions/finance-pulse-sweep';
import { followUpChaserSweepFn } from '../../inngest/functions/follow-up-chaser-sweep';
import { processDocDrafterSweepFn } from '../../inngest/functions/process-doc-drafter-sweep';

/** Map manifest routeSymbol → the real Inngest function object. Every
 *  manifest row MUST have an entry here (asserted below) so the guard reads
 *  the live id() rather than trusting the declared string. */
const SWEEP_FN_BY_SYMBOL: Record<string, unknown> = {
  invoiceChaseGeneralSweepFn,
  monthEndCloseCpaSweepFn,
  lawConflictScreenSweepFn,
  complianceWatchSweepFn,
  analyticsPulseSweepFn,
  contentCalendarSweepFn,
  financePulseSweepFn,
  followUpChaserSweepFn,
  processDocDrafterSweepFn,
};

function inngestId(fn: unknown): string {
  const f = fn as { id?: unknown };
  if (typeof f.id === 'function') return (f.id as () => string)();
  return String((f as { id: string }).id);
}

function catalogEntry(slug: string) {
  return SKILL_CATALOG.find((s) => s.slug === slug) ?? null;
}

function readRouteSource(): string {
  // __dirname = <worktree>/lib/skills/__tests__ → 3 up = worktree root.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const routePath = path.join(repoRoot, 'app', 'api', 'inngest', 'route.ts');
  return fs.readFileSync(routePath, 'utf-8');
}

// ── Invariant 1 — every sweep-dispatched skill is catalog-live ────────────

describe('registry-truth — every sweep-dispatched skill is runtime:live in the catalog', () => {
  for (const row of SWEEP_DISPATCH_MANIFEST) {
    it(`${row.skillSlug} (via ${row.routeSymbol}) is in SKILL_CATALOG and runtime:'live'`, () => {
      const entry = catalogEntry(row.skillSlug);
      assert.ok(
        entry,
        `${row.skillSlug} is dispatched by a sweep but ABSENT from SKILL_CATALOG — ` +
          `isSkillInstalledForWorkspace would return false and the sweep would ` +
          `silently skip every workspace. Add the catalog entry.`,
      );
      assert.equal(
        entry!.runtime,
        'live',
        `${row.skillSlug} has a sweep but its catalog runtime is ` +
          `${entry!.runtime ?? 'schema-only(default)'} — the sweep would silently ` +
          `no-op. Set runtime:'live'.`,
      );
    });
  }
});

// ── Invariant 2 — every manifest fn is real + registered in route.ts ──────

describe('registry-truth — every manifest sweep is wired into the Inngest route', () => {
  const routeSrc = readRouteSource();

  for (const row of SWEEP_DISPATCH_MANIFEST) {
    it(`${row.routeSymbol} id() matches the manifest functionId`, () => {
      const fn = SWEEP_FN_BY_SYMBOL[row.routeSymbol];
      assert.ok(
        fn,
        `manifest declares ${row.routeSymbol} but the test did not import it — ` +
          `add it to SWEEP_FN_BY_SYMBOL.`,
      );
      assert.equal(
        inngestId(fn),
        row.functionId,
        `${row.routeSymbol}.id() != declared functionId — the manifest is stale.`,
      );
    });

    it(`${row.routeSymbol} is registered in app/api/inngest/route.ts`, () => {
      // Must appear in BOTH the import and the functions[] array. A bare
      // import without registration means the sweep never ticks.
      const importRe = new RegExp(`import\\s*\\{[^}]*\\b${row.routeSymbol}\\b`);
      assert.match(
        routeSrc,
        importRe,
        `${row.routeSymbol} is not imported in route.ts`,
      );
      // The functions: [...] block — assert the symbol appears on its own
      // line inside the array (after the import). Two references total is
      // the signal it's both imported and registered.
      const occurrences = routeSrc.split(row.routeSymbol).length - 1;
      assert.ok(
        occurrences >= 2,
        `${row.routeSymbol} appears ${occurrences}x in route.ts — expected it ` +
          `both imported AND in the serve() functions array. A sweep that is ` +
          `imported but not registered never fires.`,
      );
    });
  }
});

// ── Invariant 3 — every live catalog skill has an accounted-for caller ────

describe('registry-truth — no runtime:live catalog skill is left without a caller', () => {
  const sweepSkills = new Set(SWEEP_DISPATCH_MANIFEST.map((r) => r.skillSlug));
  const nonSweepSkills = new Set(Object.keys(NON_SWEEP_LIVE_SKILLS));

  for (const entry of SKILL_CATALOG) {
    if (entry.runtime !== 'live') continue;
    it(`${entry.slug} (runtime:live) is sweep-dispatched OR non-sweep caller-covered`, () => {
      const covered = sweepSkills.has(entry.slug) || nonSweepSkills.has(entry.slug);
      assert.ok(
        covered,
        `${entry.slug} is runtime:'live' but appears in NEITHER ` +
          `SWEEP_DISPATCH_MANIFEST nor NON_SWEEP_LIVE_SKILLS — it claims to fire ` +
          `but no caller is declared. Either wire + declare a caller, or drop it ` +
          `back to runtime:'schema-only' so the marketplace badges it honestly.`,
      );
    });
  }
});

// ── Invariant 4 — readiness production-caller list agrees with the catalog ─

describe('registry-truth — SKILLS_WITH_PRODUCTION_CALLER all map to live catalog skills', () => {
  for (const slug of SKILLS_WITH_PRODUCTION_CALLER) {
    it(`${slug} is a live catalog skill`, () => {
      const entry = catalogEntry(slug);
      assert.ok(entry, `${slug} is in SKILLS_WITH_PRODUCTION_CALLER but not in SKILL_CATALOG`);
      assert.equal(
        entry!.runtime,
        'live',
        `${slug} is claimed as having a production caller but its catalog runtime ` +
          `is ${entry!.runtime ?? 'schema-only(default)'}`,
      );
    });
  }

  it('every sweep-dispatched skill that is a vertical killer is also a readiness production-caller', () => {
    // The three pfd-8 wave skills must be in BOTH the sweep manifest and
    // the readiness production-caller set so the signup gate opens.
    for (const slug of ['invoice-chase-general', 'month-end-close-cpa', 'law-intake-conflict-screen']) {
      assert.ok(
        SKILLS_WITH_PRODUCTION_CALLER.has(slug),
        `${slug} has a sweep but is missing from SKILLS_WITH_PRODUCTION_CALLER — ` +
          `the signup gate would still treat its vertical as unsupported.`,
      );
    }
  });
});

// ── Manifest hygiene — every manifest row has a real imported fn ──────────

describe('registry-truth — manifest hygiene', () => {
  it('every SWEEP_DISPATCH_MANIFEST row has an imported Inngest function', () => {
    for (const row of SWEEP_DISPATCH_MANIFEST) {
      assert.ok(
        SWEEP_FN_BY_SYMBOL[row.routeSymbol],
        `manifest row for ${row.skillSlug} references ${row.routeSymbol} which is ` +
          `not imported in the guard — add it to SWEEP_FN_BY_SYMBOL.`,
      );
    }
  });

  it('no duplicate skill slugs in the sweep manifest', () => {
    const slugs = SWEEP_DISPATCH_MANIFEST.map((r) => r.skillSlug);
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate skill in manifest');
  });
});
