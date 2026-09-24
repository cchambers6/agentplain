import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyJob, JOB_CLASSES, type JobDemand } from './job-classes';
import {
  ACTIVE_POLICY,
  POLICY_CURRENT,
  POLICY_PROPOSED,
  routeFor,
  HAIKU_4_5,
  SONNET_5,
  OPUS_5,
  FABLE_5_1,
} from './policy';
import { MODEL_OPUS, MODEL_SONNET, MODEL_HAIKU } from '../model-tiers';

// ── The seam must be a no-op on merge ────────────────────────────────────────
//
// This PR is a proposal. If merging it changed which model production calls,
// the proposal would have ratified itself.

test('ACTIVE_POLICY is CURRENT — merging this changes no model', () => {
  assert.equal(ACTIVE_POLICY, POLICY_CURRENT);
});

test('the back-compat constants still resolve to exactly the pinned ids', () => {
  // Byte-for-byte what origin/main had before the seam existed.
  assert.equal(MODEL_OPUS, 'claude-opus-4-7');
  assert.equal(MODEL_SONNET, 'claude-sonnet-4-6');
  assert.equal(MODEL_HAIKU, 'claude-haiku-4-5-20251001');
});

// ── The classifier must be mechanical ────────────────────────────────────────
//
// The bar set for this scheme: hand it a workload nobody has seen and get a
// class out without an opinion. These are workloads that exist in the repo.

const demand = (d: JobDemand) => d;

test('inbox triage — the answer is in the input', () => {
  assert.equal(
    classifyJob(demand({ consequence: 'C0', reasoning: 'R0', context: 'X0', latency: 'L1' })),
    'TRIAGE',
  );
});

test('memory extraction — retrieval, reviewed by a human', () => {
  assert.equal(
    classifyJob(demand({ consequence: 'C1', reasoning: 'R0', context: 'X1', latency: 'L2' })),
    'TRIAGE',
  );
});

test('a customer-read summary is never TRIAGE, however easy the task', () => {
  // The trap the old tier names set: "it's just a summary" routes on difficulty
  // and ignores that the customer reads it.
  assert.equal(
    classifyJob(demand({ consequence: 'C2', reasoning: 'R1', context: 'X0', latency: 'L1' })),
    'TRANSFORM',
  );
});

test('a customer-read synthesis is COMPOSE', () => {
  assert.equal(
    classifyJob(demand({ consequence: 'C2', reasoning: 'R2', context: 'X1', latency: 'L2' })),
    'COMPOSE',
  );
});

test('anything the customer ACTS on is JUDGE, even when trivial to compute', () => {
  assert.equal(
    classifyJob(demand({ consequence: 'C3', reasoning: 'R0', context: 'X0', latency: 'L1' })),
    'JUDGE',
  );
});

test('hard work is escalated even when nobody reads it', () => {
  // A confident wrong answer from a model that cannot do the task costs more
  // than the tokens saved.
  assert.equal(
    classifyJob(demand({ consequence: 'C0', reasoning: 'R3', context: 'X1', latency: 'L2' })),
    'JUDGE',
  );
});

test('>200K context plus hard reasoning forces FRONTIER', () => {
  assert.equal(
    classifyJob(demand({ consequence: 'C3', reasoning: 'R3', context: 'X2', latency: 'L2' })),
    'FRONTIER',
  );
});

test('classifyJob is total — every axis combination yields a known class', () => {
  const C = ['C0', 'C1', 'C2', 'C3'] as const;
  const R = ['R0', 'R1', 'R2', 'R3'] as const;
  const X = ['X0', 'X1', 'X2'] as const;
  const L = ['L0', 'L1', 'L2', 'L3'] as const;
  for (const c of C) for (const r of R) for (const x of X) for (const l of L) {
    const got = classifyJob({ consequence: c, reasoning: r, context: x, latency: l });
    assert.ok(JOB_CLASSES.includes(got), `${c}/${r}/${x}/${l} -> ${got}`);
  }
});

// ── Properties the proposed policy must hold ─────────────────────────────────

test('every class has a route, in both policies', () => {
  for (const jc of JOB_CLASSES) {
    for (const p of [POLICY_CURRENT, POLICY_PROPOSED]) {
      const r = routeFor(jc, p);
      assert.ok(r.model, `${jc} has no model`);
      assert.ok(r.fallbackModel, `${jc} has no fallback`);
      assert.ok(r.rationale.length > 20, `${jc} rationale is not a reason`);
    }
  }
});

test('Haiku never carries customer-read or customer-acted output', () => {
  // Haiku is a 200K model and the cheapest tier; it belongs on retrieval only.
  for (const jc of ['TRANSFORM', 'COMPOSE', 'JUDGE', 'FRONTIER'] as const) {
    assert.notEqual(routeFor(jc, POLICY_PROPOSED).model, HAIKU_4_5, `${jc} routed to Haiku`);
  }
});

test('effort is null exactly where the model rejects it', () => {
  // Haiku 4.5 returns an error when sent `effort`; every other current model
  // accepts it. Getting this wrong is a 400 on a live customer call.
  for (const jc of JOB_CLASSES) {
    const r = routeFor(jc, POLICY_PROPOSED);
    if (r.model === HAIKU_4_5) assert.equal(r.effort, null, `${jc} sends effort to Haiku`);
    else assert.notEqual(r.effort, null, `${jc} omits effort on a model that takes it`);
  }
});

test('JUDGE falls UP, not down — the one class where the fallback is dearer', () => {
  const j = routeFor('JUDGE', POLICY_PROPOSED);
  assert.equal(j.model, OPUS_5);
  assert.equal(j.fallbackModel, FABLE_5_1);
  assert.equal(j.fallbackDegradesCustomerOutput, false);
});

test('every customer-degrading fallback is flagged as such', () => {
  // The runtime must be able to refuse to degrade silently. A fallback that
  // drops customer-visible quality without the flag is the bug this guards.
  const degrading = JOB_CLASSES.filter(
    (jc) => routeFor(jc, POLICY_PROPOSED).fallbackDegradesCustomerOutput,
  );
  assert.deepEqual(degrading, ['COMPOSE', 'FRONTIER']);
});

test('COMPOSE is NOT downgraded to Sonnet in the proposal', () => {
  // Deliberate. Sonnet 5 high on COMPOSE is the largest saving available and is
  // written up for ratification — it is not taken unilaterally, because the
  // customer reads this output.
  assert.equal(routeFor('COMPOSE', POLICY_PROPOSED).model, OPUS_5);
});

test('the proposal uses canonical ids only — no date suffixes, no retired models', () => {
  const allowed = new Set([HAIKU_4_5, SONNET_5, OPUS_5, FABLE_5_1]);
  for (const jc of JOB_CLASSES) {
    const r = routeFor(jc, POLICY_PROPOSED);
    for (const id of [r.model, r.fallbackModel]) {
      assert.ok(allowed.has(id), `${jc}: ${id} is not a current canonical id`);
      assert.doesNotMatch(id, /-\d{8}$/, `${jc}: ${id} carries a date suffix`);
    }
  }
});
