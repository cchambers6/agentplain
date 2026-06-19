/**
 * lib/voice/receivers.ts
 *
 * The decision logic behind the four Twilio voice webhook routes, factored out
 * of the Next.js route handlers so each receiver is unit-testable with no
 * socket, no Twilio, and no database. The thin `app/api/voice/twilio/*` routes
 * parse the Request and delegate here.
 *
 * Every receiver verifies the X-Twilio-Signature first (the routes are public),
 * then does the minimum work and acks fast — voice webhooks have a hard 15s
 * ceiling and status/recording callbacks just need a 2xx.
 */

import {
  buildConversationRelayTwiml,
  buildSayAndHangupTwiml,
  TWIML_CONTENT_TYPE,
} from './twiml';
import { canonicalWebhookUrl, type TwilioSignatureVerifier } from './twilio-signature';
import type { NumberResolver } from './provisioning';
import {
  DEFAULT_PLAYBOOK,
  playbookById,
  playbookForVerticalSlug,
} from './playbooks';
import {
  defaultRecordingPolicy,
  evaluateRecordingConsent,
  type RecordingRetentionPolicy,
  type VoiceRecordingConsentGate,
} from './recording';
import {
  parseConversationIntelligenceWebhook,
  writeVoiceActionItems,
  type VoiceActionPersistence,
} from './transcript-actions';
import type {
  CallStatusEvent,
  InboundCallEvent,
  RecordingStatusEvent,
  VoicePlaybook,
} from './types';

export interface ReceiverResponse {
  status: number;
  contentType: string;
  body: string;
}

const JSON_CT = 'application/json; charset=utf-8';

function json(status: number, obj: unknown): ReceiverResponse {
  return { status, contentType: JSON_CT, body: JSON.stringify(obj) };
}

/** Parse an application/x-www-form-urlencoded body into a flat string map. */
export function parseFormBody(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(raw);
  for (const [k, v] of sp.entries()) out[k] = v;
  return out;
}

interface SignedInput {
  url: string;
  params: Record<string, string>;
  signature: string | null;
  verifier: TwilioSignatureVerifier;
}

function verify(input: SignedInput): boolean {
  return input.verifier.verify({
    url: canonicalWebhookUrl(input.url),
    params: input.params,
    signature: input.signature,
  });
}

// ── 1. Incoming call ─────────────────────────────────────────────────────────

export interface IncomingCallInput extends SignedInput {
  resolver: NumberResolver;
  /** wss:// relay endpoint; when absent the call gets a graceful fallback. */
  relayWssUrl?: string;
  /** Absolute URL Twilio posts recording-status callbacks to. */
  recordingCallbackUrl?: string;
  /** Consent gate; when present + consented, the TwiML records the call. */
  recordingGate?: VoiceRecordingConsentGate;
  recordingPolicy?: RecordingRetentionPolicy;
}

export function parseInboundCall(params: Record<string, string>): InboundCallEvent {
  return {
    callSid: params.CallSid ?? '',
    accountSid: params.AccountSid ?? '',
    from: params.From ?? '',
    to: params.To ?? '',
    callStatus: params.CallStatus ?? '',
    direction: params.Direction ?? 'inbound',
    forwardedFrom: params.ForwardedFrom || undefined,
  };
}

export async function handleIncomingCall(input: IncomingCallInput): Promise<ReceiverResponse> {
  if (!verify(input)) {
    return json(403, { error: 'invalid_signature' });
  }

  const call = parseInboundCall(input.params);
  const assignment = call.to ? await input.resolver.resolve(call.to) : null;

  const playbook: VoicePlaybook = assignment?.playbookId
    ? (playbookById(assignment.playbookId) ?? DEFAULT_PLAYBOOK)
    : playbookForVerticalSlug(assignment?.verticalSlug ?? null);

  // No relay endpoint configured → don't drop the caller into dead air.
  if (!input.relayWssUrl) {
    return {
      status: 200,
      contentType: TWIML_CONTENT_TYPE,
      body: buildSayAndHangupTwiml(
        "Thanks for calling. Our voice assistant isn't available right now — please try again shortly.",
      ),
    };
  }

  // Recording is OFF unless the workspace has opted in (consent gate) AND we
  // have somewhere to send the recording-status callback.
  let recordingTwiml: { recordingStatusCallbackUrl: string } | undefined;
  if (input.recordingGate && input.recordingCallbackUrl && assignment?.workspaceId) {
    const consent = await evaluateRecordingConsent({
      workspaceId: assignment.workspaceId,
      policy: input.recordingPolicy ?? defaultRecordingPolicy(),
      gate: input.recordingGate,
    });
    if (consent.record) {
      recordingTwiml = { recordingStatusCallbackUrl: input.recordingCallbackUrl };
    }
  }

  const customParameters: Record<string, string> = {};
  if (assignment?.workspaceId) customParameters.workspaceId = assignment.workspaceId;
  customParameters.playbookId = playbook.id;
  customParameters.verticalSlug = playbook.verticalSlug;

  const body = buildConversationRelayTwiml({
    wssUrl: input.relayWssUrl,
    welcomeGreeting: playbook.welcomeGreeting,
    voice: playbook.defaultVoice,
    interruptByDtmf: true,
    recording: recordingTwiml,
    customParameters,
  });

  return { status: 200, contentType: TWIML_CONTENT_TYPE, body };
}

