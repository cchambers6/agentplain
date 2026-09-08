/**
 * lib/graph/projections.ts
 *
 * Approval-to-graph projections. One registry, keyed by approval kind,
 * with exactly ONE entry on day one.
 *
 * ADMISSION CRITERION - read this before adding a second entry
 *
 *   A kind may declare a projection only if its `refId` is the natural
 *   key of a THING, not of a RUN.
 *
 *   COMPLIANCE_FLAG from the conflict screen qualifies: its refId is the
 *   matterId, and the matter exists whether or not the screen ever ran.
 *   A kind whose refId is a WebhookEvent id, a SkillRun id, a draft id or
 *   a message id does not qualify - projecting one of those mints a graph
 *   node per execution, so the graph grows with activity instead of with
 *   the customer's world, and "how many parties does this firm have"
 *   becomes "how many times did the agent fire".
 *
 *   The test for it: if you re-ran the producing skill on unchanged
 *   inputs and got a different refId, the kind fails the criterion.
 *
 * PROJECTIONS ARE PURE
 *
 *   `project()` takes a decrypted payload and returns specs. No I/O, no
 *   Prisma, no model call, no fetch, no clock read (the timestamp is an
 *   input). This is what makes the projection testable with no database,
 *   and it is what lets the applier decide the failure policy - see
 *   ./apply.
 *
 * NO PRISMA ENUM IMPORT
 *
 *   `WorkApprovalKindName` below is declared locally as a string union.
 *   Importing the generated `WorkApprovalKind` would make this layer, and
 *   every test of it, depend on `prisma generate`.
 */

import { naturalKeyFor } from './normalize';
import {
  ADVERSE_TO_REL,
  MATTER_STATUS_ATTR,
  PARTY_ROLE_ATTR,
  PARTY_TYPE_SLUG,
  type GraphAttributes,
  type NodeSpec,
  type Provenance,
} from './types';

/**
 * The subset of WorkApprovalKind this layer has an opinion about. Adding
 * a name here is a claim that the kind was checked against the admission
 * criterion above - it is not a mirror of the Prisma enum and must not
 * become one.
 */
export type WorkApprovalKindName = 'COMPLIANCE_FLAG';

/** Ref-table the conflict screen stamps. Mirrors CONFLICT_SCREEN_REF_TABLE
 *  in lib/skills/law-intake-conflict-screen/prisma-approval-sink.ts. It is
 *  duplicated rather than imported so lib/graph stays free of any module
 *  that imports '@prisma/client'. */
export const LAW_MATTER_REF_TABLE = 'LawMatter';

/** Provenance every approval-minted record carries. */
export const APPROVAL_PROVENANCE: Provenance = 'APPROVED';

/**
 * What the applier hands a projection. `payload` is already decrypted -
 * production rows are written through `encryptPayloadForWrite`, and
 * decryption is I/O-adjacent, so it happens outside the pure function.
 */
export interface ApprovalProjectionInput {
  tenantId: string;
  approvalItemId: string;
  kind: string;
  refTable: string;
  refId: string;
  payload: unknown;
  /** When the human decided. Becomes `observedAt` on every spec. */
  decidedAt: Date;
}

/**
 * An edge a projection wants, expressed in natural keys. A pure function
 * cannot know node ids (they are assigned by the store), so it names its
 * endpoints and the applier resolves them.
 */
export interface EdgeDraft {
  fromTypeSlug: string;
  fromNaturalKey: string;
  toTypeSlug: string;
  toNaturalKey: string;
  relType: string;
  provenance: Provenance;
  attributes?: GraphAttributes;
}

export interface ProjectionResult {
  nodes: NodeSpec[];
  edges: EdgeDraft[];
}

export interface NodeProjection {
  readonly name: string;
  readonly kind: WorkApprovalKindName;
  /** Guard. False means this item is not projectable and nothing runs. */
  appliesTo(input: ApprovalProjectionInput): boolean;
  /** PURE. No I/O. */
  project(input: ApprovalProjectionInput): ProjectionResult;
}

// -- payload readers -------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 2 ? t : null;
}

function asNameList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const n = asName(item);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Opposing parties, preferring the explicit list.
 *
 * FINDING: the COMPLIANCE_FLAG payload built by
 * `buildConflictApprovalRow` does NOT carry the intake's
 * `opposingParties`. It carries `conflicts[].opposingPartyText`, which
 * only contains the parties that MATCHED the ledger. Projecting from
 * that fallback therefore records a strict subset of the matter's
 * parties, and the subset it records is exactly the ones already known -
 * so the graph learns nothing new from a flagged matter. The fix belongs
 * in the sink (add `opposingParties` to the payload); until then this
 * function reads the explicit key when present and degrades loudly
 * through the fallback when it is not.
 */
