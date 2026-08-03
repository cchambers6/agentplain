/**
 * Deletion COVERAGE gate — lib/customer-files/deletion.ts.
 *
 * The workspace teardown deletes tenant rows one table at a time, because
 * it deliberately PRESERVES the Workspace row (billing/tax shell) and so
 * the `ON DELETE CASCADE` chain from Workspace never fires. That design is
 * correct, but it means the sweep is a hand-maintained list — and a
 * hand-maintained list silently rots the moment somebody adds a tenant
 * table. That is exactly how the 2026-08-01 audit found the whole
 * client-portal tree (end-client emails, encrypted message bodies,
 * uploaded documents) surviving a GDPR walk-away.
 *
 * This file is the gate that stops it happening again. It reads the Prisma
 * DMMF — the generated client's view of `prisma/schema.prisma`, so it
 * tracks the real schema rather than a copy of it — and asserts:
 *
 *   1. Every model carrying a `workspaceId` column appears in exactly one
 *      of `SWEPT_MODELS` / `PRESERVED_MODELS`.
 *   2. Every model reachable from a swept model through a REQUIRED
 *      relation with `onDelete: Cascade` is covered transitively. That is
 *      how TeamMembership and the eight portal children are accounted for
 *      — and how a FUTURE child of a swept table is accounted for the day
 *      it is added.
 *   3. Anything left over is named in `OUT_OF_SCOPE_MODELS` with a reason,
 *      so a brand-new model cannot slip through unclassified.
 *   4. Every `via: 'prisma'` manifest entry really is deleted in
 *      `deletion.ts` (source scan for `tx.<model>.deleteMany`), so the
 *      manifest and the code cannot drift apart.
 *
 * A new model with a `workspaceId` therefore FAILS the build until someone
 * makes an explicit deletion ruling about it. That is the point.
 *
 * Mechanism note: `@prisma/internals#getDMMF` (which would parse the
 * .prisma file directly) is not a dependency of this repo, and adding one
 * was out of scope; `Prisma.dmmf` from the generated client exposes
 * `datamodel.models` with `relationOnDelete` populated on every relation
 * field in Prisma 6.x, which is everything this gate needs. `prisma
 * generate` already runs on `postinstall` and at the head of `npm run
 * build`, so the DMMF is always fresh where this test runs.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { Prisma } from '@prisma/client';

import {
  OUT_OF_SCOPE_MODELS,
  PRESERVED_MODELS,
  SWEPT_MODELS,
} from '../deletion';

// ── DMMF shapes (structural — we only read what we need) ─────────────────

interface DmmfField {
  name: string;
  kind: string;
  isRequired: boolean;
  type: string;
  relationFromFields?: readonly string[];
  relationOnDelete?: string;
}

interface DmmfModel {
  name: string;
  fields: readonly DmmfField[];
}

const MODELS = Prisma.dmmf.datamodel.models as unknown as readonly DmmfModel[];
const MODEL_NAMES = new Set(MODELS.map((m) => m.name));

const SWEPT_NAMES = SWEPT_MODELS.map((m) => m.model);
const PRESERVED_NAMES = PRESERVED_MODELS.map((m) => m.model);
const OUT_OF_SCOPE_NAMES = OUT_OF_SCOPE_MODELS.map((m) => m.model);

function hasWorkspaceIdColumn(model: DmmfModel): boolean {
  return model.fields.some(
    (f) => f.kind === 'scalar' && f.name === 'workspaceId',
  );
}

/**
 * Models with a `workspaceId` column — required OR optional. This is the
 * population the deletion policy must have an opinion about.
 */
const WORKSPACE_SCOPED = MODELS.filter(hasWorkspaceIdColumn).map((m) => m.name);

/**
 * Transitive closure over "child of a covered model". A model is covered
 * transitively when it holds a REQUIRED foreign key whose `onDelete` is
 * `Cascade` and whose parent is itself covered — i.e. deleting the parent
 * provably takes the child with it. Optional/SetNull relations do NOT
 * count: nulling a pointer leaves the row (and its PII) behind.
 *
 * Extracted as a pure function over a model list so the logic itself can
 * be tested against a synthetic schema below, not just against today's.
 */
function expandCascadeClosure(
  models: readonly DmmfModel[],
  seeds: readonly string[],
): Set<string> {
  const covered = new Set(seeds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const model of models) {
      if (covered.has(model.name)) continue;
      const cascadesFromCovered = model.fields.some(
        (f) =>
          f.kind === 'object' &&
          (f.relationFromFields?.length ?? 0) > 0 &&
          f.isRequired &&
          f.relationOnDelete === 'Cascade' &&
          covered.has(f.type),
      );
      if (cascadesFromCovered) {
        covered.add(model.name);
        grew = true;
      }
    }
  }
  return covered;
}

