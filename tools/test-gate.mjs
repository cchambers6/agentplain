#!/usr/bin/env node
/**
 * tools/test-gate.mjs
 *
 * Runs the unit-test suite as a GATE, with an explicit, documented quarantine.
 *
 * WHY THIS EXISTS: as of 2026-08-11 nothing in this repo ran `npm test` —
 * not the pre-push hook, not any GitHub Action. 5,927 tests sat idle while
 * six other gates (lint, brand, voice, connector-dispatch, schema-drift,
 * build) ran on every push. The suite was not failing; it was not being
 * asked. This wraps it so it is asked, on every PR.
 *
 * ── 2026-09-10: a suppression must now NAME the failure it suppresses ──
 *
 * The old design skipped quarantined tests by name, via node's
 * `--test-skip-pattern`. That had a hole big enough to hide a regression in:
 * the entry said, in PROSE, what it was suppressing, and NOTHING checked the
 * prose against reality. A quarantined test that started failing for a
 * completely different reason inherited the old entry's suppression in
 * silence, because a skipped test produces no output to disagree with.
 * Prose cannot go stale loudly.
 *
 * THE FIX IS STRUCTURAL, NOT A NEW RULE: the gate no longer skips anything.
 * It runs every test, collects each result as data, and then adjudicates.
 * Skipping had to go — a skipped test emits no failure, so there is nothing to
 * compare a signature against. Running everything is what makes a substituted
 * failure observable at all.
 *
 * Each entry now carries a required `matches` field: a distinctive substring
 * (or `/regex/`) of the ACTUAL failure output. Then:
 *
 *   fails + output contains `matches`  → suppressed, as before.
 *   fails + output does NOT match      → RED. A different failure is hiding
 *                                        under this entry. Both signatures
 *                                        are printed side by side.
 *   passes + class is not `flaky`      → RED. A suppression over a passing
 *                                        test is dead weight and inflates the
 *                                        apparent size of the real backlog.
 *   never ran / renamed / source-skip  → RED. The entry names nothing.
 *   entry with no `matches`            → RED, before anything runs.
 *
 * COST OF THE CHANGE: the gate's exit status is now its OWN verdict, not
 * node's. node exits non-zero whenever any test fails, and the known-failing
 * tests now actually run. Every place that could turn into a fail-open is
 * closed explicitly and marked FAIL-CLOSED in the code below.
 *
 * Usage:
 *   node tools/test-gate.mjs              # gate mode (what CI runs)
 *   node tools/test-gate.mjs --no-skip    # adjudicate nothing; every failure is red
 *   node tools/test-gate.mjs --list       # print the quarantine table and exit
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const quarantinePath = join(repoRoot, 'tests', 'quarantine.json');

// The reporter must be handed to node as a URL. A bare Windows absolute path
// ('C:\...') is rejected by the ESM loader with ERR_UNSUPPORTED_ESM_URL_SCHEME
// ("Received protocol 'c:'"), which surfaces as a bare exit-7 with no output —
// a gate that runs zero tests and says nothing about it.
const reporterUrl = pathToFileURL(join(repoRoot, 'tools', 'test-gate-reporter.mjs')).href;

const TEST_GLOBS = ['tests/*.test.ts', 'lib/**/*.test.ts'];

// ── The .tsx pass ────────────────────────────────────────────────────────
// `.tsx` was not matched by TEST_GLOBS, so `tests/*.test.tsx` — 14 files and
// 113 tests, including the consumer-path coverage that renders ApprovalCard
// and reads the real `mailto:` href back out of the markup — was run by
// NOTHING. Not by this gate, not by `npm test`, not by CI. The most valuable
// tests in the repo were ungated by a three-character omission in a glob.
//
// They get their own pass rather than another entry in TEST_GLOBS because
// rendering React needs the settings in tests/tsconfig.test.json, which the
// runner only picks up from TSX_TSCONFIG_PATH.
const TSX_TEST_GLOBS = ['tests/*.test.tsx'];
const TSX_TSCONFIG = 'tests/tsconfig.test.json';

const args = new Set(process.argv.slice(2));
const noSkip = args.has('--no-skip');
const listOnly = args.has('--list');

