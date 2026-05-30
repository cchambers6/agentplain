/**
 * lib/skills/feedback-rules.ts
 *
 * Skill-side bridge for customer-set PREFERENCE rules — the wave-1
 * fix that connects the `/talk/memory` write surface (PR #120) to the
 * fleet's actual prompt assembly.
 *
 * Before this module shipped, `/talk` could write FEEDBACK
 * WorkspaceMemoryEntry rows but NO skill in `lib/skills/*` called the
 * `readFeedbackRules` reader — the rules were write-only on the fleet
 * side. This module bridges that gap.
 *
 * Per `feedback_no_silent_vendor_lock.md`: nothing here imports Prisma
 * directly. Callers pass an `IMemoryStore` (the prod binding is
 * `PrismaMemoryStore`; tests pass a `RecordingMemoryStore`).
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-reads memory
 * fresh — there is no in-process cache.
 *
 * Per the honesty bar — empty rule set returns an empty string so the
 * skill prompt does NOT include a "CUSTOMER PREFERENCES" header with
 * nothing under it. Better to skip the section than to render a
 * misleading "(no preferences set)" block.
 */

import { readFeedbackRules, renderFeedbackRulesForPrompt } from '@/lib/plaino';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import type { PreferenceScopeId } from '@/lib/plaino/types';

/** Default scopes the skill chain runner reads — the four scopes the
 *  generic chain plausibly honors. `general` is added implicitly by
 *  `readFeedbackRules`. */
export const DEFAULT_RUNNER_SCOPES: ReadonlyArray<PreferenceScopeId> = [
  'inbox-triage',
  'email-draft',
  'scheduling',
  'customer-comms',
];

export interface BuildFeedbackRulesBlockArgs {
  memory: IMemoryStore;
  workspaceId: string;
  /** Scopes the calling skill cares about. The reader always includes
   *  `general` scope rules on top of these. */
  scopes?: ReadonlyArray<PreferenceScopeId>;
  /** Optional cap on rules. Defaults to 25 (matches readFeedbackRules). */
  limit?: number;
}

/**
 * Read FEEDBACK rules matching the requested scopes and render them
 * into a prompt block suitable for inlining into the system message.
 *
 * Returns an empty string when no rules match — by design — so the
 * caller can unconditionally concatenate without checking for the
 * empty case.
 */
export async function buildFeedbackRulesBlock(
  args: BuildFeedbackRulesBlockArgs,
): Promise<string> {
  const rules = await readFeedbackRules({
    memory: args.memory,
    workspaceId: args.workspaceId,
    scopes: args.scopes ?? DEFAULT_RUNNER_SCOPES,
    limit: args.limit,
  });
  return renderFeedbackRulesForPrompt(rules);
}
