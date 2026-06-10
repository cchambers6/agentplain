/**
 * lib/skills/law-intake-conflict-screen/prisma-ledger-fetcher.ts
 *
 * Production implementation of `LedgerFetcher`. Reads the workspace's
 * `KnowledgeDocument` rows (contextKind=CUSTOMER) and derives a
 * `LedgerEntry[]` from every document whose title or first-line body
 * text looks like a client / party name.
 *
 * DESIGN RATIONALE — why KnowledgeDocument?
 *
 *   There is no `CrmContact` or `Matter` table in the Prisma schema —
 *   client data lives in the matter-management MCPs (Clio / MyCase /
 *   PracticePanther) that have not yet landed. Today the strongest
 *   available durable source is the customer-file ingestion pipeline
 *   (`lib/customer-files/ingest.ts`) which writes `KnowledgeDocument`
 *   rows tagged `contextKind=CUSTOMER` + `workspaceId=<id>`.
 *
 *   Two-implementation rule per `feedback_runner_portability.md`:
 *     - This (Prisma, production)
 *     - `JsonLedgerFetcher` (on-disk seed, tests + fixture workspaces)
 *
 *   When the Clio / MyCase / PracticePanther MCPs land the MCP-backed
 *   fetcher will become the primary production impl; this file stays as
 *   the fallback for workspaces that have not connected a matter-management
 *   system but have ingested files.
 *
 * EXTRACTION STRATEGY
 *
 *   Each KnowledgeDocument row carries a `title` (set to the filename /
 *   drive-item title during ingestion) and a `body` (the extracted text).
 *   The document's `metadata` field may carry a `clientName` key when the
 *   upstream source (a future Clio MCP, a structured import) writes it
 *   explicitly.
 *
 *   Priority order for deriving a party name:
 *     1. `metadata.clientName` string — explicit, most reliable.
 *     2. `metadata.matterParty` string — from structured matter imports.
 *     3. `title` — the ingestion pipeline sets this to the filename /
 *        drive-item name; law firms often name files after the client
 *        ("Smith v Jones — engagement letter.pdf").
 *
 *   For `status` we check `metadata.matterStatus`:
 *     - "active" / "open" / "in-progress" → 'active'
 *     - anything else (including absent)   → 'closed'
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Reads DB fresh
 * on every `fetchLedger()` call; holds no in-memory cache.
 *
 * Per `project_no_outbound_architecture.md`: read-only. No writes,
 * no outbound calls.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { skillError, skillOk, type SkillResult } from '../types';
import type { LedgerEntry, LedgerFetcher } from './types';

export interface PrismaLedgerFetcherOptions {
  /** Override the Prisma client. Tests pass a stub. */
  client?: PrismaClient;
  /** Bypass the RLS wrapper and read directly — used by tests that inject
   *  a stub `tx.knowledgeDocument.findMany`. */
  tx?: Prisma.TransactionClient;
  /** Maximum number of KnowledgeDocument rows to scan per workspace.
   *  Default 500. A firm with more than 500 ingested docs will scan the
   *  most-recently-updated rows first (ordered by updatedAt desc). */
  maxRows?: number;
}

const DEFAULT_MAX_ROWS = 500;

export class PrismaLedgerFetcher implements LedgerFetcher {
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaLedgerFetcherOptions = {},
  ) {}

  async fetchLedger(args: {
    workspaceId: string;
  }): Promise<SkillResult<LedgerEntry[]>> {
    const maxRows = this.options.maxRows ?? DEFAULT_MAX_ROWS;
    try {
      if (this.options.tx) {
        const rows = await queryDocs(this.options.tx, args.workspaceId, maxRows);
        return skillOk(docsToLedger(rows));
      }
      const ctx = {
        userId: null,
        workspaceId: args.workspaceId,
        isOperator: true,
      } as const;
      const ledger = await withRls(
        ctx,
        async (tx) => {
          const rows = await queryDocs(tx, args.workspaceId, maxRows);
          return docsToLedger(rows);
        },
        this.options.client ? { client: this.options.client } : undefined,
      );
      return skillOk(ledger);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaLedgerFetcher failed for workspace ${args.workspaceId}: ${message}`,
      );
    }
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────

type DocRow = {
  title: string;
  metadata: Prisma.JsonValue;
};

async function queryDocs(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  maxRows: number,
): Promise<DocRow[]> {
  return tx.knowledgeDocument.findMany({
    where: {
      workspaceId,
      contextKind: 'CUSTOMER',
    },
    select: {
      title: true,
      metadata: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: maxRows,
  });
}

/**
 * Convert raw KnowledgeDocument rows into LedgerEntry items. One entry
 * per document row — the party name is extracted in priority order:
 * metadata.clientName → metadata.matterParty → document title.
 *
 * Empty / very short names (< 2 chars) are discarded. Duplicate names
 * (case-normalized) are deduplicated, keeping the one whose status is
 * 'active' when there are multiple rows for the same party.
 */
function docsToLedger(rows: DocRow[]): LedgerEntry[] {
  const seen = new Map<string, LedgerEntry>();

  for (const row of rows) {
    const meta = safeMetadata(row.metadata);
    const clientName = extractPartyName(row.title, meta);
    if (!clientName) continue;

    const status = extractStatus(meta);
    const matterLabel = extractMatterLabel(meta, row.title);

    const key = clientName.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { clientName, status, matterLabel });
    } else if (existing.status !== 'active' && status === 'active') {
      // Active takes precedence over closed for dedup.
      seen.set(key, { clientName: existing.clientName, status: 'active', matterLabel: existing.matterLabel ?? matterLabel });
    }
  }

  return Array.from(seen.values());
}

function extractPartyName(
  title: string,
  meta: Record<string, unknown>,
): string | null {
  // Priority 1: explicit metadata field
  if (typeof meta.clientName === 'string' && meta.clientName.trim().length >= 2) {
    return meta.clientName.trim();
  }
  if (typeof meta.matterParty === 'string' && meta.matterParty.trim().length >= 2) {
    return meta.matterParty.trim();
  }
  // Priority 2: document title — trim common suffix patterns that don't add
  // party-name signal ("— engagement letter.pdf", "(part 1/3)", etc.)
  const cleaned = title
    .replace(/\s*\(part\s+\d+\/\d+\)\s*$/i, '')  // chunk suffix
    .replace(/\s*—\s*[^—]+$/, '')                  // " — anything after dash"
    .replace(/\.(pdf|docx?|txt|csv)$/i, '')        // extension
    .trim();
  if (cleaned.length >= 2) return cleaned;
  return null;
}

function extractStatus(
  meta: Record<string, unknown>,
): 'active' | 'closed' {
  const raw = typeof meta.matterStatus === 'string'
    ? meta.matterStatus.toLowerCase()
    : '';
  if (raw === 'active' || raw === 'open' || raw === 'in-progress' || raw === 'in_progress') {
    return 'active';
  }
  return 'closed';
}

function extractMatterLabel(
  meta: Record<string, unknown>,
  title: string,
): string | undefined {
  if (typeof meta.matterLabel === 'string' && meta.matterLabel.trim()) {
    return meta.matterLabel.trim();
  }
  if (typeof meta.matterDescription === 'string' && meta.matterDescription.trim()) {
    return meta.matterDescription.trim().slice(0, 100);
  }
  return title || undefined;
}

function safeMetadata(raw: Prisma.JsonValue): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}
