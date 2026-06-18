import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleIncomingCall,
  handleCallStatus,
  handleRecordingStatus,
  handleTranscript,
  parseFormBody,
  parseInboundCall,
  parseRecordingStatus,
} from './receivers';
import type { TwilioSignatureVerifier } from './twilio-signature';
import type { NumberResolver } from './provisioning';
import { mcpOk, mcpError } from '@/lib/integrations/mcp-core';
import { defaultRecordingPolicy, type VoiceRecordingConsentGate } from './recording';
import type { CallStatusEvent, RecordingStatusEvent } from './types';
import type { VoiceActionPersistence } from './transcript-actions';

const ACCEPT: TwilioSignatureVerifier = { verify: () => true };
const REJECT: TwilioSignatureVerifier = { verify: () => false };

const resolverFor = (assignment: Awaited<ReturnType<NumberResolver['resolve']>>): NumberResolver => ({
  async resolve() {
    return assignment;
  },
});

// ── 1. Incoming call ─────────────────────────────────────────────────────────

describe('handleIncomingCall', () => {
  const params = {
    CallSid: 'CA1',
    AccountSid: 'AC1',
    From: '+14155551212',
    To: '+18005550100',
    CallStatus: 'ringing',
    Direction: 'inbound',
  };

  it('403s on a bad signature without resolving anything', async () => {
    let resolved = false;
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'bad',
      verifier: REJECT,
      resolver: {
        async resolve() {
          resolved = true;
          return null;
        },
      },
      relayWssUrl: 'wss://relay/ws',
    });
    assert.equal(res.status, 403);
    assert.equal(resolved, false);
  });

  it('returns ConversationRelay TwiML with the vertical playbook + custom params', async () => {
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'good',
      verifier: ACCEPT,
      resolver: resolverFor({ phoneNumber: '+18005550100', workspaceId: 'ws-uuid', verticalSlug: 'cpa' }),
      relayWssUrl: 'wss://relay/ws',
    });
    assert.equal(res.status, 200);
    assert.match(res.contentType, /text\/xml/);
    assert.match(res.body, /<ConversationRelay/);
    assert.match(res.body, /wss:\/\/relay\/ws/);
    assert.match(res.body, /name="workspaceId" value="ws-uuid"/);
    assert.match(res.body, /name="playbookId" value="cpa-after-hours-intake"/);
    // CPA greeting is spoken.
    assert.match(res.body, /office is closed/i);
    // No recording without a consent gate.
    assert.doesNotMatch(res.body, /<Start><Recording/);
  });

  it('falls back to a safe say+hangup when no relay url is configured', async () => {
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'good',
      verifier: ACCEPT,
      resolver: resolverFor(null),
      relayWssUrl: undefined,
    });
    assert.equal(res.status, 200);
    assert.match(res.body, /<Say/);
    assert.match(res.body, /<Hangup\/>/);
    assert.doesNotMatch(res.body, /<ConversationRelay/);
  });

  it('adds <Start><Recording> only when consent is granted', async () => {
    const grantingGate: VoiceRecordingConsentGate = {
      async check() {
        return mcpOk({
          pendingApprovalId: 'a1',
          approvedByUserId: 'u1',
          approvedAt: null,
          expiresAt: null,
          policy: defaultRecordingPolicy(),
        });
      },
    };
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'good',
      verifier: ACCEPT,
      resolver: resolverFor({ phoneNumber: '+18005550100', workspaceId: 'ws-uuid', verticalSlug: 'law' }),
      relayWssUrl: 'wss://relay/ws',
      recordingCallbackUrl: 'https://app/api/voice/twilio/recording',
      recordingGate: grantingGate,
    });
    assert.match(res.body, /<Start><Recording recordingStatusCallback=/);
  });

  it('does NOT record when consent is pending', async () => {
    const pendingGate: VoiceRecordingConsentGate = {
      async check() {
        return mcpError('APPROVAL_REQUIRED', 'opt in', { reference: 'p1' });
      },
    };
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'good',
      verifier: ACCEPT,
      resolver: resolverFor({ phoneNumber: '+18005550100', workspaceId: 'ws-uuid', verticalSlug: 'law' }),
      relayWssUrl: 'wss://relay/ws',
      recordingCallbackUrl: 'https://app/api/voice/twilio/recording',
      recordingGate: pendingGate,
    });
    assert.doesNotMatch(res.body, /<Start><Recording/);
  });

  it('uses the general playbook for an unmapped number', async () => {
    const res = await handleIncomingCall({
      url: 'https://app/x',
      params,
      signature: 'good',
      verifier: ACCEPT,
      resolver: resolverFor(null),
      relayWssUrl: 'wss://relay/ws',
    });
    assert.match(res.body, /name="playbookId" value="general-receptionist"/);
  });
});

// ── 2. Call status ───────────────────────────────────────────────────────────