// ── 2. Call status ───────────────────────────────────────────────────────────

export interface CallStatusInput extends SignedInput {
  onEvent?: (event: CallStatusEvent) => void | Promise<void>;
}

export function parseCallStatus(params: Record<string, string>): CallStatusEvent {
  const dur = params.CallDuration ?? params.Duration;
  return {
    callSid: params.CallSid ?? '',
    accountSid: params.AccountSid ?? '',
    callStatus: params.CallStatus ?? '',
    durationSec: dur ? Number(dur) : undefined,
    from: params.From || undefined,
    to: params.To || undefined,
  };
}

export async function handleCallStatus(input: CallStatusInput): Promise<ReceiverResponse> {
  if (!verify(input)) return json(403, { error: 'invalid_signature' });
  const event = parseCallStatus(input.params);
  await input.onEvent?.(event);
  // Status callbacks expect a 2xx with no body.
  return { status: 204, contentType: JSON_CT, body: '' };
}

// ── 3. Recording status ──────────────────────────────────────────────────────

export interface RecordingStatusInput extends SignedInput {
  onEvent?: (event: RecordingStatusEvent) => void | Promise<void>;
}

export function parseRecordingStatus(params: Record<string, string>): RecordingStatusEvent {
  return {
    callSid: params.CallSid ?? '',
    accountSid: params.AccountSid ?? '',
    recordingSid: params.RecordingSid ?? '',
    recordingUrl: params.RecordingUrl ?? '',
    recordingStatus: params.RecordingStatus ?? '',
    recordingDurationSec: params.RecordingDuration ? Number(params.RecordingDuration) : undefined,
    channels: params.RecordingChannels ? Number(params.RecordingChannels) : undefined,
  };
}

export async function handleRecordingStatus(input: RecordingStatusInput): Promise<ReceiverResponse> {
  if (!verify(input)) return json(403, { error: 'invalid_signature' });
  const event = parseRecordingStatus(input.params);
  await input.onEvent?.(event);
  return { status: 204, contentType: JSON_CT, body: '' };
}

// ── 4. Transcript / Conversation Intelligence results ───────────────────────

export interface TranscriptInput {
  /** Raw JSON body of the CI OperatorResults webhook. */
  payload: unknown;
  /**
   * Shared-secret check. The CI webhook action URL is one we configure, so we
   * authenticate it with a bearer token we set, rather than the form-encoded
   * X-Twilio-Signature (CI v3 webhooks are JSON). Return true to accept.
   */
  authorized: boolean;
  /** Resolve the workspace this conversation belongs to. */
  resolveWorkspaceId: (parsed: { callSid: string; to?: string }) => Promise<string | null>;
  persistence?: VoiceActionPersistence;
  /** Guards against double-processing the same call (caller-supplied). */
  alreadyProcessed?: (callSid: string) => Promise<boolean>;
}

export async function handleTranscript(input: TranscriptInput): Promise<ReceiverResponse> {
  if (!input.authorized) return json(401, { error: 'unauthorized' });

  const parsed = parseConversationIntelligenceWebhook(input.payload);
  if (!parsed) return json(400, { error: 'unparseable_payload' });

  if (input.alreadyProcessed && (await input.alreadyProcessed(parsed.callSid))) {
    return json(200, { ok: true, duplicate: true, callSid: parsed.callSid });
  }

  const workspaceId = await input.resolveWorkspaceId({ callSid: parsed.callSid });
  if (!workspaceId) {
    // We can't land action items without a workspace. Ack so Twilio stops
    // retrying — there's nowhere to write.
    return json(200, { ok: true, ignored: 'no_workspace', callSid: parsed.callSid });
  }

  const { created, items } = await writeVoiceActionItems({
    workspaceId,
    parsed,
    persistence: input.persistence,
  });

  return json(200, { ok: true, callSid: parsed.callSid, created: created.length, items: items.length });
}
