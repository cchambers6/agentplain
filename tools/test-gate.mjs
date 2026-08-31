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
 * Landing it green mattered as much as landing it. The baseline was 39
 * failures — one was a real disclosure gap and was fixed; the other 38 are
 * listed in tests/quarantine.json, each with a class, a reason, and a shared
 * expiry. A gate that is red the day it lands is a gate people learn to
 * scroll past.
 *
 * Quarantine mechanics:
 *   • Skips are by test NAME, anchored, via node's --test-skip-pattern.
 *     A renamed test un-quarantines itself — the safe default.
 *   • The table is printed on every run. If nobody reads it, it did not work.
 *   • Past `expires` the runner FAILS before running anything. A quarantine
 *     that cannot expire is deletion with extra steps.
 *
 * Usage:
 *   node tools/test-gate.mjs              # gate mode (what CI runs)
 *   node tools/test-gate.mjs --no-skip    # run everything, quarantine included
 *   node tools/test-gate.mjs --list       # print the quarantine table and exit
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const quarantinePath = join(repoRoot, 'tests', 'quarantine.json');

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
// runner only picks up from TSX_TSCONFIG_PATH. Measured: without it 97 of the
// 113 fail; with it, all 113 pass.
//
// This is a plain glob with NO exclusion list and NO new quarantine entries.
// Getting there took two things beyond the glob, both of them real fixes
// rather than suppressions:
//   • `React` imported as a VALUE in each .tsx test — the runner compiles JSX
//     to the classic `React.createElement` factory, so a type-only import
//     throws `ReferenceError: React is not defined` before any assertion.
//   • Two stale assertions in signup-first-value-funnel.test.tsx, which had
//     never once executed. One named /help, a route that does not exist.
//
// A new tests/*.test.tsx file is picked up automatically — no list to update
// and therefore no list to forget.
const TSX_TEST_GLOBS = ['tests/*.test.tsx'];
const TSX_TSCONFIG = 'tests/tsconfig.test.json';

const args = new Set(process.argv.slice(2));
const noSkip = args.has('--no-skip');
const listOnly = args.has('--list');

/** Escape a literal test name for use inside a RegExp alternation. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadQuarantine() {
  const raw = JSON.parse(readFileSync(quarantinePath, 'utf8'));
  if (!Array.isArray(raw.entries)) {
    throw new Error('tests/quarantine.json: missing "entries" array');
  }
  for (const e of raw.entries) {
    for (const field of ['class', 'file', 'test', 'reason']) {
      if (typeof e[field] !== 'string' || e[field].length === 0) {
        throw new Error(
          `tests/quarantine.json: entry ${JSON.stringify(e.test ?? e)} is missing "${field}". ` +
            'Every quarantined test needs a reason — an unexplained skip is how this ' +
            'list rots into a mute button.',
        );
      }
    }
  }
  if (typeof raw.expires !== 'string') {
    throw new Error('tests/quarantine.json: missing top-level "expires" date');
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
  console.log(`▶ Quarantined tests: ${q.entries.length} (expires ${q.expires})`);
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
  if (new Date() > expires) {
    console.error('');
    console.error(`❌ The test quarantine expired on ${quarantine.expires}.`);
    console.error('   Fix the listed tests, or re-date the list with a fresh reason per');
    console.error('   entry. Silently extending it is the failure mode the date prevents.');
    console.error('');
    process.exit(1);
  }
}

/** The loader, the runner, and the quarantine skip pattern — shared by both
 *  passes. The quarantine is anchored by test NAME and applies repo-wide, so
 *  the .tsx pass honours it too. No entry names a .tsx test today; the point
 *  is that a future one must not be silently un-skippable. */
function baseArgs() {
  const a = ['--import', 'tsx', '--test'];
  if (!noSkip && quarantine.entries.length > 0) {
    // One anchored alternation. Anchoring matters: an unanchored fragment
    // would quietly swallow other tests whose names merely contain a
    // quarantined one.
    const pattern = `^(?:${quarantine.entries.map((e) => escapeRegExp(e.test)).join('|')})$`;
    a.push(`--test-skip-pattern=${pattern}`);
  }
  return a;
}

/** Run one pass. Returns its exit status; never throws. */
function runPass(label, globs, extraEnv = {}) {
  console.log(`▶ ${label}`);
  console.log(`  node --import tsx --test ${globs.join(' ')}`);
  console.log('');

  const result = spawnSync(process.execPath, [...baseArgs(), ...globs], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });

  if (result.error) {
    console.error(`❌ Could not start the test runner: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

const mode = noSkip ? 'FULL suite (quarantine ignored)' : 'test gate';

// BOTH passes always run, even when the first one fails. A gate that stops at
// the first red hides the rest of the damage and costs a second round-trip to
// find it.
const tsStatus = runPass(`Running the ${mode} — TypeScript`, TEST_GLOBS);

console.log('');

const tsxStatus = runPass(
  `Running the ${mode} — React components (.tsx, via ${TSX_TSCONFIG})`,
  TSX_TEST_GLOBS,
  { TSX_TSCONFIG_PATH: TSX_TSCONFIG },
);

const status = tsStatus !== 0 ? tsStatus : tsxStatus;

if (status !== 0) {
  console.error('');
  console.error('❌ Test gate failed.');
  if (tsStatus !== 0) console.error('   ↳ the TypeScript pass is red.');
  if (tsxStatus !== 0) console.error('   ↳ the React (.tsx) pass is red.');
  console.error('   A failure here is a NEW break: everything known-broken on');
  console.error(`   ${quarantine.expires.slice(0, 10)}'s baseline is in tests/quarantine.json.`);
  console.error('   Fix it. Quarantining it needs a class, a reason, and a reviewer.');
  console.error('');
}

process.exit(status);
