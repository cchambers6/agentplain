/**
 * lib/skills/support-handler/skill.ts
 *
 * The support-handler skill — synthesizes a first-touch reply draft
 * from a customer SupportRequest + the knowledge substrate. Returns a
 * SupportDraftProposal that the production sink writes to
 * WorkApprovalQueueItem (kind=SUPPORT_HANDLER_REPLY_DRAFT,
 * discipline=customer-success) for operator review.
 *
 * Hard rules:
 *   - Substrate hits below the medium-confidence floor → placeholder
 *     draft, NOT a fabricated answer. The customer hears "we've seen
 *     this and are looking into it" and the operator handles it
 *     manually. This is the honesty rule in
 *     feedback_no_guesses_no_estimates: never invent an answer.
 *   - Citations are required for substantive drafts. Every snippet the
 *     model used is surfaced in the proposal so the operator can verify
 *     before approving.
 *   - No outbound. The skill produces text; the customer's existing
 *     operator email path performs the send if the operator approves.
 *   - Service-partner voice (Plaino, calm, heritage tone) — never
 *     DIY / airplane / pilot framing.
 *
 * The LLM call structures the system prompt so the prompt-cache wrapper
 * (PR #114) can mark it cacheable once it lands: stable preamble
 * (brand voice + no-outbound + escalation policy + vertical context)
 * lives in `system`; per-request dynamic content (request body + cited
 * snippets) lives in the user message.
 *
 * Per feedback_runner_portability.md: this file imports neither
 * Prisma nor the Anthropic SDK directly. The substrate port and LLM
 * provider are injected; the skill is portable across runtimes.
 */

import { randomUUID } from 'node:crypto';
import { getLlmProvider } from '../../llm';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_HIGH_CONFIDENCE_FLOOR,
  DEFAULT_MEDIUM_CONFIDENCE_FLOOR,
  DEFAULT_TOP_K,
  SNIPPET_EXCERPT_CHAR_CAP,
  type ApprovalSink,
  type IKnowledgeSubstratePort,
  type SupportContextSnippet,
  type SupportDraftConfidence,
  type SupportDraftProposal,
  type SupportHandlerInput,
  type SupportHandlerOutput,
  type SupportRequestSnapshot,
} from './types';

const NO_OUTBOUND_NOTE =
  'No reply sent to the customer. The draft is PENDING in the approvals ' +
  'queue under customer-success; the operator approves / edits / escalates ' +
  "and the customer's existing email path performs the send. Per " +
  'project_no_outbound_architecture.md.';

