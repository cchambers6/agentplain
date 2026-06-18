/**
 * lib/voice/config.ts
 *
 * Env-gated readiness detection for the voice layer. The entire integration is
 * built and shipped BEFORE Conner provisions a Twilio account — so every live
 * surface degrades gracefully when the credentials are absent. This module is
 * the single place that decides "can we answer a real call yet?".
 *
 * Required env once the accounts exist (see TODOS-FOR-CONNER):
 *   TWILIO_ACCOUNT_SID      — Twilio account SID (AC…)
 *   TWILIO_AUTH_TOKEN       — Twilio auth token (also signs webhooks)
 *   ELEVENLABS_API_KEY      — voice synthesis (or CARTESIA_API_KEY)
 *   VOICE_RELAY_WSS_URL     — wss:// endpoint of the ConversationRelay server
 *   VOICE_PUBLIC_BASE_URL   — https base Twilio posts webhooks back to
 *
 * Per `feedback_no_guesses_no_estimates.md`: readiness is computed from actual
 * `process.env` presence, never assumed.
 */

import type { VoiceProviderReadiness } from './types';

/** The auth token doubles as the webhook signing secret — never logged. */
export function twilioAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN || undefined;
}

export function twilioAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID || undefined;
}

/** Base URL Twilio posts callbacks to; used to reconstruct the signed URL. */
export function voicePublicBaseUrl(): string | undefined {
  return process.env.VOICE_PUBLIC_BASE_URL || undefined;
}

/** wss:// endpoint of the standalone ConversationRelay server. */
export function voiceRelayWssUrl(): string | undefined {
  return process.env.VOICE_RELAY_WSS_URL || undefined;
}

function synthesisConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY || process.env.CARTESIA_API_KEY);
}

/** Twilio is "configured" when both SID and auth token are present. */
export function isTwilioConfigured(): boolean {
  return Boolean(twilioAccountSid() && twilioAuthToken());
}

/**
 * Full readiness for answering a live call. The UI shows a "not yet
 * provisioned" state and the numbers route 503s until this is `ready`.
 */
export function voiceProviderReadiness(): VoiceProviderReadiness {
  const twilioConfigured = isTwilioConfigured();
  const synthConfigured = synthesisConfigured();
  const relayConfigured = Boolean(voiceRelayWssUrl());

  const missing: string[] = [];
  if (!twilioAccountSid()) missing.push('TWILIO_ACCOUNT_SID');
  if (!twilioAuthToken()) missing.push('TWILIO_AUTH_TOKEN');
  if (!synthConfigured) missing.push('ELEVENLABS_API_KEY (or CARTESIA_API_KEY)');
  if (!relayConfigured) missing.push('VOICE_RELAY_WSS_URL');
  if (!voicePublicBaseUrl()) missing.push('VOICE_PUBLIC_BASE_URL');

  return {
    twilioConfigured,
    synthesisConfigured: synthConfigured,
    ready: twilioConfigured && synthConfigured && relayConfigured,
    missing,
  };
}