/** Prisma's client accessor for a model: first character lowercased. */
function clientAccessor(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

const DELETION_SOURCE = readFileSync(
  new URL('../deletion.ts', import.meta.url),
  'utf8',
);

// ── The gate ─────────────────────────────────────────────────────────────

describe('deletion manifests — well-formedness', () => {
  it('every manifest entry names a real model in the Prisma schema', () => {
    for (const name of [
      ...SWEPT_NAMES,
      ...PRESERVED_NAMES,
      ...OUT_OF_SCOPE_NAMES,
    ]) {
      assert.ok(
        MODEL_NAMES.has(name),
        `manifest names "${name}", which is not a model in prisma/schema.prisma ` +
          '(renamed or removed? update lib/customer-files/deletion.ts)',
      );
    }
  });

  it('no model appears in more than one manifest, and none appears twice', () => {
    const all = [...SWEPT_NAMES, ...PRESERVED_NAMES, ...OUT_OF_SCOPE_NAMES];
    const seen = new Set<string>();
    for (const name of all) {
      assert.ok(!seen.has(name), `"${name}" is classified more than once`);
      seen.add(name);
    }
  });

  it('every preserved / out-of-scope entry carries a real reason', () => {
    for (const entry of [...PRESERVED_MODELS, ...OUT_OF_SCOPE_MODELS]) {
      assert.ok(
        entry.reason.trim().length >= 20,
        `"${entry.model}" needs a substantive reason — not deleting customer ` +
          'data is a ruling, and a ruling has to be justified in writing',
      );
    }
  });
});

describe('deletion coverage — every workspace-scoped model is ruled on', () => {
  it('each model with a workspaceId column is swept or preserved (exactly one)', () => {
    const swept = new Set(SWEPT_NAMES);
    const preserved = new Set(PRESERVED_NAMES);
    const unclassified: string[] = [];
    for (const name of WORKSPACE_SCOPED) {
      const inSwept = swept.has(name);
      const inPreserved = preserved.has(name);
      if (!inSwept && !inPreserved) unclassified.push(name);
    }
    assert.deepEqual(
      unclassified,
      [],
      'These models carry a workspaceId but the workspace teardown has no ruling ' +
        'about them. Add each to SWEPT_MODELS (and a deleteMany in ' +
        'tearDownWorkspaceData) or to PRESERVED_MODELS with a reason: ' +
        unclassified.join(', '),
    );
  });

  it('the whole schema is classified — swept, preserved, cascaded, or named out of scope', () => {
    const covered = expandCascadeClosure(MODELS, [
      ...SWEPT_NAMES,
      ...PRESERVED_NAMES,
      ...OUT_OF_SCOPE_NAMES,
    ]);
    const orphans = MODELS.map((m) => m.name).filter((n) => !covered.has(n));
    assert.deepEqual(
      orphans,
      [],
      'These models are not accounted for by the deletion policy: ' +
        orphans.join(', '),
    );
  });

  it('portal children + team memberships are covered TRANSITIVELY, not just by name', () => {
    // Seed the closure with swept models ONLY, and drop the children from
    // the seed set — so this asserts the cascade reasoning, not the fact
    // that we happen to have listed them.
    const indirect = new Set([
      'TeamMembership',
      'PortalClient',
      'PortalCase',
      'PortalCaseEvent',
      'PortalInvite',
      'PortalSession',
      'PortalThread',
      'PortalMessage',
      'PortalDocument',
    ]);
    const seeds = SWEPT_NAMES.filter((n) => !indirect.has(n));
    const covered = expandCascadeClosure(MODELS, seeds);
    for (const name of indirect) {
      assert.ok(
        covered.has(name),
        `${name} must be reachable from a swept model through a required ` +
          'Cascade relation',
      );
    }
  });

  it('the closure catches a FUTURE child of a swept table (and not a SetNull one)', () => {
    const synthetic: DmmfModel[] = [
      { name: 'PortalConfig', fields: [] },
      {
        name: 'FuturePortalWidget',
        fields: [
          {
            name: 'portalConfig',
            kind: 'object',
            isRequired: true,
            type: 'PortalConfig',
            relationFromFields: ['portalConfigId'],
            relationOnDelete: 'Cascade',
          },
        ],
      },
      {
        name: 'FutureGrandchild',
        fields: [
          {
            name: 'widget',
            kind: 'object',
            isRequired: true,
            type: 'FuturePortalWidget',
            relationFromFields: ['widgetId'],
            relationOnDelete: 'Cascade',
          },
        ],
      },
      {
        name: 'FutureLooselyTagged',
        fields: [
          {
            name: 'portalConfig',
            kind: 'object',
            isRequired: false,
            type: 'PortalConfig',
            relationFromFields: ['portalConfigId'],
            relationOnDelete: 'SetNull',
          },
        ],
      },
    ];
    const covered = expandCascadeClosure(synthetic, ['PortalConfig']);
    assert.ok(covered.has('FuturePortalWidget'), 'direct cascade child');
    assert.ok(covered.has('FutureGrandchild'), 'closure must be transitive');
    assert.ok(
      !covered.has('FutureLooselyTagged'),
      'a SetNull pointer leaves the row behind — it must NOT count as covered',
    );
  });
});

describe('deletion manifest ↔ implementation (no drift)', () => {
  it('every via:"prisma" swept model has a deleteMany call in deletion.ts', () => {
    const missing: string[] = [];
    for (const entry of SWEPT_MODELS) {
      if (entry.via !== 'prisma') continue;
      const needle = `tx.${clientAccessor(entry.model)}.deleteMany`;
      if (!DELETION_SOURCE.includes(needle)) missing.push(entry.model);
    }
    assert.deepEqual(
      missing,
      [],
      'SWEPT_MODELS claims these are deleted, but tearDownWorkspaceData has no ' +
        'deleteMany for them: ' + missing.join(', '),
    );
  });

  it('every knowledge-store model is handled through the store seam, not bare prisma', () => {
    for (const entry of SWEPT_MODELS) {
      if (entry.via !== 'knowledge-store') continue;
      assert.ok(
        !DELETION_SOURCE.includes(`tx.${clientAccessor(entry.model)}.deleteMany`),
        `${entry.model} must go through IKnowledgeStore.delete() ` +
          '(feedback_no_silent_vendor_lock), not a bare prisma deleteMany',
      );
    }
    assert.ok(
      DELETION_SOURCE.includes('allWorkspaceCustomerDocs'),
      'the knowledge-substrate teardown call must still be present',
    );
  });

  it('no model is BOTH swept and preserved', () => {
    const preserved = new Set(PRESERVED_NAMES);
    for (const name of SWEPT_NAMES) {
      assert.ok(!preserved.has(name), `${name} cannot be swept and preserved`);
    }
  });
});

// ── The two policy calls this gate has to keep honest ────────────────────

describe('preservation rulings stay true to the schema', () => {
  it('LlmUsageRecord still carries no customer content (billing metering only)', () => {
    // The ruling: preserved because it is the Stripe usage-metering source
    // (`stripeReportedAt`), on the same footing as Subscription /
    // BillingEvent / WorkspaceInvoice. That ruling only holds while the row
    // is counters + cost + a model name. If someone adds a prompt, a
    // response, a subject line, or any other free-text customer field, this
    // fails and the ruling must be revisited (delete, or split the table).
    const model = MODELS.find((m) => m.name === 'LlmUsageRecord');
    assert.ok(model, 'LlmUsageRecord must exist');
    const allowed = new Set([
      'id',
      'workspaceId',
      'model',
      'inputTokens',
      'outputTokens',
      'cacheCreationTokens',
      'cacheReadTokens',
      'costMicroCents',
      'sourceSurface',
      'stripeReportedAt',
      'createdAt',
    ]);
    const unexpected = model.fields
      .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
      .map((f) => f.name)
      .filter((n) => !allowed.has(n));
    assert.deepEqual(
      unexpected,
      [],
      'LlmUsageRecord grew new columns: ' + unexpected.join(', ') + '. It is ' +
        'PRESERVED through workspace teardown as a billing record — re-check ' +
        'that these carry no customer content before leaving that ruling in place.',
    );
  });

  it('OpsFlag is not workspace-scoped, so the walk-away guard survives teardown', () => {
    const model = MODELS.find((m) => m.name === 'OpsFlag');
    assert.ok(model, 'OpsFlag must exist');
    assert.ok(
      !hasWorkspaceIdColumn(model),
      'OpsFlag must stay operator-global: the guarantee walk-away guards its ' +
        'refund with a once-per-lifetime OpsFlag, and a teardown that deleted ' +
        'that flag would re-arm a refund the customer already took.',
    );
  });

  it('ComplianceCounselSignoff is per-vertical, not per-workspace', () => {
    const model = MODELS.find((m) => m.name === 'ComplianceCounselSignoff');
    assert.ok(model, 'ComplianceCounselSignoff must exist');
    assert.ok(
      !hasWorkspaceIdColumn(model),
      'ComplianceCounselSignoff has no workspaceId by design (one sign-off per ' +
        'vertical, shared across workspaces). If it gains one, it needs a ' +
        'deletion ruling.',
    );
  });
});

// ── RESTRICT audit (the reason child-before-parent ordering is safe) ─────

describe('foreign-key delete posture', () => {
  it('no relation in the schema uses Restrict / NoAction on delete', () => {
    // Prisma's DEFAULT for a required relation is Restrict — a referencing
    // row would block a parent delete. This schema sets onDelete explicitly
    // on all 92 relations, so the teardown's per-table deletes can never be
    // blocked by an FK; ordering matters only for accurate counts. If this
    // ever fails, tearDownWorkspaceData's delete order becomes load-bearing
    // and must be re-derived from the new relation.
    const offenders: string[] = [];
    for (const model of MODELS) {
      for (const field of model.fields) {
        if (field.kind !== 'object') continue;
        if ((field.relationFromFields?.length ?? 0) === 0) continue;
        const onDelete =
          field.relationOnDelete ??
          (field.isRequired ? 'Restrict (Prisma default)' : 'SetNull (Prisma default)');
        if (/Restrict|NoAction/.test(onDelete)) {
          offenders.push(`${model.name}.${field.name} -> ${field.type} [${onDelete}]`);
        }
      }
    }
    assert.deepEqual(offenders, [], offenders.join('; '));
  });
});
