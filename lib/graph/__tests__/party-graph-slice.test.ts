/**
 * lib/graph/__tests__/party-graph-slice.test.ts
 *
 * The party slice of the entity graph, end to end, with no database and
 * no build:
 *
 *   1. an approved COMPLIANCE_FLAG on a LawMatter mints party nodes and
 *      adverse_to edges
 *   2. approving it again is idempotent
 *   3. an approval never downgrades a connector-sourced node
 *   4. a store failure does not escape the projection wrapper
 *   5. GraphLedgerFetcher feeds the REAL runSkill and produces a verdict
 *   6. provenance changes that verdict
 *
 * Assertions 5 and 6 import `runSkill` from
 * lib/skills/law-intake-conflict-screen/skill.ts unmodified and unmocked.
 * Mocking it would make assertion 5 assert nothing: the claim under test
 * is precisely that the existing skill accepts a graph-backed fetcher
 * through its existing port with no edit.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { projectApprovalToGraph } from '../apply';
import { naturalKeyFor } from '../normalize';
import type { ApprovalProjectionInput } from '../projections';
import { InMemoryGraphStore, type GraphStore } from '../store';
import {
  ADVERSE_TO_REL,
  PARTY_ROLE_ATTR,
  PARTY_TYPE_SLUG,
  type EdgeSpec,
  type GraphNode,
  type NodeSpec,
  type Provenance,
} from '../types';

import { GraphLedgerFetcher } from '../../skills/law-intake-conflict-screen/graph-ledger-fetcher';
import { runSkill } from '../../skills/law-intake-conflict-screen/skill';
import type { ProspectiveIntake } from '../../skills/law-intake-conflict-screen/types';

// -- fixture --------------------------------------------------------------

const TENANT = 'ws-law-graph-0001';
const APPROVAL_ITEM_ID = 'appr-3f2a9c11';
const MATTER_ID = 'matter-2026-0042';

/** The firm's own client on the approved matter. */
const CLIENT = 'Harbor Point Logistics LLC';
/** Two adverse parties named on the same matter. */
const OPP_ONE = 'Brightwater Capital Inc';
const OPP_TWO = 'Cedar Ridge Partners LP';

const DECIDED_AT = new Date('2026-09-01T12:00:00.000Z');
const RE_DECIDED_AT = new Date('2026-09-04T09:30:00.000Z');
const CONNECTOR_SEEN_AT = new Date('2026-08-11T08:00:00.000Z');

function approvalInput(
  overrides: Partial<ApprovalProjectionInput> = {},
): ApprovalProjectionInput {
  return {
    tenantId: TENANT,
    approvalItemId: APPROVAL_ITEM_ID,
    kind: 'COMPLIANCE_FLAG',
    refTable: 'LawMatter',
    refId: MATTER_ID,
    decidedAt: DECIDED_AT,
    // Shape mirrors buildConflictApprovalRow's COMPLIANCE_FLAG payload,
    // plus the explicit `opposingParties` key that payload is missing
    // today (see the FINDING in projections.ts).
    payload: {
      screenStatus: 'needs-counsel-review',
      kind: 'conflict-review-card',
      matterId: MATTER_ID,
      prospectName: CLIENT,
      opposingParties: [OPP_ONE, OPP_TWO],
      conflictCount: 0,
      conflicts: [],
    },
    ...overrides,
  };
}

function key(name: string): string {
  return naturalKeyFor(PARTY_TYPE_SLUG, name);
}

async function nodeFor(
  store: GraphStore,
  name: string,
): Promise<GraphNode> {
  const found = await store.getEntity({
    tenantId: TENANT,
    typeSlug: PARTY_TYPE_SLUG,
    naturalKey: key(name),
  });
  assert.ok(found, `expected a party node for ${name}`);
  return found;
}

/**
 * Seed the same three parties directly through the port at an arbitrary
 * provenance. Used by assertion 6: the law-matter projection always mints
 * APPROVED, so an INFERRED node necessarily comes from a different writer
 * (a future inference pass) using the same upsert path.
 */
async function seedParties(
  store: GraphStore,
  provenance: Provenance,
  observedAt: Date,
): Promise<void> {
  const roster: Array<[string, 'client' | 'opposing']> = [
    [CLIENT, 'client'],
    [OPP_ONE, 'opposing'],
    [OPP_TWO, 'opposing'],
  ];
  for (const [name, role] of roster) {
    await store.upsertEntity({
      tenantId: TENANT,
      typeSlug: PARTY_TYPE_SLUG,
      naturalKey: key(name),
      label: name,
      provenance,
      attributes: { [PARTY_ROLE_ATTR]: role },
      sourceRef: MATTER_ID,
      observedAt,
    });
  }
}

