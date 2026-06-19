/**
 * lib/voice/conversation-relay/handler.ts
 *
 * The transport-agnostic ConversationRelay bridge. Given a typed inbound frame
 * and the session, it yields the outbound frames Twilio should receive — the
 * LLM turn streamed token-by-token (lower latency: Twilio speaks as tokens
 * arrive), an interrupt acknowledgement, or an `end`. The actual WebSocket
 * lives in `server.ts`; keeping the decision logic here makes the whole bridge
 * unit-testable with no socket and no live model.
 *
 * Per `project_no_outbound_architecture.md`: the bridge only converses. It
 * never books, sends, or commits — the transcript pipeline (run after the call)
 * drafts action items into the approvals queue for a human.
 */

import type { CRInboundMessage, CROutboundMessage } from './protocol';
import {
  callerTurnCount,
  type ConversationRelaySession,
  type VoiceResponder,
} from './session';

export interface HandleOptions {
  /** Streams the LLM reply token-by-token to the caller as it generates. */
  stream?: boolean;
}

/**
 * Process one inbound frame, mutating session history and yielding the frames
 * to send back. Non-conversational frames (connected/setup/dtmf/interrupt/
 * error) are handled with minimal, safe responses.
 */
export async function* handleInboundMessage(
  message: CRInboundMessage,
  session: ConversationRelaySession,
  responder: VoiceResponder,
  options: HandleOptions = {},
): AsyncGenerator<CROutboundMessage> {
  switch (message.type) {
    case 'connected':
    case 'setup': {
      // Setup carries call metadata + our custom parameters. The session is
      // already constructed from those before the socket loop starts, so
      // there is nothing to say yet — Twilio plays the welcomeGreeting from
      // the TwiML. Backfill from/to if present.
      if (message.type === 'setup') {
        if (message.from && !session.from) session.from = message.from;
        if (message.to && !session.to) session.to = message.to;
      }
      return;
    }

    case 'interrupt': {
      // The caller talked over the agent. Twilio already stopped playback; we
      // just acknowledge so any in-flight generation can be abandoned upstream.
      yield { type: 'interrupt' };
      return;
    }

    case 'dtmf': {
      // No IVR menu in these playbooks — record the keypress as a user turn so
      // the responder can react ("press 0 for a person" style asks).
      session.history.push({ role: 'user', content: `[caller pressed ${message.digit}]` });
      yield* generateReply(session, responder, options);
      return;
    }

    case 'error': {
      // Surface nothing to the caller; the server logs it. End gracefully.
      yield { type: 'end', reason: 'relay-error' };
      return;
    }

    case 'prompt': {
      const text = (message.voicePrompt ?? '').trim();
      if (!text) return;
      session.history.push({ role: 'user', content: text });

      if (callerTurnCount(session) > session.maxTurns) {
        yield {
          type: 'text',
          token:
            "Thanks for calling — I've got your details and someone will follow up. Goodbye.",
          last: true,
        };
        yield { type: 'end', reason: 'max-turns' };
        return;
      }

      yield* generateReply(session, responder, options);
      return;
    }

    default:
      return;
  }
}

/** Stream the responder's reply, appending the full text to history. */
async function* generateReply(
  session: ConversationRelaySession,
  responder: VoiceResponder,
  options: HandleOptions,
): AsyncGenerator<CROutboundMessage> {
  const lastUser = [...session.history].reverse().find((t) => t.role === 'user');
  const userText = lastUser?.content ?? '';

  let full = '';
  const stream = responder.respond({
    playbook: session.playbook,
    history: session.history,
    userText,
    session,
  });

  if (options.stream) {
    for await (const token of stream) {
      full += token;
      yield { type: 'text', token, last: false };
    }
    // Twilio won't play buffered audio until it sees last:true.
    yield { type: 'text', token: '', last: true };
  } else {
    for await (const token of stream) full += token;
    yield { type: 'text', token: full, last: true };
  }

  session.history.push({ role: 'assistant', content: full });
}
