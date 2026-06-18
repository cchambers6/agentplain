/**
 * lib/voice/conversation-relay/server.ts
 *
 * Standalone ConversationRelay WebSocket server entrypoint.
 *
 * WHY THIS IS SEPARATE FROM NEXT.JS: ConversationRelay needs a persistent
 * `wss://` connection for the duration of a call. Vercel's serverless/edge
 * runtime cannot hold a long-lived socket, so the relay runs as its own
 * always-on Node process (Render / Fly / a small VM / a container). The Next.js
 * app only returns the TwiML that points Twilio at this server's URL
 * (VOICE_RELAY_WSS_URL).
 *
 * STATUS — PARKED until Conner provisions Twilio + a host. This module imports
 * `ws` via a NON-LITERAL specifier so `tsc`/Next never require the package at
 * build time; it is not referenced by any page. To run it once provisioned:
 *
 *   npm install ws
 *   VOICE_RELAY_PORT=8080 node --import tsx lib/voice/conversation-relay/server.ts
 *
 * then point ConversationRelay at wss://<host>:8080.
 *
 * The socket loop is intentionally thin — all decision logic lives in
 * `handler.ts` (unit-tested), all session state in `session.ts`. This file
 * only wires a socket to those.
 */

import { parseInboundMessage } from './protocol';
import {
  createSession,
  DegradedVoiceResponder,
  type VoiceResponder,
  type ConversationRelaySession,
} from './session';
import { handleInboundMessage } from './handler';
import { DEFAULT_PLAYBOOK, playbookById, playbookForVerticalSlug } from '../playbooks';

/** Minimal structural types for the `ws` server we depend on at runtime. */
interface WsLike {
  on(event: 'message', cb: (data: unknown) => void): void;
  on(event: 'close', cb: () => void): void;
  send(data: string): void;
  close(): void;
}
interface WsServerLike {
  on(event: 'connection', cb: (socket: WsLike) => void): void;
}
interface WsModuleLike {
  WebSocketServer: new (opts: { port: number }) => WsServerLike;
}

/**
 * How a connecting call resolves to a workspace + playbook. The incoming-call
 * route embeds these as ConversationRelay <Parameter> custom params, so they
 * arrive on the `setup` frame. We default safely when absent.
 */
export function sessionFromSetupParams(
  callSid: string,
  params: Record<string, string> | undefined,
): ConversationRelaySession {
  const workspaceId = params?.workspaceId ?? '';
  const playbook = params?.playbookId
    ? (playbookById(params.playbookId) ?? DEFAULT_PLAYBOOK)
    : playbookForVerticalSlug(params?.verticalSlug ?? null);
  return createSession({ callSid, workspaceId, playbook });
}

/**
 * Bind a single socket to the handler. Exported so it can be exercised with a
 * fake socket in tests without standing up a real server.
 */
export function attachSocket(socket: WsLike, responder: VoiceResponder): void {
  let session: ConversationRelaySession | null = null;

  socket.on('message', async (data: unknown) => {
    const msg = parseInboundMessage(String(data));
    if (!msg) return;

    if ((msg.type === 'setup' || msg.type === 'connected') && !session) {
      const callSid = (msg as { callSid?: string }).callSid ?? 'unknown';
      const params = (msg as { customParameters?: Record<string, string> }).customParameters;
      session = sessionFromSetupParams(callSid, params);
    }
    if (!session) return;

    for await (const out of handleInboundMessage(msg, session, responder, { stream: true })) {
      socket.send(JSON.stringify(out));
      if (out.type === 'end') socket.close();
    }
  });
}

/** Boot the server. Lazy-imports `ws` so the package is only needed at runtime. */
export async function startRelayServer(
  port = Number(process.env.VOICE_RELAY_PORT ?? 8080),
  responder: VoiceResponder = new DegradedVoiceResponder(),
): Promise<void> {
  const pkg = 'ws';
  const ws = (await import(/* @vite-ignore */ pkg)) as unknown as WsModuleLike;
  const server = new ws.WebSocketServer({ port });
  server.on('connection', (socket) => attachSocket(socket, responder));
  // eslint-disable-next-line no-console
  console.log(`[voice-relay] ConversationRelay WebSocket server listening on :${port}`);
}

// Run directly: `node --import tsx lib/voice/conversation-relay/server.ts`
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /conversation-relay[\\/]server\.ts$/.test(process.argv[1] ?? '');
if (isDirectRun) {
  startRelayServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[voice-relay] failed to start', err);
    process.exitCode = 1;
  });
}
