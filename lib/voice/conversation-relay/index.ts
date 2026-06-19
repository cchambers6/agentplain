/**
 * lib/voice/conversation-relay/index.ts
 *
 * Barrel for the ConversationRelay bridge. The Next.js app imports the pure
 * pieces (protocol, session, handler); the always-on relay process imports
 * `server.ts` directly.
 */

export * from './protocol';
export * from './session';
export * from './handler';
export { sessionFromSetupParams, attachSocket, startRelayServer } from './server';