/** The only classes an entry may carry. `flaky` is the one exempt from the
 *  passes-check, because a flaky test passes sometimes by definition. It is
 *  NOT exempt from carrying `matches`. */
const VALID_CLASSES = new Set(['stale-fixture', 'runner-mismatch', 'OPEN-GAP', 'flaky']);

/** A literal `matches` shorter than this is almost certainly not distinctive.
 *  Kept low on purpose: real signatures like `1 !== 0` are legitimately short,
 *  and a floor that rejects them pushes people toward regexes they will get
 *  wrong. This is a tripwire against an accidental catch-all, not a defence
 *  against a determined author — see the note on `matches` strength below. */
const MIN_LITERAL_MATCH = 6;

const repoRootPosix = repoRoot.split(sep).join('/');

/**
 * Make a failure text comparable across machines, checkouts and runs.
 *
 * This is what keeps a `matches` signature from being brittle when the
 * failure output carries volatile content. Three kinds were observed on this
 * suite and each is neutralised here:
 *   • ABSOLUTE PATHS — the checkout root differs between a laptop, one of the
 *     ~230 worktrees, and the CI runner. Replaced with `<repo>`.
 *   • TIMINGS — `duration_ms` and any `123.4ms` in a message. Replaced.
 *   • HASHES / IDS — 12+ hex chars (commit shas, cuids, object ids).
 *     12 is deliberately above 6 so a hex COLOUR like #F5F0E6 survives; the
 *     brand entries match on exactly those.
 * The same normalisation is applied to the literal `matches` value, so the two
 * sides are always compared in the same shape.
 */
function normalizeFailureText(input) {
  let t = String(input ?? '').replace(/\r\n/g, '\n');
  t = t.split(repoRoot).join('<repo>');
  t = t.split(repoRootPosix).join('<repo>');
  t = t.replace(/\b\d+(?:\.\d+)?\s?ms\b/g, '<ms>');
  t = t.replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z\b/g, '<ts>');
  t = t.replace(/\b[0-9a-f]{12,}\b/gi, '<hash>');
  return t;
}

/**
 * Turn an entry's `matches` into a predicate.
 *
 * `/.../flags` is read as a regex; anything else is a literal substring.
 *
 * ON `matches` STRENGTH — stated plainly rather than overclaimed: this stops a
 * DIFFERENT failure from inheriting an entry by accident, which is the whole
 * observed failure mode. It does not stop an author who deliberately writes a
 * signature loose enough to match anything. Two guards make the loose case
 * take effort and show up in review rather than happening by default:
 *   • a literal must be at least MIN_LITERAL_MATCH characters, and
 *   • a regex must NOT match the empty string. `/.*\/`, `/(?:)/` and friends
 *     match every possible failure text, and every one of them also matches
 *     ''. One test rejects the entire family.
 */
function compileMatcher(entry, where) {
  const raw = entry.matches;
  const asRegex = /^\/(.*)\/([dgimsuvy]*)$/s.exec(raw);
  if (asRegex) {
    let re;
    try {
      re = new RegExp(asRegex[1], asRegex[2].replace(/g/g, ''));
    } catch (err) {
      throw new Error(`${where}: "matches" is not a valid regex: ${err.message}`);
    }
    if (re.test('')) {
      throw new Error(
        `${where}: "matches" (${raw}) matches the empty string, so it matches EVERY ` +
          'possible failure. That is a suppression with no signature at all — the exact ' +
          'thing this field exists to prevent. Pin it to something the failure actually says.',
      );
    }
    return { kind: 'regex', display: raw, test: (text) => re.test(text) };
  }
  const literal = normalizeFailureText(raw);
  if (literal.trim().length < MIN_LITERAL_MATCH) {
    throw new Error(
      `${where}: "matches" (${JSON.stringify(raw)}) is only ${literal.trim().length} ` +
        `characters. Needs at least ${MIN_LITERAL_MATCH}, or it will match failures it ` +
        'was never meant to cover. Use a distinctive fragment of the real output.',
    );
  }
  return { kind: 'literal', display: raw, test: (text) => text.includes(literal) };
}

