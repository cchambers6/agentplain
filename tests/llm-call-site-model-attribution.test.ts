/**
 * tests/llm-call-site-model-attribution.test.ts
 *
 * Source-level corpus pins for the two ways an `llm.complete()` call site can
 * lie about itself:
 *
 *   INV-1  A production call site must NAME its model tier.
 *          `lib/portal/chat.ts` set no `model` at all and
 *          `lib/skills/month-end-close-cpa/polish.ts` set `model: undefined`.
 *          Both landed on the untiered provider default `claude-sonnet-4-5`
 *          (lib/llm/anthropic-provider.ts) — a string that appears in no tier
 *          table, chosen by nobody.
 *
 *   INV-2  A call site must not pair MODEL_OPUS with a `sourceSurface` whose
 *          DEFAULT_ROUTING_POLICY row is the Haiku tier. That is the maximum
 *          possible disagreement between a call's label and its cost (15x on
 *          input), and it is what the per-surface billing rollup in
 *          `lib/billing/usage/aggregate.ts` reports to the operator.
 *          `lead-triage-realestate/llm-refine.ts` passed MODEL_OPUS under
 *          `sourceSurface: 'CATEGORIZE'`.
 *
 * WHY SOURCE-LEVEL: these are registry-style invariants about how call sites
 * are written, exactly the shape already used by `lib/llm/model-tiers.test.ts`.
 * Wiring each skill's full dependency graph to observe the request object would
 * test the graph, not the pin.
 *
 * COVERAGE REPORTING: every check below reports `examined N of M` and fails
 * when N is zero. This repo has a recorded failure where an empty input set
 * passed green, and per-root minimums exist because a single global floor was
 * satisfied by other roots after an entire tree was deleted.
 *
 * SCAN DISCIPLINE: the walk is an explicit allowlist of source roots, never a
 * bare recursive walk of the repo root — many git worktrees live under the
 * checkout and a naive walk has overcounted call sites ~25x here before.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

import { DEFAULT_ROUTING_POLICY } from '@/lib/llm/routing-provider';
import { MODEL_HAIKU, MODEL_OPUS, MODEL_SONNET } from '@/lib/llm/model-tiers';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Explicit allowlist of source roots. NOT a walk of the repo root. */
const SCAN_ROOTS = ['lib', 'app'] as const;

/** Roots whose call sites must all name a tier constant (INV-1). Each carries
 *  its own minimum so a collapse in one root cannot be masked by another. */
const TIERED_ROOTS: ReadonlyArray<{ dir: string; minSites: number }> = [
  { dir: join('lib', 'skills'), minSites: 15 },
  { dir: join('lib', 'plaino'), minSites: 3 },
  { dir: join('lib', 'portal'), minSites: 1 },
];

/** Known non-product call sites, each with a reason that is checked against
 *  the code below rather than merely asserted in prose. */
const NON_PRODUCT_SITES: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: join('lib', 'llm', 'restore-checklist.ts'),
    why: 'post-key-restore health probe: 10 maxTokens, no customer output',
  },
];

const TIER_CONSTANTS = new Set(['MODEL_OPUS', 'MODEL_SONNET', 'MODEL_HAIKU']);

interface CallSite {
  file: string;
  line: number;
  /** Raw text of the `model:` value, `'<shorthand>'` for `model,`, or null. */
  model: string | null;
  surface: string | null;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Deliberately NOT a silent empty corpus: a missing root shows up as a
    // zero count, which the minimums below then fail on.
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      out.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Drop whole-line `//` comments so prose about a call site is never mistaken
 *  for the call site. Brace depth is counted on the stripped text. */
function stripLineComments(src: string): string[] {
  return src.split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l));
}

