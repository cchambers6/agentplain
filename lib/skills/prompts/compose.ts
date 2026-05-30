/**
 * lib/skills/prompts/compose.ts
 *
 * Per-fire prompt composition. Vertical bundles (lib/skills/prompts/<vertical>.ts)
 * are static and shared across workspaces; this composer wraps a base
 * bundle with workspace-specific context blocks the runner pulled
 * fresh on this fire:
 *
 *   - preferencesBlock — rendered by lib/preferences/render.ts from the
 *     workspace's WorkspacePreference row + accumulated learned notes.
 *   - customerContextBlock — top-k CUSTOMER-kind KnowledgeDocument
 *     snippets the knowledge store returned for the inbound message.
 *
 * Returns a NEW VerticalPromptBundle with the wrapped strings. Callers
 * do not mutate the input bundle (it's shared across workspaces).
 *
 * The composer inserts the wrapping block IMMEDIATELY AFTER the prompt
 * marker line + VERTICAL_SLUG line so the test provider's marker-based
 * routing (lib/llm/test-provider.ts) continues to dispatch correctly.
 */

import type { VerticalPromptBundle } from './index';

export interface ComposeArgs {
  /** Preferences block FOR the draft skill — includes the learned-
   *  from-corrections bullets. Empty/blank = no wrap. */
  preferencesBlockForDraft?: string;
  /** Preferences block FOR categorize / schedule / coordinate — the
   *  workspace's tone + categorization notes WITHOUT the stylistic
   *  learned-draft bullets (those would bias categorization, not help
   *  it). Empty/blank = no wrap. */
  preferencesBlockForOther?: string;
  /** Customer-context block — workspace-scoped knowledge snippets the
   *  runner retrieved for this fire. Inlined into draft + coordinate
   *  prompts. Empty/blank = no wrap. */
  customerContextBlock?: string;
  /** Customer-set PREFERENCE rules (WorkspaceMemoryEntry kind=FEEDBACK
   *  with `pref:<scope>` titles), pre-rendered by
   *  `lib/skills/feedback-rules.ts`. Inlined into EVERY skill prompt so
   *  whatever the customer told /talk to remember actually shapes
   *  categorize / coordinate / schedule / draft. Empty/blank = no wrap,
   *  no header — honest about the absence rather than emitting a
   *  misleading "(no preferences set)" block. */
  feedbackRulesBlock?: string;
}

export function composePromptBundle(
  base: VerticalPromptBundle,
  args: ComposeArgs,
): VerticalPromptBundle {
  const prefDraft = (args.preferencesBlockForDraft ?? '').trim();
  const prefOther = (args.preferencesBlockForOther ?? '').trim();
  const ctx = (args.customerContextBlock ?? '').trim();
  const rules = (args.feedbackRulesBlock ?? '').trim();
  if (
    prefDraft.length === 0 &&
    prefOther.length === 0 &&
    ctx.length === 0 &&
    rules.length === 0
  ) {
    return base;
  }
  return {
    verticalSlug: base.verticalSlug,
    verticalName: base.verticalName,
    categorize: wrap(base.categorize, prefOther, '', rules),
    draft: wrap(base.draft, prefDraft, ctx, rules),
    schedule: wrap(base.schedule, prefOther, '', rules),
    coordinate: wrap(base.coordinate, prefOther, ctx, rules),
  };
}

/** Insert the workspace-context wrapper after the VERTICAL_SLUG header
 *  line so the marker-based test-provider routing stays intact. */
function wrap(
  prompt: string,
  prefBlock: string,
  ctxBlock: string,
  rulesBlock: string,
): string {
  if (
    prefBlock.length === 0 &&
    ctxBlock.length === 0 &&
    rulesBlock.length === 0
  ) {
    return prompt;
  }
  const headerEnd = findHeaderEnd(prompt);
  const before = prompt.slice(0, headerEnd);
  const after = prompt.slice(headerEnd);
  const parts: string[] = [];
  if (prefBlock.length > 0) {
    parts.push('');
    parts.push(prefBlock);
  }
  if (rulesBlock.length > 0) {
    parts.push('');
    parts.push(rulesBlock);
  }
  if (ctxBlock.length > 0) {
    parts.push('');
    parts.push(ctxBlock);
  }
  parts.push('');
  return before + parts.join('\n') + after;
}

/** The base prompts open with `<MARKER>\nVERTICAL_SLUG: <slug>\n` —
 *  return the offset of the newline that ends the VERTICAL_SLUG line so
 *  the workspace wrapper inserts cleanly between the header and the
 *  body. Falls back to the start of the string for prompts that don't
 *  match the pattern. */
function findHeaderEnd(prompt: string): number {
  const slugIdx = prompt.indexOf('VERTICAL_SLUG:');
  if (slugIdx < 0) return 0;
  const newlineAfterSlug = prompt.indexOf('\n', slugIdx);
  if (newlineAfterSlug < 0) return prompt.length;
  return newlineAfterSlug + 1;
}
