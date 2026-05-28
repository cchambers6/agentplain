/**
 * lib/disciplines/grouping.ts
 *
 * Pure-function bucket logic that drives the discipline-grouped approval
 * queue. Extracted from `ApprovalsList.tsx` so the bucketing rules are
 * unit-testable in isolation — the component imports + applies these.
 *
 * Three buckets, in order of UI priority:
 *
 *   1. NEEDS-YOU  — items the broker MUST read. Today the signal is
 *                   `priority === 'critical'` on the rendered admin card;
 *                   compliance-flagged drafts ride the same priority field.
 *   2. BY-DISCIPLINE — items grouped by their `discipline` field, one
 *                   section per non-empty discipline.
 *   3. FALLBACK   — items WITHOUT a discipline tag (legacy NULL rows
 *                   written before the discipline axis landed). Per the
 *                   Strand 3 brief, NULL items LAND HERE so nothing
 *                   disappears from the queue.
 */

import type { DisciplineId } from './index';

export interface ApprovalLike {
  id: string;
  discipline: DisciplineId | null;
  isNeedsYou: boolean;
}

export interface BucketedApprovals<T extends ApprovalLike> {
  needsYou: T[];
  byDiscipline: Map<DisciplineId, T[]>;
  fallback: T[];
}

/**
 * Bucket a list of approval rows into the three sections. Stable
 * ordering: input order is preserved within each bucket.
 *
 * NEEDS-YOU rows are NEVER also placed in their discipline bucket — the
 * UI shows them once, in the most-urgent slot. NULL-discipline rows
 * land in `fallback` regardless of need-you status — they are still
 * surfaced, just in the "All recent" lane.
 *
 * NULL needs-you items DO land in `needsYou` (an urgent item should not
 * fall into "All recent" just because its discipline tag is missing).
 */
export function bucketApprovals<T extends ApprovalLike>(
  rows: T[],
): BucketedApprovals<T> {
  const needsYou: T[] = [];
  const byDiscipline = new Map<DisciplineId, T[]>();
  const fallback: T[] = [];
  for (const r of rows) {
    if (r.isNeedsYou) {
      needsYou.push(r);
      continue;
    }
    if (r.discipline === null) {
      fallback.push(r);
      continue;
    }
    const list = byDiscipline.get(r.discipline) ?? [];
    list.push(r);
    byDiscipline.set(r.discipline, list);
  }
  return { needsYou, byDiscipline, fallback };
}
