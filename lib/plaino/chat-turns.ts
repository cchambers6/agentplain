/**
 * lib/plaino/chat-turns.ts
 *
 * Pure helpers for the /api/chat backbone — kept out of the route handler
 * so the role-mapping, transcript assembly, and latest-question lookup are
 * unit-testable without spinning a request or a DB.
 */

import type { LlmMessage } from '@/lib/llm/types';
import type { PlainoTurn } from './conversation-log';

export interface ChatTurnInput {
  role: 'user' | 'plaino';
  body: string;
}

/** Map chat turns to the provider's role shape. Plaino → assistant. */
export function toLlmMessages(messages: ChatTurnInput[]): LlmMessage[] {
  return messages.map((m) => ({
    role: m.role === 'plaino' ? 'assistant' : 'user',
    content: m.body,
  }));
}

/** Build the persisted transcript: the turns as received + Plaino's reply.
 *  The caller supplies the timestamp so the function stays pure (and
 *  testable without mocking the clock). */
export function appendReply(
  messages: ChatTurnInput[],
  reply: string,
  at: string,
): PlainoTurn[] {
  const prior: PlainoTurn[] = messages.map((m) => ({
    role: m.role,
    body: m.body,
    at,
  }));
  prior.push({ role: 'plaino', body: reply, at });
  return prior;
}

/** The most recent user message — what the support route searches the
 *  knowledge substrate with. Empty string when there is none. */
export function latestUserMessage(messages: ChatTurnInput[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].body;
  }
  return '';
}
