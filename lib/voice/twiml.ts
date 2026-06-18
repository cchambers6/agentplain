/**
 * lib/voice/twiml.ts
 *
 * TwiML response builders. Twilio expects an XML document in reply to an
 * inbound-call webhook; we emit it by hand rather than pulling the `twilio`
 * SDK so the receivers build and run before the package is installed. The
 * shapes mirror the SDK's `<Connect><ConversationRelay>` output exactly (see
 * the `twilio-voice-conversation-relay` skill).
 *
 * Per the ConversationRelay constraint: server-side recording via the REST
 * `record:true` flag is SILENTLY IGNORED on a ConversationRelay call. To
 * record, a `<Start><Recording>` verb MUST precede `<Connect>` in the TwiML —
 * which is exactly what `buildConversationRelayTwiml` does when recording is
 * consented.
 */

/** XML-escape a value destined for an attribute or text node. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ConversationRelayTwimlOptions {
  /** wss:// endpoint of the ConversationRelay server. */
  wssUrl: string;
  /** Spoken greeting before the first caller turn. */
  welcomeGreeting: string;
  /** TTS voice id (provider-specific). */
  voice?: string;
  language?: string;
  transcriptionProvider?: string;
  speechModel?: string;
  /** Allow DTMF keypress to interrupt TTS playback. */
  interruptByDtmf?: boolean;
  /**
   * When set, a `<Start><Recording>` is emitted BEFORE `<Connect>` so the call
   * is recorded. Only pass this once consent is established (see
   * lib/voice/recording.ts) and the jurisdiction's policy allows it.
   */
  recording?: {
    recordingStatusCallbackUrl: string;
    /** 'mono' | 'dual' — dual keeps caller + agent on separate channels. */
    track?: 'mono' | 'dual';
  };
  /** Opaque session params forwarded to the WS server on connect. */
  customParameters?: Record<string, string>;
}

/**
 * Build the inbound-call TwiML that bridges the call to our ConversationRelay
 * WebSocket. This is the ONLY thing the `/api/voice/twilio/incoming` route
 * returns on a successful answer.
 */
export function buildConversationRelayTwiml(opts: ConversationRelayTwimlOptions): string {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<Response>'];

  if (opts.recording) {
    const track = opts.recording.track ?? 'dual';
    parts.push(
      `<Start><Recording recordingStatusCallback="${escapeXml(
        opts.recording.recordingStatusCallbackUrl,
      )}" recordingStatusCallbackMethod="POST" track="${track}"/></Start>`,
    );
  }

  const crAttrs: string[] = [`url="${escapeXml(opts.wssUrl)}"`];
  if (opts.welcomeGreeting) crAttrs.push(`welcomeGreeting="${escapeXml(opts.welcomeGreeting)}"`);
  if (opts.voice) crAttrs.push(`voice="${escapeXml(opts.voice)}"`);
  if (opts.language) crAttrs.push(`language="${escapeXml(opts.language)}"`);
  if (opts.transcriptionProvider)
    crAttrs.push(`transcriptionProvider="${escapeXml(opts.transcriptionProvider)}"`);
  if (opts.speechModel) crAttrs.push(`speechModel="${escapeXml(opts.speechModel)}"`);
  if (opts.interruptByDtmf) crAttrs.push('interruptByDtmf="true"');

  const customParams = Object.entries(opts.customParameters ?? {})
    .map(
      ([name, val]) =>
        `<Parameter name="${escapeXml(name)}" value="${escapeXml(val)}"/>`,
    )
    .join('');

  parts.push('<Connect>');
  if (customParams) {
    parts.push(`<ConversationRelay ${crAttrs.join(' ')}>${customParams}</ConversationRelay>`);
  } else {
    parts.push(`<ConversationRelay ${crAttrs.join(' ')}/>`);
  }
  parts.push('</Connect>');
  parts.push('</Response>');
  return parts.join('');
}

/**
 * A graceful spoken fallback used when voice is not yet provisioned, a
 * playbook can't be resolved, or the relay URL is missing — Twilio plays this
 * and hangs up instead of erroring the caller into dead air.
 */
export function buildSayAndHangupTwiml(message: string, voice = 'Polly.Joanna'): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Say voice="${escapeXml(voice)}">${escapeXml(message)}</Say>`,
    '<Hangup/>',
    '</Response>',
  ].join('');
}

/** Content-Type every TwiML response must carry. */
export const TWIML_CONTENT_TYPE = 'text/xml; charset=utf-8';
