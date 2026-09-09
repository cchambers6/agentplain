/**
 * lib/graph/store.ts
 *
 * The `GraphStore` port plus `InMemoryGraphStore`, its first (and today
 * only) implementation.
 *
 * WHY THERE IS NO create() ON THIS PORT
 *
 *   A `create` path is how a graph accumulates near-duplicate rows for
 *   the same real-world thing. Once a caller can create, every caller has
 *   to remember to check first, and the ones that forget are invisible
 *   until someone counts. The port therefore exposes upsert only, keyed
 *   on the natural key, so "write this party" and "write this party
 *   again" are the same call and the second one is a no-op except for
 *   `lastSeenAt`. No code path in this file inserts a second row for an
 *   existing key.
 *
 *   The same argument applies to WorkApprovalQueueItem, which does NOT
 *   have this property today - see the FINDINGS block at the end of this
 *   file.
 *
 * NATURAL KEYS
 *
 *   Node: (tenantId, typeSlug, naturalKey)
 *   Edge: (tenantId, fromEntityId, relType, toEntityId)
 *
 * IDENTITY IS CANONICALISED AT THE PORT BOUNDARY
 *
 *   `upsertEntity` and `getEntity` run `spec.naturalKey` through
 *   `naturalKeyFor(typeSlug, ...)` themselves. The alternative - a
 *   contract clause saying "the caller must pre-normalize" - was
 *   rejected, for the same reason this port has no `create()`: it makes
 *   correctness depend on every caller remembering, and the ones that
 *   forget are invisible until someone counts. Four case/whitespace
 *   spellings of one firm produced FOUR rows before this, and
 *   `graph-ledger-fetcher.nodesToLedger` skips its dedup pass on the
 *   strength of the guarantee this block makes.
 *
 *   It also has to happen here rather than in a caller because the port
 *   has a second implementation coming. A PrismaGraphStore whose
 *   @@unique sits on an un-normalized string cannot enforce this at all
 *   - the database would hold all four rows and no index would object.
 *
 *   Safe to apply unconditionally because `naturalKeyFor` is idempotent:
 *   normalizing an already-normalized key is a no-op, so the one
 *   production caller that already normalizes (`projections.partyNode`)
 *   is unaffected.
 *
 *   COST, stated rather than hidden: the key space is now the folded
 *   space. A type whose natural key is an opaque external id would lose
 *   the distinction between "AB-123" and "AB_123". `party` is the only
 *   declared type slug today; a type that needs raw ids must declare a
 *   pass-through rule in `naturalKeyFor`, not bypass this call.
 *
 * PRECEDENCE
 *
 *   A repeat write always advances `lastSeenAt` - corroboration is
 *   information even when the payload is identical. It replaces label /
 *   attributes / provenance / approvalItemId / sourceRef only when
 *   `mayOverwrite(existing, incoming)` says the incoming evidence is at
 *   least as strong. See ./provenance.
 *
 * Per `feedback_runner_portability.md`: the second implementation
 * (PrismaGraphStore) is a later unit. This one is not a mock - it is the
 * implementation the tests, fixtures and any offline tool use.
 */

import { randomUUID } from 'node:crypto';
import { naturalKeyFor } from './normalize';
import { mayOverwrite } from './provenance';
import type {
  EdgeSpec,
  GraphAttributes,
  GraphEdge,
  GraphNode,
  NodeSpec,
} from './types';

export interface EntityLookup {
  tenantId: string;
  typeSlug: string;
  naturalKey: string;
}

export interface EntityListQuery {
  tenantId: string;
  /** Omit to list every type in the tenant. */
  typeSlug?: string;
}

export interface EdgeListQuery {
  tenantId: string;
  /** Omit to list every relationship type in the tenant. */
  relType?: string;
  fromEntityId?: string;
}

/**
 * Read/write port over the entity graph. Writes are upsert-only.
 *
 * CONTRACT: an implementation MUST canonicalise `naturalKey` through
 * `naturalKeyFor(typeSlug, ...)` on both `upsertEntity` and `getEntity`,
 * so that (tenantId, typeSlug, naturalKey) holds exactly one row per
 * identity regardless of how the caller spelled it. The caller is NOT
 * required to pre-normalize; a caller that does is harmless because
 * `naturalKeyFor` is idempotent.
 *
 * Every method takes `tenantId` explicitly. Nothing in this layer reads
 * an ambient context and nothing here escalates to an operator or system
 * identity - the tenant is an argument the caller must supply, which is
 * what `__tests__/no-operator-context.test.ts` pins.
 */
export interface GraphStore {
  readonly name: string;
  upsertEntity(spec: NodeSpec): Promise<GraphNode>;
  upsertEdge(spec: EdgeSpec): Promise<GraphEdge>;
  getEntity(lookup: EntityLookup): Promise<GraphNode | null>;
  getEntityById(args: {
    tenantId: string;
    id: string;
  }): Promise<GraphNode | null>;
  listEntities(query: EntityListQuery): Promise<GraphNode[]>;
  listEdges(query: EdgeListQuery): Promise<GraphEdge[]>;
}

