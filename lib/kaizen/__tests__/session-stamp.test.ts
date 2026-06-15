/**
 * lib/kaizen/__tests__/session-stamp.test.ts
 *
 * Tests the INBOX-writer hook. Payload builders are tested directly (pure); the
 * write functions are tested against a throwaway temp directory so we never
 * touch the real memory/inbox.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  buildSessionCostPayload,
  buildCvBarPayload,
  stampSessionCost,
  stampCvBarScore,
  type SessionCostStamp,
} from '../session-stamp.js';

const tmpDirs: string[] = [];
function tmpInbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-inbox-'));
  tmpDirs.push(dir);
  return dir;
}

after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const FIXED_NOW = new Date('2026-06-15T09:30:00Z');

const baseStamp: SessionCostStamp = {
  session_id: 'local_abcd1234-0000',
  title: 'Tier-3 kaizen retro loop',
  model: 'claude-opus-4-8',
  model_context_size: '200k',
  started_at: '2026-06-15T08:00:00Z',
  completed_at: '2026-06-15T09:25:00Z',
  tokens_in: 800_000,
  tokens_out: 100_000,
  outcome: 'delivered',
  tier: 3,
  pr_number: 271,
};

describe('buildSessionCostPayload', () => {
  it('recomputes estimated cost from token counts when omitted', () => {
    // 0.8M in * $5 + 0.1M out * $25 = $4 + $2.5 = $6.50
    const payload = buildSessionCostPayload(baseStamp);
    assert.equal(payload.type, 'session-cost');
    assert.equal(payload.target, 'session-costs.yaml');
    assert.equal(payload.session_cost.estimated_cost_usd, 6.5);
    assert.equal(payload.cost_unpriced, undefined);
    assert.equal(payload.session_cost.pr_number, 271);
  });

  it('preserves a caller-provided cost', () => {
    const payload = buildSessionCostPayload({ ...baseStamp, estimated_cost_usd: 12 });
    assert.equal(payload.session_cost.estimated_cost_usd, 12);
  });

  it('flags an unpriced model and defaults cost to 0', () => {
    const payload = buildSessionCostPayload({ ...baseStamp, model: 'claude-mystery-9' });
    assert.equal(payload.cost_unpriced, true);
    assert.equal(payload.session_cost.estimated_cost_usd, 0);
  });

  it('omits optional fields that were not provided', () => {
    const { pr_number, ...noPr } = baseStamp;
    const payload = buildSessionCostPayload(noPr);
    assert.equal('pr_number' in payload.session_cost, false);
  });
});

describe('buildCvBarPayload', () => {
  it('builds a valid cv-bar payload and defaults scored_at to now', () => {
    const payload = buildCvBarPayload(
      {
        pr_number: 271,
        pr_title: 'feat(kaizen): weekly retro loop',
        session_id: 'local_abcd1234-0000',
        model: 'claude-opus-4-8',
        self_score: 4,
        persona: 'fleet operator',
        reasoning: 'self-improvement loop closes',
      },
      FIXED_NOW,
    );
    assert.equal(payload.type, 'cv-bar-score');
    assert.equal(payload.cv_bar_score.scored_at, FIXED_NOW.toISOString());
    assert.equal(payload.cv_bar_score.self_score, 4);
  });

  it('rejects an out-of-range score', () => {
    assert.throws(
      () =>
        buildCvBarPayload(
          {
            pr_number: 1,
            pr_title: 'x',
            session_id: 's',
            model: 'claude-opus-4-8',
            self_score: 7,
            persona: 'p',
            reasoning: 'r',
          },
          FIXED_NOW,
        ),
      /self_score must be 1–5/,
    );
  });
});

describe('stampSessionCost (writes to temp inbox)', () => {
  it('writes a parseable YAML payload to the inbox', async () => {
    const dir = tmpInbox();
    const file = await stampSessionCost(baseStamp, { inboxDir: dir, now: FIXED_NOW });
    assert.ok(fs.existsSync(file));
    assert.match(path.basename(file), /^20260615-093000-session-cost-/);
    const parsed = yaml.load(fs.readFileSync(file, 'utf-8')) as ReturnType<
      typeof buildSessionCostPayload
    >;
    assert.equal(parsed.type, 'session-cost');
    assert.equal(parsed.session_cost.session_id, baseStamp.session_id);
    assert.equal(parsed.session_cost.estimated_cost_usd, 6.5);
  });
});

describe('stampCvBarScore (writes to temp inbox)', () => {
  it('writes a parseable cv-bar payload to the inbox', async () => {
    const dir = tmpInbox();
    const file = await stampCvBarScore(
      {
        pr_number: 271,
        pr_title: 'feat(kaizen): weekly retro loop',
        session_id: 'local_abcd1234-0000',
        model: 'claude-opus-4-8',
        self_score: 5,
        persona: 'fleet operator',
        reasoning: 'closes the self-improvement loop',
      },
      { inboxDir: dir, now: FIXED_NOW },
    );
    const parsed = yaml.load(fs.readFileSync(file, 'utf-8')) as ReturnType<
      typeof buildCvBarPayload
    >;
    assert.equal(parsed.type, 'cv-bar-score');
    assert.equal(parsed.cv_bar_score.pr_number, 271);
    assert.equal(parsed.cv_bar_score.self_score, 5);
  });
});
