/**
 * lib/skills/month-end-close-cpa/polish.ts
 *
 * OPTIONAL, flag-gated LLM polish for the month-end-close chase + status
 * drafts. The deterministic templates in `skill.ts` are the product; this
 * is an enhancement seam, OFF by default.
 *
 * Why a seam and not inline: ANTHROPIC_API_KEY is currently parked at the
 * paused sentinel (`sk-ant-PAUSED-…`). The compose stack detects that
 * BEFORE any network call and returns `{ ok: false, error: { code:
 * 'PAUSED' } }` — no tokens burned. This module treats EVERY non-ok
 * result (PAUSED, AUTHENTICATION, OVER_BUDGET, NETWORK, anything) as
 * "keep the deterministic body". So with the key paused, `polishBody` is a
 * safe no-op that returns the template verbatim.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the LLM call goes through the
 * `LlmProvider` port — no `@anthropic-ai/sdk` import here.
 *
 * Per the CPA tone guidance (`lib/skills/prompts/cpa.ts`): polish may
 * smooth wording but must NEVER introduce a tax position, refund, or
 * balance number, and must preserve every `{{operator: ...}}` merge field
 * verbatim. We re-assert both in the system prompt AND guard the output:
 * if a polished body drops a merge field that was in the template, we
 * reject the polish and keep the template.
 */

import type { LlmProvider } from '@/lib/llm/types';

export interface PolishOptions {
  /** The LLM provider to polish with. Omit to disable (the env flag alone
   *  does nothing without a provider). Tests pass a canned provider. */
  llm: LlmProvider;
  /** Bypass the env flag (for tests). Production leaves this unset and the
   *  env `MONTH_END_CLOSE_LLM_POLISH=on` gate decides. */
  force?: boolean;
  /** Workspace id for telemetry tagging. */
  workspaceId?: string;
}

const POLISH_FLAG_ENV = 'MONTH_END_CLOSE_LLM_POLISH';

/** True when polish is both wired (provider present) AND enabled (env flag
 *  on, or `force` for tests). */
export function polishEnabled(opts: PolishOptions | null | undefined): opts is PolishOptions {
  if (!opts || !opts.llm) return false;
  if (opts.force) return true;
  return process.env[POLISH_FLAG_ENV] === 'on';
}

const SYSTEM_PROMPT = [
  'You are a senior CPA-firm client-services manager polishing a draft email to a client.',
  'Rules you MUST follow:',
  '- Keep it formal, warm, and concise. Do not pad.',
  '- NEVER introduce or alter a tax position, refund amount, or balance-due number.',
  '- Preserve EVERY {{operator: ...}} merge field EXACTLY as written, in the same places.',
  '- Keep the same factual claims (which documents are outstanding, which are received). Do not invent items.',
  '- Return ONLY the polished email body as plain text. No preamble, no markdown fences.',
].join('\n');

/**
 * Polish one draft body. Returns the polished text on success; on ANY
 * failure (including the paused-key sentinel) or if the polish drops a
 * required merge field, returns the original `deterministicBody`
 * unchanged. Never throws.
 */
export async function polishBody(args: {
  opts: PolishOptions;
  deterministicBody: string;
  subject: string;
}): Promise<string> {
  const { opts, deterministicBody, subject } = args;
  try {
    const res = await opts.llm.complete({
      system: SYSTEM_PROMPT,
      model: undefined,
      temperature: 0.3,
      maxTokens: 700,
      responseFormat: 'text',
      meta: {
        skill: 'month-end-close-cpa-polish',
        workspaceId: opts.workspaceId,
        verticalSlug: 'cpa',
        sourceSurface: 'DRAFT',
      },
      messages: [
        {
          role: 'user',
          content: `Subject: ${subject}\n\nDraft body to polish:\n\n${deterministicBody}`,
        },
      ],
    });
    if (!res.ok) return deterministicBody;
    const polished = res.value.text.trim();
    if (polished.length === 0) return deterministicBody;
    // Guard: every merge field present in the template must survive the
    // polish. If the model dropped one, distrust the whole polish.
    const mergeFields = extractMergeFields(deterministicBody);
    for (const field of mergeFields) {
      if (!polished.includes(field)) return deterministicBody;
    }
    return polished;
  } catch {
    // Cold-start safe: a thrown provider never drops the draft.
    return deterministicBody;
  }
}

function extractMergeFields(body: string): string[] {
  const matches = body.match(/\{\{operator:[^}]*\}\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}