function freshIntake(
  overrides: Partial<ProspectiveIntake> = {},
): ProspectiveIntake {
  return {
    matterId: 'matter-2026-0117',
    prospectName: 'Delta Rail Partners',
    prospectEmail: 'ops@deltarail.example',
    // Names the party the approved matter already put in the graph.
    opposingParties: ['Harbor Point Logistics'],
    matterDescription: 'Contract dispute over a rail terminal lease.',
    responsibleAttorney: { name: 'Sarah Hill', email: 'sarah@firm.example' },
    ...overrides,
  };
}

// -- 1. minting -----------------------------------------------------------

describe('party graph - approval mints nodes and edges', () => {
  it('mints one APPROVED party node per named party plus an adverse_to edge per opposing party', async () => {
    const store = new InMemoryGraphStore();
    const report = await projectApprovalToGraph(store, approvalInput());

    assert.equal(report.applied, true);
    assert.equal(report.projectionName, 'law-matter-party');
    assert.deepEqual(report.errors, []);

    const parties = await store.listEntities({
      tenantId: TENANT,
      typeSlug: PARTY_TYPE_SLUG,
    });
    assert.equal(parties.length, 3);

    for (const name of [CLIENT, OPP_ONE, OPP_TWO]) {
      const node = await nodeFor(store, name);
      assert.equal(node.provenance, 'APPROVED');
      assert.equal(node.approvalItemId, APPROVAL_ITEM_ID);
      assert.equal(node.sourceRef, MATTER_ID);
      assert.equal(node.label, name);
      assert.equal(node.firstSeenAt.toISOString(), DECIDED_AT.toISOString());
    }

    const client = await nodeFor(store, CLIENT);
    assert.equal(client.attributes[PARTY_ROLE_ATTR], 'client');
    assert.equal(
      (await nodeFor(store, OPP_ONE)).attributes[PARTY_ROLE_ATTR],
      'opposing',
    );

    const edges = await store.listEdges({
      tenantId: TENANT,
      relType: ADVERSE_TO_REL,
    });
    assert.equal(edges.length, 2);
    const opposingIds = new Set([
      (await nodeFor(store, OPP_ONE)).id,
      (await nodeFor(store, OPP_TWO)).id,
    ]);
    for (const edge of edges) {
      assert.equal(edge.fromEntityId, client.id);
      assert.ok(opposingIds.has(edge.toEntityId));
      assert.equal(edge.provenance, 'APPROVED');
      assert.equal(edge.approvalItemId, APPROVAL_ITEM_ID);
      assert.equal(edge.sourceRef, MATTER_ID);
    }
  });
});

// -- 2. idempotency -------------------------------------------------------

describe('party graph - idempotency', () => {
  it('re-approving the same item yields the same ids, no duplicates, and moves only lastSeenAt', async () => {
    const store = new InMemoryGraphStore();
    await projectApprovalToGraph(store, approvalInput());

    const before = await store.listEntities({ tenantId: TENANT });
    const idsBefore = before.map((n) => n.id).sort();
    const edgeIdsBefore = (await store.listEdges({ tenantId: TENANT }))
      .map((e) => e.id)
      .sort();

    // (a) exact replay - identical decision, identical timestamp. Nothing
    //     at all may change, including lastSeenAt.
    await projectApprovalToGraph(store, approvalInput());
    const replayed = await store.listEntities({ tenantId: TENANT });
    assert.deepEqual(replayed.map((n) => n.id).sort(), idsBefore);
    assert.deepEqual(
      replayed.map((n) => n.lastSeenAt.toISOString()).sort(),
      before.map((n) => n.lastSeenAt.toISOString()).sort(),
    );

    // (b) later re-decision on the same item. This is not hypothetical:
    //     WorkApprovalQueueItem has no natural key today, so one matter
    //     can accumulate several rows (see FINDINGS in ../store.ts).
    await projectApprovalToGraph(
      store,
      approvalInput({ decidedAt: RE_DECIDED_AT }),
    );

    const after = await store.listEntities({ tenantId: TENANT });
    const afterEdges = await store.listEdges({ tenantId: TENANT });

    assert.equal(after.length, 3, 'no duplicate party rows');
    assert.equal(afterEdges.length, 2, 'no duplicate edge rows');
    assert.equal(store.entityCount, 3);
    assert.equal(store.edgeCount, 2);
    assert.deepEqual(after.map((n) => n.id).sort(), idsBefore);
    assert.deepEqual(afterEdges.map((e) => e.id).sort(), edgeIdsBefore);

    for (const node of after) {
      assert.equal(
        node.firstSeenAt.toISOString(),
        DECIDED_AT.toISOString(),
        'firstSeenAt never moves',
      );
      assert.equal(
        node.lastSeenAt.toISOString(),
        RE_DECIDED_AT.toISOString(),
        'lastSeenAt advances',
      );
    }
    for (const edge of afterEdges) {
      assert.equal(edge.firstSeenAt.toISOString(), DECIDED_AT.toISOString());
      assert.equal(edge.lastSeenAt.toISOString(), RE_DECIDED_AT.toISOString());
    }
  });
});

