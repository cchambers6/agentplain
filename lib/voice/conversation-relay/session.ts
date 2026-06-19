/**
 * lib/voice/conversation-relay/session.ts
 *
 * Per-call session state + the LLM responder port. ConversationRelay is a pure
 * transport with "no built-in memory or context" — we own the conversation
 * history here. Per `feedback_cold_start_safe_agents.md` the durable facts
 * (workspaceId, playbook id) are carried on the session and re-derivable from
 * the call's custom parameters, so a process restart can rebuild context.
 */

import type { VoicePlaybook } from '../types';

export interface VoiceTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationRelaySession {
  callSid: string;
  /** The agentplain workspace this number belongs to. */
  workspaceId: string;
  /** Caller / called numbers, when known from setup. */
  from?: string;
  to?: string;
  playbook: VoicePlaybook;
  history: VoiceTurn[];
  /** Safety bound — a call is force-ended past this many caller turns. */
  maxTurns: number;
}

export function createSession(args: {
  callSid: string;
  workspaceId: string;
  playbook: VoicePlaybook;
  from?: string;
  to?: string;
  maxTurns?: number;
}): ConversationRelaySession {
  return {
    callSid: args.callSid,
    workspaceId: args.workspaceId,
    from: args.from,
    to: args.to,
    playbook: args.playbook,
    history: [],
    maxTurns: args.maxTurns ?? 40,
  };
}

/** Count of caller turns so far — drives the maxTurns safety bound. */
export function callerTurnCount(session: ConversationRelaySession): number {
  return session.history.filter((t) => t.role === 'user').length;
}

/**
 * The LLM responder port. The handler depends only on this — the real
 * implementation (a streaming model call grounded in the playbook system
 * prompt) and the degraded/stub implementations both satisfy it, per the
 * two-implementation rule in `feedback_runner_portability.md`.
 *
 * SECURITY: `userText` is ASR-transcribed caller speech — untrusted. Real
 * implementations MUST pass it as an isolated user turn, never concatenated
 * into the system prompt (prompt-injection boundary).
 */
export interface VoiceResponder {
  respond(input: {
    playbook: VoicePlaybook;
    history: VoiceTurn[];
    userText: string;
    session: ConversationRelaySession;
  }): AsyncIterable<string>;
}

/**
 * A dependency-free responder used when the model layer is paused/degraded
 * (e.g. LLM_DEGRADED_MODE or no API key). It keeps the caller informed and
 * the call graceful instead of dropping to dead air. This is what ships and
 * runs in tests; `buildLlmVoiceResponder` (parked) swaps in the live model.
 */
export class DegradedVoiceResponder implements VoiceResponder {
  // eslint-disable-next-line require-yield
  async *respond(input: {
    playbook: VoicePlaybook;
    history: VoiceTurn[];
    userText: string;
    session: ConversationRelaySession;
  }): AsyncIterable<string> {
    yield "Thanks — I've noted that. Someone from the office will follow up with you. Is there anything else you'd like me to pass along?";
  }
}

/** Convenience: collect a responder's stream into a single string. */
export async function collectResponse(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const tok of stream) out += tok;
  return out;
}
