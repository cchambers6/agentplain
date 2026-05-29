/**
 * lib/plaino/preference-memory.ts
 *
 * Helpers for encoding + decoding PREFERENCE classifier output into
 * WorkspaceMemoryEntry rows (kind=FEEDBACK).
 *
 * The body format is a small structured wire so the skill-side
 * reader can filter rules by scope without re-parsing free-form
 * prose. We KEEP the scope inside the body (not in a separate column)
 * because adding columns to WorkspaceMemoryEntry would require
 * migrating every workspace, and the entry shape already supports
 * arbitrary structured text in body via the v1 envelope.
 *
 * Wire format:
 *
 *   scope: <scope-id>
 *   rule: <one-sentence rule statement>
 *
 * Why the title carries a `pref:<scope>` prefix:
 *   - Lets the customer-facing memory page group preference rules by
 *     scope without parsing the body.
 *   - Lets the upsert path collapse "two rules in the same scope"
 *     into one row if the customer re-states a rule for the same
 *     scope (today the upsert key is workspace+kind+title; same
 *     title = update in place rather than duplicate).
 *
 * Per `feedback_no_silent_vendor_lock`: this module has no Prisma
 * import. It only encodes/decodes the wire format. Callers (dispatcher,
 * skill-side rule injector) own the storage seam.
 */

import {
  isPreferenceScopeId,
  type PreferenceScopeId,
} from './types';

/** Title prefix on every preference-derived FEEDBACK entry. Lets the
 *  memory page facet by scope, and gives the upsert key a stable shape. */
export const PREFERENCE_MEMORY_TITLE_PREFIX = 'pref:' as const;

export interface PreferenceMemoryBodyArgs {
  scope: string;
  rule: string;
}

/** Encode a PREFERENCE classification into the body wire format. */
export function buildPreferenceMemoryBody(args: PreferenceMemoryBodyArgs): string {
  return [`scope: ${args.scope.trim()}`, `rule: ${args.rule.trim()}`].join('\n');
}

export interface ParsedPreferenceMemory {
  scope: PreferenceScopeId;
  rule: string;
}

/**
 * Decode the body wire format. Returns null when the body is not in
 * the expected shape — callers handle "this entry isn't a preference"
 * by treating it as a regular FEEDBACK entry (free-form rule).
 *
 * Tolerant of leading/trailing whitespace and the v2 wire format
 * adding a third line (scope/rule are extracted by named match, not
 * by line order).
 */
export function parsePreferenceMemoryBody(
  body: string,
): ParsedPreferenceMemory | null {
  if (typeof body !== 'string' || body.length === 0) return null;
  const scopeMatch = body.match(/^scope:\s*([a-z][a-z0-9-]+)\s*$/im);
  const ruleMatch = body.match(/^rule:\s*(.+?)\s*$/im);
  if (!scopeMatch || !ruleMatch) return null;
  const scope = scopeMatch[1];
  const rule = ruleMatch[1];
  if (!isPreferenceScopeId(scope)) return null;
  if (rule.length === 0) return null;
  return { scope, rule };
}

/**
 * Extract the scope from a preference entry's title (the `pref:<scope>`
 * shape). Returns null when the title is not in the preference shape,
 * so callers can filter a workspace memory page render by scope
 * without re-decoding the body.
 */
export function preferenceScopeFromTitle(title: string): PreferenceScopeId | null {
  if (!title.startsWith(PREFERENCE_MEMORY_TITLE_PREFIX)) return null;
  const scope = title.slice(PREFERENCE_MEMORY_TITLE_PREFIX.length).trim();
  return isPreferenceScopeId(scope) ? scope : null;
}