// -- 3. provenance precedence --------------------------------------------

describe('party graph - provenance precedence', () => {
  it('an approval does not downgrade a CONNECTOR node for the same normalized party', async () => {
    const store = new InMemoryGraphStore();

    // Same party, different spelling: "Brightwater Capital, Inc." and
    // "Brightwater Capital Inc" share a natural key.
    const connectorLabel = 'Brightwater Capital, Inc.';
    assert.equal(key(connectorLabel), key(OPP_ONE), 'fixture precondition');

    const seeded = await store.upsertEntity({
      tenantId: TENANT,
      typeSlug: PARTY_TYPE_SLUG,
      naturalKey: key(connectorLabel),
      label: connectorLabel,
      provenance: 'CONNECTOR',
      attributes: { [PARTY_ROLE_ATTR]: 'client', matterStatus: 'active' },
      sourceRef: 'crm-8811',
      observedAt: CONNECTOR_SEEN_AT,
    });

    await projectApprovalToGraph(store, approvalInput());

    const node = await nodeFor(store, OPP_ONE);
    assert.equal(node.id, seeded.id, 'same row, not a second one');
    assert.equal(node.label, connectorLabel, 'label survives');
    assert.equal(node.provenance, 'CONNECTOR', 'not downgraded to APPROVED');
    assert.equal(node.attributes[PARTY_ROLE_ATTR], 'client');
    assert.equal(node.attributes.matterStatus, 'active');
    assert.equal(node.sourceRef, 'crm-8811');
    assert.equal(node.approvalItemId, null);

    assert.equal(
      node.firstSeenAt.toISOString(),
      CONNECTOR_SEEN_AT.toISOString(),
      'firstSeenAt still the connector observation',
    );
    assert.equal(
      node.lastSeenAt.toISOString(),
      DECIDED_AT.toISOString(),
      'lastSeenAt advances - the approval is corroboration',
    );

    // The parties the connector did not know about are still minted.
    assert.equal(store.entityCount, 3);
    assert.equal((await nodeFor(store, CLIENT)).provenance, 'APPROVED');
  });
});

// -- 4. failure isolation -------------------------------------------------

/** A store whose `upsertEntity` refuses the specs a predicate selects. */
class FailingEntityStore implements GraphStore {
  readonly name = 'failing-entity' as const;

  constructor(
    private readonly inner: GraphStore,
    private readonly refuses: (spec: NodeSpec) => boolean,
  ) {}

  async upsertEntity(spec: NodeSpec) {
    if (this.refuses(spec)) {
      throw new Error(`upsertEntity refused ${spec.naturalKey}`);
    }
    return this.inner.upsertEntity(spec);
  }
  upsertEdge(spec: EdgeSpec) {
    return this.inner.upsertEdge(spec);
  }
  getEntity(lookup: Parameters<GraphStore['getEntity']>[0]) {
    return this.inner.getEntity(lookup);
  }
  getEntityById(args: Parameters<GraphStore['getEntityById']>[0]) {
    return this.inner.getEntityById(args);
  }
  listEntities(query: Parameters<GraphStore['listEntities']>[0]) {
    return this.inner.listEntities(query);
  }
  listEdges(query: Parameters<GraphStore['listEdges']>[0]) {
    return this.inner.listEdges(query);
  }
}

describe('party graph - failure isolation', () => {
  it('a throw from upsertEntity does not propagate out of the projection wrapper', async () => {
    const inner = new InMemoryGraphStore();
    const store = new FailingEntityStore(inner, () => true);
    const reported: Array<[string, string]> = [];

    // Must not reject. If this line throws, an approval decision that the
    // customer already made would fail on derived bookkeeping.
    const report = await projectApprovalToGraph(store, approvalInput(), {
      onError: (stage, error) => reported.push([stage, error.message]),
    });

    assert.equal(report.applied, true);
    assert.deepEqual(report.nodeIds, []);
    assert.deepEqual(report.edgeIds, []);
    // 3 refused nodes + 2 edges whose endpoints never landed.
    assert.equal(report.errors.length, 5);
    assert.equal(reported.length, 5);
    assert.deepEqual(
      reported.map(([stage]) => stage),
      [
        'upsertEntity',
        'upsertEntity',
        'upsertEntity',
        'resolveEdge',
        'resolveEdge',
      ],
      'swallowed is not silent - every failure was reported',
    );
    assert.equal(inner.entityCount, 0);
    assert.equal(inner.edgeCount, 0);
  });

  it('one failed node does not take the surviving nodes or its own edges down with it', async () => {
    const inner = new InMemoryGraphStore();
    const store = new FailingEntityStore(
      inner,
      (spec) => spec.naturalKey === key(CLIENT),
    );

    const report = await projectApprovalToGraph(store, approvalInput(), {
      onError: () => undefined,
    });

    assert.equal(report.nodeIds.length, 2, 'both opposing parties landed');
    assert.equal(inner.entityCount, 2);
    // Every adverse_to edge starts at the client node, which is missing,
    // so no edge may be written against a guessed endpoint.
    assert.equal(inner.edgeCount, 0);
    assert.equal(report.errors.length, 3);
  });
});

