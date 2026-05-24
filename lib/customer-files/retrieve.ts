/**
 * lib/customer-files/retrieve.ts
 *
 * Per-fire retrieval pass — the runner calls this with the inbound
 * message text to pull back the top-K CUSTOMER-kind knowledge snippets
 * for the workspace. The runner passes them through to the draft
 * prompt composer so the model writes a reply grounded in the
 * workspace's actual files.
 *
 * Tenant isolation is enforced THREE WAYS:
 *   (a) The knowledge store is built with an RlsContext scoped to the
 *       caller's workspaceId.
 *   (b) The search filter restricts to contextKind=CUSTOMER, and the
 *       database RLS policy on Embedding silently drops rows whose
 *       workspaceId mismatches.
 *   (c) THIS function double-checks every returned hit's workspaceId
 *       against the caller — any cross-workspace leak throws.
 *
 * The threefold guard means a future bug in any one layer cannot
 * surface another workspace's content to the draft prompt.
 */

import { getKnowledgeStore } from '../knowledge';
import type { IKnowledgeStore, KnowledgeSearchHit } from '../knowledge/types';
import type { RlsContext } from '../db/rls';
import type { CustomerContextSnippet } from './render';

export interface RetrieveCustomerContextArgs {
  workspaceId: string;
  /** Plain-text query — usually the inbound message subject + body. */
  query: string;
  /** Top-K snippets to return. Default 5. */
  k?: number;
  /** Override the store. Tests inject the in-memory store. */
  store?: IKnowledgeStore;
  /** RLS context used to build the store when not overridden. Defaults
   *  to a workspace-scoped customer context for the caller. */
  rlsContext?: RlsContext;
}

export async function retrieveCustomerContext(
  args: RetrieveCustomerContextArgs,
): Promise<CustomerContextSnippet[]> {
  if (!args.workspaceId) {
    throw new Error('retrieveCustomerContext requires a workspaceId');
  }
  const ctx: RlsContext = args.rlsContext ?? {
    userId: null,
    workspaceId: args.workspaceId,
    isOperator: false,
  };
  const store = args.store ?? getKnowledgeStore(ctx);
  const search = await store.search({
    query: args.query,
    k: clampK(args.k),
    contextKinds: ['CUSTOMER'],
  });
  if (!search.ok) {
    // Retrieval is best-effort — never fail the loop because the
    // knowledge store was unavailable. Operator dashboards will surface
    // the error elsewhere.
    return [];
  }
  const hits = search.value.filter((hit) =>
    assertSameWorkspace(hit, args.workspaceId),
  );
  return hits.map((hit) => toSnippet(hit));
}

function clampK(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 5;
  return Math.min(Math.floor(raw), 20);
}

function assertSameWorkspace(
  hit: KnowledgeSearchHit,
  workspaceId: string,
): boolean {
  if (hit.contextKind !== 'CUSTOMER') return false;
  if (!hit.workspaceId) return false;
  if (hit.workspaceId !== workspaceId) {
    // Defense in depth — RLS should never return a foreign-workspace
    // row, but if it did we want a loud failure, not a silent leak.
    throw new Error(
      `retrieveCustomerContext: cross-workspace hit from store (got ${hit.workspaceId}, expected ${workspaceId}) — RLS isolation invariant violated`,
    );
  }
  return true;
}

function toSnippet(hit: KnowledgeSearchHit): CustomerContextSnippet {
  return {
    title: hit.title,
    body: hit.body,
    sourceUrl: hit.sourceUrl,
    similarity: hit.similarity,
    metadata: hit.metadata,
  };
}
