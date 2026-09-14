// Regression cases for tools/prepush-staleness-gate.mjs (Layer 0 of .husky/pre-push).
//
// The gate's whole job is a discrimination, so both sides are planted here
// against a real synthetic repository rather than argued about:
//
//   1. a genuinely stale branch (10 behind origin/main) is REJECTED
//   2. a correctly based branch (0 behind) is ACCEPTED
//   3. case 2 still passes while the checkout's HEAD is parked on the stale
//      branch — that is the exact failure this gate had until 2026-09-14,
//      when it measured HEAD instead of the refs git hands it on stdin
//   4. a branch exactly at the threshold (5 behind) is ACCEPTED — the rule is
//      `> 5`, and a silent drift of the threshold would be invisible otherwise
//   5. a branch deletion (all-zero local sha) is ACCEPTED — nothing to rebase
//   6. empty stdin does not fall back to HEAD

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const GATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'prepush-staleness-gate.mjs');
const ZERO = '0'.repeat(40);

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function commit(cwd: string, n: number): void {
  writeFileSync(path.join(cwd, `f${n}.txt`), `${n}\n`);
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-m', `c${n}`]);
}

/** Build an origin + working clone with a stale branch, an at-threshold branch and a fresh branch. */
function buildFixture(): { work: string; root: string; shas: Record<string, string> } {
  const root = mkdtempSync(path.join(tmpdir(), 'zzh-prepush-'));
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');

  execFileSync('git', ['init', '--bare', '--initial-branch=main', origin], { stdio: 'ignore' });
  execFileSync('git', ['clone', origin, work], { stdio: 'ignore' });
  git(work, ['config', 'user.email', 'gate-test@example.invalid']);
  git(work, ['config', 'user.name', 'gate test']);
  git(work, ['config', 'commit.gpgsign', 'false']);

  commit(work, 0);
  git(work, ['push', '-u', '--no-verify', 'origin', 'main']);

  // A branch cut here and left alone becomes the stale one.
  git(work, ['branch', 'stale']);

  // Advance main by exactly 5, cut the at-threshold branch, then advance to 10.
  for (let i = 1; i <= 5; i += 1) commit(work, i);
  git(work, ['branch', 'threshold']);
  for (let i = 6; i <= 10; i += 1) commit(work, i);
  git(work, ['push', '--no-verify', 'origin', 'main']);
  git(work, ['fetch', 'origin', '--quiet']);

  // Fresh branch: based on current origin/main, which is what a correctly
  // working session produces.
  git(work, ['branch', 'fresh', 'origin/main']);

  return {
    root,
    work,
    shas: {
      stale: git(work, ['rev-parse', 'stale']),
      threshold: git(work, ['rev-parse', 'threshold']),
      fresh: git(work, ['rev-parse', 'fresh']),
    },
  };
}

function runGate(work: string, stdin: string): { code: number; out: string } {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: work,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, SKIP_PREPUSH_REBASE_GATE: '0' },
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function pushLine(ref: string, sha: string): string {
  return `refs/heads/${ref} ${sha} refs/heads/${ref} ${ZERO}\n`;
}

test('pre-push staleness gate', async (t) => {
  const fx = buildFixture();
  let examined = 0;

  try {
    await t.test('rejects a genuinely stale branch (10 behind)', () => {
      examined += 1;
      const r = runGate(fx.work, pushLine('stale', fx.shas.stale));
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /10 commits behind origin\/main/);
    });

    await t.test('accepts a correctly based branch (0 behind)', () => {
      examined += 1;
      const r = runGate(fx.work, pushLine('fresh', fx.shas.fresh));
      assert.equal(r.code, 0, r.out);
    });

    await t.test('accepts the fresh branch while HEAD is parked on the stale one', () => {
      examined += 1;
      git(fx.work, ['checkout', '--quiet', 'stale']);
      const behindHead = Number(git(fx.work, ['rev-list', '--count', 'HEAD..origin/main']));
      assert.ok(behindHead > 5, `fixture precondition: HEAD should be stale, was ${behindHead} behind`);

      const r = runGate(fx.work, pushLine('fresh', fx.shas.fresh));
      assert.equal(r.code, 0, `the gate measured HEAD instead of the pushed ref:\n${r.out}`);
    });

    await t.test('accepts a branch exactly at the threshold (5 behind)', () => {
      examined += 1;
      const r = runGate(fx.work, pushLine('threshold', fx.shas.threshold));
      assert.equal(r.code, 0, r.out);
    });

    await t.test('accepts a branch deletion (all-zero local sha)', () => {
      examined += 1;
      const r = runGate(fx.work, `refs/heads/stale ${ZERO} refs/heads/stale ${fx.shas.stale}\n`);
      assert.equal(r.code, 0, r.out);
    });

    await t.test('does not fall back to HEAD when stdin is empty', () => {
      examined += 1;
      const r = runGate(fx.work, '');
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /no refs on stdin/);
    });

    await t.test('blocks the stale ref when a push carries both', () => {
      examined += 1;
      const r = runGate(fx.work, pushLine('fresh', fx.shas.fresh) + pushLine('stale', fx.shas.stale));
      assert.equal(r.code, 1, r.out);
    });

    await t.test('examined every planted case', () => {
      assert.equal(examined, 7, `expected 7 planted cases, ran ${examined}`);
    });
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