// -- 5. end to end through the real skill ---------------------------------

describe('party graph - end to end into the real conflict screen', () => {
  it('GraphLedgerFetcher feeds the unmodified runSkill and returns flagged with one hit', async () => {
    const store = new InMemoryGraphStore();
    await projectApprovalToGraph(store, approvalInput());

    const fetcher = new GraphLedgerFetcher({ store });
    assert.equal(fetcher.name, 'graph');

    // The port contract first: the graph reads back as LedgerEntry[].
    const ledgerRes = await fetcher.fetchLedger({ workspaceId: TENANT });
    assert.equal(ledgerRes.ok, true);
    if (!ledgerRes.ok) return;
    assert.equal(ledgerRes.value.length, 3);
    const harbor = ledgerRes.value.find((e) => e.clientName === CLIENT);
    assert.ok(harbor);
    assert.equal(harbor.status, 'closed');
    assert.match(harbor.matterLabel ?? '', /firm client on matter matter-2026-0042 \[approved\]/);

    // Then the real skill, unmodified and unmocked.
    const res = await runSkill({
      workspaceId: TENANT,
      intake: freshIntake(),
      fetcher,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'flagged');
    assert.equal(res.value.conflicts.length, 1);

    const hit = res.value.conflicts[0];
    assert.equal(hit.severity, 'former-adverse');
    assert.equal(hit.matchedAgainst, 'opposing-party');
    assert.equal(hit.opposingPartyText, 'Harbor Point Logistics');
    assert.equal(hit.existingClient.clientName, CLIENT);
    assert.equal(hit.normalizedMatch, 'harbor point logistics');
    assert.match(
      res.value.attorneyNotice.body,
      /FORMER-ADVERSE \(closed matter\)/,
    );
    // Still no legal conclusion, per MRPC 1.7 / 1.18.
    assert.match(
      res.value.attorneyNotice.body,
      /\{\{operator: legal conclusion\}\}/,
    );
  });
});

// -- 6. provenance changes the verdict ------------------------------------

describe('party graph - provenance changes the verdict', () => {
  it('an INFERRED party raises a question and never asserts a conflict', async () => {
    const store = new InMemoryGraphStore();
    await seedParties(store, 'INFERRED', DECIDED_AT);

    const fetcher = new GraphLedgerFetcher({ store });
    const ledgerRes = await fetcher.fetchLedger({ workspaceId: TENANT });
    assert.equal(ledgerRes.ok, true);
    if (!ledgerRes.ok) return;
    // The guess is NOT dropped - dropping it on a non-empty ledger would
    // turn a question into a clearance.
    assert.equal(ledgerRes.value.length, 3);
    for (const entry of ledgerRes.value) {
      assert.equal(entry.status, 'active', 'inferred takes the strict branch');
      assert.match(entry.matterLabel ?? '', /\[inferred\]/);
    }

    const res = await runSkill({
      workspaceId: TENANT,
      intake: freshIntake(),
      fetcher,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'needs-counsel-review');
    assert.notEqual(res.value.status, 'flagged');
    assert.equal(res.value.conflicts.length, 1);
    assert.equal(res.value.conflicts[0].severity, 'adverse');
    assert.match(res.value.attorneyNotice.subject, /counsel review REQUIRED/);
  });

  it('provenance is the ONLY difference between the two verdicts', async () => {
    const verdicts: Array<[Provenance, string]> = [];
    for (const provenance of [
      'CONNECTOR',
      'CUSTOMER',
      'APPROVED',
      'INFERRED',
    ] as const) {
      const store = new InMemoryGraphStore();
      await seedParties(store, provenance, DECIDED_AT);
      const res = await runSkill({
        workspaceId: TENANT,
        intake: freshIntake(),
        fetcher: new GraphLedgerFetcher({ store }),
      });
      assert.equal(res.ok, true);
      if (!res.ok) return;
      verdicts.push([provenance, res.value.status]);
    }

    assert.deepEqual(verdicts, [
      ['CONNECTOR', 'flagged'],
      ['CUSTOMER', 'flagged'],
      ['APPROVED', 'flagged'],
      ['INFERRED', 'needs-counsel-review'],
    ]);
  });
});