export interface InMemoryGraphStoreOptions {
  /** Injectable clock. Tests advance it to observe `lastSeenAt` move. */
  now?: () => Date;
  /** Injectable id source. Defaults to randomUUID. */
  newId?: () => string;
}

/**
 * Map keys are JSON-encoded tuples rather than a delimiter-joined string.
 * A delimiter needs a character that provably cannot appear in any
 * component; JSON encoding is injective for free, so no such character
 * has to exist.
 */
function entityKey(
  tenantId: string,
  typeSlug: string,
  naturalKey: string,
): string {
  return JSON.stringify([tenantId, typeSlug, naturalKey]);
}

function edgeKey(
  tenantId: string,
  fromEntityId: string,
  relType: string,
  toEntityId: string,
): string {
  return JSON.stringify([tenantId, fromEntityId, relType, toEntityId]);
}

function freezeAttributes(a: GraphAttributes | undefined): GraphAttributes {
  return Object.freeze({ ...(a ?? {}) });
}

function requireNonEmpty(value: string | undefined, field: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error(`GraphStore: ${field} is required and must be non-empty`);
  }
  return trimmed;
}

/**
 * Process-local graph. Holds three indexes over the same rows: by node
 * natural key, by node id (edge endpoints are ids), and by edge natural
 * key.
 */
export class InMemoryGraphStore implements GraphStore {
  readonly name = 'in-memory' as const;

  private readonly nodesByKey = new Map<string, GraphNode>();
  private readonly nodesById = new Map<string, GraphNode>();
  private readonly edgesByKey = new Map<string, GraphEdge>();

  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(options: InMemoryGraphStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => randomUUID());
  }

  /** Row count, for tests that assert no duplicate was minted. */
  get entityCount(): number {
    return this.nodesByKey.size;
  }

  get edgeCount(): number {
    return this.edgesByKey.size;
  }

  async upsertEntity(spec: NodeSpec): Promise<GraphNode> {
    const tenantId = requireNonEmpty(spec.tenantId, 'tenantId');
    const typeSlug = requireNonEmpty(spec.typeSlug, 'typeSlug');
    // Canonicalise, then reject. `.trim()` alone is normalization too -
    // just the weakest possible version, and the reason a whitespace-only
    // variant used to collapse while a case variant did not.
    //
    // An empty result is `naturalKeyFor` saying "not identifiable".
    // Accepting it would make every unidentifiable input collide on one
    // row, which reads downstream as a real, heavily-corroborated entity.
    const naturalKey = requireNonEmpty(
      naturalKeyFor(typeSlug, spec.naturalKey ?? ''),
      'naturalKey',
    );
    const label = requireNonEmpty(spec.label, 'label');

    const key = entityKey(tenantId, typeSlug, naturalKey);
    const observedAt = spec.observedAt ?? this.now();
    const existing = this.nodesByKey.get(key);

    if (!existing) {
      const created: GraphNode = {
        id: this.newId(),
        tenantId,
        typeSlug,
        naturalKey,
        label,
        provenance: spec.provenance,
        attributes: freezeAttributes(spec.attributes),
        approvalItemId: spec.approvalItemId ?? null,
        sourceRef: spec.sourceRef ?? null,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      };
      this.nodesByKey.set(key, created);
      this.nodesById.set(created.id, created);
      return { ...created };
    }

    // Repeat write. `lastSeenAt` always advances; everything else moves
    // only if the incoming evidence is at least as strong.
    const next: GraphNode = { ...existing };
    if (observedAt.getTime() > next.lastSeenAt.getTime()) {
      next.lastSeenAt = observedAt;
    }
    if (mayOverwrite(existing.provenance, spec.provenance)) {
      next.label = label;
      next.provenance = spec.provenance;
      next.attributes = freezeAttributes({
        ...existing.attributes,
        ...(spec.attributes ?? {}),
      });
      next.approvalItemId = spec.approvalItemId ?? existing.approvalItemId;
      next.sourceRef = spec.sourceRef ?? existing.sourceRef;
    }
    // `id` and `firstSeenAt` are never reassigned on either branch.
    this.nodesByKey.set(key, next);
    this.nodesById.set(next.id, next);
    return { ...next };
  }

  async upsertEdge(spec: EdgeSpec): Promise<GraphEdge> {
    const tenantId = requireNonEmpty(spec.tenantId, 'tenantId');
    const relType = requireNonEmpty(spec.relType, 'relType');
    const fromEntityId = requireNonEmpty(spec.fromEntityId, 'fromEntityId');
    const toEntityId = requireNonEmpty(spec.toEntityId, 'toEntityId');

    // Both endpoints must exist and must belong to the SAME tenant as the
    // edge. Without this an edge is a cross-tenant read primitive: node
    // ids are opaque, so a caller holding one from another workspace could
    // otherwise link it in and traverse to it.
    const from = this.nodesById.get(fromEntityId);
    const to = this.nodesById.get(toEntityId);
    if (!from || from.tenantId !== tenantId) {
      throw new Error(
        `GraphStore: edge fromEntityId ${fromEntityId} is not a node in tenant ${tenantId}`,
      );
    }
    if (!to || to.tenantId !== tenantId) {
      throw new Error(
        `GraphStore: edge toEntityId ${toEntityId} is not a node in tenant ${tenantId}`,
      );
    }

    const key = edgeKey(tenantId, fromEntityId, relType, toEntityId);
    const observedAt = spec.observedAt ?? this.now();
    const existing = this.edgesByKey.get(key);

    if (!existing) {
      const created: GraphEdge = {
        id: this.newId(),
        tenantId,
        fromEntityId,
        relType,
        toEntityId,
        provenance: spec.provenance,
        attributes: freezeAttributes(spec.attributes),
        approvalItemId: spec.approvalItemId ?? null,
        sourceRef: spec.sourceRef ?? null,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      };
      this.edgesByKey.set(key, created);
      return { ...created };
    }

    const next: GraphEdge = { ...existing };
    if (observedAt.getTime() > next.lastSeenAt.getTime()) {
      next.lastSeenAt = observedAt;
    }
    if (mayOverwrite(existing.provenance, spec.provenance)) {
      next.provenance = spec.provenance;
      next.attributes = freezeAttributes({
        ...existing.attributes,
        ...(spec.attributes ?? {}),
      });
      next.approvalItemId = spec.approvalItemId ?? existing.approvalItemId;
      next.sourceRef = spec.sourceRef ?? existing.sourceRef;
    }
    this.edgesByKey.set(key, next);
    return { ...next };
  }

  async getEntity(lookup: EntityLookup): Promise<GraphNode | null> {
    // Reads canonicalise on the same rule as writes. If only the write
    // side normalized, a caller holding the raw display name could not
    // find the row it had just written.
    const found = this.nodesByKey.get(
      entityKey(
        lookup.tenantId,
        lookup.typeSlug,
        naturalKeyFor(lookup.typeSlug, lookup.naturalKey ?? ''),
      ),
    );
    return found ? { ...found } : null;
  }

  async getEntityById(args: {
    tenantId: string;
    id: string;
  }): Promise<GraphNode | null> {
    const found = this.nodesById.get(args.id);
    // Tenant is re-checked on the way out, not just on the way in.
    if (!found || found.tenantId !== args.tenantId) return null;
    return { ...found };
  }

  async listEntities(query: EntityListQuery): Promise<GraphNode[]> {
    const out: GraphNode[] = [];
    for (const node of this.nodesByKey.values()) {
      if (node.tenantId !== query.tenantId) continue;
      if (query.typeSlug && node.typeSlug !== query.typeSlug) continue;
      out.push({ ...node });
    }
    return out;
  }

  async listEdges(query: EdgeListQuery): Promise<GraphEdge[]> {
    const out: GraphEdge[] = [];
    for (const edge of this.edgesByKey.values()) {
      if (edge.tenantId !== query.tenantId) continue;
      if (query.relType && edge.relType !== query.relType) continue;
      if (query.fromEntityId && edge.fromEntityId !== query.fromEntityId) {
        continue;
      }
      out.push({ ...edge });
    }
    return out;
  }
}

