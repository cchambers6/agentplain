/**
 * POST /api/voice/twilio/transcript
 *
 * Conversation Intelligence OperatorResults receiver. After a call completes,
 * Twilio's CI runs Language Operators (Summary, Sentiment, a custom Action-Items
 * extractor) and POSTs the results (JSON) here via a configured WEBHOOK action.
 * We turn those into action items and write them into the approvals queue.
 *
 * AUTH: CI v3 webhooks are JSON, not form-encoded, so the X-Twilio-Signature
 * form scheme doesn't apply. Because the action URL is one WE configure, we
 * authenticate with a bearer secret (`VOICE_TRANSCRIPT_WEBHOOK_SECRET`) appended
 * when the Intelligence Configuration is created.
 *
 * The workspace is resolved from `workspaceId` carried on the payload (or the
 * `?workspaceId=` query param) — both set when we provision the number's
 * Intelligence config. Per `project_no_outbound_architecture.md` every item is
 * draft-only.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { handleTranscript } from '@/lib/voice/receivers';
import { prismaVoiceActionPersistence } from '@/lib/voice/transcript-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerOk(headerValue: string | null, queryToken: string | null): boolean {
  const secret = process.env.VOICE_TRANSCRIPT_WEBHOOK_SECRET;
  if (!secret) return false; // fail-closed: no secret configured → reject.
  const presented = headerValue?.replace(/^Bearer\s+/i, '') ?? queryToken ?? '';
  const a = Buffer.from(presented, 'utf-8');
  const b = Buffer.from(secret, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const url = new URL(req.url);
  const queryWorkspaceId = url.searchParams.get('workspaceId');

  const result = await handleTranscript({
    payload,
    authorized: bearerOk(req.headers.get('authorization'), url.searchParams.get('token')),
    resolveWorkspaceId: async () => {
      if (payload && typeof payload === 'object') {
        const wid = (payload as Record<string, unknown>).workspaceId;
        if (typeof wid === 'string' && wid) return wid;
      }
      return queryWorkspaceId || null;
    },
    persistence: prismaVoiceActionPersistence,
  });

  return new NextResponse(result.body, {
    status: result.status,
    headers: { 'content-type': result.contentType },
  });
}
