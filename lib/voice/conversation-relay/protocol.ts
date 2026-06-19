/**
 * lib/voice/conversation-relay/protocol.ts
 *
 * The ConversationRelay WebSocket message protocol, typed. Twilio handles ASR
 * and TTS; over the socket we exchange JSON frames. These types mirror the
 * `twilio-voice-conversation-relay` skill's documented message set so the
 * bridge can be unit-tested without a live socket.
 */

// ── Frames Twilio sends us ──────────────────────────────────────────────────

export interface CRConnectedMessage {
  type: 'connected';
  callSid?: string;
  streamSid?: string;
}

/** Sent once at session start with the call metadata + our <Parameter>s. */
export interface CRSetupMessage {
  type: 'setup';
  callSid?: string;
  from?: string;
  to?: string;
  /** Our forwarded <Parameter name=… value=…> custom params. */
  customParameters?: Record<string, string>;
}

/** The caller finished speaking; `voicePrompt` is the (untrusted) transcript. */
export interface CRPromptMessage {
  type: 'prompt';
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}

export interface CRInterruptMessage {
  type: 'interrupt';
}

export interface CRDtmfMessage {
  type: 'dtmf';
  digit: string;
}

export interface CRErrorMessage {
  type: 'error';
  description?: string;
}

export type CRInboundMessage =
  | CRConnectedMessage
  | CRSetupMessage
  | CRPromptMessage
  | CRInterruptMessage
  | CRDtmfMessage
  | CRErrorMessage;

// ── Frames we send Twilio ───────────────────────────────────────────────────

export interface CRTextMessage {
  type: 'text';
  /** A token (when streaming) or a full utterance. */
  token: string;
  /** Twilio only plays audio once it sees `last: true`. */
  last: boolean;
}

export interface CRSendInterruptMessage {
  type: 'interrupt';
}

export interface CREndMessage {
  type: 'end';
  reason?: string;
}

export type CROutboundMessage = CRTextMessage | CRSendInterruptMessage | CREndMessage;

/** Parse a raw socket frame into a typed inbound message, or null if invalid. */
export function parseInboundMessage(raw: string): CRInboundMessage | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const type = (obj as { type?: unknown }).type;
  if (typeof type !== 'string') return null;
  return obj as CRInboundMessage;
}
