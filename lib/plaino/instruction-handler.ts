/**
 * lib/plaino/instruction-handler.ts
 *
 * The drafting half of the INSTRUCT path. Consumed by the Inngest
 * `instruction-handler-on-create` function: reads the
 * PLAINO_INSTRUCTION approval queue row the dispatcher created, builds
 * a discipline-tagged draft via the LLM (honoring any FEEDBACK rules
 * the customer has set via the PREFERENCE path), and persists the
 * draft back into the same row's payload so the operator sees it in
 * the approval queue.
 *
 * Per `feedback_runner_portability` two-implementation rule:
 *   - IInstructionQueueStore (port) + PrismaInstructionQueueStore (prod)
 *   - + RecordingInstructionQueueStore (test)
 *
 * Per `feedback_no_silent_vendor_lock`: the LLM call goes through the
 * configured provider (`getLlmProvider()`). The store talks Prisma
 * behind a port.
 *
 * Per `project_no_outbound_architecture`: this module READS the
 * instruction, DRAFTS the work, and WRITES the draft to the same
 * approval queue row. It does not send to the customer, does not
 * touch any external system. Operator (or customer on small
 * workspaces) approves the draft; the customer's own tools perform
 * any execution.
 *
 * Per `feedback_cold_start_safe_agents`: stateless. Every call reads
 * the row + workspace memory fresh, no cross-fire memory.
 */

import { z } from 'zod';

import {
  asDisciplineId,
  getDiscipline,
  type Discipline,
} from '../disciplines';
import {
  llmOk,
  type LlmCompletionRequest,
  type LlmProvider,
} from '../llm/types';
import { skillError, skillOk, type SkillResult } from '../skills/types';
import {
  readFeedbackRules,
  renderFeedbackRulesForPrompt,
  type FeedbackRule,
} from './feedback-rules';
import type { IMemoryStore } from './memory';
import { isPreferenceScopeId, type PreferenceScopeId } from './types';

/** Stable, version-prefixed system prompt so tests + the cache key can
 *  pin the assembly shape across deploys. */
export const INSTRUCTION_HANDLER_PROMPT_VERSION =
  'PLAINO_INSTRUCTION_HANDLER_V1';

/**
 * Mapping from discipline ids to the preference scope ids the
 * instruction handler will pull from workspace memory for that
 * discipline. A legal instruction should respect legal-flagging rules
 * + general; an analytics instruction should respect reporting + general.
 *
 * We do NOT pull every scope — only the ones a discipline would
 * plausibly care about. This keeps the prompt focused.
 */
const DISCIPLINE_SCOPES: Record<string, ReadonlyArray<PreferenceScopeId>> = {
  analytics: ['reporting'],
  research: ['reporting'],
  legal: ['legal-flagging'],
  marketing: ['email-draft', 'customer-comms'],
  'sales-enablement': ['email-draft', 'customer-comms', 'inbox-triage'],
  'customer-success': ['email-draft', 'customer-comms', 'inbox-triage'],
  finance: ['email-draft', 'inbox-triage'],
  operations: [
    'inbox-triage',
    'email-draft',
    'scheduling',
    'internal-comms',
  ],
};

export interface InstructionQueueItem {
  approvalQueueItemId: string;
  workspaceId: string;
  /** Decrypted at the seam — handlers see plaintext. */
  instructionText: string;
  targetDiscipline: string;
  sourceChatMessageId: string;
  sourceUserId: string;
  reasoning: string;
}

export interface InstructionDraft {
  approvalQueueItemId: string;
  draftBody: string;
  /** What FEEDBACK rules were injected into the prompt. Surfaced in the
   *  payload + audit log so the operator can verify "Plaino honored the
   *  rule you set last week." */
  honoredRules: FeedbackRule[];
  /** LLM rationale for the draft shape. Audit-only. */
  reasoning: string;
}

/**
 * Port for the persistence layer the handler uses. Production reads /
 * writes the encrypted WorkApprovalQueueItem.payload; tests inject a
 * recording impl.
 */
export interface IInstructionQueueStore {
  readonly name: string;
  /** Read an instruction by id. Returns null if missing or not in the
   *  drafting state (re-firing handler should be a no-op). */
  readForDrafting(args: {
    approvalQueueItemId: string;
  }): Promise<InstructionQueueItem | null>;
  /** Write the draft back. Updates payload.draft + payload.status, leaves
   *  the row status as PENDING so the operator sees it in the queue. */
  attachDraft(args: {
    approvalQueueItemId: string;
    workspaceId: string;
    draft: InstructionDraft;
    now?: Date;
  }): Promise<void>;
}

export interface RunInstructionHandlerArgs {
  approvalQueueItemId: string;
  store: IInstructionQueueStore;
  memory?: IMemoryStore;
  llm?: LlmProvider;
  now?: Date;
}

/**
 * One-shot drafting pass. Pure orchestration:
 *   1. Load the queue item.
 *   2. Pull relevant FEEDBACK rules for the discipline's scopes.
 *   3. Build a discipline-tagged prompt.
 *   4. Call the LLM.
 *   5. Persist the draft + honored rules.
 *
 * Returns the drafted output for the Inngest handler to audit-log.
 * Errors at any step are returned as a SkillResult.error so the caller
 * can surface them without throwing.
 */