/**
 * Load + validate the quarantine. Every schema problem is collected and
 * reported together: finding them one run at a time is how a list this size
 * becomes nobody's job.
 *
 * FAIL-CLOSED: a malformed entry, a missing `matches`, an unknown class or an
 * un-anchorable signature all fail the gate BEFORE a single test runs. The
 * field cannot be quietly skipped.
 */
function loadQuarantine() {
  const raw = JSON.parse(readFileSync(quarantinePath, 'utf8'));
  if (!Array.isArray(raw.entries)) {
    throw new Error('tests/quarantine.json: missing "entries" array');
  }
  if (typeof raw.expires !== 'string') {
    throw new Error('tests/quarantine.json: missing top-level "expires" date');
  }

  const problems = [];
  const seen = new Map();
  raw.entries.forEach((e, i) => {
    const where = `tests/quarantine.json entry #${i + 1} (${e?.test ?? 'unnamed'})`;
    for (const field of ['class', 'file', 'test', 'reason', 'matches', 'expires']) {
      if (typeof e?.[field] !== 'string' || e[field].length === 0) {
        problems.push(
          `${where}: missing "${field}". Every quarantined test needs a reason, a ` +
            'signature AND its own expiry — an unexplained skip is how this list rots ' +
            'into a mute button, an unsigned one is how a different failure inherits it, ' +
            'and a shared expiry is how 35 suppressions get bulk-extended in one commit ' +
            'instead of reviewed one at a time.',
        );
        return;
      }
    }
    // The per-entry expiry may never exceed the list-wide one. Staggering is a
    // restructuring, not a licence to extend: an entry that moves PAST the date
    // the whole list already had has been weakened, and that is the one thing
    // this file is not allowed to do to itself.
    if (Number.isNaN(Date.parse(e.expires))) {
      problems.push(`${where}: "expires" is not a date: ${e.expires}`);
    } else if (new Date(e.expires) > new Date(raw.expires)) {
      problems.push(
        `${where}: expires ${e.expires}, past the list-wide cap of ${raw.expires}. ` +
          'Per-entry dates may bring a suppression FORWARD, never push it out. ' +
          'Nothing new gets added to quarantine and nothing already here gets a longer leash.',
      );
    }
    if (!VALID_CLASSES.has(e.class)) {
      problems.push(
        `${where}: class "${e.class}" is not one of ${[...VALID_CLASSES].join(', ')}.`,
      );
    }
    try {
      e.__matcher = compileMatcher(e, where);
    } catch (err) {
      problems.push(err.message);
    }
    const key = `${e.file} ${e.test}`;
    if (seen.has(key)) {
      problems.push(`${where}: duplicates entry #${seen.get(key) + 1} — same file and test.`);
    } else {
      seen.set(key, i);
    }
  });

  if (problems.length > 0) {
    console.error('');
    console.error(`❌ tests/quarantine.json is not valid (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`   • ${p}`);
    console.error('');
    process.exit(1);
  }
  return raw;
}

function printTable(q) {
  const byClass = new Map();
  for (const e of q.entries) {
    if (!byClass.has(e.class)) byClass.set(e.class, []);
    byClass.get(e.class).push(e);
  }
  console.log('');
  const dates = [...new Set(q.entries.map((e) => e.expires))].sort();
  console.log(
    `▶ Quarantined tests: ${q.entries.length} across ${dates.length} expiry dates ` +
      `(${dates[0]} → ${dates[dates.length - 1]}, cap ${q.expires})`,
  );
  // OPEN-GAP first — those are real defects, not bookkeeping.
  const order = [...byClass.keys()].sort((a, b) =>
    a === 'OPEN-GAP' ? -1 : b === 'OPEN-GAP' ? 1 : a.localeCompare(b),
  );
  for (const cls of order) {
    const entries = byClass.get(cls);
    const marker = cls === 'OPEN-GAP' ? '🚨' : '  ';
    console.log(`\n${marker} ${cls} (${entries.length})`);
    for (const e of entries) {
      console.log(`     ${e.file}`);
      console.log(`       ⤷ ${e.test}`);
      console.log(`       ⤷ expires: ${e.expires}`);
      console.log(`       ⤷ matches: ${e.matches}`);
      if (cls === 'OPEN-GAP') console.log(`       ⤷ ${e.reason}`);
    }
  }
  console.log('');
  const openGaps = byClass.get('OPEN-GAP') ?? [];
  if (openGaps.length > 0) {
    console.log(
      `  ${openGaps.length} quarantined test(s) are marked OPEN-GAP: the test is right ` +
        `and the code is wrong.\n  Read tests/quarantine.json before adding anything else ` +
        `to that list.`,
    );
    console.log('');
  }
}

const quarantine = loadQuarantine();
printTable(quarantine);

if (listOnly) process.exit(0);

// Expiry check runs BEFORE the suite: an expired quarantine is a gate failure
// on its own, and finding that out after a 7-minute run helps nobody.
if (!noSkip) {
  const expires = new Date(quarantine.expires);
  if (Number.isNaN(expires.getTime())) {
    console.error(`❌ tests/quarantine.json "expires" is not a date: ${quarantine.expires}`);
    process.exit(1);
  }
  const now = new Date();
  if (now > expires) {
    console.error('');
    console.error(`❌ The test quarantine cap expired on ${quarantine.expires}.`);
    console.error('   Fix the listed tests, or re-date the list with a fresh reason per');
    console.error('   entry. Silently extending it is the failure mode the date prevents.');
    console.error('');
    process.exit(1);
  }

  // PER-ENTRY expiry. The point of staggering is that these fire on different
  // days, so the list comes back a few entries at a time and gets read, rather
  // than arriving all at once as a wall that gets re-dated in one commit.
  const M = quarantine.entries.length;
  if (M === 0) {
    console.error('❌ tests/quarantine.json has no entries — examined 0 of 0 expiries.');
    console.error('   An empty list is either a deleted file or a mistake; say which.');
    process.exit(1);
  }
  const lapsed = quarantine.entries.filter((e) => now > new Date(e.expires));
  console.log(`▶ Quarantine expiry: examined ${M} of ${M} entries, ${lapsed.length} lapsed.`);
  if (lapsed.length > 0) {
    console.error('');
    console.error(`❌ ${lapsed.length} of ${M} quarantine entries are past their own expiry:`);
    for (const e of lapsed) {
      console.error(`   • ${e.expires}  ${e.file}`);
      console.error(`       ⤷ ${e.test}`);
    }
    console.error('');
    console.error('   Fix these, or re-justify each one individually with a fresh reason.');
    console.error('   A per-entry date exists so this arrives in readable batches. Moving');
    console.error('   them all to one later date rebuilds the cliff this replaced, and the');
    console.error(`   cap (${quarantine.expires}) will refuse anything past it.`);
    console.error('');
    process.exit(1);
  }
}

const scratch = mkdtempSync(join(tmpdir(), 'test-gate-'));

/**
 * Run one pass. Two reporters: `spec` to the terminal so a human sees the same
 * output as before, and the NDJSON reporter to a file so the gate can
 * adjudicate on data rather than on scraped text.
 *
 * Returns { status, results, parseErrors, ndjsonMissing }.
 */
function runPass(slug, label, globs, extraEnv = {}) {
  // `slug`, never `label`: the human label contains spaces, a comma, an em dash
  // and a path separator ("(.tsx, via tests/tsconfig.test.json)"). Using it as a
  // filename produced an unwritable path, the reporter wrote nothing, and the
  // pass looked empty. FAIL-CLOSED #1 below caught it rather than calling the
  // run green — which is the whole point of that check.
  const ndjsonPath = join(scratch, `${slug}.ndjson`);
  console.log(`▶ ${label}`);
  console.log(`  node --import tsx --test ${globs.join(' ')}`);
  console.log('');

  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      `--test-reporter=${reporterUrl}`,
      `--test-reporter-destination=${ndjsonPath}`,
      ...globs,
    ],
    { cwd: repoRoot, stdio: 'inherit', env: { ...process.env, ...extraEnv } },
  );

  if (result.error) {
    console.error(`❌ Could not start the test runner: ${result.error.message}`);
    return { status: 1, results: [], parseErrors: 0, ndjsonMissing: true };
  }
  if (!existsSync(ndjsonPath)) {
    return { status: result.status ?? 1, results: [], parseErrors: 0, ndjsonMissing: true };
  }

  const results = [];
  let parseErrors = 0;
  for (const line of readFileSync(ndjsonPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      results.push(JSON.parse(line));
    } catch {
      parseErrors += 1;
    }
  }
  return { status: result.status ?? 1, results, parseErrors, ndjsonMissing: false };
}

const mode = noSkip ? 'FULL suite (quarantine ignored)' : 'test gate';

// BOTH passes always run, even when the first one fails. A gate that stops at
// the first red hides the rest of the damage and costs a second round-trip to
// find it.
const tsPass = runPass('ts', `Running the ${mode} — TypeScript`, TEST_GLOBS);
console.log('');
const tsxPass = runPass(
  'tsx',
  `Running the ${mode} — React components (.tsx, via ${TSX_TSCONFIG})`,
  TSX_TEST_GLOBS,
  { TSX_TSCONFIG_PATH: TSX_TSCONFIG },
);

rmSync(scratch, { recursive: true, force: true });

const passes = [
  { label: 'TypeScript', ...tsPass },
  { label: 'React (.tsx)', ...tsxPass },
];

const hardFailures = [];

// FAIL-CLOSED #1 — a pass that produced no machine-readable results at all.
// This is the `assert.deepEqual(x, [])` hazard in gate form: with no results,
// every entry below would be "not observed" and every unquarantined failure
// would be invisible. A silent reporter must never read as a clean run.
for (const p of passes) {
  if (p.ndjsonMissing) {
    hardFailures.push(
      `the ${p.label} pass produced no reporter output at all. The gate cannot ` +
        'tell a green suite from a suite that never ran, so it refuses to call this green.',
    );
  } else if (p.results.length === 0) {
    hardFailures.push(
      `the ${p.label} pass reported ZERO test results. Either the globs matched no ` +
        'files or collection threw before the first test. Both are gate failures.',
    );
  }
  if (p.parseErrors > 0) {
    hardFailures.push(
      `the ${p.label} pass emitted ${p.parseErrors} unparseable reporter line(s). ` +
        'Partial result data cannot be adjudicated safely.',
    );
  }
}

/** Repo-relative, forward-slashed — the shape quarantine.json uses. */
function relFile(abs) {
  if (!abs) return '';
  return relative(repoRoot, abs).split(sep).join('/');
}

/** Index every observed result by "<file>::<test name>". Suite-level rollups
 *  (`failureType === 'suite'`, message "N subtests failed") are dropped: they
 *  are an aggregate of their children, not a failure of their own, and
 *  counting them would demand a quarantine entry per parent describe block. */
const observed = new Map();
const allResults = [];
for (const p of passes) {
  for (const r of p.results) {
    if (r.failureType === 'suite') continue;
    allResults.push(r);
    const key = `${relFile(r.file)}::${r.name}`;
    if (!observed.has(key)) observed.set(key, []);
    observed.get(key).push(r);
  }
}

const verdicts = [];
let examined = 0;

for (const e of quarantine.entries) {
  const key = `${e.file}::${e.test}`;
  const hits = observed.get(key) ?? [];
  const ran = hits.filter((h) => !h.skip && !h.todo);

  if (ran.length === 0) {
    // The entry names nothing this run: renamed test, deleted test, a file
    // that died during collection, or a test skipped at source. All four mean
    // the suppression is not doing what it claims.
    verdicts.push({
      entry: e,
      state: hits.length > 0 ? 'SOURCE-SKIPPED' : 'NOT-OBSERVED',
      ok: false,
    });
    continue;
  }

  examined += 1;
  const failed = ran.filter((h) => h.outcome === 'fail');

  if (failed.length === 0) {
    // Passing. `flaky` is the one class allowed to do that.
    verdicts.push({ entry: e, state: 'PASSING', ok: e.class === 'flaky' });
    continue;
  }

  // Every failing occurrence must carry the documented signature.
  const unmatched = failed.filter(
    (h) => !e.__matcher.test(normalizeFailureText(`${h.errName}: ${h.errMessage}`)),
  );
  if (unmatched.length === 0) {
    verdicts.push({ entry: e, state: 'SUPPRESSED', ok: true });
  } else {
    verdicts.push({ entry: e, state: 'SUBSTITUTED', ok: false, actual: unmatched[0] });
  }
}

/** Failures with no entry at all — the classic "new break".
 *  SUBSTITUTED failures are excluded here only because they are reported in
 *  full, with both signatures, in their own section below; they are still red. */
const explainedKeys = new Set(
  verdicts
    .filter((v) => v.state === 'SUPPRESSED' || v.state === 'SUBSTITUTED')
    .map((v) => `${v.entry.file}::${v.entry.test}`),
);
const newBreaks = allResults.filter(
  (r) => r.outcome === 'fail' && !explainedKeys.has(`${relFile(r.file)}::${r.name}`),
);

// ── Report ───────────────────────────────────────────────────────────────
const M = quarantine.entries.length;
console.log('');
console.log('─'.repeat(74));
console.log(`▶ Quarantine adjudication: examined ${examined} of ${M} entries`);
console.log(
  `  (${allResults.length} test results collected across ${passes.length} passes)`,
);
console.log('─'.repeat(74));

// FAIL-CLOSED #2 — the recorded hazard: `assert.deepEqual(x, [])` passes green
// on an empty input set. An adjudication that examined nothing is not a pass.
if (!noSkip && M > 0 && examined === 0) {
  hardFailures.push(
    `examined 0 of ${M} quarantine entries. The list describes tests the runner never ` +
      'reported on, so NOTHING was actually checked. A gate that checks nothing must ' +
      'not report green.',
  );
}

const counts = {};
for (const v of verdicts) counts[v.state] = (counts[v.state] || 0) + 1;
for (const [state, n] of Object.entries(counts)) {
  console.log(`   ${state.padEnd(15)} ${n}`);
}
console.log('');

/** Trim a failure signature to something readable in CI logs. */
function preview(text, limit = 400) {
  const t = normalizeFailureText(text).trim();
  return t.length > limit ? `${t.slice(0, limit)}\n        …(truncated)` : t;
}

const substituted = verdicts.filter((v) => v.state === 'SUBSTITUTED');
const deadEntries = verdicts.filter((v) => v.state === 'PASSING' && !v.ok);
const missingEntries = verdicts.filter(
  (v) => v.state === 'NOT-OBSERVED' || v.state === 'SOURCE-SKIPPED',
);

if (substituted.length > 0) {
  console.error('❌ SUBSTITUTED FAILURE — a different failure is hiding under a suppression.');
  console.error('');
  for (const v of substituted) {
    console.error(`   ${v.entry.file}`);
    console.error(`     ⤷ ${v.entry.test}`);
    console.error(`     ⤷ class: ${v.entry.class}`);
    console.error('');
    console.error(`     DOCUMENTED signature (quarantine "matches"):`);
    console.error(`        ${v.entry.matches}`);
    console.error(`     DOCUMENTED reason:`);
    console.error(`        ${v.entry.reason}`);
    console.error(`     ACTUAL failure now:`);
    console.error(`        ${preview(`${v.actual.errName}: ${v.actual.errMessage}`)}`);
    console.error('');
    console.error(
      '     This test still fails, but NOT for the documented reason. Do not widen',
      '\n     "matches" to make this green — that is how the regression stays hidden.',
      '\n     Fix the new failure, or write a NEW entry that describes it honestly.',
    );
    console.error('');
  }
}

if (deadEntries.length > 0) {
  console.error('❌ DEAD SUPPRESSION — a quarantined test is PASSING.');
  console.error('');
  for (const v of deadEntries) {
    console.error(`   ${v.entry.file}`);
    console.error(`     ⤷ ${v.entry.test}`);
    console.error(`     ⤷ reason on file: ${v.entry.reason}`);
    console.error('');
  }
  console.error(
    '   Delete these entries. A suppression over a passing test is dead weight, and',
    '\n   it also inflates the apparent size of the real backlog — which is how a list',
    '\n   of 37 stops being read at all. (Use class "flaky" only for a test that is',
    '\n   genuinely non-deterministic; that class is exempt from this check.)',
  );
  console.error('');
}

if (missingEntries.length > 0) {
  console.error('❌ ENTRY NAMES NOTHING — quarantined test never reported a result.');
  console.error('');
  for (const v of missingEntries) {
    console.error(`   ${v.entry.file}`);
    console.error(`     ⤷ ${v.entry.test}`);
    console.error(`     ⤷ ${v.state}`);
    console.error('');
  }
  console.error(
    '   The test was renamed or deleted, was skipped at source, or its FILE failed',
    '\n   during collection so no test inside it ran. All four make the entry a lie.',
    '\n   Note the last one is deliberate and fail-closed: an import-time break cannot',
    '\n   hide behind a per-test suppression, because a test that never ran cannot',
    '\n   match a signature.',
  );
  console.error('');
}

if (newBreaks.length > 0) {
  console.error(`❌ ${newBreaks.length} failing test(s) with no quarantine entry:`);
  console.error('');
  for (const r of newBreaks.slice(0, 40)) {
    console.error(`   ${relFile(r.file)}`);
    console.error(`     ⤷ ${r.name}`);
    console.error(`     ⤷ ${preview(`${r.errName}: ${r.errMessage}`, 240)}`);
    console.error('');
  }
  if (newBreaks.length > 40) {
    console.error(`   …and ${newBreaks.length - 40} more.`);
    console.error('');
  }
  console.error(
    '   To quarantine one, add an entry with a class, a reason, and a "matches"',
    '\n   signature copied from the ACTUAL output above — not from your description',
    '\n   of it. One field beyond what you already had to write.',
  );
  console.error('');
}

for (const h of hardFailures) {
  console.error(`❌ INSTRUMENT FAILURE: ${h}`);
  console.error('');
}

// FAIL-CLOSED #3 — node said something went wrong, but nothing we can name did.
// Without this, a runner that crashed after reporting only passing tests would
// leave every list above empty and the gate would call that green.
for (const p of passes) {
  if (p.status !== 0 && newBreaks.length === 0 && substituted.length === 0) {
    const explained = verdicts.some((v) => v.state === 'SUPPRESSED');
    if (!explained) {
      hardFailures.push(
        `the ${p.label} pass exited ${p.status} but no individual test failure was ` +
          'reported. The runner died outside a test — treated as red, never as green.',
      );
      console.error(
        `❌ INSTRUMENT FAILURE: ${p.label} exited ${p.status} with no attributable failure.`,
      );
      console.error('');
    }
  }
}

const red =
  hardFailures.length > 0 ||
  newBreaks.length > 0 ||
  substituted.length > 0 ||
  deadEntries.length > 0 ||
  missingEntries.length > 0;

if (red) {
  console.error('');
  console.error('❌ Test gate failed.');
  if (substituted.length > 0) {
    console.error(`   ↳ ${substituted.length} substituted failure(s) under a suppression.`);
  }
  if (deadEntries.length > 0) {
    console.error(`   ↳ ${deadEntries.length} suppression(s) over a now-passing test.`);
  }
  if (missingEntries.length > 0) {
    console.error(`   ↳ ${missingEntries.length} entr(ies) naming a test that never ran.`);
  }
  if (newBreaks.length > 0) {
    console.error(`   ↳ ${newBreaks.length} failing test(s) with no entry — a NEW break.`);
  }
  if (hardFailures.length > 0) {
    console.error(`   ↳ ${hardFailures.length} instrument failure(s); the run is untrustworthy.`);
  }
  console.error(`   ↳ examined ${examined} of ${M} quarantine entries.`);
  console.error('   Everything known-broken on this list is in tests/quarantine.json,');
  console.error('   and every entry there now names the failure it suppresses.');
  console.error('');
  process.exit(1);
}

console.log(`✅ Test gate passed — examined ${examined} of ${M} quarantine entries,`);
console.log(`   ${allResults.length} test results, ${newBreaks.length} unexplained failures.`);
console.log('');
process.exit(0);
