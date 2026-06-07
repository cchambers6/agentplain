/**
 * lib/customer-files/templates.ts
 *
 * Read model for the customer-facing voice/templates surface
 * (`/settings/voice`). Ingestion (lib/customer-files/ingest.ts) writes
 * ONE KnowledgeDocument per chunk, so a single uploaded file shows up as
 * N rows distinguished by `metadata.fileId` + `metadata.chunkIndex`.
 * This module folds those chunk rows back into one row per source file
 * so the broker-owner sees "my 3 templates", not "my 17 chunks".
 *
 * Per feedback_no_silent_vendor_lock.md the caller receives a plain view
 * (`WorkspaceTemplate`), never a Prisma row. Per the RLS contract the
 * read runs inside `withRls(ctx, ...)` so a customer sees only their own
 * CUSTOMER-kind documents.
 *
 * `categorizeTemplate` is a pure function (no I/O) so the bucketing is
 * unit-testable on its own — the page renders the auto-tag with an
 * honest "auto-tagged" label, never claiming a human classified it.
 */

import { withRls, type RlsContext } from '../db/rls';

/** Display buckets for an ingested template. Derived from the filename
 *  + mime type — an auto-tag, surfaced as such, not a stored field. */
export type TemplateCategory =
  | 'Listing'
  | 'Email & replies'
  | 'Playbook & process'
  | 'Deals & contracts'
  | 'Other';

export interface WorkspaceTemplate {
  /** Provider-side file id (metadata.fileId) — the fold key. */
  fileId: string;
  /** Base title with any "(part n/m)" chunk suffix stripped. */
  title: string;
  /** Source adapter name (metadata.source) — e.g. 'drive', a fixture. */
  source: string | null;
  /** Canonical link back to the file when the source provided one. */
  sourceUrl: string | null;
  /** Mime type the source reported. */
  mimeType: string | null;
  /** How many chunks this file folded into. */
  chunkCount: number;
  /** Auto-derived display bucket. */
  category: TemplateCategory;
  /** ISO timestamp of the most recent chunk row's updatedAt. */
  lastIngestedAt: string;
}

interface KnowledgeDocRow {
  title: string;
  sourceUrl: string | null;
  metadata: unknown;
  updatedAt: Date;
}

/**
 * List the workspace's ingested templates, one row per source file.
 * Returns newest-ingested first. Runs under the caller's RLS context so
 * it can only ever see this workspace's CUSTOMER documents.
 */
export async function listWorkspaceTemplates(
  ctx: RlsContext,
  workspaceId: string,
): Promise<WorkspaceTemplate[]> {
  const rows = (await withRls(ctx, (tx) =>
    tx.knowledgeDocument.findMany({
      where: { workspaceId, contextKind: 'CUSTOMER' },
      select: { title: true, sourceUrl: true, metadata: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  )) as KnowledgeDocRow[];
  return foldChunkRows(rows);
}

/** Pure fold: collapse per-chunk KnowledgeDocument rows into one
 *  WorkspaceTemplate per source file. Exported for unit testing. */
export function foldChunkRows(rows: KnowledgeDocRow[]): WorkspaceTemplate[] {
  const byFile = new Map<string, WorkspaceTemplate>();
  for (const row of rows) {
    const meta = isRecord(row.metadata) ? row.metadata : {};
    // Fold key: prefer the provider fileId; fall back to the stripped
    // title so a row written without a fileId (older shapes) still
    // collapses sensibly instead of fragmenting per chunk.
    const baseTitle = stripChunkSuffix(row.title);
    const fileId =
      typeof meta.fileId === 'string' && meta.fileId.length > 0
        ? meta.fileId
        : `title:${baseTitle}`;
    const source = typeof meta.source === 'string' ? meta.source : null;
    const mimeType = typeof meta.mimeType === 'string' ? meta.mimeType : null;
    const updatedIso = row.updatedAt.toISOString();

    const existing = byFile.get(fileId);
    if (existing) {
      existing.chunkCount += 1;
      // Keep the most recent ingestion timestamp.
      if (updatedIso > existing.lastIngestedAt) {
        existing.lastIngestedAt = updatedIso;
      }
      continue;
    }
    byFile.set(fileId, {
      fileId,
      title: baseTitle,
      source,
      sourceUrl: row.sourceUrl,
      mimeType,
      chunkCount: 1,
      category: categorizeTemplate(baseTitle, mimeType),
      lastIngestedAt: updatedIso,
    });
  }
  return [...byFile.values()].sort((a, b) =>
    b.lastIngestedAt.localeCompare(a.lastIngestedAt),
  );
}

/** Strip a trailing " (part 3/7)" chunk suffix that `ingestWorkspaceFiles`
 *  appends to multi-chunk titles. Single-chunk files have no suffix. */
export function stripChunkSuffix(title: string): string {
  return title.replace(/\s*\(part\s+\d+\/\d+\)\s*$/i, '').trim();
}

/**
 * Auto-tag an ingested file into a display bucket from its filename +
 * mime type. Deliberately keyword-driven and order-sensitive (most
 * specific first) — this is a display affordance, not a classifier the
 * draft loop depends on. Pure: no I/O.
 */
export function categorizeTemplate(
  title: string,
  mimeType: string | null,
): TemplateCategory {
  const t = title.toLowerCase();
  if (/\b(deal|closing|closed|contract|offer|escrow|purchase agreement)\b/.test(t)) {
    return 'Deals & contracts';
  }
  if (/\b(playbook|sop|process|procedure|guide|checklist|workflow|template)\b/.test(t)) {
    return 'Playbook & process';
  }
  if (/\b(listing|property|mls|home|house|for sale|open house)\b/.test(t)) {
    return 'Listing';
  }
  if (/\b(email|reply|response|message|note|letter|follow[- ]?up|outreach)\b/.test(t)) {
    return 'Email & replies';
  }
  if (mimeType && /message|rfc822|email/i.test(mimeType)) {
    return 'Email & replies';
  }
  return 'Other';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