export async function runInstructionHandler(
  args: RunInstructionHandlerArgs,
): Promise<SkillResult<InstructionDraft>> {
  const item = await args.store.readForDrafting({
    approvalQueueItemId: args.approvalQueueItemId,
  });
  if (!item) {
    return skillError(
      'NOT_APPLICABLE',
      `instruction-handler: approval queue item ${args.approvalQueueItemId} not found or not in drafting state`,
    );
  }
  const disciplineId = asDisciplineId(item.targetDiscipline);
  const discipline = disciplineId ? getDiscipline(disciplineId) : null;
  if (!discipline) {
    return skillError(
      'INVALID_INPUT',
      `instruction-handler: invalid targetDiscipline=${item.targetDiscipline} on item ${item.approvalQueueItemId}`,
    );
  }

  let honoredRules: FeedbackRule[] = [];
  if (args.memory) {
    const scopes = DISCIPLINE_SCOPES[discipline.id] ?? [];
    honoredRules = await readFeedbackRules({
      memory: args.memory,
      workspaceId: item.workspaceId,
      scopes,
      limit: 25,
    });
  }

  const provider: LlmProvider =
    args.llm ?? (await import('../llm').then((m) => m.getLlmProvider()));

  const system = buildInstructionHandlerSystemPrompt({
    discipline,
    honoredRules,
  });
  const user = buildInstructionHandlerUserPrompt({ item });
  const completion = await provider.complete({
    system,
    messages: [{ role: 'user', content: user }],
    responseFormat: 'json',
    temperature: 0.3,
    maxTokens: 1_200,
    cacheSystem: true,
    meta: {
      skill: 'plaino-instruction-handler',
      workspaceId: item.workspaceId,
    },
  } satisfies LlmCompletionRequest);
  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `instruction-handler LLM call failed for item ${item.approvalQueueItemId}: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseInstructionHandlerJson(completion.value.text);
  if (!parsed.ok) {
    return skillError(
      'PARSE_ERROR',
      `instruction-handler malformed LLM output for item ${item.approvalQueueItemId}: ${parsed.error}`,
    );
  }

  const draft: InstructionDraft = {
    approvalQueueItemId: item.approvalQueueItemId,
    draftBody: parsed.value.draftBody,
    honoredRules,
    reasoning: parsed.value.reasoning,
  };

  await args.store.attachDraft({
    approvalQueueItemId: item.approvalQueueItemId,
    workspaceId: item.workspaceId,
    draft,
    now: args.now,
  });

  return skillOk(draft);
}

// ── Prompt assembly ─────────────────────────────────────────────────────

interface BuildSystemPromptArgs {
  discipline: Discipline;
  honoredRules: ReadonlyArray<FeedbackRule>;
}

export function buildInstructionHandlerSystemPrompt(
  args: BuildSystemPromptArgs,
): string {
  const rulesBlock = renderFeedbackRulesForPrompt(args.honoredRules);
  return [
    INSTRUCTION_HANDLER_PROMPT_VERSION,
    `DISCIPLINE: ${args.discipline.id} — ${args.discipline.name}`,
    `DISCIPLINE_SCOPE: ${args.discipline.description}`,
    '',
    'You are the discipline-lead drafter for agentplain\'s service partner Plaino.',
    'A customer has handed an instruction through the workspace-level chat.',
    'Your job: produce ONE concrete draft of the work they asked for, in',
    'the discipline\'s voice, ready for human review.',
    '',
    'CONSTRAINTS — load-bearing:',
    '- This draft does NOT get sent. The operator (or the customer on',
    '  small workspaces) reviews + approves; their own tools perform any',
    '  execution. Write the draft as if it WILL be sent — but never claim',
    '  in the draft itself that you\'ve sent it.',
    '- The draft body is the artifact the operator will see in the',
    '  approval queue. It should be the WORK PRODUCT itself (the email',
    '  body, the summary text, the schedule proposal). It is NOT a',
    '  "here\'s what I would do" meta-description. Produce the thing.',
    '- If the instruction is genuinely ambiguous (missing recipient,',
    '  missing topic, missing constraint that would change the draft',
    '  shape), produce the draft AS BEST YOU CAN and call out the',
    '  ambiguity at the top of the draft with `[NEEDS REVIEW: …]`. Do',
    '  not refuse to draft.',
    '- If the customer set preference rules below, HONOR THEM. They are',
    '  not suggestions; they are how this workspace wants things done.',
    '',
    rulesBlock || '(no customer preferences set for this discipline yet.)',
    '',
    '── OUTPUT FORMAT ──',
    'Return STRICTLY a single JSON object — no prose outside it:',
    '{',
    '  "draftBody": string,    // the work product itself',
    '  "reasoning": string     // one sentence on shape decisions made',
    '}',
  ].join('\n');
}

interface BuildUserPromptArgs {
  item: InstructionQueueItem;
}

export function buildInstructionHandlerUserPrompt(
  args: BuildUserPromptArgs,
): string {
  return [
    'INSTRUCTION FROM THE CUSTOMER:',
    args.item.instructionText,
    '',
    'DISPATCHER REASONING (one-line context from the classifier):',
    args.item.reasoning,
    '',
    'Produce the draft now.',
  ].join('\n');
}

// ── JSON parsing ────────────────────────────────────────────────────────

const handlerOutputSchema = z.object({
  draftBody: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
});

interface HandlerOutput {
  draftBody: string;
  reasoning: string;
}

function parseInstructionHandlerJson(
  raw: string,
): { ok: true; value: HandlerOutput } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch (err) {
    return {
      ok: false,
      error: `instruction-handler LLM returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const result = handlerOutputSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, value: result.data };
}

// ── Test surface ────────────────────────────────────────────────────────

export const __testing = {
  parseInstructionHandlerJson,
  isPreferenceScopeId,
  DISCIPLINE_SCOPES,
  suppressUnusedLlmOk: llmOk,
};