describe('handleCallStatus', () => {
  const params = { CallSid: 'CA1', AccountSid: 'AC1', CallStatus: 'completed', CallDuration: '42' };

  it('403s on a bad signature', async () => {
    const res = await handleCallStatus({ url: 'https://app/s', params, signature: 'x', verifier: REJECT });
    assert.equal(res.status, 403);
  });

  it('acks 204 and emits the normalized event', async () => {
    let seen: CallStatusEvent | null = null;
    const res = await handleCallStatus({
      url: 'https://app/s',
      params,
      signature: 'ok',
      verifier: ACCEPT,
      onEvent: (e) => {
        seen = e;
      },
    });
    assert.equal(res.status, 204);
    assert.equal(seen!.callSid, 'CA1');
    assert.equal(seen!.callStatus, 'completed');
    assert.equal(seen!.durationSec, 42);
  });
});

// ── 3. Recording status ──────────────────────────────────────────────────────

describe('handleRecordingStatus', () => {
  const params = {
    CallSid: 'CA1',
    RecordingSid: 'RE1',
    RecordingUrl: 'https://api.twilio.com/rec/RE1',
    RecordingStatus: 'completed',
    RecordingDuration: '30',
    RecordingChannels: '2',
  };

  it('403s on a bad signature', async () => {
    const res = await handleRecordingStatus({ url: 'https://app/r', params, signature: 'x', verifier: REJECT });
    assert.equal(res.status, 403);
  });

  it('acks 204 and parses recording metadata', async () => {
    let seen: RecordingStatusEvent | null = null;
    const res = await handleRecordingStatus({
      url: 'https://app/r',
      params,
      signature: 'ok',
      verifier: ACCEPT,
      onEvent: (e) => {
        seen = e;
      },
    });
    assert.equal(res.status, 204);
    assert.equal(seen!.recordingSid, 'RE1');
    assert.equal(seen!.channels, 2);
    assert.equal(seen!.recordingDurationSec, 30);
  });
});

// ── 4. Transcript / Conversation Intelligence ───────────────────────────────

describe('handleTranscript', () => {
  const payload = {
    callSid: 'CA1',
    workspaceId: 'ws-uuid',
    operatorResults: [
      { name: 'Summary', result: { text: 'Caller wants a callback about pricing.' } },
      { name: 'Sentiment', result: { label: 'neutral' } },
    ],
  };

  it('401s when not authorized (no/invalid secret)', async () => {
    const res = await handleTranscript({
      payload,
      authorized: false,
      resolveWorkspaceId: async () => 'ws-uuid',
    });
    assert.equal(res.status, 401);
  });

  it('400s on an unparseable payload', async () => {
    const res = await handleTranscript({
      payload: { nothing: true },
      authorized: true,
      resolveWorkspaceId: async () => 'ws-uuid',
    });
    assert.equal(res.status, 400);
  });

  it('writes action items into the approvals queue and reports counts', async () => {
    const created: string[] = [];
    const persistence: VoiceActionPersistence = {
      async create() {
        created.push('x');
        return { id: `r${created.length}` };
      },
    };
    const res = await handleTranscript({
      payload,
      authorized: true,
      resolveWorkspaceId: async () => 'ws-uuid',
      persistence,
    });
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.created, 1); // one fallback card from the summary
    assert.equal(created.length, 1);
  });

  it('acks without writing when the workspace cannot be resolved', async () => {
    let wrote = false;
    const res = await handleTranscript({
      payload: { callSid: 'CA2', operatorResults: [{ name: 'Summary', result: { text: 'hi' } }] },
      authorized: true,
      resolveWorkspaceId: async () => null,
      persistence: {
        async create() {
          wrote = true;
          return { id: 'x' };
        },
      },
    });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).ignored, 'no_workspace');
    assert.equal(wrote, false);
  });

  it('short-circuits a duplicate call', async () => {
    const res = await handleTranscript({
      payload,
      authorized: true,
      resolveWorkspaceId: async () => 'ws-uuid',
      alreadyProcessed: async () => true,
    });
    assert.equal(JSON.parse(res.body).duplicate, true);
  });
});

// ── Parsing helpers ──────────────────────────────────────────────────────────

describe('form + field parsing', () => {
  it('parseFormBody decodes urlencoded pairs', () => {
    assert.deepEqual(parseFormBody('CallSid=CA1&From=%2B14155551212'), {
      CallSid: 'CA1',
      From: '+14155551212',
    });
  });

  it('parseInboundCall maps Twilio fields', () => {
    const e = parseInboundCall({ CallSid: 'CA1', From: '+1', To: '+2', CallStatus: 'ringing' });
    assert.equal(e.callSid, 'CA1');
    assert.equal(e.from, '+1');
    assert.equal(e.to, '+2');
  });

  it('parseRecordingStatus coerces numeric fields', () => {
    const e = parseRecordingStatus({ RecordingDuration: '12', RecordingChannels: '1' });
    assert.equal(e.recordingDurationSec, 12);
    assert.equal(e.channels, 1);
  });
});
