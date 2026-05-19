/**
 * lib/skills/prompts/markers.ts
 *
 * Stable marker strings stamped into each skill's system prompt. The
 * `lib/llm/test-provider.ts` heuristic uses these to route an incoming
 * request to the right canned-response shape; the production
 * `lib/llm/anthropic-provider.ts` ignores them (they are inert in the
 * system prompt text, just lines the model reads as context).
 *
 * Keep these strings deliberately verbose + unique. A drift here =
 * heuristic test responses for the wrong skill = silent test-pass on
 * the wrong shape.
 */

export const CATEGORIZE_PROMPT_MARKER = '[[agentplain.skill.categorize.v1]]';
export const COORDINATE_PROMPT_MARKER = '[[agentplain.skill.coordinate.v1]]';
export const SCHEDULE_PROMPT_MARKER = '[[agentplain.skill.schedule.v1]]';
export const DRAFT_PROMPT_MARKER = '[[agentplain.skill.draft.v1]]';
export const OFFICE_ADMIN_PROMPT_MARKER = '[[agentplain.skill.office-admin.v1]]';
