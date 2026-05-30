/**
 * lib/plaino/feedback-rules.ts
 *
 * Skill-side reader for customer-set PREFERENCE rules (stored as
 * WorkspaceMemoryEntry kind=FEEDBACK with the `pref:<scope>` title
 * shape — see lib/plaino/preference-memory.ts).
 *
 * Any skill that wants to honor customer-set rules calls this at the
 * top of its run, passes a scope, and gets back a list of one-sentence
 * rule statements to inject verbatim into the LLM prompt. Empty list
 * means "no preferences set for this scope — proceed with defaults."
 *
 * Per `project_no_outbound_architecture`: this module READS workspace
 * memory only. It does not write, does not send.
 *
 * Per `feedback_no_silent_vendor_lock`: this module talks to the
 * IMemoryStore port — no Prisma import here.
 */

import type { IMemoryStore, MemoryEntry } from './memory';
import {
  parsePreferenceMemoryBody,
  preferenceScopeFromTitle,
} from './preference-memory';
import type { PreferenceScopeId } from './types';

export interface ReadFeedbackRulesArgs {
  memory: IMemoryStore;
  workspaceId: string;
  /** Scope ids the skill is interested in. Rules with `general` scope
   *  are ALWAYS included regardless of what scopes are listed. */
  scopes: ReadonlyArray<PreferenceScopeId>;
  /** Cap on rules returned. Defaults to 25 — preference rules are
   *  small, but a hot workspace with many rules should not flood a
   *  single skill's prompt. */
  limit?: number;
}

export interface FeedbackRule {
  /** The original entry id — surfaced for audit / debug. */
  entryId: string;
  scope: PreferenceScopeId;
  rule: string;
}

/**
 * Pull FEEDBACK preference rules from workspace memory, filtered to
 * the scopes the skill cares about plus `general`. Returns at most
 * `limit` rules, ordered by recency (most recent first) so a newly
 * set rule wins over a stale one.
 *
 * Returns an empty array — never throws — if the store read fails or
 * the workspace has no rules: a missing/broken memory store should
 * never block a skill from firing with defaults.
 */
export async function readFeedbackRules(
  args: ReadFeedbackRulesArgs,
): Promise<FeedbackRule[]> {
  const scopeSet = new Set<PreferenceScopeId>(args.scopes);
  scopeSet.add('general');
  const cap = clampLimit(args.limit ?? 25);
  let entries: MemoryEntry[];
  try {
    entries = await args.memory.listForWorkspace({
      workspaceId: args.workspaceId,
      limit: 200,
    });
  } catch {
    return [];
  }
  const picked: FeedbackRule[] = [];
  // FEEDBACK + matching scope only. Sorted by recency (lastReadAt
  // falls back to updatedAt). Pinned entries get priority — those
  // are rules the customer explicitly wants always-on.
  const sorted = [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  for (const e of sorted) {
    if (picked.length >= cap) break;
    if (e.kind !== 'FEEDBACK') continue;
    const titleScope = preferenceScopeFromTitle(e.title);
    if (titleScope) {
      if (!scopeSet.has(titleScope)) continue;
      // Body wire format may be valid or stale; prefer parsed-body
      // when present (carries the canonical rule statement).
      const parsed = parsePreferenceMemoryBody(e.body);
      if (parsed) {
        picked.push({ entryId: e.id, scope: titleScope, rule: parsed.rule });
        continue;
      }
      // Title says it's a preference but body is malformed — fall
      // back to the raw body so we don't drop the customer's rule.
      picked.push({ entryId: e.id, scope: titleScope, rule: e.body.trim() });
      continue;
    }
    // Free-form FEEDBACK entries (manually added on the memory page,
    // not via PREFERENCE classification). Treat as `general` scope so
    // every skill sees them — that matches what the customer expects
    // when they manually pin a "do this everywhere" note.
    if (scopeSet.has('general')) {
      picked.push({ entryId: e.id, scope: 'general', rule: e.body.trim() });
    }
  }
  return picked;
}

/**
 * Render a list of rules into a stable prompt block. Skills paste this
 * into their system or user message under a "CUSTOMER PREFERENCES"
 * header. Empty input → empty string so the skill can unconditionally
 * concatenate.
 *
 * The output is intentionally low-syntax — no JSON, no markdown — so
 * the LLM treats it as plain instructions.
 */
export function renderFeedbackRulesForPrompt(
  rules: ReadonlyArray<FeedbackRule>,
): string {
  if (rules.length === 0) return '';
  const lines: string[] = ['CUSTOMER PREFERENCES (apply where relevant):'];
  for (const r of rules) {
    lines.push(`- [scope=${r.scope}] ${r.rule}`);
  }
  return lines.join('\n');
}

function clampLimit(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 25;
  return Math.min(Math.floor(raw), 200);
}