function readOpposingParties(payload: Record<string, unknown>): string[] {
  const explicit = asNameList(payload.opposingParties);
  if (explicit.length > 0) return explicit;
  const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
  return asNameList(
    conflicts.map((c) => asRecord(c).opposingPartyText),
  );
}

function readMatterStatus(
  payload: Record<string, unknown>,
): 'active' | 'closed' | null {
  const raw =
    typeof payload[MATTER_STATUS_ATTR] === 'string'
      ? (payload[MATTER_STATUS_ATTR] as string).toLowerCase()
      : '';
  if (raw === 'active' || raw === 'open' || raw === 'in-progress') {
    return 'active';
  }
  if (raw === 'closed') return 'closed';
  // Unknown stays unknown. Writing a default here would put a guess into
  // an APPROVED-provenance record, where downstream reads it as fact.
  return null;
}

function partyNode(args: {
  input: ApprovalProjectionInput;
  name: string;
  role: 'client' | 'opposing';
  matterStatus: 'active' | 'closed' | null;
}): NodeSpec | null {
  const naturalKey = naturalKeyFor(PARTY_TYPE_SLUG, args.name);
  if (naturalKey.length === 0) return null;
  const attributes: Record<string, string> = {
    [PARTY_ROLE_ATTR]: args.role,
  };
  if (args.matterStatus) attributes[MATTER_STATUS_ATTR] = args.matterStatus;
  return {
    tenantId: args.input.tenantId,
    typeSlug: PARTY_TYPE_SLUG,
    naturalKey,
    label: args.name,
    provenance: APPROVAL_PROVENANCE,
    attributes,
    approvalItemId: args.input.approvalItemId,
    // The matter, not the approval row: the matter is the thing that
    // exists independently, per the admission criterion.
    sourceRef: args.input.refId,
    observedAt: args.input.decidedAt,
  };
}

/**
 * COMPLIANCE_FLAG on refTable='LawMatter' -> one `party` node per named
 * party on the matter, plus one `adverse_to` edge from the firm's own
 * client to each opposing party.
 *
 * Guarded on refTable because COMPLIANCE_FLAG is a shared kind: other
 * producers write it against other ref-tables, and their payloads have
 * nothing to do with parties. The kind alone is not enough of a
 * discriminator to project on.
 */
export const lawMatterPartyProjection: NodeProjection = {
  name: 'law-matter-party',
  kind: 'COMPLIANCE_FLAG',

  appliesTo(input) {
    return (
      input.kind === 'COMPLIANCE_FLAG' &&
      input.refTable === LAW_MATTER_REF_TABLE &&
      input.refId.trim().length > 0 &&
      input.tenantId.trim().length > 0
    );
  },

  project(input) {
    const nodes: NodeSpec[] = [];
    const edges: EdgeDraft[] = [];
    if (!this.appliesTo(input)) return { nodes, edges };

    const payload = asRecord(input.payload);
    const matterStatus = readMatterStatus(payload);
    const seenKeys = new Set<string>();

    const push = (name: string, role: 'client' | 'opposing') => {
      const spec = partyNode({ input, name, role, matterStatus });
      if (!spec) return null;
      if (seenKeys.has(spec.naturalKey)) return spec.naturalKey;
      seenKeys.add(spec.naturalKey);
      nodes.push(spec);
      return spec.naturalKey;
    };

    const prospect = asName(payload.prospectName);
    const clientKey = prospect ? push(prospect, 'client') : null;

    for (const opposing of readOpposingParties(payload)) {
      const key = push(opposing, 'opposing');
      if (!key || !clientKey) continue;
      // A party that normalizes onto the client is not adverse to itself.
      // This happens with intakes that list the prospect's own trading
      // name among the opposing parties.
      if (key === clientKey) continue;
      edges.push({
        fromTypeSlug: PARTY_TYPE_SLUG,
        fromNaturalKey: clientKey,
        toTypeSlug: PARTY_TYPE_SLUG,
        toNaturalKey: key,
        relType: ADVERSE_TO_REL,
        provenance: APPROVAL_PROVENANCE,
        attributes: { matterId: input.refId },
      });
    }

    return { nodes, edges };
  },
};

/**
 * The registry. Exactly one entry - see the admission criterion at the
 * top of this file before adding a second.
 */
export const NODE_PROJECTIONS: Readonly<
  Record<WorkApprovalKindName, NodeProjection>
> = Object.freeze({
  COMPLIANCE_FLAG: lawMatterPartyProjection,
});

/**
 * Look a projection up by kind. Takes `string`, not the union, so a kind
 * this layer has never considered is a lookup MISS rather than a type
 * error at the call site - the caller passes whatever the database row
 * says, and an unrecognised kind must simply not project.
 */
export function projectionFor(kind: string): NodeProjection | null {
  const table = NODE_PROJECTIONS as Record<string, NodeProjection | undefined>;
  return table[kind] ?? null;
}
