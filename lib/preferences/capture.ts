/**
 * lib/preferences/capture.ts
 *
 * Signal-capture passes called from the approvals server actions:
 *
 *   - captureDraftEditSignal: broker-owner edited a draft body.
 *     Diff the original vs final to derive a one-line learned note
 *     ("Shorter than I drafted", "Removed phrase X", "Added phrase Y").
 *   - captureDraftRejectSignal: broker-owner rejected a draft with a
 *     reason. The reason becomes the learned note verbatim.
 *
 * Both passes:
 *   (1) write an append-only PreferenceSignal row,
 *   (2) prepend the derived note to WorkspacePreference.learnedDraftNotes.
 *
 * Per feedback_cold_start_safe_agents.md the next skill-chain fire reads
 * the new note from disk — there is no in-memory cache.
 */

import type { RlsContext } from '../db/rls';
import {
  appendLearnedDraftNote,
  recordPreferenceSignal,
} from './store';
import {
  LEARNED_NOTES_CAP,
  LEARNED_NOTE_MAX_CHARS,
  SIGNAL_TEXT_MAX_CHARS,
} from './types';

export interface CaptureDraftEditArgs {
  workspaceId: string;
  approvalItemId: string;
  /** Original body the skill chain produced. */
  originalBody: string;
  /** Final body the broker-owner saved. */
  finalBody: string;
}

export async function captureDraftEditSignal(
  ctx: RlsContext,
  args: CaptureDraftEditArgs,
): Promise<void> {
  // No-op when the edit didn't actually change anything (the form posts
  // even on cosmetic re-saves).
  if (args.originalBody === args.finalBody) return;
  const note = deriveEditNote(args.originalBody, args.finalBody);
  const truncatedNote = clip(note, LEARNED_NOTE_MAX_CHARS);
  await recordPreferenceSignal(ctx, {
    workspaceId: args.workspaceId,
    source: 'DRAFT_EDIT',
    kind: 'tone-or-format',
    text: truncatedNote,
    refTable: 'WorkApprovalQueueItem',
    refId: args.approvalItemId,
    payload: {
      original: clip(args.originalBody, SIGNAL_TEXT_MAX_CHARS),
      final: clip(args.finalBody, SIGNAL_TEXT_MAX_CHARS),
    },
  });
  await appendLearnedDraftNote(ctx, {
    workspaceId: args.workspaceId,
    note: truncatedNote,
    cap: LEARNED_NOTES_CAP,
  });
}

export interface CaptureDraftRejectArgs {
  workspaceId: string;
  approvalItemId: string;
  /** Free-text reason from the rejection form. */
  reason: string | null;
}

export async function captureDraftRejectSignal(
  ctx: RlsContext,
  args: CaptureDraftRejectArgs,
): Promise<void> {
  const reason = (args.reason ?? '').trim();
  if (reason.length === 0) return;
  const note = `Rejected a draft because: ${reason}`;
  const truncatedNote = clip(note, LEARNED_NOTE_MAX_CHARS);
  await recordPreferenceSignal(ctx, {
    workspaceId: args.workspaceId,
    source: 'DRAFT_REJECT',
    kind: 'reject-reason',
    text: clip(reason, SIGNAL_TEXT_MAX_CHARS),
    refTable: 'WorkApprovalQueueItem',
    refId: args.approvalItemId,
  });
  await appendLearnedDraftNote(ctx, {
    workspaceId: args.workspaceId,
    note: truncatedNote,
    cap: LEARNED_NOTES_CAP,
  });
}

/**
 * Derive a one-line observation from an edit diff. Deliberately simple:
 * length delta + a few well-bounded phrase-add/remove heuristics. The
 * prod LLM gets the verbatim diff via the PreferenceSignal payload so a
 * future learning pass can re-derive richer notes; today's note exists
 * to make the *next* draft prompt richer without an LLM round-trip.
 */
export function deriveEditNote(original: string, final: string): string {
  const delta = final.length - original.length;
  const deltaPct = original.length > 0
    ? Math.round((delta / original.length) * 100)
    : 0;
  const lengthClause = Math.abs(deltaPct) >= 15
    ? delta < 0
      ? `Edit shortened the draft by ${Math.abs(deltaPct)}%`
      : `Edit lengthened the draft by ${deltaPct}%`
    : 'Edit preserved overall length';
  const removedPhrase = findFirstRemovedPhrase(original, final);
  const addedPhrase = findFirstAddedPhrase(original, final);
  const phraseClauses: string[] = [];
  if (removedPhrase) {
    phraseClauses.push(`removed “${removedPhrase}”`);
  }
  if (addedPhrase) {
    phraseClauses.push(`added “${addedPhrase}”`);
  }
  const tail = phraseClauses.length > 0 ? `; ${phraseClauses.join(', ')}` : '';
  return `Broker-owner edited a draft — ${lengthClause}${tail}.`;
}

function findFirstRemovedPhrase(original: string, final: string): string | null {
  return firstUniqueChunk(original, final);
}

function findFirstAddedPhrase(original: string, final: string): string | null {
  return firstUniqueChunk(final, original);
}

/** Pick the first 3-to-10-word chunk from `source` that does not appear
 *  in `other`. Cheap heuristic — good enough to surface "I prefer
 *  ‘happy to help’ over ‘pleased to assist’" without an LLM call. */
function firstUniqueChunk(source: string, other: string): string | null {
  const tokens = source
    .replace(/\s+/g, ' ')
    .split(/\b/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const otherLower = other.toLowerCase();
  for (let len = 8; len >= 3; len -= 1) {
    for (let i = 0; i <= tokens.length - len; i += 1) {
      const slice = tokens.slice(i, i + len).join(' ').trim();
      if (slice.length < 8) continue;
      if (/^\W+$/.test(slice)) continue;
      if (!otherLower.includes(slice.toLowerCase())) {
        return slice.slice(0, 80);
      }
    }
  }
  return null;
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
