/**
 * POST /api/voice/twilio/recording
 *
 * Recording-status callback. Fires when a call recording finishes processing.
 * We validate the signature, record the recording metadata + computed retention
 * expiry to the audit log, and ack 204. Media itself stays on Twilio until the
 * retention purge job (parked) fetches/deletes it per the workspace policy.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { handleRecordingStatus, parseFormBody } from '@/lib/voice/receivers';
import { getTwilioSignatureVerifier } from '@/lib/voice/twilio-signature';
import { withSystemContext } from '@/lib/db/rls';
import { defaultRecordingPolicy, recordingExpiresAt } from '@/lib/voice/recording';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const params = parseFormBody(await req.text());
  const verifier = await getTwilioSignatureVerifier();

  const result = await handleRecordingStatus({
    url: req.url,
    params,
    signature: req.headers.get('x-twilio-signature'),
    verifier,
    onEvent: async (event) => {
      const expiresAt = recordingExpiresAt(Date.now(), defaultRecordingPolicy());
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            action: 'voice.recording.status',
            targetTable: 'VoiceCallRecording',
            targetId: event.recordingSid,
            payload: { ...event, retentionExpiresAt: expiresAt.toISOString() },
          },
        }),
      );
    },
  });

  return new NextResponse(result.body || null, {
    status: result.status,
    headers: { 'content-type': result.contentType },
  });
}
