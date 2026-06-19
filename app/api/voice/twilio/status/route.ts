/**
 * POST /api/voice/twilio/status
 *
 * Call-status callback (initiated / ringing / answered / completed). Twilio
 * sends these asynchronously; we validate the signature, record the lifecycle
 * event to the audit log, and ack 204. No TwiML.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { handleCallStatus, parseFormBody } from '@/lib/voice/receivers';
import { getTwilioSignatureVerifier } from '@/lib/voice/twilio-signature';
import { withSystemContext } from '@/lib/db/rls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const params = parseFormBody(await req.text());
  const verifier = await getTwilioSignatureVerifier();

  const result = await handleCallStatus({
    url: req.url,
    params,
    signature: req.headers.get('x-twilio-signature'),
    verifier,
    onEvent: async (event) => {
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            action: 'voice.call.status',
            targetTable: 'VoiceCall',
            targetId: event.callSid,
            payload: { ...event },
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
