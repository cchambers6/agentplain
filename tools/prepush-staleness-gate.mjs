#!/usr/bin/env node
// Pre-push staleness gate (Layer 0 of .husky/pre-push).
//
// WHY THIS EXISTS (unchanged since the gate was introduced 2026-05-11):
// stale-base branches keep tripping Vercel preview lint with errors that are
// already fixed on main. The threshold is 5 commits — small enough to catch
// genuinely stale branches (the cases that triggered the rule were 10+
// behind), large enough not to nag on every-day work.
//
// WHY IT IS A SCRIPT AND NOT INLINE SH (2026-09-14):
// the gate used to measure `HEAD..origin/main`. HEAD is whatever the checkout
// happens to be parked on, which on a machine that authors branches in
// separate worktrees or through a temporary GIT_INDEX_FILE is NOT the branch
// being pushed. A checkout sitting 79 commits behind made every correctly
// rebased push fail, and the more correctly a session worked the more surely
// it fired. Git already supplies the right subject: pre-push receives the refs
// being pushed on stdin, one line per ref:
//
//     <local ref> SP <local sha> SP <remote ref> SP <remote sha> LF
//
// So: measure each pushed local sha, never HEAD. Extracted to a file so the
// two cases that matter — a genuinely stale branch is rejected, a correctly
// based branch is accepted — are covered by a test instead of an argument.
// See tests/prepush-staleness-gate.test.ts.
//
// Exit 0 = allow the push. Exit 1 = block it.
// Emergency escape hatch (pre-existing): SKIP_PREPUSH_REBASE_GATE=1 git push ...

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const THRESHOLD = 5;
const ZERO_SHA = /^0+$/;
const UPSTREAM = 'origin/main';

/**
 * Run a git command and return trimmed stdout.
 *
 * Errors are re-thrown with a message built ONLY from our own static string
 * plus the subcommand name. node's execFileSync reconstructs the full command
 * line (and any env-derived argument) into the exception it throws, which is
 * how a minted token reached a transcript on 2026-09-14. Nothing from the
 * original error object — not `message`, not `stderr`, not `cmd` — is
 * propagated here.
 */
function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    if (allowFailure) return null;
    throw new Error(`git ${args[0]} failed (details suppressed to avoid leaking arguments)`);
  }
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  if (process.env.SKIP_PREPUSH_REBASE_GATE === '1') return 0;

  const raw = readStdin();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  // No refs on stdin means git is not handing us a push (manual invocation,
  // or a push that resolved to nothing). Nothing to measure; do not fall back
  // to HEAD — measuring HEAD is the bug this file exists to remove.
  if (lines.length === 0) {
    console.log('i  staleness gate: no refs on stdin — nothing to measure.');
    return 0;
  }

  git(['fetch', 'origin', '--quiet'], { allowFailure: true });

  if (git(['rev-parse', '--verify', '--quiet', UPSTREAM], { allowFailure: true }) === null) {
    console.log(`i  staleness gate: ${UPSTREAM} not found — skipped.`);
    return 0;
  }

  const stale = [];
  let measured = 0;

  for (const line of lines) {
    const [localRef, localSha] = line.split(/\s+/);
    if (!localRef || !localSha) continue;
    if (ZERO_SHA.test(localSha)) continue; // branch deletion — nothing to rebase

    const count = git(['rev-list', '--count', `${localSha}..${UPSTREAM}`], { allowFailure: true });
    if (count === null) continue; // sha not resolvable locally; not our call to block on
    measured += 1;

    const behind = Number.parseInt(count, 10);
    if (Number.isFinite(behind) && behind > THRESHOLD) {
      stale.push({ ref: localRef, sha: localSha.slice(0, 8), behind });
    }
  }

  // An empty measurement is not a pass. If every line was unparseable we have
  // learned nothing, and a gate that cannot fail in the direction that matters
  // is not a gate — say so rather than printing a green line.
  if (measured === 0) {
    console.log('i  staleness gate: no pushable refs resolved — nothing measured.');
    return 0;
  }

  if (stale.length > 0) {
    console.log('');
    for (const s of stale) {
      console.log(`X  Push blocked: ${s.ref} (${s.sha}) is ${s.behind} commits behind ${UPSTREAM}.`);
    }
    console.log('   Rebase before pushing to avoid stale-base CI failures.');
    console.log('   Run:  git fetch origin && git rebase origin/main');
    console.log('   Or to skip this gate (escape hatch): SKIP_PREPUSH_REBASE_GATE=1 git push ...');
    console.log('');
    return 1;
  }

  console.log(`   staleness gate: ${measured} ref(s) measured, all within ${THRESHOLD} commits of ${UPSTREAM}.`);
  return 0;
}

process.exit(main());