/* -- FINDINGS -------------------------------------------------------------
 *
 * 1. WorkApprovalQueueItem has no natural key. The comment at
 *    lib/skills/law-intake-conflict-screen/prisma-approval-sink.ts:46-48
 *    says "The matterId serves as the stable refId so re-runs overwrite
 *    in place rather than accumulating." Nothing implements that:
 *    `record()` calls `tx.workApprovalQueueItem.create(...)`, and
 *    prisma/schema.prisma has four @@index entries on the model and no
 *    @@unique. Re-running the conflict screen for one matter appends a
 *    new PENDING row every time. The precedent for the fix is already in
 *    the schema - @@unique([workspaceId, sourceTable, sourceId,
 *    actionType]) on the value-impact model - so the shape is
 *    @@unique([workspaceId, refTable, refId, kind]) plus an upsert.
 *
 *    That matters to this unit specifically: a projection is triggered by
 *    an approval decision, so duplicate approval rows for one matter mean
 *    the projection runs N times. The graph absorbs that (it is
 *    idempotent by construction - see the idempotency assertion in
 *    __tests__/party-graph-slice.test.ts), but the operator still sees N
 *    cards.
 *
 * 2. This store is single-process and has no transaction. Applying a
 *    projection is N+M separate upserts, so a crash halfway leaves the
 *    nodes without their edges. That is survivable here because every
 *    write is idempotent and replay is cheap, but PrismaGraphStore must
 *    take a Prisma.TransactionClient the way PrismaConflictApprovalSink
 *    does (its `tx` option, at prisma-approval-sink.ts:50-55) so the
 *    projection can join the approval decision's own transaction. If it
 *    does not, an approval can commit while its graph rows do not.
 */
