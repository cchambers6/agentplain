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

  // ── THE ZERO RULE ──────────────────────────────────────────────────────
  // The check that a check looked at something. Five fixtures, because the
  // interesting cases are not "is it zero" but "is this zero the honest kind".

  it('catches a standard that examined nothing — the empty-array bug, one level up', () => {
    const v = checkStandardsContract([
      { ...HEALTHY, coverage: () => ({ examined: 0, total: 0, unit: 'f', blindTo: ['x'] }) },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /passes without measuring anything/);
  });

  it('catches examined 0 of a NON-empty surface, even with a waiver', () => {
    // The distinction the waiver exists to hold. 0 of 40 is a broken checker;
    // no declaration makes it an empty category.
    const v = checkStandardsContract([
      {
        ...HEALTHY,
        coverage: () => ({ examined: 0, total: 40, unit: 'f', blindTo: ['x'] }),
        zeroCoverageWaiver: {
          standard: 'fixture',
          reason: 'claiming emptiness over a surface of 40',
          expires: '2099-01-01',
        },
      },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /UNMEASURED surface, not an empty one/);
  });

  it('catches a waiver copy-pasted from another standard', () => {
    const v = checkStandardsContract([
      {
        ...HEALTHY,
        coverage: () => ({ examined: 0, total: 0, unit: 'f', blindTo: ['x'] }),
        zeroCoverageWaiver: {
          standard: 'some-other-standard',
          reason: 'borrowed',
          expires: '2099-01-01',
        },
      },
    ]);
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /copy-pasted/);
  });

  it('catches an expired waiver — an empty category nobody re-checked', () => {
    const v = checkStandardsContract(
      [
        {
          ...HEALTHY,
          coverage: () => ({ examined: 0, total: 0, unit: 'f', blindTo: ['x'] }),
          zeroCoverageWaiver: {
            standard: 'fixture',
            reason: 'genuinely empty on the day it was written',
            expires: '2026-01-01',
          },
        },
      ],
      new Date('2026-09-11'),
    );
    assert.equal(v.length, 1);
    assert.match(v[0].problem, /expired on 2026-01-01/);
  });

  it('NEAR MISS: a properly named, pinned, unexpired waiver passes', () => {
    assert.deepEqual(
      checkStandardsContract(
        [
          {
            ...HEALTHY,
            coverage: () => ({ examined: 0, total: 0, unit: 'f', blindTo: ['x'] }),
            zeroCoverageWaiver: {
              standard: 'fixture',
              reason: 'the category has no members today',
              expires: '2026-12-01',
            },
          },
        ],
        new Date('2026-09-11'),
      ),
      [],
    );
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

  it('no standard passes while measuring nothing — examined N of M, N > 0', () => {
    // WAS, until 2026-09-11: an assertion that `roster-capability` and
    // `vertical-reachability` report `total === 0`, pinned as a permanent
    // known hole. Both checkers did examine a real surface (22 of 86 roster
    // cards; 12 of 12 vertical subjects) — nothing was counting, and the
    // registry accepted the zero. A standard reporting `examined: 0` is
    // `assert.deepEqual(x, [])` on an empty input set with a registry entry
    // on it, which is the exact bug this whole module exists to remove.
    //
    // This assertion is now the inverse: zero coverage is a failure, and the
    // only way past it is a declared, named, pinned, dated ZeroCoverageWaiver.
    const M = STANDARDS.length;
    const measuring = STANDARDS.filter((s) => s.coverage().examined > 0);
    const waived = STANDARDS.filter(
      (s) => s.coverage().examined === 0 && s.zeroCoverageWaiver,
    );
    const N = measuring.length + waived.length;

    assert.ok(
      M > 0,
      'examined 0 of 0 standards — STANDARDS is empty, so this test proves nothing. ' +
        'This is the N = 0 guard on the check that enforces the N = 0 guard.',
    );
    assert.equal(
      N,
      M,
      `examined ${N} of ${M} standards. ` +
        `Reporting nothing and passing: ${STANDARDS.filter(
          (s) => s.coverage().examined === 0 && !s.zeroCoverageWaiver,
        )
          .map((s) => s.id)
          .join(', ')}. A standard that examined 0 subjects is indistinguishable ` +
        `from one that is dead. Report real counts, or declare a ZeroCoverageWaiver.`,
    );
  });

  it('every waived zero is named, pinned to an empty surface, and dated', () => {
    const waivers = STANDARDS.filter((s) => s.zeroCoverageWaiver);
    for (const s of waivers) {
      const w = s.zeroCoverageWaiver!;
      assert.equal(w.standard, s.id, `${s.id}: waiver names "${w.standard}" — waivers are not portable`);
      assert.equal(
        s.coverage().total,
        0,
        `${s.id}: waiver claims an empty category but the surface is ${s.coverage().total}. ` +
          'Unmeasured is not empty.',
      );
      assert.ok(
        !Number.isNaN(Date.parse(w.expires)),
        `${s.id}: waiver "expires" is not a date (${w.expires})`,
      );
      assert.ok(w.reason.length > 0, `${s.id}: waiver has no reason`);
    }
  });
});
