/**
 * lib/skills/law-intake-conflict-screen/graph-ledger-fetcher.ts
 *
 * Third implementation of `LedgerFetcher`. Reads the firm's parties out
 * of the per-customer entity graph instead of guessing them from
 * filenames.
 *
 * WHY A THIRD ONE
 *
 *   `PrismaLedgerFetcher` derives a party name from a KnowledgeDocument
 *   title when no explicit metadata is present (prisma-ledger-fetcher.ts
 *   :29-44). That heuristic strips a chunk suffix, a dash-clause and a
 *   file extension off a filename and treats the remainder as a client.
 *   It was the strongest source available at the time, but its inputs are
 *   filenames: "Smith v Jones - engagement letter.pdf" yields the party
 *   "Smith v Jones", and an untitled scan yields whatever the scanner
 *   named it. Every entry it produces carries the same unrecorded
 *   confidence.
 *
 *   The graph records parties that came from a human approval decision, a
 *   customer-authorized connector, or the customer's own typing, and it
 *   records WHICH of those each one was. That distinction is the whole
 *   point: see the status mapping below, where a machine guess is routed
 *   to a different conflict verdict than an approved fact.
 *
 *   Same port, no change to `skill.ts`. Per
 *   `feedback_runner_portability.md` the port now has three independent
 *   implementations (prisma, json, graph), which is the strongest
 *   evidence available that the interface is honest.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Reads the store
 * fresh on every call; holds no cache.
 *
 * Per `project_no_outbound_architecture.md`: read-only. No writes, no
 * outbound calls.
 */

import { isEmbeddable } from '../../graph/provenance';
import type { GraphStore } from '../../graph/store';
import {
  MATTER_STATUS_ATTR,
  PARTY_ROLE_ATTR,
  PARTY_TYPE_SLUG,
  type GraphNode,
} from '../../graph/types';
import { skillError, skillOk, type SkillResult } from '../types';
import type { LedgerEntry, LedgerFetcher } from './types';

export interface GraphLedgerFetcherOptions {
  store: GraphStore;
  /** Override the node type read. Defaults to 'party'. */
  typeSlug?: string;
}

export class GraphLedgerFetcher implements LedgerFetcher {
  readonly name = 'graph' as const;

  constructor(private readonly options: GraphLedgerFetcherOptions) {}

  async fetchLedger(args: {
    workspaceId: string;
  }): Promise<SkillResult<LedgerEntry[]>> {
    try {
      // The one place the port's `workspaceId` becomes the graph's
      // `tenantId`. They are the same value; the rename is deliberate so
      // the boundary is greppable.
      const nodes = await this.options.store.listEntities({
        tenantId: args.workspaceId,
        typeSlug: this.options.typeSlug ?? PARTY_TYPE_SLUG,
      });
      return skillOk(nodesToLedger(nodes));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `GraphLedgerFetcher failed for workspace ${args.workspaceId}: ${message}`,
      );
    }
  }
}

/**
 * Map graph party nodes onto ledger rows. Exported so the mapping can be
 * asserted without a store.
 *
 * The store already enforces one row per (tenantId, typeSlug,
 * naturalKey), so unlike `docsToLedger` in the Prisma fetcher there is no
 * dedup pass here - deduplication happened at write time, which is the
 * only place it can be done without losing the merge history.
 */
export function nodesToLedger(nodes: GraphNode[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const node of nodes) {
    const clientName = node.label.trim();
    if (clientName.length < 2) continue;
    out.push({
      clientName,
      status: ledgerStatusFor(node),
      matterLabel: matterLabelFor(node),
    });
  }
  return out;
}

/**
 * PROVENANCE CHANGES THE VERDICT - this is the branch that does it.
 *
 * `LedgerEntry.status` is the only lever a fetcher has over the screen's
 * verdict: `skill.ts` maps an opposing-party hit against an ACTIVE entry
 * to severity 'adverse', which `computeStatus` escalates to
 * 'needs-counsel-review', and a hit against a CLOSED entry to
 * 'former-adverse', which lands on 'flagged'.
 *
 * So:
 *
 *   NOT EMBEDDABLE (INFERRED) -> 'active', always.
 *       A machine guess may raise a question; it may never assert a
 *       conflict. Forcing the strict branch means an inferred party can
 *       only ever produce 'needs-counsel-review' - a human is asked. It
 *       can never produce 'flagged', which reads as a finding.
 *
 *   EMBEDDABLE -> whatever the matter status attribute says, defaulting
 *       to 'closed' when the source did not record one. Same default as
 *       PrismaLedgerFetcher's `extractStatus`, so the two agree.
 *
 * The alternative - dropping INFERRED rows from the ledger - was
 * rejected. Dropping makes the guess invisible, and on a ledger with
 * other entries it converts a question into a 'clear' verdict, which is
 * the one outcome `computeStatus` was specifically written to prevent.
 */
function ledgerStatusFor(node: GraphNode): 'active' | 'closed' {
  if (!isEmbeddable(node.provenance)) return 'active';
  return node.attributes[MATTER_STATUS_ATTR] === 'active' ? 'active' : 'closed';
}

/**
 * Human-readable provenance trail. `matterLabel` is echoed verbatim into
 * the attorney notice body by `renderAttorneyNotice`, so this is where an
 * inferred or approval-minted party discloses itself to the reader rather
 * than looking like a ledger fact.
 */
function matterLabelFor(node: GraphNode): string {
  const role = node.attributes[PARTY_ROLE_ATTR];
  const parts: string[] = [];
  if (role === 'client') parts.push('firm client');
  else if (role === 'opposing') parts.push('adverse party');
  else parts.push('party');
  if (node.sourceRef) parts.push(`on matter ${node.sourceRef}`);
  parts.push(`[${node.provenance.toLowerCase()}]`);
  return parts.join(' ');
}

/* -- FINDINGS -------------------------------------------------------------
 *
 * 1. `LedgerEntry` has no role field, so this fetcher has to emit adverse
 *    parties into a list whose field is literally named `clientName`.
 *    `findConflicts` then treats a past OPPOSING party the same as a past
 *    CLIENT. That is not the MRPC rule: being adverse to someone the firm
 *    was already adverse to is not a conflict. The result is a false
 *    positive - conservative in direction (it escalates to counsel rather
 *    than clearing), but it is noise the attorney has to clear by hand,
 *    and noise is how a screen stops being read.
 *
 *    The role IS in the graph (PARTY_ROLE_ATTR) and survives into
 *    `matterLabel` as prose, but prose does not reach `findConflicts`.
 *    The fix is `LedgerEntry.role?: 'client' | 'opposing'` plus a branch
 *    in the screen. That edits skill.ts and types.ts, which this unit is
 *    not permitted to touch, so it is reported rather than done.
 *
 * 2. The status lever is doing two jobs. `LedgerEntry.status` means
 *    "matter open or closed", but it is also the only channel through
 *    which a fetcher can express confidence, which is what
 *    `ledgerStatusFor` uses it for above. Overloading it works and is
 *    tested, but the honest shape is a separate `confidence` or
 *    `provenance` field on `LedgerEntry` that `computeStatus` reads
 *    directly, so an inferred CLOSED matter can stay closed AND stay a
 *    question.
 */
