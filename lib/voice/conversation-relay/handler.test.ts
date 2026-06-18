import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleInboundMessage } from './handler';
import {
  createSession,
  DegradedVoiceResponder,
  type ConversationRelaySession,
  type VoiceResponder,
} from './session';
import type { CRInboundMessage, CROutboundMessage } from './protocol';
import { generalReceptionist } from '../playbooks';

function freshSession(over: Partial<ConversationRelaySession> = {}): ConversationRelaySession {
  return {
    ...createSession({ callSid: 'CA1', workspaceId: 'ws1', playbook: generalReceptionist }),
    ...over,
  };
}

async function drain(
  msg: CRInboundMessage,
  session: ConversationRelaySession,
  responder: VoiceResponder,
  stream = false,
): Promise<CROutboundMessage[]> {
  const out: CROutboundMessage[] = [];
  for await (const m of handleInboundMessage(msg, session, responder, { stream })) out.push(m);
  return out;
}

/** A responder that streams a fixed three-token reply. */
class FixedResponder implements VoiceResponder {
  constructor(private readonly tokens: string[]) {}
  async *respond(): AsyncIterable<string> {
    for (const t of this.tokens) yield t;
  }
}

describe('handleInboundMessage', () => {
  it('answers a prompt with a single text frame in non-stream mode', async () => {
    const session = freshSession();
    const out = await drain(
      { type: 'prompt', voicePrompt: 'I have a question about my account' },
      session,
      new FixedResponder(['Hello ', 'there ', 'friend']),
    );
    assert.equal(out.length, 1);
    assert.deepEqual(out[0], { type: 'text', token: 'Hello there friend', last: true });
    // History records both the user turn and the assistant reply.
    assert.deepEqual(session.history, [
      { role: 'user', content: 'I have a question about my account' },
      { role: 'assistant', content: 'Hello there friend' },
    ]);
  });

  it('streams token-by-token then a closing last:true frame', async () => {
    const session = freshSession();
    const out = await drain(
      { type: 'prompt', voicePrompt: 'hi' },
      session,
      new FixedResponder(['a', 'b', 'c']),
      true,
    );
    assert.deepEqual(out, [
      { type: 'text', token: 'a', last: false },
      { type: 'text', token: 'b', last: false },
      { type: 'text', token: 'c', last: false },
      { type: 'text', token: '', last: true },
    ]);
    assert.equal(session.history.at(-1)?.content, 'abc');
  });

  it('ignores empty prompts (no frames, no history)', async () => {
    const session = freshSession();
    const out = await drain(
      { type: 'prompt', voicePrompt: '   ' },
      session,
      new DegradedVoiceResponder(),
    );
    assert.equal(out.length, 0);
    assert.equal(session.history.length, 0);
  });

  it('force-ends the call past the max-turn safety bound', async () => {
    const session = freshSession({ maxTurns: 1 });
    // First caller turn — fine.
    await drain({ type: 'prompt', voicePrompt: 'one' }, session, new FixedResponder(['ok']));
    // Second caller turn exceeds maxTurns=1 → ends.
    const out = await drain({ type: 'prompt', voicePrompt: 'two' }, session, new FixedResponder(['ok']));
    assert.ok(out.some((m) => m.type === 'end'));
    assert.ok(out.some((m) => m.type === 'text' && m.last));
  });

  it('acknowledges an interrupt frame', async () => {
    const out = await drain({ type: 'interrupt' }, freshSession(), new DegradedVoiceResponder());
    assert.deepEqual(out, [{ type: 'interrupt' }]);
  });

  it('ends gracefully on a relay error', async () => {
    const out = await drain(
      { type: 'error', description: 'boom' },
      freshSession(),
      new DegradedVoiceResponder(),
    );
    assert.deepEqual(out, [{ type: 'end', reason: 'relay-error' }]);
  });

  it('records dtmf as a caller turn and replies', async () => {
    const session = freshSession();
    const out = await drain({ type: 'dtmf', digit: '0' }, session, new FixedResponder(['one moment']));
    assert.equal(session.history[0].content, '[caller pressed 0]');
    assert.ok(out.some((m) => m.type === 'text'));
  });

  it('setup backfills from/to onto the session', async () => {
    const session = freshSession();
    await drain(
      { type: 'setup', from: '+14155551212', to: '+18005550100' },
      session,
      new DegradedVoiceResponder(),
    );
    assert.equal(session.from, '+14155551212');
    assert.equal(session.to, '+18005550100');
  });
});