function parseCallSites(file: string, src: string): CallSite[] {
  const lines = stripLineComments(src);
  const sites: CallSite[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\.complete\(\s*\{/.test(lines[i])) continue;
    let depth = 0;
    let model: string | null = null;
    let surface: string | null = null;
    for (let j = i; j < Math.min(lines.length, i + 120); j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (model === null) {
        const kv = lines[j].match(/^\s*model:\s*([^,]+),\s*$/);
        if (kv) model = kv[1].trim();
        else if (/^\s*model,\s*$/.test(lines[j])) model = '<shorthand>';
      }
      if (surface === null) {
        // Accept BOTH quote styles: a single-quote-only pattern has already
        // produced a clean, confident, fabricated zero in this repo.
        const sm = lines[j].match(/sourceSurface:\s*['"]([A-Z_]+)['"]/);
        if (sm) surface = sm[1];
      }
      if (j > i && depth <= 0) break;
    }
    sites.push({ file, line: i + 1, model, surface });
  }
  return sites;
}

const FILES: string[] = [];
for (const root of SCAN_ROOTS) FILES.push(...listSourceFiles(join(REPO_ROOT, root)));

let SCANNED = 0;
const SITES: CallSite[] = [];
for (const abs of FILES) {
  const src = readFileSync(abs, 'utf8');
  SCANNED++;
  if (!src.includes('.complete(')) continue;
  SITES.push(...parseCallSites(relative(REPO_ROOT, abs), src));
}

const norm = (f: string) => f.split('/').join(sep);
const inRoot = (file: string, dir: string) => norm(file).startsWith(dir + sep);
const isNonProduct = (file: string) => NON_PRODUCT_SITES.some((s) => norm(file) === s.file);

// ── Coverage: the instrument must prove it looked at something ───────────────

describe('llm call-site corpus — coverage', () => {
  it('examined N of M source files, N > 0', () => {
    assert.ok(FILES.length > 0, 'the allowlisted source roots resolved to zero files');
    assert.equal(
      SCANNED,
      FILES.length,
      `examined ${SCANNED} of ${FILES.length} source files under ${SCAN_ROOTS.join(', ')}`,
    );
    assert.ok(
      FILES.length >= 800,
      `examined ${FILES.length} files; expected >= 800 under lib/ + app/ — a collapse this large means the walk broke`,
    );
  });

  it('found a plausible number of llm.complete() call sites', () => {
    assert.ok(
      SITES.length >= 20,
      `found ${SITES.length} call sites; expected >= 20 (26 product sites + probes at bfc0c71e)`,
    );
    // Upper bound too: many worktrees live under the repo root and a walk that
    // wandered into one would report a multiple of the true count.
    assert.ok(
      SITES.length < 100,
      `found ${SITES.length} call sites; a count this high means the walk escaped lib/ + app/`,
    );
  });

  it('each tiered root contributes at least its own minimum (no global floor)', () => {
    let examined = 0;
    for (const root of TIERED_ROOTS) {
      examined++;
      const n = SITES.filter((s) => inRoot(s.file, root.dir)).length;
      assert.ok(
        n >= root.minSites,
        `${root.dir}: found ${n} call sites, minimum ${root.minSites} — this root went silent`,
      );
    }
    assert.equal(examined, TIERED_ROOTS.length, `examined ${examined} of ${TIERED_ROOTS.length} roots`);
  });
});

// ── INV-1 — every production call site names its tier ────────────────────────

describe('INV-1: production llm.complete() call sites name a model tier', () => {
  it('no call site under a tiered root omits `model` or passes `model: undefined`', () => {
    const subject = SITES.filter(
      (s) => TIERED_ROOTS.some((r) => inRoot(s.file, r.dir)) && !isNonProduct(s.file),
    );
    let examined = 0;
    const offenders: string[] = [];
    for (const site of subject) {
      examined++;
      if (site.model === null) {
        offenders.push(
          `${site.file}:${site.line} — no \`model\` key; falls to the untiered provider default`,
        );
      } else if (site.model === 'undefined') {
        offenders.push(
          `${site.file}:${site.line} — \`model: undefined\`; a decision-shaped non-decision`,
        );
      }
    }
    assert.ok(examined > 0, 'examined nothing — the subject set was empty');
    assert.deepEqual(
      offenders,
      [],
      `examined ${examined} of ${subject.length} tiered-root call sites; untiered:\n  ${offenders.join('\n  ')}`,
    );
  });

  it('every named model is a tier constant, not an inline string literal', () => {
    const subject = SITES.filter(
      (s) =>
        TIERED_ROOTS.some((r) => inRoot(s.file, r.dir)) &&
        !isNonProduct(s.file) &&
        s.model !== null &&
        s.model !== '<shorthand>',
    );
    let examined = 0;
    const offenders: string[] = [];
    for (const site of subject) {
      examined++;
      if (!TIER_CONSTANTS.has(site.model as string)) {
        offenders.push(`${site.file}:${site.line} — \`model: ${site.model}\` is not a MODEL_* constant`);
      }
    }
    assert.ok(examined > 0, 'examined nothing — the subject set was empty');
    assert.deepEqual(
      offenders,
      [],
      `examined ${examined} of ${subject.length}; non-constant models:\n  ${offenders.join('\n  ')}`,
    );
  });
});

// ── INV-2 — an Opus call may not wear a Haiku-tier label ─────────────────────

describe('INV-2: no MODEL_OPUS call site is tagged to a Haiku-tier surface', () => {
  const haikuSurfaces = Object.entries(DEFAULT_ROUTING_POLICY)
    .filter(([, model]) => model === MODEL_HAIKU)
    .map(([surface]) => surface);

  it('the policy table actually has a Haiku tier (the rule is not vacuous)', () => {
    assert.ok(
      haikuSurfaces.length > 0,
      'DEFAULT_ROUTING_POLICY has no Haiku row — INV-2 below would pass vacuously',
    );
    assert.notEqual(MODEL_OPUS, MODEL_HAIKU);
    assert.notEqual(MODEL_SONNET, MODEL_HAIKU);
  });

  it('no call site pairs MODEL_OPUS with a Haiku-tier sourceSurface', () => {
    const tagged = SITES.filter((s) => s.surface !== null);
    let examined = 0;
    const offenders: string[] = [];
    for (const site of tagged) {
      examined++;
      if (site.model === 'MODEL_OPUS' && haikuSurfaces.includes(site.surface as string)) {
        offenders.push(
          `${site.file}:${site.line} — MODEL_OPUS under sourceSurface '${site.surface}' ` +
            `(a ${MODEL_HAIKU} row): the billing rollup files this call under its cheapest tier`,
        );
      }
    }
    assert.ok(examined > 0, 'examined nothing — no call site carries a sourceSurface tag');
    assert.deepEqual(
      offenders,
      [],
      `examined ${examined} of ${tagged.length} tagged call sites against ${haikuSurfaces.length} Haiku surfaces; mis-tagged:\n  ${offenders.join('\n  ')}`,
    );
  });
});

// ── Targeted pins for the two specific surfaces this PR decided ──────────────

describe('decided surfaces stay decided', () => {
  it('lib/portal/chat.ts pins MODEL_OPUS and tags sourceSurface DRAFT', () => {
    const src = readFileSync(join(REPO_ROOT, 'lib', 'portal', 'chat.ts'), 'utf8');
    const sites = parseCallSites('lib/portal/chat.ts', src);
    assert.equal(sites.length, 1, `examined ${sites.length} of 1 expected call site in lib/portal/chat.ts`);
    assert.equal(sites[0].model, 'MODEL_OPUS', 'the end-client-read reply must name its tier');
    assert.equal(
      sites[0].surface,
      'DRAFT',
      'without a sourceSurface this call is unreachable by routing forever',
    );
  });

  it('month-end-close-cpa/polish.ts no longer passes `model: undefined`', () => {
    const rel = join('lib', 'skills', 'month-end-close-cpa', 'polish.ts');
    const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
    const sites = parseCallSites(rel, src);
    assert.equal(sites.length, 1, `examined ${sites.length} of 1 expected call site in ${rel}`);
    assert.notEqual(sites[0].model, 'undefined');
    assert.ok(
      TIER_CONSTANTS.has(sites[0].model as string),
      `expected a MODEL_* constant, got \`${sites[0].model}\``,
    );
  });

  it('the allowlisted untiered site is real and its stated reason matches the code', () => {
    let examined = 0;
    for (const entry of NON_PRODUCT_SITES) {
      examined++;
      const src = readFileSync(join(REPO_ROOT, entry.file), 'utf8');
      const sites = parseCallSites(entry.file, src);
      assert.ok(sites.length > 0, `${entry.file}: allowlisted but has no call site — dead suppression`);
      // The stated reason is checked against the code, not trusted as prose.
      assert.ok(
        /maxTokens:\s*10\b/.test(src),
        `${entry.file}: allowlist reason claims a 10-token probe; the code does not show one`,
      );
    }
    assert.equal(examined, NON_PRODUCT_SITES.length, `examined ${examined} of ${NON_PRODUCT_SITES.length}`);
  });
});
