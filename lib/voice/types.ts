/**
 * lib/voice/types.ts
 *
 * Vendor-neutral type surface for the voice integration layer. Twilio is the
 * first (and currently only) telephony provider, but per
 * `feedback_no_silent_vendor_lock.md` and `feedback_runner_portability.md`
 * nothing above this file imports the `twilio` SDK directly — the SDK is
 * confined to `lib/voice/client.ts` (lazy) and the signature verifier. Routes,
 * the ConversationRelay bridge, the transcript pipeline, and the UI all speak
 * these provider-agnostic shapes.
 *
 * Per `project_no_outbound_architecture.md`: voice agents LISTEN, transcribe,
 * and DRAFT action items into the approvals queue. They never place outbound
 * calls or send anything autonomously — the webhook receivers here are pure
 * RECEIVERS, exactly like the Gmail Pub/Sub receiver.
 */

import type { Vertical } from '@prisma/client';

/** A normalized inbound-call event, parsed from a Twilio voice webhook. */
export interface InboundCallEvent {
  /** Provider-stable call id (`CallSid` on Twilio). The idempotency anchor. */
  callSid: string;
  /** Account the call belongs to (`AccountSid`). */
  accountSid: string;
  /** Caller number in E.164 (`From`). */
  from: string;
  /** The provisioned number that was dialed in E.164 (`To`). */
  to: string;
  /** Twilio call status at webhook time. */
  callStatus: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-dial' | string;
  /** Present when the call was forwarded to the agentplain number. */
  forwardedFrom?: string;
}

/** A normalized call-status callback (initiated/ringing/answered/completed…). */
export interface CallStatusEvent {
  callSid: string;
  accountSid: string;
  callStatus: string;
  /** Billed call duration in seconds, present on `completed`. */
  durationSec?: number;
  from?: string;
  to?: string;
}

/** A normalized recording-status callback. */
export interface RecordingStatusEvent {
  callSid: string;
  accountSid: string;
  recordingSid: string;
  /** Twilio-hosted media URL (append `.mp3`/`.wav` to fetch). */
  recordingUrl: string;
  recordingStatus: string;
  recordingDurationSec?: number;
  /** 1 or 2 — relevant for two-party-consent retention policy. */
  channels?: number;
}

/**
 * A single action item extracted from a completed call by the transcript
 * pipeline. These become `WorkApprovalQueueItem` rows — draft-only, reviewed
 * by the operator on /approvals. Nothing here is acted on autonomously.
 */
export interface VoiceActionItem {
  /** Short imperative title ("Call back about leaking water heater"). */
  title: string;
  /** Caller-facing summary of what they asked for. */
  summary: string;
  /** LLM/operator-assessed urgency. Drives card ordering, not auto-action. */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Best-effort caller intent label from the Conversation Intelligence run. */
  intent?: string;
  /** Conversation-level sentiment, if the Sentiment operator ran. */
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  /** A callback number the caller left, normalized to E.164 when parseable. */
  callbackNumber?: string;
  /** Free-form follow-up steps the agent suggests the human take. */
  suggestedNextSteps?: string[];
}

/** The vertical-keyed identity of a voice playbook (system prompt + voice). */
export interface VoicePlaybook {
  /** Stable id — `<verticalSlug>-<scenario>` e.g. `cpa-after-hours-intake`. */
  id: string;
  /** Marketing vertical slug this playbook serves (matches vertical-enum). */
  verticalSlug: string;
  /** Prisma vertical enum, for persistence-side lookups. */
  vertical: Vertical | null;
  /** Human label shown in VoiceSettings. */
  label: string;
  /** One-line description of when this playbook answers. */
  scenario: string;
  /**
   * The system prompt handed to the LLM on every ConversationRelay turn.
   * Caller speech is injected separately as untrusted user input — never
   * concatenated into this string (prompt-injection boundary).
   */
  systemPrompt: string;
  /** Spoken greeting Twilio plays before the first caller turn. */
  welcomeGreeting: string;
  /** Default TTS voice id (provider-specific; overridable in settings). */
  defaultVoice: string;
  /** Topics the agent must refuse / hand off rather than answer. */
  guardrails: string[];
}

/** Whether the live Twilio + synthesis credentials are present in env. */
export interface VoiceProviderReadiness {
  twilioConfigured: boolean;
  synthesisConfigured: boolean;
  /** True only when everything needed to answer a live call is present. */
  ready: boolean;
  /** Human-readable missing-piece list for the settings UI + TODOs. */
  missing: string[];
}
