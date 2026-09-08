/**
 * lib/graph/types.ts
 *
 * Port types for the per-customer entity graph.
 *
 * DATABASE-FREE BY CONSTRUCTION
 *
 *   Nothing in lib/graph imports '@prisma/client'. This layer compiles,
 *   runs and tests with no generated client, no migration and no build.
 *   That is deliberate: the migrations stuck behind the failed one do
 *   not block any of the behaviour proved here.
 *
 * TENANT FIELD NAMING
 *
 *   The port says `tenantId`. The Prisma column will say `workspaceId`.
 *   The rename lives in exactly one place - the future PrismaGraphStore
 *   adapter, plus GraphLedgerFetcher, which receives a `workspaceId` from
 *   the LedgerFetcher port and hands it on as `tenantId`. Keeping the
 *   port name distinct means the mapping boundary is a named seam rather
 *   than an assumption spread across the layer.
 *
 * PROVENANCE IS A TYPESCRIPT UNION, NOT A PRISMA ENUM
 *
 *   A Prisma enum would drag the generated client into every consumer and
 *   would put a migration between us and the first passing test. The
 *   union below is the source of truth for this layer; a later migration
 *   mirrors it as a Postgres enum with the same four names.
 *
 * Per `project_no_outbound_architecture.md`: nothing here calls out.
 * The graph records what was already decided; it never decides.
 */

// -- Provenance -----------------------------------------------------------

/**
 * Where a node or edge came from, strongest evidence first. The rank
 * order and the two predicates that consume it live in ./provenance.
 *
 *   CONNECTOR - read from a customer-authorized system of record.
 *   CUSTOMER  - typed or uploaded by the customer themselves.
 *   APPROVED  - minted from a human approval decision in /approvals.
 *   INFERRED  - a machine guess. Never authoritative.
 */
export type Provenance = 'CONNECTOR' | 'CUSTOMER' | 'APPROVED' | 'INFERRED';

// -- Attributes -----------------------------------------------------------

/**
 * Flat, JSON-safe bag. Deliberately not nested: the natural key carries
 * identity, attributes carry only scalars we are willing to merge on a
 * same-or-higher-provenance write.
 */
export type GraphAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;

// -- Write specs ----------------------------------------------------------

/**
 * The input to `GraphStore.upsertEntity`. There is no create spec - see
 * the note on `GraphStore` in ./store for why the port exposes upsert
 * only.
 */
export interface NodeSpec {
  /** Tenant scope. Maps to `workspaceId` at the Prisma boundary. */
  tenantId: string;
  /** Node type, lower-snake ('party'). */
  typeSlug: string;
  /**
   * Identity within (tenantId, typeSlug). Produced by `naturalKeyFor`;
   * never a display string, never hand-rolled by the caller.
   */
  naturalKey: string;
  /** Human-facing name, as observed at this provenance. */
  label: string;
  provenance: Provenance;
  attributes?: GraphAttributes;
  /**
   * The WorkApprovalQueueItem this node was minted from, when the
   * provenance is APPROVED. Null for every other provenance.
   */
  approvalItemId?: string | null;
  /**
   * Upstream identifier for the thing that produced the node. For the
   * law-matter projection this is the matterId.
   */
  sourceRef?: string | null;
  /** When the evidence was observed. Defaults to the store's clock. */
  observedAt?: Date;
}

/**
 * The input to `GraphStore.upsertEdge`. Endpoints are node ids, so the
 * caller resolves nodes first. Edge drafts expressed in natural keys -
 * what a pure projection is able to emit - live in ./projections.
 */
export interface EdgeSpec {
  tenantId: string;
  fromEntityId: string;
  /** Relationship type, lower-snake ('adverse_to'). */
  relType: string;
  toEntityId: string;
  provenance: Provenance;
  attributes?: GraphAttributes;
  approvalItemId?: string | null;
  sourceRef?: string | null;
  observedAt?: Date;
}

// -- Read shapes ----------------------------------------------------------

export interface GraphNode {
  id: string;
  tenantId: string;
  typeSlug: string;
  naturalKey: string;
  label: string;
  provenance: Provenance;
  attributes: GraphAttributes;
  approvalItemId: string | null;
  sourceRef: string | null;
  /** Set once, on first write. Never moves. */
  firstSeenAt: Date;
  /** Advanced by every write, including a write that changes nothing else. */
  lastSeenAt: Date;
}

export interface GraphEdge {
  id: string;
  tenantId: string;
  fromEntityId: string;
  relType: string;
  toEntityId: string;
  provenance: Provenance;
  attributes: GraphAttributes;
  approvalItemId: string | null;
  sourceRef: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

// -- Well-known slugs -----------------------------------------------------

/** The only node type with a projection on day one. */
export const PARTY_TYPE_SLUG = 'party';

/** Opposing-party relationship minted by the law-matter projection. */
export const ADVERSE_TO_REL = 'adverse_to';

/**
 * Attribute key carrying the party's role on the matter that minted it:
 * 'client' (the firm's own client) or 'opposing'. `LedgerEntry` has no
 * role field, so this attribute is the only place the distinction
 * survives the trip through the LedgerFetcher port. See the FINDINGS
 * block in lib/skills/law-intake-conflict-screen/graph-ledger-fetcher.ts.
 */
export const PARTY_ROLE_ATTR = 'partyRole';

/**
 * Attribute key carrying matter status ('active' | 'closed') when the
 * source knows it. Absent means unknown; each consumer picks its own
 * conservative default rather than inheriting one from here.
 */
export const MATTER_STATUS_ATTR = 'matterStatus';
