/**
 * POST /api/voice/twilio/incoming
 *
 * Inbound-call webhook. Twilio POSTs (form-encoded) when a provisioned number
 * rings; we reply with TwiML that bridges the call to the ConversationRelay
 * WebSocket server, using the workspace's vertical playbook. Recording is added
 * only when the workspace has an approved recording-consent grant.
 *
 * Per `project_no_outbound_architecture.md`: this RECEIVES a call and answers
 * it; it never places one. All decision logic lives in `lib/voice/receivers.ts`
 * (unit-tested); this route only parses the Request and sets headers.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { handleIncomingCall, parseFormBody } from '@/lib/voice/receivers';
import { getTwilioSignatureVerifier } from '@/lib/voice/twilio-signature';
import { envNumberResolver } from '@/lib/voice/provisioning';
import { voiceRelayWssUrl, voicePublicBaseUrl } from '@/lib/voice/config';
import { PrismaVoiceRecordingConsentGate } from '@/lib/voice/recording';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);
  const verifier = await getTwilioSignatureVerifier();

  const base = voicePublicBaseUrl();
  const recordingCallbackUrl = base
    ? new URL('/api/voice/twilio/recording', base).toString()
    : undefined;

  const result = await handleIncomingCall({
    url: req.url,
    params,
    signature: req.headers.get('x-twilio-signature'),
    verifier,
    resolver: envNumberResolver,
    relayWssUrl: voiceRelayWssUrl(),
    recordingCallbackUrl,
    recordingGate: new PrismaVoiceRecordingConsentGate(),
  });

  return new NextResponse(result.body, {
    status: result.status,
    headers: { 'content-type': result.contentType },
  });
}
