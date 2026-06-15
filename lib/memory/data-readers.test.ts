/**
 * lib/memory/data-readers.test.ts
 *
 * Verifies each reader on the actual YAML files in memory/data/.
 * Tests run against the scaffolded empty-but-typed files — all readers must
 * handle null/missing arrays gracefully and return empty arrays.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  readSessionCosts,
  readCvBarScores,
  readCalibration,
  readConnerQueue,
  readBudgetState,
  canSpend,
  type SessionCost,
  type CvBarScore,
} from './data-readers.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'memory', 'data');

function dataPath(name: string): string {
  return path.join(DATA_DIR, name);
}

function backupPath(name: string): string {
  return path.join(DATA_DIR, `${name}.bak`);
}

const FILES = [
  'session-costs.yaml',
  'cv-bar-scores.yaml',
  'calibration.yaml',
  'conner-queue.yaml',
  'budget-state.yaml',
];

// Back up originals before mutating, restore after.
before(() => {
  for (const f of FILES) {
    fs.copyFileSync(dataPath(f), backupPath(f));
  }
});

after(() => {
  for (const f of FILES) {
    fs.copyFileSync(backupPath(f), dataPath(f));
    fs.unlinkSync(backupPath(f));
  }
});

function writeYaml(filename: string, data: unknown): void {
  fs.writeFileSync(dataPath(filename), yaml.dump(data), 'utf-8');
}

// ─── Empty files ───────────────────────────────────────────────────────────

describe('readSessionCosts — empty file', () => {
  it('returns empty array when sessions is null', async () => {
    const costs = await readSessionCosts();
    assert.deepEqual(costs, []);
  });

  it('returns empty array with since filter on empty file', async () => {
    const costs = await readSessionCosts({ since: new Date('2026-01-01') });
    assert.deepEqual(costs, []);
  });

  it('returns empty array with tier filter on empty file', async () => {
    const costs = await readSessionCosts({ tier: 3 });
    assert.deepEqual(costs, []);
  });
});

describe('readCvBarScores — empty file', () => {
  it('returns empty array when scores is null', async () => {
    const scores = await readCvBarScores();
    assert.deepEqual(scores, []);
  });
});

describe('readCalibration — empty file', () => {
  it('returns typed object with empty arrays', async () => {
    const cal = await readCalibration();
    assert.equal(cal.schema_version, 1);
    assert.equal(cal.last_rollup_at, null);
    assert.deepEqual(cal.prompt_patterns, []);
    assert.deepEqual(cal.model_routing, []);
    assert.deepEqual(cal.known_waste_patterns, []);
  });
});

describe('readConnerQueue — empty file', () => {
  it('returns empty array when pending is null', async () => {
    const items = await readConnerQueue();
    assert.deepEqual(items, []);
  });
});

describe('readBudgetState — empty file', () => {
  it('returns typed budget state with zero spend', async () => {
    const state = await readBudgetState();
    assert.equal(state.schema_version, 1);
    assert.equal(state.current_week.total_spent_usd, 0);
    assert.equal(state.current_week.tier_1_continuous.cap_usd, 70);
    assert.deepEqual(state.historical_weeks, []);
  });
});

// ─── Populated files ────────────────────────────────────────────────────────

describe('readSessionCosts — populated', () => {
  const sample: SessionCost = {
    session_id: 'local_aabbccdd-0000-0000-0000-000000000001',
    title: 'Block A test session',
    model: 'claude-opus-4-8',
    model_context_size: '200k',
    started_at: '2026-06-12T17:00:00Z',
    completed_at: '2026-06-12T17:54:00Z',
    tokens_in: 850000,
    tokens_out: 120000,
    estimated_cost_usd: 18.5,
    outcome: 'delivered',
    pr_number: 239,
    pr_url: 'https://github.com/cchambers6/agentplain/pull/239',
    tier: 3,
    notes: '',
  };

  before(() => {
    writeYaml('session-costs.yaml', { schema_version: 1, sessions: [sample] });
  });

  it('returns the session', async () => {
    const costs = await readSessionCosts();
    assert.equal(costs.length, 1);
    assert.equal(costs[0].session_id, sample.session_id);
    assert.equal(costs[0].estimated_cost_usd, 18.5);
  });

  it('filters by tier', async () => {
    const tier3 = await readSessionCosts({ tier: 3 });
    assert.equal(tier3.length, 1);
    const tier2 = await readSessionCosts({ tier: 2 });
    assert.equal(tier2.length, 0);
  });

  it('filters by since', async () => {
    const after = await readSessionCosts({ since: new Date('2026-06-01') });
    assert.equal(after.length, 1);
    const future = await readSessionCosts({ since: new Date('2026-12-01') });
    assert.equal(future.length, 0);
  });
});

describe('readCvBarScores — populated', () => {
  const sample: CvBarScore = {
    pr_number: 239,
    pr_title: 'fix(reliability): silent-fail-loud hardening',
    session_id: 'local_cf0e9e2c-392f-4cc1-9ba7-40345eefbcb9',
    model: 'claude-opus-4-8',
    self_score: 4,
    persona: 'SMB owner first 30 days',
    reasoning: 'Customer-trust hardening lands clean.',
    scored_at: '2026-06-12T17:54:00Z',
  };

  before(() => {
    writeYaml('cv-bar-scores.yaml', { schema_version: 1, scores: [sample] });
  });

  it('returns the score', async () => {
    const scores = await readCvBarScores();
    assert.equal(scores.length, 1);
    assert.equal(scores[0].self_score, 4);
  });

  it('filters by minScore', async () => {
    const high = await readCvBarScores({ minScore: 4 });
    assert.equal(high.length, 1);
    const veryHigh = await readCvBarScores({ minScore: 5 });
    assert.equal(veryHigh.length, 0);
  });

  it('limits by lastN', async () => {
    const one = await readCvBarScores({ lastN: 1 });
    assert.equal(one.length, 1);
  });
});

describe('readConnerQueue — populated', () => {
  before(() => {
    writeYaml('conner-queue.yaml', {
      schema_version: 1,
      pending: [
        {
          id: 'conner-2026-06-14-001',
          title: 'Restore ANTHROPIC_API_KEY in Vercel Production',
          raised_at: '2026-06-14T16:27:00Z',
          raised_by: 'dispatch-main',
          source: 'Conner-dead simulation #236',
          recommended_default: 'Keep paused — policy',
          priority: 'low',
          age_days: 1,
          estimated_conner_time_min: 5,
          blocks: [],
        },
      ],
      resolved: [],
    });
  });

  it('returns pending items', async () => {
    const items = await readConnerQueue();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'conner-2026-06-14-001');
  });

  it('filters by priority', async () => {
    const low = await readConnerQueue({ priority: 'low' });
    assert.equal(low.length, 1);
    const blocker = await readConnerQueue({ priority: 'blocker' });
    assert.equal(blocker.length, 0);
  });
});

// ─── canSpend helper ────────────────────────────────────────────────────────

describe('canSpend', () => {
  it('returns ok=true when tier has remaining budget', async () => {
    const result = await canSpend(1, 10);
    assert.equal(result.ok, true);
  });

  it('returns ok=false when estimated cost exceeds remaining', async () => {
    // tier_1_continuous has cap=70, spent=0, remaining=70
    const result = await canSpend(1, 71);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes('cap exceeded'));
  });

  it('returns ok=false for unknown tier', async () => {
    const result = await canSpend(99, 10);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes('Unknown tier'));
  });

  it('returns ok=false for tier 5 when not activated', async () => {
    const result = await canSpend(5, 1000);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes('not activated'));
  });
});
