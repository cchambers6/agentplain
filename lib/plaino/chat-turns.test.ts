/**
 * lib/plaino/chat-turns.test.ts
 *
 * Pins the pure /api/chat helpers: role mapping, transcript assembly, and
 * latest-question lookup.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appendReply, latestUserMessage, toLlmMessages } from './chat-turns';

describe('toLlmMessages', () => {
  it('maps plaino → assistant and user → user', () => {
    const out = toLlmMessages([
      { role: 'user', body: 'hi' },
      { role: 'plaino', body: 'hello' },
    ]);
    assert.deepEqual(out, [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });
});

describe('appendReply', () => {
  it('appends the reply as a plaino turn with the given timestamp', () => {
    const at = '2026-06-06T00:00:00.000Z';
    const out = appendReply([{ role: 'user', body: 'q' }], 'a', at);
    assert.deepEqual(out, [
      { role: 'user', body: 'q', at },
      { role: 'plaino', body: 'a', at },
    ]);
  });
});

describe('latestUserMessage', () => {
  it('returns the most recent user turn', () => {
    assert.equal(
      latestUserMessage([
        { role: 'user', body: 'first' },
        { role: 'plaino', body: 'reply' },
        { role: 'user', body: 'second' },
      ]),
      'second',
    );
  });

  it('returns empty string when there is no user turn', () => {
    assert.equal(latestUserMessage([{ role: 'plaino', body: 'x' }]), '');
  });
});
