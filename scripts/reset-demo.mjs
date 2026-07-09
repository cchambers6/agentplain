#!/usr/bin/env node
/**
 * scripts/reset-demo.mjs
 *
 * One-liner reset for the Peachtree Realty Demo workspace, for use between
 * discovery calls:
 *
 *   node scripts/reset-demo.mjs
 *
 * Wraps `prisma/seed-demo.ts`, which deletes the demo workspace (slug
 * "peachtree-realty-demo" — nothing else) and re-seeds it from
 * lib/demo/peachtree-dataset.ts. Any cards Conner approved or rejected
 * live on the previous call come back PENDING, timestamps re-anchor to
 * "last night", and the saved-time ledger is rebuilt.
 *
 * Requires the app's normal env (DATABASE_URL, ENCRYPTION_KEY). Add
 * DEMO_SEED_ALLOW_PRODUCTION=peachtree to run against a production DB.
 * Demo script: docs/killer-workflows/RE-lead-triage/01-DEMO-SCRIPT.md
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = join(repoRoot, 'prisma', 'seed-demo.ts');

// `node --import tsx` rather than the tsx bin — resolves cleanly from a
// junctioned node_modules on Windows worktrees.
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', seed],
  { cwd: repoRoot, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
