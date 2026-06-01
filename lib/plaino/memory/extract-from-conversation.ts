/**
 * lib/plaino/memory/extract-from-conversation.ts
 *
 * Extracts DURABLE memory entries from the most recent turn-pair in a
 * Plaino chat. Pure function over (turns, llm) — no side-effects. The
 * dispatcher invokes this AFTER persisting the customer turn + Plaino
 * reply, fire-and-forget, so it never blocks the customer's response.
 *
 * The system prompt is cache-friendly (no per-call workspace data) and
 * instructs the model to surface ONLY entries that survive the next
 * session — preferences, in-flight projects, named entities, decisions.
 * Ephemeral chatter ("good morning!", "thanks!") returns no entries.
 *
 * Per project_no_outbound_architecture: this only reads chat content;
 * it does not call anything external on the customer's behalf.
 *
 * Per the honesty rule: every proposed entry must carry a one-sentence
 * justification. Proposals without one are dropped — that's how we
 * guarantee "save WHY, not just WHAT" without trusting the LLM's prose.
 */

import type { LlmProvider } from '../../llm/types';
import { MODEL_SONNET } from '../../llm/model-tiers';
import {
  proposedMemoryEntrySchema,
  type ProposedMemoryEntry,
} from './types';

/**
 * One turn of the chat the extractor sees. Lean by design: we don't
 * ship the dispatcher's classification metadata or citations into the
 * extract prompt — only role + body + the source-message id so we can
 * link back.
 */
export interface ExtractInputTurn {
  role: 'customer' | 'plaino';
  body: string;
  /** The ChatMessage id this turn was persisted as. Only customer
   *  turns get linked back as `sourceChatMessageId` (Plaino's own
   *  replies are noise as memory sources). */
  chatMessageId: string;
}

export interface ExtractArgs {
  /** Workspace the chat belongs to. Carried in metadata; the prompt
   *  itself does not need the id. */
  workspaceId: string;
  /** Last ~4 turns. Newest last. */
  turns: ExtractInputTurn[];
  llm: LlmProvider;
}

export interface ExtractResult {
  /** Validated proposed entries — every one passed the schema and has
   *  a non-empty justification. The caller upserts these. */
  proposed: ProposedMemoryEntry[];
  /** Raw LLM model id served (telemetry) + a count of dropped raw
   *  proposals so callers can log "extractor returned 3, kept 2." */
  meta: {
    droppedCount: number;
    rawCount: number;
  };
}

export const EXTRACT_SYSTEM_PROMPT_VERSION = 'PLAINO_MEMORY_EXTRACT_V1';

const EXTRACT_SYSTEM_PROMPT = [
  EXTRACT_SYSTEM_PROMPT_VERSION,
  '',
  'You read a short slice of a chat between a CUSTOMER and PLAINO (the',
  'service partner) and decide what — if anything — is worth saving as',
  'a DURABLE memory entry. You will see at most 4 turns. Your job is',
  'to surface only facts that survive the next session.',
  '',
  '── WHAT COUNTS AS DURABLE ──────────────────────────────────────',
  'USER       — facts about the people in the workspace: names, role',
  '             preferences, preferred communication style.',
  'FEEDBACK   — explicit guidance about HOW to work: "always cc the',
  '             team", "never mention pricing in cold email", "format',
  '             reports as bullets, not paragraphs".',
  'PROJECT    — in-flight work the customer is moving: a deal, a',
  '             listing, a vendor migration, a deadline, named entities',
  '             tied to ongoing work.',
  'REFERENCE  — pointers to where information lives: "our CRM is',
  '             HubSpot", "files are in the Atlanta Drive folder".',
  '',
  '── WHAT TO DROP ────────────────────────────────────────────────',
  'Drop: greetings, thanks, transient acknowledgements, anything where',
  'the value evaporates after the customer closes the tab.',
  '',
  'Drop: facts you already know — if the customer just confirmed the',
  'thing Plaino already said, the memory is duplicative.',
  '',
  'Drop: anything whose only justification is "the customer said this'
    + ' in chat." That is not a reason to save.',
  '',
  '── PII RULE — LOAD-BEARING ─────────────────────────────────────',
  'The `title` field is stored in PLAINTEXT for fast list/search. Do',
  'NOT put PII in titles: no full names, no account numbers, no',
  'addresses, no phone numbers. Use generalized labels — "preferred',
  'cc on listing emails", NOT "always cc John Smith jsmith@acme.com".',
  'PII may appear in `body` (it is encrypted at rest).',
  '',
  '── OUTPUT FORMAT ───────────────────────────────────────────────',
  'Return STRICTLY a single JSON object. No prose outside it.',
  'Shape:',
  '{',
  '  "entries": [',
  '    {',
  '      "kind": "USER" | "FEEDBACK" | "PROJECT" | "REFERENCE",',
  '      "title": "short, PII-free label — under 100 chars",',
  '      "body": "the durable fact — full sentence, may contain PII",',
  '      "justification": "one sentence: why this survives the session"',
  '    }',
  '  ]',
  '}',
  '',
  'When nothing in the slice is durable, return `{"entries": []}`. An',
  'empty list is the CORRECT answer for ephemeral chatter — do not',
  'invent entries to look productive.',
].join('\n');

