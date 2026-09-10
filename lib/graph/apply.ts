/**
 * lib/graph/apply.ts
 *
 * The projection wrapper: the one place where a pure projection meets a
 * GraphStore and does I/O.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 *   ./projections must stay pure (no I/O) and ./store must stay a port
 *   plus its implementation. The glue is neither, so it lives on its own
 *   rather than compromising one of them. This is the only file in
 *   lib/graph that both imports the registry and calls a store.
 *
 * FAILURE POLICY
 *
 *   `projectApprovalToGraph` NEVER throws.
 *
 *   The caller is an approval decision (lib/approvals/decisions.ts). That
 *   decision is the customer's, it has already been recorded, and it is
 *   the thing with real-world consequences. A graph write is derived
 *   bookkeeping. If the bookkeeping fails, the decision must still stand
 *   - so every store call is isolated and its error is collected rather
 *   than propagated. This mirrors the existing swallowed try/catch around
 *   `captureDraftRejectSignal` at lib/approvals/decisions.ts:116-128.
 *
 *   Swallowing is not the same as hiding: every failure lands in the
 *   returned report AND goes to `onError` (console.warn by default), and
 *   the graph is idempotent, so a later replay repairs the gap.
 */

import {
  projectionFor,
  type ApprovalProjectionInput,
  type EdgeDraft,
  type ProjectionResult,
} from './projections';
import type { GraphStore } from './store';
import type { NodeSpec } from './types';

export interface ProjectionApplyOptions {
  /**
   * Where swallowed failures go. Defaults to console.warn, matching the
   * shape used around captureDraftRejectSignal. Tests inject a collector
   * so the assertion can prove the error was reported, not just eaten.
   */
  onError?: (stage: string, error: Error) => void;
}

export interface ProjectionApplyReport {
  /** False when no projection matched, or its guard rejected the item. */
  applied: boolean;
  /** Human-readable reason when `applied` is false. */
  skippedReason: string | null;
  projectionName: string | null;
  /** Ids of nodes successfully written (created or refreshed). */
  nodeIds: string[];
  edgeIds: string[];
  /** One message per isolated failure. Empty on a fully clean apply. */
  errors: string[];
}

function emptyReport(reason: string | null): ProjectionApplyReport {
  return {
    applied: false,
    skippedReason: reason,
    projectionName: null,
    nodeIds: [],
    edgeIds: [],
    errors: [],
  };
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Project one decided approval item into the graph.
 *
 * Order matters: every node is upserted first, building a natural-key to
 * node-id map, and only then are edges resolved against that map. An edge
 * whose endpoint failed to write is skipped with an error rather than
 * written against a stale or guessed id.
 */
export async function projectApprovalToGraph(
  store: GraphStore,
  input: ApprovalProjectionInput,
  options: ProjectionApplyOptions = {},
): Promise<ProjectionApplyReport> {
  const onError =
    options.onError ??
    ((stage: string, error: Error) => {
      console.warn(`graph projection failed (ignored) [${stage}]: ${error.message}`);
    });

  const projection = projectionFor(input.kind);
  if (!projection) {
    return emptyReport(`no projection registered for kind ${input.kind}`);
  }
  if (!projection.appliesTo(input)) {
    return emptyReport(
      `${projection.name} does not apply to refTable ${input.refTable}`,
    );
  }

  let planned: ProjectionResult;
  try {
    // A projection is pure, but "pure" is a convention, not a guarantee -
    // a malformed payload can still make one throw. Treat it like any
    // other isolated failure.
    planned = projection.project(input);
  } catch (err) {
    const error = toError(err);
    onError('project', error);
    const report = emptyReport('projection threw');
    report.projectionName = projection.name;
    report.errors.push(`project: ${error.message}`);
    return report;
  }

  const report: ProjectionApplyReport = {
    applied: true,
    skippedReason: null,
    projectionName: projection.name,
    nodeIds: [],
    edgeIds: [],
    errors: [],
  };

  const idByKey = new Map<string, string>();
  for (const spec of planned.nodes) {
    try {
      const node = await store.upsertEntity(spec);
      idByKey.set(nodeMapKey(spec), node.id);
      report.nodeIds.push(node.id);
    } catch (err) {
      const error = toError(err);
      onError('upsertEntity', error);
      report.errors.push(`upsertEntity ${spec.naturalKey}: ${error.message}`);
    }
  }

  for (const draft of planned.edges) {
    const fromId = idByKey.get(edgeEndKey(draft, 'from'));
    const toId = idByKey.get(edgeEndKey(draft, 'to'));
    if (!fromId || !toId) {
      const missing = !fromId ? draft.fromNaturalKey : draft.toNaturalKey;
      const message = `edge ${draft.relType}: endpoint ${missing} was not written`;
      onError('resolveEdge', new Error(message));
      report.errors.push(message);
      continue;
    }

    try {
      const edge = await store.upsertEdge({
        tenantId: input.tenantId,
        fromEntityId: fromId,
        relType: draft.relType,
        toEntityId: toId,
        provenance: draft.provenance,
        attributes: draft.attributes,
        approvalItemId: input.approvalItemId,
        sourceRef: input.refId,
        observedAt: input.decidedAt,
      });
      report.edgeIds.push(edge.id);
    } catch (err) {
      const error = toError(err);
      onError('upsertEdge', error);
      report.errors.push(`upsertEdge ${draft.relType}: ${error.message}`);
    }
  }

  return report;
}

// -- key helpers ----------------------------------------------------------

function nodeMapKey(spec: NodeSpec): string {
  return JSON.stringify([spec.typeSlug, spec.naturalKey]);
}

function edgeEndKey(draft: EdgeDraft, end: 'from' | 'to'): string {
  return end === 'from'
    ? JSON.stringify([draft.fromTypeSlug, draft.fromNaturalKey])
    : JSON.stringify([draft.toTypeSlug, draft.toNaturalKey]);
}
