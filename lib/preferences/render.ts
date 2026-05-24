/**
 * lib/preferences/render.ts
 *
 * Render a WorkspacePreferenceView as a prompt-ready block. The runner
 * passes the workspace's preference to each skill; the skill assembles
 * its system prompt with the block inlined. The same renderer is shared
 * across draft / categorize so the prod LLM and the test heuristic both
 * see consistent surface area.
 *
 * Returns an EMPTY string when the workspace has no preferences yet,
 * so the prompt stays clean for a fresh workspace. Callers concatenate
 * the rendered block directly into their system prompt — no special-
 * case "if preferences" branching in the skill.
 */

import type { WorkspacePreferenceView } from './types';

export interface RenderPrefsOptions {
  /** When true, include the learned-from-corrections notes. Default
   *  true — every draft prompt wants them. Set false from skills that
   *  shouldn't be biased by stylistic learnings (categorize). */
  includeLearnedNotes?: boolean;
}

export function renderPreferencesBlock(
  prefs: WorkspacePreferenceView | null,
  opts: RenderPrefsOptions = {},
): string {
  if (!prefs) return '';
  const includeLearned = opts.includeLearnedNotes !== false;
  const lines: string[] = [];

  const headerParts: string[] = [];
  if (prefs.draftingTone) headerParts.push(`tone=${prefs.draftingTone}`);
  if (prefs.calendarWindow) headerParts.push(`calendar=${prefs.calendarWindow}`);
  if (headerParts.length > 0) {
    lines.push(
      `WORKSPACE PREFERENCES (the broker-owner set these — honor them on every draft): ${headerParts.join(' ')}`,
    );
  }

  if (prefs.categorizationNotes && prefs.categorizationNotes.trim().length > 0) {
    lines.push('');
    lines.push('WORKSPACE CATEGORIZATION NOTES:');
    lines.push(prefs.categorizationNotes.trim());
  }

  if (includeLearned && prefs.learnedDraftNotes.length > 0) {
    lines.push('');
    lines.push(
      'LEARNED FROM PRIOR CORRECTIONS (the broker-owner edited or rejected past drafts; reflect these on every new draft):',
    );
    for (const note of prefs.learnedDraftNotes) {
      lines.push(`  - ${note}`);
    }
  }

  if (lines.length === 0) return '';
  return lines.join('\n');
}