export async function runSkill(
  input: SupportHandlerInput,
): Promise<SkillResult<SupportHandlerOutput>> {
  const topK = clampTopK(input.topK ?? DEFAULT_TOP_K);
  const highFloor = input.highConfidenceSimilarityFloor ?? DEFAULT_HIGH_CONFIDENCE_FLOOR;
  const medFloor = input.mediumConfidenceSimilarityFloor ?? DEFAULT_MEDIUM_CONFIDENCE_FLOOR;
  if (medFloor > highFloor) {
    return skillError(
      'INVALID_INPUT',
      'mediumConfidenceSimilarityFloor must be <= highConfidenceSimilarityFloor',
    );
  }

  let snippets: SupportContextSnippet[];
  try {
    snippets = await input.substrate.searchForRequest({
      workspaceId: input.workspaceId,
      query: composeRetrievalQuery(input.request),
      k: topK,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return skillError(
      'UNKNOWN',
      `knowledge substrate (${input.substrate.name}) failed: ${message}`,
    );
  }
  const highConfidenceHits = snippets.filter((s) => s.similarity >= highFloor).length;
  const mediumConfidenceHits = snippets.filter((s) => s.similarity >= medFloor).length;

  // Decide the draft tier from the substrate quality. The LLM is asked
  // to draft when we have at least medium-confidence grounding; below
  // that we emit a templated placeholder so we never fabricate.
  const tier: SupportDraftConfidence =
    highConfidenceHits >= 1 ? 'high' : mediumConfidenceHits >= 1 ? 'medium' : 'placeholder';

  let proposal: SupportDraftProposal;
  if (tier === 'placeholder') {
    proposal = buildPlaceholderProposal(input.request);
  } else {
    const drafted = await draftReplyWithLlm({
      request: input.request,
      snippets: snippets.slice(0, topK),
      tier,
      llm: input.llm,
    });
    if (!drafted.ok) return drafted;
    proposal = drafted.value;
  }

  let sunk = false;
  if (input.sink) {
    const sinkRes = await input.sink.record({
      workspaceId: input.workspaceId,
      proposal,
    });
    if (sinkRes.ok) sunk = true;
  }

  return skillOk({
    proposal,
    sunk,
    substrate: {
      requested: topK,
      returned: snippets.length,
      highConfidenceHits,
    },
    noOutboundNote: NO_OUTBOUND_NOTE,
  });
}

function clampTopK(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TOP_K;
  return Math.min(Math.floor(raw), 10);
}

function composeRetrievalQuery(req: SupportRequestSnapshot): string {
  // Substrate retrieval matches the inbound subject + body. We bias the
  // query toward the subject (typically the topical signal) by repeating
  // it once before the body — gives the embedding a stronger lexical
  // anchor without changing the retrieval API.
  return `${req.subject}\n\n${req.subject}\n\n${req.body}`.slice(0, 4000);
}

// ── LLM-grounded draft ──────────────────────────────────────────────────

interface DraftWithLlmArgs {
  request: SupportRequestSnapshot;
  snippets: SupportContextSnippet[];
  tier: 'high' | 'medium';
  llm: import('../../llm/types').LlmProvider | undefined;
}

async function draftReplyWithLlm(
  args: DraftWithLlmArgs,
): Promise<SkillResult<SupportDraftProposal>> {
  const provider = args.llm ?? getLlmProvider();
  const system = buildSystemPrompt(args.request);
  const userMessage = buildUserMessage(args.request, args.snippets);

  const completion = await provider.complete({
    system,
    messages: [{ role: 'user', content: userMessage }],
    responseFormat: 'json',
    temperature: 0.2,
    maxTokens: 800,
  });
  if (!completion.ok) {
    return skillError(
      'UPSTREAM_LLM_ERROR',
      `support-handler LLM call failed: ${completion.error.message}`,
      completion.error.code,
    );
  }

  const parsed = parseLlmJson(completion.value.text);
  if (!parsed.ok) return parsed;

  const citations = restrictCitationsToProvided(parsed.value.citedTitles, args.snippets);
  return skillOk(buildSubstantiveProposal(args.request, parsed.value, citations, args.tier));
}

interface LlmReplyShape {
  subject: string;
  body: string;
  citedTitles: string[];
  reasoning: string;
}

function parseLlmJson(raw: string): SkillResult<LlmReplyShape> {
  const trimmed = raw.trim();
  // The provider may wrap JSON in a code fence. Strip a single ```json /
  // ``` envelope before parsing.
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(unwrapped);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return skillError('PARSE_ERROR', `support-handler LLM returned non-JSON: ${message}`);
  }
  if (!isRecord(json)) {
    return skillError('PARSE_ERROR', 'support-handler LLM JSON was not an object');
  }
  const subject = typeof json.subject === 'string' ? json.subject.trim() : '';
  const body = typeof json.body === 'string' ? json.body.trim() : '';
  const reasoning = typeof json.reasoning === 'string' ? json.reasoning.trim() : '';
  const citedRaw = Array.isArray(json.citedTitles) ? json.citedTitles : [];
  const citedTitles = citedRaw.filter((c): c is string => typeof c === 'string');
  if (body.length === 0) {
    return skillError(
      'PARSE_ERROR',
      'support-handler LLM JSON missing required `body` string',
    );
  }
  return skillOk({
    subject: subject.length > 0 ? subject : '',
    body,
    citedTitles,
    reasoning: reasoning.length > 0 ? reasoning : 'LLM drafted from substrate snippets.',
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function restrictCitationsToProvided(
  citedTitles: string[],
  snippets: SupportContextSnippet[],
): SupportContextSnippet[] {
  // Guard against the model citing a snippet we didn't give it (rare
  // with a constrained prompt, but the test-provider's heuristic could
  // emit literal placeholders). Only return citations whose title
  // matches a snippet we passed in.
  const titles = new Set(snippets.map((s) => s.title));
  const matched: SupportContextSnippet[] = [];
  for (const t of citedTitles) {
    if (titles.has(t)) {
      const s = snippets.find((x) => x.title === t);
      if (s && !matched.includes(s)) matched.push(s);
    }
  }
  // If the model failed to cite at all (or only cited unknown titles)
  // but we had high-similarity snippets, surface them all so the
  // operator still sees the grounding.
  if (matched.length === 0) return snippets;
  return matched;
}

function buildSubstantiveProposal(
  request: SupportRequestSnapshot,
  llm: LlmReplyShape,
  citations: SupportContextSnippet[],
  tier: 'high' | 'medium',
): SupportDraftProposal {
  const subject = llm.subject.length > 0 ? llm.subject : defaultReplySubject(request.subject);
  const suggestedAction = tier === 'high' ? 'approve' : 'edit-then-send';
  return {
    proposalId: randomUUID(),
    supportRequestId: request.id,
    subject,
    body: llm.body,
    confidence: tier,
    citations: citations.map(truncateSnippet),
    reasoning: llm.reasoning,
    suggestedAction,
  };
}

function buildPlaceholderProposal(req: SupportRequestSnapshot): SupportDraftProposal {
  const firstName = (req.fromName ?? '').split(/\s+/)[0]?.trim() ?? '';
  const greeting = firstName.length > 0 ? `Hi ${firstName},` : 'Hello,';
  const body = [
    greeting,
    '',
    `Thanks for the note — ${req.partnerName} here at agentplain. ` +
      "We've seen your message and a human is taking a closer look. " +
      "I'll follow up shortly with specifics; in the meantime if anything " +
      'changes on your end, just reply to this thread.',
    '',
    'Thanks for the patience.',
    '',
    `— ${req.partnerName}`,
    '   agentplain · your service partner',
  ].join('\n');
  return {
    proposalId: randomUUID(),
    supportRequestId: req.id,
    subject: defaultReplySubject(req.subject),
    body,
    confidence: 'placeholder',
    citations: [],
    reasoning:
      'Knowledge substrate had no snippet above the medium-confidence floor. ' +
      'Per feedback_no_guesses_no_estimates: drafted a templated holding reply ' +
      'rather than fabricating an answer. Operator should respond manually or ' +
      'escalate.',
    suggestedAction: 'placeholder',
  };
}

function defaultReplySubject(original: string): string {
  const trimmed = original.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

function truncateSnippet(s: SupportContextSnippet): SupportContextSnippet {
  if (s.bodyExcerpt.length <= SNIPPET_EXCERPT_CHAR_CAP) return s;
  return {
    ...s,
    bodyExcerpt: s.bodyExcerpt.slice(0, SNIPPET_EXCERPT_CHAR_CAP - 1).trimEnd() + '…',
  };
}

// ── Prompt construction ─────────────────────────────────────────────────

function buildSystemPrompt(req: SupportRequestSnapshot): string {
  // Stable preamble. Workspace-agnostic. PR #114's prompt-cache wrapper
  // will mark this cacheable so a hot workspace pays the cache write
  // once per ~5-min TTL.
  const verticalLine = req.verticalSlug
    ? `VERTICAL: ${req.verticalSlug}`
    : 'VERTICAL: none-specific';
  return [
    'SUPPORT_HANDLER_V1',
    verticalLine,
    '',
    'You are the agentplain support-handler. You draft a first-touch reply',
    'to a customer who submitted a SupportRequest from /help.',
    '',
    'BRAND VOICE',
    '- agentplain is a service partner, not a SaaS vendor and not a DIY tool.',
    '  Lead with calm, heritage tone. Never pilot / airplane / aviator framing.',
    '- The signature is the named service partner (e.g. Plaino). Sign in their',
    "  voice; do NOT pretend to be the operator and do NOT use the operator's name.",
    '- Lowercase casual headings; no exclamation points; no emoji.',
    '',
    'HARD CONSTRAINTS',
    '- HONESTY: when the WORKSPACE FILE CONTEXT does not cover the customer\'s ask,',
    '  do NOT fabricate. Reply that a human is taking a closer look and will',
    '  follow up. The substrate retrieval already decided whether to invoke you;',
    '  if you are here, at least one snippet should be load-bearing.',
    '- CITATIONS: in the `citedTitles` array, list ONLY snippet titles you',
    '  actually grounded the reply in. Empty array is allowed when no snippet',
    '  was load-bearing (the placeholder path handles that case, but if you',
    '  arrive at the same conclusion, output an empty array — do NOT invent).',
    '- NO OUTBOUND: you draft only. Never say "I just sent" or "I forwarded" —',
    '  the operator will perform any send.',
    '- ESCALATION: if the request mentions billing disputes, security incidents,',
    '  potential legal exposure, or "talk to your CEO / founder" — set the body',
    '  to a brief acknowledgement + "I am routing this to our team for escalation"',
    '  and call that out in `reasoning`. Do NOT promise specifics.',
    '',
    'OUTPUT',
    'Return STRICTLY a single JSON object with these fields:',
    '  subject: string — the reply subject (default: "Re: <original>").',
    '  body: string — plain-text reply, signed by the service partner.',
    '  citedTitles: string[] — exact titles of WORKSPACE FILE CONTEXT entries',
    '    you grounded the reply in. May be empty.',
    '  reasoning: string — one sentence on why this draft.',
    'No prose outside the JSON. No code fence required.',
  ].join('\n');
}

function buildUserMessage(
  req: SupportRequestSnapshot,
  snippets: SupportContextSnippet[],
): string {
  const fromLine = req.fromName
    ? `${req.fromName} <${req.fromEmail}>`
    : req.fromEmail;
  const snippetLines: string[] = [];
  if (snippets.length === 0) {
    snippetLines.push(
      'WORKSPACE FILE CONTEXT: (none — substrate returned no snippets; this branch should not have invoked the LLM)',
    );
  } else {
    snippetLines.push(
      'WORKSPACE FILE CONTEXT (anchor specifics to these; do not invent facts that contradict them):',
    );
    for (const s of snippets) {
      snippetLines.push('');
      const url = s.sourceUrl ? ` · ${s.sourceUrl}` : '';
      snippetLines.push(`— ${s.title} (similarity=${s.similarity.toFixed(2)}${url})`);
      snippetLines.push(s.bodyExcerpt);
    }
  }
  return [
    `WORKSPACE: ${req.workspaceName}`,
    `FROM: ${fromLine}`,
    `RECEIVED_AT: ${req.receivedAt.toISOString()}`,
    `SERVICE_PARTNER: ${req.partnerName}`,
    '',
    `SUBJECT: ${req.subject}`,
    '',
    'BODY:',
    req.body,
    '',
    snippetLines.join('\n'),
  ].join('\n');
}

// ── Test helpers ─────────────────────────────────────────────────────────

export const __testing = {
  buildSystemPrompt,
  buildUserMessage,
  buildPlaceholderProposal,
  composeRetrievalQuery,
  parseLlmJson,
  restrictCitationsToProvided,
  defaultReplySubject,
  truncateSnippet,
};