/**
 * Extract durable memory entries from the last few turns. Pure: no
 * I/O beyond the LLM call. Failures (LLM error, malformed JSON,
 * schema failure) return an empty `proposed` list — the dispatcher
 * treats this as "nothing to save," and the customer reply still
 * lands.
 */
export async function extractMemoryFromConversation(
  args: ExtractArgs,
): Promise<ExtractResult> {
  if (args.turns.length === 0) {
    return { proposed: [], meta: { droppedCount: 0, rawCount: 0 } };
  }

  const userBlock = buildExtractUserMessage(args.turns);
  const completion = await args.llm.complete({
    system: EXTRACT_SYSTEM_PROMPT,
    model: MODEL_SONNET,
    messages: [{ role: 'user', content: userBlock }],
    responseFormat: 'json',
    temperature: 0.1,
    maxTokens: 800,
    cacheSystem: true,
    meta: {
      skill: 'plaino-memory-extract',
      workspaceId: args.workspaceId,
    },
  });
  if (!completion.ok) {
    return { proposed: [], meta: { droppedCount: 0, rawCount: 0 } };
  }

  const parsed = safeParseEntries(completion.value.text);
  if (!parsed.ok) {
    return { proposed: [], meta: { droppedCount: 0, rawCount: 0 } };
  }

  // The latest customer turn is the most likely source. Plaino's own
  // turns aren't useful as a memory source because they don't carry
  // new facts on their own.
  const latestCustomerTurn =
    [...args.turns].reverse().find((t) => t.role === 'customer') ?? null;

  const proposed: ProposedMemoryEntry[] = [];
  let dropped = 0;
  for (const raw of parsed.entries) {
    const result = proposedMemoryEntrySchema.safeParse(raw);
    if (!result.success) {
      dropped++;
      continue;
    }
    const entry = result.data;
    // Strip PII tells that slip into the title — emails, phone-like
    // digit runs, long capitalized name pairs. The rule is encoded in
    // the prompt, but defense-in-depth at the seam costs nothing.
    if (looksLikePiiInTitle(entry.title)) {
      dropped++;
      continue;
    }
    proposed.push({
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      justification: entry.justification,
      sourceChatMessageId:
        typeof entry.sourceChatMessageId === 'string' &&
        entry.sourceChatMessageId.length > 0
          ? entry.sourceChatMessageId
          : (latestCustomerTurn?.chatMessageId ?? null),
    });
  }

  return {
    proposed,
    meta: { droppedCount: dropped, rawCount: parsed.entries.length },
  };
}

interface ParsedOk {
  ok: true;
  entries: unknown[];
}
interface ParsedErr {
  ok: false;
}

function safeParseEntries(raw: string): ParsedOk | ParsedErr {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false };
  }
  const arr = (json as Record<string, unknown>).entries;
  if (!Array.isArray(arr)) return { ok: false };
  return { ok: true, entries: arr };
}

function buildExtractUserMessage(turns: ExtractInputTurn[]): string {
  const lines: string[] = ['RECENT_TURNS (oldest first):'];
  for (const t of turns) {
    const speaker = t.role === 'customer' ? 'CUSTOMER' : 'PLAINO';
    lines.push(`[${speaker} · msg=${t.chatMessageId}] ${t.body}`);
  }
  return lines.join('\n');
}

/** Cheap heuristic: emails, long digit runs, or a "Firstname Lastname" pair
 *  in the title is almost certainly PII the extractor was told to keep out.
 *  Conservative — false positives only cost one dropped memory; false
 *  negatives leak a name into a plaintext column. */
function looksLikePiiInTitle(title: string): boolean {
  if (/@/.test(title)) return true;
  if (/\d{4,}/.test(title)) return true;
  if (/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/.test(title)) return true;
  return false;
}

export const __testing = {
  EXTRACT_SYSTEM_PROMPT,
  buildExtractUserMessage,
  safeParseEntries,
  looksLikePiiInTitle,
};
