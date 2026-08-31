/**
 * lib/verification/standards-contract.test.ts
 *
 * THE VERIFICATION STANDARD. This file is the gate that makes the other gates
 * mean something.
 *
 * It asserts, on every pull request, that each registered standard:
 *   • can be shown to FAIL on an input built to violate it;
 *   • does NOT fire on a near-miss that is legal;
 *   • states how much of the real surface it examined;
 *   • states what it is structurally unable to see;
 *   • is audited by somebody other than its owner.
 *
 * The last one binds this file too. `standards-contract` is owned by
 * Verification and audited by Tenant Isolation, and the contract checker fails
 * any entry where those two are equal — including its own.
 *
 * Runs in ~10ms. It is enforced by .github/workflows/tests.yml via
 * `npm run test:gate`, which runs on every pull_request.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STANDARDS,
  checkStandardsContract,
  type StandardDescriptor,
} from './standards';

function format(vs: ReturnType<typeof checkStandardsContract>): string {
  return vs
    .map((v) => `  • ${v.standard}: ${v.problem}\n      fix: ${v.remedy}`)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// 1. The gate
// ─────────────────────────────────────────────────────────────────────────

describe('the standards contract — every registered standard proves it works', () => {
  it('every standard can be shown to fail, discriminates, and declares its blindness', () => {
    const violations = checkStandardsContract(STANDARDS);
    assert.equal(
      violations.length,
      0,
      `\nA registered standard no longer satisfies the contract. A check in this ` +
        `state is not evidence — its result is the same whether the system is ` +
        `healthy or the check is dead:\n${format(violations)}\n`,
    );
  });

  it('no standard audits its own outcome', () => {
    const selfAudited = STANDARDS.filter((s) => s.owner === s.auditor);
    assert.deepEqual(
      selfAudited.map((s) => s.id),
      [],
      'a builder auditing its own work is the failure the Unit 1 review demonstrated; assign a different auditor',
    );
  });

  it('every standard names exactly one consequence for failing', () => {
    const allowed = new Set(['block-merge', 'open-issue', 'page-conner']);
    for (const s of STANDARDS) {
      assert.ok(
        allowed.has(s.onFailure),
        `${s.id} has no valid failure action; "all of the above" is how a signal becomes unrankable`,
      );
    }
  });

  it('paging is rationed — at most one standard may interrupt Conner', () => {
    // A pager that fires for three different reasons is a pager that gets
    // silenced. Only "a customer is being harmed right now" earns it.
    const paging = STANDARDS.filter((s) => s.onFailure === 'page-conner');
    assert.ok(
      paging.length <= 1,
      `${paging.length} standards page: ${paging.map((s) => s.id).join(', ')}. Demote all but the one where a customer is harmed while the alert waits.`,
    );
  });

  it('the contract examined every registered standard — no silent subset', () => {
    const contract = STANDARDS.find((s) => s.id === 'standards-contract');
    assert.ok(contract, 'the contract standard must be registered');
    assert.equal(
      contract!.coverage().examined,
      STANDARDS.length,
      `standards-contract claims to examine ${contract!.coverage().examined} standards but ${STANDARDS.length} are registered — ` +
        `update the coverage figure in lib/verification/standards.ts when adding a standard`,
    );
  });

  it('every outcome is a state of the world, not a task', () => {
    // An outcome phrased as work ("add RLS policies") disappears when the work
    // closes. An outcome phrased as a state ("no table is readable across
    // workspaces") outlives every unit that touches it.
    const taskVerbs = /^(add|build|write|implement|fix|ship|create|migrate)\b/i;
    for (const s of STANDARDS) {
      assert.ok(
        !taskVerbs.test(s.outcome.trim()),
        `${s.id}: outcome reads as a task, not a state of the world — "${s.outcome}"`,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Deliberate failure — proof the contract checker itself can fail
// ─────────────────────────────────────────────────────────────────────────

const HEALTHY: StandardDescriptor = {
  id: 'fixture',
  outcome: 'fixture state holds',
  owner: 'Builder',
  auditor: 'Auditor',
  module: 'fixture',
  onFailure: 'open-issue',
  proveItCanFail: () => ['violation'],
  proveItDiscriminates: () => [],
  coverage: () => ({ examined: 1, total: 1, unit: 'fixture', blindTo: ['everything'] }),
};

describe('the standards contract — deliberate failure fixtures', () => {
  it('NEAR MISS: a healthy descriptor produces no contract violation', () => {
    assert.deepEqual(checkStandardsContract([HEALTHY]), []);
  });

  it('catches a checker that cannot fail', () => {
    const v = checkStandardsContract([{ ...HEALTHY, proveItCanFail: () => [] }]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /cannot be shown to fail/);
  });

  it('catches a checker that fires on everything', () => {
    const v = checkStandardsContract([
      { ...HEALTHY, proveItDiscriminates: () => ['spurious'] },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /fires on everything/);
  });

  it('catches a builder auditing itself', () => {
    const v = checkStandardsContract([{ ...HEALTHY, auditor: 'Builder' }]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /auditing its own work/);
  });

  it('catches a claim of omniscience', () => {
    const v = checkStandardsContract([
      { ...HEALTHY, coverage: () => ({ examined: 1, total: 1, unit: 'f', blindTo: [] }) },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /omniscience/);
  });

  it('catches incoherent coverage arithmetic', () => {
    const v = checkStandardsContract([
      { ...HEALTHY, coverage: () => ({ examined: 9, total: 2, unit: 'f', blindTo: ['x'] }) },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /incoherent/);
  });

  it('catches a checker that throws instead of reporting', () => {
    const v = checkStandardsContract([
      {
        ...HEALTHY,
        proveItCanFail: () => {
          throw new Error('boom');
        },
      },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /threw: boom/);
  });

  it('catches duplicate ids, which would make a failure ambiguous', () => {
    const v = checkStandardsContract([HEALTHY, { ...HEALTHY }]);
    assert.ok(v.some((x) => /duplicate id/.test(x.problem)));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Blindness — the registry's own known hole, asserted so it stays visible
// ─────────────────────────────────────────────────────────────────────────

describe('the standards contract — its own blind spot is on the record', () => {
  it('declares that unregistered checks are outside the contract', () => {
    const contract = STANDARDS.find((s) => s.id === 'standards-contract')!;
    assert.ok(
      contract.coverage().blindTo.some((b) => /REGISTERED/i.test(b)),
      'the registry must state, in code, that a check nobody registered is a check nobody verifies',
    );
  });

  it('records that two Claim Truth checkers report no coverage at all', () => {
    // Surfaced by standing up the Verification owner: neither
    // checkRosterCapabilityClaims nor checkVerticalReachability returns a
    // CoverageReport, so nobody — including this registry — can say how much
    // of the roster or the vertical list they examined. Pinned as an assertion
    // so the day somebody fixes it, this test fails and gets updated, rather
    // than the gap quietly persisting behind prose.
    const noCoverage = STANDARDS.filter((s) => s.coverage().total === 0);
    assert.deepEqual(
      noCoverage.map((s) => s.id).sort(),
      ['roster-capability', 'vertical-reachability'],
      'the set of standards that cannot report coverage has changed — update this assertion and the blindTo text',
    );
  });
});
