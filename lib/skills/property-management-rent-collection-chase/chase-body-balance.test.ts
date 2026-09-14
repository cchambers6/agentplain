/**
 * lib/skills/property-management-rent-collection-chase/chase-body-balance.test.ts
 *
 * Consumer-path coverage for the RENDERED chase body.
 *
 * Every assertion here runs against `draft.body` - the exact string
 * `persistDraft` writes into the property manager's Gmail Drafts folder and
 * that a tenant reads one click later. Asserting on
 * `draft.outstandingBalanceUsd` (the record) would stay green while the body
 * still said `{{operator: amount due}}`, which is how the blank-amount defect
 * survived: the pre-existing soft-chase test pinned the PLACEHOLDER as
 * PRESENT.
 *
 * Coverage reporting: each case increments `examined`, and a final assertion
 * fails when `examined` is zero or short of the corpus. A bare
 * `for (const c of CASES) { it(...) }` over an empty CASES generates zero
 * tests and reports a green `fail 0` - the floor is what makes that loud.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonRentRollLookup } from './json-fetcher';
import type { UnitDelinquency } from './types';

const WORKSPACE_ID = 'ws-pm-body-0001';
const NOW = new Date('2026-05-24T15:00:00Z');
const AMOUNT_PLACEHOLDER = /\{\{operator: amount due\}\}/;

function unit(overrides: Partial<UnitDelinquency> = {}): UnitDelinquency {
  return {
    leaseId: 'lease-body-0001',
    unitLabel: '1234 Oak St #4B',
    primaryTenant: {
      name: 'Riley Park',
      email: 'riley@tenant.example',
      phone: null,
    },
    coTenants: [],
    daysPastDue: 5,
    outstandingBalanceUsd: 1850,
    paymentPlanInPlace: false,
    tenantAcknowledged: false,
    lastChaseAt: null,
    propertyManager: {
      name: 'Jordan Tate',
      email: 'jordan@pm.example',
      phone: null,
    },
    formalNoticeRequiresOwnerApproval: true,
    ...overrides,
  };
}

interface BodyCase {
  name: string;
  daysPastDue: number;
  outstandingBalanceUsd: number;
  paymentPlanInPlace?: boolean;
  /** Exact substring the tenant must read, or null when the body must still
   *  defer to the operator merge field because we hold no usable figure. */
  expectRendered: string | null;
}

const CASES: readonly BodyCase[] = [
  {
    name: 'whole-dollar balance renders with grouping and cents',
    daysPastDue: 5,
    outstandingBalanceUsd: 1850,
    expectRendered: 'Our records show $1,850.00 outstanding as of this morning.',
  },
  {
    name: 'fractional balance keeps its cents',
    daysPastDue: 5,
    outstandingBalanceUsd: 1432.5,
    expectRendered: 'Our records show $1,432.50 outstanding as of this morning.',
  },
  {
    name: 'five-figure balance groups thousands',
    daysPastDue: 5,
    outstandingBalanceUsd: 12750,
    expectRendered:
      'Our records show $12,750.00 outstanding as of this morning.',
  },
  {
    name: 'sub-thousand balance renders without a separator',
    daysPastDue: 5,
    outstandingBalanceUsd: 900,
    expectRendered: 'Our records show $900.00 outstanding as of this morning.',
  },
  {
    name: 'payment-plan soft-chase still renders the balance',
    daysPastDue: 5,
    outstandingBalanceUsd: 640.25,
    paymentPlanInPlace: true,
    expectRendered: 'Our records show $640.25 outstanding as of this morning.',
  },
  {
    name: 'zero balance defers instead of mailing $0.00',
    daysPastDue: 5,
    outstandingBalanceUsd: 0,
    expectRendered: null,
  },
  {
    name: 'credit balance defers instead of mailing a negative',
    daysPastDue: 5,
    outstandingBalanceUsd: -240,
    expectRendered: null,
  },
  {
    name: 'non-finite balance defers instead of mailing NaN',
    daysPastDue: 5,
    outstandingBalanceUsd: Number.NaN,
    expectRendered: null,
  },
];

async function bodyFor(c: BodyCase): Promise<string> {
  const res = await runSkill({
    workspaceId: WORKSPACE_ID,
    lookup: new JsonRentRollLookup({
      workspaceId: WORKSPACE_ID,
      delinquentUnits: [
        unit({
          daysPastDue: c.daysPastDue,
          outstandingBalanceUsd: c.outstandingBalanceUsd,
          paymentPlanInPlace: c.paymentPlanInPlace ?? false,
        }),
      ],
    }),
    now: NOW,
  });
  assert.equal(res.ok, true, `runSkill failed for case: ${c.name}`);
  if (!res.ok) throw new Error('unreachable');
  assert.equal(res.value.drafts.length, 1, `expected 1 draft for: ${c.name}`);
  return res.value.drafts[0].body;
}

let examined = 0;

describe('rent-collection chase - rendered body carries the balance', () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const body = await bodyFor(c);
      if (c.expectRendered === null) {
        assert.match(
          body,
          AMOUNT_PLACEHOLDER,
          `${c.name}: expected the operator deferral, got:\n${body}`,
        );
        assert.ok(
          !/Our records show/.test(body),
          `${c.name}: rendered a figure we should not stand behind:\n${body}`,
        );
      } else {
        assert.ok(
          body.includes(c.expectRendered),
          `${c.name}: body is missing ${JSON.stringify(c.expectRendered)}\n--- body ---\n${body}`,
        );
        assert.doesNotMatch(
          body,
          AMOUNT_PLACEHOLDER,
          `${c.name}: placeholder leaked into a body that has a real figure:\n${body}`,
        );
      }
      examined += 1;
    });
  }

  it('examined every balance case (non-zero floor)', () => {
    assert.ok(
      CASES.length > 0,
      'balance-case corpus is EMPTY - collection broke, and an empty corpus ' +
        'would otherwise report a green `fail 0`',
    );
    assert.equal(
      examined,
      CASES.length,
      `examined ${examined} of ${CASES.length} balance cases`,
    );
  });
});

describe('rent-collection chase - other buckets keep their own deferrals', () => {
  it('formal-notice body carries no amount-due placeholder', async () => {
    const body = await bodyFor({
      name: 'formal-notice',
      daysPastDue: 9,
      outstandingBalanceUsd: 2200,
      expectRendered: null,
    });
    assert.doesNotMatch(body, AMOUNT_PLACEHOLDER);
    // The maintenance-ETA deferral is doctrine for tenant drafts and stays.
    assert.match(body, /\{\{operator: maintenance ETA\}\}/);
  });

  it('escalation body carries no amount-due placeholder', async () => {
    const body = await bodyFor({
      name: 'escalation',
      daysPastDue: 20,
      outstandingBalanceUsd: 3100,
      expectRendered: null,
    });
    assert.doesNotMatch(body, AMOUNT_PLACEHOLDER);
    assert.match(body, /\{\{operator: formal-notice attachment/);
  });
});
